const { validateRuntimeConfig } = require("./config/env");

const app = require("./app");
const pool = require("./config/database");
const redisClient = require("./config/redis");
const { closeAnalyticsQueue } = require("./queues/analyticsQueue");

const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be a valid TCP port");
}
let httpServer;
let isShuttingDown = false;

// Validate secrets before opening service connections or accepting requests.
async function startServer() {
    try {
        validateRuntimeConfig();

        // Verify dependencies before accepting HTTP traffic.
        await pool.query("SELECT 1");

        console.log("[INFO] PostgreSQL connected");

        await redisClient.connect();
        console.log("[INFO] Redis connected");

        httpServer = app.listen(PORT, () => {
            console.log(`[INFO] LinkForge backend is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("[ERROR] Failed to start server:", error.message);
        await closeConnections();
        process.exit(1);
    }
}

// Stop taking new work, then close queues and database connections cleanly.
async function closeConnections() {
    await closeAnalyticsQueue().catch((error) => {
        console.error("[ERROR] Could not close analytics queue:", error.message);
    });
    if (redisClient.isOpen) {
        await redisClient.quit().catch((error) => {
            console.error("[ERROR] Could not close Redis:", error.message);
        });
    }
    await pool.end().catch((error) => {
        console.error("[ERROR] Could not close PostgreSQL:", error.message);
    });
}

// Handle deployment restarts without abandoning in-flight HTTP requests.
async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[INFO] ${signal} received; shutting down`);

    if (httpServer) {
        await new Promise((resolve) => httpServer.close(resolve));
    }
    await closeConnections();
    process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

startServer();
