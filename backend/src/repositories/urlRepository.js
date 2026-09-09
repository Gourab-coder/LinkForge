const pool = require("../config/database");

async function createUrl({ userId, longUrl, shortCode, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO urls (user_id, long_url, short_code, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, long_url, short_code, click_count, created_at, expires_at`,
    [userId, longUrl, shortCode, expiresAt || null]
  );

  return result.rows[0];
}

async function findByShortCode(shortCode) {
  const result = await pool.query(
    `SELECT id, user_id, long_url, short_code, click_count, created_at, expires_at
     FROM urls WHERE short_code = $1`,
    [shortCode]
  );

  return result.rows[0] || null;
}

async function findByIdForUser(id, userId) {
  const result = await pool.query(
    `SELECT id, long_url, short_code, click_count, created_at, expires_at
     FROM urls WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rows[0] || null;
}

async function findAllForUser(userId) {
  const result = await pool.query(
    `SELECT id, long_url, short_code, click_count, created_at, expires_at
     FROM urls WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function deleteByIdForUser(id, userId) {
  const result = await pool.query(
    "DELETE FROM urls WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );

  return result.rowCount > 0;
}

async function recordClick({ id, ipAddress, userAgent }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("UPDATE urls SET click_count = click_count + 1 WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO click_events (url_id, ip_address, user_agent)
       VALUES ($1, $2, $3)`,
      [id, ipAddress, userAgent]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createUrl,
  findByShortCode,
  findByIdForUser,
  findAllForUser,
  deleteByIdForUser,
  recordClick
};