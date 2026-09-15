const redisClient = require("../config/redis");

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function createRateLimiter({ name, windowSeconds, maxRequests }) {
  const windowSize = Math.floor(windowSeconds);
  const requestLimit = Math.floor(maxRequests);

  return async function rateLimiter(req, res, next) {
    if (!redisClient.isReady) return next();

    // Each scope and IP gets an independent fixed one-window counter.
    const windowId = Math.floor(Date.now() / 1000 / windowSize);
    const key = `rate-limit:${name}:${req.ip}:${windowId}`;
    const resetAt = (windowId + 1) * windowSize;

    try {
      const requestCount = await redisClient.incr(key);
      if (requestCount === 1) {
        await redisClient.expire(key, windowSize);
      }

      const remaining = Math.max(0, requestLimit - requestCount);
      res.setHeader("X-RateLimit-Limit", requestLimit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", resetAt);

      if (requestCount > requestLimit) {
        const retryAfter = Math.max(1, resetAt - Math.floor(Date.now() / 1000));
        res.setHeader("Retry-After", retryAfter);
        return res.status(429).json({
          message: "Too many requests. Please try again later.",
          retryAfter
        });
      }
    } catch (error) {
      // Redis should not make the API unavailable when rate limiting is degraded.
      console.error(`Rate limiter failed for ${name}:`, error.message);
    }

    return next();
  };
}

const authRateLimiter = createRateLimiter({
  name: "auth",
  windowSeconds: numberFromEnv("AUTH_RATE_LIMIT_WINDOW_SECONDS", 60),
  maxRequests: numberFromEnv("AUTH_RATE_LIMIT_MAX", 10)
});

const urlRateLimiter = createRateLimiter({
  name: "urls",
  windowSeconds: numberFromEnv("URL_RATE_LIMIT_WINDOW_SECONDS", 60),
  maxRequests: numberFromEnv("URL_RATE_LIMIT_MAX", 100)
});

const redirectRateLimiter = createRateLimiter({
  name: "redirects",
  windowSeconds: numberFromEnv("REDIRECT_RATE_LIMIT_WINDOW_SECONDS", 60),
  maxRequests: numberFromEnv("REDIRECT_RATE_LIMIT_MAX", 60)
});

module.exports = { authRateLimiter, urlRateLimiter, redirectRateLimiter };