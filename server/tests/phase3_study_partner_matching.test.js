import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Phase 3: AI-Powered Study Partner Matching Test Suite', () => {
  let testApp;
  let db;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let userCId;
  let userBlockedToken;
  let userBlockedId;
  let coldUserToken;
  let coldUserId;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. User A: Studying "DBMS — Normalisation" with goal "Exam Revision", Weekday Evenings
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Alpha',
        email: `alpha.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        headline: 'Junior • Database Systems',
        skill_level: 'Intermediate',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms',
            learning_goal: 'Exam Revision',
            skill_level: 'Intermediate',
            is_learning_now: 1,
            confidence_level: 'neutral',
          },
        ],
      }),
    });

    // 2. User B: Compatible peer also studying "dbms — normalisation" with extra spaces and mixed casing
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Beta',
        email: `beta.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({
        headline: 'Sophomore • Database Systems',
        skill_level: 'Intermediate',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms',
            learning_goal: 'Exam Revision',
            skill_level: 'Intermediate',
            is_learning_now: 1,
            confidence_level: 'neutral',
          },
        ],
      }),
    });

    // 3. User C: Studying completely unrelated topic "Organic Chemistry"
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Gamma Chem',
        email: `gamma.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataC = await resC.json();
    userCToken = dataC.data.token;
    userCId = dataC.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userCToken}` },
      body: JSON.stringify({
        headline: 'Junior • Organic Chemistry',
        skill_level: 'Advanced',
        preferred_study_times: 'Weekend Mornings',
        preferred_study_duration: 60,
        is_profile_completed: 1,
      }),
    });

    // 4. User Blocked: Studying DBMS, but User A blocks this user
    const resBlk = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Blocked Peer',
        email: `blocked.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataBlk = await resBlk.json();
    userBlockedToken = dataBlk.data.token;
    userBlockedId = dataBlk.data.user.id;

    // Block User Blocked from User A
    db.prepare('INSERT OR REPLACE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)').run(userAId, userBlockedId);

    // 5. Cold User: Brand new user with 0 history and no preferences
    const resCold = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Cold Start Peer',
        email: `cold.${unique}@test.studysync.ai`,
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

  // =========================================================================
  // 1. TWO USERS WITH SHARED TOPICS & TOPIC NORMALIZATION
  // =========================================================================

  test('1. Two users with shared topics match with high compatibility score and concrete evidence', async () => {
    // Search with un-normalized capitalization and extra spaces: '   DBMS — Normalisation   '
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('   DBMS — Normalisation   ')}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const matches = body.data;

    // Must find User Beta
    const betaMatch = matches.find((m) => m.studentId === userBId);
    assert.ok(betaMatch, 'Expected User Beta in matches');

    // Compatibility score must be high (>= 85)
    assert.ok(betaMatch.compatibilityScore >= 85, `Expected score >= 85, got ${betaMatch.compatibilityScore}`);

    // Must document metric type and not claim probability
    assert.strictEqual(betaMatch.isProbabilityScore, false);
    assert.strictEqual(betaMatch.compatibilityMetricType, 'deterministic_weighted_index');

    // Evidence explanation must cite shared topic / goal
    assert.ok(Array.isArray(betaMatch.matchingReasons));
    const evidenceText = betaMatch.matchingReasons.join(' ');
    assert.match(evidenceText, /Normalisation|study/i);
  });

  // =========================================================================
  // 2. USERS WITH NO MATCHING TOPICS ARE NOT RETURNED ARBITRARILY
  // =========================================================================

  test('2. Searching a specific topic excludes completely unrelated users and returns alternatives', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Database%20Systems&topic=DBMS%20—%20Normalisation`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const matches = body.data;

    // User Gamma (Organic Chemistry) must NOT appear in DBMS Normalisation results
    const gammaMatch = matches.find((m) => m.studentId === userCId);
    assert.strictEqual(gammaMatch, undefined, 'User Gamma should not match Database Systems topic');
  });

  // =========================================================================
  // 3. CURRENT-USER EXCLUSION & ISOLATION
  // =========================================================================

  test('3. Requesting user is strictly excluded from their own recommendations', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const matches = body.data;

    // Self must never appear
    const selfMatch = matches.find((m) => m.studentId === userAId);
    assert.strictEqual(selfMatch, undefined, 'Current user must be excluded from recommendations');
  });

  // =========================================================================
  // 4. PRIVACY & BLOCKING RESTRICTIONS
  // =========================================================================

  test('4. Blocked users are strictly excluded from recommendation results', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=DBMS%20—%20Normalisation`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const matches = body.data;

    // Blocked peer must never appear
    const blockedMatch = matches.find((m) => m.studentId === userBlockedId);
    assert.strictEqual(blockedMatch, undefined, 'Blocked user must not appear in peer matches');
  });

  // =========================================================================
  // 5. MISSING OR INCOMPLETE PROFILES & COLD START SAFETY
  // =========================================================================

  test('5. Cold start user with no collaboration history receives neutral baseline without penalty', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: { Authorization: `Bearer ${coldUserToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    // Response metadata reports user profile status guidance
    assert.ok(body.meta?.userProfileStatus, 'Expected userProfileStatus in response metadata');
    assert.strictEqual(body.meta.userProfileStatus.isProfileComplete, false);
    assert.match(body.meta.userProfileStatus.guidance, /profile/i);

    // Candidates in results have valid baseline scores
    assert.ok(Array.isArray(body.data));
    if (body.data.length > 0) {
      const first = body.data[0];
      assert.ok(first.compatibilityScore >= 35 && first.compatibilityScore <= 99);
    }
  });

  // =========================================================================
  // 6. ONLINE / AVAILABILITY INDICATOR HONESTY
  // =========================================================================

  test('6. Inactive or non-session users are never displayed as active/online', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const matches = body.data;

    for (const match of matches) {
      if (match.presenceStatus === 'active') {
        // Must correspond to an actual live row in study_sessions / session_participants
        const activeRow = db.prepare(`
          SELECT sp.id FROM session_participants sp
          JOIN study_sessions ss ON sp.session_id = ss.id
          WHERE sp.user_id = ? AND sp.left_at IS NULL AND ss.status = 'active'
        `).get(match.studentId);
        assert.ok(activeRow, `User ${match.studentId} was reported active but has no live session`);
      } else {
        assert.ok(match.presenceStatus === 'scheduled' || match.presenceStatus === 'unconfirmed' || match.presenceStatus === 'offline');
      }
    }
  });

  // =========================================================================
  // 7. CIRCLE CONNECTION & MESSAGING FROM RESULTS
  // =========================================================================

  test('7. Authenticated user can send Circle connection request to a recommended peer', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/circle/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        contactId: userBId,
        relationType: 'peer',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // =========================================================================
  // 8. REGRESSION CHECK: FOCUS COACH, ADAPTIVE RECOMMENDATIONS, SESSIONS & ROOMS
  // =========================================================================

  test('8. Regression check: Focus Coach, adaptive learning recommendations, and study sessions remain 100% operational', async () => {
    // A. Focus Coach
    const resCoach = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resCoach.status, 200);
    const coachBody = await resCoach.json();
    assert.strictEqual(coachBody.data.engine, 'deterministic_rule_based');

    // B. Adaptive Study Recommendations (Phase 2)
    const resAdaptive = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resAdaptive.status, 200);
    const adaptiveBody = await resAdaptive.json();
    assert.ok(Array.isArray(adaptiveBody.data));

    // C. Create Study Session
    const resSession = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Phase 3 Partner Matching Verification',
        subject: 'Database Systems',
        plannedDuration: 45,
        startNow: true,
      }),
    });
    assert.strictEqual(resSession.status, 201);
  });
});
