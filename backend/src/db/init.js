const fs = require("fs");
const path = require("path");

const pool = require("../config/database");

// Apply the repeatable schema file and report failures through the process exit code.
async function initializeDatabase() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");

        await pool.query(sql);

        console.log("Database tables created successfully");

    } catch (error) {
        console.error("Database initialization failed:", error.code || error.name);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

initializeDatabase();
