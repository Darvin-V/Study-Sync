-- Migration 005: Persistent Notes, Resources & Knowledge Exchange Enhancements
-- Adds session association, visibility controls, archiving, and description to notes_resources

ALTER TABLE notes_resources ADD COLUMN session_id TEXT;
ALTER TABLE notes_resources ADD COLUMN visibility TEXT DEFAULT 'public';
ALTER TABLE notes_resources ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE notes_resources ADD COLUMN description TEXT;

-- Indexes for performance and permission boundary queries
CREATE INDEX IF NOT EXISTS idx_notes_session ON notes_resources(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_visibility ON notes_resources(visibility);
CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes_resources(is_archived);
CREATE INDEX IF NOT EXISTS idx_questions_resolved ON room_questions(is_resolved);
CREATE INDEX IF NOT EXISTS idx_questions_asker ON room_questions(asker_id);
CREATE INDEX IF NOT EXISTS idx_responses_responder ON question_responses(responder_id);
