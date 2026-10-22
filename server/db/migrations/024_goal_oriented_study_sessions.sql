-- Migration 024: Goal-Oriented Study Sessions & Structured Learning Phases
-- Adds goal, phases, phase tracking, reflections, and revision indicators to user_focus_intervals

ALTER TABLE user_focus_intervals ADD COLUMN goal TEXT;
ALTER TABLE user_focus_intervals ADD COLUMN phases TEXT;
ALTER TABLE user_focus_intervals ADD COLUMN current_phase TEXT DEFAULT 'focus';
ALTER TABLE user_focus_intervals ADD COLUMN completed_phases TEXT DEFAULT '[]';
ALTER TABLE user_focus_intervals ADD COLUMN goal_achieved TEXT;
ALTER TABLE user_focus_intervals ADD COLUMN key_takeaways TEXT;
ALTER TABLE user_focus_intervals ADD COLUMN confusing_doubts TEXT;
ALTER TABLE user_focus_intervals ADD COLUMN needs_revision INTEGER DEFAULT 0;
ALTER TABLE user_focus_intervals ADD COLUMN early_exit_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_focus_needs_revision ON user_focus_intervals(user_id, needs_revision);
