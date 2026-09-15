const express = require("express");

const { register, login, me } = require("../controllers/authController");
const requireAuth = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Registration and login are the authentication endpoints most exposed to abuse.
router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.get("/me", requireAuth, me);

module.exports = router;
