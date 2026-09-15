# LinkForge Backend Testing Guide

This document explains how to run the automated tests and manually test every backend API with Thunder Client.

## 1. Backend Prerequisites

From the `backend` directory:

```bash
npm install
```

Make sure PostgreSQL and Redis are running. The values are read from `.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5438
DB_NAME=linkforge
DB_USER=postgres
DB_PASSWORD=your-password
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
JWT_EXPIRES_IN=7d
```

Initialize the database once:

```bash
npm run db:init
```

Start the backend:

```bash
npm start
```

The base URL is `http://localhost:3000`.

## 2. Automated Tests

Run all tests from the `backend` directory:

```bash
npm test
```

The test command runs `node --test tests/**/*.test.js`. The tests import `src/app.js` directly, so they do not start a separate server. Most tests use invalid input or missing authentication and do not modify the database.

The redirect test uses the configured database because redirect lookup is database-backed. PostgreSQL should be available when running the complete test suite.

The analytics worker is tested separately by starting it with:

```bash
npm run worker
```

## 3. Thunder Client Setup

1. Open the Thunder Client extension in VS Code.
2. Create a collection named `LinkForge`.
3. Use `http://localhost:3000` as the base URL.
4. Set `Content-Type: application/json` on requests with a JSON body.
5. After registering or logging in, copy the returned `token`.
6. For protected requests, add this header:

```text
Authorization: Bearer YOUR_TOKEN
```

Run the requests in the order shown below so that you have a user, token, and short URL to test.

## 4. Health and Status APIs

### GET `/`

Response `200`:

```json
{
  "message": "LinkForge backend is running"
}
```

### GET `/health`

Response `200`:

```json
{
  "status": "ok"
}
```

## 5. Authentication APIs

### POST `/api/auth/register`

Body:

```json
{
  "email": "alice@example.com",
  "password": "password123"
}
```

Successful response `201`:

```json
{
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "createdAt": "2026-09-15T12:00:00.000Z"
  },
  "token": "JWT_TOKEN"
}
```

Error checks:

- Empty email or password: `400`
- Password shorter than 8 characters: `400`
- Existing email: `409`

### POST `/api/auth/login`

Body:

```json
{
  "email": "alice@example.com",
  "password": "password123"
}
```

Successful response `200` returns a `user` object and `token`. Save the token for the remaining requests.

Error checks:

- Empty email or password: `400`
- Incorrect credentials: `401`

### GET `/api/auth/me`

Header:

```text
Authorization: Bearer JWT_TOKEN
```

Successful response `200`:

```json
{
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "iat": 1757937600,
    "exp": 1758542400
  }
}
```

Error checks:

- Missing token: `401`
- Invalid or expired token: `401`

## 6. URL APIs

All URL API requests require the bearer token.

### POST `/api/v1/urls`

Header:

```text
Authorization: Bearer JWT_TOKEN
```

Body without expiration:

```json
{
  "longUrl": "https://www.example.com/docs"
}
```

Body with expiration:

```json
{
  "longUrl": "https://www.example.com/docs",
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

Successful response `201` contains `id`, `shortCode`, `shortUrl`, `longUrl`, `clickCount`, `createdAt`, and `expiresAt`. Save the returned `id` and `shortCode`.

Error checks:

- Missing or invalid URL: `400`
- Non-HTTP/HTTPS URL: `400`
- Expiration in the past: `400`
- Missing token: `401`

### GET `/api/v1/urls`

Header:

```text
Authorization: Bearer JWT_TOKEN
```

Successful response `200`:

```json
{
  "urls": [
    {
      "id": 1,
      "longUrl": "https://www.example.com/docs",
      "shortCode": "abc12",
      "shortUrl": "http://localhost:3000/abc12",
      "clickCount": 0,
      "createdAt": "2026-09-15T12:00:00.000Z",
      "expiresAt": null
    }
  ]
}
```

### GET `/api/v1/urls/:id`

Example:

```text
GET http://localhost:3000/api/v1/urls/1
```

Requires the bearer token. Returns the URL owned by the authenticated user. A missing or non-owned ID returns `404`.

### DELETE `/api/v1/urls/:id`

Example:

```text
DELETE http://localhost:3000/api/v1/urls/1
```

Requires the bearer token. Successful deletion returns `204` with an empty response body. A missing or non-owned ID returns `404`.

## 7. Public Redirect API

### GET `/:shortCode`

This endpoint does not require authentication.

Example:

```text
GET http://localhost:3000/abc12
```

Expected result: HTTP `302` redirect to the original long URL. Thunder Client may show the redirected page or follow the redirect automatically; disable automatic redirect following if you want to inspect the `Location` header.

Error checks:

- Unknown short code: `404`
- Expired short URL: `410`

Every successful redirect records a click and increases `clickCount`.

The API now places click analytics into the Redis-backed BullMQ queue. The worker stores the event in PostgreSQL asynchronously.

## 8. Analytics API

### GET `/api/v1/urls/:id/analytics`

This endpoint requires the bearer token and only returns analytics for URLs owned by the authenticated user.

Example:

```text
GET http://localhost:3000/api/v1/urls/1/analytics
Authorization: Bearer JWT_TOKEN
```

Optional date filtering:

```text
GET http://localhost:3000/api/v1/urls/1/analytics?from=2026-09-01&to=2026-09-15
```

Example response:

```json
{
  "totalClicks": 12,
  "uniqueVisitors": 8,
  "devices": {
    "desktop": 7,
    "mobile": 5
  },
  "topCountries": []
}
```

The worker currently records country as `null`; country aggregation becomes available after adding a trusted geolocation source.

To test the complete flow:

1. Start Redis and PostgreSQL.
2. Run `npm run db:init` after applying the schema changes.
3. Start the API with `npm start`.
4. Start the worker in a second terminal with `npm run worker`.
5. Create a URL and open its short URL several times.
6. Wait for the worker completion messages.
7. Request the analytics endpoint.

The event ID prevents a retried BullMQ job from counting the same click twice.

## 9. Rate Limiting Checks

Rate limits use Redis and are configured in `.env`:

```env
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_MAX=10
URL_RATE_LIMIT_WINDOW_SECONDS=60
URL_RATE_LIMIT_MAX=100
REDIRECT_RATE_LIMIT_WINDOW_SECONDS=60
REDIRECT_RATE_LIMIT_MAX=60
```

The response includes:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

When a limit is exceeded, the API returns `429` and includes `Retry-After`.

To test it manually, send more than 10 requests to `POST /api/auth/login` from the same client within one minute. Do not use a real account password; use an invalid password.

## 9. Common Problems

- `ECONNREFUSED` for PostgreSQL: check `DB_HOST`, `DB_PORT`, and that PostgreSQL is running.
- `Redis connection` errors: check that Redis is running at `REDIS_URL`.
- `401 Authentication token is required`: add the `Authorization: Bearer JWT_TOKEN` header.
- `409 An account with this email already exists`: use a new email or test the login endpoint.
- `404 URL not found`: confirm the URL ID belongs to the authenticated user.
- Port already in use: stop the existing backend process or run with another `PORT` value.