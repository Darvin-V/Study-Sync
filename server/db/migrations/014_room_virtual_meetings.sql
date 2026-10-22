-- ============================================================================
-- StudySync AI — Migration 014: Virtual Study Rooms & Real Meeting Integration
-- ============================================================================

-- 1. Extend Rooms table with real virtual meeting capabilities
ALTER TABLE rooms ADD COLUMN meeting_url TEXT;
ALTER TABLE rooms ADD COLUMN meeting_provider TEXT DEFAULT 'jitsi';
ALTER TABLE rooms ADD COLUMN meeting_active INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN meeting_started_at TEXT;
