const bcrypt = require("bcryptjs");

const pool = require("../config/database");
const generateToken = require("../utilis/jwt");

function publicUser(user) {
	return {
		id: user.id,
		email: user.email,
		createdAt: user.created_at
	};
}

async function register(req, res) {
	const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
	const password = typeof req.body.password === "string" ? req.body.password : "";

	if (!email || !password) {
		return res.status(400).json({ message: "Email and password are required" });
	}

	if (password.length < 8) {
		return res.status(400).json({ message: "Password must be at least 8 characters" });
	}

	const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
	if (existingUser.rowCount > 0) {
		return res.status(409).json({ message: "An account with this email already exists" });
	}

	const passwordHash = await bcrypt.hash(password, 12);
	const result = await pool.query(
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
		[email, passwordHash]
	);

	const user = result.rows[0];
	return res.status(201).json({ user: publicUser(user), token: generateToken(user) });
}

async function login(req, res) {
	const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
	const password = typeof req.body.password === "string" ? req.body.password : "";

	if (!email || !password) {
		return res.status(400).json({ message: "Email and password are required" });
	}

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

function me(req, res) {
	return res.json({ user: req.user });
}

module.exports = { register, login, me };
