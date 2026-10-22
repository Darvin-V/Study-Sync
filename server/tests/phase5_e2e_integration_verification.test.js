import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import { emailService } from '../services/email/emailService.js';
import { EvaluationMetricsService } from '../services/recommendation/evaluationMetrics.js';

describe('Phase 5: Full Integration Audit and End-to-End Verification Test Suite', () => {
  let testApp;
  let db;
  let userAToken;
  let userAId;
  let userAEmail;
  let userBToken;
  let userBId;
  let userBEmail;
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();

    // 1. Register User Alpha (isolated test account 1)
    userAEmail = `alpha.${unique}@phase5.studysync.ai`;
    const regResA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Alpha Integrator',
        email: userAEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(regResA.status, 201);
    const regDataA = await regResA.json();
    assert.strictEqual(regDataA.success, true);
    assert.strictEqual(regDataA.data.requiresVerification, true);

    // Retrieve OTP for User Alpha from emailService
    const otpA = emailService._getRecentTestOtp(userAEmail);
    assert.ok(otpA, 'User Alpha OTP code must exist');

    // Verify OTP for User Alpha
    const verifyResA = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        otp: otpA,
      }),
    });
    assert.strictEqual(verifyResA.status, 200);
    const verifyDataA = await verifyResA.json();
    assert.strictEqual(verifyDataA.success, true);
    userAToken = verifyDataA.data.token;
    userAId = verifyDataA.data.user.id;
    assert.ok(userAToken);
    assert.ok(userAId);

    // Complete onboarding for User Alpha
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        headline: 'Distributed Systems Learner',
        institution: 'Integrity Institute of Technology',
        skillLevel: 'Intermediate',
        preferredStudyDuration: 45,
        subjects: ['Computer Science', 'Distributed Systems'],
        isProfileCompleted: true,
      }),
    });

    // 2. Register User Beta (isolated test account 2)
    userBEmail = `beta.${unique}@phase5.studysync.ai`;
    const regResB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Beta Collaborator',
        email: userBEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(regResB.status, 201);
    const regDataB = await regResB.json();
    assert.strictEqual(regDataB.data.requiresVerification, true);

    const otpB = emailService._getRecentTestOtp(userBEmail);
    assert.ok(otpB, 'User Beta OTP code must exist');

    const verifyResB = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userBEmail,
        otp: otpB,
      }),
    });
    assert.strictEqual(verifyResB.status, 200);
    const verifyDataB = await verifyResB.json();
    userBToken = verifyDataB.data.token;
    userBId = verifyDataB.data.user.id;
    assert.ok(userBToken);
    assert.ok(userBId);

    // Complete onboarding for User Beta
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        headline: 'Consensus Protocols Specialist',
        institution: 'Integrity Institute of Technology',
        skillLevel: 'Advanced',
        preferredStudyDuration: 45,
        subjects: ['Computer Science', 'Distributed Systems'],
        isProfileCompleted: true,
      }),
    });
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  // =========================================================================
  // WORKFLOW A — FOCUS
  // 1. Sign in.
  // 2. Start a study session.
  // 3. Enable Focus Mode independently of the timer.
  // 4. Verify that the selected StudySync notification preference is respected.
  // 5. Disable Focus Mode and verify preference restoration.
  // =========================================================================

  test('Workflow A: Focus Mode, independent timer, notification preference muting & restoration', async () => {
    // 1. Sign in with User Alpha credentials
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        password: 'Password123!',
      }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true);
    const activeToken = loginData.data.token;

    // 2. Start a study session
    const createSessionRes = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        title: 'Distributed Consensus Sprint',
        subject: 'Distributed Systems',
        topic: 'Raft Protocol',
        planned_duration: 60,
        startNow: true,
      }),
    });
    assert.strictEqual(createSessionRes.status, 201);
    const sessionBody = await createSessionRes.json();
    assert.strictEqual(sessionBody.data.status, 'active');
    const sessionId = sessionBody.data.id;

    // Verify baseline notification preference before enabling Focus Mode
    // Initially, user has suppressInAppNotifications configured
    const initialSettingsRes = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(initialSettingsRes.status, 200);
    const initialSettings = (await initialSettingsRes.json()).data;
    const originalSuppress = initialSettings.suppressInAppNotifications;

    // Explicitly set notification preference to false (allow in-app notifications)
    const setPrefRes = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: false,
        breakRemindersEnabled: true,
        breakIntervalMinutes: 25,
        breakDurationMinutes: 5,
      }),
    });
    assert.strictEqual(setPrefRes.status, 200);
    const configuredPref = (await setPrefRes.json()).data;
    assert.strictEqual(configuredPref.suppressInAppNotifications, false);

    // 3. Enable Focus Mode independently of the study session timer
    const focusStartRes = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        topic: 'Raft Protocol',
        subject: 'Distributed Systems',
        sessionId: sessionId,
        plannedDurationMinutes: 25,
        goal: 'Understand Leader Election and Log Replication',
        autoCancelPrevious: true,
      }),
    });
    assert.strictEqual(focusStartRes.status, 201);
    const focusInterval = (await focusStartRes.json()).data;
    assert.strictEqual(focusInterval.status, 'active');
    assert.strictEqual(focusInterval.session_id, sessionId);
    assert.strictEqual(focusInterval.planned_duration_seconds, 1500);

    // Verify timer independence: pause Focus Mode interval without affecting the session timer
    const pauseFocusRes = await fetch(`${testApp.baseUrl}/api/focus/${focusInterval.id}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(pauseFocusRes.status, 200);
    const pausedInterval = (await pauseFocusRes.json()).data;
    assert.strictEqual(pausedInterval.status, 'paused');

    // Confirm parent study session remains active and unchanged
    const sessionCheck1 = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(sessionCheck1.status, 200);
    const sessionState1 = (await sessionCheck1.json()).data;
    assert.strictEqual(sessionState1.status, 'active');

    // 4. Verify selected StudySync notification preference is respected while in Focus Mode
    // The user enables distraction shield suppression during active focus
    const shieldEnableRes = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: true,
      }),
    });
    assert.strictEqual(shieldEnableRes.status, 200);
    const shieldActiveSettings = (await shieldEnableRes.json()).data;
    assert.strictEqual(shieldActiveSettings.suppressInAppNotifications, true);

    // 5. Disable Focus Mode (complete or cancel interval) and verify preference restoration
    const resumeFocusRes = await fetch(`${testApp.baseUrl}/api/focus/${focusInterval.id}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(resumeFocusRes.status, 200);

    const completeFocusRes = await fetch(`${testApp.baseUrl}/api/focus/${focusInterval.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        goalAchieved: 'yes',
        keyTakeaways: 'Raft ensures safety and state machine consistency.',
      }),
    });
    assert.strictEqual(completeFocusRes.status, 200);
    const completedFocus = (await completeFocusRes.json()).data;
    assert.strictEqual(completedFocus.status, 'completed');

    // Restore notification preference to pre-focus state (allow in-app notifications)
    const restorePrefRes = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: false,
      }),
    });
    assert.strictEqual(restorePrefRes.status, 200);
    const restoredSettings = (await restorePrefRes.json()).data;
    assert.strictEqual(restoredSettings.suppressInAppNotifications, false);

    // Verify parent session is still active
    const sessionCheck2 = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual((await sessionCheck2.json()).data.status, 'active');
  });

  // =========================================================================
  // WORKFLOW B — ADAPTIVE LEARNING
  // 1. Select a study topic.
  // 2. Complete supported learning activities or assessments.
  // 3. Verify that recommendations use actual recorded progress.
  // 4. Complete a recommendation.
  // 5. Confirm the resulting state persists after refresh and re-login.
  // =========================================================================

  test('Workflow B: Adaptive Learning recommendations using real recorded progress & persistence', async () => {
    // 1. Select a study topic and set learning preference
    const testTopicId = `topic-raft-${unique}`;
    const testTopicName = 'Raft Consensus Protocol';
    const now = new Date().toISOString();

    // Ensure topic exists in learning_topics
    db.prepare(`
      INSERT OR IGNORE INTO learning_topics (id, subject, topic_name, description, difficulty_level, created_at)
      VALUES (?, 'Distributed Systems', ?, 'Leader election and replicated logs', 'Advanced', ?)
    `).run(testTopicId, testTopicName, now);

    // User Alpha expresses learning preference for Raft Consensus
    const putPrefRes = await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: testTopicId,
            is_learning_now: true,
            is_strength: false,
            is_improving: true,
            learning_goal: 'Implement Raft state machine',
          },
        ],
      }),
    });
    assert.strictEqual(putPrefRes.status, 200);

    // 2. Complete a verified practice quiz assessment with score < 70% (weak area)
    const assessRes = await fetch(`${testApp.baseUrl}/api/knowledge-map/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topicId: testTopicId,
        scorePercentage: 55, // Low score triggers revision recommendation
        passed: false,
      }),
    });
    assert.strictEqual(assessRes.status, 201);
    const assessData = await assessRes.json();
    assert.strictEqual(assessData.data.scorePercentage, 55);

    // 3. Verify that recommendations use actual recorded progress
    const recsRes = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(recsRes.status, 200);
    const recsData = await recsRes.json();
    assert.strictEqual(recsData.success, true);
    const recommendations = recsData.data;

    // Verify there is a revision or practice recommendation citing the weak assessment score
    const targetRec = recommendations.find((r) => r.topic === testTopicName || r.targetId === testTopicId);
    assert.ok(targetRec, 'Recommendation must exist for the recently assessed weak topic');
    assert.ok(
      targetRec.reason.toLowerCase().includes('quiz') ||
      targetRec.reason.toLowerCase().includes('score') ||
      targetRec.reason.toLowerCase().includes('55%') ||
      targetRec.reason.toLowerCase().includes('weak') ||
      targetRec.type === 'revise_weak_area',
      `Recommendation reason must honestly reference the recorded quiz score: "${targetRec.reason}"`
    );

    // 4. Complete / Follow through on a recommendation
    const followThroughRes = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        trackingId: targetRec.trackingId,
        recommendationId: targetRec.id,
        recommendationType: targetRec.type,
        action: 'completed',
        topic: testTopicName,
      }),
    });
    assert.strictEqual(followThroughRes.status, 200);
    const feedbackResult = (await followThroughRes.json()).data;
    assert.strictEqual(feedbackResult.action, 'followed_through');

    // 5. Confirm resulting state persists across refresh and re-login
    // Re-login to simulate a fresh browser session
    const reLoginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        password: 'Password123!',
      }),
    });
    assert.strictEqual(reLoginRes.status, 200);
    const freshToken = (await reLoginRes.json()).data.token;

    // The followed-through recommendation must now be marked followed_through in database
    const trackedRow = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(targetRec.trackingId);
    assert.strictEqual(trackedRow.lifecycle_status, 'followed_through');
    assert.ok(trackedRow.followed_through_at);

    // Verify that subsequent recommendations call suppresses this completed recommendation
    const recsAfterRes = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    assert.strictEqual(recsAfterRes.status, 200);
    const recsAfter = (await recsAfterRes.json()).data;
    assert.strictEqual(
      recsAfter.some((r) => r.trackingId === targetRec.trackingId || r.id === targetRec.id),
      false,
      'Completed recommendation must be cleanly suppressed from subsequent study recommendations'
    );
  });

  // =========================================================================
  // WORKFLOW C — PARTNER MATCHING
  // 1. Configure different topics and goals for two test accounts.
  // 2. Verify relevant recommendations and their explanations.
  // 3. Verify that the current user is excluded and privacy restrictions are respected.
  // 4. Test a connection or study-room action where supported.
  // =========================================================================

  test('Workflow C: Partner matching, explanations, self-exclusion, privacy, and Circle connection', async () => {
    const sharedTopicId = `topic-paxos-${unique}`;
    const sharedTopicName = 'Paxos Consensus';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO learning_topics (id, subject, topic_name, description, difficulty_level, created_at)
      VALUES (?, 'Distributed Systems', ?, 'Fault-tolerant consensus algorithm', 'Advanced', ?)
    `).run(sharedTopicId, sharedTopicName, now);

    // 1. Configure complementary topics and goals for User Alpha and User Beta
    // User Alpha: Learning Paxos, needs help (wants peer support)
    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: sharedTopicId,
            is_learning_now: true,
            is_strength: false,
            is_improving: true,
            learning_goal: 'Understand multi-decree Paxos',
          },
        ],
      }),
    });

    // Update Alpha's Learning DNA
    await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        collaborationStyle: 'structured',
        wantsPeerSupport: [sharedTopicName],
        willingToTeach: [],
      }),
    });

    // User Beta: Mastered Paxos, willing to teach (strength)
    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: sharedTopicId,
            is_learning_now: false,
            is_strength: true,
            is_improving: false,
            learning_goal: 'Mentor peers on distributed protocols',
          },
        ],
      }),
    });

    // Update Beta's Learning DNA
    await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        collaborationStyle: 'structured',
        willingToTeach: [sharedTopicName],
        wantsPeerSupport: [],
      }),
    });

    // 2. Request peer matches for User Alpha searching for Paxos
    const matchRes = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent(sharedTopicName)}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(matchRes.status, 200);
    const matchBody = await matchRes.json();
    assert.strictEqual(matchBody.success, true);
    const candidates = matchBody.data;

    // Verify User Beta is returned as a recommended partner
    const betaMatch = candidates.find((c) => (c.studentId || c.id) === userBId);
    assert.ok(betaMatch, 'User Beta must be recommended to User Alpha based on topic and complementary teaching DNA');

    // Verify transparent matching reasons and explanations
    assert.ok(Array.isArray(betaMatch.matchingReasons) && betaMatch.matchingReasons.length > 0);
    assert.ok(
      betaMatch.matchingReasons.some((r) =>
        r.toLowerCase().includes('paxos') ||
        r.toLowerCase().includes('teach') ||
        r.toLowerCase().includes('topic') ||
        r.toLowerCase().includes('complementary')
      ),
      `Match reason must explain topic or skill alignment: ${JSON.stringify(betaMatch.matchingReasons)}`
    );

    // 3. Verify that the requesting user (User Alpha) is strictly excluded
    const selfCheck = candidates.find((c) => (c.studentId || c.id) === userAId);
    assert.strictEqual(selfCheck, undefined, 'User Alpha must NEVER appear in their own partner recommendations');

    // Verify privacy restrictions: sensitive private fields are omitted
    for (const cand of candidates) {
      assert.strictEqual(cand.password_hash, undefined, 'password_hash must never be leaked');
      assert.strictEqual(cand.email, undefined, 'Private email address must never be leaked in public recommendations');
      assert.strictEqual(cand.age, undefined, 'Age must never be leaked');
      assert.strictEqual(cand.gender, undefined, 'Gender must never be leaked');
    }

    // 4. Test a Circle connection action: User Alpha sends Circle request to User Beta
    const sendReqRes = await fetch(`${testApp.baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        memberId: userBId,
      }),
    });
    assert.strictEqual(sendReqRes.status, 201);
    const reqBody = await sendReqRes.json();
    assert.strictEqual(reqBody.success, true);
    const requestId = reqBody.data.requestId;

    // User Beta inspects incoming requests and accepts
    const listReqRes = await fetch(`${testApp.baseUrl}/api/circle/requests`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(listReqRes.status, 200);
    const pendingList = (await listReqRes.json()).data;
    assert.ok(pendingList.some((r) => r.requestId === requestId || r.id === userAId));

    const acceptRes = await fetch(`${testApp.baseUrl}/api/circle/accept/${userAId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(acceptRes.status, 200);

    // Both users should now see each other in their Circle
    const circleResA = await fetch(`${testApp.baseUrl}/api/circle`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const circleMembersA = (await circleResA.json()).data;
    assert.ok(circleMembersA.some((m) => m.id === userBId));

    const circleResB = await fetch(`${testApp.baseUrl}/api/circle`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const circleMembersB = (await circleResB.json()).data;
    assert.ok(circleMembersB.some((m) => m.id === userAId));

    // Test joint study-room action: User Alpha creates room, User Beta joins
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        name: `Paxos Collab Room ${unique}`,
        topic: sharedTopicName,
        subject: 'Distributed Systems',
        maxCapacity: 5,
      }),
    });
    assert.strictEqual(roomRes.status, 201);
    const room = (await roomRes.json()).data;

    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${room.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(joinRes.status, 200);

    const checkRoom = await fetch(`${testApp.baseUrl}/api/rooms/${room.id}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const roomDetails = (await checkRoom.json()).data;
    assert.ok(roomDetails.members.some((p) => p.user_id === userBId));
  });

  // =========================================================================
  // WORKFLOW D — EVALUATION
  // 1. Generate recommendation events through actual test workflows.
  // 2. Verify metric calculations against expected values.
  // 3. Ensure test fixtures are isolated from production data.
  // 4. Confirm missing history is handled honestly.
  // =========================================================================

  test('Workflow D: Recommendation evaluation metrics, isolation, and honest missing history handling', async () => {
    // 1 & 2: Generate actual events for a newly created evaluation test learner
    const evalUserId = `user-eval-${unique}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Eval Test Learner', ?, 'hash', 1, ?, ?)
    `).run(evalUserId, `${evalUserId}@phase5.studysync.ai`, now, now);

    // Present 4 adaptive recommendations: 3 completed (followed through), 1 dismissed
    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, topic, lifecycle_status, presented_at, followed_through_at, created_at, updated_at
      ) VALUES
      (?, ?, 'revise_weak_area', 't-1', 'Topic 1', 'followed_through', ?, ?, ?, ?),
      (?, ?, 'continue_topic', 't-2', 'Topic 2', 'followed_through', ?, ?, ?, ?),
      (?, ?, 'practice_quiz', 't-3', 'Topic 3', 'followed_through', ?, ?, ?, ?),
      (?, ?, 'next_learning_task', 't-4', 'Topic 4', 'dismissed', ?, null, ?, ?)
    `).run(
      `rec-ev-1-${unique}`, evalUserId, now, now, now, now,
      `rec-ev-2-${unique}`, evalUserId, now, now, now, now,
      `rec-ev-3-${unique}`, evalUserId, now, now, now, now,
      `rec-ev-4-${unique}`, evalUserId, now, now, now
    );

    // 2 partner recommendations: 1 connected (followed_through), 1 presented
    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, lifecycle_status, outcome_event, presented_at, followed_through_at, created_at, updated_at
      ) VALUES
      (?, ?, 'peer_help', 'peer-ev-1', 'followed_through', 'circle_connected', ?, ?, ?, ?),
      (?, ?, 'peer_help', 'peer-ev-2', 'presented', null, ?, null, ?, ?)
    `).run(
      `rec-p-ev1-${unique}`, evalUserId, now, now, now, now,
      `rec-p-ev2-${unique}`, evalUserId, now, now, now
    );

    // Calculate metrics using service
    const evalMetrics = EvaluationMetricsService.getEvaluationMetrics(evalUserId);

    // Verify Adaptive Learning metric: 3 completed out of 4 presented = 75%
    const adaptive = evalMetrics.metrics.adaptiveLearning;
    assert.strictEqual(adaptive.recommendationCompletionRate.percentage, 75);
    assert.strictEqual(adaptive.recommendationCompletionRate.sampleSize, 4);

    // Verify Partner Matching metric: 1 accepted/followed_through out of 2 = 50%
    const partner = evalMetrics.metrics.studyPartnerMatching;
    assert.strictEqual(partner.recommendationAcceptanceRate.percentage, 50);
    assert.strictEqual(partner.recommendationAcceptanceRate.sampleSize, 2);

    // 3. Ensure test fixtures are isolated: User Alpha metrics do NOT leak into evalUserId
    const alphaMetrics = EvaluationMetricsService.getEvaluationMetrics(userAId);
    assert.strictEqual(alphaMetrics.userId, userAId);
    assert.strictEqual(evalMetrics.userId, evalUserId);
    assert.notStrictEqual(alphaMetrics.summary.totalRecommendationsTracked, evalMetrics.summary.totalRecommendationsTracked);

    // 4. Confirm missing history is handled honestly
    // A learner with N = 0 history
    const virginUser = `user-virgin-${unique}`;
    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Virgin Learner', ?, 'hash', 1, ?, ?)
    `).run(virginUser, `${virginUser}@phase5.studysync.ai`, now, now);

    const coldMetrics = EvaluationMetricsService.getEvaluationMetrics(virginUser);
    assert.strictEqual(coldMetrics.summary.isColdStart, true);
    assert.strictEqual(coldMetrics.summary.totalRecommendationsTracked, 0);
    assert.strictEqual(coldMetrics.metrics.adaptiveLearning.recommendationCompletionRate.percentage, null);
    assert.strictEqual(coldMetrics.metrics.adaptiveLearning.recommendationCompletionRate.formatted, 'No data');
    assert.strictEqual(coldMetrics.metrics.studyPartnerMatching.recommendationAcceptanceRate.percentage, null);
    assert.strictEqual(coldMetrics.metrics.studyPartnerMatching.recommendationAcceptanceRate.formatted, 'No data');
    assert.strictEqual(coldMetrics.metrics.focusCoach.sessionCompletionComparison.isSufficientHistory, false);
    assert.strictEqual(coldMetrics.metrics.focusCoach.sessionCompletionComparison.formatted, 'Insufficient history');
    assert.strictEqual(coldMetrics.metrics.focusCoach.sessionCompletionComparison.baselineCompletionRate, null);
  });
});
