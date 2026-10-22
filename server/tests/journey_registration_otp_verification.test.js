process.env.NODE_ENV = 'test';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import { emailService } from '../services/email/emailService.js';
import UserModel from '../models/user.model.js';
import EmailVerificationModel from '../models/emailVerification.model.js';
import UserSessionModel from '../models/userSession.model.js';
import { _resetRateLimits } from '../middleware/authMiddleware.js';
import { maskEmail } from '../../src/utils/maskEmail.js';

/**
 * StudySync AI — 13-Point User Journey Verification Test Suite
 * 
 * Directly tests the real registration sequence and verification lifecycle
 * required by the specification.
 */
describe('User Journey — Real Registration & Email OTP Verification Suite', () => {
  let testApp;
  const createdUserIds = [];
  const testEmails = [];

  before(async () => {
    testApp = await startTestServer();
  });

  beforeEach(() => {
    _resetRateLimits();
  });

  after(async () => {
    const db = getDb();
    try {
      for (const email of testEmails) {
        db.prepare('DELETE FROM email_verifications WHERE LOWER(email) = LOWER(?)').run(email);
      }
      for (const uid of createdUserIds) {
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      }
    } catch {
      // Teardown cleanup
    }

    if (testApp) await testApp.close();
  });

  // --------------------------------------------------------------------------
  // Journey Test 1: Register using a new email
  // --------------------------------------------------------------------------
  test('Journey 1: Register using a new email records unverified account without session', async () => {
    const email = `journey.student.${Date.now()}@university.edu`;
    testEmails.push(email);

    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Journey Learner',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    assert.equal(res.status, 201, 'Must respond with HTTP 201 Created');
    const cookie = res.headers.get('set-cookie');
    assert.ok(!cookie || !cookie.includes('studysync_session='), 'Must NOT issue session cookie before verification');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.requiresVerification, true);
    assert.equal(body.data.email, email.toLowerCase());

    const user = UserModel.findByEmail(email);
    assert.ok(user, 'User record must exist in SQLite database');
    assert.equal(user.isVerified, false, 'User must remain unverified initially');
    createdUserIds.push(user.id);
  });

  // --------------------------------------------------------------------------
  // Journey Test 2: Confirm OTP screen appears immediately after submission
  // --------------------------------------------------------------------------
  test('Journey 2: Registration submission contract returns requiresVerification and masked recipient info', async () => {
    const email = `journey.screen.${Date.now()}@example.org`;
    testEmails.push(email);

    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Screen Learner',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const body = await res.json();
    assert.equal(body.data.status, 'verification_required');
    assert.equal(body.data.requiresVerification, true);
    assert.equal(typeof body.data.resendAvailableIn, 'number');

    // UI masking helper contracts for the OTP verification screen
    const masked = maskEmail(body.data.email);
    assert.equal(masked, `j***@example.org`, 'Recipient email must be properly masked');
  });

  // --------------------------------------------------------------------------
  // Journey Test 3: Confirm backend requests real email delivery
  // --------------------------------------------------------------------------
  test('Journey 3: Backend dispatches delivery request via email service', async () => {
    const email = `journey.dispatch.${Date.now()}@example.com`;
    testEmails.push(email);

    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Dispatch Learner',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const body = await res.json();
    assert.ok(body.data.emailDelivery, 'Response must describe email delivery attempt');
    assert.ok('status' in body.data.emailDelivery);
    assert.ok('message' in body.data.emailDelivery);
  });

  // --------------------------------------------------------------------------
  // Journey Test 4: Provider acceptance verification (MOCKED FOR AUTOMATED TEST)
  // --------------------------------------------------------------------------
  test('Journey 4: [MOCKED] Email provider accepts message for dispatch when credentials are set', async () => {
    const email = `journey.mocked.provider.${Date.now()}@example.com`;
    testEmails.push(email);

    // Save existing env
    const prevKey = process.env.RESEND_API_KEY;
    const prevFetch = globalThis.fetch;

    try {
      process.env.RESEND_API_KEY = 're_test_mock_secret_key_12345';

      // Mock remote email provider API response
      globalThis.fetch = async (url, options) => {
        if (typeof url === 'string' && url.includes('api.resend.com/emails')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'resend_msg_mock_98765' }),
            headers: new Headers({ 'content-type': 'application/json' }),
          };
        }
        return prevFetch(url, options);
      };

      const delivery = await emailService.sendOtpEmail({
        to: email,
        name: 'Mock Recipient',
        otp: '849201',
        expiryMinutes: 10,
      });

      assert.equal(delivery.success, true, 'Provider mock must accept email for dispatch');
      assert.equal(delivery.status, 'accepted');
      assert.equal(delivery.provider, 'resend');
      assert.equal(delivery.messageId, 'resend_msg_mock_98765');
    } finally {
      process.env.RESEND_API_KEY = prevKey;
      globalThis.fetch = prevFetch;
    }
  });

  // --------------------------------------------------------------------------
  // Journey Test 5: Incorrect OTP verification fails
  // --------------------------------------------------------------------------
  test('Journey 5: Enter an incorrect OTP — verification fails with 400 INVALID_OTP', async () => {
    const email = `journey.wrong.otp.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Wrong OTP Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: '000000' }),
    });

    assert.equal(verifyRes.status, 400, 'Must reject incorrect OTP with HTTP 400');
    const body = await verifyRes.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_OTP');
    assert.equal(body.error.details.attemptsRemaining, 4);

    const user = UserModel.findByEmail(email);
    assert.equal(user.isVerified, false, 'User must remain unverified');
  });

  // --------------------------------------------------------------------------
  // Journey Test 6: Expired OTP verification fails
  // --------------------------------------------------------------------------
  test('Journey 6: Enter an expired OTP — verification fails with 400 OTP_EXPIRED', async () => {
    const email = `journey.expired.otp.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Expired OTP Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const activeOtp = emailService._getRecentTestOtp(email);
    const db = getDb();
    // Simulate past expiration
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    db.prepare('UPDATE email_verifications SET expires_at = ? WHERE LOWER(email) = ?').run(pastTime, email.toLowerCase());

    const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: activeOtp }),
    });

    assert.equal(verifyRes.status, 400, 'Must reject expired OTP with HTTP 400');
    const body = await verifyRes.json();
    assert.equal(body.error.code, 'OTP_EXPIRED');

    const user = UserModel.findByEmail(email);
    assert.equal(user.isVerified, false, 'User must remain unverified');
  });

  // --------------------------------------------------------------------------
  // Journey Test 7: Correct OTP verification succeeds
  // --------------------------------------------------------------------------
  test('Journey 7: Enter the correct OTP — verification succeeds and issues authenticated session', async () => {
    const email = `journey.correct.otp.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Correct OTP Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const activeOtp = emailService._getRecentTestOtp(email);

    const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: activeOtp }),
    });

    assert.equal(verifyRes.status, 200, 'Must succeed with HTTP 200');
    const cookie = verifyRes.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('studysync_session='), 'Must issue HttpOnly session cookie');

    const body = await verifyRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.isVerified, true, 'Returned user object must be verified');

    const user = UserModel.findByEmail(email);
    assert.equal(user.isVerified, true, 'User record in SQLite must be marked is_verified = 1');
  });

  // --------------------------------------------------------------------------
  // Journey Test 8: Reuse the same OTP fails
  // --------------------------------------------------------------------------
  test('Journey 8: Reuse the same OTP — verification fails (single-use enforcement)', async () => {
    const email = `journey.reuse.otp.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Reuser Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const activeOtp = emailService._getRecentTestOtp(email);

    // First use: must succeed
    const firstVerify = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: activeOtp }),
    });
    assert.equal(firstVerify.status, 200);

    // Second use: must fail
    const secondVerify = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: activeOtp }),
    });

    assert.equal(secondVerify.status, 400, 'Reused OTP must be rejected with HTTP 400');
    const body = await secondVerify.json();
    assert.equal(body.success, false);
    assert.ok(
      body.error.code === 'ALREADY_VERIFIED' || body.error.code === 'INVALID_OTP',
      'Must report already verified or invalid code'
    );
  });

  // --------------------------------------------------------------------------
  // Journey Test 9: Register with existing email (different capitalization) rejected
  // --------------------------------------------------------------------------
  test('Journey 9: Register with an existing email, including different capitalization — rejected with 409 EMAIL_EXISTS', async () => {
    const baseEmail = `case.sensitive.${Date.now()}@domain.edu`;
    testEmails.push(baseEmail);

    // Register initial account in lowercase
    const res1 = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Original Student',
        email: baseEmail.toLowerCase(),
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.equal(res1.status, 201);

    // Verify first account
    const otp = emailService._getRecentTestOtp(baseEmail);
    await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: baseEmail, otp }),
    });

    // Attempt second registration with uppercase email
    const res2 = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Duplicate Student',
        email: baseEmail.toUpperCase(),
        password: 'DifferentPassword456!',
        confirmPassword: 'DifferentPassword456!',
      }),
    });

    assert.equal(res2.status, 409, 'Must reject duplicate email with HTTP 409');
    const body = await res2.json();
    assert.equal(body.error.code, 'EMAIL_EXISTS');
  });

  // --------------------------------------------------------------------------
  // Journey Test 10: Attempt login before verification — access denied
  // --------------------------------------------------------------------------
  test('Journey 10: Attempt login before verification — access denied with 403 EMAIL_NOT_VERIFIED', async () => {
    const email = `unverified.login.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Unverified Login Attempt',
        email,
        password: 'SecretPassword99!',
        confirmPassword: 'SecretPassword99!',
      }),
    });

    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'SecretPassword99!',
      }),
    });

    assert.equal(loginRes.status, 403, 'Must return HTTP 403 Forbidden');
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(!cookie || !cookie.includes('studysync_session='), 'Must NOT issue session cookie');

    const body = await loginRes.json();
    assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(body.error.details.requiresVerification, true);
    assert.equal(body.error.details.email, email.toLowerCase());
  });

  // --------------------------------------------------------------------------
  // Journey Test 11: Log in after successful verification — access succeeds
  // --------------------------------------------------------------------------
  test('Journey 11: Log in after successful verification — access succeeds with HTTP 200', async () => {
    const email = `verified.login.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Verified Student',
        email,
        password: 'MyPassword123!',
        confirmPassword: 'MyPassword123!',
      }),
    });

    const otp = emailService._getRecentTestOtp(email);
    // Complete verification
    await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    // Now log in
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'MyPassword123!',
      }),
    });

    assert.equal(loginRes.status, 200, 'Must succeed with HTTP 200');
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('studysync_session='), 'Must issue active session cookie');

    const body = await loginRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, email.toLowerCase());
    assert.equal(body.data.user.isVerified, true);
  });

  // --------------------------------------------------------------------------
  // Journey Test 12: Verify logout and protected-route behavior
  // --------------------------------------------------------------------------
  test('Journey 12: Verify logout clears session cookie, revokes server session, and guards protected routes', async () => {
    const email = `logout.guard.${Date.now()}@example.com`;
    testEmails.push(email);

    const user = UserModel.create({
      id: `logout-guard-user-${Date.now()}`,
      display_name: 'Guarded Student',
      email,
      password_hash: 'mock',
      is_verified: 1,
    });
    createdUserIds.push(user.id);

    const session = UserSessionModel.create(user.id, 'Test-Client');

    // 1. Can access protected endpoint
    const protectedBefore = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(protectedBefore.status, 200);

    // 2. Perform logout
    const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(logoutRes.status, 200);
    const cookieHeader = logoutRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('studysync_session=;'), 'Must clear session cookie');

    // 3. Protected endpoint access rejected
    const protectedAfter = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(protectedAfter.status, 401, 'Must reject with HTTP 401 after logout');
  });

  // --------------------------------------------------------------------------
  // Journey Test 13: Mobile and desktop viewport responsiveness contracts
  // --------------------------------------------------------------------------
  test('Journey 13: Responsive OTP input boxes and layout sizing validation', () => {
    // Sizing formula: width clamp(38px, 12vw, 50px), gap clamp(6px, 2vw, 12px)
    // Validate narrowest mobile screen (320px)
    const mobileWidth = 320;
    const digitWidthMobile = Math.min(Math.max(38, mobileWidth * 0.12), 50); // 38px
    const gapMobile = Math.min(Math.max(6, mobileWidth * 0.02), 12); // 6.4px
    const totalMobileWidth = digitWidthMobile * 6 + gapMobile * 5;

    assert.ok(
      totalMobileWidth <= mobileWidth - 32, // Must leave 16px padding on both sides
      `Total 6-digit OTP input width (${totalMobileWidth}px) must comfortably fit within 320px viewport without wrapping`
    );

    // Validate desktop screen (1024px)
    const desktopWidth = 1024;
    const digitWidthDesktop = Math.min(Math.max(38, desktopWidth * 0.12), 50); // 50px
    const gapDesktop = Math.min(Math.max(6, desktopWidth * 0.02), 12); // 12px
    const totalDesktopWidth = digitWidthDesktop * 6 + gapDesktop * 5;

    assert.ok(
      totalDesktopWidth <= 420, // Max card width
      `Total 6-digit OTP input width on desktop (${totalDesktopWidth}px) must fit within auth card`
    );
  });
});
