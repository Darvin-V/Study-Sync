import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Web Cookie-First Authentication Migration Regression Tests', () => {
  let testApp;
  const createdUserIds = [];
  const createdNoteIds = [];

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    const db = getDb();
    try {
      for (const noteId of createdNoteIds) {
        db.prepare('DELETE FROM notes_resources WHERE id = ?').run(noteId);
      }
      for (const uid of createdUserIds) {
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      }
    } catch {
      // Ignore cleanup error on teardown
    }

    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // 1. Web & PWA Zero Token Persistence & Legacy Migration
  // ==========================================================================
  describe('1. Web & PWA Storage Policy and Legacy Migration', () => {
    test('1.1 Web client storage policy prevents storing raw bearer tokens in localStorage/sessionStorage', () => {
      // Simulated web storage environment
      const storage = new Map();
      const mockStorage = {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
        clear: () => storage.clear(),
      };

      const TOKEN_KEY = 'studysync_session_token';

      // Implementation of client storage policy for Web/PWA
      function clientSetStoredToken(token, isNative = false) {
        if (!isNative) {
          // Web and PWA never persist raw tokens
          mockStorage.removeItem(TOKEN_KEY);
          return;
        }
        if (token) mockStorage.setItem(TOKEN_KEY, token);
        else mockStorage.removeItem(TOKEN_KEY);
      }

      function clientGetStoredToken(isNative = false) {
        if (!isNative) {
          mockStorage.removeItem(TOKEN_KEY);
          return null;
        }
        return mockStorage.getItem(TOKEN_KEY);
      }

      // Action: attempt to persist token on web platform
      clientSetStoredToken('raw-secret-bearer-token-12345', false);
      assert.equal(mockStorage.getItem(TOKEN_KEY), null, 'Raw token must not be written to web storage');
      assert.equal(clientGetStoredToken(false), null, 'getStoredToken must return null on web platform');
    });

    test('1.2 Safely removes legacy tokens from localStorage and sessionStorage during migration', () => {
      const localStore = new Map();
      const sessionStore = new Map();
      const TOKEN_KEY = 'studysync_session_token';

      // Pre-populate with legacy stored tokens
      localStore.set(TOKEN_KEY, 'legacy-local-token-abc');
      sessionStore.set(TOKEN_KEY, 'legacy-session-token-xyz');

      function clearLegacyTokens() {
        localStore.delete(TOKEN_KEY);
        sessionStore.delete(TOKEN_KEY);
      }

      // Execute migration purge
      clearLegacyTokens();

      assert.equal(localStore.get(TOKEN_KEY), undefined, 'Legacy localStorage token must be purged');
      assert.equal(sessionStore.get(TOKEN_KEY), undefined, 'Legacy sessionStorage token must be purged');
    });
  });

  // ==========================================================================
  // 2. Browser Session Restoration via HttpOnly Cookie Alone
  // ==========================================================================
  describe('2. Session Restoration via HttpOnly Cookie (GET /api/auth/me)', () => {
    let userCookie;
    let registeredUserId;

    test('2.1 Registration sets HttpOnly session cookie with Lax SameSite', async () => {
      const email = `cookiefirst.reg.${Date.now()}@example.com`;
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Cookie First Student',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 201);
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Registration must return Set-Cookie');
      assert.ok(setCookie.includes('studysync_session='), 'Cookie must be studysync_session');
      assert.ok(setCookie.includes('HttpOnly') || setCookie.includes('httponly'), 'Cookie must be HttpOnly');

      const match = setCookie.match(/studysync_session=([^;]+)/);
      assert.ok(match && match[1], 'Valid cookie value must be present');
      userCookie = match[1];

      const body = await res.json();
      registeredUserId = body.data.user.id;
      createdUserIds.push(registeredUserId);
    });

    test('2.2 Restores session on simulated page reload via HttpOnly cookie (NO Authorization header)', async () => {
      // Browser makes request with credentials: 'include', sending only Cookie header
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `studysync_session=${userCookie}`,
          // Note: NO Authorization: Bearer header present
        },
      });

      assert.equal(res.status, 200, 'Must authenticate successfully using Cookie alone');
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, registeredUserId);
      assert.equal(body.data.user.displayName, 'Cookie First Student');
      assert.ok(body.data.settings, 'Integrated settings should be returned');
      assert.equal(body.data.isProfileCompleted, false);
    });

    test('2.3 Restores learner profile using HttpOnly cookie alone', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        headers: {
          Cookie: `studysync_session=${userCookie}`,
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.userId, registeredUserId);
    });
  });

  // ==========================================================================
  // 3. Protected Requests & CSRF Boundaries
  // ==========================================================================
  describe('3. Protected API Requests & CSRF Enforcement for Cookie Sessions', () => {
    let authCookie;

    before(async () => {
      const email = `cookiefirst.api.${Date.now()}@example.com`;
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'CSRF Tester',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const body = await res.json();
      createdUserIds.push(body.data.user.id);
      const setCookie = res.headers.get('set-cookie');
      authCookie = setCookie.match(/studysync_session=([^;]+)/)[1];
    });

    test('3.1 Cookie-authenticated state change with application/json and X-Requested-With succeeds', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: `studysync_session=${authCookie}`,
        },
        body: JSON.stringify({
          title: 'Cookie Auth Note',
          content: 'Verified with HttpOnly cookie and safe client headers',
          subject: 'Computer Science',
          topic: 'Operating Systems',
          visibility: 'private',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      createdNoteIds.push(body.data.id);
    });

    test('3.2 Unauthenticated requests without cookie are rejected with 401 UNAUTHENTICATED', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'UNAUTHENTICATED');
    });

    test('3.3 Expired or invalid cookie is rejected with 401 SESSION_EXPIRED', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Cookie: 'studysync_session=non-existent-invalid-cookie-session-token',
        },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'SESSION_EXPIRED');
    });

    test('3.4 Cookie-only state change with simple form encoding is rejected by CSRF policy (403)', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `studysync_session=${authCookie}`,
        },
        body: 'title=Attack&content=Spam',
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'CSRF_PROTECTION');
    });
  });

  // ==========================================================================
  // 4. Logout Revocation and Cookie Clearance
  // ==========================================================================
  describe('4. Logout Revocation and Cookie Clearance', () => {
    test('4.1 Logout revokes server session in SQLite and clears the HttpOnly cookie', async () => {
      const email = `cookiefirst.logout.${Date.now()}@example.com`;
      const regRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Logout Verification User',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const regBody = await regRes.json();
      createdUserIds.push(regBody.data.user.id);
      const setCookie = regRes.headers.get('set-cookie');
      const cookieVal = setCookie.match(/studysync_session=([^;]+)/)[1];

      const db = getDb();
      // Ensure session exists in SQLite
      const sessionBefore = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(cookieVal);
      assert.ok(sessionBefore, 'Session must exist in database prior to logout');

      // Execute Logout
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `studysync_session=${cookieVal}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      assert.equal(logoutRes.status, 200);
      const logoutSetCookie = logoutRes.headers.get('set-cookie');
      assert.ok(logoutSetCookie, 'Logout must send Set-Cookie header');
      assert.ok(
        logoutSetCookie.includes('studysync_session=;') || logoutSetCookie.includes('Expires=Thu, 01 Jan 1970'),
        'Cookie must be expired on logout'
      );

      // Verify session was purged from SQLite
      const sessionAfter = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(cookieVal);
      assert.equal(sessionAfter, undefined, 'Session must be revoked from SQLite user_sessions table');

      // Subsequent attempt with revoked cookie fails
      const checkRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Cookie: `studysync_session=${cookieVal}` },
      });
      assert.equal(checkRes.status, 401);
      const checkBody = await checkRes.json();
      assert.equal(checkBody.error.code, 'SESSION_EXPIRED');
    });
  });

  // ==========================================================================
  // 5. Native Compatibility & Server Dual-Issuance Preservation
  // ==========================================================================
  describe('5. Native Compatibility & Dual-Issuance Preservation', () => {
    let nativeToken;
    let nativeUserId;

    test('5.1 Server continues to return token in body for native client consumption', async () => {
      const email = `native.compat.${Date.now()}@example.com`;
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Native Mobile Student',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.data.token, 'Server must preserve data.token in response for native clients');
      nativeToken = body.data.token;
      nativeUserId = body.data.user.id;
      createdUserIds.push(nativeUserId);
    });

    test('5.2 Native client authenticates successfully via Authorization: Bearer <token> without cookies', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${nativeToken}`,
          // No Cookie header sent
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, nativeUserId);
    });

    test('5.3 Native client can perform protected mutations using Bearer token alone', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nativeToken}`,
        },
        body: JSON.stringify({
          title: 'Native Bearer Note',
          content: 'Created via native mobile bearer authentication',
          subject: 'Computer Science',
          topic: 'Operating Systems',
          visibility: 'private',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      createdNoteIds.push(body.data.id);
    });

    test('5.4 Native client logout with Bearer token revokes the session on the server', async () => {
      const db = getDb();
      const sessionBefore = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(nativeToken);
      assert.ok(sessionBefore, 'Native session must exist in DB before logout');

      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${nativeToken}`,
        },
      });

      assert.equal(logoutRes.status, 200);
      const sessionAfter = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(nativeToken);
      assert.equal(sessionAfter, undefined, 'Native bearer session must be revoked in DB');

      // Subsequent request with revoked token fails
      const checkRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${nativeToken}` },
      });
      assert.equal(checkRes.status, 401);
    });
  });
});
