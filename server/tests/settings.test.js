import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('User Settings, Theme & Language Preferences API (Phase 3)', () => {
  let testApp;
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  const unique = Date.now();

  before(async () => {
    testApp = await startTestServer();

    // Register User A
    const regResA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Learner',
        email: `alice.pref.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regA = await regResA.json();
    userAToken = regA.data.token;
    userAId = regA.data.user.id;

    // Register User B
    const regResB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Scholar',
        email: `bob.pref.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regB = await regResB.json();
    userBToken = regB.data.token;
    userBId = regB.data.user.id;
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  test('1. Unauthenticated request to GET or PUT /api/settings is rejected with 401', async () => {
    const getRes = await fetch(`${testApp.baseUrl}/api/settings`);
    assert.strictEqual(getRes.status, 401);

    const putRes = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    });
    assert.strictEqual(putRes.status, 401);
  });

  test('2. Authenticated user can retrieve default settings via GET /api/settings', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.userId, userAId);
    assert.strictEqual(body.data.theme, 'system');
    assert.strictEqual(body.data.language, 'en');
    assert.strictEqual(body.data.fontScaling, 'standard');
    assert.strictEqual(body.data.reducedMotion, false);
    assert.strictEqual(body.data.roomAudioVideo, 'muted');
  });

  test('3. Authenticated user can update theme to dark and language to Tamil (ta)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        theme: 'dark',
        language: 'ta',
        fontScaling: 'comfortable',
        reducedMotion: true,
        focusDuration: 60,
        breakDuration: 10,
        roomAudioVideo: 'mic-only',
        suppressInAppNotifications: false,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.theme, 'dark');
    assert.strictEqual(body.data.language, 'ta');
    assert.strictEqual(body.data.fontScaling, 'comfortable');
    assert.strictEqual(body.data.reducedMotion, true);
    assert.strictEqual(body.data.focusDuration, 60);
    assert.strictEqual(body.data.breakDuration, 10);
    assert.strictEqual(body.data.roomAudioVideo, 'mic-only');
    assert.strictEqual(body.data.suppressInAppNotifications, false);
  });

  test('4. Settings persist in SQLite and are retrieved upon subsequent GET request', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.theme, 'dark');
    assert.strictEqual(body.data.language, 'ta');
    assert.strictEqual(body.data.fontScaling, 'comfortable');
    assert.strictEqual(body.data.reducedMotion, true);

    // Direct SQLite check
    const db = getDb();
    const row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userAId);
    assert.ok(row, 'user_settings row must exist');
    assert.strictEqual(row.theme, 'dark');
    assert.strictEqual(row.language, 'ta');
    assert.strictEqual(row.font_scaling, 'comfortable');
    assert.strictEqual(row.reduced_motion, 1);
  });

  test('5. User A cannot modify User B preferences by supplying different user ID', async () => {
    // User A attempts to overwrite User B's settings by providing userId: userBId
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        userId: userBId,
        user_id: userBId,
        theme: 'light',
        language: 'en',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // The updated settings must be for User A, NOT User B
    assert.strictEqual(body.data.userId, userAId);
    assert.strictEqual(body.data.theme, 'light');

    // Verify User B's settings remain untouched (default system/en)
    const resB = await fetch(`${testApp.baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resB.status, 200);
    const bodyB = await resB.json();
    assert.strictEqual(bodyB.data.userId, userBId);
    assert.strictEqual(bodyB.data.theme, 'system');
    assert.strictEqual(bodyB.data.language, 'en');
  });

  test('6. Server rejects invalid theme, language, and out-of-range focus duration with 400', async () => {
    // Invalid theme
    const resInvalidTheme = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ theme: 'neon-glow' }),
    });
    assert.strictEqual(resInvalidTheme.status, 400);

    // Invalid language
    const resInvalidLang = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ language: 'klingon' }),
    });
    assert.strictEqual(resInvalidLang.status, 400);

    // Invalid focus duration
    const resInvalidDuration = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ focusDuration: -5 }),
    });
    assert.strictEqual(resInvalidDuration.status, 400);
  });

  test('7. GET /api/auth/me returns integrated settings on login/session check', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.settings, 'settings must be returned in auth /me');
    assert.strictEqual(body.data.settings.theme, 'light');
  });

  test('8. Primary study language updates user preferred_languages array', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        primaryStudyLanguage: 'Tamil',
        language: 'ta',
      }),
    });
    assert.strictEqual(res.status, 200);

    // Check user record
    const userRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const userBody = await userRes.json();
    assert.deepStrictEqual(userBody.data.user.preferredLanguages, ['Tamil']);
  });

  test('9. Font Scaling: Supports compact (Small), standard (Default), and comfortable (Large)', async () => {
    // 9.1 Set to compact (Small)
    const resCompact = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: 'compact' }),
    });
    assert.strictEqual(resCompact.status, 200);
    const bodyCompact = await resCompact.json();
    assert.strictEqual(bodyCompact.data.fontScaling, 'compact');

    // Verify in SQLite
    const db = getDb();
    const rowCompact = db.prepare('SELECT font_scaling FROM user_settings WHERE user_id = ?').get(userAId);
    assert.strictEqual(rowCompact.font_scaling, 'compact');

    // 9.2 Alias 'small' normalizes to 'compact'
    const resSmall = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: 'small' }),
    });
    assert.strictEqual(resSmall.status, 200);
    const bodySmall = await resSmall.json();
    assert.strictEqual(bodySmall.data.fontScaling, 'compact');

    // 9.3 Alias 'large' normalizes to 'comfortable'
    const resLarge = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: 'large' }),
    });
    assert.strictEqual(resLarge.status, 200);
    const bodyLarge = await resLarge.json();
    assert.strictEqual(bodyLarge.data.fontScaling, 'comfortable');

    // 9.4 'default' normalizes to 'standard'
    const resDefault = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: 'default' }),
    });
    assert.strictEqual(resDefault.status, 200);
    const bodyDefault = await resDefault.json();
    assert.strictEqual(bodyDefault.data.fontScaling, 'standard');

    // 9.5 Reject unsupported font scaling with 400
    const resInvalidScale = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: 'gigantic' }),
    });
    assert.strictEqual(resInvalidScale.status, 400);
  });

  test('10. Notifications and Privacy controls persist and reject invalid values', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: true,
        breakRemindersEnabled: false,
        audioChimeEnabled: true,
        allowStudyInvites: false,
        profileVisibility: 'private',
        showLearningPreferences: false,
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.suppressInAppNotifications, true);
    assert.strictEqual(body.data.breakRemindersEnabled, false);
    assert.strictEqual(body.data.audioChimeEnabled, true);
    assert.strictEqual(body.data.allowStudyInvites, false);
    assert.strictEqual(body.data.profileVisibility, 'private');
    assert.strictEqual(body.data.showLearningPreferences, false);

    // Verify GET /api/settings returns exact persisted values
    const getRes = await fetch(`${testApp.baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const getBody = await getRes.json();
    assert.strictEqual(getBody.data.profileVisibility, 'private');
    assert.strictEqual(getBody.data.allowStudyInvites, false);
    assert.strictEqual(getBody.data.breakRemindersEnabled, false);
    assert.strictEqual(getBody.data.audioChimeEnabled, true);

    // Rejects invalid profile visibility
    const resInvalidVisibility = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ profileVisibility: 'hidden_world' }),
    });
    assert.strictEqual(resInvalidVisibility.status, 400);
  });

  test('11. Continuous Font Scaling (12px - 24px): Supports smooth pixel adjustments, boundary values, and rejects out-of-range sizes', async () => {
    // 11.1 Intermediate value 15px
    const res15 = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: '15px' }),
    });
    assert.strictEqual(res15.status, 200);
    const body15 = await res15.json();
    assert.strictEqual(body15.data.fontScaling, '15px');

    // 11.2 Intermediate value 17px
    const res17 = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: '17px' }),
    });
    assert.strictEqual(res17.status, 200);
    const body17 = await res17.json();
    assert.strictEqual(body17.data.fontScaling, '17px');

    // 11.3 Intermediate value 19px (passed as integer or string)
    const res19 = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: 19 }),
    });
    assert.strictEqual(res19.status, 200);
    const body19 = await res19.json();
    assert.strictEqual(body19.data.fontScaling, '19px');

    // 11.4 Minimum boundary value (12px)
    const resMin = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: '12px' }),
    });
    assert.strictEqual(resMin.status, 200);
    const bodyMin = await resMin.json();
    assert.strictEqual(bodyMin.data.fontScaling, '12px');

    // 11.5 Maximum boundary value (24px)
    const resMax = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: '24px' }),
    });
    assert.strictEqual(resMax.status, 200);
    const bodyMax = await resMax.json();
    assert.strictEqual(bodyMax.data.fontScaling, '24px');

    // Verify in SQLite database directly
    const db = getDb();
    const row = db.prepare('SELECT font_scaling FROM user_settings WHERE user_id = ?').get(userAId);
    assert.strictEqual(row.font_scaling, '24px');

    // Verify GET /api/settings restores the exact persisted value
    const getRes = await fetch(`${testApp.baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const getBody = await getRes.json();
    assert.strictEqual(getBody.data.fontScaling, '24px');

    // 11.6 Reject out-of-range lower bound (< 12px)
    const resTooSmall = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: '11px' }),
    });
    assert.strictEqual(resTooSmall.status, 400);

    // 11.7 Reject out-of-range upper bound (> 24px)
    const resTooLarge = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ fontScaling: '25px' }),
    });
    assert.strictEqual(resTooLarge.status, 400);
  });
});
