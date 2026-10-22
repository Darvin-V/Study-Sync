-- Migration 008: Focus Mode & Distraction Shield
-- Persistent focus intervals, interruption-reduction settings, and break reminders

CREATE TABLE IF NOT EXISTS user_focus_intervals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  subject TEXT,
  planned_duration_seconds INTEGER NOT NULL CHECK(planned_duration_seconds >= 60 AND planned_duration_seconds <= 14400),
  actual_duration_seconds INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at TEXT NOT NULL,
  paused_at TEXT,
  total_paused_seconds INTEGER DEFAULT 0,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_focus_user_status ON user_focus_intervals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_focus_user_created ON user_focus_intervals(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_focus_session ON user_focus_intervals(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_room ON user_focus_intervals(room_id);

CREATE TABLE IF NOT EXISTS user_distraction_shield_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  suppress_in_app_notifications INTEGER DEFAULT 1 CHECK(suppress_in_app_notifications IN (0, 1)),
  hide_non_essential_nav INTEGER DEFAULT 1 CHECK(hide_non_essential_nav IN (0, 1)),
  break_reminders_enabled INTEGER DEFAULT 1 CHECK(break_reminders_enabled IN (0, 1)),
  break_interval_minutes INTEGER DEFAULT 25 CHECK(break_interval_minutes >= 5 AND break_interval_minutes <= 120),
  break_duration_minutes INTEGER DEFAULT 5 CHECK(break_duration_minutes >= 1 AND break_duration_minutes <= 60),
  audio_chime_enabled INTEGER DEFAULT 0 CHECK(audio_chime_enabled IN (0, 1)),
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
