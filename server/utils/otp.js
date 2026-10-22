import crypto from 'node:crypto';

/**
 * StudySync AI — Cryptographically Secure OTP Utilities
 * 
 * Generates uniform 6-digit random codes and verifies them using
 * per-code salted HMAC-SHA256 digests and timing-safe equality comparison.
 */

/**
 * Generates a cryptographically secure 6-digit numeric string (100000 - 999999).
 * Uses crypto.randomInt to guarantee uniform distribution without modulo bias.
 */
export function generateSecureOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Generates a cryptographically random salt for per-OTP hashing.
 */
export function generateOtpSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Computes a salted HMAC-SHA256 digest of the OTP.
 * 
 * @param {string} otp - 6-digit OTP
 * @param {string} salt - Random hex salt
 * @returns {string} Hex-encoded digest
 */
export function hashOtp(otp, salt) {
  if (!otp || !salt) {
    throw new Error('Both OTP and salt are required to compute hash.');
  }
  const cleanOtp = String(otp).trim();
  return crypto.createHmac('sha256', salt).update(cleanOtp).digest('hex');
}

/**
 * Verifies submitted OTP against stored hash using constant-time comparison
 * to eliminate timing attack side channels.
 * 
 * @param {string} submittedOtp - Plaintext OTP entered by user
 * @param {string} storedHash - Stored hex digest from database
 * @param {string} salt - Stored salt from database
 * @returns {boolean} True if matching, false otherwise
 */
export function verifyOtpTimingSafe(submittedOtp, storedHash, salt) {
  if (!submittedOtp || !storedHash || !salt) {
    return false;
  }

  const cleanOtp = String(submittedOtp).trim();
  const computedHash = hashOtp(cleanOtp, salt);

  const computedBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');

  if (computedBuf.length !== storedBuf.length) {
    // Run constant time comparison against dummy buffer to preserve timing
    const dummy = Buffer.alloc(computedBuf.length);
    crypto.timingSafeEqual(computedBuf, dummy);
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, storedBuf);
}

export default {
  generateSecureOtp,
  generateOtpSalt,
  hashOtp,
  verifyOtpTimingSafe,
};
