-- ============================================================================
-- StudySync AI — Migration 015: Email OTP Verification Schema
-- ============================================================================

-- 1. Extend Users table for tracking email verification timestamp
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- 2. Email Verifications Table
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  resend_available_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verif_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verif_expires_at ON email_verifications(expires_at);

-- 3. Backfill existing verified users to avoid locking out existing verified accounts
UPDATE users 
SET email_verified_at = COALESCE(created_at, datetime('now'))
WHERE is_verified = 1 AND email_verified_at IS NULL;
