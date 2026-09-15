const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const urlRoutes = require("./routes/urlRoutes");
const urlController = require("./controllers/urlController");
const errorHandler = require("./middleware/errorHandler");
const { redirectRateLimiter } = require("./middleware/rateLimiter");

const app = express();

const rawOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const corsOptions = {
  origin: rawOrigins.length > 0 ? rawOrigins : "*",
  credentials: rawOrigins.length > 0
};

app.use(cors(corsOptions));
app.use(express.json());

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
app.use(errorHandler);

module.exports = app;