const urlService = require("../services/urlService");
const analyticsService = require("../services/analyticsService");

// Convert database column names into the public API response format.
// Keep internal database names out of the public response and use the configured host.
function toResponse(url) {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (!publicBaseUrl) {
    throw new Error("PUBLIC_BASE_URL must be configured to create public short links");
  }

  return {
    id: url.id,
    longUrl: url.long_url,
    shortCode: url.short_code,
    shortUrl: `${publicBaseUrl.replace(/\/+$/, "")}/${url.short_code}`,
    clickCount: url.click_count,
    createdAt: url.created_at,
    expiresAt: url.expires_at
  };
}

// Create a link for the authenticated owner and return its public representation.
async function create(req, res) {
  const url = await urlService.create({
    userId: req.user.id,
    longUrl: req.body?.longUrl,
    expiresAt: req.body?.expiresAt
  });

  return res.status(201).json(toResponse(url));
}

// Return only links owned by the current authenticated user.
async function list(req, res) {
  const urls = await urlService.list(req.user.id);
  return res.json({ urls: urls.map(toResponse) });
}

// Read one of the current user's links.
async function getById(req, res) {
  const url = await urlService.getForUser(req.params.id, req.user.id);
  return res.json(toResponse(url));
}

// Delete one of the current user's links.
async function remove(req, res) {
  await urlService.remove(req.params.id, req.user.id);
  return res.status(204).send();
}

// Return owner-scoped analytics with optional date boundaries.
async function analytics(req, res) {
  const result = await analyticsService.getForUser({
    urlId: req.params.id,
    userId: req.user.id,
    from: req.query.from,
    to: req.query.to
  });

  return res.json(result);
}

// Redirect to the saved destination after validating and recording the short code.
async function redirect(req, res) {
  const longUrl = await urlService.redirect(req.params.shortCode, req);
  return res.redirect(302, longUrl);
}

module.exports = { create, list, getById, remove, analytics, redirect };
