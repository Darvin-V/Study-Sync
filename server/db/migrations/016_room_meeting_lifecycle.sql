-- ============================================================================
-- StudySync AI — Migration 016: Room Video Meeting Lifecycle & Attendance
-- ============================================================================

-- 1. Add meeting_host_id column to rooms table to track the user who initiated the call
ALTER TABLE rooms ADD COLUMN meeting_host_id TEXT;

-- 2. Track active meeting participants per room for proper leave vs end-call lifecycle
CREATE TABLE IF NOT EXISTS room_meeting_participants (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  last_ping_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_meeting_participants_room ON room_meeting_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_meeting_participants_user ON room_meeting_participants(user_id);
