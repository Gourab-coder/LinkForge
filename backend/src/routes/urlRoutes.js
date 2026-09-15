const express = require("express");

const urlController = require("../controllers/urlController");
const requireAuth = require("../middleware/auth");
const { urlRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Every URL operation belongs to the authenticated user in req.user.
router.use(requireAuth);
router.use(urlRateLimiter);
router.post("/", urlController.create);
router.get("/", urlController.list);
router.get("/:id/analytics", urlController.analytics);
router.get("/:id", urlController.getById);
router.delete("/:id", urlController.remove);

module.exports = router;