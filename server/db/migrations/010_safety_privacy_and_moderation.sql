-- ============================================================================
-- StudySync AI — Migration 010: Safety, Privacy & Trust (Phase 14)
-- ============================================================================

-- 1. Extend Users with role and account status
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- 2. User Privacy Settings
-- Configures discoverability, field visibility, and study invitation permissions
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  user_id TEXT PRIMARY KEY,
  profile_visibility TEXT NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public', 'rooms_only', 'private')),
  show_activity_status INTEGER NOT NULL DEFAULT 1 CHECK (show_activity_status IN (0, 1)),
  show_learning_preferences INTEGER NOT NULL DEFAULT 1 CHECK (show_learning_preferences IN (0, 1)),
  show_institution INTEGER NOT NULL DEFAULT 1 CHECK (show_institution IN (0, 1)),
  allow_study_invites INTEGER NOT NULL DEFAULT 1 CHECK (allow_study_invites IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_privacy_visibility ON user_privacy_settings(profile_visibility);

-- 3. User Safety Reports
-- Records learner reports of harassment, spam, impersonation, or abuse
CREATE TABLE IF NOT EXISTS user_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_user_id TEXT,
  room_id TEXT,
  content_type TEXT NOT NULL DEFAULT 'user' CHECK (content_type IN ('user', 'room_message', 'question', 'note', 'resource')),
  content_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('harassment', 'spam', 'impersonation', 'inappropriate_content', 'suspicious_behavior', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  action_taken TEXT,
  moderator_notes TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON user_reports(created_at);

-- 4. Study Invitations
-- Enforces privacy boundaries and blocking restrictions on peer connection invites
CREATE TABLE IF NOT EXISTS study_invites (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  topic TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invites_sender ON study_invites(sender_id);
CREATE INDEX IF NOT EXISTS idx_invites_receiver ON study_invites(receiver_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON study_invites(status);
