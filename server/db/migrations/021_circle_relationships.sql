-- ============================================================================
-- StudySync AI — Migration 021: Circle Relationships (Learner Relationship System)
-- ============================================================================

-- Table: user_circle
-- Represents learner relationships (adding peer learners to one's personal Circle)
CREATE TABLE IF NOT EXISTS user_circle (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, member_id),
  CHECK (user_id != member_id)
);

CREATE INDEX IF NOT EXISTS idx_user_circle_user_id ON user_circle(user_id);
CREATE INDEX IF NOT EXISTS idx_user_circle_member_id ON user_circle(member_id);
