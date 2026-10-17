const jwt = require("jsonwebtoken");
const { requiredSecret } = require("../config/env");

// Verify bearer tokens with the expected algorithm and reject malformed identity claims.
function requireAuth(req, res, next) {
  const authorization = req.get("authorization");
  const token = authorization && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required" });
  }

  try {
    req.user = jwt.verify(
      token,
      requiredSecret("JWT_SECRET"),
      { algorithms: ["HS256"] }
    );
    if (!Number.isSafeInteger(req.user.id) || req.user.id < 1 || typeof req.user.email !== "string") {
      return res.status(401).json({ message: "Invalid or expired authentication token" });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired authentication token" });
  }
}

module.exports = requireAuth;
