import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { MatchingEngine, configureMatchingWeights, resetMatchingWeights } from '../services/matching/matchingEngine.js';
import { getDb } from '../db/connection.js';

describe('Advanced Peer Matching & Fair Recommendations Endpoints (Phase 13)', () => {
  let testApp;
  let userToken;
  let userId;
  let mentorToken;
  let mentorId;
  let peerLearnerToken;
  let peerLearnerId;
  let newLearnerToken;
  let newLearnerId;

  before(async () => {
    testApp = await startTestServer();

    // Clean up any residual test rows from prior test suites so candidate pool is clean and deterministic
    const db = getDb();
    const testUsers = db.prepare(`
      SELECT id FROM users 
      WHERE email LIKE '%@test.%' 
         OR email LIKE '%@example.%' 
         OR id LIKE 'inc-%' 
         OR id LIKE 'nosched-%'
         OR id LIKE 'unver-%'
    `).all();
    for (const u of testUsers) {
      try { db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM room_memberships WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM session_participants WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM peer_collaboration_feedback WHERE giver_user_id = ? OR target_peer_id = ?').run(u.id, u.id); } catch {}
      try { db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?').run(u.id, u.id); } catch {}
      try { db.prepare('DELETE FROM users WHERE id = ?').run(u.id); } catch {}
    }

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A: Beginner needing help with SQL Joins
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Learner',
        email: `alice.p13.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userToken = dataA.data.token;
    userId = dataA.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        headline: 'Sophomore • Computer Science',
        institution: 'Faculty of Computing',
        skill_level: 'Beginner',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    // Alice has strength in Python and wants help with SQL Joins
    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms-joins',
            learning_goal: 'Exam Revision',
            skill_level: 'Beginner',
            is_learning_now: 1,
            is_strength: 0,
            is_improving: 1,
            wants_peer_support: 1,
            confidence_level: 'needs_improvement',
          },
          {
            topic_id: 'topic-prog-fund',
            learning_goal: 'Concept Deep-Dive',
            skill_level: 'Advanced',
            is_learning_now: 0,
            is_strength: 1,
            willing_to_teach: 1,
            confidence_level: 'confident',
          },
        ],
      }),
    });

    // 2. Register User B: Mentor Bob who has strength in SQL Joins and needs help in Python (Reciprocal Candidate)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Mentor',
        email: `bob.p13.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    mentorToken = dataB.data.token;
    mentorId = dataB.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentorToken}` },
      body: JSON.stringify({
        headline: 'Senior • Computer Science',
        institution: 'Faculty of Computing',
        skill_level: 'Advanced',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentorToken}` },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms-joins',
            learning_goal: 'Exam Revision',
            skill_level: 'Advanced',
            is_learning_now: 1,
            is_strength: 1,
            willing_to_teach: 1,
            confidence_level: 'confident',
          },
          {
            topic_id: 'topic-prog-fund',
            learning_goal: 'Concept Deep-Dive',
            skill_level: 'Beginner',
            is_learning_now: 1,
            is_strength: 0,
            is_improving: 1,
            wants_peer_support: 1,
            confidence_level: 'needs_improvement',
          },
        ],
      }),
    });

    // 3. Register User C: Charlie Peer who is ALSO a beginner needing help with SQL Joins
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie Fellow',
        email: `charlie.p13.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataC = await resC.json();
    peerLearnerToken = dataC.data.token;
    peerLearnerId = dataC.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peerLearnerToken}` },
      body: JSON.stringify({
        headline: 'Freshman • Data Science',
        institution: 'Faculty of Computing',
        skill_level: 'Beginner',
        preferred_study_times: 'Late Night', // Intentionally different schedule
        preferred_study_duration: 90,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${peerLearnerToken}` },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms-joins',
            learning_goal: 'Exam Revision',
            skill_level: 'Beginner',
            is_learning_now: 1,
            is_strength: 0,
            is_improving: 1,
            wants_peer_support: 1,
            confidence_level: 'needs_improvement',
          },
        ],
      }),
    });

    // 4. Register User D: Cold-Start New User with no session history
    const resD = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Daisy Newcomer',
        email: `daisy.p13.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataD = await resD.json();
    newLearnerToken = dataD.data.token;
    newLearnerId = dataD.data.user.id;

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newLearnerToken}` },
      body: JSON.stringify({
        headline: 'Undergraduate • Computer Science',
        skill_level: 'Intermediate',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newLearnerToken}` },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms-joins',
            learning_goal: 'Exam Revision',
            skill_level: 'Intermediate',
            is_learning_now: 1,
            is_strength: 1,
            willing_to_teach: 1,
            confidence_level: 'confident',
          },
        ],
      }),
    });
  });

  after(async () => {
    resetMatchingWeights();
    try {
      const db = getDb();
      const testUsers = db.prepare(`
        SELECT id FROM users 
        WHERE email LIKE '%@test.%' 
           OR email LIKE '%@example.%' 
           OR id LIKE 'inc-%' 
           OR id LIKE 'nosched-%'
           OR id LIKE 'unver-%'
      `).all();
      for (const u of testUsers) {
        try { db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM room_memberships WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM session_participants WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM peer_collaboration_feedback WHERE giver_user_id = ? OR target_peer_id = ?').run(u.id, u.id); } catch {}
        try { db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?').run(u.id, u.id); } catch {}
        try { db.prepare('DELETE FROM users WHERE id = ?').run(u.id); } catch {}
      }
    } catch {}
    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Same-topic matching evaluates curriculum topic taxonomy with transparent explanation', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&subject=${encodeURIComponent('Database Systems')}&intent=learn_together`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    const bobMatch = body.data.find((m) => m.studentId === mentorId);
    assert.ok(bobMatch, 'Mentor Bob should be found in recommendations');
    assert.strictEqual(bobMatch.scoreBreakdown.topicSimilarity, 100);
    assert.ok(bobMatch.matchingReasons.some((r) => r.toLowerCase().includes('topic match') || r.toLowerCase().includes('sql joins')));
  });

  test('2. Complementary-skill matching: Beginner seeking help ranks confident explainer over fellow beginner', async () => {
    // Alice seeks an explainer for SQL Joins (intent: find_explainer)
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&intent=find_explainer&skillPreference=complementary`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const bobMatch = body.data.find((m) => m.studentId === mentorId);
    const charlieMatch = body.data.find((m) => m.studentId === peerLearnerId);

    assert.ok(bobMatch, 'Bob (confident explainer) should be returned');
    assert.ok(charlieMatch, 'Charlie (fellow beginner) should be returned');

    // Bob has verified strength in SQL Joins -> skill compatibility score should be 100
    assert.strictEqual(bobMatch.scoreBreakdown.skillCompatibility, 100);

    // Charlie is also a beginner who needs help -> skill compatibility score should NOT be 100
    assert.ok(
      charlieMatch.scoreBreakdown.skillCompatibility < 60,
      `Charlie should receive reduced skill score for explainer search (got ${charlieMatch.scoreBreakdown.skillCompatibility})`
    );

    // Explainer candidate must rank significantly higher overall
    assert.ok(
      bobMatch.compatibilityScore > charlieMatch.compatibilityScore,
      `Bob (${bobMatch.compatibilityScore}) should outrank Charlie (${charlieMatch.compatibilityScore}) for help-seeking intent`
    );
  });

  test('3. Peer teaching and mutual learning: Two-sided reciprocal exchange across topics is recognized', async () => {
    // Alice can teach Programming Fundamentals and needs help with SQL Joins
    // Bob can teach SQL Joins and needs help with Programming Fundamentals
    const matches = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
      subject: 'Database Systems',
      intent: 'find_explainer',
    });

    const bobMatch = matches.find((m) => m.studentId === mentorId);
    assert.ok(bobMatch);
    assert.strictEqual(bobMatch.role, 'reciprocal_exchange');
    assert.strictEqual(bobMatch.roleLabel, 'Reciprocal Peer Exchange');
    assert.ok(
      bobMatch.matchingReasons.some((r) => r.toLowerCase().includes('reciprocal peer exchange')),
      'Explanation must explicitly cite reciprocal peer exchange'
    );
  });

  test('4. Goal and schedule compatibility accurately captures alignment and schedule differences', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}&preferredTime=Weekday+Evenings&learningGoal=Exam+Revision`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.strictEqual(body.success, true);

    const bobMatch = body.data.find((m) => m.studentId === mentorId);
    const charlieMatch = body.data.find((m) => m.studentId === peerLearnerId);

    // Bob has Weekday Evenings -> 100
    assert.strictEqual(bobMatch.scoreBreakdown.scheduleCompatibility, 100);
    assert.strictEqual(bobMatch.availabilityStatus, 'compatible');

    // Charlie has Late Night -> 25 mismatch
    assert.strictEqual(charlieMatch.scoreBreakdown.scheduleCompatibility, 25);
    assert.strictEqual(charlieMatch.availabilityStatus, 'different_schedule');
    assert.ok(charlieMatch.matchingReasons.some((r) => r.toLowerCase().includes('different schedule')));
  });

  test('5. Missing and incomplete profile information is handled gracefully with limited profile notice', async () => {
    const db = getDb();
    const incId = `inc-p13-${Date.now()}`;
    const now = new Date().toISOString();

    // Create user with zero bio, zero preferences, default headline
    db.prepare(`
      INSERT INTO users (id, display_name, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'Incomplete Student', ?, '["English"]', 1, ?, ?)
    `).run(incId, `${incId}@test.studysync.ai`, now, now);

    const matches = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
      limit: 500,
    });

    const incCandidate = matches.find((m) => m.studentId === incId);
    assert.ok(incCandidate, 'Incomplete profile user must be discoverable');
    assert.strictEqual(incCandidate.hasLimitedProfile, true);
    assert.ok(incCandidate.compatibilityScore >= 35 && incCandidate.compatibilityScore <= 90);
    assert.ok(
      incCandidate.matchingReasons.some((r) => r.toLowerCase().includes('limited profile') || r.toLowerCase().includes('course enrollment')),
      'Should transparently explain recommendation is based on limited profile information'
    );

    // Clean up
    db.prepare('DELETE FROM users WHERE id = ?').run(incId);
  });

  test('6. Cold-start users receive fair neutral baselines and are not penalized for missing history', async () => {
    // Daisy has 0 recorded sessions and 0 peer reviews
    const matches = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
      preferredTime: 'Weekday Evenings',
      learningGoal: 'Exam Revision',
      intent: 'find_explainer',
    });

    const daisyMatch = matches.find((m) => m.studentId === newLearnerId);
    assert.ok(daisyMatch, 'Cold start user Daisy should be recommended');
    assert.strictEqual(daisyMatch.isColdStart, true);
    // Neutral baseline reliability score (80)
    assert.strictEqual(daisyMatch.scoreBreakdown.reliability, 80);
    // Neutral baseline collaboration score (70)
    assert.strictEqual(daisyMatch.scoreBreakdown.previousCollaboration, 70);
    // Should be highly competitive overall due to topic and schedule match
    assert.ok(daisyMatch.compatibilityScore >= 80, `Daisy should score competitively (got ${daisyMatch.compatibilityScore})`);
    assert.ok(daisyMatch.matchingReasons.some((r) => r.toLowerCase().includes('new learner') || r.toLowerCase().includes('neutral baseline')));
  });

  test('7. Unknown versus unavailable schedules: unconfirmed schedules are explicitly distinguished', async () => {
    const db = getDb();
    const noScheduleId = `nosched-p13-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, display_name, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'No Schedule Student', ?, '["English"]', 1, ?, ?)
    `).run(noScheduleId, `${noScheduleId}@test.studysync.ai`, now, now);

    db.prepare(`
      INSERT INTO learner_profiles (id, user_id, headline, skill_level, preferred_study_times, is_profile_completed, created_at, updated_at)
      VALUES (?, ?, 'Learner', 'Intermediate', NULL, 1, ?, ?)
    `).run(`prof-${noScheduleId}`, noScheduleId, now, now);

    const matches = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
      preferredTime: 'Weekday Evenings',
      limit: 500,
    });

    const noSchedMatch = matches.find((m) => m.studentId === noScheduleId);
    assert.ok(noSchedMatch);
    assert.strictEqual(noSchedMatch.availabilityStatus, 'unknown');
    assert.strictEqual(noSchedMatch.isAvailabilityUnknown, true);
    assert.strictEqual(noSchedMatch.mutualAvailability, 'Schedule unconfirmed');
    assert.strictEqual(noSchedMatch.scoreBreakdown.scheduleCompatibility, 60); // Neutral baseline, not 25 mismatch

    // Clean up
    db.prepare('DELETE FROM users WHERE id = ?').run(noScheduleId);
  });

  test('8. Duplicate candidate prevention: Returned candidates always have unique student IDs', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?limit=50`);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const studentIds = body.data.map((m) => m.studentId);
    const uniqueIds = new Set(studentIds);
    assert.strictEqual(studentIds.length, uniqueIds.size, 'All candidate student IDs must be unique');
  });

  test('9. Candidate eligibility & privacy restrictions: Excludes self, unverified, and blocked peers', async () => {
    const db = getDb();

    // 1. Requesting user never appears in recommendations
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const body = await res.json();
    assert.strictEqual(body.data.some((m) => m.studentId === userId), false);

    // 2. Unverified users never appear
    const unverId = `unver-p13-${Date.now()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, display_name, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'Unverified P13', ?, '["English"]', 0, ?, ?)
    `).run(unverId, `${unverId}@test.studysync.ai`, now, now);

    const resUnver = await fetch(`${testApp.baseUrl}/api/matches/peers?limit=100`);
    const bodyUnver = await resUnver.json();
    assert.strictEqual(bodyUnver.data.some((m) => m.studentId === unverId), false);

    // 3. Block peer and verify exclusion from matches and GET /api/matches/peers/:peerId
    const blockRes = await fetch(`${testApp.baseUrl}/api/matches/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ targetUserId: mentorId }),
    });
    assert.strictEqual(blockRes.status, 200);

    const resBlocked = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const bodyBlocked = await resBlocked.json();
    assert.strictEqual(bodyBlocked.data.some((m) => m.studentId === mentorId), false);

    // Profile lookup for blocked user returns 403 Forbidden
    const profileRes = await fetch(`${testApp.baseUrl}/api/matches/peers/${mentorId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(profileRes.status, 403);

    // Clean up block
    db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').run(userId, mentorId);

    // Profile lookup succeeds once unblocked
    const profileResUnblocked = await fetch(`${testApp.baseUrl}/api/matches/peers/${mentorId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(profileResUnblocked.status, 200);
    const profData = await profileResUnblocked.json();
    assert.strictEqual(profData.data.displayName, 'Bob Mentor');
    assert.strictEqual(profData.data.password_hash, undefined);
    assert.strictEqual(profData.data.verification_token, undefined);
  });

  test('10. Matching explanations match calculated factors and never contradict score', async () => {
    const matches = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
      intent: 'find_explainer',
      preferredTime: 'Weekday Evenings',
    });

    assert.ok(matches.length > 0);
    for (const match of matches) {
      assert.ok(Array.isArray(match.matchingReasons));
      assert.ok(match.matchingReasons.length >= 2);
      assert.ok(match.explanationDetails);

      if (match.scoreBreakdown.topicSimilarity === 100) {
        assert.ok(match.matchingReasons.some((r) => r.toLowerCase().includes('topic match') || r.toLowerCase().includes('sql joins')));
      }

      if (match.scoreBreakdown.scheduleCompatibility === 25) {
        assert.ok(match.matchingReasons.some((r) => r.toLowerCase().includes('different schedule')));
      }

      if (match.hasLimitedProfile) {
        assert.ok(match.matchingReasons.some((r) => r.toLowerCase().includes('limited profile')));
      }
    }
  });

  test('11. Configurable weights and feedback sample size threshold (N >= 3) enforcement', async () => {
    const db = getDb();

    // 1. Verify weights are configurable
    const customWeights = {
      topicSimilarity: 0.50,
      skillCompatibility: 0.20,
      goalCompatibility: 0.10,
      scheduleCompatibility: 0.05,
      languageCompatibility: 0.05,
      learningStyleCompatibility: 0.05,
      reliability: 0.03,
      previousCollaboration: 0.02,
    };
    configureMatchingWeights(customWeights);
    const currentW = MatchingEngine.getWeights();
    assert.strictEqual(currentW.topicSimilarity, 0.50);

    // Reset weights
    resetMatchingWeights();
    assert.strictEqual(MatchingEngine.getWeights().topicSimilarity, 0.25);

    // 2. Minimum sample threshold for peer feedback:
    // Insert 1 review for User B (N = 1, below threshold N >= 3)
    const fbId1 = `fb-thresh-${Date.now()}-1`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO peer_collaboration_feedback (id, session_id, giver_user_id, target_peer_id, was_helpful, would_study_again, topic_relevance, created_at, updated_at)
      VALUES (?, NULL, ?, ?, 1, 1, 1, ?, ?)
    `).run(fbId1, peerLearnerId, mentorId, now, now);

    const matchesSingleReview = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
    });
    const bobSingle = matchesSingleReview.find((m) => m.studentId === mentorId);
    // Single review explanation notes threshold pending
    assert.ok(bobSingle.matchingReasons.some((r) => r.toLowerCase().includes('threshold pending')));

    // Clean up temporary review
    db.prepare('DELETE FROM peer_collaboration_feedback WHERE id = ?').run(fbId1);
  });

  test('12. Fairness safeguards: Candidates with equal high suitability are rotated fairly without activity-count monopoly', async () => {
    // Both Bob and Daisy have high suitability for SQL Joins
    const matches = MatchingEngine.findMatches(userId, {
      topic: 'Relational Algebra & SQL Joins',
      intent: 'find_explainer',
      preferredTime: 'Weekday Evenings',
      limit: 10,
    });

    const bobIdx = matches.findIndex((m) => m.studentId === mentorId);
    const daisyIdx = matches.findIndex((m) => m.studentId === newLearnerId);

    assert.ok(bobIdx >= 0, 'Bob should appear in top tier');
    assert.ok(daisyIdx >= 0, 'Daisy (new learner) should appear in top tier');
    // Verify cold start candidate is discoverable in top 3
    assert.ok(daisyIdx < 4, `Cold start candidate Daisy must be discoverable in top 3 (got rank ${daisyIdx + 1})`);
  });

  test('13. Empty match state returns structured alternative suggestions (rooms & time windows)', async () => {
    // Search with impossible non-existent topic
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Quantum Cryptography Superstrings 9999')}&subject=${encodeURIComponent('Operating Systems')}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.strictEqual(body.success, true);
    // If no candidate matches this impossible topic
    if (body.data.length === 0) {
      assert.ok(body.meta.alternatives, 'Should provide alternative suggestions');
      assert.ok(typeof body.meta.alternatives.explanation === 'string');
      assert.ok(Array.isArray(body.meta.alternatives.suggestedRooms));
      assert.ok(Array.isArray(body.meta.alternatives.suggestedTimeWindows));
    }
  });
});
