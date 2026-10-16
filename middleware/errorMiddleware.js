import { HttpError } from '../utils/errors.js';

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express 5 forwards errors thrown (or rejected) inside async handlers here automatically.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
}
