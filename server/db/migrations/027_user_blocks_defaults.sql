-- ============================================================================
-- StudySync AI — Migration 027: User Blocks Defaults for id and created_at
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_blocks_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (blocker_id, blocked_id)
);

INSERT OR IGNORE INTO user_blocks_new (id, blocker_id, blocked_id, created_at)
SELECT COALESCE(id, lower(hex(randomblob(16)))), blocker_id, blocked_id, COALESCE(created_at, datetime('now'))
FROM user_blocks;

DROP TABLE user_blocks;

ALTER TABLE user_blocks_new RENAME TO user_blocks;

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id);
