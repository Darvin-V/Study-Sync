-- ============================================================================
-- StudySync AI — Migration 009: Feedback Loop & Recommendation Tracking (Phase 12)
-- ============================================================================

-- 1. Recommendation Tracking
-- Tracks recommendation lifecycle (presented, accepted, dismissed, followed_through)
CREATE TABLE IF NOT EXISTS recommendation_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL, -- 'peer_help', 'continue_topic', 'revisit_topic', 'join_room', 'review_resource'
  target_id TEXT NOT NULL,           -- peer_id, topic_id, room_id, resource_id
  topic TEXT,
  subject TEXT,
  engine_version TEXT NOT NULL DEFAULT 'v1-baseline', -- 'v1-baseline' | 'v2-adaptive'
  lifecycle_status TEXT NOT NULL CHECK(lifecycle_status IN ('presented', 'accepted', 'dismissed', 'expired', 'followed_through')) DEFAULT 'presented',
  presented_at DATETIME NOT NULL,
  accepted_at DATETIME,
  dismissed_at DATETIME,
  followed_through_at DATETIME,
  outcome_event TEXT,                -- 'session_completed', 'room_joined', 'assessment_taken', 'invite_sent'
  outcome_entity_id TEXT,            -- session_id, room_id, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rec_track_user ON recommendation_tracking(user_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rec_track_target ON recommendation_tracking(target_id, recommendation_type);
CREATE INDEX IF NOT EXISTS idx_rec_track_presented ON recommendation_tracking(presented_at);

-- 2. Explicit Recommendation Feedback
-- Stores lightweight direct relevance feedback from learners
CREATE TABLE IF NOT EXISTS recommendation_explicit_feedback (
  id TEXT PRIMARY KEY,
  recommendation_tracking_id TEXT REFERENCES recommendation_tracking(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  is_relevant INTEGER CHECK(is_relevant IN (0, 1)),
  quality_rating INTEGER CHECK(quality_rating BETWEEN 1 AND 5),
  reason_tag TEXT,                    -- 'already_mastered', 'too_difficult', 'good_match', 'schedule_mismatch', 'irrelevant'
  feedback_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recommendation_tracking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_fb_user ON recommendation_explicit_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_fb_target ON recommendation_explicit_feedback(target_id, recommendation_type);

-- 3. Peer Collaboration Feedback
-- Stores lightweight peer feedback after collaborative study sessions
CREATE TABLE IF NOT EXISTS peer_collaboration_feedback (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL,
  giver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  was_helpful INTEGER CHECK(was_helpful IN (0, 1)),
  would_study_again INTEGER CHECK(would_study_again IN (0, 1)),
  topic_relevance INTEGER CHECK(topic_relevance IN (0, 1)),
  feedback_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, giver_user_id, target_peer_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_fb_giver ON peer_collaboration_feedback(giver_user_id);
CREATE INDEX IF NOT EXISTS idx_peer_fb_target ON peer_collaboration_feedback(target_peer_id);
CREATE INDEX IF NOT EXISTS idx_peer_fb_session ON peer_collaboration_feedback(session_id);
