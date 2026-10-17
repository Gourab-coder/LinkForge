const urlRepository = require("../repositories/urlRepository");

// Validate an optional analytics boundary and normalize it for parameterized SQL.
function parseDate(value, fieldName) {
  if (value === undefined) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }

  return date.toISOString();
}

// Confirm ownership before returning click aggregates for the requested date range.
async function getForUser({ urlId, userId, from, to }) {
  const url = await urlRepository.findByIdForUser(urlId, userId);
  if (!url) {
    const error = new Error("URL not found");
    error.statusCode = 404;
    throw error;
  }

  const fromDate = parseDate(from, "from");
  const toDate = parseDate(to, "to");
  if (fromDate && toDate && fromDate >= toDate) {
    const error = new Error("from must be earlier than to");
    error.statusCode = 400;
    throw error;
  }

  return urlRepository.getAnalytics(urlId, { from: fromDate, to: toDate });
}

module.exports = { getForUser };
