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

async function recordClickEvent({
  eventId,
  urlId,
  ipAddress,
  visitorHash,
  userAgent,
  deviceType,
  country
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const eventResult = await client.query(
      `INSERT INTO click_events
         (event_id, url_id, ip_address, visitor_hash, user_agent, device_type, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [eventId, urlId, ipAddress, visitorHash, userAgent, deviceType, country]
    );

    if (eventResult.rowCount > 0) {
      await client.query("UPDATE urls SET click_count = click_count + 1 WHERE id = $1", [urlId]);
    }

    await client.query("COMMIT");
    return eventResult.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAnalytics(urlId, { from, to }) {
  const dateFilters = ["url_id = $1"];
  const values = [urlId];

  if (from) {
    values.push(from);
    dateFilters.push(`created_at >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    dateFilters.push(`created_at < $${values.length}`);
  }

  const whereClause = dateFilters.join(" AND ");
  const [summary, devices, countries] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total_clicks,
              COUNT(DISTINCT visitor_hash)::int AS unique_visitors
       FROM click_events WHERE ${whereClause}`,
      values
    ),
    pool.query(
      `SELECT COALESCE(device_type, 'unknown') AS device,
              COUNT(*)::int AS clicks
       FROM click_events WHERE ${whereClause}
       GROUP BY device ORDER BY clicks DESC`,
      values
    ),
    pool.query(
      `SELECT country, COUNT(*)::int AS clicks
       FROM click_events WHERE ${whereClause} AND country IS NOT NULL
       GROUP BY country ORDER BY clicks DESC LIMIT 10`,
      values
    )
  ]);

  return {
    totalClicks: summary.rows[0].total_clicks,
    uniqueVisitors: summary.rows[0].unique_visitors,
    devices: devices.rows.reduce((result, row) => {
      result[row.device] = row.clicks;
      return result;
    }, {}),
    topCountries: countries.rows.map((row) => ({
      country: row.country,
      clicks: row.clicks
    }))
  };
}

module.exports = {
  createUrl,
  findByShortCode,
  findByIdForUser,
  findAllForUser,
  deleteByIdForUser,
  recordClickEvent,
  getAnalytics
};