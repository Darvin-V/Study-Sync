-- Migration 018: Social & Collaboration Notifications Schema
-- Provides real, persistent notifications for direct messages, study room activity,
-- doubt replies, study invites, and account security notices.

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_url TEXT,
  reference_id TEXT,
  is_read INTEGER DEFAULT 0 CHECK (is_read IN (0, 1)),
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_lookup ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications (user_id, type, reference_id, is_read);
