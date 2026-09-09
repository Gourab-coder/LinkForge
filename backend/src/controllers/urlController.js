const urlService = require("../services/urlService");

function toResponse(url, req) {
  return {
    id: url.id,
    longUrl: url.long_url,
    shortCode: url.short_code,
    shortUrl: `${req.protocol}://${req.get("host")}/${url.short_code}`,
    clickCount: url.click_count,
    createdAt: url.created_at,
    expiresAt: url.expires_at
  };
}

async function create(req, res) {
  const url = await urlService.create({
    userId: req.user.id,
    longUrl: req.body.longUrl,
    expiresAt: req.body.expiresAt
  });

  return res.status(201).json(toResponse(url, req));
}

async function list(req, res) {
  const urls = await urlService.list(req.user.id);
  return res.json({ urls: urls.map((url) => toResponse(url, req)) });
}

async function getById(req, res) {
  const url = await urlService.getForUser(req.params.id, req.user.id);
  return res.json(toResponse(url, req));
}

async function remove(req, res) {
  await urlService.remove(req.params.id, req.user.id);
  return res.status(204).send();
}

async function redirect(req, res) {
  const longUrl = await urlService.redirect(req.params.shortCode, req);
  return res.redirect(302, longUrl);
}

module.exports = { create, list, getById, remove, redirect };