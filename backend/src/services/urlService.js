const crypto = require("crypto");

const urlRepository = require("../repositories/urlRepository");

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function createShortCode(length = 5) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await urlRepository.createUrl({
        userId,
        longUrl: normalizedUrl,
        shortCode: createShortCode(),
        expiresAt: normalizedExpiresAt
      });
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
  return urlRepository.findAllForUser(userId);
}

async function getForUser(id, userId) {
  const url = await urlRepository.findByIdForUser(id, userId);
  if (!url) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }
  return url;
}

async function remove(id, userId) {
  const deleted = await urlRepository.deleteByIdForUser(id, userId);
  if (!deleted) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }
}

async function redirect(shortCode, request) {
  const url = await urlRepository.findByShortCode(shortCode);
  if (!url) {
    const error = new Error("Short URL not found");
    error.statusCode = 404;
    throw error;
  }

  if (url.expires_at && new Date(url.expires_at) <= new Date()) {
    const error = new Error("Short URL has expired");
    error.statusCode = 410;
    throw error;
  }

  await urlRepository.recordClick({
    id: url.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent")
  });

  return url.long_url;
}

module.exports = { create, list, getForUser, remove, redirect };