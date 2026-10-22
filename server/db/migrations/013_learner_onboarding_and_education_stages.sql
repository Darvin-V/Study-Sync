-- ============================================================================
-- StudySync AI — Migration 013: Learner Profiles, Education Stages & Room Domain Agnosticism
-- ============================================================================

-- 1. Extend learner_profiles with age, gender, education stage, and detailed educational context
-- Note: age and gender are strictly private by default and never exposed publicly.
ALTER TABLE learner_profiles ADD COLUMN age INTEGER;
ALTER TABLE learner_profiles ADD COLUMN gender TEXT;
ALTER TABLE learner_profiles ADD COLUMN education_stage TEXT;
ALTER TABLE learner_profiles ADD COLUMN education_details TEXT;
ALTER TABLE learner_profiles ADD COLUMN learning_goals TEXT;

-- 2. Extend rooms table with optional education stage
ALTER TABLE rooms ADD COLUMN education_stage TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learner_profiles_education_stage ON learner_profiles(education_stage);
CREATE INDEX IF NOT EXISTS idx_rooms_education_stage ON rooms(education_stage);
