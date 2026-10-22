import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Phase 15: Comprehensive QA Multi-User End-to-End Integration Flows', () => {
  let testApp;
  let db;

  // Flow test accounts
  let studentAToken, studentAId;
  let studentBToken, studentBId;
  let bystanderToken, bystanderId;
  let moderatorToken, moderatorId;

  // Shared test entity identifiers
  let topicRoomId;
  let studySessionId;
  let privateNoteId;
  let questionId;

  function cleanupQaUsers(dbInstance) {
    if (!dbInstance) return;
    try {
      const qaUsers = dbInstance.prepare(`
        SELECT id FROM users 
        WHERE email LIKE '%@test.qa.studysync.ai%'
      `).all();

      for (const u of qaUsers) {
        try { dbInstance.prepare('DELETE FROM user_privacy_settings WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?').run(u.id, u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM user_reports WHERE reporter_id = ? OR reported_user_id = ?').run(u.id, u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM peer_collaboration_feedback WHERE giver_user_id = ? OR target_peer_id = ?').run(u.id, u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM topic_assessments WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM session_participants WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM study_sessions WHERE creator_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM room_memberships WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM room_resources WHERE created_by = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM room_question_replies WHERE author_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM room_questions WHERE author_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM topic_rooms WHERE creator_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM notes WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM study_invites WHERE sender_id = ? OR receiver_id = ?').run(u.id, u.id); } catch {}
        try { dbInstance.prepare('DELETE FROM users WHERE id = ?').run(u.id); } catch {}
      }
    } catch (e) {
      // Ignore errors during best-effort cleanup
    }
  }

  before(async () => {
    testApp = await startTestServer();
    db = getDb();
    cleanupQaUsers(db);

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register Student A (Learner needing Algorithms help, willing to teach Databases)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'QA Student A',
        email: `student.a.${unique}@test.qa.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    studentAToken = dataA.data.token;
    studentAId = dataA.data.user.id;

    // 2. Register Student B (Learner strong in Algorithms, needing Databases support)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'QA Student B',
        email: `student.b.${unique}@test.qa.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    studentBToken = dataB.data.token;
    studentBId = dataB.data.user.id;

    // 3. Register Bystander / Outsider
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'QA Bystander',
        email: `bystander.${unique}@test.qa.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataC = await resC.json();
    bystanderToken = dataC.data.token;
    bystanderId = dataC.data.user.id;

    // 4. Register Moderator Account
    const resMod = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'QA Moderator',
        email: `moderator.${unique}@test.qa.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataMod = await resMod.json();
    moderatorToken = dataMod.data.token;
    moderatorId = dataMod.data.user.id;
    // Elevate role to moderator in database
    db.prepare("UPDATE users SET role = 'moderator' WHERE id = ?").run(moderatorId);
  });

  after(async () => {
    cleanupQaUsers(db);
    if (testApp?.close) {
      await testApp.close();
    }
  });

  /* ========================================================================
   * FLOW A: Peer Learning End-to-End
   * ======================================================================== */
  describe('Flow A: Peer Learning Journey', () => {
    test('A1. Setup and complete learner profiles for Student A and Student B', async () => {
      // Complete Student A profile
      const profResA = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          headline: 'Junior Data Science Student',
          institution: 'Faculty of Informatics',
          skill_level: 'Intermediate',
          preferred_study_times: 'Weekday Evenings',
          preferred_study_duration: 45,
          is_profile_completed: 1,
          subjects: ['Database Systems'],
        }),
      });
      assert.strictEqual(profResA.status, 200);

      // Student A: struggles with SQL Joins, confident in DBMS Normalisation
      const prefResA = await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          preferences: [
            {
              topic_id: 'topic-dbms-joins',
              learning_goal: 'Exam Revision',
              skill_level: 'Beginner',
              is_learning_now: 1,
              is_strength: 0,
              needs_improvement: 1,
              willing_to_teach: 0,
              wants_peer_support: 1,
            },
            {
              topic_id: 'topic-dbms',
              learning_goal: 'Teach others',
              skill_level: 'Advanced',
              is_learning_now: 0,
              is_strength: 1,
              needs_improvement: 0,
              willing_to_teach: 1,
              wants_peer_support: 0,
            },
          ],
        }),
      });
      assert.strictEqual(prefResA.status, 200);

      // Complete Student B profile
      const profResB = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({
          headline: 'Senior Algorithms Specialist',
          institution: 'Faculty of Informatics',
          skill_level: 'Advanced',
          preferred_study_times: 'Weekday Evenings',
          preferred_study_duration: 45,
          is_profile_completed: 1,
          subjects: ['Database Systems'],
        }),
      });
      assert.strictEqual(profResB.status, 200);

      // Student B: confident in SQL Joins (willing to teach), wants support in DBMS Normalisation
      const prefResB = await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({
          preferences: [
            {
              topic_id: 'topic-dbms-joins',
              learning_goal: 'Peer tutoring',
              skill_level: 'Advanced',
              is_learning_now: 1,
              is_strength: 1,
              needs_improvement: 0,
              willing_to_teach: 1,
              wants_peer_support: 0,
            },
            {
              topic_id: 'topic-dbms',
              learning_goal: 'Mastery',
              skill_level: 'Beginner',
              is_learning_now: 1,
              is_strength: 0,
              needs_improvement: 1,
              willing_to_teach: 0,
              wants_peer_support: 1,
            },
          ],
        }),
      });
      assert.strictEqual(prefResB.status, 200);
    });

    test('A2. Student A requests peer recommendations and receives verified complementary ranking', async () => {
      const recRes = await fetch(
        `${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&subject=${encodeURIComponent('Database Systems')}&intent=find_explainer`,
        {
          headers: { Authorization: `Bearer ${studentAToken}` },
        }
      );
      assert.strictEqual(recRes.status, 200);

      const recBody = await recRes.json();
      assert.strictEqual(recBody.success, true);
      assert.ok(Array.isArray(recBody.data));

      // Student A must be excluded from candidates
      const selfRec = recBody.data.find((c) => c.studentId === studentAId || c.peerId === studentAId);
      assert.strictEqual(selfRec, undefined, 'Requesting user must be excluded from recommendations');

      // Student B must be found in recommendations with complementary strength scoring
      const matchB = recBody.data.find((c) => c.studentId === studentBId || c.peerId === studentBId);
      assert.ok(matchB, 'Expected Student B in peer recommendation candidates');
      assert.ok(matchB.compatibilityScore > 0, 'Match score must be positive');
      assert.ok(Array.isArray(matchB.matchingReasons) && matchB.matchingReasons.length > 0, 'Explanations must be provided');
    });

    test('A3. Start an authorized study session flow: creation, start, join, and individual participation', async () => {
      // 1. Student A creates scheduled study session
      const createRes = await fetch(`${testApp.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          title: 'Algorithms & Complexity Collaborative Review',
          topic: 'Relational Algebra & SQL Joins',
          subject: 'Database Systems',
          planned_duration: 45,
          status: 'scheduled',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createBody = await createRes.json();
      studySessionId = createBody.data.id;
      assert.strictEqual(createBody.data.creator_id, studentAId);
      assert.strictEqual(createBody.data.status, 'scheduled');

      // 2. Student A explicitly starts the session
      const startRes = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(startRes.status, 200);
      const startBody = await startRes.json();
      assert.strictEqual(startBody.data.status, 'active');

      // 3. Student B joins the active session
      const joinRes = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(joinRes.status, 200);

      // Verify session details now reflect both participants
      const getRes = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.participants.length >= 2, true);
    });

    test('A4. Creator completes the study session and verifies session history and permitted feedback', async () => {
      // 1. Student A ends the session
      const endRes = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(endRes.status, 200);
      const endBody = await endRes.json();
      assert.strictEqual(endBody.data.status, 'completed');

      // 2. Verify session history for both participants
      const histA = await fetch(`${testApp.baseUrl}/api/sessions/history`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(histA.status, 200);
      const histBodyA = await histA.json();
      const sessEntryA = histBodyA.data.find((s) => s.id === studySessionId);
      assert.ok(sessEntryA, 'Completed session must appear in Student A history');

      const histB = await fetch(`${testApp.baseUrl}/api/sessions/history`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(histB.status, 200);
      const histBodyB = await histB.json();
      const sessEntryB = histBodyB.data.find((s) => s.id === studySessionId);
      assert.ok(sessEntryB, 'Completed session must appear in Student B history');

      // 3. Student A submits peer feedback for Student B
      const fbRes = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}/peer-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          targetPeerId: studentBId,
          wasHelpful: 1,
          wouldStudyAgain: 1,
          topicRelevance: 1,
          feedbackNotes: 'Exemplary explanation of SQL join trees and Cartesian optimizations!',
        }),
      });
      assert.strictEqual(fbRes.status, 200);
      const fbBody = await fbRes.json();
      assert.strictEqual(fbBody.success, true);
      assert.strictEqual(fbBody.data.target_peer_id, studentBId);

      // 4. Reject self-feedback (Student A reviewing Student A)
      const selfFb = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}/peer-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          targetPeerId: studentAId,
          wasHelpful: 1,
        }),
      });
      assert.strictEqual(selfFb.status, 400);

      // 5. Bystander who did not attend cannot submit peer feedback for this session
      const bystanderFb = await fetch(`${testApp.baseUrl}/api/sessions/${studySessionId}/peer-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bystanderToken}`,
        },
        body: JSON.stringify({
          targetPeerId: studentBId,
          wasHelpful: 1,
        }),
      });
      assert.strictEqual(bystanderFb.status, 403);
    });
  });

  /* ========================================================================
   * FLOW B: Topic Room Collaboration & Knowledge Exchange
   * ======================================================================== */
  describe('Flow B: Topic Room Collaboration & Access Control', () => {
    test('B1. Student A creates Topic Room and Student B joins', async () => {
      // 1. Create Topic Room
      const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          name: 'QA Systems Architecture Lab',
          topic: 'Operating Systems',
          subject: 'Computer Science',
          difficulty: 'Intermediate',
          description: 'Collaborative analysis of kernels, paging, and synchronization',
          isPrivate: false,
        }),
      });
      assert.strictEqual(roomRes.status, 201);
      const roomBody = await roomRes.json();
      topicRoomId = roomBody.data.id;
      assert.strictEqual(roomBody.data.creator_id, studentAId);
      assert.strictEqual(roomBody.data.member_count, 1);

      // 2. Student B joins the room
      const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(joinRes.status, 200);

      // 3. Confirm room membership count incremented
      const getRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.data.members.length >= 2, true);
    });

    test('B2. Share authorized resource and verify URL safety validation', async () => {
      // 1. Reject malicious or javascript: URL
      const badRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          title: 'Malicious Exploit Resource',
          url: 'javascript:alert(1)',
          type: 'article',
        }),
      });
      assert.strictEqual(badRes.status, 400);

      // 2. Accept safe HTTPS resource
      const goodRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          title: 'Linux Kernel Process Scheduler Documentation',
          url: 'https://docs.kernel.org/scheduler/index.html',
          type: 'documentation',
        }),
      });
      assert.strictEqual(goodRes.status, 201);
      const goodBody = await goodRes.json();
      assert.strictEqual(goodBody.data.title, 'Linux Kernel Process Scheduler Documentation');
    });

    test('B3. Question and reply cycle: creation, reply, resolution, and persistence', async () => {
      // 1. Student B asks a question in the room
      const qRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({
          question: 'How does circular wait differ from hold-and-wait in deadlock conditions?',
          topic: 'Operating Systems',
        }),
      });
      assert.strictEqual(qRes.status, 201);
      const qBody = await qRes.json();
      questionId = qBody.data.id;
      assert.strictEqual(Boolean(qBody.data.resolved), false);

      // 2. Student A replies
      const rRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/questions/${questionId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          content: 'Hold-and-wait means holding resources while waiting for more; circular wait requires a closed dependency chain.',
        }),
      });
      assert.strictEqual(rRes.status, 201);

      // 3. Question author (Student B) toggles resolution
      const resolveRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/questions/${questionId}/resolve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(resolveRes.status, 200);

      // 4. Verify persistence after simulated reload
      const fetchQ = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}/questions`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(fetchQ.status, 200);
      const qListBody = await fetchQ.json();
      const persistedQ = qListBody.data.find((q) => q.id === questionId);
      assert.ok(persistedQ, 'Question must persist');
      assert.strictEqual(Boolean(persistedQ.resolved), true, 'Question must remain resolved');
      assert.strictEqual(persistedQ.responses.length, 1, 'Reply must persist in responses');
      assert.strictEqual(persistedQ.replyCount, 1, 'Reply count must be 1');
    });

    test('B4. Private notes and restricted content remain strictly inaccessible to unauthorized peers', async () => {
      // 1. Student A creates a private study note
      const noteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          title: 'Alice Private OS Exam Pointers',
          content: 'Confidential personal notes and mnemonic crib sheet.',
          topic: 'Operating Systems',
          subject: 'Computer Science',
          visibility: 'private',
        }),
      });
      assert.strictEqual(noteRes.status, 201);
      const noteBody = await noteRes.json();
      privateNoteId = noteBody.data.id;

      // 2. Student B tries to access Alice private note -> 403 Forbidden
      const unauthorizedRes = await fetch(`${testApp.baseUrl}/api/notes/${privateNoteId}`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      assert.strictEqual(unauthorizedRes.status, 403);

      // 3. Unauthenticated client tries to access Alice private note -> 403 Forbidden
      const anonRes = await fetch(`${testApp.baseUrl}/api/notes/${privateNoteId}`);
      assert.strictEqual(anonRes.status, 403);
    });
  });

  /* ========================================================================
   * FLOW C: Learning Progress, Knowledge Map & Assessment Integrity
   * ======================================================================== */
  describe('Flow C: Learning Progress & Knowledge Map Signals', () => {
    test('C1. Configure topics and record a verified practice quiz assessment', async () => {
      // 1. Configure syllabus preferences
      const dnaRes = await fetch(`${testApp.baseUrl}/api/dna`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          topics: [
            {
              topic_id: 'topic-dbms',
              confidence_level: 'practicing',
              willing_to_teach: false,
              wants_peer_support: true,
              is_learning_now: true,
            },
          ],
        }),
      });
      assert.strictEqual(dnaRes.status, 200);

      // 2. Record genuine verified quiz assessment result
      const assessRes = await fetch(`${testApp.baseUrl}/api/knowledge-map/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          topicId: 'topic-dbms',
          assessmentType: 'practice_quiz',
          scorePercentage: 92.5,
          passed: true,
          totalQuestions: 10,
          correctAnswers: 9,
          notes: 'QA Automated Curriculum Verification Assessment',
        }),
      });
      assert.strictEqual(assessRes.status, 201);
      const assessBody = await assessRes.json();
      assert.strictEqual(assessBody.success, true);
      assert.strictEqual(assessBody.data.topicId, 'topic-dbms');
      assert.strictEqual(assessBody.data.scorePercentage, 92.5);
    });

    test('C2. Knowledge Map reflects verified assessment metrics and separates attendance from mastery', async () => {
      // 1. Fetch unbundled progress signals
      const progRes = await fetch(`${testApp.baseUrl}/api/knowledge-map/progress`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(progRes.status, 200);
      const progBody = await progRes.json();
      assert.strictEqual(progBody.success, true);

      const { verifiedAssessments, studyActivity } = progBody.data;

      // 2. Check verified assessment calculations
      assert.strictEqual(verifiedAssessments.hasAssessments, true);
      assert.ok(verifiedAssessments.totalAssessmentsTaken >= 1);
      assert.ok(verifiedAssessments.passedAssessmentsCount >= 1);
      assert.strictEqual(verifiedAssessments.averageScorePercentage, 92.5);

      // 3. Confirm attendance is explicitly NOT treated as proof of mastery
      assert.ok(
        studyActivity.explanation.includes('measures participation, not verified comprehension'),
        'Attendance explanation must clarify it measures participation rather than comprehension'
      );
    });
  });

  /* ========================================================================
   * FLOW D: Safety, Privacy, Moderation & Blocking Policies
   * ======================================================================== */
  describe('Flow D: Safety, Privacy Controls & Moderation Workflow', () => {
    test('D1. Configure profile visibility to private and verify discoverability exclusion', async () => {
      // 1. Student B sets profile visibility to private
      const privRes = await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({
          profileVisibility: 'private',
        }),
      });
      assert.strictEqual(privRes.status, 200);
      const privBody = await privRes.json();
      assert.strictEqual(privBody.data.profileVisibility, 'private');

      // 2. Student A queries peer recommendations; private Student B must be excluded
      const recRes = await fetch(
        `${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&subject=${encodeURIComponent('Database Systems')}`,
        {
          headers: { Authorization: `Bearer ${studentAToken}` },
        }
      );
      assert.strictEqual(recRes.status, 200);
      const recBody = await recRes.json();
      const foundPrivate = recBody.data.find((c) => c.studentId === studentBId || c.peerId === studentBId);
      assert.strictEqual(foundPrivate, undefined, 'Private learner must be excluded from recommendations');

      // 3. Direct peer profile query for private learner returns 404 NOT_FOUND
      const directRes = await fetch(`${testApp.baseUrl}/api/matches/peers/${studentBId}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(directRes.status, 404);

      // Reset Student B to public
      await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({
          profileVisibility: 'public',
        }),
      });
    });

    test('D2. Block another account and verify bidirectional recommendation exclusion', async () => {
      // 1. Student A blocks Student B
      const blockRes = await fetch(`${testApp.baseUrl}/api/safety/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          targetUserId: studentBId,
          reason: 'uncooperative_behavior',
        }),
      });
      assert.strictEqual(blockRes.status, 200);
      const blockBody = await blockRes.json();
      assert.strictEqual(blockBody.data.blocked, true);

      // 2. Student A recommendations must exclude Student B
      const recA = await fetch(
        `${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&subject=${encodeURIComponent('Database Systems')}`,
        {
          headers: { Authorization: `Bearer ${studentAToken}` },
        }
      );
      assert.strictEqual(recA.status, 200);
      const recBodyA = await recA.json();
      const hasB = recBodyA.data.find((c) => c.studentId === studentBId || c.peerId === studentBId);
      assert.strictEqual(hasB, undefined, 'Blocked learner must be excluded from blocker recommendations');

      // 3. Student B recommendations must exclude Student A (bidirectional enforcement)
      const recB = await fetch(
        `${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&subject=${encodeURIComponent('Database Systems')}`,
        {
          headers: { Authorization: `Bearer ${studentBToken}` },
        }
      );
      assert.strictEqual(recB.status, 200);
      const recBodyB = await recB.json();
      const hasA = recBodyB.data.find((c) => c.studentId === studentAId || c.peerId === studentAId);
      assert.strictEqual(hasA, undefined, 'Blocker must be excluded from blocked user recommendations');

      // 4. In shared Topic Room, verify questions asked by Student B are marked with isBlocked: true from Student A perspective
      const roomRes = await fetch(`${testApp.baseUrl}/api/rooms/${topicRoomId}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(roomRes.status, 200);
      const roomBody = await roomRes.json();
      const blockedQ = roomBody.data.questions.find((q) => q.asker_id === studentBId);
      assert.ok(blockedQ, 'Question asked by Student B exists in room');
      assert.strictEqual(blockedQ.isBlocked, true, 'Question from blocked user must have isBlocked: true');
      assert.strictEqual(blockedQ.question, '[Question from blocked user hidden]');
    });

    test('D3. Submit abuse report and verify authorized-only moderation access', async () => {
      // 1. Student A reports Student B
      const reportRes = await fetch(`${testApp.baseUrl}/api/safety/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({
          reportedUserId: studentBId,
          category: 'harassment',
          description: 'Spamming irrelevant messages during peer session.',
        }),
      });
      assert.strictEqual(reportRes.status, 201);
      const reportBody = await reportRes.json();
      assert.strictEqual(reportBody.success, true);
      assert.strictEqual(reportBody.data.status, 'pending');

      // 2. Regular learner (Student A) cannot list moderation reports -> 403 Forbidden
      const unauthReportList = await fetch(`${testApp.baseUrl}/api/safety/reports`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.strictEqual(unauthReportList.status, 403);

      // 3. Authorized Moderator can retrieve report queue -> 200 OK
      const modReportList = await fetch(`${testApp.baseUrl}/api/safety/reports`, {
        headers: { Authorization: `Bearer ${moderatorToken}` },
      });
      assert.strictEqual(modReportList.status, 200);
      const modBody = await modReportList.json();
      assert.strictEqual(modBody.success, true);
      assert.ok(Array.isArray(modBody.data));
      const foundReport = modBody.data.find(
        (r) => r.reported_user_id === studentBId && r.reporter_id === studentAId
      );
      assert.ok(foundReport, 'Submitted report must be visible in moderation queue');
    });
  });
});
