import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Learner Profile and Preferences Endpoints', () => {
  let testApp;
  let userAToken;
  let userBToken;
  let userAId;

  before(async () => {
    testApp = await startTestServer();

    // Register User A
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Alice',
        email: `alice.${Date.now()}@example.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // Register User B
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Bob',
        email: `bob.${Date.now()}@example.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // 8. Retrieving the current user's profile
  test("8. Retrieving the current user's profile via GET /api/profile/me", async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.userId, userAId);
    assert.equal(body.data.displayName, 'User Alice');
    assert.ok(Array.isArray(body.data.subjects));
    assert.ok(Array.isArray(body.data.currentlyLearning));
  });

  // 9. Creating/completing a profile
  test('9. Completing initial onboarding profile via PUT /api/profile/me', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        headline: 'B.S. in Computer Science',
        institution: 'Tech University',
        introduction: 'Passionate about algorithms and databases.',
        skillLevel: 'Intermediate',
        preferredStudyTimes: 'Weekday evenings',
        preferredStudyDuration: 50,
        subjects: ['Database Systems', 'Operating Systems'],
        isProfileCompleted: true,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.headline, 'B.S. in Computer Science');
    assert.equal(body.data.institution, 'Tech University');
    assert.equal(body.data.isProfileCompleted, true);
    assert.equal(body.data.preferredStudyDuration, 50);
    assert.deepEqual(body.data.subjects, ['Database Systems', 'Operating Systems']);
  });

  // 10. Updating an existing profile
  test('10. Updating profile fields does not overwrite unspecified fields', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        displayName: 'Alice Updated',
        headline: 'Senior CS Researcher',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.displayName, 'Alice Updated');
    assert.equal(body.data.headline, 'Senior CS Researcher');
    // Pre-existing fields must be preserved
    assert.equal(body.data.institution, 'Tech University');
    assert.equal(body.data.isProfileCompleted, true);
  });

  // 11. Invalid profile data handling
  test('11. Invalid profile data returns 400 with VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        displayName: 'A', // too short (< 2)
        skillLevel: 'GodTierMaster', // invalid enum
        preferredStudyDuration: 9999, // out of range
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length >= 3);
  });

  // 12. Attempting to access another user's profile
  test("12. Server-side identity enforcement prevents accessing or modifying another user's profile", async () => {
    // User B tries to pass user A's ID in request query or body
    const res = await fetch(`${testApp.baseUrl}/api/profile/me?userId=${userAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        headline: 'Hacked Headline',
        userId: userAId, // Spoofed user ID
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    // Must update USER B's own profile, NOT User A!
    assert.notEqual(body.data.userId, userAId);
    assert.equal(body.data.displayName, 'User Bob');

    // Verify User A profile was NOT modified
    const checkRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkBody = await checkRes.json();
    assert.equal(checkBody.data.headline, 'Senior CS Researcher');
    assert.notEqual(checkBody.data.headline, 'Hacked Headline');
  });

  // 13. Learning preference updates
  test('13. Learning preference updates (currently learning, strengths, improving, goals)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferences: [
          {
            topic_id: 'topic-dbms',
            is_learning_now: true,
            is_strength: true,
            is_improving: false,
            learning_goal: 'Pass BCNF exam with distinction',
          },
          {
            topic_id: 'topic-dp',
            is_learning_now: true,
            is_strength: false,
            is_improving: true,
            learning_goal: 'Solve 20 LCS problems',
          },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.currentlyLearning.some((t) => t.id === 'topic-dbms'));
    assert.ok(body.data.strengths.some((t) => t.id === 'topic-dbms'));
    assert.ok(body.data.improvementAreas.some((t) => t.id === 'topic-dp'));
    assert.ok(body.data.learningGoals.includes('Pass BCNF exam with distinction'));
  });
});
