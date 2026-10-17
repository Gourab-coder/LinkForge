const bcrypt = require("bcryptjs");

const pool = require("../config/database");
const generateToken = require("../utils/jwt");

// Never expose password hashes or other database-only fields in API responses.
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at
  };
}

// Validate normalized email and password values before database or bcrypt work begins.
function validateCredentials(body = {}) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("A valid email address is required");
    error.statusCode = 400;
    throw error;
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password must be 72 bytes or fewer");
    error.statusCode = 400;
    throw error;
  }

  return { email, password };
}

// Create an account with a bcrypt hash; the database unique constraint handles races.
async function register(req, res) {
  const { email, password } = validateCredentials(req.body || {});

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingUser.rowCount > 0) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let result;
  try {
    result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, passwordHash]
    );
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    throw error;
  }

  const user = result.rows[0];
  return res.status(201).json({ user: publicUser(user), token: generateToken(user) });
}

async function login(req, res) {
  const { email, password } = validateCredentials(req.body || {});

  const result = await pool.query(
    "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  const passwordMatches = user && await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json({ user: publicUser(user), token: generateToken(user) });
}

// Return only the identity claims needed by the signed-in frontend.
function me(req, res) {
	return res.json({ user: req.user });
}

module.exports = { register, login, me };
