import { formatError, ValidationError } from '../schemas/index.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * StudySync AI — Centralized Safe Error Handler
 * 
 * Intercepts all unhandled errors and maps them to secure, predictable JSON payloads.
 * Protects against credential leaks, SQL injection error disclosure, and stack trace leaks.
 * Fails safely with 503 when the database service is unavailable.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // 1. Validation Errors
  if (err instanceof ValidationError || err.name === 'ValidationError') {
    return res.status(err.statusCode || 400).json(
      formatError(err.message, 'VALIDATION_ERROR', err.details || [])
    );
  }

  // 2. JSON Body Parse Errors
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json(
      formatError('Invalid JSON format in request body', 'INVALID_JSON')
    );
  }

  // 3. Explicit HTTP Operational Errors (400, 401, 403, 404, 409, etc.)
  if (err.statusCode && typeof err.statusCode === 'number' && err.statusCode < 500) {
    return res.status(err.statusCode).json(
      formatError(err.message, err.code || 'BAD_REQUEST', err.details || [])
    );
  }

  // 4. Database Connection & Availability Errors -> 503 Service Unavailable
  const isDbUnavailable =
    err.code === 'SQLITE_CANTOPEN' ||
    err.code === 'SQLITE_BUSY' ||
    err.code === 'SQLITE_LOCKED' ||
    err.code === 'SQLITE_IOERR' ||
    err.code === 'SQLITE_CORRUPT' ||
    err.code === 'SQLITE_NOTADB' ||
    err.code === 'DB_UNAVAILABLE' ||
    err.code === 'DB_CONNECTION_ERROR' ||
    err.name === 'DatabaseConnectionError' ||
    (typeof err.message === 'string' && (
      err.message.includes('unable to open database') ||
      err.message.includes('database is locked') ||
      err.message.includes('database connection unavailable')
    ));

  if (isDbUnavailable) {
    logger.error('Database connection unavailable during request', {
      method: req.method,
      url: req.url,
      code: err.code,
      message: err.message,
    });
    return res.status(503).json(
      formatError('Database service is currently unavailable. Please try again shortly.', 'DATABASE_UNAVAILABLE')
    );
  }

  // 5. SQLite Constraint / Internal Data Validation Errors -> 400 Bad Request
  if (err.code && typeof err.code === 'string' && err.code.startsWith('SQLITE_')) {
    // Never expose raw SQL statements or schema secrets
    return res.status(400).json(
      formatError('Database constraint or query validation failed', 'DATABASE_ERROR')
    );
  }

  // 6. Fallback Internal Server Error
  logger.error('Unexpected server error', {
    method: req.method,
    url: req.url,
    message: err.message,
    name: err.name,
    code: err.code,
  });

  if (config.isDevelopment) {
    console.error(`[Server Error] ${req.method} ${req.url}:`, err.message);
  }

  return res.status(500).json(
    formatError('An unexpected internal server error occurred', 'INTERNAL_SERVER_ERROR')
  );
}

export default errorHandler;
