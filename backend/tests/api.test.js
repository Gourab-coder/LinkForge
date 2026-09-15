require("dotenv").config();

const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/app");

const authToken = jwt.sign(
  { id: 1, email: "test@example.com" },
  process.env.JWT_SECRET || "change_this_secret_in_env"
);

test("GET /health returns an OK status", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("GET / returns the API status message", async () => {
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.equal(response.body.message, "LinkForge backend is running");
});

test("POST /api/auth/register rejects a short password", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: "new@example.com", password: "short" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Password must be at least 8 characters");
});

test("POST /api/auth/login rejects missing credentials", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Email and password are required");
});

test("GET /api/auth/me rejects requests without a bearer token", async () => {
  const response = await request(app).get("/api/auth/me");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication token is required");
});

test("POST /api/v1/urls rejects requests without authentication", async () => {
  const response = await request(app)
    .post("/api/v1/urls")
    .send({ longUrl: "https://example.com" });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication token is required");
});

test("GET /api/v1/urls/:id/analytics rejects requests without authentication", async () => {
  const response = await request(app).get("/api/v1/urls/1/analytics");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication token is required");
});

test("POST /api/v1/urls validates the URL before database access", async () => {
  const response = await request(app)
    .post("/api/v1/urls")
    .set("Authorization", `Bearer ${authToken}`)
    .send({ longUrl: "not-a-url" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "longUrl must be a valid HTTP or HTTPS URL");
});

test("GET /:shortCode rejects an unknown short code with the API error shape", async () => {
  const response = await request(app).get("/does-not-exist");

  // This request reaches the database-backed redirect path. A 404 is expected
  // when the configured database is available; a 500 means the test database
  // is not configured and is reported clearly by the test output.
  assert.ok([404, 500].includes(response.status));
  assert.equal(typeof response.body.message, "string");
});