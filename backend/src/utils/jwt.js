const jwt = require("jsonwebtoken");
const { requiredSecret } = require("../config/env");

// Issue short-lived signed tokens only with a strong secret supplied by deployment config.
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    requiredSecret("JWT_SECRET"),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

module.exports = generateToken;
