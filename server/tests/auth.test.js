import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Authentication API Endpoints', () => {
  let testApp;
  const testEmail = `test.student.${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  let activeToken = null;

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // 1. Successful registration
  test('1. Successful registration creates new user and returns session token', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Test Learner',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token, 'Session token should be returned');
    assert.equal(body.data.user.email, testEmail);
    assert.equal(body.data.user.displayName, 'Test Learner');
    assert.equal(body.data.user.password_hash, undefined, 'Password hash must never be returned');
    activeToken = body.data.token;
  });

  // 2. Duplicate account handling
  test('2. Duplicate registration returns 409 EMAIL_EXISTS', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Duplicate Learner',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMAIL_EXISTS');
  });

  // 3. Invalid registration input
  test('3. Invalid registration input returns 400 with validation errors', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: '', // empty
        email: 'invalid-email-format',
        password: 'short',
        confirmPassword: 'mismatched',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length >= 3);
  });

  // 4. Successful sign-in
  test('4. Successful sign-in with valid credentials returns session token', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token);
    assert.equal(body.data.user.email, testEmail);
  });

  // 5. Invalid credentials
  test('5. Sign-in with incorrect password returns 401 INVALID_CREDENTIALS without disclosing existence', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999!',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
  });

  test('5b. Sign-in with non-existent email returns generic 401 INVALID_CREDENTIALS', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody.registered@example.com',
        password: 'SomePassword123!',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
  });

  // 6. Sign-out
  test('6. Sign-out successfully invalidates current session', async () => {
    // Verify token works first
    const meResBefore = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.equal(meResBefore.status, 200);

    // Call sign out
    const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.equal(logoutRes.status, 200);

    // Token must now be rejected
    const meResAfter = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.equal(meResAfter.status, 401);
  });

  // 7. Protected route access while signed out
  test('7. Protected route access while signed out returns 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  });
});
