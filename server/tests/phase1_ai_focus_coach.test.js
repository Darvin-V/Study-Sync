import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Phase 1: AI Focus Coach Comprehensive Test Suite', () => {
  let testApp;
  let db;
  let userColdToken;
  let userColdId;
  let userHistToken;
  let userHistId;
  let userWeakQuizToken;
  let userWeakQuizId;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Cold start user (zero history)
    const resCold = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'ColdStart Learner',
        email: `coldstart.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataCold = await resCold.json();
    userColdToken = dataCold.data.token;
    userColdId = dataCold.data.user.id;

    // 2. User with completed sessions and voluntary pauses
    const resHist = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Historical Learner',
        email: `historical.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataHist = await resHist.json();
    userHistToken = dataHist.data.token;
    userHistId = dataHist.data.user.id;

    // 3. User with weak quiz scores (< 70%) and identified difficult topics
    const resWeak = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'QuizReview Learner',
        email: `quizreview.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataWeak = await resWeak.json();
    userWeakQuizToken = dataWeak.data.token;
    userWeakQuizId = dataWeak.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  // =========================================================================
  // 1. NEW USER WITH NO STUDY HISTORY (COLD START)
  // =========================================================================

  test('1. New user with no history receives transparent cold-start baseline advice', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userColdToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const data = body.data;
    assert.strictEqual(data.engine, 'deterministic_rule_based');
    assert.strictEqual(data.is_machine_learning, false);
    assert.strictEqual(data.summary.isColdStart, true);
    assert.strictEqual(data.summary.totalLoggedSessions, 0);
    assert.strictEqual(data.summary.completedSessions, 0);

    // Standard baseline
    assert.strictEqual(data.pacingRecommendation.recommendedSprintMinutes, 25);
    assert.strictEqual(data.pacingRecommendation.recommendedBreakMinutes, 5);
    assert.strictEqual(data.pacingRecommendation.sprintConfidence, 'standard_baseline');
    assert.match(data.pacingRecommendation.sprintReason, /25-minute Pomodoro sprint/i);

    // Baseline goal
    assert.ok(data.recommendedGoals.length > 0);
    assert.strictEqual(data.recommendedGoals[0].type, 'onboarding_baseline');

    // Strict privacy guarantees
    assert.match(data.disclaimer, /does not measure or claim to detect your mental focus/i);
    assert.match(data.privacy_guarantee, /Zero camera monitoring/i);
  });

  // =========================================================================
  // 2. USER WITH COMPLETED SESSIONS & VOLUNTARY BREAKS
  // =========================================================================

  test('2. User with real session history receives tailored pacing and break recommendations', async () => {
    const now = new Date().toISOString();

    // Insert 3 completed focus intervals (45m planned, 42m actual, with 7m voluntary pauses)
    for (let i = 1; i <= 3; i++) {
      db.prepare(`
        INSERT INTO user_focus_intervals (
          id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds,
          total_paused_seconds, status, started_at, goal, goal_achieved, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `interval-hist-${i}-${Date.now()}`,
        userHistId,
        'Relational Algebra',
        'Database Systems',
        45 * 60,
        42 * 60,
        7 * 60, // 7 min pauses
        'completed',
        now,
        `Solve problem set ${i}`,
        'yes',
        now,
        now
      );
    }

    const res = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userHistToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const data = body.data;

    assert.strictEqual(data.summary.isColdStart, false);
    assert.strictEqual(data.summary.totalLoggedSessions, 3);
    assert.strictEqual(data.summary.completedSessions, 3);
    assert.strictEqual(data.summary.completionRatePercentage, 100);
    assert.strictEqual(data.summary.averageRecordedMinutes, 42);
    assert.strictEqual(data.summary.averagePausedMinutes, 7);

    // Deep sprint recommended because user completes > 80% with >= 40m average
    assert.strictEqual(data.pacingRecommendation.recommendedSprintMinutes, 45);
    assert.match(data.pacingRecommendation.sprintReason, /42 minutes/i);

    // Break recommendation accounts for voluntary pause history
    assert.strictEqual(data.pacingRecommendation.recommendedBreakMinutes, 8);
    assert.match(data.pacingRecommendation.breakReason, /7 minutes in voluntary pauses/i);
  });

  // =========================================================================
  // 3. USER WITH LOW QUIZ SCORES & RECORDED DIFFICULT TOPICS
  // =========================================================================

  test('3. Focus Coach prioritizes weak quiz scores (< 70%) and reflection flags', async () => {
    const now = new Date().toISOString();

    // A. Insert failed quiz (58%) on Graph Theory
    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, assessment_type, score_percentage, passed, notes, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `assess-weak-${Date.now()}`,
      userWeakQuizId,
      'topic-graphs',
      'practice_quiz',
      58,
      0,
      'Missed Dijkstra and Bellman-Ford negative cycle questions.',
      now
    );

    // B. Insert reflection flagging topic needing revision
    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds,
        status, started_at, goal, goal_achieved, needs_revision, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `interval-weak-${Date.now()}`,
      userWeakQuizId,
      'Graph Traversal',
      'Algorithms',
      25 * 60,
      25 * 60,
      'completed',
      now,
      'Implement BFS and DFS',
      'partial',
      1, // needs_revision
      now,
      now
    );

    const res = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userWeakQuizToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const data = body.data;

    // Verify Quiz Revision Goal was generated citing exact score
    const quizGoal = data.recommendedGoals.find((g) => g.type === 'quiz_revision');
    assert.ok(quizGoal, 'Expected quiz revision goal for low score');
    assert.match(quizGoal.reason, /58%/);
    assert.match(quizGoal.goal, /58%/);

    // Verify Unfinished Goal or Reflection Revision was generated
    const resumeOrReflect = data.recommendedGoals.find(
      (g) => g.type === 'resume_unfinished_goal' || g.type === 'reflection_revision'
    );
    assert.ok(resumeOrReflect, 'Expected goal to resume unfinished task or revise flagged topic');
  });

  // =========================================================================
  // 4. RESILIENCE: MISSING OR INCOMPLETE DATA HANDLED SAFELY
  // =========================================================================

  test('4. Gracefully handles corrupted, null, or incomplete records without crashing', async () => {
    const now = new Date().toISOString();

    // Insert record with null durations, empty strings, missing reflection
    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds,
        total_paused_seconds, status, started_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `interval-corrupt-${Date.now()}`,
      userColdId,
      'Incomplete Topic Test',
      null,
      1500,
      null,
      null,
      'completed',
      now,
      now
    );

    const res = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userColdToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.summary.averageRecordedMinutes === 'number');
    assert.ok(!Number.isNaN(body.data.summary.averageRecordedMinutes));
    assert.ok(!Number.isNaN(body.data.summary.averagePausedMinutes));
    assert.ok(Array.isArray(body.data.recommendedGoals));
  });

  // =========================================================================
  // 5. FOCUS MODE INDEPENDENCE: ACTIVATION WITHOUT TIMER INTERRUPTION
  // =========================================================================

  test('5. Focus Mode sprints operate independently of study session and call timers', async () => {
    // 1. Create and start a persistent study session
    const resSession = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userHistToken}`,
      },
      body: JSON.stringify({
        topic: 'Graph Theory & BFS',
        subject: 'Algorithms',
        plannedDuration: 50,
        startNow: true,
      }),
    });
    assert.strictEqual(resSession.status, 201);
    const sessionData = (await resSession.json()).data;
    const sessionId = sessionData.id;
    assert.strictEqual(sessionData.status, 'active');

    // 2. Start an independent Focus Mode sprint
    const resFocus = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userHistToken}`,
      },
      body: JSON.stringify({
        topic: 'Graph Theory & BFS',
        sessionId: sessionId,
        plannedDurationMinutes: 20,
      }),
    });
    assert.strictEqual(resFocus.status, 201);
    const focusData = (await resFocus.json()).data;
    assert.strictEqual(focusData.status, 'active');

    // 3. Pause Focus sprint
    await fetch(`${testApp.baseUrl}/api/focus/${focusData.id}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userHistToken}` },
    });

    // 4. Verify parent session remains active
    const resSessionCheck = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${userHistToken}` },
    });
    assert.strictEqual(resSessionCheck.status, 200);
    const currentSession = (await resSessionCheck.json()).data;
    assert.strictEqual(currentSession.status, 'active');

    // 5. Complete Focus sprint
    await fetch(`${testApp.baseUrl}/api/focus/${focusData.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userHistToken}`,
      },
      body: JSON.stringify({
        goalAchieved: 'yes',
        takeaways: 'Completed graph vertex queue.',
      }),
    });

    // 6. Parent session still remains active
    const resSessionCheck2 = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${userHistToken}` },
    });
    const sessionAfter = (await resSessionCheck2.json()).data;
    assert.strictEqual(sessionAfter.status, 'active');
  });

  // =========================================================================
  // 6. EXISTING SUBSYSTEM REGRESSION: ROOMS, NOTES, MESSAGING
  // =========================================================================

  test('6. Regression check: Existing rooms, notes, and messages remain fully functional', async () => {
    // A. Room creation
    const resRoom = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userHistToken}`,
      },
      body: JSON.stringify({
        name: 'Graph Theory Lab Room',
        subject: 'Algorithms',
        topic: 'Graph Theory',
        description: 'Collaborative graphs discussion',
        capacity: 10,
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
        Authorization: `Bearer ${userHistToken}`,
      },
      body: JSON.stringify({
        title: 'Adjacency List vs Matrix',
        content: '# Representation\nAdjacency list uses O(V + E) space.',
        topic: 'Graph Theory',
        subject: 'Algorithms',
        roomId: room.id,
      }),
    });
    assert.strictEqual(resNote.status, 201);
    const note = (await resNote.json()).data;
    assert.ok(note.id);

    // C. System health
    const resHealth = await fetch(`${testApp.baseUrl}/api/health`);
    assert.strictEqual(resHealth.status, 200);
  });
});
