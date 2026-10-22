import path from 'node:path';
import fs from 'node:fs';

/**
 * StudySync AI — Backend Environment Configuration
 * 
 * Safely loads environment variables, validates configuration,
 * and provides safe fallbacks for local zero-cost development.
 */

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Safely load environment files (.env and .env.local) if present
const envFiles = [
  path.resolve(projectRoot, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(projectRoot, '.env.local'),
  path.resolve(process.cwd(), '.env.local'),
];

for (const envFile of envFiles) {
  try {
    if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envFile);
    }
  } catch {
    // Silently continue if an env file is absent in development
  }
}

const rawPort = process.env.PORT || '3001';
const parsedPort = parseInt(rawPort, 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3001;
const host = process.env.HOST || '0.0.0.0';

const nodeEnv = process.env.NODE_ENV || 'development';
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const isTestRuntime =
  process.env.NODE_ENV === 'test' ||
  (Array.isArray(process.execArgv) && process.execArgv.includes('--test')) ||
  (Array.isArray(process.argv) &&
    process.argv.some(
      (arg) =>
        typeof arg === 'string' &&
        (arg.includes('node:test') || arg.includes('server/tests') || arg.includes('server\\tests'))
    ));

const defaultDbPath = isTestRuntime ? './server/data/test.db' : './server/data/studysync.db';
const databasePath = process.env.DATABASE_PATH || defaultDbPath;

export function validateProductionEnv(env = process.env) {
  const isProd = (env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProd) return { valid: true };

  const errors = [];

  // 1. Port validation
  const portVal = parseInt(env.PORT, 10);
  if (!env.PORT || isNaN(portVal) || portVal <= 0 || portVal > 65535) {
    errors.push('PORT must be a valid integer between 1 and 65535');
  }

  // 2. CORS validation
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN.trim() === '') {
    errors.push('CORS_ORIGIN must be explicitly specified in production');
  } else if (env.CORS_ORIGIN.includes('*')) {
    errors.push('CORS_ORIGIN wildcard (*) is forbidden in production with credentials');
  }

  // 3. Database path validation
  if (!env.DATABASE_PATH || env.DATABASE_PATH.trim() === '') {
    errors.push('DATABASE_PATH must be configured in production');
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration validation failed:\n - ${errors.join('\n - ')}`);
  }

  return { valid: true };
}

// Automatically validate if running in production mode
if (process.env.NODE_ENV === 'production') {
  validateProductionEnv();
}

export const config = Object.freeze({
  host,
  port,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  corsOrigin,
  databasePath: path.resolve(process.cwd(), databasePath),
});

export default config;

