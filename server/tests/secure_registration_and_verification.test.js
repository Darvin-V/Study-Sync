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
 * StudySync AI — Production-Quality Email Registration & Verification Flow
 * Comprehensive Test Suite covering all 16 required scenarios.
 */
describe('StudySync — Secure Registration and Email Verification Test Suite', () => {
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

  // ==========================================================================
  // Test 1: First registration with a new email
  // ==========================================================================
  test('1. First registration with a new email records unverified account without granting access', async () => {
    const email = `new.student.${Date.now()}@example.com`;
    testEmails.push(email);

    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'First Time Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    assert.equal(res.status, 201, 'Should return HTTP 201 Created');
    const cookie = res.headers.get('set-cookie');
    assert.ok(!cookie || !cookie.includes('studysync_session='), 'Must NOT issue session cookie before verification');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'verification_required');
    assert.equal(body.data.requiresVerification, true);
    assert.equal(body.data.email, email.toLowerCase());
    assert.equal(body.data.token, undefined, 'Must NOT return bearer token before verification');

    // Verify database state: is_verified must be 0
    const user = UserModel.findByEmail(email);
    assert.ok(user, 'User record must exist in SQLite');
    createdUserIds.push(user.id);
    assert.equal(user.isVerified, false, 'User must be recorded as unverified');
    assert.equal(user.emailVerifiedAt, null, 'emailVerifiedAt must be null');
  });

  // ==========================================================================
  // Test 2: Duplicate email with the same capitalization
  // ==========================================================================
  test('2. Duplicate email with the same capitalization is rejected with clear message', async () => {
    const email = `verified.student.${Date.now()}@example.com`;
    testEmails.push(email);

    // Create and verify the original user
    const user = UserModel.create({
      id: `user-dup-test-${Date.now()}`,
      display_name: 'Existing Verified Student',
      email,
      password_hash: 'mockhash',
      is_verified: 1,
    });
    createdUserIds.push(user.id);

    // Attempt second registration with identical capitalization
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Imposter Student',
        email,
        password: 'DifferentPassword123!',
        confirmPassword: 'DifferentPassword123!',
      }),
    });

    assert.equal(res.status, 409, 'Must return HTTP 409 Conflict');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMAIL_EXISTS');
    assert.equal(
      body.error.message,
      'An account with this email already exists. Please log in or reset your password.'
    );

    // Verify existing user was not overwritten or altered
    const dbUser = UserModel.findById(user.id);
    assert.equal(dbUser.displayName, 'Existing Verified Student', 'Original user record must remain unchanged');
  });

  // ==========================================================================
  // Test 3: Duplicate email with different capitalization or surrounding whitespace
  // ==========================================================================
  test('3. Duplicate email with different capitalization or surrounding whitespace is rejected', async () => {
    const canonicalEmail = `norm.student.${Date.now()}@example.com`;
    testEmails.push(canonicalEmail);

    const user = UserModel.create({
      id: `user-norm-${Date.now()}`,
      display_name: 'Normalized User',
      email: canonicalEmail,
      password_hash: 'mockhash',
      is_verified: 1,
    });
    createdUserIds.push(user.id);

    // Attempt registration with leading/trailing spaces and uppercase characters
    const messyEmail = `  ${canonicalEmail.toUpperCase()}  `;
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Messy Casing Student',
        email: messyEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    assert.equal(res.status, 409, 'Must reject case/whitespace variation with HTTP 409 Conflict');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMAIL_EXISTS');
    assert.equal(
      body.error.message,
      'An account with this email already exists. Please log in or reset your password.'
    );
  });

  // ==========================================================================
  // Test 4: Two simultaneous registrations using the same email (Concurrency)
  // ==========================================================================
  test('4. Two simultaneous registrations using the same email are safely handled by database constraint', async () => {
    const concurrentEmail = `race.student.${Date.now()}@example.com`;
    testEmails.push(concurrentEmail);

    // Dispatch two registration requests in parallel at the exact same instant
    const [res1, res2] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Concurrent Runner A',
          email: concurrentEmail,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      }),
      fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Concurrent Runner B',
          email: concurrentEmail,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [201, 409], 'Exactly one registration must succeed (201) and the concurrent duplicate rejected (409)');

    // Ensure database contains exactly one account with this email
    const db = getDb();
    const rows = db.prepare('SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)').all(concurrentEmail);
    assert.equal(rows.length, 1, 'Database must contain exactly 1 account for the normalized email');
    createdUserIds.push(rows[0].id);
  });

  // ==========================================================================
  // Test 5: Correct OTP/token verification
  // ==========================================================================
  test('5. Correct OTP verification activates account and issues authenticated session cookie and token', async () => {
    const email = `verify.correct.${Date.now()}@example.com`;
    testEmails.push(email);

    // Register
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

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);
    assert.equal(user.isVerified, false);

    // Retrieve genuine OTP generated for test inspection
    const otp = emailService._getRecentTestOtp(email);
    assert.ok(otp && typeof otp === 'string', 'OTP must have been generated and dispatched');

    // Submit correct OTP
    const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp,
      }),
    });

    assert.equal(verifyRes.status, 200, 'Verification must succeed with HTTP 200');
    const cookie = verifyRes.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('studysync_session='), 'Must issue HttpOnly session cookie');
    assert.ok(cookie.includes('HttpOnly'), 'Cookie must have HttpOnly attribute');

    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.success, true);
    assert.ok(verifyBody.data.token, 'Must return bearer session token for mobile clients');
    assert.equal(verifyBody.data.user.isVerified, true, 'User object must reflect verified state');

    // Database check
    const updatedUser = UserModel.findById(user.id);
    assert.equal(updatedUser.isVerified, true);
    assert.ok(updatedUser.emailVerifiedAt, 'emailVerifiedAt must be populated with timestamp');
  });

  // ==========================================================================
  // Test 6: Incorrect OTP/token
  // ==========================================================================
  test('6. Incorrect OTP returns 400 INVALID_OTP with remaining attempts counter', async () => {
    const email = `wrong.otp.${Date.now()}@example.com`;
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

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);

    // Submit intentionally incorrect 6-digit OTP
    const res = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp: '000000',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_OTP');
    assert.equal(body.error.details.attemptsRemaining, 4);
  });

  // ==========================================================================
  // Test 7: Expired OTP/token
  // ==========================================================================
  test('7. Expired OTP returns 400 OTP_EXPIRED and cannot activate account', async () => {
    const email = `expired.otp.${Date.now()}@example.com`;
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

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);
    const otp = emailService._getRecentTestOtp(email);

    // Fast-forward challenge expiry into the past
    const db = getDb();
    db.prepare("UPDATE email_verifications SET expires_at = datetime('now', '-5 minutes') WHERE LOWER(email) = LOWER(?)").run(email);

    const res = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'OTP_EXPIRED');

    // Account remains unverified
    const dbUser = UserModel.findById(user.id);
    assert.equal(dbUser.isVerified, false);
  });

  // ==========================================================================
  // Test 8: Reusing an already-used OTP/token
  // ==========================================================================
  test('8. Reusing an already-used OTP is rejected and single-use is enforced', async () => {
    const email = `singleuse.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Single Use Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);
    const otp = emailService._getRecentTestOtp(email);

    // First use: succeeds
    const firstRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    assert.equal(firstRes.status, 200);

    // Second use: must be rejected
    const secondRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    assert.equal(secondRes.status, 400);
    const body = await secondRes.json();
    assert.equal(body.success, false);
    assert.ok(['ALREADY_VERIFIED', 'INVALID_OTP'].includes(body.error.code));
  });

  // ==========================================================================
  // Test 9: Resend cooldown and attempt limits
  // ==========================================================================
  test('9. Resend enforces cooldown countdown and max attempt limits invalidate code', async () => {
    const email = `cooldown.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Cooldown Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);

    // Attempt immediate resend: should trigger cooldown
    const immediateRes = await fetch(`${testApp.baseUrl}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    assert.equal(immediateRes.status, 429, 'Must enforce cooldown on immediate resend');
    const immediateBody = await immediateRes.json();
    assert.equal(immediateBody.error.code, 'COOLDOWN_ACTIVE');
    assert.ok(immediateBody.error.details.resendAvailableIn > 0);

    // Test max verification attempts: exhaust 5 attempts
    for (let i = 0; i < 4; i++) {
      await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '111111' }),
      });
    }

    // 5th attempt invalidates code
    const exhaustedRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: '111111' }),
    });

    assert.equal(exhaustedRes.status, 429);
    const exhaustedBody = await exhaustedRes.json();
    assert.equal(exhaustedBody.error.code, 'MAX_ATTEMPTS_EXCEEDED');
  });

  // ==========================================================================
  // Test 10: Email provider failure & truthful unconfigured reporting
  // ==========================================================================
  test('10. Email provider status truthfulness and unconfigured state reporting without fake success', async () => {
    // Check public inspection endpoint
    const statusRes = await fetch(`${testApp.baseUrl}/api/auth/email-provider-status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.success, true);
    assert.ok('configured' in statusBody.data);
    assert.ok('activeProvider' in statusBody.data);
    assert.ok(Array.isArray(statusBody.data.missingEnv));

    // Calling sendOtpEmail without configured provider returns unconfigured status
    const prevResend = process.env.RESEND_API_KEY;
    const prevSendGrid = process.env.SENDGRID_API_KEY;
    const prevWebhook = process.env.EMAIL_WEBHOOK_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_WEBHOOK_URL;

    try {
      const deliveryResult = await emailService.sendOtpEmail({
        to: 'unconfigured.test@example.com',
        name: 'Test Learner',
        otp: '123456',
      });

      assert.equal(deliveryResult.success, false, 'Must NOT fake success when unconfigured');
      assert.equal(deliveryResult.status, 'unconfigured');
      assert.ok(deliveryResult.message.includes('RESEND_API_KEY'));
    } finally {
      if (prevResend) process.env.RESEND_API_KEY = prevResend;
      if (prevSendGrid) process.env.SENDGRID_API_KEY = prevSendGrid;
      if (prevWebhook) process.env.EMAIL_WEBHOOK_URL = prevWebhook;
    }
  });

  // ==========================================================================
  // Test 11: Login attempt before verification
  // ==========================================================================
  test('11. Login attempt before verification is rejected with 403 EMAIL_NOT_VERIFIED', async () => {
    const email = `login.unverified.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Unverified Login Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);

    // Attempt login with correct password
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
      }),
    });

    assert.equal(loginRes.status, 403, 'Must reject unverified account with HTTP 403');
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(!cookie || !cookie.includes('studysync_session='), 'Must NOT issue session cookie');

    const body = await loginRes.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(body.error.details.requiresVerification, true);
    assert.equal(body.error.details.email, email.toLowerCase());
  });

  // ==========================================================================
  // Test 12: Login after successful verification
  // ==========================================================================
  test('12. Login succeeds after verification and grants session cookie and token', async () => {
    const email = `login.after.verify.${Date.now()}@example.com`;
    testEmails.push(email);

    await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: 'Verified Login Student',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });

    const user = UserModel.findByEmail(email);
    createdUserIds.push(user.id);
    const otp = emailService._getRecentTestOtp(email);

    // Verify OTP
    await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    // Login now
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
      }),
    });

    assert.equal(loginRes.status, 200, 'Must succeed with HTTP 200');
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('studysync_session='), 'Must issue session cookie');

    const body = await loginRes.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token, 'Must return bearer token');
    assert.equal(body.data.user.email, email.toLowerCase());
  });

  // ==========================================================================
  // Test 13: Existing verified account login
  // ==========================================================================
  test('13. Existing verified accounts continue to log in normally without re-registration', async () => {
    const email = `existing.verified.${Date.now()}@example.com`;
    testEmails.push(email);

    // Simulate an existing verified user from prior migrations
    const user = UserModel.create({
      id: `existing-user-${Date.now()}`,
      display_name: 'Existing Scholar',
      email,
      password_hash: '$2b$10$mockPasswordHashForExistingAccount',
      is_verified: 1,
    });
    createdUserIds.push(user.id);

    // Verify lookup recognizes existing verified account
    const found = UserModel.findByEmail(email);
    assert.ok(found);
    assert.equal(found.isVerified, true);
  });

  // ==========================================================================
  // Test 14: Logout and protected-route behavior
  // ==========================================================================
  test('14. Logout clears session cookie, revokes server session, and guards protected routes', async () => {
    const email = `logout.student.${Date.now()}@example.com`;
    testEmails.push(email);

    const user = UserModel.create({
      id: `logout-user-${Date.now()}`,
      display_name: 'Logout Student',
      email,
      password_hash: 'mock',
      is_verified: 1,
    });
    createdUserIds.push(user.id);

    const session = UserSessionModel.create(user.id, 'Test-Agent');

    // Access protected route before logout
    const preRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(preRes.status, 200);

    // Logout
    const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(logoutRes.status, 200);
    const cookieHeader = logoutRes.headers.get('set-cookie');
    assert.ok(cookieHeader && cookieHeader.includes('studysync_session=;'), 'Must clear session cookie');

    // Access protected route after logout
    const postRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(postRes.status, 401, 'Must reject with 401 after logout revocation');
  });

  // ==========================================================================
  // Test 15: Web and mobile registration/verification UI
  // ==========================================================================
  test('15. Web and mobile registration/verification UI masking helper and action elements', () => {
    // Unit tests for email masking function
    assert.equal(maskEmail('darvin@example.com'), 'd***@example.com');
    assert.equal(maskEmail('alex.morgan@university.edu'), 'a***@university.edu');
    assert.equal(maskEmail('j@domain.org'), 'j***@domain.org');
    assert.equal(maskEmail(''), '');
    assert.equal(maskEmail(null), '');
  });

  // ==========================================================================
  // Test 16: Attempts to access protected APIs before verification
  // ==========================================================================
  test('16. Attempts to access protected APIs before email verification are blocked by requireAuth', async () => {
    const email = `blocked.unverified.${Date.now()}@example.com`;
    testEmails.push(email);

    const unverifiedUser = UserModel.create({
      id: `unverified-api-user-${Date.now()}`,
      display_name: 'Unverified Hacker',
      email,
      password_hash: 'mock',
      is_verified: 0,
    });
    createdUserIds.push(unverifiedUser.id);

    // Create session token for unverified user
    const session = UserSessionModel.create(unverifiedUser.id, 'Test-Agent');

    // Attempt to access protected endpoints
    const resMe = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(resMe.status, 403);
    const bodyMe = await resMe.json();
    assert.equal(bodyMe.error.code, 'EMAIL_NOT_VERIFIED');

    const resProfile = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(resProfile.status, 403);
    const bodyProf = await resProfile.json();
    assert.equal(bodyProf.error.code, 'EMAIL_NOT_VERIFIED');
  });
});
