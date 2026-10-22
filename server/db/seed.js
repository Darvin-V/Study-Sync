import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, withTransaction } from './connection.js';
import { runMigrations } from './migrate.js';
import { hashPassword } from '../utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * StudySync AI — Database Seeder (Phase 5 Updated)
 * 
 * Populates database with realistic development data:
 * - Fictional students with scrypt password hashes
 * - Learner profiles & academic subjects
 * - Syllabus topics
 * - Learning preferences (learning now, strengths, weaknesses)
 * - Academic rooms, memberships, messages, questions & replies
 * - Notes & study sessions
 * 
 * Fully idempotent.
 */
export function seedDatabase(customPath = null) {
  // Ensure migrations are run first
  runMigrations(customPath);

  const db = getDb(customPath);

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

  // Standard development password for all seeded accounts
  const demoPasswordHash = hashPassword('Password123!');

  withTransaction((txDb) => {
    const isTestFixture = process.env.NODE_ENV === 'test';

    if (!isTestFixture) {
      // Production & Development: Strictly isolate demo data to <= 2 demo records clearly labeled DEMO
      txDb.prepare("DELETE FROM room_memberships WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM room_messages WHERE sender_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM room_questions WHERE asker_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM question_responses WHERE responder_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM notes_resources WHERE author_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM session_attendance_intervals WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM session_participants WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM session_feedback WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM learning_activities WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM topic_assessments WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM user_learning_preferences WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM user_subjects WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM user_settings WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM learner_profiles WHERE user_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM rooms WHERE creator_id IN ('student-maya', 'student-priya')").run();
      txDb.prepare("DELETE FROM users WHERE id IN ('student-maya', 'student-priya')").run();
    }

    const insertUser = txDb.prepare(`
      INSERT INTO users (id, display_name, username, email, password_hash, avatar_url, preferred_languages, is_verified, email_verified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        username = excluded.username,
        password_hash = excluded.password_hash,
        is_verified = 1,
        email_verified_at = excluded.email_verified_at
    `);

    const darvinDisplayName = isTestFixture ? 'Darvin' : 'Darvin [DEMO]';
    const arunDisplayName = isTestFixture ? 'Arun' : 'Arun [DEMO]';

    insertUser.run('darvin-01', darvinDisplayName, 'darvin_demo', 'darvin@demo.studysync.ai', demoPasswordHash, null, JSON.stringify(['English', 'Tamil']), twoDaysAgo, twoDaysAgo, now);
    insertUser.run('student-arun', arunDisplayName, 'arun', 'arun@demo.studysync.ai', demoPasswordHash, null, JSON.stringify(['English']), twoDaysAgo, twoDaysAgo, now);

    if (isTestFixture) {
      insertUser.run('student-maya', 'Maya Chen', 'maya_chen', 'maya@demo.studysync.ai', demoPasswordHash, null, JSON.stringify(['English', 'Mandarin']), twoDaysAgo, twoDaysAgo, now);
      insertUser.run('student-priya', 'Priya Sharma', 'priya_sharma', 'priya@demo.studysync.ai', demoPasswordHash, null, JSON.stringify(['English', 'Hindi']), twoDaysAgo, twoDaysAgo, now);
    }

    // 2. Learner Profiles
    const insertProfile = txDb.prepare(`
      INSERT INTO learner_profiles (
        id, user_id, headline, institution, introduction, skill_level,
        preferred_study_times, preferred_study_duration, collaboration_style, is_profile_completed,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        headline = excluded.headline,
        institution = excluded.institution,
        introduction = excluded.introduction,
        skill_level = excluded.skill_level,
        preferred_study_times = excluded.preferred_study_times,
        preferred_study_duration = excluded.preferred_study_duration,
        collaboration_style = excluded.collaboration_style,
        is_profile_completed = excluded.is_profile_completed,
        updated_at = excluded.updated_at
    `);

    insertProfile.run(
      'profile-darvin-01',
      'darvin-01',
      isTestFixture ? 'Junior (Year 3) • B.S. in Computer Science' : 'Junior (Year 3) [DEMO] • B.S. in Computer Science',
      'Department of Computing & Information Sciences',
      'Focusing on core database systems, algorithm design, and operating systems for upcoming examinations.',
      'Intermediate',
      'Weekday evenings & weekend mornings',
      45,
      'Peer discussion & problem solving',
      1,
      twoDaysAgo,
      now
    );

    insertProfile.run(
      'profile-student-arun',
      'student-arun',
      isTestFixture ? 'Senior (Year 4) • Computer Engineering' : 'Senior (Year 4) [DEMO] • Computer Engineering',
      'School of Engineering & Applied Science',
      'Database normalization, indexing, and distributed systems enthusiast.',
      'Advanced',
      'Daily late evenings',
      60,
      'Concept exchange & peer teaching',
      1,
      twoDaysAgo,
      now
    );

    if (isTestFixture) {
      insertProfile.run(
        'profile-student-maya',
        'student-maya',
        'Sophomore (Year 2) • Applied Mathematics & Algorithms',
        'School of Computing & Mathematical Sciences',
        'Exploring competitive programming, dynamic programming memoization, and graph theory.',
        'Advanced',
        'Weekday evenings',
        45,
        'Algorithmic problem solving & code review',
        1,
        twoDaysAgo,
        now
      );
      insertProfile.run(
        'profile-student-priya',
        'student-priya',
        'Junior (Year 3) • Electrical & Computer Systems',
        'Department of Electrical Engineering',
        'Studying operating system kernels, concurrency, deadlocks, and computer networking.',
        'Intermediate',
        'Weekend mornings',
        60,
        'Concept exchange & step-by-step revision',
        1,
        twoDaysAgo,
        now
      );
    }

    // 2b. User Preferences & Settings (Theme & Language)
    const insertSettings = txDb.prepare(`
      INSERT INTO user_settings (user_id, theme, language, font_scaling, reduced_motion, room_audio_video, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        language = excluded.language
    `);

    insertSettings.run('darvin-01', 'system', 'en', 'standard', 0, 'muted', twoDaysAgo, now);
    insertSettings.run('student-arun', 'light', 'en', 'standard', 0, 'muted', twoDaysAgo, now);

    // 3. User Subjects
    const insertSubject = txDb.prepare(`
      INSERT OR IGNORE INTO user_subjects (id, user_id, subject, created_at)
      VALUES (?, ?, ?, ?)
    `);

    insertSubject.run('subj-darvin-1', 'darvin-01', 'Database Systems', twoDaysAgo);
    insertSubject.run('subj-darvin-2', 'darvin-01', 'Algorithms & Complexity', twoDaysAgo);
    insertSubject.run('subj-darvin-3', 'darvin-01', 'Operating Systems', twoDaysAgo);
    insertSubject.run('subj-arun-1', 'student-arun', 'Database Systems', twoDaysAgo);
    insertSubject.run('subj-arun-2', 'student-arun', 'Algorithms & Complexity', twoDaysAgo);

    // 4. Learning Topics
    const insertTopic = txDb.prepare(`
      INSERT OR IGNORE INTO learning_topics (id, subject, topic_name, difficulty_level, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertTopic.run(
      'topic-dbms',
      'Database Systems',
      'DBMS — Normalisation',
      'Intermediate',
      'Functional dependencies, 1NF, 2NF, 3NF, and BCNF decomposition proofs, lossless-join, and dependency preservation.',
      twoDaysAgo
    );
    insertTopic.run(
      'topic-dp',
      'Algorithms & Complexity',
      'Dynamic Programming',
      'Advanced',
      'Optimal substructure, overlapping subproblems, memoization vs bottom-up tabulation, and state reduction.',
      twoDaysAgo
    );
    insertTopic.run(
      'topic-os',
      'Operating Systems',
      'Operating Systems — Deadlocks',
      'Intermediate',
      'Four conditions of deadlock, resource-allocation graphs, Banker’s algorithm, and safety state detection.',
      twoDaysAgo
    );
    insertTopic.run(
      'topic-linalg',
      'Mathematics',
      'Linear Algebra — Eigenvalues',
      'Intermediate',
      'Characteristic equations, eigenspaces, diagonalization of symmetric matrices, and spectral theorem.',
      twoDaysAgo
    );
    insertTopic.run(
      'topic-net',
      'Computer Networks',
      'Computer Networks — TCP/IP',
      'Intermediate',
      'Congestion control, TCP 3-way handshake, sliding window protocols, slow-start, and fast recovery.',
      twoDaysAgo
    );
    insertTopic.run(
      'topic-ml',
      'Machine Learning',
      'Machine Learning — Gradient Descent',
      'Intermediate',
      'Cost function optimization, stochastic vs batch gradient descent, learning rates, and convergence criteria.',
      twoDaysAgo
    );

    // 5. User Learning Preferences with role flags & Learning DNA fields
    const insertPref = txDb.prepare(`
      INSERT INTO user_learning_preferences 
      (id, user_id, topic_id, learning_goal, skill_level, learning_status, preferred_study_duration, is_learning_now, is_strength, is_improving, confidence_level, willing_to_teach, wants_peer_support, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, topic_id) DO UPDATE SET
        is_learning_now = excluded.is_learning_now,
        is_strength = excluded.is_strength,
        is_improving = excluded.is_improving,
        confidence_level = excluded.confidence_level,
        willing_to_teach = excluded.willing_to_teach,
        wants_peer_support = excluded.wants_peer_support,
        learning_goal = excluded.learning_goal,
        updated_at = excluded.updated_at
    `);

    insertPref.run('pref-01', 'darvin-01', 'topic-dbms', 'Master BCNF decomposition proofs and lossless-join conditions', 'Intermediate', 'actively_learning', 45, 1, 1, 0, 'confident', 1, 0, twoDaysAgo, now);
    insertPref.run('pref-02', 'darvin-01', 'topic-dp', 'Solve 50 dynamic programming recurrence relations', 'Intermediate', 'actively_learning', 45, 1, 0, 1, 'needs_improvement', 0, 1, twoDaysAgo, now);
    insertPref.run('pref-03', 'student-arun', 'topic-dbms', 'Lead exam revision sessions on attribute closure', 'Advanced', 'actively_learning', 60, 1, 1, 0, 'confident', 1, 0, twoDaysAgo, now);

    // 6. Rooms
    // Clean up accumulated ephemeral test rooms and calls so baseline rooms stay clean
    txDb.prepare("DELETE FROM rooms WHERE id LIKE 'room-17%' OR id LIKE 'room-test%' OR id LIKE 'room-call-17%' OR id LIKE 'room-call-test%' OR creator_id LIKE 'user-17%'").run();

    const insertRoom = txDb.prepare(`
      INSERT INTO rooms 
      (id, room_name, subject, topic, description, room_type, difficulty, preferred_languages, creator_id, max_capacity, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = 'active',
        created_at = excluded.created_at,
        room_name = excluded.room_name,
        subject = excluded.subject,
        topic = excluded.topic,
        description = excluded.description,
        room_type = excluded.room_type,
        difficulty = excluded.difficulty,
        preferred_languages = excluded.preferred_languages,
        creator_id = excluded.creator_id,
        max_capacity = excluded.max_capacity,
        updated_at = excluded.updated_at
    `);

    insertRoom.run(
      'room-dbms-norm',
      'DBMS — Normalisation',
      'Database Systems',
      '1NF to BCNF Decomposition Proofs',
      'Exam revision focusing on 3NF vs BCNF decomposition rules and lossless-join verification exercises with peers preparing for midterms.',
      'Exam Revision',
      'Intermediate',
      JSON.stringify(['English', 'Tamil']),
      'student-arun',
      8,
      'active',
      twoDaysAgo,
      twoDaysAgo
    );

    insertRoom.run(
      'room-dp-lcs',
      'Dynamic Programming — LCS & Memoization',
      'Algorithms & Complexity',
      'Longest Common Subsequence & State Reduction',
      'Collaborative problem solving on 2D table optimizations and space complexity reduction.',
      'Learn Together',
      'Advanced',
      JSON.stringify(['English']),
      isTestFixture ? 'student-maya' : 'student-arun',
      6,
      'active',
      yesterday,
      yesterday
    );

    insertRoom.run(
      'room-os-deadlocks',
      'Operating Systems — Deadlocks',
      'Operating Systems',
      'Coffman Conditions & Banker’s Algorithm',
      'Working through Banker’s algorithm safety matrix verification exercises and resource allocation graph cycle traces.',
      'Doubt Solving',
      'Intermediate',
      JSON.stringify(['English', 'Hindi']),
      'darvin-01',
      6,
      'active',
      yesterday,
      yesterday
    );

    insertRoom.run(
      'room-linalg-eigen',
      'Linear Algebra — Eigenvalues',
      'Mathematics',
      'Matrix Diagonalization & Eigenspaces',
      'Working through characteristic polynomial roots and eigenspace basis calculations.',
      'Peer Teaching',
      'Intermediate',
      JSON.stringify(['English']),
      'student-arun',
      5,
      'active',
      twoDaysAgo,
      twoDaysAgo
    );

    insertRoom.run(
      'room-tcp-congestion',
      'TCP/IP & Congestion Control',
      'Computer Networks',
      'Slow Start, AIMD & Fast Recovery',
      'Comparing AIMD dynamics, slow start threshold, and fast retransmit/recovery states with Wireshark packet captures.',
      'Revision',
      'Intermediate',
      JSON.stringify(['English', 'Hindi']),
      'student-arun',
      6,
      'active',
      yesterday,
      yesterday
    );

    insertRoom.run(
      'room-python-oop',
      'Python — OOP & Design Patterns',
      'Computer Science',
      'Inheritance, Dunder Methods & Factory Pattern',
      'Introductory practice building object-oriented classes in Python with polymorphism, encapsulation, and magic methods.',
      'Learn Together',
      'Beginner',
      JSON.stringify(['English']),
      'darvin-01',
      8,
      'active',
      twoDaysAgo,
      twoDaysAgo
    );

    insertRoom.run(
      'room-ds-graphs',
      'Data Structures — Graph Algorithms',
      'Algorithms & Complexity',
      'BFS, DFS & Dijkstra Shortest Path',
      'Exam preparation drilling priority queue implementations of Dijkstra and cycle detection in directed graphs.',
      'Exam Revision',
      'Advanced',
      JSON.stringify(['English']),
      'student-arun',
      8,
      'active',
      yesterday,
      yesterday
    );

    // Ensure baseline study rooms have deterministic, human-readable room codes
    const setRoomCode = txDb.prepare('UPDATE rooms SET room_code = ? WHERE id = ? AND (room_code IS NULL OR room_code = \'\')');
    setRoomCode.run('DBMS-4X9M', 'room-dbms-norm');
    setRoomCode.run('ALGO-8K2P', 'room-dp-lcs');
    setRoomCode.run('OS-3N7Q', 'room-os-deadlocks');
    setRoomCode.run('MATH-7E4K', 'room-linalg-eigen');
    setRoomCode.run('NET-5T9P', 'room-tcp-congestion');
    setRoomCode.run('CODE-2P8M', 'room-python-oop');
    setRoomCode.run('ALGO-4D9J', 'room-ds-graphs');

    // 7. Room Memberships
    const insertMember = txDb.prepare(`
      INSERT OR IGNORE INTO room_memberships (id, room_id, user_id, membership_role, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertMember.run('mem-01', 'room-dbms-norm', 'student-arun', 'creator', twoDaysAgo);
    insertMember.run('mem-02', 'room-dbms-norm', 'darvin-01', 'member', yesterday);
    if (isTestFixture) {
      insertMember.run('mem-03', 'room-dbms-norm', 'student-maya', 'member', yesterday);
      insertMember.run('mem-04', 'room-dbms-norm', 'student-priya', 'member', yesterday);
    }
    insertMember.run('mem-05', 'room-dp-lcs', isTestFixture ? 'student-maya' : 'student-arun', 'creator', yesterday);
    insertMember.run('mem-06', 'room-dp-lcs', 'darvin-01', 'member', now);
    insertMember.run('mem-07', 'room-os-deadlocks', 'darvin-01', 'creator', yesterday);
    insertMember.run('mem-08', 'room-os-deadlocks', 'student-arun', 'member', yesterday);
    insertMember.run('mem-09', 'room-linalg-eigen', 'student-arun', 'creator', twoDaysAgo);
    insertMember.run('mem-10', 'room-tcp-congestion', 'student-arun', 'creator', yesterday);
    insertMember.run('mem-11', 'room-python-oop', 'darvin-01', 'creator', twoDaysAgo);
    insertMember.run('mem-12', 'room-ds-graphs', 'student-arun', 'creator', yesterday);

    // 8. Room Messages
    const insertMessage = txDb.prepare(`
      INSERT OR IGNORE INTO room_messages (id, room_id, sender_id, message_content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertMessage.run('msg-01', 'room-dbms-norm', 'darvin-01', 'Can someone explain the difference between 2NF and 3NF in simple terms?', yesterday);
    insertMessage.run('msg-02', 'room-dbms-norm', 'student-arun', 'In 2NF, no non-prime attribute partially depends on a key. In 3NF, no transitive dependencies exist either.', yesterday);
    insertMessage.run('msg-03', 'room-dbms-norm', 'darvin-01', 'I am working on decomposing relation R(A,B,C,D,E) into 3NF. Ready to compare minimal covers.', now);

    // 9. Room Questions & Responses
    const insertQuestion = txDb.prepare(`
      INSERT OR IGNORE INTO room_questions (id, room_id, asker_id, question_content, topic, is_resolved, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertQuestion.run(
      'q-01',
      'room-dbms-norm',
      'darvin-01',
      'Why is BCNF strictly stronger than 3NF, and when is dependency preservation lost?',
      '3NF vs BCNF Trade-offs',
      1,
      yesterday,
      yesterday
    );

    const insertResponse = txDb.prepare(`
      INSERT OR IGNORE INTO question_responses (id, question_id, responder_id, response_content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertResponse.run(
      'resp-01',
      'q-01',
      'student-arun',
      'BCNF requires that every determinant is a superkey. In 3NF, the determinant does not have to be a superkey if the right-hand side is a prime attribute. When decomposing into BCNF, some functional dependencies spanning multiple relations cannot always be preserved without computing joins.',
      yesterday
    );

    // 10. Notes and Resources
    const insertNote = txDb.prepare(`
      INSERT OR IGNORE INTO notes_resources 
      (id, title, content, description, resource_reference, resource_type, subject, topic, author_id, room_id, session_id, visibility, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Note 1: Room-shared note on DBMS Normalisation
    insertNote.run(
      'note-01',
      'Relational Normalisation: 1NF to BCNF Step-by-Step',
      '### 1. Functional Dependency Basics\nA functional dependency X -> Y specifies that X uniquely determines Y.\n- Trivial FD: Y is subset of X\n- Non-Trivial: Y not in X\n\n### 2. Normal Forms Criteria\n1NF: Atomic values only.\n2NF: No partial key dependencies.\n3NF: No transitive dependencies (determinant is superkey or RHS is prime).\nBCNF: Every determinant must be a superkey.\n\n### 3. Decomposition Theorems\nLossless join guarantees R1 intersect R2 -> R1 or R2.\nDependency preservation preserves all FDs without requiring joins.',
      'Clear criteria checklist for testing 1NF, 2NF, 3NF, and Boyce-Codd Normal Form. Includes worked decomposition algorithm and closure computation steps.',
      'https://course.edu/dbms/lecture-09-handout.pdf',
      'Cheatsheet',
      'Database Systems',
      'DBMS — Normalisation',
      'student-arun',
      'room-dbms-norm',
      'session-active-01',
      'room_shared',
      0,
      twoDaysAgo,
      yesterday
    );

    // Note 2: Public note on Dynamic Programming
    insertNote.run(
      'note-02',
      'Dynamic Programming State Transitions & Memoization Cheatsheet',
      '### 1. Principles of Dynamic Programming\n1. Optimal Substructure: Optimal solution contains optimal solutions to subproblems.\n2. Overlapping Subproblems: Solves identical subproblems repeatedly.\n\n### 2. Longest Common Subsequence (LCS)\nRecurrence:\n- dp[i][j] = dp[i-1][j-1] + 1 if X[i-1] == Y[j-1]\n- dp[i][j] = max(dp[i-1][j], dp[i][j-1]) otherwise\n\n### 3. Space Optimization\nCan reduce from O(m*n) to O(min(m, n)) space using two rolling rows.',
      'Template recurrence structures for Longest Common Subsequence, 0/1 Knapsack, Coin Change, and Matrix Chain Multiplication.',
      'https://algorithms.org/dp-memoization-guide',
      'Cheatsheet',
      'Algorithms & Complexity',
      'Dynamic Programming',
      'darvin-01',
      'room-dp-lcs',
      'session-active-01',
      'public',
      0,
      yesterday,
      yesterday
    );

    // Note 3: Room-shared note on OS Deadlocks
    insertNote.run(
      'note-03',
      'Operating Systems Deadlock Prevention vs Avoidance (Banker’s Algorithm)',
      '### 1. The Four Coffman Conditions\n1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait\n\n### 2. Deadlock Avoidance: Banker’s Algorithm\nEnsure system never enters an unsafe state. Need[i][j] = Max[i][j] - Allocation[i][j]. Work = Available. Iterate until all processes are finished.',
      'Breakdown of the 4 Coffman conditions, hold-and-wait prevention strategies, and safe state detection in multi-resource systems.',
      'https://os-textbook.org/bankers-algo-handout.pdf',
      'Revision Brief',
      'Operating Systems',
      'Operating Systems — Deadlocks',
      'darvin-01',
      'room-os-deadlocks',
      'session-completed-01',
      'room_shared',
      0,
      twoDaysAgo,
      yesterday
    );

    // Note 4: Public note on Linear Algebra
    insertNote.run(
      'note-04',
      'Eigenvalues and Diagonalization Step-by-Step Procedure',
      '### 1. Eigenvalues Definition\nAv = lambda*v <=> (A - lambda*I)v = 0\nDet(A - lambda*I) = 0 gives characteristic equation.\n\n### 2. Diagonalization Test\nA is diagonalizable iff it has n linearly independent eigenvectors.',
      'Systematic approach for finding characteristic equations det(A - lambda I) = 0, determining geometric vs algebraic multiplicity, and forming matrix P.',
      'https://ocw.mit.edu/courses/linear-algebra-notes.pdf',
      'Worked Examples',
      'Mathematics',
      'Linear Algebra — Eigenvalues',
      'student-arun',
      'room-linalg-eigen',
      null,
      'public',
      0,
      twoDaysAgo,
      twoDaysAgo
    );

    // Note 5: Room-shared note on Computer Networks
    insertNote.run(
      'note-05',
      'TCP Congestion Control: AIMD, Slow Start & Fast Recovery',
      '### 1. TCP Congestion Window Phases\n1. Slow Start: doubles cwnd every RTT until ssthresh.\n2. Congestion Avoidance: increases by 1 MSS per RTT (AIMD linear).\n3. Fast Retransmit & Recovery on 3 duplicate ACKs.',
      'Comparison of TCP Tahoe vs Reno state machines, additive increase multiplicative decrease (AIMD), and duplicate ACK handling.',
      'https://rfc-editor.org/rfc/rfc5681.html',
      'Lecture Summary',
      'Computer Networks',
      'Computer Networks — TCP/IP',
      'student-arun',
      'room-tcp-congestion',
      null,
      'room_shared',
      0,
      yesterday,
      yesterday
    );

    // Note 6: Private note for Darvin
    insertNote.run(
      'note-darvin-private',
      'Darvin Private Exam Scratchpad & Proofs',
      '### Confidential Scratchpad\nPersonal proofs and review notes for upcoming database systems examination. Not shared with peers.',
      'Personal confidential study scratchpad for midterm revision.',
      null,
      'Cheatsheet',
      'Database Systems',
      'DBMS — Normalisation',
      'darvin-01',
      null,
      null,
      'private',
      0,
      yesterday,
      yesterday
    );

    // Additional Shared Room Resources
    insertNote.run(
      'res-dbms-cheat',
      '3NF Decomposition Practice Set & Solutions',
      'Practice problem set containing 12 relations with functional dependency sets and full step-by-step minimal cover and 3NF synthesis proofs.',
      'Worked practice set with 12 synthesis exercises and minimal cover solutions.',
      'https://course.edu/dbms/3nf-practice.pdf',
      'Cheat Sheet',
      'Database Systems',
      'DBMS — Normalisation',
      'student-arun',
      'room-dbms-norm',
      null,
      'room_shared',
      0,
      twoDaysAgo,
      twoDaysAgo
    );

    insertNote.run(
      'res-os-banker',
      'Banker Algorithm Safety Matrix Reference',
      'Safety algorithm walkthrough with 5 processes and 3 resource types (A:10, B:5, C:7). Includes cycle-detection matrix.',
      'Step-by-step Banker algorithm matrix evaluation with 5 processes.',
      'https://os-textbook.org/bankers-algo-handout.pdf',
      'PDF',
      'Operating Systems',
      'Operating Systems — Deadlocks',
      'darvin-01',
      'room-os-deadlocks',
      null,
      'room_shared',
      0,
      yesterday,
      yesterday
    );

    // 11. Study Sessions
    const insertSession = txDb.prepare(`
      INSERT OR IGNORE INTO study_sessions (
        id, topic, subject, room_id, creator_id, title, description,
        planned_duration, status, start_at, end_at, scheduled_start_at,
        actual_start_at, actual_end_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const thirtyTwoMinsAgo = new Date(Date.now() - 32 * 60 * 1000).toISOString();
    const yesterdayEnd = new Date(Date.parse(yesterday) + 45 * 60 * 1000).toISOString();

    // 11a. Active Session
    insertSession.run(
      'session-active-01',
      'DBMS — Normalisation',
      'Database Systems',
      'room-dbms-norm',
      'darvin-01',
      'DBMS 3NF & BCNF Proofs Focus Block',
      'Focused collaborative session on 1NF to BCNF decomposition and lossless-join conditions.',
      45,
      'active',
      thirtyTwoMinsAgo,
      null,
      thirtyTwoMinsAgo,
      thirtyTwoMinsAgo,
      null,
      thirtyTwoMinsAgo,
      thirtyTwoMinsAgo
    );

    // 11b. Completed Session
    insertSession.run(
      'session-completed-01',
      'OS Virtual Memory & Page Replacement',
      'Operating Systems',
      'room-os-deadlocks',
      'darvin-01',
      'Page Replacement Algorithms Deep Dive',
      'LRU vs FIFO vs Optimal page replacement algorithms and page fault rate calculations.',
      45,
      'completed',
      yesterday,
      yesterdayEnd,
      yesterday,
      yesterday,
      yesterdayEnd,
      yesterday,
      yesterdayEnd
    );

    // 12. Session Participants
    const insertParticipant = txDb.prepare(`
      INSERT OR IGNORE INTO session_participants (
        id, session_id, user_id, joined_at, left_at,
        individual_duration_minutes, participation_status,
        recorded_study_minutes, total_attendance_seconds
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertParticipant.run('part-01', 'session-active-01', 'darvin-01', thirtyTwoMinsAgo, null, 32, 'active', 32, 1920);
    insertParticipant.run('part-02', 'session-active-01', 'student-arun', thirtyTwoMinsAgo, null, 32, 'active', 32, 1920);

    insertParticipant.run('part-04', 'session-completed-01', 'darvin-01', yesterday, yesterdayEnd, 45, 'completed', 40, 2700);
    insertParticipant.run('part-05', 'session-completed-01', 'student-arun', yesterday, yesterdayEnd, 38, 'completed', 35, 2280);

    // 13. Attendance Intervals
    const insertInterval = txDb.prepare(`
      INSERT OR IGNORE INTO session_attendance_intervals (id, session_id, user_id, joined_at, left_at, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertInterval.run('int-01', 'session-active-01', 'darvin-01', thirtyTwoMinsAgo, null, 1920);
    insertInterval.run('int-02', 'session-active-01', 'student-arun', thirtyTwoMinsAgo, null, 1920);

    insertInterval.run('int-04', 'session-completed-01', 'darvin-01', yesterday, yesterdayEnd, 2700);
    insertInterval.run('int-05', 'session-completed-01', 'student-arun', yesterday, yesterdayEnd, 2280);

    // 14. Session Feedback
    const insertFeedback = txDb.prepare(`
      INSERT OR IGNORE INTO session_feedback (id, session_id, user_id, rating, reflection, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertFeedback.run('fb-01', 'session-completed-01', 'darvin-01', 'Very helpful', 'Mastered Second Chance and Optimal Page Replacement algorithms.', yesterdayEnd);

    // 15. Learning Activities
    const insertActivity = txDb.prepare(`
      INSERT OR IGNORE INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertActivity.run('act-01', 'darvin-01', 'session_joined', 'Joined 45-min focus session for DBMS Normalisation', 'session-active-01', now);
    insertActivity.run('act-02', 'darvin-01', 'room_joined', 'Joined DBMS Normalisation topic room', 'room-dbms-norm', yesterday);
    insertActivity.run('act-03', 'darvin-01', 'note_reviewed', 'Reviewed Relational Normalisation cheatsheet', 'note-01', yesterday);

    // 16. Verified Topic Assessments (Phase 10: Real assessments, never fabricated)
    const insertAssessment = txDb.prepare(`
      INSERT OR IGNORE INTO topic_assessments (id, user_id, topic_id, assessment_type, score_percentage, passed, notes, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAssessment.run('assess-darvin-01', 'darvin-01', 'topic-dbms', 'practice_quiz', 88.0, 1, 'Scored 88% on Normalization decomposition proofs quiz.', twoDaysAgo);
    insertAssessment.run('assess-arun-01', 'student-arun', 'topic-dbms', 'module_exam', 95.0, 1, 'Scored 95% on Relational Theory and Normal Forms exam.', twoDaysAgo);
  }, customPath);

  return { seeded: true, timestamp: now };
}

// Run directly from CLI if executed as main
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const res = seedDatabase();
    console.log('[Seed] Database seeded successfully at', res.timestamp);
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
    process.exit(1);
  }
}

export default seedDatabase;
