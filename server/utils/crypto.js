import crypto from 'node:crypto';

/**
 * StudySync AI — Cryptographic Authentication Utilities
 * 
 * Uses Node.js native crypto for secure, zero-cost password hashing (scrypt)
 * and cryptographically random session tokens.
 */

const KEY_LEN = 64;

/**
 * Hashes a plaintext password using scrypt with a unique random salt
 */
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored salt:hash string
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, key] = parts;
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically strong session token (64 hex characters)
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export default {
  hashPassword,
  verifyPassword,
  generateSessionToken,
};
