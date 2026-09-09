const express = require("express");

const urlController = require("../controllers/urlController");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.post("/", urlController.create);
router.get("/", urlController.list);
router.get("/:id", urlController.getById);
router.delete("/:id", urlController.remove);

module.exports = router;