import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startTestServer } from './testHelper.js';
import { validateProductionEnv } from '../config/env.js';
import { _resetRateLimits } from '../middleware/authMiddleware.js';
import BackupManager from '../db/backup.js';

describe('Security Audit and Production Readiness Tests', () => {
  let testApp;
  let userAToken;
  let userBToken;
  let userCToken;
  let userAId;
  let userBId;
  let userCId;
  let userAEmail = `alpha.${Date.now()}@example.com`;
  let userBEmail = `beta.${Date.now()}@example.com`;
  let userCEmail = `gamma.${Date.now()}@example.com`;
  let sharedConvId;
  let userANoteId;

  before(async () => {
    testApp = await startTestServer();

    // Register User A
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Alpha',
        email: userAEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bodyA = await resA.json();
    userAToken = bodyA.data.token;
    userAId = bodyA.data.user.id;

    // Register User B
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Beta',
        email: userBEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bodyB = await resB.json();
    userBToken = bodyB.data.token;
    userBId = bodyB.data.user.id;

    // Register User C
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Gamma',
        email: userCEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bodyC = await resC.json();
    userCToken = bodyC.data.token;
    userCId = bodyC.data.user.id;

    // User A creates a conversation with User B
    const convRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        recipientId: userBId,
        initialMessage: 'Confidential project planning between Alpha and Beta',
      }),
    });
    const convBody = await convRes.json();
    sharedConvId = convBody.data.id;

    // User A creates a note
    const noteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: 'Alpha Private Study Note',
        content: 'This contains sensitive formulas for the upcoming exam.',
        subject: 'Computer Science',
        topic: 'Algorithms',
        visibility: 'private',
      }),
    });
    const noteBody = await noteRes.json();
    userANoteId = noteBody.data.id;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // 1. Production Environment Validator Tests
  describe('1. Production Environment Validator (Startup Safety)', () => {
    test('Passes when valid production variables are provided', () => {
      const result = validateProductionEnv({
        NODE_ENV: 'production',
        PORT: '8080',
        CORS_ORIGIN: 'https://studysync.example.com',
        DATABASE_PATH: '/data/studysync.db',
      });
      assert.equal(result.valid, true);
    });

    test('Bypasses strict checks when not in production', () => {
      const result = validateProductionEnv({
        NODE_ENV: 'development',
      });
      assert.equal(result.valid, true);
    });

    test('Rejects invalid port in production', () => {
      assert.throws(
        () => {
          validateProductionEnv({
            NODE_ENV: 'production',
            PORT: '999999',
            CORS_ORIGIN: 'https://studysync.example.com',
            DATABASE_PATH: '/data/studysync.db',
          });
        },
        {
          message: /PORT must be a valid integer between 1 and 65535/,
        }
      );
    });

    test('Rejects wildcard CORS origin in production', () => {
      assert.throws(
        () => {
          validateProductionEnv({
            NODE_ENV: 'production',
            PORT: '3001',
            CORS_ORIGIN: '*',
            DATABASE_PATH: '/data/studysync.db',
          });
        },
        {
          message: /CORS_ORIGIN wildcard \(\*\) is forbidden in production with credentials/,
        }
      );
    });

    test('Rejects missing database path in production', () => {
      assert.throws(
        () => {
          validateProductionEnv({
            NODE_ENV: 'production',
            PORT: '3001',
            CORS_ORIGIN: 'https://studysync.example.com',
            DATABASE_PATH: '',
          });
        },
        {
          message: /DATABASE_PATH must be configured in production/,
        }
      );
    });
  });

  // 2. HTTP Security Headers
  describe('2. HTTP Security Headers and Hardening', () => {
    test('Ensures required security headers are set and X-Powered-By is disabled', async () => {
      const res = await fetch(`${testApp.baseUrl}/api`);
      assert.equal(res.status, 200);

      // Verify headers
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('x-xss-protection'), '1; mode=block');
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(res.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');

      // Verify X-Powered-By is absent
      assert.equal(res.headers.get('x-powered-by'), null, 'X-Powered-By must not be exposed');
    });
  });

  // 3. Authentication Cookies & Session Handling
  describe('3. Cookie-based Authentication and Session Security', () => {
    let sessionCookie = null;

    test('Login sets httpOnly session cookie with Lax SameSite', async () => {
      const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userAEmail,
          password: 'Password123!',
        }),
      });

      // User A logged in
      const setCookie = loginRes.headers.get('set-cookie');
      assert.ok(setCookie, 'Set-Cookie header should be present on login');
      assert.ok(setCookie.includes('studysync_session='), 'Cookie should contain studysync_session');
      assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(setCookie.includes('SameSite=Lax'), 'Cookie must have SameSite=Lax');

      const match = setCookie.match(/studysync_session=([^;]+)/);
      sessionCookie = match ? match[1] : null;
      assert.ok(sessionCookie, 'Extracted session cookie');
    });

    test('Protected endpoint can authenticate via Cookie header alone', async () => {
      const meRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          Cookie: `studysync_session=${sessionCookie}`,
        },
      });

      assert.equal(meRes.status, 200);
      const meBody = await meRes.json();
      assert.equal(meBody.success, true);
      assert.equal(meBody.data.user.id, userAId);
    });

    test('Logout clears session cookie', async () => {
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userAToken}`,
        },
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie, 'Set-Cookie header should be present on logout');
      assert.ok(
        setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970'),
        'Cookie must be expired/cleared'
      );
    });
  });

  // 4. Rate Limiting on Message Endpoints
  describe('4. Message Rate Limiting', () => {
    test('Enforces rate limiting when exceeding maximum messages per window', async () => {
      _resetRateLimits();

      // Send messages up to the limit (60)
      // We will test 5 requests rapidly then manually trigger or exceed to test 429
      for (let i = 0; i < 60; i++) {
        const res = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConvId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userBToken}`,
          },
          body: JSON.stringify({
            messageContent: `Rate limit test message #${i + 1}`,
          }),
        });
        assert.equal(res.status, 201, `Message ${i + 1} should be created`);
      }

      // The 61st request should trigger HTTP 429
      const overLimitRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConvId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
          messageContent: 'Message 61 that exceeds limit',
        }),
      });

      assert.equal(overLimitRes.status, 429, 'Excess messages should return 429 TOO_MANY_REQUESTS');
      const body = await overLimitRes.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'TOO_MANY_REQUESTS');

      _resetRateLimits();
    });
  });

  // 5. IDOR and Authorization Boundaries
  describe('5. IDOR and Data Isolation Boundary Enforcement', () => {
    test('User C cannot view conversation between User A and User B', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConvId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userCToken}`,
        },
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('User C cannot send messages into conversation between User A and User B', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConvId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userCToken}`,
        },
        body: JSON.stringify({
          messageContent: 'Intruder message from Gamma',
        }),
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('User B cannot edit User A private note', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes/${userANoteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
          title: 'Tampered Note Title by Beta',
          content: 'Compromised content',
        }),
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('User B cannot delete User A note', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes/${userANoteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userBToken}`,
        },
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    });
  });

  // 6. Database Consistent Backup and Integrity Verification
  describe('6. Database Backup & Restore Verification', () => {
    let createdBackupPath = null;

    test('Creates safe VACUUM INTO online backup snapshot', async () => {
      const result = await BackupManager.createBackup();
      assert.ok(result.backupPath, 'Backup path should be returned');
      assert.ok(fs.existsSync(result.backupPath), 'Backup file must exist on disk');
      assert.ok(result.sizeBytes > 0, 'Backup size must be positive');
      assert.ok(result.tableCount > 0, 'Backup must contain schema tables');
      createdBackupPath = result.backupPath;
    });

    test('Verifies integrity of the newly created snapshot using PRAGMA integrity_check', async () => {
      assert.ok(createdBackupPath, 'Backup file must have been created');
      const verification = await BackupManager.verifyBackup(createdBackupPath);
      assert.equal(verification.integrity, 'ok', 'Database integrity check must pass with ok');
      assert.ok(verification.tableCount >= 10, 'Expected at least 10 tables in verified backup');
    });

    test('Cleans up temporary test backup file safely', () => {
      if (createdBackupPath && fs.existsSync(createdBackupPath)) {
        fs.unlinkSync(createdBackupPath);
        assert.equal(fs.existsSync(createdBackupPath), false);
      }
    });
  });
});
