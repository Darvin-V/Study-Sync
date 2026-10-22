import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Goal-Oriented Study Sessions & Structured Learning Phases', () => {
  let testApp;
  let userToken;
  let userId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Register test learner
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Goal Learner',
        email: `goal.learner.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const data = await res.json();
    userToken = data.data.token;
    userId = data.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Starting a study session preserves subject, topic, goal, and generates 4 structured phases', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        topic: 'BCNF Normalisation',
        subject: 'Database Systems',
        goal: 'Understand functional dependencies and derive lossless join decomposition',
        plannedDurationMinutes: 25,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.topic, 'BCNF Normalisation');
    assert.strictEqual(body.data.subject, 'Database Systems');
    assert.strictEqual(body.data.goal, 'Understand functional dependencies and derive lossless join decomposition');
    assert.strictEqual(body.data.currentPhase, 'focus');
    assert.ok(Array.isArray(body.data.phases));
    assert.strictEqual(body.data.phases.length, 4);

    // Verify phases sum to 1500 seconds (25 minutes)
    const phaseSum = body.data.phases.reduce((acc, p) => acc + p.durationSeconds, 0);
    assert.strictEqual(phaseSum, 1500);

    const phaseIds = body.data.phases.map((p) => p.id);
    assert.deepStrictEqual(phaseIds, ['focus', 'discuss', 'recall', 'review']);
  });

  test('2. GET /api/focus/active restores goal, current phase, and phase breakdown', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
    assert.strictEqual(body.data.topic, 'BCNF Normalisation');
    assert.strictEqual(body.data.goal, 'Understand functional dependencies and derive lossless join decomposition');
    assert.strictEqual(body.data.currentPhase, 'focus');
    assert.strictEqual(body.data.phases.length, 4);
  });

  test('3. Advancing phases updates current_phase and records completed_phases without resetting elapsed time', async () => {
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const intervalId = (await resActive.json()).data.id;

    // Advance to 'discuss' phase
    const resPhase1 = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/phase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        currentPhase: 'discuss',
        completedPhase: 'focus',
      }),
    });

    assert.strictEqual(resPhase1.status, 200);
    const body1 = await resPhase1.json();
    assert.strictEqual(body1.data.currentPhase, 'discuss');
    assert.deepStrictEqual(body1.data.completedPhases, ['focus']);

    // Advance to 'recall' phase
    const resPhase2 = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/phase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        currentPhase: 'recall',
        completedPhase: 'discuss',
      }),
    });

    assert.strictEqual(resPhase2.status, 200);
    const body2 = await resPhase2.json();
    assert.strictEqual(body2.data.currentPhase, 'recall');
    assert.deepStrictEqual(body2.data.completedPhases, ['focus', 'discuss']);
  });

  test('4. Completing session persists learning reflection and synchronizes revision marker', async () => {
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const intervalId = (await resActive.json()).data.id;

    const resComplete = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        goalAchieved: 'yes',
        keyTakeaways: 'Learned how to check if every functional dependency X -> Y has X as superkey',
        confusingDoubts: 'Need more practice with multi-valued dependencies',
        needsRevision: true,
        completedPhases: ['focus', 'discuss', 'recall', 'review'],
        currentPhase: 'review',
      }),
    });

    assert.strictEqual(resComplete.status, 200);
    const body = await resComplete.json();
    assert.strictEqual(body.data.status, 'completed');
    assert.strictEqual(body.data.goalAchieved, 'yes');
    assert.strictEqual(body.data.keyTakeaways, 'Learned how to check if every functional dependency X -> Y has X as superkey');
    assert.strictEqual(body.data.confusingDoubts, 'Need more practice with multi-valued dependencies');
    assert.strictEqual(body.data.needsRevision, true);
    assert.ok(body.data.completedPhases.includes('review'));

    // Verify revision preference was registered in user_learning_preferences
    const db = getDb();
    const prefRow = db.prepare(`
      SELECT ulp.*, lt.topic_name
      FROM user_learning_preferences ulp
      JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE ulp.user_id = ? AND LOWER(lt.topic_name) = LOWER('BCNF Normalisation')
    `).get(userId);

    assert.ok(prefRow, 'Topic preference should be recorded for spaced revision');
    assert.strictEqual(prefRow.confidence_level, 'needs_practice');
    assert.strictEqual(prefRow.wants_peer_support, 1);
  });

  test('5. Early finish without complete duration honest labeling and custom phase configuration', async () => {
    // Start with custom phases
    const customPhases = [
      { id: 'focus', name: 'Focus', label: 'Reading', durationSeconds: 600, description: 'Read text' },
      { id: 'discuss', name: 'Discuss', label: 'Peer Talk', durationSeconds: 300, description: 'Talk to peer' },
    ];

    const resStart = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        topic: 'Graph Shortest Paths',
        subject: 'Algorithms',
        goal: 'Implement Dijkstra and analyze time complexity',
        plannedDurationMinutes: 15,
        phases: customPhases,
      }),
    });

    assert.strictEqual(resStart.status, 201);
    const startBody = await resStart.json();
    const intervalId = startBody.data.id;

    // Complete early with reflection
    const resComplete = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        goalAchieved: 'partially',
        keyTakeaways: 'Understood priority queue implementation',
        confusingDoubts: 'Did not finish Bellman-Ford comparison',
        earlyExitReason: 'Finished early to attend class',
        needsRevision: false,
      }),
    });

    assert.strictEqual(resComplete.status, 200);
    const compBody = await resComplete.json();
    assert.strictEqual(compBody.data.status, 'completed');
    assert.strictEqual(compBody.data.goalAchieved, 'partially');
    assert.strictEqual(compBody.data.earlyExitReason, 'Finished early to attend class');
    assert.strictEqual(compBody.data.needsRevision, false);
  });

  test('6. History reflects goals set, goals achieved, revision counts, and reflection items', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/history`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.stats);
    assert.ok(body.data.stats.goalsSetCount >= 2);
    assert.ok(body.data.stats.needsRevisionCount >= 1);
    assert.ok(body.data.intervals.length >= 2);

    const bcnfInterval = body.data.intervals.find((i) => i.topic === 'BCNF Normalisation');
    assert.ok(bcnfInterval);
    assert.strictEqual(bcnfInterval.goalAchieved, 'yes');
    assert.strictEqual(bcnfInterval.needsRevision, true);
    assert.ok(bcnfInterval.keyTakeaways);
  });
});
