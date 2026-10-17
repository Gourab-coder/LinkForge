// Return consistent client errors while keeping database and stack details out of responses.
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const parserStatus = error.type === "entity.parse.failed"
    ? 400
    : error.type === "entity.too.large"
      ? 413
      : null;
  const knownClientError = error.statusCode >= 400 && error.statusCode < 500;
  const statusCode = parserStatus || (knownClientError ? error.statusCode : 500);
  const message = statusCode === 400 && parserStatus
    ? "Request body must contain valid JSON"
    : statusCode === 413
      ? "Request body is too large"
      : statusCode === 500
        ? "Internal server error"
        : error.message;

  if (statusCode === 500) {
    console.error("Request failed:", error.code || error.name || "UnknownError");
  }

  return res.status(statusCode).json({ message });
}

module.exports = errorHandler;
