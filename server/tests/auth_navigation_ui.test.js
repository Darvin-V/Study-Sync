process.env.NODE_ENV = 'test';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import UserModel from '../models/user.model.js';
import EmailVerificationModel from '../models/emailVerification.model.js';
import { _resetRateLimits } from '../middleware/authMiddleware.js';

describe('Auth Navigation UI & Flow Requirements', () => {
  let testApp;
  const createdEmails = [];
  const createdUserIds = [];

  const authPagePath = path.resolve('src/components/Auth/AuthPage.jsx');
  const authPageSrc = fs.readFileSync(authPagePath, 'utf8');

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
      // Best effort cleanup
    }
    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // 1. Email OTP Verification Screen UI Organization
  // ==========================================================================
  describe('1. Email OTP verification screen layout and navigation', () => {
    test('1.1 Small back-arrow button with "Back" label exists at top-left of the verification card', () => {
      // Must have the id back-to-register-btn
      assert.ok(authPageSrc.includes('id="back-to-register-btn"'));
      assert.ok(authPageSrc.includes('<span>Back</span>'));
      assert.ok(authPageSrc.includes('<svg'));
      // Must be rendered at the top of the card container when mode === verify-otp
      const cardContainerIndex = authPageSrc.indexOf('id="auth-card-container"');
      const backBtnIndex = authPageSrc.indexOf('id="back-to-register-btn"');
      const otpFormIndex = authPageSrc.indexOf('id="verify-otp-form"');
      assert.ok(cardContainerIndex !== -1, 'auth-card-container must exist');
      assert.ok(backBtnIndex !== -1, 'back-to-register-btn must exist');
      assert.ok(otpFormIndex !== -1, 'verify-otp-form must exist');
      assert.ok(
        cardContainerIndex < backBtnIndex && backBtnIndex < otpFormIndex,
        'Back button must be positioned at the top of the card before the OTP form'
      );
    });

    test('1.2 There are NO large bottom navigation buttons or duplicate back buttons', () => {
      // Matches of id="back-to-register-btn" must equal exactly 1
      const matches = authPageSrc.match(/id="back-to-register-btn"/g);
      assert.equal(matches.length, 1, 'There must be exactly one back-to-register button on the screen');
      // No duplicate back-to-login button at the bottom of the card
      assert.ok(!authPageSrc.includes('id="back-to-login-btn"'));
      assert.ok(!authPageSrc.includes('Back to Registration'));
      assert.ok(!authPageSrc.includes('Back to Sign In'));
    });

    test('1.3 OTP Verification form has clean layout hierarchy: heading, masked email, OTP digits, Verify button, Resend action', () => {
      const headingIdx = authPageSrc.indexOf('Verify Your Email');
      const maskedEmailIdx = authPageSrc.indexOf('id="masked-recipient-email"');
      const digitsIdx = authPageSrc.indexOf('id="otp-digits-container"');
      const verifyBtnIdx = authPageSrc.indexOf('id="verify-otp-submit-btn"');
      const resendBtnIdx = authPageSrc.indexOf('id="resend-otp-btn"');

      assert.ok(headingIdx !== -1, 'Must have Verify Your Email heading');
      assert.ok(maskedEmailIdx !== -1, 'Must have masked email element');
      assert.ok(digitsIdx !== -1, 'Must have OTP digits container');
      assert.ok(verifyBtnIdx !== -1, 'Must have verify-otp-submit-btn');
      assert.ok(resendBtnIdx !== -1, 'Must have resend-otp-btn');

      assert.ok(
        headingIdx < maskedEmailIdx &&
        maskedEmailIdx < digitsIdx &&
        digitsIdx < verifyBtnIdx &&
        verifyBtnIdx < resendBtnIdx,
        'Form elements must follow clear vertical hierarchy without misplaced links'
      );
    });

    test('1.4 Single status notification: unconfigured notice and success alerts are mutually exclusive', () => {
      assert.ok(authPageSrc.includes('id="otp-unconfigured-notice"'), 'Must have otp-unconfigured-notice element');
      assert.ok(authPageSrc.includes('id="otp-accepted-notice"'), 'Must have otp-accepted-notice element');
      assert.ok(authPageSrc.includes('id="otp-delivery-failed-notice"'), 'Must have otp-delivery-failed-notice element');
      // Verify mutual exclusivity via single status IIFE
      assert.ok(
        authPageSrc.includes("if (otpDeliveryStatus?.status === 'unconfigured')"),
        'Unconfigured notice must check status explicitly'
      );
      assert.ok(
        authPageSrc.includes("if (otpDeliveryStatus?.status === 'accepted')"),
        'Accepted notice must check status explicitly'
      );
    });

    test('1.5 Resend interaction is suppressed when unconfigured and restored when provider is available', () => {
      assert.ok(
        authPageSrc.includes("otpDeliveryStatus?.status !== 'unconfigured'"),
        'Resend interaction must only be rendered when email delivery is available'
      );
      assert.ok(
        authPageSrc.includes('id="resend-otp-btn"'),
        'Must contain resend button for when provider is configured'
      );
    });

    test('1.6 Compact non-technical warning panel: displays friendly message without environment variables', () => {
      assert.ok(
        authPageSrc.includes('Email verification is temporarily unavailable. Please try again later.'),
        'Must display exact friendly message'
      );
      assert.ok(!authPageSrc.includes('RESEND_API_KEY'), 'Must NOT expose RESEND_API_KEY to user-facing UI');
      assert.ok(!authPageSrc.includes('SENDGRID_API_KEY'), 'Must NOT expose SENDGRID_API_KEY to user-facing UI');
      assert.ok(!authPageSrc.includes('EMAIL_WEBHOOK_URL'), 'Must NOT expose EMAIL_WEBHOOK_URL to user-facing UI');
    });

    test('1.7 Unconfigured state suppresses empty OTP inputs and provides clear return action', () => {
      assert.ok(
        authPageSrc.includes('id="otp-unavailable-state-container"'),
        'Must have container for unavailable delivery state'
      );
      assert.ok(
        authPageSrc.includes('id="return-to-registration-btn"'),
        'Must provide a working Return to Registration button when unconfigured'
      );
    });
  });

  // ==========================================================================
  // 2. Registration Screen UI Organization
  // ==========================================================================
  describe('2. Registration screen layout and navigation', () => {
    test('2.1 No misplaced "Back to Registration" control inside the registration form', () => {
      const regFormStart = authPageSrc.indexOf('id="register-form"');
      const regFormEnd = authPageSrc.indexOf('</form>', regFormStart);
      const regFormContent = authPageSrc.slice(regFormStart, regFormEnd);

      assert.ok(
        !regFormContent.includes('Back to Registration'),
        'Registration form must not have a "Back to Registration" control'
      );
      assert.ok(
        !regFormContent.includes('back-to-register-btn'),
        'Registration form must not contain back-to-register-btn'
      );
    });

    test('2.2 "Already have an account? Sign in" is placed directly below Create Account button', () => {
      const regSubmitBtnIdx = authPageSrc.indexOf('id="register-submit-btn"');
      const gotoLoginLinkIdx = authPageSrc.indexOf('id="goto-login-link"');
      assert.ok(regSubmitBtnIdx !== -1);
      assert.ok(gotoLoginLinkIdx !== -1);
      assert.ok(
        regSubmitBtnIdx < gotoLoginLinkIdx,
        '"Already have an account? Sign in" must be placed below the Create Account button'
      );

      // Verify wording
      assert.ok(authPageSrc.includes('Already have an account?'));
      assert.ok(/Sign\s+[iI]n\s*<\/button>/.test(authPageSrc));
    });
  });

  // ==========================================================================
  // 3. Sign-in Screen UI Organization
  // ==========================================================================
  describe('3. Sign-in screen layout and navigation', () => {
    test('3.1 "Don\'t have an account? Create account" is placed directly below Sign In button', () => {
      const loginSubmitBtnIdx = authPageSrc.indexOf('id="login-submit-btn"');
      const gotoRegisterLinkIdx = authPageSrc.indexOf('id="goto-register-link"');
      assert.ok(loginSubmitBtnIdx !== -1);
      assert.ok(gotoRegisterLinkIdx !== -1);
      assert.ok(
        loginSubmitBtnIdx < gotoRegisterLinkIdx,
        '"Don\'t have an account? Create account" must be placed directly below the Sign In button'
      );

      // Verify wording
      assert.ok(authPageSrc.includes("Don't have an account?"));
      assert.ok(authPageSrc.includes('Create account'));
    });
  });

  // ==========================================================================
  // 4. Functional Verification: Back Navigation & State Invariants
  // ==========================================================================
  describe('4. Functional navigation and security invariants', () => {
    test('4.1 Registration initiates OTP without establishing session', async () => {
      const email = `nav.test.${Date.now()}@university.edu`;
      createdEmails.push(email);

      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Nav Test Learner',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.requiresVerification, true);

      const user = UserModel.findByEmail(email);
      assert.ok(user);
      assert.equal(user.isVerified, false);
      createdUserIds.push(user.id);
    });

    test('4.2 Resend OTP adheres to rate limits / cooldown', async () => {
      const email = `resend.test.${Date.now()}@university.edu`;
      createdEmails.push(email);

      // Register first to create user
      await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-require-otp-verification': 'true',
        },
        body: JSON.stringify({
          displayName: 'Resend Learner',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      // Advance/reset cooldown in verification record to allow one resend
      const db = getDb();
      db.prepare("UPDATE email_verifications SET resend_available_at = datetime('now', '-10 seconds') WHERE LOWER(email) = LOWER(?)").run(email);

      const res1 = await fetch(`${testApp.baseUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal(res1.status, 200);

      // Immediate resend attempt must hit cooldown
      const res2 = await fetch(`${testApp.baseUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal(res2.status, 429);
      const err = await res2.json();
      assert.equal(err.error?.code, 'COOLDOWN_ACTIVE');
    });

    test('4.3 Browser history state support: popstate listener and pushState are wired for OTP step', () => {
      assert.ok(authPageSrc.includes('popstate'), 'Must listen to popstate for browser back navigation');
      assert.ok(authPageSrc.includes('pushState'), 'Must push state when entering verify-otp step');
      assert.ok(authPageSrc.includes('history.back()'), 'Back button should pop history cleanly if pushed');
    });
  });
});
