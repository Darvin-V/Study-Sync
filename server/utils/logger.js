/**
 * StudySync AI — Structured Logger
 * 
 * Provides safe, zero-cost structured logging with automatic secret scrubbing.
 * Protects passwords, email OTPs, session tokens, and credentials from log exposure.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'hashedpassword',
  'hashed_password',
  'token',
  'sessiontoken',
  'session_token',
  'otp',
  'secret',
  'authorization',
  'cookie',
  'key',
  'apikey',
  'api_key',
  'credential',
  'credentials',
]);

/**
 * Deeply scrubs sensitive keys from objects before logging
 */
export function sanitizeMeta(item, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]';
  if (item === null || item === undefined) return item;
  if (typeof item !== 'object') return item;

  if (Array.isArray(item)) {
    return item.map((element) => sanitizeMeta(element, depth + 1));
  }

  const clean = {};
  for (const [key, value] of Object.entries(item)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('otp')) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMeta(value, depth + 1);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function formatLog(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta: sanitizeMeta(meta) } : {}),
  };
  return JSON.stringify(logEntry);
}

export const logger = {
  info(message, meta = {}) {
    process.stdout.write(`${formatLog('INFO', message, meta)}\n`);
  },

  warn(message, meta = {}) {
    process.stderr.write(`${formatLog('WARN', message, meta)}\n`);
  },

  error(message, meta = {}) {
    process.stderr.write(`${formatLog('ERROR', message, meta)}\n`);
  },

  startup(meta = {}) {
    this.info('StudySync backend server started', meta);
  },

  shutdown(meta = {}) {
    this.info('StudySync backend server shutting down', meta);
  },
};

export default logger;
