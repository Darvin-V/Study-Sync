-- ============================================================================
-- StudySync AI — Migration 023: Circle Requests (LinkedIn / Instagram Connection Flow)
-- ============================================================================

-- Table: circle_requests
-- Represents connection requests between peer learners
CREATE TABLE IF NOT EXISTS circle_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'cancelled'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_requests_receiver ON circle_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_requests_sender ON circle_requests(sender_id, status);
