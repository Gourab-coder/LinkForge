const { Pool } = require("pg");
require("./env");

// Keep database access bounded and enable verified TLS when requested by deployment config.
function databaseOptions() {
    const requiredValues = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
    const missingValues = requiredValues.filter((name) => !process.env[name]);
    if (missingValues.length > 0) {
        throw new Error(`Missing database configuration: ${missingValues.join(", ")}`);
    }

    const port = Number(process.env.DB_PORT || 5432);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("DB_PORT must be a valid TCP port");
    }

    const poolMax = Number(process.env.DB_POOL_MAX || 10);
    if (!Number.isInteger(poolMax) || poolMax < 1) {
        throw new Error("DB_POOL_MAX must be a positive integer");
    }

    const connectionTimeout = Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000);
    if (!Number.isInteger(connectionTimeout) || connectionTimeout < 1) {
        throw new Error("DB_CONNECTION_TIMEOUT_MS must be a positive integer");
    }

    return {
        host: process.env.DB_HOST,
        port,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: poolMax,
        connectionTimeoutMillis: connectionTimeout,
        ssl: process.env.DB_SSL === "true"
            ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
            : undefined
    };
}

const pool = new Pool(databaseOptions());

module.exports = pool;
