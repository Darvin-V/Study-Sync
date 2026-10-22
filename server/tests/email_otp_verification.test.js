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

describe('StudySync AI — Email OTP Verification & Secure Registration Suite', () => {
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
  // 1. Registration Flow & Initial Unverified State
  // ==========================================================================
  describe('1. Registration Flow & Unverified Defense', () => {
    const email = `otp.student.${Date.now()}@example.com`;
    testEmails.push(email);

    test('1.1 Registration requires email verification and does NOT issue session or cookie', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Jane Learner',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 201);
      const setCookie = res.headers.get('set-cookie');
      assert.equal(setCookie, null, 'Must NOT set session cookie before email verification');

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'verification_required');
      assert.equal(body.data.requiresVerification, true);
      assert.equal(body.data.email, email);
      assert.equal(body.data.token, undefined, 'Must NOT return session token before verification');
      assert.ok(body.data.emailDelivery, 'Must report email delivery status');

      // Verify database record has is_verified = 0
      const user = UserModel.findByEmail(email);
      assert.ok(user, 'User record must exist in SQLite');
      assert.equal(user.isVerified, false, 'User must initially be unverified');
      assert.equal(user.emailVerifiedAt, null, 'emailVerifiedAt must be null initially');
      createdUserIds.push(user.id);
    });

    test('1.2 Unverified user CANNOT log in before completing OTP verification', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 403, 'Login must reject unverified accounts with HTTP 403');
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
      assert.equal(body.error.details.requiresVerification, true);

      const setCookie = res.headers.get('set-cookie');
      assert.equal(setCookie, null, 'Must not issue cookie for unverified login');
    });

    test('1.3 Direct API access as an unverified user is rejected with HTTP 403', async () => {
      const user = UserModel.findByEmail(email);
      // Even if an unverified user somehow possessed a session token
      const fakeSession = UserSessionModel.create(user.id);

      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${fakeSession.token}`,
        },
      });

      assert.equal(res.status, 403, 'Protected endpoint must reject unverified user with 403');
      const body = await res.json();
      assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
    });

    test('1.4 Duplicate registration for unverified email returns safe EMAIL_NOT_VERIFIED error', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Jane Duplicate',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
      assert.equal(body.error.details.requiresVerification, true);
    });
  });

  // ==========================================================================
  // 2. OTP Verification Defense (Incorrect, Expired, Attempts, Superseded)
  // ==========================================================================
  describe('2. OTP Security Bounds & Cryptographic Verification', () => {
    const email = `otp.security.${Date.now()}@example.com`;
    testEmails.push(email);

    before(async () => {
      await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Security Learner',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const user = UserModel.findByEmail(email);
      if (user) createdUserIds.push(user.id);
    });

    test('2.1 Non-numeric or wrong-length OTP is rejected with 400 VALIDATION_ERROR', async () => {
      const invalidOtps = ['12345', '1234567', 'abcdef', '12 345', ''];
      for (const badOtp of invalidOtps) {
        const res = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: badOtp }),
        });
        assert.equal(res.status, 400, `OTP "${badOtp}" should be rejected with 400`);
      }
    });

    test('2.2 Incorrect 6-digit OTP fails and returns remaining attempts count', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '000000' }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'INVALID_OTP');
      assert.ok(typeof body.error.details.attemptsRemaining === 'number');
      assert.equal(body.error.details.attemptsRemaining, 4);
    });

    test('2.3 Exceeding maximum attempts (5 tries) invalidates the code with 429', async () => {
      // 4 more incorrect attempts (reaches 5 total attempts)
      for (let i = 0; i < 3; i++) {
        await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: `11111${i}` }),
        });
      }

      // 5th attempt: should trigger invalidation
      const res5 = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '999999' }),
      });

      assert.equal(res5.status, 429);
      const body5 = await res5.json();
      assert.equal(body5.error.code, 'MAX_ATTEMPTS_EXCEEDED');

      // Even if user now presents the real code, it must be rejected because it was invalidated
      const realOtp = emailService._getRecentTestOtp(email);
      const resPost = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: realOtp }),
      });
      assert.equal(resPost.status, 400, 'Invalidated code cannot verify account even if correct');
    });

    test('2.4 Cooldown prevents immediate spamming of resend-otp', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Cooldown of 60s was active from registration
      assert.equal(res.status, 429);
      const body = await res.json();
      assert.equal(body.error.code, 'COOLDOWN_ACTIVE');
      assert.ok(body.error.details.resendAvailableIn > 0);
    });

    test('2.5 Superseded code defense: generating new code invalidates prior code', async () => {
      const emailSuperseded = `superseded.${Date.now()}@example.com`;
      testEmails.push(emailSuperseded);

      await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Superseded Learner',
          email: emailSuperseded,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      const user = UserModel.findByEmail(emailSuperseded);
      createdUserIds.push(user.id);

      const firstOtp = emailService._getRecentTestOtp(emailSuperseded);
      assert.ok(firstOtp, 'First OTP must be recorded in test runner');

      // Clear cooldown in db to simulate cooldown passage
      const db = getDb();
      db.prepare(`
        UPDATE email_verifications 
        SET resend_available_at = datetime('now', '-5 seconds') 
        WHERE LOWER(email) = LOWER(?)
      `).run(emailSuperseded);

      // Resend to generate a second OTP
      const resendRes = await fetch(`${testApp.baseUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailSuperseded }),
      });
      assert.equal(resendRes.status, 200);

      const secondOtp = emailService._getRecentTestOtp(emailSuperseded);
      assert.ok(secondOtp, 'Second OTP must be generated');

      // Attempt verification with the first (superseded) code: MUST fail!
      const verifyFirstRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailSuperseded, otp: firstOtp }),
      });
      assert.equal(verifyFirstRes.status, 400, 'Superseded code must fail verification');

      // Attempt verification with second code: MUST succeed!
      const verifySecondRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailSuperseded, otp: secondOtp }),
      });
      assert.equal(verifySecondRes.status, 200, 'Fresh code must succeed verification');
    });

    test('2.6 Expired OTP code cannot verify an account', async () => {
      const emailExpired = `expired.${Date.now()}@example.com`;
      testEmails.push(emailExpired);

      await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Expired Learner',
          email: emailExpired,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      const user = UserModel.findByEmail(emailExpired);
      createdUserIds.push(user.id);
      const otp = emailService._getRecentTestOtp(emailExpired);

      // Simulate code expiration in SQLite
      const db = getDb();
      db.prepare(`
        UPDATE email_verifications 
        SET expires_at = datetime('now', '-1 minute') 
        WHERE LOWER(email) = LOWER(?)
      `).run(emailExpired);

      const res = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailExpired, otp }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'OTP_EXPIRED');
    });
  });

  // ==========================================================================
  // 3. Complete Successful Verification Flow & Session Issuance
  // ==========================================================================
  describe('3. Successful Verification, Session Issuance & Account Activation', () => {
    const email = `success.student.${Date.now()}@example.com`;
    testEmails.push(email);
    let correctOtp;
    let verifiedUserId;
    let authCookie;

    test('3.1 Successful OTP verification marks account active, issues session cookie and token', async () => {
      // 1. Register unverified
      await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Success Student',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      correctOtp = emailService._getRecentTestOtp(email);
      assert.ok(correctOtp, 'Cryptographic OTP must be available to test harness');

      // 2. Submit correct OTP
      const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: correctOtp,
        }),
      });

      assert.equal(verifyRes.status, 200);

      // Verify Set-Cookie header is issued
      const setCookie = verifyRes.headers.get('set-cookie');
      assert.ok(setCookie, 'Must issue Set-Cookie upon successful OTP verification');
      assert.ok(setCookie.includes('studysync_session='), 'Cookie must be studysync_session');
      assert.ok(setCookie.includes('HttpOnly') || setCookie.includes('httponly'));

      const match = setCookie.match(/studysync_session=([^;]+)/);
      authCookie = match[1];

      const body = await verifyRes.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.email, email);
      assert.equal(body.data.user.isVerified, true, 'User must now be verified');
      assert.ok(body.data.user.emailVerifiedAt, 'emailVerifiedAt must be populated');
      assert.ok(body.data.token, 'Session token must be returned for native clients');

      verifiedUserId = body.data.user.id;
      createdUserIds.push(verifiedUserId);

      // Verify SQLite state
      const dbUser = UserModel.findById(verifiedUserId);
      assert.equal(dbUser.isVerified, true);
      assert.ok(dbUser.emailVerifiedAt);
    });

    test('3.2 Verified user can access protected endpoints via session cookie', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `studysync_session=${authCookie}`,
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.user.id, verifiedUserId);
      assert.equal(body.data.user.isVerified, true);
    });

    test('3.3 Re-submitting the same OTP returns 400 ALREADY_VERIFIED', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: correctOtp,
        }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'ALREADY_VERIFIED');
    });

    test('3.4 Verified user can now log in normally through POST /api/auth/login', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Password123!',
        }),
      });

      assert.equal(res.status, 200, 'Verified user must be able to log in successfully');
      const body = await res.json();
      assert.equal(body.data.user.id, verifiedUserId);
      assert.equal(body.data.user.isVerified, true);
    });

    test('3.5 Duplicate registration of verified email is rejected with 409 EMAIL_EXISTS', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Another Name',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.error.code, 'EMAIL_EXISTS');
    });
  });

  // ==========================================================================
  // 4. Email Provider Inspection & Existing Accounts Migration
  // ==========================================================================
  describe('4. Email Provider Abstraction & Existing Accounts Safety', () => {
    test('4.1 GET /api/auth/email-provider-status returns structured status without exposing secrets', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/email-provider-status`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok('configured' in body.data);
      assert.ok('activeProvider' in body.data);
      assert.ok(Array.isArray(body.data.missingEnv));
    });

    test('4.2 Existing verified seed accounts have email_verified_at backfilled', () => {
      const darvin = UserModel.findByEmail('darvin@demo.studysync.ai');
      if (darvin) {
        assert.equal(darvin.isVerified, true);
        assert.ok(darvin.emailVerifiedAt, 'Existing seed accounts must have emailVerifiedAt backfilled by migration');
      }
    });
  });
});
