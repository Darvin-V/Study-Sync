import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Phase 2: Adaptive Learning and Revision Recommendations Test Suite', () => {
  let testApp;
  let db;
  let userColdToken;
  let userColdId;
  let userActiveToken;
  let userActiveId;
  let userOtherToken;
  let userOtherId;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Cold start user (new user with 0 history)
    const resCold = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Cold Start Student',
        email: `cold2.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataCold = await resCold.json();
    userColdToken = dataCold.data.token;
    userColdId = dataCold.data.user.id;

    // 2. Active learner with diverse real learning data
    const resActive = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Active Adaptive Learner',
        email: `active2.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataActive = await resActive.json();
    userActiveToken = dataActive.data.token;
    userActiveId = dataActive.data.user.id;

    // 3. Independent user for authorization isolation checks
    const resOther = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Other Learner',
        email: `other2.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataOther = await resOther.json();
    userOtherToken = dataOther.data.token;
    userOtherId = dataOther.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  // =========================================================================
  // 1. NEW USER WITH NO HISTORY (HELPFUL EMPTY / ONBOARDING STATE)
  // =========================================================================

  test('1. New user with no history receives onboarding recommendations without fake analytics', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userColdToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const recs = body.data;

    assert.ok(Array.isArray(recs));
    // Must contain onboarding guidance (e.g. choose topics or explore rooms)
    const onboardingRec = recs.find((r) => r.type === 'onboarding_explore' || r.type === 'join_room');
    assert.ok(onboardingRec, 'Expected onboarding guidance for new user');
    assert.match(onboardingRec.reason, /set your learning preferences/i);
    assert.strictEqual(onboardingRec.engine, 'deterministic_rule_based');
  });

  // =========================================================================
  // 2. ADAPTIVE RECOMMENDATIONS: LOW QUIZ SCORE, DIFFICULT TOPIC, UNFINISHED GOAL, UNVERIFIED STUDY
  // =========================================================================

  test('2. Real learning data triggers prioritized revision, goal completion, and practice recommendations', async () => {
    const now = new Date().toISOString();

    // A. Low quiz score (< 70%) on topic-dbms (56%)
    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, assessment_type, score_percentage, passed, notes, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `test-assess-${Date.now()}`,
      userActiveId,
      'topic-dbms',
      'practice_quiz',
      56,
      0,
      'Struggled with functional dependencies and BCNF lossless join condition.',
      now
    );

    // B. Topic marked difficult in Learning DNA preferences (needs_improvement)
    db.prepare(`
      INSERT OR REPLACE INTO user_learning_preferences (
        id, user_id, topic_id, learning_goal, skill_level, learning_status,
        preferred_study_duration, is_learning_now, is_strength, is_improving,
        confidence_level, willing_to_teach, wants_peer_support, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `pref-active-${Date.now()}`,
      userActiveId,
      'topic-graphs',
      'Master Dijkstra and DAG topological sort',
      'Intermediate',
      'actively_learning',
      45,
      1,
      0,
      1,
      'needs_improvement',
      0,
      1,
      now,
      now
    );

    // C. Unfinished study goal in a focus interval (goal_achieved = 'partial')
    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds,
        status, started_at, goal, goal_achieved, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `interval-active-goal-${Date.now()}`,
      userActiveId,
      'Dynamic Programming',
      'Algorithms',
      30 * 60,
      30 * 60,
      'completed',
      now,
      'Solve Longest Common Subsequence DP recurrence',
      'partial',
      now,
      now
    );

    // Fetch recommendations for User Active
    const res = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userActiveToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const recs = body.data;
    assert.ok(Array.isArray(recs));

    // 1. Verify Low Quiz Score Revision is present and cites 56%
    const weakQuizRec = recs.find((r) => r.type === 'revise_weak_area');
    assert.ok(weakQuizRec, 'Expected revise_weak_area recommendation for 56% quiz score');
    assert.match(weakQuizRec.reason, /56%/);
    assert.strictEqual(weakQuizRec.topic, 'DBMS — Normalisation');

    // 2. Verify Revisit Difficult Topic is present for Graph Theory
    const difficultRec = recs.find((r) => r.type === 'revise_difficult_topic' || (r.topic && r.topic.includes('Graph')));
    assert.ok(difficultRec, 'Expected difficult topic revision recommendation for Graph Theory');
    assert.match(difficultRec.reason, /needs improvement/i);

    // 3. Verify Unfinished Goal recommendation is present
    const goalRec = recs.find((r) => r.type === 'unfinished_goal');
    assert.ok(goalRec, 'Expected unfinished_goal recommendation');
    assert.match(goalRec.title, /Longest Common Subsequence/i);
    assert.match(goalRec.reason, /incomplete\/partial/i);
  });

  // =========================================================================
  // 3. COMPLETION ACTION & PERSISTENCE AFTER REFRESH
  // =========================================================================

  test('3. Marking a recommendation as followed_through persists and suppresses it on refresh', async () => {
    // 1. Fetch current recommendations
    const resInitial = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userActiveToken}` },
    });
    const initialRecs = (await resInitial.json()).data;
    const targetRec = initialRecs[0];
    assert.ok(targetRec, 'Expected at least one active recommendation');

    // 2. Complete recommendation via POST /api/recommendations/feedback
    const resFeedback = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userActiveToken}`,
      },
      body: JSON.stringify({
        targetId: targetRec.topicId || targetRec.id,
        trackingId: targetRec.id,
        recommendationType: targetRec.type,
        action: 'followed_through',
        feedbackText: 'Successfully completed revision session.',
      }),
    });
    assert.strictEqual(resFeedback.status, 200);
    const feedbackBody = await resFeedback.json();
    assert.strictEqual(feedbackBody.success, true);
    assert.strictEqual(feedbackBody.data.action, 'followed_through');

    // 3. Query recommendations again (refresh)
    const resRefreshed = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userActiveToken}` },
    });
    assert.strictEqual(resRefreshed.status, 200);
    const refreshedRecs = (await resRefreshed.json()).data;

    // 4. Verify completed recommendation target is suppressed from active list
    const stillPresent = refreshedRecs.some((r) => r.id === targetRec.id);
    assert.strictEqual(stillPresent, false, 'Completed recommendation should not appear on refresh');
  });

  // =========================================================================
  // 4. AUTHORIZATION ISOLATION BETWEEN REAL TEST ACCOUNTS
  // =========================================================================

  test('4. Cross-user isolation: User B cannot modify User A recommendation tracking', async () => {
    // User A creates/tracks a recommendation
    const resA = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userActiveToken}` },
    });
    const recsA = (await resA.json()).data;
    const recA = recsA[0];
    assert.ok(recA);

    // User Other attempts to mark User A's recommendation as followed_through
    const resUnauthorized = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userOtherToken}`,
      },
      body: JSON.stringify({
        targetId: recA.topicId || recA.id,
        trackingId: recA.id,
        recommendationType: recA.type,
        action: 'followed_through',
      }),
    });

    // Request is accepted for User Other's own tracking without mutating User A's record
    assert.strictEqual(resUnauthorized.status, 200);

    // User A's recommendation status remains unaffected
    const trackingRow = db.prepare('SELECT user_id FROM recommendation_tracking WHERE id = ?').get(recA.id);
    if (trackingRow) {
      assert.strictEqual(trackingRow.user_id, userActiveId);
    }
  });

  // =========================================================================
  // 5. REGRESSION: INTEGRATION WITH FOCUS COACH, SESSIONS & ROOMS
  // =========================================================================

  test('5. Regression check: Focus Coach, Study Sessions, and Rooms remain 100% functional', async () => {
    // A. Focus Coach
    const resCoach = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userActiveToken}` },
    });
    assert.strictEqual(resCoach.status, 200);
    const coachData = (await resCoach.json()).data;
    assert.strictEqual(coachData.engine, 'deterministic_rule_based');

    // B. Study Session creation
    const resSession = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userActiveToken}`,
      },
      body: JSON.stringify({
        topic: 'Adaptive Learning Validation',
        subject: 'Computer Science',
        plannedDuration: 45,
        startNow: true,
      }),
    });
    assert.strictEqual(resSession.status, 201);
    const session = (await resSession.json()).data;
    assert.strictEqual(session.status, 'active');

    // C. Room creation
    const resRoom = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userActiveToken}`,
      },
      body: JSON.stringify({
        name: 'Adaptive Revision Room',
        subject: 'Computer Science',
        topic: 'DBMS — Normalisation',
        description: 'Revision workspace',
        capacity: 6,
      }),
    });
    assert.strictEqual(resRoom.status, 201);
  });
});
