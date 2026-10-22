-- ============================================================================
-- StudySync AI — Migration 001: Initial Database Foundation Schema
-- ============================================================================

-- Migration tracker table
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  preferred_languages TEXT NOT NULL DEFAULT '["English"]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Learning Topics
CREATE TABLE IF NOT EXISTS learning_topics (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  difficulty_level TEXT,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 3. User Learning Preferences
CREATE TABLE IF NOT EXISTS user_learning_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  learning_goal TEXT NOT NULL,
  skill_level TEXT NOT NULL,
  learning_status TEXT NOT NULL,
  preferred_study_duration INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES learning_topics(id) ON DELETE CASCADE,
  UNIQUE (user_id, topic_id)
);

-- 4. Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  room_type TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'Intermediate',
  preferred_languages TEXT NOT NULL DEFAULT '["English"]',
  creator_id TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 5. Room Memberships (Prevents duplicate memberships via UNIQUE constraint)
CREATE TABLE IF NOT EXISTS room_memberships (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (room_id, user_id)
);

-- 6. Room Messages
CREATE TABLE IF NOT EXISTS room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Questions and Responses
CREATE TABLE IF NOT EXISTS room_questions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  asker_id TEXT NOT NULL,
  question_content TEXT NOT NULL,
  topic TEXT,
  is_resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (asker_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_responses (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  responder_id TEXT NOT NULL,
  response_content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (question_id) REFERENCES room_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (responder_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Notes and Resources
CREATE TABLE IF NOT EXISTS notes_resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  resource_reference TEXT,
  resource_type TEXT NOT NULL DEFAULT 'Note',
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  author_id TEXT NOT NULL,
  room_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- 9. Study Sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  subject TEXT,
  room_id TEXT,
  creator_id TEXT NOT NULL,
  planned_duration INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  start_at TEXT NOT NULL,
  end_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- 10. Session Participants (Tracks individual duration vs overall session)
CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  individual_duration_minutes INTEGER,
  FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (session_id, user_id)
);

-- 11. Learning Activity
CREATE TABLE IF NOT EXISTS learning_activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance and relationship lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON learning_topics(subject);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_learning_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_subject_topic ON rooms(subject, topic);
CREATE INDEX IF NOT EXISTS idx_rooms_creator ON rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_memberships_room ON room_memberships(room_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON room_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_questions_room ON room_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON question_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_notes_author ON notes_resources(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_room ON notes_resources(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_creator ON study_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room ON study_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON learning_activities(user_id);
