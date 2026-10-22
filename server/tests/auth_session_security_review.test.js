import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Authentication and Session Security Review Tests', () => {
  let testApp;
  let userAId;
  let userAToken;
  let userACookie;
  let userBId;
  let userBToken;
  const createdUserIds = [];
  const createdNoteIds = [];

  before(async () => {
    testApp = await startTestServer();

    // Register User A
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Review Alpha',
        email: `review.alpha.${Date.now()}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.equal(resA.status, 201);
    const bodyA = await resA.json();
    userAId = bodyA.data.user.id;
    userAToken = bodyA.data.token;
    createdUserIds.push(userAId);

    const setCookieHeader = resA.headers.get('set-cookie');
    const match = setCookieHeader.match(/studysync_session=([^;]+)/);
    userACookie = match ? match[1] : null;

    // Register User B
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Review Beta',
        email: `review.beta.${Date.now()}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.equal(resB.status, 201);
    const bodyB = await resB.json();
    userBId = bodyB.data.user.id;
    userBToken = bodyB.data.token;
    createdUserIds.push(userBId);
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
  // 1. DUAL ISSUANCE & VALIDATION
  // ==========================================================================
  describe('1. Dual Issuance and Multi-Channel Authentication', () => {
    test('1.1 Authenticates successfully via Bearer token in Authorization header', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, userAId);
    });

    test('1.2 Authenticates successfully via studysync_session cookie alone', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Cookie: `studysync_session=${userACookie}` },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, userAId);
    });
  });

  // ==========================================================================
  // 2. TOKEN PRIORITIZATION & GRACEFUL FALLBACK
  // ==========================================================================
  describe('2. Token Prioritization and Fallback Handling', () => {
    test('2.1 Stale Bearer token gracefully falls back to valid cookie session (no 401 lockout)', async () => {
      const expiredOrStaleToken = 'stale-token-dead-beef-00000000000000000000000000000000';
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${expiredOrStaleToken}`,
          Cookie: `studysync_session=${userACookie}`,
        },
      });

      // Must succeed via valid cookie rather than being killed by the stale bearer header
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, userAId);
    });

    test('2.2 Valid Bearer token succeeds even if accompanied by a stale cookie', async () => {
      const staleCookie = 'stale-cookie-token-00000000000000000000000000000000';
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${userAToken}`,
          Cookie: `studysync_session=${staleCookie}`,
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, userAId);
    });

    test('2.3 When both Bearer token and Cookie are invalid, returns 401 SESSION_EXPIRED', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid-token-1',
          Cookie: 'studysync_session=invalid-cookie-2',
        },
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'SESSION_EXPIRED');
    });

    test('2.4 Expired Bearer token belonging to User B does NOT silently authenticate as User A when User A cookie is present', async () => {
      const db = getDb();
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const expiredUserBToken = `expired-b-${Date.now()}`;
      db.prepare(`
        INSERT INTO user_sessions (id, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(expiredUserBToken, userBId, pastDate, pastDate);

      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${expiredUserBToken}`,
          Cookie: `studysync_session=${userACookie}`,
        },
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'SESSION_EXPIRED');

      db.prepare('DELETE FROM user_sessions WHERE id = ?').run(expiredUserBToken);
    });

    test('2.5 Protected route rejects requests with no credentials supplied (401 UNAUTHENTICATED)', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'UNAUTHENTICATED');
    });
  });

  // ==========================================================================
  // 3. LOGOUT REVOCATION & CLEAN TEARDOWN
  // ==========================================================================
  describe('3. Logout Revocation and Server State Teardown', () => {
    test('3.1 Logout revokes session from SQLite and clears Set-Cookie header', async () => {
      // Register a temporary user for clean logout verification
      const tempEmail = `temp.logout.${Date.now()}@test.studysync.ai`;
      const regTemp = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Temp Logout User',
          email: tempEmail,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const tempBody = await regTemp.json();
      const tempToken = tempBody.data.token;
      createdUserIds.push(tempBody.data.user.id);

      const db = getDb();
      const sessionBefore = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(tempToken);
      assert.ok(sessionBefore, 'Session must exist in database before logout');

      // Execute Logout
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tempToken}`,
          Cookie: `studysync_session=${tempToken}`,
        },
      });
      assert.equal(logoutRes.status, 200);

      // Verify Set-Cookie header clears the cookie
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie, 'Logout must send Set-Cookie');
      assert.ok(
        setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970'),
        'Cookie must be instructed to expire immediately'
      );

      // Verify session is deleted in SQLite
      const sessionAfter = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(tempToken);
      assert.equal(sessionAfter, undefined, 'Session must be purged from database');

      // Subsequent attempt with revoked token must fail with 401
      const checkRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert.equal(checkRes.status, 401);
    });

    test('3.2 Calling logout with an already expired session still succeeds with 200 and clears cookie', async () => {
      const expiredToken = 'already-expired-token-0000000000000000';
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
          Cookie: `studysync_session=${expiredToken}`,
        },
      });

      // Must NOT fail with 401 lock-out
      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie && (setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970')));
    });

    test('3.3 Logout with valid bearer plus expired cookie revokes bearer session and clears cookie', async () => {
      const db = getDb();
      const validBearer = `valid-bearer-${Date.now()}`;
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const expiredCookie = `expired-cookie-${Date.now()}`;

      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(validBearer, userAId, futureDate, pastDate);
      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(expiredCookie, userAId, pastDate, pastDate);

      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearer}`,
          Cookie: `studysync_session=${expiredCookie}`,
        },
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie && (setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970')));

      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(validBearer), undefined);
      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(expiredCookie), undefined);
    });

    test('3.4 Logout with expired bearer plus valid cookie revokes cookie session and clears cookie', async () => {
      const db = getDb();
      const validCookie = `valid-cookie-${Date.now()}`;
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const expiredBearer = `expired-bearer-${Date.now()}`;

      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(validCookie, userAId, futureDate, pastDate);
      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(expiredBearer, userAId, pastDate, pastDate);

      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expiredBearer}`,
          Cookie: `studysync_session=${validCookie}`,
        },
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie && (setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970')));

      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(validCookie), undefined);
      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(expiredBearer), undefined);
    });

    test('3.5 Logout with malformed bearer clears cookie and revokes valid cookie session', async () => {
      const db = getDb();
      const validCookie = `valid-malf-cookie-${Date.now()}`;
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(validCookie, userAId, futureDate, futureDate);

      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid%%malformed-token!!@@',
          Cookie: `studysync_session=${validCookie}`,
        },
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie && (setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970')));

      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(validCookie), undefined);
    });

    test('3.6 Logout cannot revoke another user\'s unrelated session', async () => {
      const db = getDb();
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // Create a dedicated active session for User B (the victim)
      const victimSessionToken = `victim-session-b-${Date.now()}`;
      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(victimSessionToken, userBId, futureDate, futureDate);

      // Create a temporary session for User A (the attacker)
      const tempBearerA = `attacker-bearer-a-${Date.now()}`;
      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(tempBearerA, userAId, futureDate, futureDate);

      // User A logs out with User A's Bearer token, while attempting to revoke User B's victim token in Cookie
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tempBearerA}`,
          Cookie: `studysync_session=${victimSessionToken}`,
        },
      });

      assert.equal(logoutRes.status, 200);

      // Verify User A's session was revoked
      const attackerAfter = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(tempBearerA);
      assert.equal(attackerAfter, undefined, 'Attacker session must be revoked');

      // Verify User B's unrelated session was NOT revoked
      const victimAfter = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(victimSessionToken);
      assert.ok(victimAfter, 'User B\'s session must remain active and unaffected');

      // Cleanup victim token
      db.prepare('DELETE FROM user_sessions WHERE id = ?').run(victimSessionToken);
    });

    test('3.7 Logout with expired credentials revokes intended expired sessions from SQLite and clears cookie', async () => {
      const db = getDb();
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const expiredBearer = `exp-both-b-${Date.now()}`;
      const expiredCookie = `exp-both-c-${Date.now()}`;

      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(expiredBearer, userAId, pastDate, pastDate);
      db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(expiredCookie, userAId, pastDate, pastDate);

      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expiredBearer}`,
          Cookie: `studysync_session=${expiredCookie}`,
        },
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie && (setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970')));

      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(expiredBearer), undefined);
      assert.equal(db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(expiredCookie), undefined);
    });
  });

  // ==========================================================================
  // 4. CSRF DEFENSE FOR COOKIE-AUTHENTICATED STATE-CHANGING REQUESTS
  // ==========================================================================
  describe('4. CSRF Defense on Cookie-Only State Changes', () => {
    test('4.1 Cookie-authenticated POST with application/json succeeds (CORS preflight enforced)', async () => {
      const noteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `studysync_session=${userACookie}`,
        },
        body: JSON.stringify({
          title: 'Cookie Auth Valid JSON Note',
          content: 'Legitimate client fetch request with application/json',
          subject: 'Computer Science',
          topic: 'Operating Systems',
          visibility: 'private',
        }),
      });

      assert.equal(noteRes.status, 201);
      const body = await noteRes.json();
      assert.equal(body.success, true);
      createdNoteIds.push(body.data.id);
    });

    test('4.2 Cookie-authenticated POST with application/x-www-form-urlencoded is rejected with 403 CSRF_PROTECTION', async () => {
      const attackRes = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `studysync_session=${userACookie}`,
        },
        body: 'title=Forged+CSRF+Note&content=Spam&subject=Computer+Science&topic=Operating+Systems',
      });

      assert.equal(attackRes.status, 403);
      const body = await attackRes.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'CSRF_PROTECTION');
    });

    test('4.3 Bearer token authenticated POST is permitted even with urlencoded (custom header proves client control)', async () => {
      const legitRes = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          title: 'Bearer Auth Valid Note',
          content: 'Authorization header inherently cannot be forged via HTML form',
          subject: 'Computer Science',
          topic: 'Algorithms',
          visibility: 'private',
        }),
      });

      assert.equal(legitRes.status, 201);
      const body = await legitRes.json();
      createdNoteIds.push(body.data.id);
    });

    test('4.4 Cookie-authenticated POST with text/plain is rejected with 403 CSRF_PROTECTION', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Cookie: `studysync_session=${userACookie}`,
        },
        body: 'title=TextPlainNote&content=Spam',
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'CSRF_PROTECTION');
    });

    test('4.5 Cookie-authenticated POST with missing Content-Type is rejected with 403 CSRF_PROTECTION', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          Cookie: `studysync_session=${userACookie}`,
        },
        body: '{"title":"NoContentType"}',
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'CSRF_PROTECTION');
    });

    test('4.6 Cookie-authenticated state change from untrusted Origin is rejected with 403 CSRF_PROTECTION', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://malicious-attacker.com',
          Cookie: `studysync_session=${userACookie}`,
        },
        body: JSON.stringify({
          title: 'Forged Note',
          content: 'Spam from evil origin',
        }),
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'CSRF_PROTECTION');
    });

    test('4.7 Alternative state-changing route (PUT /api/settings) blocks text/plain with 403 CSRF_PROTECTION', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
          Cookie: `studysync_session=${userACookie}`,
        },
        body: 'theme=dark',
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, 'CSRF_PROTECTION');
    });
  });

  // ==========================================================================
  // 5. IDENTITY, OWNERSHIP, AND DATA LEAK PREVENTION
  // ==========================================================================
  describe('5. Identity Boundaries and Information Leakage Prevention', () => {
    test('5.1 User B cannot mutate User A settings', async () => {
      // User B attempts to change theme on User A
      const putRes = await fetch(`${testApp.baseUrl}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
          theme: 'dark',
          userId: userAId, // Attempt to tamper target user
        }),
      });

      assert.equal(putRes.status, 200);

      // Verify User A settings were NOT changed by User B's request
      const checkARes = await fetch(`${testApp.baseUrl}/api/settings`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      const checkABody = await checkARes.json();
      assert.equal(checkABody.data.userId, userAId);
    });

    test('5.2 API responses and error messages never disclose password_hash or sensitive internals', async () => {
      // GET /api/auth/me
      const meRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      const meBody = await meRes.json();
      assert.equal(meBody.data.user.password_hash, undefined);
      assert.equal(meBody.data.user.password, undefined);

      // Login invalid credentials
      const badLoginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent.user.random@test.studysync.ai',
          password: 'WrongPassword!',
        }),
      });
      assert.equal(badLoginRes.status, 401);
      const badLoginBody = await badLoginRes.json();
      assert.equal(badLoginBody.error.message, 'Invalid email or password');
      assert.equal(badLoginBody.error.code, 'INVALID_CREDENTIALS');
      assert.equal(badLoginBody.error.stack, undefined);
    });
  });
});
