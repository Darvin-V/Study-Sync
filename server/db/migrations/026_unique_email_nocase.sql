-- ============================================================================
-- StudySync AI — Migration 026: Case-Insensitive Unique Normalized Email Index
-- ============================================================================

-- 1. Normalize all existing email records: trim surrounding whitespace and lowercase
UPDATE users 
SET email = LOWER(TRIM(email)) 
WHERE email IS NOT NULL;

-- 2. Enforce case-insensitive email uniqueness at SQLite engine level
-- Prevents duplicate accounts even under high concurrency or disparate casing
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE);
