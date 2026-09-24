// Final error-handling middleware — must be registered last, after all routes.
export default function errorHandler(err, req, res, _next) {
  console.error(err);

  if (err.status) {
    return res.status(err.status).json({ error: err.code || 'ERROR', message: err.message });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Resource not found.' });
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' });
}
