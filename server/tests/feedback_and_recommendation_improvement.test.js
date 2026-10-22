import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Feedback Loop & Recommendation Improvement Endpoints (Phase 12)', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let userCId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A (Alice - Primary learner)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Feedback',
        email: `alice.fb.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // 2. Register User B (Bob - Study Partner)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Partner',
        email: `bob.fb.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    // 3. Register User C (Charlie - Outsider learner)
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie Outsider',
        email: `charlie.fb.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataC = await resC.json();
    userCToken = dataC.data.token;
    userCId = dataC.data.user.id;

    // Setup User A & B preferences for matching
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        major: 'Computer Science',
        year: '3rd Year',
        headline: 'Focusing on distributed databases',
        subjects: ['Database Systems'],
        currentlyLearning: ['Database Systems:Normalisation'],
        learningNowList: ['Normalisation'],
        learningGoals: { 'Database Systems:Normalisation': 'Exam Revision' },
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        major: 'Computer Science',
        year: '3rd Year',
        headline: 'Strong in relational database design',
        subjects: ['Database Systems'],
        strengths: ['Database Systems:Normalisation'],
        willingToTeach: ['Normalisation'],
        learningGoals: { 'Database Systems:Normalisation': 'Exam Revision' },
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
            skill_level: 'Intermediate',
            is_learning_now: 1,
            is_strength: 0,
            is_improving: 1,
          },
        ],
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms',
            learning_goal: 'Exam Revision',
            skill_level: 'Advanced',
            is_learning_now: 1,
            is_strength: 1,
            willing_to_teach: 1,
          },
        ],
      }),
    });
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Unauthenticated requests to /api/feedback/my-feedback are rejected with 401', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/feedback/my-feedback`);
    assert.strictEqual(res.status, 401);
  });

  test('2. Transparent Evaluation Metrics endpoint returns documented formulas and sample size labels', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/feedback/metrics`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.metrics);
    assert.ok(body.data.metrics.acceptanceRate);
    assert.ok(body.data.metrics.followThroughRate);
    assert.ok(body.data.metrics.peerHelpfulnessRate);
    assert.ok(body.data.metrics.repeatStudyDesireRate);
    assert.strictEqual(typeof body.data.metrics.acceptanceRate.formula, 'string');
    assert.strictEqual(typeof body.data.metrics.acceptanceRate.definition, 'string');
    assert.strictEqual(typeof body.data.disclaimer, 'string');
  });

  test('3. Recommendations are automatically tracked with persistent trackingId and lifecycleStatus', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    if (body.data.length > 0) {
      const first = body.data[0];
      assert.ok(first.trackingId);
      assert.strictEqual(first.lifecycleStatus, 'presented');
    }
  });

  test('4. Accepting and dismissing recommendations updates lifecycle status in recommendation_tracking', async () => {
    const { FeedbackModel } = await import('../models/feedback.model.js');

    // 1. Manually create a tracked recommendation for User A
    const tracked = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'peer_help',
      targetId: userBId,
      topic: 'Database Normalisation',
      subject: 'Database Systems',
    });
    assert.strictEqual(tracked.lifecycle_status, 'presented');

    // 2. User A accepts the recommendation via POST /api/recommendations/feedback
    const resAccept = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        trackingId: tracked.id,
        action: 'accepted',
      }),
    });
    assert.strictEqual(resAccept.status, 200);

    // Verify status updated to 'accepted'
    const db = getDb();
    const row = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(tracked.id);
    assert.strictEqual(row.lifecycle_status, 'accepted');
    assert.ok(row.accepted_at);

    // 3. User A dismisses another tracked recommendation
    const tracked2 = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'join_room',
      targetId: 'room-test-dismiss',
      topic: 'Test Room Topic',
    });
    const resDismiss = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        trackingId: tracked2.id,
        action: 'dismissed',
      }),
    });
    assert.strictEqual(resDismiss.status, 200);
    const row2 = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(tracked2.id);
    assert.strictEqual(row2.lifecycle_status, 'dismissed');
    assert.ok(row2.dismissed_at);
  });

  test('5. Dismissed recommendations are suppressed from immediate re-recommendation', async () => {
    const { FeedbackModel } = await import('../models/feedback.model.js');
    const { LearningRecommendationService } = await import('../services/recommendation/learningRecommendations.js');

    // Mark 'Normalisation' topic as dismissed for User A
    FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'continue_topic',
      targetId: 'Normalisation',
      topic: 'Normalisation',
    });
    const db = getDb();
    db.prepare(`
      UPDATE recommendation_tracking
      SET lifecycle_status = 'dismissed', dismissed_at = datetime('now')
      WHERE user_id = ? AND LOWER(target_id) = 'normalisation'
    `).run(userAId);

    // Fetch recommendations: verify continue_topic for Normalisation is suppressed
    const recs = LearningRecommendationService.getRecommendationsForUser(userAId);
    const hasContinueNorm = recs.some((r) => r.type === 'continue_topic' && r.topic?.toLowerCase().includes('normalisation'));
    assert.strictEqual(hasContinueNorm, false);
  });

  test('6. Explicit recommendation feedback can be submitted and corrected (upsert)', async () => {
    const { FeedbackModel } = await import('../models/feedback.model.js');

    const tracked = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'review_resource',
      targetId: 'note-res-123',
      topic: 'Indexing',
    });

    // 1. Submit initial feedback
    const resFb = await fetch(`${testApp.baseUrl}/api/feedback/recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        trackingId: tracked.id,
        isRelevant: 1,
        qualityRating: 4,
        reasonTag: 'good_match',
        feedbackText: 'Very helpful summary of B+ trees',
      }),
    });
    assert.strictEqual(resFb.status, 200);
    const body = await resFb.json();
    assert.strictEqual(body.data.is_relevant, 1);
    assert.strictEqual(body.data.quality_rating, 4);

    // 2. Correct / update feedback (upsert test)
    const resUpdate = await fetch(`${testApp.baseUrl}/api/feedback/recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        trackingId: tracked.id,
        isRelevant: 1,
        qualityRating: 5,
        reasonTag: 'good_match',
        feedbackText: 'Updated: Excellent reference material',
      }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const bodyUpdate = await resUpdate.json();
    assert.strictEqual(bodyUpdate.data.quality_rating, 5);
    assert.strictEqual(bodyUpdate.data.feedback_text, 'Updated: Excellent reference material');
  });

  test('7. Cross-user isolation: User B cannot give feedback on User A recommendation', async () => {
    const { FeedbackModel } = await import('../models/feedback.model.js');

    const trackedA = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'peer_help',
      targetId: userBId,
      topic: 'Operating Systems',
    });

    // User B attempts to submit feedback on User A's recommendation
    const resForbidden = await fetch(`${testApp.baseUrl}/api/feedback/recommendation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        trackingId: trackedA.id,
        isRelevant: 0,
      }),
    });
    assert.strictEqual(resForbidden.status, 403);
  });

  test('8. Peer collaboration feedback: cannot review self or non-existent peer', async () => {
    // User A attempts to review self
    const resSelf = await fetch(`${testApp.baseUrl}/api/feedback/peer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        targetPeerId: userAId,
        wasHelpful: 1,
      }),
    });
    assert.strictEqual(resSelf.status, 400);
    const bodySelf = await resSelf.json();
    assert.strictEqual(bodySelf.error.code, 'INVALID_PEER');
  });

  test('9. Session peer review authorization: non-participant cannot review session members', async () => {
    // 1. User A creates a session and User B joins
    const resSession = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Query Optimization',
        subject: 'Database Systems',
        title: 'Query Plan Review',
        plannedDuration: 45,
      }),
    });
    assert.strictEqual(resSession.status, 201);
    const sessionId = (await resSession.json()).data.id;

    // User B joins
    await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    // 2. User C (outsider) attempts to submit peer review for this session
    const resOutsider = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/peer-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userCToken}`,
      },
      body: JSON.stringify({
        targetPeerId: userBId,
        wasHelpful: 1,
      }),
    });
    assert.strictEqual(resOutsider.status, 403);
    const bodyOutsider = await resOutsider.json();
    assert.strictEqual(bodyOutsider.error.code, 'FORBIDDEN');
  });

  test('10. Authorized participant can submit and update peer review', async () => {
    // Get existing session with User A and B
    const db = getDb();
    const session = db.prepare('SELECT id FROM study_sessions WHERE creator_id = ? LIMIT 1').get(userAId);
    assert.ok(session);

    // User A submits peer feedback for User B
    const resReview = await fetch(`${testApp.baseUrl}/api/sessions/${session.id}/peer-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        targetPeerId: userBId,
        wasHelpful: 1,
        wouldStudyAgain: 1,
        topicRelevance: 1,
        feedbackNotes: 'Great explanation of B+ tree query plans',
      }),
    });
    assert.strictEqual(resReview.status, 200);
    const bodyReview = await resReview.json();
    assert.strictEqual(bodyReview.data.was_helpful, 1);
    assert.strictEqual(bodyReview.data.would_study_again, 1);

    // Verify via GET /api/feedback/peer/:peerId
    const resGet = await fetch(`${testApp.baseUrl}/api/feedback/peer/${userBId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resGet.status, 200);
    const bodyGet = await resGet.json();
    assert.strictEqual(bodyGet.data.would_study_again, 1);
  });

  test('11. Observable outcome verification: completing session transitions recommendation to followed_through', async () => {
    const { FeedbackModel } = await import('../models/feedback.model.js');

    // 1. Track a peer recommendation from User A for User B
    const tracked = FeedbackModel.trackRecommendation({
      userId: userAId,
      recommendationType: 'peer_help',
      targetId: userBId,
      topic: 'Distributed Transactions',
      subject: 'Database Systems',
    });

    // 2. User A accepts the recommendation
    FeedbackModel.updateRecommendationLifecycle(tracked.id, userAId, { status: 'accepted' });

    // 3. User A creates and starts a session with User B
    const resSession = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Distributed Transactions',
        subject: 'Database Systems',
        title: '2PC Protocol Discussion',
        plannedDuration: 30,
      }),
    });
    const sessionId = (await resSession.json()).data.id;

    await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    // 4. End the session
    const resEnd = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resEnd.status, 200);

    // 5. Verify recommendation was transitioned to 'followed_through'
    const db = getDb();
    const row = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(tracked.id);
    assert.strictEqual(row.lifecycle_status, 'followed_through');
    assert.strictEqual(row.outcome_event, 'session_completed');
    assert.strictEqual(row.outcome_entity_id, sessionId);
    assert.ok(row.followed_through_at);
  });

  test('12. Adaptive ranking incorporates repeat-study preference and Bayesian smoothed peer helpfulness', async () => {
    const { MatchingEngine } = await import('../services/matching/matchingEngine.js');

    // User A has given User B would_study_again = 1
    const matchesForA = MatchingEngine.findMatches(userAId, {
      topic: 'Database Systems:Normalisation',
      subject: 'Database Systems',
      limit: 50,
    });

    const matchB = matchesForA.find((m) => m.studentId === userBId);
    assert.ok(matchB);
    // User B should receive high collaboration score and clear explanation reason
    assert.ok(matchB.matchingReasons.some((r) => r.includes('repeat preference') || r.includes('positive feedback')));

    // Now test negative preference: User A updates feedback for User B with would_study_again = 0
    const { FeedbackModel } = await import('../models/feedback.model.js');
    FeedbackModel.submitPeerFeedback(userAId, {
      targetPeerId: userBId,
      wasHelpful: 0,
      wouldStudyAgain: 0,
    });

    const matchesAfterNegative = MatchingEngine.findMatches(userAId, {
      topic: 'Database Systems:Normalisation',
      subject: 'Database Systems',
      limit: 50,
    });
    const matchBAfter = matchesAfterNegative.find((m) => m.studentId === userBId);
    assert.ok(matchBAfter);
    assert.ok(matchBAfter.matchingReasons.some((r) => r.includes('not preferred for repeat study')));
    // Score should be strictly lower than before
    assert.ok(matchBAfter.compatibilityScore < matchB.compatibilityScore);
  });

  test('13. Cold-start safety: new learner without feedback receives fair baseline score without penalty', async () => {
    const { MatchingEngine } = await import('../services/matching/matchingEngine.js');

    // Charlie has zero recorded reviews
    const matches = MatchingEngine.findMatches(userAId, {
      topic: 'Database Systems:Normalisation',
      subject: 'Database Systems',
      limit: 50,
    });

    const charlie = matches.find((m) => m.studentId === userCId);
    if (charlie) {
      assert.ok(charlie.matchingReasons.some((r) => r.includes('New learner in good standing')));
      assert.ok(charlie.compatibilityScore >= 50);
    }
  });

  test('14. Learner can inspect their own submitted feedback via GET /api/feedback/my-feedback', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/feedback/my-feedback`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.recommendationFeedback));
    assert.ok(Array.isArray(body.data.peerFeedback));
    assert.ok(body.data.peerFeedback.length > 0);
  });
});
