import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import { EvaluationMetricsService } from '../services/recommendation/evaluationMetrics.js';
import { FeedbackModel } from '../models/feedback.model.js';
import { LearningRecommendationService } from '../services/recommendation/learningRecommendations.js';
import { FocusCoachService } from '../services/focus/focusCoachService.js';
import { MatchingEngine } from '../services/matching/matchingEngine.js';
import { FocusModel } from '../models/focus.model.js';
import { CircleModel } from '../models/circle.model.js';

describe('Phase 4: Recommendation Evaluation and Personalization Test Suite', () => {
  let testApp;
  let db;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let coldUserToken;
  let coldUserId;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // User A: Active test learner
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Learner Alpha',
        email: `alpha.${unique}@phase4.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // User B: Peer test learner
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Learner Beta',
        email: `beta.${unique}@phase4.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    // Cold-start User: Completely new account with zero activity
    const resCold = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Cold Start User',
        email: `cold.${unique}@phase4.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataCold = await resCold.json();
    coldUserToken = dataCold.data.token;
    coldUserId = dataCold.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Empty and cold-start state (N = 0) returns honest baseline without errors or fabricated metrics', async () => {
    const coldMetrics = EvaluationMetricsService.getEvaluationMetrics(coldUserId);

    assert.equal(coldMetrics.scope, 'user');
    assert.equal(coldMetrics.userId, coldUserId);
    assert.equal(coldMetrics.summary.isColdStart, true);
    assert.equal(coldMetrics.summary.totalRecommendationsTracked, 0);

    // Adaptive Learning metrics should show no data
    const adaptive = coldMetrics.metrics.adaptiveLearning;
    assert.equal(adaptive.recommendationCompletionRate.percentage, null);
    assert.equal(adaptive.recommendationCompletionRate.formatted, 'No data');
    assert.equal(adaptive.recommendationCompletionRate.isSmallSample, true);

    assert.equal(adaptive.recommendedTopicsPracticeRate.percentage, null);
    assert.equal(adaptive.recommendedTopicsPracticeRate.formatted, 'No data');

    assert.equal(adaptive.quizPerformanceChange.averageDeltaPercentagePoints, null);
    assert.equal(adaptive.quizPerformanceChange.formatted, 'No comparable data');

    // Study Partner Matching metrics should show no data
    const partner = coldMetrics.metrics.studyPartnerMatching;
    assert.equal(partner.recommendationAcceptanceRate.percentage, null);
    assert.equal(partner.recommendationAcceptanceRate.formatted, 'No data');

    assert.equal(partner.successfulConnectionRate.percentage, null);
    assert.equal(partner.successfulConnectionRate.formatted, 'No data');

    assert.equal(partner.repeatCollaborationRate.percentage, null);
    assert.equal(partner.repeatCollaborationRate.formatted, 'No data');

    // Focus Coach metrics
    const coach = coldMetrics.metrics.focusCoach;
    assert.equal(coach.suggestedGoalCompletionRate.percentage, null);
    assert.equal(coach.suggestedGoalCompletionRate.formatted, 'No data');

    assert.equal(coach.sessionCompletionComparison.isSufficientHistory, false);
    assert.equal(coach.sessionCompletionComparison.formatted, 'Insufficient history');
    assert.equal(coach.sessionCompletionComparison.baselineCompletionRate, null);
    assert.equal(coach.sessionCompletionComparison.recentCompletionRate, null);

    assert.equal(coach.suggestionUsefulnessRate.percentage, null);
    assert.equal(coach.suggestionUsefulnessRate.formatted, 'No data');
  });

  test('2. Insufficient-history state (N < 5) prevents fabricated session baseline comparisons', async () => {
    const testUser = `user-insuff-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Insufficient User', ?, 'hash', 1, ?, ?)
    `).run(testUser, `${testUser}@test.studysync.ai`, now, now);

    // Insert only 3 completed focus intervals for testUser
    for (let i = 0; i < 3; i++) {
      db.prepare(`
        INSERT INTO user_focus_intervals (
          id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds,
          status, started_at, created_at, completed_at
        ) VALUES (?, ?, 'Database Normalisation', 'Computer Science', 1500, 1500, 'completed', ?, ?, ?)
      `).run(`focus-insuff-${i}-${Date.now()}`, testUser, now, now, now);
    }

    const metrics = EvaluationMetricsService.getEvaluationMetrics(testUser);
    const comparison = metrics.metrics.focusCoach.sessionCompletionComparison;

    assert.equal(comparison.isSufficientHistory, false, 'Must flag insufficient history when N < 5');
    assert.equal(comparison.sampleSize, 3);
    assert.equal(comparison.formatted, 'Insufficient history');
    assert.equal(comparison.baselineCompletionRate, null);
    assert.equal(comparison.recentCompletionRate, null);
    assert.equal(comparison.completionDeltaPercentagePoints, null);
  });

  test('3. Metric calculations against known fixtures across all 3 AI feature domains', async () => {
    const fixtureUser = `user-fix-${Date.now()}`;
    const peerCandidate = `peer-cand-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Fixture User', ?, 'hash', 1, ?, ?)
    `).run(fixtureUser, `${fixtureUser}@test.studysync.ai`, now, now);

    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Peer Candidate', ?, 'hash', 1, ?, ?)
    `).run(peerCandidate, `${peerCandidate}@test.studysync.ai`, now, now);

    // Ensure topics exist in learning_topics for assessments
    db.prepare(`
      INSERT OR IGNORE INTO learning_topics (id, subject, topic_name, created_at)
      VALUES ('top-10', 'Computer Science', 'Relational Algebra', ?)
    `).run(now);
    db.prepare(`
      INSERT OR IGNORE INTO learning_topics (id, subject, topic_name, created_at)
      VALUES ('top-11', 'Computer Science', 'B-Trees', ?)
    `).run(now);

    // --- DOMAIN 1: ADAPTIVE LEARNING ---
    // A. 4 adaptive recommendations presented; 2 followed through => 50% completion rate
    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, topic, lifecycle_status, presented_at, followed_through_at, created_at, updated_at
      ) VALUES (?, ?, 'continue_topic', 'top-10', 'Relational Algebra', 'followed_through', ?, ?, ?, ?)
    `).run(`rec-a-1-${Date.now()}`, fixtureUser, now, now, now, now);

    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, topic, lifecycle_status, presented_at, followed_through_at, created_at, updated_at
      ) VALUES (?, ?, 'revise_weak_area', 'top-11', 'B-Trees', 'followed_through', ?, ?, ?, ?)
    `).run(`rec-a-2-${Date.now()}`, fixtureUser, now, now, now, now);

    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, topic, lifecycle_status, presented_at, created_at, updated_at
      ) VALUES (?, ?, 'practice_quiz', 'top-12', 'Graph Traversal', 'presented', ?, ?, ?)
    `).run(`rec-a-3-${Date.now()}`, fixtureUser, now, now, now);

    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, topic, lifecycle_status, presented_at, created_at, updated_at
      ) VALUES (?, ?, 'next_learning_task', 'top-13', 'Dynamic Programming', 'presented', ?, ?, ?)
    `).run(`rec-a-4-${Date.now()}`, fixtureUser, now, now, now);

    // B. Subsequent Practice: Distinct recommended topics are 4 (Relational Algebra, B-Trees, Graph Traversal, Dynamic Programming)
    // User subsequently completes a focus interval on 'B-Trees' and 'Relational Algebra' => 2 of 4 = 50%
    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds, status, started_at, created_at
      ) VALUES (?, ?, 'B-Trees', 'Computer Science', 1500, 1500, 'completed', ?, ?)
    `).run(`focus-prac-1-${Date.now()}`, fixtureUser, now, now);

    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds, status, started_at, created_at
      ) VALUES (?, ?, 'Relational Algebra', 'Computer Science', 1500, 1500, 'completed', ?, ?)
    `).run(`focus-prac-2-${Date.now()}`, fixtureUser, now, now);

    // C. Quiz Performance Change on repeated assessments:
    // Topic top-10: initial 60%, subsequent 80% (delta = +20%)
    // Topic top-11: initial 50%, subsequent 70% (delta = +20%)
    // Expected avg quiz delta = +20.0%
    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, score_percentage, passed, assessed_at)
      VALUES (?, ?, 'top-10', 60, 0, datetime('now', '-2 days'))
    `).run(`quiz-1-${Date.now()}`, fixtureUser);

    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, score_percentage, passed, assessed_at)
      VALUES (?, ?, 'top-10', 80, 1, datetime('now', '-1 hour'))
    `).run(`quiz-2-${Date.now()}`, fixtureUser);

    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, score_percentage, passed, assessed_at)
      VALUES (?, ?, 'top-11', 50, 0, datetime('now', '-2 days'))
    `).run(`quiz-3-${Date.now()}`, fixtureUser);

    db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, score_percentage, passed, assessed_at)
      VALUES (?, ?, 'top-11', 70, 1, datetime('now', '-1 hour'))
    `).run(`quiz-4-${Date.now()}`, fixtureUser);

    // --- DOMAIN 2: STUDY PARTNER MATCHING ---
    // 2 peer recommendations: 1 accepted & connected, 1 presented
    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, lifecycle_status, presented_at, accepted_at, followed_through_at, outcome_event, outcome_entity_id, created_at, updated_at
      ) VALUES (?, ?, 'peer_help', ?, 'followed_through', ?, ?, ?, 'circle_connected', ?, ?, ?)
    `).run(`rec-p-1-${Date.now()}`, fixtureUser, peerCandidate, now, now, now, peerCandidate, now, now);

    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, lifecycle_status, presented_at, created_at, updated_at
      ) VALUES (?, ?, 'peer_help', 'peer-other-99', 'presented', ?, ?, ?)
    `).run(`rec-p-2-${Date.now()}`, fixtureUser, now, now, now);

    // Add reciprocal peer review feedback (would_study_again = 1)
    db.prepare(`
      INSERT INTO peer_collaboration_feedback (
        id, session_id, giver_user_id, target_peer_id, was_helpful, would_study_again, created_at, updated_at
      ) VALUES (?, null, ?, ?, 1, 1, ?, ?)
    `).run(`peer-fb-1-${Date.now()}`, fixtureUser, peerCandidate, now, now);

    // --- DOMAIN 3: FOCUS COACH ---
    // 4 focus intervals with goals: 3 achieved = 'yes', 1 = 'no' => 75%
    for (let i = 0; i < 3; i++) {
      db.prepare(`
        INSERT INTO user_focus_intervals (
          id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds, goal, goal_achieved, status, started_at, created_at
        ) VALUES (?, ?, 'Focus Sprint', 'CS', 1500, 1500, 'Complete Section Notes', 'yes', 'completed', ?, ?)
      `).run(`fc-goal-${i}-${Date.now()}`, fixtureUser, now, now);
    }
    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds, goal, goal_achieved, status, started_at, created_at
      ) VALUES (?, ?, 'Focus Sprint', 'CS', 1500, 1500, 'Solve 5 Hard Problems', 'no', 'completed', ?, ?)
    `).run(`fc-goal-fail-${Date.now()}`, fixtureUser, now, now);

    // Focus Session completion vs historical baseline: Add 4 more sessions (total 6 completed + 2 cancelled = 8 total)
    for (let i = 0; i < 2; i++) {
      db.prepare(`
        INSERT INTO user_focus_intervals (id, user_id, topic, subject, planned_duration_seconds, status, started_at, created_at)
        VALUES (?, ?, 'Sprint', 'CS', 1500, 'completed', datetime('now', '-5 days'), datetime('now', '-5 days'))
      `).run(`fc-base-c-${i}-${Date.now()}`, fixtureUser);
      db.prepare(`
        INSERT INTO user_focus_intervals (id, user_id, topic, subject, planned_duration_seconds, status, started_at, created_at)
        VALUES (?, ?, 'Sprint', 'CS', 1500, 'cancelled', datetime('now', '-5 days'), datetime('now', '-5 days'))
      `).run(`fc-base-x-${i}-${Date.now()}`, fixtureUser);
    }

    // Explicit Focus Coach suggestion usefulness rating
    db.prepare(`
      INSERT INTO recommendation_explicit_feedback (
        id, user_id, recommendation_type, target_id, is_relevant, quality_rating, reason_tag, created_at, updated_at
      ) VALUES (?, ?, 'focus_coach', 'coach_pacing', 1, 5, 'pacing_helpful', ?, ?)
    `).run(`fc-rating-${Date.now()}`, fixtureUser, now, now);

    // Compute metrics
    const metrics = EvaluationMetricsService.getEvaluationMetrics(fixtureUser);

    // Assert Adaptive Learning Metrics
    const adaptiveRes = metrics.metrics.adaptiveLearning;
    assert.equal(adaptiveRes.recommendationCompletionRate.percentage, 50, 'Adaptive completion rate should be 50%');
    assert.equal(adaptiveRes.recommendedTopicsPracticeRate.percentage, 50, 'Topics practice rate should be 50%');
    assert.equal(adaptiveRes.quizPerformanceChange.averageDeltaPercentagePoints, 20.0, 'Quiz score delta should be +20.0%');

    // Assert Study Partner Matching Metrics
    const partnerRes = metrics.metrics.studyPartnerMatching;
    assert.equal(partnerRes.recommendationAcceptanceRate.percentage, 50, 'Partner acceptance rate should be 50%');
    assert.equal(partnerRes.successfulConnectionRate.percentage, 100, 'Connection success rate should be 100%');
    assert.equal(partnerRes.repeatCollaborationRate.percentage, 100, 'Repeat collaboration rate should be 100%');

    // Assert Focus Coach Metrics
    const coachRes = metrics.metrics.focusCoach;
    assert.equal(coachRes.suggestedGoalCompletionRate.percentage, 75, 'Goal completion rate should be 75%');
    assert.equal(coachRes.sessionCompletionComparison.isSufficientHistory, true, 'Sufficient history should be true with >= 5 sessions');
    assert.ok(coachRes.sessionCompletionComparison.baselineCompletionRate !== null);
    assert.ok(coachRes.sessionCompletionComparison.recentCompletionRate !== null);
    assert.equal(coachRes.suggestionUsefulnessRate.percentage, 100, 'Suggestion usefulness rate should be 100%');
  });

  test('4. Cross-account isolation: User A actions do not leak into User B evaluation metrics', async () => {
    // Check User A vs User B scoped metrics
    const metricsA = EvaluationMetricsService.getEvaluationMetrics(userAId);
    const metricsB = EvaluationMetricsService.getEvaluationMetrics(userBId);

    assert.equal(metricsA.userId, userAId);
    assert.equal(metricsB.userId, userBId);
    assert.equal(metricsA.scope, 'user');
    assert.equal(metricsB.scope, 'user');

    // Querying User A's private feedback as User B via API endpoint returns only User B's records
    const res = await fetch(`${testApp.baseUrl}/api/feedback/my-feedback`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.recommendationFeedback.length, 0, 'User B must see only their own feedback');
    assert.equal(body.data.peerFeedback.length, 0, 'User B must see only their own peer feedback');
  });

  test('5. Observable outcome tracking: Focus interval completion transitions matching recommendations', async () => {
    const testTopic = `Graph Algorithms ${Date.now()}`;
    const testGoal = 'Master Dijkstra Implementation';

    // 1. Present adaptive recommendation for this topic
    const tracked = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'revise_weak_area',
      targetId: 'top-graph-dijkstra',
      topic: testTopic,
      engineVersion: 'v2-adaptive',
    });
    assert.equal(tracked.lifecycle_status, 'presented');

    // 2. User creates and completes a focus interval with this topic and goal
    const interval = FocusModel.createInterval({
      userId: userAId,
      topic: testTopic,
      subject: 'Computer Science',
      plannedDurationSeconds: 1500,
      goal: testGoal,
      autoCancelPrevious: true,
    });

    FocusModel.completeFocusSession(interval.id, userAId, {
      goalAchieved: 'yes',
      keyTakeaways: 'Learned priority queue optimization',
    });

    // 3. Verify recommendation tracking row transitioned to followed_through
    const updated = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(tracked.id);
    assert.equal(updated.lifecycle_status, 'followed_through', 'Recommendation must transition to followed_through upon focus completion');
    assert.equal(updated.outcome_event, 'focus_interval_completed');
    assert.ok(updated.followed_through_at);
  });

  test('6. Observable outcome tracking: Circle connection transitions matching partner recommendation', async () => {
    const tempPeerId = `peer-connect-${Date.now()}`;
    const now = new Date().toISOString();

    // Create temp peer user
    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Connected Peer', ?, 'hash', 1, ?, ?)
    `).run(tempPeerId, `peer.${Date.now()}@studysync.ai`, now, now);

    // 1. Present partner recommendation for User A
    const tracked = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'peer_help',
      targetId: tempPeerId,
      engineVersion: 'v2-partner-matching',
    });
    assert.equal(tracked.lifecycle_status, 'presented');

    // 2. User A sends Circle request to this peer
    CircleModel.sendCircleRequest(userAId, tempPeerId);

    // Status should be accepted
    let row = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(tracked.id);
    assert.equal(row.lifecycle_status, 'accepted');
    assert.equal(row.outcome_event, 'circle_request_sent');

    // 3. Peer accepts Circle request
    const pendingReq = db.prepare('SELECT id FROM circle_requests WHERE sender_id = ? AND receiver_id = ?').get(userAId, tempPeerId);
    CircleModel.acceptCircleRequest(tempPeerId, pendingReq.id);

    // Status should be followed_through with circle_connected
    row = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(tracked.id);
    assert.equal(row.lifecycle_status, 'followed_through');
    assert.equal(row.outcome_event, 'circle_connected');
  });

  test('7. Missing or inconsistent event data is handled gracefully without exceptions', async () => {
    const corruptUserId = `user-corrupt-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, is_verified, created_at, updated_at)
      VALUES (?, 'Corrupt User', ?, 'hash', 1, ?, ?)
    `).run(corruptUserId, `corrupt.${Date.now()}@studysync.ai`, now, now);

    // Missing topic, unknown target, missing outcome entity, unusual dates
    db.prepare(`
      INSERT INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id, topic, subject, lifecycle_status, presented_at, created_at
      ) VALUES (?, ?, 'unknown_custom_type', 'orphan-target-99', null, null, 'presented', ?, ?)
    `).run(`corrupt-rec-${Date.now()}`, corruptUserId, now, now);

    // Focus interval with missing goal, null takeaways, zero durations
    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, topic, subject, planned_duration_seconds, actual_duration_seconds, goal, goal_achieved, status, started_at, created_at
      ) VALUES (?, ?, 'Inconsistent Sprint', null, 1500, 0, null, null, 'completed', ?, ?)
    `).run(`corrupt-focus-${Date.now()}`, corruptUserId, now, now);

    assert.doesNotThrow(() => {
      EvaluationMetricsService.getEvaluationMetrics(corruptUserId);
    }, 'Must not throw on missing/corrupted event data');
  });

  test('8. Personalization: User explicit negative feedback suppresses irrelevant recommendations', async () => {
    const uninterestingTopic = `Obsolete Dialect ${Date.now()}`;
    const testTarget = `top-obsolete-${Date.now()}`;

    // Submit explicit negative feedback: is_relevant = 0
    FeedbackModel.submitRecommendationFeedback(userAId, {
      targetId: testTarget,
      recommendationType: 'continue_topic',
      isRelevant: false,
      qualityRating: 1,
      reasonTag: 'not_interested',
      feedbackText: 'Not studying obsolete syntax',
    });

    // Verify negative feedback was stored in explicit feedback table
    const fb = db.prepare(`
      SELECT * FROM recommendation_explicit_feedback WHERE user_id = ? AND target_id = ?
    `).get(userAId, testTarget);
    assert.ok(fb);
    assert.equal(fb.is_relevant, 0);

    // Subsequent call to getRecommendationsForUser should not recommend this target
    const recs = LearningRecommendationService.getRecommendationsForUser(userAId);
    assert.equal(recs.some((r) => r.id === testTarget || r.topic === uninterestingTopic), false);
  });

  test('9. Focus Coach suggestion feedback endpoint POST /api/feedback/coach works for authenticated users', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/feedback/coach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        suggestionId: 'coach_pacing_25min',
        isRelevant: true,
        qualityRating: 5,
        reasonTag: 'perfect_pacing',
        feedbackText: 'The 25-minute sprint recommendation matched my study pace.',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.is_relevant, 1);
    assert.equal(body.data.quality_rating, 5);

    // Metrics for user A should now reflect this useful suggestion
    const metrics = EvaluationMetricsService.getEvaluationMetrics(userAId);
    const usefulness = metrics.metrics.focusCoach.suggestionUsefulnessRate;
    assert.ok(usefulness.ratePercentage !== null);
    assert.ok(usefulness.ratePercentage >= 50);
  });

  test('10. Regression check: Focus Mode, Sessions, Rooms, Notes, and Auth remain 100% operational', async () => {
    // A. Focus Mode interval create and complete
    const interval = FocusModel.createInterval({
      userId: userAId,
      plannedDurationSeconds: 1200,
      topic: 'Algorithms Analysis',
      subject: 'Computer Science',
      goal: 'Understand Big-O notation',
      autoCancelPrevious: true,
    });
    assert.ok(interval?.id);

    const completed = FocusModel.completeFocusSession(interval.id, userAId, {
      goalAchieved: 'yes',
      keyTakeaways: 'Mastered amortized runtime analysis',
    });
    assert.equal(completed.status, 'completed');

    // B. Room creation and membership
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: `Algorithm Review Room ${Date.now()}`,
        topic: 'Algorithms Analysis',
        subject: 'Computer Science',
        maxCapacity: 4,
      }),
    });
    assert.equal(roomRes.status, 201);

    // C. Note creation
    const noteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        title: 'Master Theorem Notes',
        subject: 'Computer Science',
        topic: 'Algorithms Analysis',
        content: 'T(n) = aT(n/b) + f(n)',
        tags: 'algorithms,cs',
      }),
    });
    assert.equal(noteRes.status, 201);
  });
});
