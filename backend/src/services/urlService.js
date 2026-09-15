const crypto = require("crypto");

const urlRepository = require("../repositories/urlRepository");
const cacheService = require("../cache/cacheService");
const { enqueueClickEvent } = require("../queues/analyticsQueue");

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Keep cache key construction in one place so reads and invalidation always match.
function shortCodeCacheKey(shortCode) {
  return `url:short:${shortCode}`;
}

function userListCacheKey(userId) {
  return `url:user:${userId}:list`;
}

function userUrlCacheKey(userId, id) {
  return `url:user:${userId}:id:${id}`;
}

function getCacheTtl(expiresAt) {
  const configuredTtl = Number(process.env.CACHE_TTL_SECONDS) || 300;
  if (!expiresAt) return configuredTtl;

  const secondsUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(1, Math.min(configuredTtl, secondsUntilExpiry));
}

function createShortCode(length = 5) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function getDeviceType(userAgent = "") {
  if (/bot|crawler|spider/i.test(userAgent)) return "bot";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function createVisitorHash(ipAddress) {
  return crypto
    .createHash("sha256")
    .update(`${process.env.VISITOR_HASH_SALT || "linkforge"}:${ipAddress || "unknown"}`)
    .digest("hex");
}

function validateLongUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error("longUrl is required");
    error.statusCode = 400;
    throw error;
  }

  try {
    const parsedUrl = new URL(value.trim());
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error();
    }
    return parsedUrl.toString();
  } catch (error) {
    const validationError = new Error("longUrl must be a valid HTTP or HTTPS URL");
    validationError.statusCode = 400;
    throw validationError;
  }
}

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

async function create({ userId, longUrl, expiresAt }) {
  const normalizedUrl = validateLongUrl(longUrl);
  const normalizedExpiresAt = validateExpiresAt(expiresAt);

  // A unique constraint is the final guard against a rare short-code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const url = await urlRepository.createUrl({
        userId,
        longUrl: normalizedUrl,
        shortCode: createShortCode(),
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

async function list(userId) {
  const key = userListCacheKey(userId);
  const cachedUrls = await cacheService.get(key);
  if (cachedUrls) return cachedUrls;

  // Cache misses read from PostgreSQL and refresh Redis for the next request.
  const urls = await urlRepository.findAllForUser(userId);
  await cacheService.set(key, urls);
  return urls;
}

async function getForUser(id, userId) {
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

async function remove(id, userId) {
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

async function redirect(shortCode, request) {
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

  const userAgent = request.get("user-agent") || "";
  const eventId = crypto.randomUUID();

  // Analytics are non-critical, so queue failures must not block redirects.
  try {
    await enqueueClickEvent({
      eventId,
      urlId: url.id,
      ipAddress: request.ip,
      visitorHash: createVisitorHash(request.ip),
      userAgent,
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

  return url.long_url;
}

module.exports = { create, list, getForUser, remove, redirect };