-- ============================================================================
-- StudySync AI — Migration 006: AI Matching, Recommendations & Safety
-- ============================================================================

-- 1. User Blocking for Safety & Candidate Exclusion
CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id);

-- 2. Recommendation Feedback & Interaction Tracking (Accepted / Dismissed)
CREATE TABLE IF NOT EXISTS recommendation_interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL, -- 'peer_match', 'topic_study', 'room_join', 'resource_review'
  target_id TEXT NOT NULL,           -- peer_id, topic_id, room_id, note_id
  action TEXT NOT NULL,              -- 'viewed', 'accepted', 'dismissed'
  feedback_text TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rec_user ON recommendation_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_created ON recommendation_interactions(created_at);
