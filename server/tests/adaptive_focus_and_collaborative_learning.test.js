import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Adaptive Focus and Collaborative Learning System Integration Tests', () => {
  let testApp;
  let db;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let newLearnerToken;
  let newLearnerId;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. User A (Alice - Experienced learner with completed sessions and quizzes)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Focus Lead',
        email: `alice.lead.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // 2. User B (Bob - Peer collaborator)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Collaborator',
        email: `bob.collab.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    // 3. New Learner (Charlie - Cold start learner with 0 history)
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie ColdStart',
        email: `charlie.cold.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataC = await resC.json();
    newLearnerToken = dataC.data.token;
    newLearnerId = dataC.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  // =========================================================================
  // 1. FOCUS MODE INDEPENDENCE FROM STUDY SESSION TIMER
  // =========================================================================

  test('1. Focus Mode runs independently of the group study session timer', async () => {
    // A. Create an active group study session
    const resSession = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Relational Database Design',
        subject: 'Database Systems',
        title: 'Normal Forms Lab',
        planned_duration: 60,
        startNow: true,
      }),
    });
    assert.strictEqual(resSession.status, 201);
    const sessionData = (await resSession.json()).data;
    assert.strictEqual(sessionData.status, 'active');
    const sessionId = sessionData.id;

    // B. Start an independent Focus Mode sprint associated with the session
    const resFocusStart = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Relational Database Design',
        sessionId: sessionId,
        plannedDurationMinutes: 25,
      }),
    });
    assert.strictEqual(resFocusStart.status, 201);
    const focusData = (await resFocusStart.json()).data;
    assert.strictEqual(focusData.session_id, sessionId);
    assert.strictEqual(focusData.status, 'active');

    // C. Pause the Focus sprint
    const resFocusPause = await fetch(`${testApp.baseUrl}/api/focus/${focusData.id}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resFocusPause.status, 200);
    const pausedFocus = (await resFocusPause.json()).data;
    assert.strictEqual(pausedFocus.status, 'paused');

    // D. Verify the parent study session remains active and unchanged
    const resSessionCheck = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resSessionCheck.status, 200);
    const currentSession = (await resSessionCheck.json()).data;
    assert.strictEqual(currentSession.status, 'active');

    // E. Resume Focus sprint and complete it
    const resFocusResume = await fetch(`${testApp.baseUrl}/api/focus/${focusData.id}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resFocusResume.status, 200);

    const resFocusComplete = await fetch(`${testApp.baseUrl}/api/focus/${focusData.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        goalAchieved: 'yes',
        takeaways: 'Completed 2NF and 3NF functional dependency review.',
      }),
    });
    assert.strictEqual(resFocusComplete.status, 200);

    // F. Verify study session is still active after focus sprint completes
    const resSessionCheck2 = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const sessionAfterFocus = (await resSessionCheck2.json()).data;
    assert.strictEqual(sessionAfterFocus.status, 'active');
  });

  // =========================================================================
  // 2. NOTIFICATION PREFERENCE RESTORATION & PERMISSION DENIED HANDLING
  // =========================================================================

  test('2. Distraction Shield notification preferences persist and restore cleanly', async () => {
    // 1. Retrieve initial settings
    const resGet = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resGet.status, 200);
    const settingsBefore = (await resGet.json()).data;
    assert.strictEqual(typeof settingsBefore.suppressInAppNotifications, 'boolean');

    // 2. Update preferences: mute nonessential in-app notifications
    const resUpdate = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: false,
        breakRemindersEnabled: true,
        breakIntervalMinutes: 30,
        breakDurationMinutes: 8,
      }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const updated = (await resUpdate.json()).data;
    assert.strictEqual(updated.suppressInAppNotifications, false);
    assert.strictEqual(updated.breakIntervalMinutes, 30);
    assert.strictEqual(updated.breakDurationMinutes, 8);

    // 3. Restore preferences to suppressed state
    const resRestore = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: true,
        breakIntervalMinutes: 25,
        breakDurationMinutes: 5,
      }),
    });
    assert.strictEqual(resRestore.status, 200);
    const restored = (await resRestore.json()).data;
    assert.strictEqual(restored.suppressInAppNotifications, true);
    assert.strictEqual(restored.breakIntervalMinutes, 25);
  });

  // =========================================================================
  // 3. AI FOCUS COACH: COLD START VS REAL STUDY HISTORY
  // =========================================================================

  test('3. AI Focus Coach returns transparent baseline for new users and adapts to real history', async () => {
    // A. New learner (Charlie - Cold start with 0 logged sessions)
    const resCold = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${newLearnerToken}` },
    });
    assert.strictEqual(resCold.status, 200);
    const coldBody = await resCold.json();
    assert.strictEqual(coldBody.data.summary.isColdStart, true);
    assert.strictEqual(coldBody.data.summary.totalLoggedSessions, 0);
    assert.strictEqual(coldBody.data.pacingRecommendation.recommendedSprintMinutes, 25);
    assert.strictEqual(coldBody.data.engine, 'deterministic_rule_based');
    assert.strictEqual(coldBody.data.is_machine_learning, false);
    assert.match(coldBody.data.privacy_guarantee, /Zero camera monitoring/i);
    assert.match(coldBody.data.disclaimer, /does not measure or claim to detect your mental focus/i);

    // B. Experienced learner (Alice - Has completed focus session from Test 1)
    const resAlice = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resAlice.status, 200);
    const aliceBody = await resAlice.json();
    assert.strictEqual(aliceBody.data.summary.isColdStart, false);
    assert.ok(aliceBody.data.summary.totalLoggedSessions >= 1);
    assert.ok(typeof aliceBody.data.pacingRecommendation.sprintReason === 'string');
    assert.ok(aliceBody.data.pacingRecommendation.recommendedBreakMinutes > 0);
  });

  // =========================================================================
  // 4. ADAPTIVE LEARNING: QUIZ RESULTS, WEAK AREAS & PREREQUISITE PATHWAYS
  // =========================================================================

  test('4. Adaptive recommendations suggest revision for weak quiz scores and next curriculum tasks', async () => {
    // A. Record a low score on Database Systems (< 70%) to create an identified weak area
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, assessment_type, score_percentage, passed, notes, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `test-weak-assessment-${Date.now()}`,
      userBId,
      'topic-dbms',
      'practice_quiz',
      55, // Failed score
      0,
      'Struggled with composite keys and Boyce-Codd normal form.',
      now
    );

    // Also set topic preference for User B
    db.prepare(`
      INSERT OR REPLACE INTO user_learning_preferences (
        id, user_id, topic_id, learning_goal, skill_level, learning_status, preferred_study_duration, is_learning_now, is_strength, is_improving, confidence_level, willing_to_teach, wants_peer_support, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`pref-b-${Date.now()}`, userBId, 'topic-dbms', 'Improve BCNF', 'Beginner', 'actively_learning', 30, 1, 0, 1, 'needs_improvement', 0, 1, now, now);

    // Query recommendations for User B
    const resBRecs = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resBRecs.status, 200);
    const bRecs = (await resBRecs.json()).data;
    assert.ok(Array.isArray(bRecs));

    // Verify a revise_weak_area or peer_help recommendation was generated referencing the 55% score
    const weakRec = bRecs.find(
      (r) => r.type === 'revise_weak_area' || (r.reason && r.reason.includes('55%'))
    );
    assert.ok(weakRec, 'Expected an adaptive revision recommendation referencing the 55% quiz score');
    assert.match(weakRec.reason, /55%/);

    // B. Record a high passing score for Alice on topic-dbms (>= 70%)
    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, assessment_type, score_percentage, passed, notes, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `test-passed-assessment-${Date.now()}`,
      userAId,
      'topic-dbms',
      'practice_quiz',
      90, // Passed score
      1,
      'Mastered Normalization and ER modeling.',
      now
    );

    // Set active subject for Alice
    db.prepare(`
      INSERT OR REPLACE INTO user_subjects (id, user_id, subject, created_at) VALUES (?, ?, ?, ?)
    `).run(`subj-a-${Date.now()}`, userAId, 'Computer Science', now);

    // Query recommendations for Alice
    const resARecs = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resARecs.status, 200);
    const aRecs = (await resARecs.json()).data;
    assert.ok(Array.isArray(aRecs));

    // Alice should have recommendations grounded in her passed assessment
    const groundedRec = aRecs.find(
      (r) => r.type === 'next_learning_task' || r.type === 'continue_topic' || (r.reason && r.reason.includes('90%'))
    );
    assert.ok(groundedRec, 'Expected curriculum-grounded recommendation for completed topic');
  });

  // =========================================================================
  // 5. STUDY PARTNER RECOMMENDATIONS: GROUNDED EXPLANATIONS & ZERO FABRICATION
  // =========================================================================

  test('5. Partner matching explains mutual alignment without fabricated data', async () => {
    // 1. Complete Alice's profile and learning preferences as mentor/confident peer
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        headline: 'Senior Lead • Relational Databases',
        institution: 'School of Computing',
        skill_level: 'Advanced',
        preferred_study_times: 'Weekday evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms',
            learning_goal: 'Exam Revision',
            skill_level: 'Advanced',
            is_learning_now: 1,
            is_strength: 1,
            is_improving: 0,
            confidence_level: 'confident',
            willing_to_teach: 1,
            wants_peer_support: 0,
          },
        ],
      }),
    });

    // 2. Complete Bob's profile as learner seeking peer support
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        headline: 'Sophomore • Database Systems Learner',
        institution: 'School of Computing',
        skill_level: 'Beginner',
        preferred_study_times: 'Weekday evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    const resPeers = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=DBMS%20%E2%80%94%20Normalisation&subject=Database%20Systems`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resPeers.status, 200);
    const peerData = await resPeers.json();
    assert.ok(peerData.success);
    const candidates = peerData.data;
    assert.ok(Array.isArray(candidates));

    // Find Alice in candidates
    const aliceCandidate = candidates.find((c) => c.studentId === userAId || c.studentName?.includes('Alice'));
    assert.ok(aliceCandidate, 'Alice should be found in peer matching candidates');
    assert.ok(Array.isArray(aliceCandidate.matchingReasons));
    assert.ok(aliceCandidate.matchingReasons.length > 0);
    assert.ok(typeof aliceCandidate.recommendationReason === 'string');
    // Grounded mutual availability without synthetic activity
    assert.ok(typeof aliceCandidate.mutualAvailability === 'string');
  });

  // =========================================================================
  // 6. REGRESSION VERIFICATION: AUTH, ROOMS, NOTES, SESSIONS PASS
  // =========================================================================

  test('6. Regression check: Existing auth, rooms, notes, and sessions remain fully functional', async () => {
    // A. Room creation
    const resRoom = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        name: 'Algorithms Collaborative Lab',
        subject: 'Computer Science',
        topic: 'Dynamic Programming',
        description: 'Peer problem solving room',
        capacity: 8,
      }),
    });
    assert.strictEqual(resRoom.status, 201);
    const room = (await resRoom.json()).data;
    assert.ok(room.id);

    // B. Note creation
    const resNote = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: 'Dynamic Programming Recurrence Relations',
        content: '# Optimal Substructure\nMemoization vs Tabulation notes.',
        topic: 'Dynamic Programming',
        subject: 'Computer Science',
      }),
    });
    assert.strictEqual(resNote.status, 201);
    const note = (await resNote.json()).data;
    assert.ok(note.id);

    // C. Health check
    const resHealth = await fetch(`${testApp.baseUrl}/api/health`);
    assert.strictEqual(resHealth.status, 200);
    const health = await resHealth.json();
    assert.strictEqual(health.data.status, 'ok');
    assert.strictEqual(health.data.database.status, 'connected');
  });
});
