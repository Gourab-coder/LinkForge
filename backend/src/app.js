const express = require("express");
const cors = require("cors");

const app = express();

const rawOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const corsOptions = {
  origin: rawOrigins.length > 0 ? rawOrigins : "*",
  credentials: rawOrigins.length > 0
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "LinkForge backend is running"
  });
});
// http://localhost:3000/

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});
// http://localhost:3000/health

module.exports = app;