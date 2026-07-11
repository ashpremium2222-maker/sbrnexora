export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || (err.name === "ValidationError" || err.name === "CastError" ? 400 : 500);
  console.error(err);
  res.status(status).json({ error: err.message || "Internal server error" });
}
