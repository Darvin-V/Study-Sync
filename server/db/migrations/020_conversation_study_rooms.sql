-- ============================================================================
-- StudySync AI — Migration 020: Direct Conversation Study Rooms
-- ============================================================================

-- Add room_id to conversations to associate each 1-to-1 conversation with its dedicated study room
ALTER TABLE conversations ADD COLUMN room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_room_id ON conversations(room_id);
