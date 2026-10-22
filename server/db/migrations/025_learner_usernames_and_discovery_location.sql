-- ============================================================================
-- StudySync AI — Migration 025: Learner Usernames, Profile Location, and Privacy Controls
-- ============================================================================

-- 1. Extend users table with unique StudySync username
ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);

-- 2. Extend learner_profiles table with optional location metadata (country, state, city)
ALTER TABLE learner_profiles ADD COLUMN country TEXT;
ALTER TABLE learner_profiles ADD COLUMN state TEXT;
ALTER TABLE learner_profiles ADD COLUMN city TEXT;

-- 3. Extend user_privacy_settings with location visibility control
ALTER TABLE user_privacy_settings ADD COLUMN show_location INTEGER NOT NULL DEFAULT 1 CHECK (show_location IN (0, 1));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_learner_profiles_country ON learner_profiles(country);
CREATE INDEX IF NOT EXISTS idx_learner_profiles_city ON learner_profiles(city);
