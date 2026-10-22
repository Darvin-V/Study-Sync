import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { MatchingEngine, MATCHING_WEIGHTS } from '../services/matching/matchingEngine.js';
import { calculateTopicSimilarity } from '../services/matching/topicSimilarity.js';
import { aiService } from '../services/ai/aiService.js';
import { RuleBasedProvider } from '../services/ai/ruleBasedProvider.js';
import { GeminiProvider } from '../services/ai/geminiProvider.js';
import { getDb } from '../db/connection.js';

describe('AI Layer & Intelligent Learning Recommendations Endpoints (Phase 9)', () => {
  let testApp;
  let userToken;
  let userId;
  let peerToken;
  let peerId;

  before(async () => {
    testApp = await startTestServer();

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User (Learner)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Learner Charlie',
        email: `charlie.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userToken = dataA.data.token;
    userId = dataA.data.user.id;

    // Set profile and preferences for User
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        headline: 'Junior • Computer Science',
        institution: 'School of Computing',
        skill_level: 'Intermediate',
        preferred_study_times: 'Weekday evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
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

    // 2. Register Peer (Target Peer)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Mentor Dave',
        email: `dave.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    peerToken = dataB.data.token;
    peerId = dataB.data.user.id;

    // Set profile and preferences for Peer (Advanced in topic-dbms)
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({
        headline: 'Senior • Computer Science',
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
        Authorization: `Bearer ${peerToken}`,
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
          },
        ],
      }),
    });
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  test('1. Transparent Matching Engine Weights Sum Exactly to 1.00 (100%)', () => {
    const weights = MatchingEngine.getWeights();
    assert.ok(weights.topicSimilarity === 0.25);
    assert.ok(weights.skillCompatibility === 0.15);
    assert.ok(weights.goalCompatibility === 0.15);
    assert.ok(weights.scheduleCompatibility === 0.10);
    assert.ok(weights.languageCompatibility === 0.10);
    assert.ok(weights.learningStyleCompatibility === 0.10);
    assert.ok(weights.reliability === 0.10);
    assert.ok(weights.previousCollaboration === 0.05);

    const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
    assert.strictEqual(Math.round(sum * 100), 100);
  });

  test('2. Topic Understanding: Exact match vs Alias vs Distinct topics within subject', () => {
    // Exact match
    const exact = calculateTopicSimilarity('DBMS — Normalisation', 'DBMS — Normalisation');
    assert.strictEqual(exact.score, 1.0);
    assert.strictEqual(exact.level, 'exact');

    // Taxonomy aliases (SQL joins vs database joins)
    const joins = calculateTopicSimilarity('sql joins', 'database joins');
    assert.ok(joins.score >= 0.85);
    assert.strictEqual(joins.level, 'canonical_equivalent');

    // Distinct sub-disciplines in the same subject (Normalisation vs Indexing)
    const distinct = calculateTopicSimilarity('DBMS — Normalisation', 'Indexing & Storage', 'Database Systems', 'Database Systems');
    assert.ok(distinct.score < 0.40);
    assert.strictEqual(distinct.level, 'same_subject_distinct_topics');

    // Completely unrelated subjects (Deadlocks vs Linear Algebra)
    const unrelated = calculateTopicSimilarity('Deadlocks', 'Linear Algebra — Eigenvalues');
    assert.ok(unrelated.score <= 0.10);
  });

  test('3. GET /api/matches/status exposes matching weights and honest AI availability status', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/status`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.weights);
    assert.strictEqual(data.data.weights.topicSimilarity, 0.25);
    assert.strictEqual(data.data.free_tier_safe, true);
    assert.strictEqual(data.data.ai_provider.free_tier_compatible, true);
  });

  test('4. GET /api/matches/peers excludes the requesting user from returned candidates', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    // Requesting user MUST NOT appear in the candidate results
    const foundSelf = body.data.some((m) => m.studentId === userId);
    assert.strictEqual(foundSelf, false);
  });

  test('5. Duplicate prevention: All returned candidates have unique student IDs', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const ids = body.data.map((m) => m.studentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size);
  });

  test('6. Unverified and blocked users are strictly excluded from matching', async () => {
    const db = getDb();
    const testUnverifiedId = `unver-${Date.now()}`;
    const now = new Date().toISOString();

    // Insert an unverified user
    db.prepare(`
      INSERT INTO users (id, display_name, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'Unverified Student', ?, '["English"]', 0, ?, ?)
    `).run(testUnverifiedId, `${testUnverifiedId}@test.ai`, now, now);

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`);
    const body = await res.json();
    const foundUnverified = body.data.some((m) => m.studentId === testUnverifiedId);
    assert.strictEqual(foundUnverified, false);

    // Block User Dave and verify immediate exclusion
    const blockRes = await fetch(`${testApp.baseUrl}/api/matches/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ targetUserId: peerId }),
    });
    assert.strictEqual(blockRes.status, 200);

    const resAfterBlock = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    const bodyAfterBlock = await resAfterBlock.json();
    const foundBlocked = bodyAfterBlock.data.some((m) => m.studentId === peerId);
    assert.strictEqual(foundBlocked, false);

    // Clean up block for subsequent tests
    db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').run(userId, peerId);
  });

  test('7. Missing or incomplete learner profiles are handled gracefully without errors', async () => {
    const db = getDb();
    const incompleteUserId = `inc-${Date.now()}`;
    const now = new Date().toISOString();

    // Create user without a profile row
    db.prepare(`
      INSERT INTO users (id, display_name, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'No Profile User', ?, '["English"]', 1, ?, ?)
    `).run(incompleteUserId, `${incompleteUserId}@test.ai`, now, now);

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?limit=300`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    const incMatch = body.data.find((m) => m.studentId === incompleteUserId);
    assert.ok(incMatch);
    assert.ok(incMatch.compatibilityScore > 0);
    assert.ok(Array.isArray(incMatch.matchingReasons));

    // Clean up
    db.prepare('DELETE FROM users WHERE id = ?').run(incompleteUserId);
  });

  test('8. Candidate private fields (password_hash, verification_token) are never exposed', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`);
    const body = await res.json();

    for (const match of body.data) {
      assert.strictEqual(match.password_hash, undefined);
      assert.strictEqual(match.passwordHash, undefined);
      assert.strictEqual(match.verification_token, undefined);
      assert.strictEqual(match.verificationToken, undefined);
      assert.ok(typeof match.compatibilityScore === 'number');
      assert.ok(match.compatibilityScore >= 0 && match.compatibilityScore <= 100);
      assert.ok(match.matchingReasons.length > 0);
    }
  });

  test('9. GET /api/recommendations/study returns personalised study recommendations with transparent reasons', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);

    for (const rec of body.data) {
      assert.ok(rec.id);
      assert.ok(rec.title);
      assert.ok(rec.reason);
      assert.ok(rec.actionType);
      assert.strictEqual(typeof rec.ai_enhanced, 'boolean');
      // Must not make unsubstantiated mastery claims
      assert.strictEqual(rec.reason.toLowerCase().includes('mastered the topic based on study hours'), false);
    }
  });

  test('10. POST /api/recommendations/feedback records recommendation acceptance or dismissal', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        recommendationId: 'rec-test-01',
        recommendationType: 'peer_match',
        targetId: peerId,
        action: 'accepted',
        feedbackText: 'Great match for normalisation practice',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.action, 'accepted');

    // Reject invalid action with 400
    const invalidRes = await fetch(`${testApp.baseUrl}/api/recommendations/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        targetId: peerId,
        action: 'invalid_action',
      }),
    });
    assert.strictEqual(invalidRes.status, 400);
  });

  test('11. AI Provider Fallback & Safety: Graceful degradation when AI API is unavailable', async () => {
    // Instantiate GeminiProvider with invalid key or unconfigured
    const unconfiguredGemini = new GeminiProvider('');
    assert.strictEqual(unconfiguredGemini.isAvailable(), false);

    const fallbackResult = await unconfiguredGemini.enhancePeerMatch(
      { displayName: 'Peer', matchingReasons: ['Topic match'] },
      { skill_level: 'Intermediate' },
      'DBMS — Normalisation'
    );
    assert.strictEqual(fallbackResult.isEnhanced, false);
    assert.strictEqual(fallbackResult.error, 'API_KEY_NOT_CONFIGURED');

    // Rule-based provider is always available and declares itself honestly
    const ruleProvider = new RuleBasedProvider();
    assert.strictEqual(ruleProvider.isAvailable(), true);
    const ruleResult = await ruleProvider.enhancePeerMatch(
      { displayName: 'Peer', matchingReasons: ['Topic match'] },
      { skill_level: 'Intermediate' },
      'DBMS — Normalisation'
    );
    assert.strictEqual(ruleResult.isEnhanced, false);
    assert.strictEqual(ruleResult.engine, 'deterministic_rule_based');

    // aiService safely degrades to rule_based
    aiService.refreshProvider();
    const enhanced = await aiService.enhancePeerMatch(
      { displayName: 'Peer', matchingReasons: ['Shared subject'] },
      { skill_level: 'Intermediate' },
      'DBMS'
    );
    assert.strictEqual(enhanced.isEnhanced, false);
    assert.ok(enhanced.insight);
  });
});
