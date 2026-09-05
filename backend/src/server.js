require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`LinkForge backend is running on port ${PORT}`);
});

// http://localhost:3000