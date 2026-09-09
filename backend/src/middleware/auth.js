const jwt = require("jsonwebtoken");

module.exports = function requireAuth(req, res, next) {
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
			process.env.JWT_SECRET || "change_this_secret_in_env"
		);
		return next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired authentication token" });
	}
};
