-- Migration 004: Study Sessions & Participation Enhancements
-- Adds extended session metadata, attendance intervals, and post-session reflections

ALTER TABLE study_sessions ADD COLUMN title TEXT;
ALTER TABLE study_sessions ADD COLUMN description TEXT;
ALTER TABLE study_sessions ADD COLUMN scheduled_start_at TEXT;
ALTER TABLE study_sessions ADD COLUMN actual_start_at TEXT;
ALTER TABLE study_sessions ADD COLUMN actual_end_at TEXT;
ALTER TABLE study_sessions ADD COLUMN updated_at TEXT;

ALTER TABLE session_participants ADD COLUMN participation_status TEXT DEFAULT 'active';
ALTER TABLE session_participants ADD COLUMN recorded_study_minutes INTEGER DEFAULT 0;
ALTER TABLE session_participants ADD COLUMN total_attendance_seconds INTEGER DEFAULT 0;

-- Track discrete attendance intervals when a user joins, leaves, and rejoins
CREATE TABLE IF NOT EXISTS session_attendance_intervals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  duration_seconds INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_intervals_session_user ON session_attendance_intervals(session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_intervals_session ON session_attendance_intervals(session_id);
CREATE INDEX IF NOT EXISTS idx_intervals_user ON session_attendance_intervals(user_id);

-- Optional post-session feedback and learner reflection
CREATE TABLE IF NOT EXISTS session_feedback (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating TEXT,
  reflection TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_session ON session_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON session_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_at ON study_sessions(created_at);
