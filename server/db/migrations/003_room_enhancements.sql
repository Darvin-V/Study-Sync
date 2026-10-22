-- ============================================================================
-- StudySync AI — Migration 003: Room Enhancements & Membership Indexes
-- ============================================================================

-- 1. Extend Rooms table with updated timestamp
ALTER TABLE rooms ADD COLUMN updated_at TEXT;

-- Populate existing rows with initial updated_at
UPDATE rooms SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. Performance indexes for room search, filter, and membership lookups
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_memberships_room_user ON room_memberships(room_id, user_id);
