require("../config/env");

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");

module.exports = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null
};
