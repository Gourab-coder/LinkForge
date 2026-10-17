const path = require("path");
const dotenv = require("dotenv");

// Load the backend's own environment file even when commands run from the repo root.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requiredSecret(name, minimumLength = 32) {
  const value = process.env[name];
  if (!value || value.length < minimumLength || /^(replace-with|change_this|your-)/i.test(value)) {
    throw new Error(`${name} must be a random secret of at least ${minimumLength} characters`);
  }
  return value;
}

// Fail before listening when deployment-critical secrets or origins are missing.
function validateRuntimeConfig() {
  requiredSecret("JWT_SECRET");
  requiredSecret("VISITOR_HASH_SALT");

  const tokenLifetime = process.env.JWT_EXPIRES_IN || "7d";
  if (!/^\d+[smhdw]$/.test(tokenLifetime)) {
    throw new Error("JWT_EXPIRES_IN must be an integer followed by s, m, h, d, or w");
  }

  if (process.env.PUBLIC_BASE_URL) {
    let publicUrl;
    try {
      publicUrl = new URL(process.env.PUBLIC_BASE_URL);
    } catch {
      throw new Error("PUBLIC_BASE_URL must be a valid HTTP or HTTPS URL");
    }
    if (!(["http:", "https:"].includes(publicUrl.protocol)) || publicUrl.username || publicUrl.password) {
      throw new Error("PUBLIC_BASE_URL must use HTTP or HTTPS and cannot contain credentials");
    }
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.CLIENT_URL) {
      throw new Error("CLIENT_URL must contain the allowed frontend origin(s) in production");
    }
    if (!process.env.PUBLIC_BASE_URL) {
      throw new Error("PUBLIC_BASE_URL must be set in production");
    }

    const origins = process.env.CLIENT_URL.split(",").map((origin) => origin.trim()).filter(Boolean);
    if (origins.length === 0 || origins.some((origin) => {
      try {
        const parsedOrigin = new URL(origin);
        return !["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin;
      } catch {
        return true;
      }
    })) {
      throw new Error("CLIENT_URL must contain comma-separated frontend origins without paths");
    }
  }
}

module.exports = { requiredSecret, validateRuntimeConfig };
