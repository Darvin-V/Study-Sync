-- ============================================================================
-- StudySync AI — Migration 002: Authentication & Learner Profiles
-- ============================================================================

-- 1. Extend Users table for password authentication & verification
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN verification_token TEXT;

-- 2. User Sessions (Server-side managed session tokens with expiration)
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);

-- 3. Learner Profiles (Detailed academic bio, schedules, and completion tracking)
CREATE TABLE IF NOT EXISTS learner_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  headline TEXT,
  institution TEXT,
  introduction TEXT,
  skill_level TEXT NOT NULL DEFAULT 'Intermediate',
  preferred_study_times TEXT,
  preferred_study_duration INTEGER DEFAULT 45,
  is_profile_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_user_id ON learner_profiles(user_id);

-- 4. User Academic Subjects (Enables tracking subjects of study)
CREATE TABLE IF NOT EXISTS user_subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_subjects_user_id ON user_subjects(user_id);

-- 5. Extend User Learning Preferences with role flags (learning now, strengths, improving)
ALTER TABLE user_learning_preferences ADD COLUMN is_learning_now INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_learning_preferences ADD COLUMN is_strength INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_learning_preferences ADD COLUMN is_improving INTEGER NOT NULL DEFAULT 0;
