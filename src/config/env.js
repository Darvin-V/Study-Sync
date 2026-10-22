/**
 * StudySync AI — Safe Environment Configuration Module
 * 
 * Centralizes environment access to protect against runtime undefined errors
 * and prevent accidental exposure of sensitive keys in client bundles.
 */

const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

export const env = Object.freeze({
  appName: metaEnv.VITE_APP_NAME || 'StudySync AI',
  appEnv: metaEnv.VITE_APP_ENV || 'development',
  appVersion: metaEnv.VITE_APP_VERSION || '0.1.0',
  isDevelopment: metaEnv.DEV ?? (metaEnv.NODE_ENV === 'development'),
  isProduction: metaEnv.PROD ?? (metaEnv.NODE_ENV === 'production'),
  apiBaseUrl: metaEnv.VITE_API_BASE_URL || '',
});

export default env;
