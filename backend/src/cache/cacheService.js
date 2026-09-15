const redisClient = require("../config/redis");

const defaultTtl = Number(process.env.CACHE_TTL_SECONDS) || 300;

// Cache failures are deliberately non-fatal: PostgreSQL remains the source of truth.
async function get(key) {
	if (!redisClient.isReady) return null;

	try {
		const value = await redisClient.get(key);
		return value ? JSON.parse(value) : null;
	} catch (error) {
		console.error(`Cache read failed for ${key}:`, error.message);
		return null;
	}
}

async function set(key, value, ttl = defaultTtl) {
	if (!redisClient.isReady) return;

	try {
		await redisClient.set(key, JSON.stringify(value), { EX: ttl });
	} catch (error) {
		console.error(`Cache write failed for ${key}:`, error.message);
	}
}

async function remove(...keys) {
	const existingKeys = keys.filter(Boolean);
	if (existingKeys.length === 0 || !redisClient.isReady) return;

	try {
		await redisClient.del(existingKeys);
	} catch (error) {
		console.error("Cache invalidation failed:", error.message);
	}
}

module.exports = { get, set, remove };