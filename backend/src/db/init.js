const fs = require("fs");
const path = require("path");

const pool = require("../config/database");

async function initializeDatabase() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf8");

        await pool.query(sql);

        console.log("Database tables created successfully");

    } catch (error) {
        console.error("Database initialization failed:", error);
    } finally {
        await pool.end();
    }
}

initializeDatabase();