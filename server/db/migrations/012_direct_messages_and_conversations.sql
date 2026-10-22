-- ============================================================================
-- StudySync AI — Migration 012: Secure Direct Messaging & 1-to-1 Conversations
-- ============================================================================

-- 1. Conversations (Exactly two distinct participants, canonical ordering)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  participant_one_id TEXT NOT NULL,
  participant_two_id TEXT NOT NULL,
  last_message_at TEXT,
  last_message_preview TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (participant_one_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_two_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (participant_one_id < participant_two_id),
  UNIQUE (participant_one_id, participant_two_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant_one_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant_two_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- 2. Direct Messages (Chronological messaging with read state tracking)
CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dm_conv_created ON direct_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_unread ON direct_messages(conversation_id, is_read);
