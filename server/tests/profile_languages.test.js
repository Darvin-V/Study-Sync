import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Profile Preferred Languages & Preference Synchronization', () => {
  let testApp;
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;

  before(async () => {
    testApp = await startTestServer();

    // Register User A
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Language Student A',
        email: `lang.student.a.${Date.now()}@example.com`,
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
        displayName: 'Language Student B',
        email: `lang.student.b.${Date.now()}@example.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  test('1. Default profile for new user contains English preferred language', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.preferredLanguages));
    assert.deepStrictEqual(body.data.preferredLanguages, ['English']);
  });

  test('2. Save a single preferred language via PUT /api/profile/me', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        headline: 'Computer Science Sophomore',
        preferredLanguages: ['Tamil'],
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data.preferredLanguages, ['Tamil']);
    assert.strictEqual(body.data.headline, 'Computer Science Sophomore');
  });

  test('3. Save multiple preferred study languages (e.g. English, Tamil, Hindi, Telugu)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: ['English', 'Tamil', 'Hindi', 'Telugu'],
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data.preferredLanguages, ['English', 'Tamil', 'Hindi', 'Telugu']);
    // Unrelated fields preserved
    assert.strictEqual(body.data.headline, 'Computer Science Sophomore');
  });

  test('4. Support custom "Other" languages (e.g. French, German) and deduplication', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: ['English', 'French', 'German', 'english'], // duplicate english should be deduped
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data.preferredLanguages, ['English', 'French', 'German']);
  });

  test('5. Support backward-compatible comma-separated string input for languages', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: 'Malayalam, Kannada, Bengali',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data.preferredLanguages, ['Malayalam', 'Kannada', 'Bengali']);
  });

  test('6. Edit and remove languages (e.g. keep only Kannada)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: ['Kannada'],
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.data.preferredLanguages, ['Kannada']);
  });

  test('7. Load saved languages on page refresh (GET /api/profile/me and GET /api/auth/me)', async () => {
    // Check GET /api/profile/me
    const profRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(profRes.status, 200);
    const profBody = await profRes.json();
    assert.deepStrictEqual(profBody.data.preferredLanguages, ['Kannada']);

    // Check GET /api/auth/me
    const authRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(authRes.status, 200);
    const authBody = await authRes.json();
    assert.deepStrictEqual(authBody.data.user.preferredLanguages, ['Kannada']);
  });

  test('8. Changing Interface Language in settings does NOT overwrite study languages', async () => {
    // Set multi-study languages on user A first
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: ['English', 'Tamil', 'Spanish'],
      }),
    });

    // Now change Interface Language to Tamil in Settings (without primaryStudyLanguage)
    const settingsRes = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        language: 'ta', // Interface language
        theme: 'dark',
      }),
    });
    assert.strictEqual(settingsRes.status, 200);

    // Verify study languages are NOT overwritten
    const checkRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkBody = await checkRes.json();
    assert.deepStrictEqual(checkBody.data.preferredLanguages, ['English', 'Tamil', 'Spanish']);
  });

  test('9. Invalid preferred languages reject with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: [123, null], // Invalid elements
      }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  test('10. Privacy & IDOR: User B cannot modify User A languages or access private fields', async () => {
    // User B tries to spoof user A id
    const res = await fetch(`${testApp.baseUrl}/api/profile/me?userId=${userAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        preferredLanguages: ['HackedLanguage'],
        userId: userAId,
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.userId, userBId); // Must only update user B

    // Verify user A is untouched
    const checkRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkBody = await checkRes.json();
    assert.deepStrictEqual(checkBody.data.preferredLanguages, ['English', 'Tamil', 'Spanish']);
  });
});
