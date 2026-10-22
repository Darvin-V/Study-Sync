-- ============================================================================
-- StudySync AI — Migration 022: Room Code & Invite System
-- ============================================================================

-- 1. Add room_code and code_join_enabled columns to rooms table
ALTER TABLE rooms ADD COLUMN room_code TEXT;
ALTER TABLE rooms ADD COLUMN code_join_enabled INTEGER NOT NULL DEFAULT 1;

-- 2. Populate deterministic initial codes for baseline rooms
UPDATE rooms SET room_code = 'DBMS-4X9M' WHERE id = 'room-dbms-norm' AND room_code IS NULL;
UPDATE rooms SET room_code = 'ALGO-8K2P' WHERE id = 'room-dp-lcs' AND room_code IS NULL;
UPDATE rooms SET room_code = 'OS-3N7Q' WHERE id = 'room-os-deadlocks' AND room_code IS NULL;

-- 3. Populate unique codes for any other existing rooms
UPDATE rooms 
SET room_code = UPPER(SUBSTR(REPLACE(subject, ' ', ''), 1, 4)) || '-' || HEX(RANDOMBLOB(2))
WHERE room_code IS NULL;

-- 4. Indexes for fast lookup and uniqueness enforcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_code_join_enabled ON rooms(code_join_enabled);
