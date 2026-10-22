import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import UserModel from '../models/user.model.js';
import EmailVerificationModel from '../models/emailVerification.model.js';
import { emailService } from '../services/email/emailService.js';
import { _resetRateLimits } from '../middleware/authMiddleware.js';
import { maskEmail } from '../../src/utils/maskEmail.js';

describe('Create Account Button & Registration Flow Diagnostics and End-to-End Tests', () => {
  let testApp;
  const createdEmails = [];
  const createdUserIds = [];

  before(async () => {
    testApp = await startTestServer();
  });

  beforeEach(() => {
    _resetRateLimits();
  });

  after(async () => {
    const db = getDb();
    try {
      for (const email of createdEmails) {
        db.prepare('DELETE FROM email_verifications WHERE LOWER(email) = LOWER(?)').run(email);
      }
      for (const uid of createdUserIds) {
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      }
    } catch {
      // Cleanup best-effort
    }

    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // 1. Static Component & CSS Contract Audits (Root Cause Verifications)
  // ==========================================================================
  describe('1. Registration Button & Form Architectural Contracts', () => {
    const authPagePath = path.resolve('src/components/Auth/AuthPage.jsx');
    const authPageSrc = fs.readFileSync(authPagePath, 'utf8');

    test('1.1 Mode sync useEffect does NOT include "mode" in its dependency array', () => {
      // Root cause check: having [initialMode, mode] caused React to revert any tab change
      assert.ok(
        !authPageSrc.includes('[initialMode, mode]'),
        'useEffect must not have mode in its dependency array, which caused immediate revert back to initialMode'
      );
      assert.ok(
        authPageSrc.includes('[initialMode]'),
        'useEffect must depend exclusively on initialMode'
      );
    });

    test('1.2 Registration form has "noValidate" to allow JavaScript inline validation', () => {
      // When required is on inputs without noValidate, native browser popups intercept submit
      assert.ok(
        authPageSrc.includes('noValidate') && authPageSrc.includes('id="register-form"'),
        'Registration form must include noValidate to prevent native HTML5 validation from intercepting the submit button'
      );
    });

    test('1.3 Create Account button has submit type, explicit id, pointerEvents, and minHeight 44px', () => {
      assert.ok(authPageSrc.includes('id="register-submit-btn"'), 'Must have id="register-submit-btn"');
      assert.ok(authPageSrc.includes('type="submit"'), 'Must have type="submit"');
      assert.ok(authPageSrc.includes('minHeight: 44'), 'Must have minimum 44px height for touch target accessibility');
      assert.ok(authPageSrc.includes("pointerEvents: 'auto'"), 'Must have pointerEvents: auto');
    });

    test('1.4 Auth card container has relative positioning and safe margin', () => {
      assert.ok(
        authPageSrc.includes("margin: '16px 0'"),
        'auth-card-container should not use margin: "auto 0" which clips on small viewports'
      );
      assert.ok(authPageSrc.includes('zIndex: 5'), 'auth-card-container should have clear stacking context');
    });

    test('1.5 All 4 registration inputs have explicit field error display elements', () => {
      assert.ok(authPageSrc.includes('id="register-display-name-error"'));
      assert.ok(authPageSrc.includes('id="register-email-error"'));
      assert.ok(authPageSrc.includes('id="register-password-error"'));
      assert.ok(authPageSrc.includes('id="register-confirm-password-error"'));
    });
  });

  // ==========================================================================
  // 2. Client Validation Logic Simulation
  // ==========================================================================
  describe('2. Client Validation & Error Messaging Logic', () => {
    function validateRegistrationForm({ displayName, email, password, confirmPassword }) {
      const errs = {};
      if (!displayName || !displayName.trim()) {
        errs.displayName = 'Display name is required';
      } else if (displayName.trim().length < 2) {
        errs.displayName = 'Display name must be at least 2 characters';
      }

      if (!email || !email.trim()) {
        errs.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = 'Please enter a valid email address';
      }

      if (!password) {
        errs.password = 'Password is required';
      } else if (password.length < 8) {
        errs.password = 'Password must be at least 8 characters long';
      }

      if (!confirmPassword) {
        errs.confirmPassword = 'Confirm password is required';
      } else if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match';
      }

      return errs;
    }

    test('2.1 Empty fields yield four distinct required error messages', () => {
      const errs = validateRegistrationForm({
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      assert.equal(errs.displayName, 'Display name is required');
      assert.equal(errs.email, 'Email address is required');
      assert.equal(errs.password, 'Password is required');
      assert.equal(errs.confirmPassword, 'Confirm password is required');
    });

    test('2.2 Invalid formats yield descriptive actionable error messages', () => {
      const errs = validateRegistrationForm({
        displayName: 'A',
        email: 'invalid-email-format',
        password: 'short',
        confirmPassword: 'mismatch-password',
      });
      assert.equal(errs.displayName, 'Display name must be at least 2 characters');
      assert.equal(errs.email, 'Please enter a valid email address');
      assert.equal(errs.password, 'Password must be at least 8 characters long');
      assert.equal(errs.confirmPassword, 'Passwords do not match');
    });

    test('2.3 Completely valid inputs produce zero validation errors', () => {
      const errs = validateRegistrationForm({
        displayName: 'Dr. Katherine Johnson',
        email: 'katherine.johnson@nasa.gov',
        password: 'SuperSecretPassword123!',
        confirmPassword: 'SuperSecretPassword123!',
      });
      assert.equal(Object.keys(errs).length, 0);
    });
  });

  // ==========================================================================
  // 3. Complete End-to-End Registration Flow & API Integration
  // ==========================================================================
  describe('3. Registration API, OTP Generation, and Duplicate Handling', () => {
    const testEmail = `create.btn.test.${Date.now()}@example.com`;
    createdEmails.push(testEmail);

    test('3.1 Valid registration initiates OTP flow and responds with requiresVerification: true', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Test Learner Alpha',
          email: testEmail,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.requiresVerification, true);
      assert.equal(body.data.email, testEmail.toLowerCase());
      assert.ok(body.data.emailDelivery, 'Email delivery status metadata must be returned');

      const user = UserModel.findByEmail(testEmail);
      assert.ok(user, 'User must exist in SQLite');
      createdUserIds.push(user.id);
    });

    test('3.2 Duplicate email submission (case-insensitive) is strictly rejected with 409', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Duplicate Attempter',
          email: testEmail.toUpperCase(),
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 409);
      assert.equal(body.success, false);
      assert.ok(
        body.error.code === 'EMAIL_EXISTS' || body.error.code === 'EMAIL_NOT_VERIFIED',
        'Must reject duplicate with 409'
      );
    });

    test('3.3 Masked email helper formats destination email correctly for Step 2 screen', () => {
      assert.equal(maskEmail('alice.walker@example.com'), 'a***@example.com');
      assert.equal(maskEmail(testEmail), `${testEmail[0]}***@example.com`);
      assert.equal(maskEmail(''), '');
    });

    test('3.4 OTP record exists in database and user is marked unverified before verification', () => {
      const activeRecord = EmailVerificationModel.findLatestActive(testEmail);
      assert.ok(activeRecord, 'Active email verification record must exist in SQLite database');
      assert.equal(activeRecord.email, testEmail.toLowerCase());
      assert.equal(activeRecord.attempts, 0, 'Attempts must start at 0');

      const user = UserModel.findByEmail(testEmail);
      assert.equal(user.isVerified, false, 'User must remain unverified prior to OTP submission');
    });

    test('3.5 Unverified user cannot log in before completing OTP verification', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          email: testEmail,
          password: 'Password123!',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 403, 'Unverified user login must return HTTP 403');
      assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
      assert.equal(body.error.details.requiresVerification, true);
    });

    test('3.6 Complete OTP verification: user becomes verified and authenticated session is established', async () => {
      const activeOtp = emailService._getRecentTestOtp(testEmail);
      assert.ok(activeOtp, 'Active OTP must be retrievable in test environment');

      const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          otp: activeOtp,
        }),
      });

      const verifyBody = await verifyRes.json();
      assert.equal(verifyRes.status, 200, 'Verification with correct OTP must return 200');
      assert.equal(verifyBody.success, true);
      assert.equal(verifyBody.data.user.email, testEmail.toLowerCase());

      // Confirm HttpOnly cookie was set
      const cookies = verifyRes.headers.get('set-cookie');
      assert.ok(cookies, 'HttpOnly session cookie must be set on successful OTP verification');
      assert.ok(cookies.includes('studysync_session='));

      // Confirm user record is updated in database
      const verifiedUser = UserModel.findByEmail(testEmail);
      assert.equal(verifiedUser.isVerified, true, 'User isVerified must now be true');
      assert.ok(verifiedUser.emailVerifiedAt, 'emailVerifiedAt timestamp must now be populated');
    });

    test('3.7 Verified user can now log in normally and access protected session', async () => {
      const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'Password123!',
        }),
      });

      const loginBody = await loginRes.json();
      assert.equal(loginRes.status, 200);
      assert.equal(loginBody.success, true);
      assert.equal(loginBody.data.user.email, testEmail.toLowerCase());

      const cookieHeader = loginRes.headers.get('set-cookie');
      const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';

      // Test protected route /api/auth/me with session cookie
      const meRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Cookie: sessionCookie },
      });
      const meBody = await meRes.json();
      assert.equal(meRes.status, 200);
      assert.equal(meBody.data.user.email, testEmail.toLowerCase());
    });
  });
});
