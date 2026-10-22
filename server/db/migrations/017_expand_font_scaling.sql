-- ============================================================================
-- StudySync AI — Migration 017: Expand Font Scaling Options (Small, Default, Large)
-- ============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS user_settings_v2 (
  user_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ta')),
  font_scaling TEXT NOT NULL DEFAULT 'standard' CHECK (font_scaling IN ('compact', 'standard', 'comfortable', 'small', 'default', 'large')),
  reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
  room_audio_video TEXT NOT NULL DEFAULT 'muted' CHECK (room_audio_video IN ('muted', 'mic-only')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_settings_v2 (user_id, theme, language, font_scaling, reduced_motion, room_audio_video, created_at, updated_at)
SELECT user_id, theme, language, font_scaling, reduced_motion, room_audio_video, created_at, updated_at FROM user_settings;

DROP TABLE user_settings;

ALTER TABLE user_settings_v2 RENAME TO user_settings;

CREATE INDEX IF NOT EXISTS idx_user_settings_theme ON user_settings(theme);
CREATE INDEX IF NOT EXISTS idx_user_settings_language ON user_settings(language);

PRAGMA foreign_keys = ON;
