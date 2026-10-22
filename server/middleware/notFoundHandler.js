import { formatError } from '../schemas/index.js';

/**
 * StudySync AI — 404 Route Not Found Handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json(
    formatError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND')
  );
}

export default notFoundHandler;
