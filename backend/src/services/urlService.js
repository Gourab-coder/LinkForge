const crypto = require("crypto");

const urlRepository = require("../repositories/urlRepository");
const cacheService = require("../cache/cacheService");
const { enqueueClickEvent } = require("../queues/analyticsQueue");

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Keep cache key construction in one place so reads and invalidation always match.
function shortCodeCacheKey(shortCode) {
  return `url:short:${shortCode}`;
}

// Scope cached URL lists to their owner to prevent cross-account cache exposure.
function userListCacheKey(userId) {
  return `url:user:${userId}:list`;
}

// Include both owner and URL ID for the same ownership boundary as the database query.
function userUrlCacheKey(userId, id) {
  return `url:user:${userId}:id:${id}`;
}

// Never cache a URL beyond its expiration time.
function getCacheTtl(expiresAt) {
  const configuredTtl = Number(process.env.CACHE_TTL_SECONDS) || 300;
  if (!expiresAt) return configuredTtl;

  const secondsUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(1, Math.min(configuredTtl, secondsUntilExpiry));
}

// Use cryptographically secure, uniformly selected characters for public short codes.
function createShortCode(length = 8) {
  return Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
}

// Reduce the user-agent string to a small analytics category before queueing it.
function getDeviceType(userAgent = "") {
  if (/bot|crawler|spider/i.test(userAgent)) return "bot";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

// Hash visitor IPs with a deployment secret and avoid retaining the raw address.
function createVisitorHash(ipAddress) {
  const salt = process.env.VISITOR_HASH_SALT;
  if (!salt || salt.length < 32) {
    throw new Error("VISITOR_HASH_SALT must be set to at least 32 characters");
  }

  return crypto.createHmac("sha256", salt).update(ipAddress || "unknown").digest("hex");
}

// Accept only bounded HTTP(S) destinations so links cannot use script or data schemes.
function validateLongUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error("longUrl is required");
    error.statusCode = 400;
    throw error;
  }

  if (value.length > 2048) {
    const error = new Error("longUrl must be 2048 characters or fewer");
    error.statusCode = 400;
    throw error;
  }

  try {
    const parsedUrl = new URL(value.trim());
    if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      throw new Error();
    }
    return parsedUrl.toString();
  } catch (error) {
    const validationError = new Error("longUrl must be a valid HTTP or HTTPS URL");
    validationError.statusCode = 400;
    throw validationError;
  }
}

// Normalize optional expiry dates and reject links that are already expired.
function validateExpiresAt(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    const error = new Error("expiresAt must be a valid future date");
    error.statusCode = 400;
    throw error;
  }

  return date.toISOString();
}

// Validate inputs, create a collision-resistant code, then invalidate the owner's list cache.
async function create({ userId, longUrl, expiresAt }) {
  const normalizedUrl = validateLongUrl(longUrl);
  const normalizedExpiresAt = validateExpiresAt(expiresAt);

  // A unique constraint is the final guard against a rare short-code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const url = await urlRepository.createUrl({
        userId,
        longUrl: normalizedUrl,
        shortCode: createShortCode(8),
        expiresAt: normalizedExpiresAt
      });

      await cacheService.remove(userListCacheKey(userId));
      return url;
    } catch (error) {
      if (error.code !== "23505") {
        throw error;
      }
    }
  }

  const error = new Error("Could not generate a unique short code");
  error.statusCode = 500;
  throw error;
}

// Use the user-scoped cache first and fall back to the database as source of truth.
async function list(userId) {
  const key = userListCacheKey(userId);
  const cachedUrls = await cacheService.get(key);
  if (cachedUrls) return cachedUrls;

  // Cache misses read from PostgreSQL and refresh Redis for the next request.
  const urls = await urlRepository.findAllForUser(userId);
  await cacheService.set(key, urls);
  return urls;
}

// Return a link only when its ID belongs to the authenticated user.
async function getForUser(id, userId) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }

  const key = userUrlCacheKey(userId, id);
  const cachedUrl = await cacheService.get(key);
  const url = cachedUrl || await urlRepository.findByIdForUser(id, userId);
  if (!url) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }

  if (!cachedUrl) await cacheService.set(key, url, getCacheTtl(url.expires_at));
  return url;
}

// Delete by both link ID and owner, then invalidate every affected cache entry.
async function remove(id, userId) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }

  const url = await urlRepository.findByIdForUser(id, userId);
  const deleted = await urlRepository.deleteByIdForUser(id, userId);
  if (!deleted) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }

  await cacheService.remove(
    userListCacheKey(userId),
    userUrlCacheKey(userId, id),
    url && shortCodeCacheKey(url.short_code)
  );
}

// Resolve a public short code and queue analytics without blocking the redirect path.
async function redirect(shortCode, request) {
  if (!/^[a-zA-Z0-9]{1,20}$/.test(shortCode)) {
    const error = new Error("Short URL not found");
    error.statusCode = 404;
    throw error;
  }

  const key = shortCodeCacheKey(shortCode);
  const cachedUrl = await cacheService.get(key);
  const url = cachedUrl || await urlRepository.findByShortCode(shortCode);
  if (!url) {
    const error = new Error("Short URL not found");
    error.statusCode = 404;
    throw error;
  }

  if (!cachedUrl) await cacheService.set(key, url, getCacheTtl(url.expires_at));

  if (url.expires_at && new Date(url.expires_at) <= new Date()) {
    const error = new Error("Short URL has expired");
    error.statusCode = 410;
    throw error;
  }

  let destination;
  try {
    destination = validateLongUrl(url.long_url);
  } catch {
    const error = new Error("Short URL destination is unavailable");
    error.statusCode = 410;
    throw error;
  }

  const userAgent = request.get("user-agent") || "";
  const eventId = crypto.randomUUID();

  // Analytics are non-critical, so queue failures must not block redirects.
  try {
    await enqueueClickEvent({
      eventId,
      urlId: url.id,
      ipAddress: null,
      visitorHash: createVisitorHash(request.ip),
      userAgent: userAgent.slice(0, 512),
      deviceType: getDeviceType(userAgent),
      country: null
    });
  } catch (error) {
    console.error("Could not enqueue click analytics:", error.message);
  }

  await cacheService.remove(
    userListCacheKey(url.user_id),
    userUrlCacheKey(url.user_id, url.id)
  );
  await cacheService.set(
    key,
    { ...url, click_count: Number(url.click_count || 0) + 1 },
    getCacheTtl(url.expires_at)
  );

  return destination;
}

module.exports = { create, list, getForUser, remove, redirect };
