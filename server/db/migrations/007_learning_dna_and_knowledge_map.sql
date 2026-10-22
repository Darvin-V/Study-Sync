-- ============================================================================
-- StudySync AI — Migration 007: Learning DNA & Knowledge Map
-- ============================================================================

-- 1. Extend learner_profiles with collaboration style
ALTER TABLE learner_profiles ADD COLUMN collaboration_style TEXT DEFAULT 'Peer discussion & problem solving';

-- 2. Extend user_learning_preferences with confidence and peer exchange roles
ALTER TABLE user_learning_preferences ADD COLUMN confidence_level TEXT DEFAULT 'neutral';
ALTER TABLE user_learning_preferences ADD COLUMN willing_to_teach INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_learning_preferences ADD COLUMN wants_peer_support INTEGER NOT NULL DEFAULT 0;

-- 3. Topic Assessments (Verified formal quiz / exam records)
-- Enforces: "Assessed means an actual assessment record exists, not that a learner attended a study session."
CREATE TABLE IF NOT EXISTS topic_assessments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'practice_quiz',
  score_percentage REAL NOT NULL,
  passed INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  assessed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES learning_topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_topic ON topic_assessments(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_assessments_user ON topic_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_topic ON topic_assessments(topic_id);

-- 4. Topic Prerequisites & Learning Pathways
-- Enforces: "Where prerequisite relationships are known and explicitly represented, use them to suggest a learning sequence."
CREATE TABLE IF NOT EXISTS topic_prerequisites (
  id TEXT PRIMARY KEY,
  prerequisite_topic_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'prerequisite',
  reason TEXT,
  FOREIGN KEY (prerequisite_topic_id) REFERENCES learning_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES learning_topics(id) ON DELETE CASCADE,
  UNIQUE(prerequisite_topic_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_prereq_target ON topic_prerequisites(topic_id);
CREATE INDEX IF NOT EXISTS idx_prereq_source ON topic_prerequisites(prerequisite_topic_id);

-- 5. Seed Core Foundational Curriculum Topics (if not already present)
INSERT OR IGNORE INTO learning_topics (id, subject, topic_name, difficulty_level, description, created_at)
VALUES 
  ('topic-sql-fund', 'Database Systems', 'SQL Fundamentals & DDL/DML', 'Beginner', 'Tables, primary keys, foreign keys, SELECT, WHERE, aggregations, and schema constraints.', datetime('now')),
  ('topic-dbms-joins', 'Database Systems', 'Relational Algebra & SQL Joins', 'Intermediate', 'Inner joins, left/right outer joins, natural joins, Cartesian products, and join algorithms.', datetime('now')),
  ('topic-dbms', 'Database Systems', 'DBMS — Normalisation', 'Intermediate', 'Functional dependencies, 1NF, 2NF, 3NF, BCNF decomposition proofs, and lossless-join verification.', datetime('now')),
  ('topic-dbms-transactions', 'Database Systems', 'Transactions & ACID Concurrency', 'Advanced', 'ACID properties, serializability schedules, two-phase locking (2PL), and deadlock resolution.', datetime('now')),
  ('topic-prog-fund', 'Algorithms & Complexity', 'Programming Fundamentals', 'Beginner', 'Control flow, procedural functions, scope, recursion, and basic algorithmic complexity.', datetime('now')),
  ('topic-ds-basic', 'Algorithms & Complexity', 'Data Structures (Linear)', 'Beginner', 'Arrays, linked lists, stacks, queues, hash tables, and asymptotic Big-O bounds.', datetime('now')),
  ('topic-graphs', 'Algorithms & Complexity', 'Graph Algorithms', 'Intermediate', 'BFS, DFS, topological sorting, Dijkstra shortest paths, and minimum spanning trees.', datetime('now')),
  ('topic-dp', 'Algorithms & Complexity', 'Dynamic Programming', 'Advanced', 'Optimal substructure, overlapping subproblems, memoization vs bottom-up tabulation, and state reduction.', datetime('now')),
  ('topic-os-fund', 'Operating Systems', 'OS Architecture & Process Scheduling', 'Beginner', 'CPU scheduling, context switching, process states, PCB, threads, and concurrency primitives.', datetime('now')),
  ('topic-os', 'Operating Systems', 'Operating Systems — Deadlocks', 'Intermediate', 'Four conditions of deadlock, resource-allocation graphs, Banker’s algorithm, and safety state detection.', datetime('now')),
  ('topic-os-memory', 'Operating Systems', 'Virtual Memory & Page Replacement', 'Intermediate', 'Paging, TLB, page replacement algorithms (FIFO, LRU), and thrashing mitigation.', datetime('now'));

-- 6. Seed Explicit Prerequisite Pathways
INSERT OR IGNORE INTO topic_prerequisites (id, prerequisite_topic_id, topic_id, relationship_type, reason)
VALUES
  ('prereq-sql-joins', 'topic-sql-fund', 'topic-dbms-joins', 'prerequisite', 'Basic SELECT queries and table schemas are required before performing multi-table relational joins.'),
  ('prereq-joins-norm', 'topic-dbms-joins', 'topic-dbms', 'prerequisite', 'Understanding multi-table relational joins and projections is essential before decomposing schemas into normal forms.'),
  ('prereq-norm-trans', 'topic-dbms', 'topic-dbms-transactions', 'prerequisite', 'Normalized schema understanding is essential before examining concurrent transaction schedules and locking protocols.'),
  ('prereq-prog-ds', 'topic-prog-fund', 'topic-ds-basic', 'prerequisite', 'Procedural functions and memory pointers form the foundation of linear data structures.'),
  ('prereq-ds-graphs', 'topic-ds-basic', 'topic-graphs', 'prerequisite', 'Queues, stacks, and hash maps underpin graph representations (adjacency lists) and traversal algorithms.'),
  ('prereq-graphs-dp', 'topic-graphs', 'topic-dp', 'prerequisite', 'Directed acyclic graphs (DAGs) and topological orderings provide the conceptual foundation for DP state transitions.'),
  ('prereq-os-deadlocks', 'topic-os-fund', 'topic-os', 'prerequisite', 'Process concurrency, mutexes, and scheduling fundamentals precede deadlock condition analysis.'),
  ('prereq-os-memory', 'topic-os', 'topic-os-memory', 'prerequisite', 'Process address spaces and resource allocation mechanics are required for virtual paging and page replacement.');
