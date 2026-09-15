require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const redisClient = require("./config/redis");

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
    try {
        // Verify dependencies before accepting HTTP traffic.
        const result = await pool.query("SELECT NOW()");

        console.log("PostgreSQL connected");
        console.log("Database time:", result.rows[0].now);

        await redisClient.connect();
        console.log("Redis connected");

        app.listen(PORT, () => {
            console.log(`LinkForge backend is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
