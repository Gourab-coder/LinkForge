const express = require("express");
const cors = require("cors");
require("./config/env");
const authRoutes = require("./routes/authRoutes");
const urlRoutes = require("./routes/urlRoutes");
const urlController = require("./controllers/urlController");
const errorHandler = require("./middleware/errorHandler");
const { redirectRateLimiter } = require("./middleware/rateLimiter");

const app = express();

// CORS only controls browser access; requests without an Origin are still allowed for APIs.
const rawOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const corsOptions = {
  origin: rawOrigins.length > 0 ? rawOrigins : [],
  credentials: false
};

// Set defensive headers and avoid exposing Express through its default response header.
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

// Trust only explicitly configured proxy hops so clients cannot spoof req.ip or req.protocol.
if (process.env.TRUST_PROXY_HOPS) {
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(proxyHops) || proxyHops < 1) {
    throw new Error("TRUST_PROXY_HOPS must be a positive integer");
  }
  app.set("trust proxy", proxyHops);
}

app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "16kb", strict: true }));

// Prevent browsers and shared proxies from retaining tokens or account-specific API data.
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// API routes are kept separate from the public short-link redirect.
app.use("/api/auth", authRoutes);
app.use("/api/v1/urls", urlRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "LinkForge backend is running"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.get("/:shortCode", redirectRateLimiter, urlController.redirect);

// Keep unknown routes in the same JSON response shape as handled API errors.
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
