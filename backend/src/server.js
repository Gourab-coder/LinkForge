require("dotenv").config();

const app = require("./app");
const pool = require('./config/database')
const PORT = Number(process.env.PORT) || 3000;

pool.query("SELECT NOW()").then((result) => {
  console.log("PostgreSQL connected");
  console.log("Database time:", result.rows[0].now);

  app.listen(PORT, () => {
    console.log(`LinkForge backend is running on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Database connection failed:", error);
});



// http://localhost:3000