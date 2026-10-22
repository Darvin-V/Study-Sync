-- ============================================================================
-- StudySync AI — Migration 011: User Settings, Theme & Language Preferences (Phase 3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ta')),
  font_scaling TEXT NOT NULL DEFAULT 'standard' CHECK (font_scaling IN ('standard', 'comfortable')),
  reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
  room_audio_video TEXT NOT NULL DEFAULT 'muted' CHECK (room_audio_video IN ('muted', 'mic-only')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_settings_theme ON user_settings(theme);
CREATE INDEX IF NOT EXISTS idx_user_settings_language ON user_settings(language);
