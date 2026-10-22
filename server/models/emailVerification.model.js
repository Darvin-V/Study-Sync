import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { generateOtpSalt, hashOtp } from '../utils/otp.js';

/**
 * StudySync AI — Email Verification Model
 * 
 * Manages secure persistent email verification secrets, expiry tracking,
 * attempt limits, and resend cooldowns in SQLite.
 * OTP values are never stored in plaintext — only salted HMAC digests.
 */
export const EmailVerificationModel = {
  /**
   * Creates and persists a new email verification challenge.
   * Automatically invalidates previous active challenges for the same user.
   */
  create({ userId, email, otp, expiryMinutes = 10, cooldownSeconds = 60, maxAttempts = 5 }, customDb = null) {
    const db = customDb || getDb();
    const id = `ev-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const cleanEmail = email.trim().toLowerCase();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();
    const resendAvailableAt = new Date(now.getTime() + cooldownSeconds * 1000).toISOString();

    const salt = generateOtpSalt();
    const otpHash = hashOtp(otp, salt);

    // Invalidate previous active challenges for this user (superseded code defense)
    db.prepare(`
      UPDATE email_verifications 
      SET used_at = ? 
      WHERE (user_id = ? OR LOWER(email) = ?) AND used_at IS NULL
    `).run(createdAt, userId, cleanEmail);

    const stmt = db.prepare(`
      INSERT INTO email_verifications (
        id, user_id, email, otp_hash, otp_salt, expires_at,
        attempts, max_attempts, resend_available_at, used_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?)
    `);

    stmt.run(id, userId, cleanEmail, otpHash, salt, expiresAt, maxAttempts, resendAvailableAt, createdAt);

    return {
      id,
      userId,
      email: cleanEmail,
      expiresAt,
      resendAvailableAt,
      maxAttempts,
      createdAt,
    };
  },

  /**
   * Retrieves the newest challenge for an email address (used or unused).
   */
  findLatest(email, customDb = null) {
    if (!email) return null;
    const db = customDb || getDb();
    const cleanEmail = email.trim().toLowerCase();

    return db.prepare(`
      SELECT 
        id, user_id, email, otp_hash, otp_salt, expires_at,
        attempts, max_attempts, resend_available_at, used_at, created_at
      FROM email_verifications
      WHERE LOWER(email) = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(cleanEmail);
  },

  /**
   * Retrieves the current active (unused) challenge for an email address.
   */
  findLatestActive(email, customDb = null) {
    if (!email) return null;
    const db = customDb || getDb();
    const cleanEmail = email.trim().toLowerCase();

    return db.prepare(`
      SELECT 
        id, user_id, email, otp_hash, otp_salt, expires_at,
        attempts, max_attempts, resend_available_at, used_at, created_at
      FROM email_verifications
      WHERE LOWER(email) = ? AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(cleanEmail);
  },

  /**
   * Finds verification challenge by ID.
   */
  findById(id, customDb = null) {
    if (!id) return null;
    const db = customDb || getDb();
    return db.prepare('SELECT * FROM email_verifications WHERE id = ?').get(id);
  },

  /**
   * Increments the attempt counter for an active verification challenge.
   */
  recordAttempt(id, customDb = null) {
    if (!id) return 0;
    const db = customDb || getDb();
    db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?').run(id);
    const row = db.prepare('SELECT attempts, max_attempts FROM email_verifications WHERE id = ?').get(id);
    return row ? row.attempts : 0;
  },

  /**
   * Marks a challenge as successfully verified and permanently invalidates it.
   */
  markUsed(id, customDb = null) {
    if (!id) return false;
    const db = customDb || getDb();
    const now = new Date().toISOString();
    const res = db.prepare('UPDATE email_verifications SET used_at = ? WHERE id = ?').run(now, id);
    return res.changes > 0;
  },

  /**
   * Invalidates all active codes for a user.
   */
  invalidateForUser(userId, customDb = null) {
    if (!userId) return false;
    const db = customDb || getDb();
    const now = new Date().toISOString();
    const res = db.prepare('UPDATE email_verifications SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(now, userId);
    return res.changes > 0;
  },

  /**
   * Counts how many verification attempts/codes were requested for this email
   * in the recent window (for brute-force and resend flood protection).
   */
  countRecentRequests(email, windowMinutes = 15, customDb = null) {
    if (!email) return 0;
    const db = customDb || getDb();
    const cleanEmail = email.trim().toLowerCase();
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const row = db.prepare(`
      SELECT COUNT(*) AS count 
      FROM email_verifications 
      WHERE LOWER(email) = ? AND created_at >= ?
    `).get(cleanEmail, cutoff);

    return row ? row.count : 0;
  },

  /**
   * Purges expired records older than the retention period (default 7 days).
   */
  cleanExpired(retentionDays = 7, customDb = null) {
    const db = customDb || getDb();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM email_verifications WHERE created_at < ?').run(cutoff);
  },
};

export default EmailVerificationModel;
