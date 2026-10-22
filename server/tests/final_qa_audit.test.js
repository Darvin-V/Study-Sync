import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Phase 7: Final QA, PWA Verification, and Android Readiness Audit', () => {
  let testApp;
  let testUserA;
  let tokenA;
  let testUserB;
  let tokenB;
  const createdUserIds = [];
  const createdRoomIds = [];
  const createdNoteIds = [];
  const createdConversationIds = [];

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    // Isolated test cleanup: only records created by this test suite
    const db = getDb();
    try {
      for (const convId of createdConversationIds) {
        db.prepare('DELETE FROM direct_messages WHERE conversation_id = ?').run(convId);
        db.prepare('DELETE FROM conversations WHERE id = ?').run(convId);
      }
      for (const noteId of createdNoteIds) {
        db.prepare('DELETE FROM notes_resources WHERE id = ?').run(noteId);
      }
      for (const roomId of createdRoomIds) {
        db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(roomId);
        db.prepare('DELETE FROM room_memberships WHERE room_id = ?').run(roomId);
        db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
      }
      for (const uid of createdUserIds) {
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      }
    } catch {
      // Ignore cleanup error on shutdown
    }

    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // 1. ESSENTIAL USER JOURNEY
  // ==========================================================================
  describe('1. Essential User Journey & Lifecycle', () => {
    const uniqueA = `qa_user_a_${Date.now()}`;
    const userAPassword = 'SecurePassword123!';
    const userAEmail = `${uniqueA}@test.studysync.ai`;

    test('1.1 New user registers, receives session token + httpOnly cookie, and completes onboarding', async () => {
      // Step A: Registration
      const regRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Audit Learner A',
          email: userAEmail,
          password: userAPassword,
          confirmPassword: userAPassword,
        }),
      });

      assert.equal(regRes.status, 201);
      const regBody = await regRes.json();
      assert.equal(regBody.success, true);
      assert.ok(regBody.data.token, 'Must return session token');
      assert.equal(regBody.data.user.email, userAEmail);
      assert.equal(regBody.data.isProfileCompleted, false);

      tokenA = regBody.data.token;
      testUserA = regBody.data.user;
      createdUserIds.push(testUserA.id);

      // Verify session cookie was set
      const cookieHeader = regRes.headers.get('set-cookie');
      assert.ok(cookieHeader && cookieHeader.includes('studysync_session='), 'Must set studysync_session cookie');

      // Step B: Onboarding Profile Completion
      const profileRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          headline: 'Computer Science Sophomore',
          institution: 'Institute of Technology',
          skill_level: 'Intermediate',
          is_profile_completed: 1,
        }),
      });

      assert.equal(profileRes.status, 200);
      const profileBody = await profileRes.json();
      assert.equal(profileBody.success, true);
      assert.equal(profileBody.data.headline, 'Computer Science Sophomore');
      assert.equal(Boolean(profileBody.data.isProfileCompleted), true);
    });

    test('1.2 Existing user logs in, sees persisted profile and settings', async () => {
      const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userAEmail,
          password: userAPassword,
        }),
      });

      assert.equal(loginRes.status, 200);
      const loginBody = await loginRes.json();
      assert.equal(loginBody.success, true);
      assert.equal(loginBody.data.user.id, testUserA.id);
      assert.equal(loginBody.data.isProfileCompleted, true);
      assert.ok(loginBody.data.settings, 'Merged user settings returned');
      assert.ok(loginBody.data.token);

      // Fresh session token
      tokenA = loginBody.data.token;
    });

    test('1.3 Session resilience: Valid session survives simulated page refresh via GET /api/auth/me', async () => {
      // Authenticate via Bearer header
      const bearerRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(bearerRes.status, 200);
      const bearerBody = await bearerRes.json();
      assert.equal(bearerBody.success, true);
      assert.equal(bearerBody.data.user.id, testUserA.id);

      // Authenticate via httpOnly cookie alone (simulating cookie session recovery)
      const cookieRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Cookie: `studysync_session=${tokenA}` },
      });
      assert.equal(cookieRes.status, 200);
      const cookieBody = await cookieRes.json();
      assert.equal(cookieBody.success, true);
      assert.equal(cookieBody.data.user.id, testUserA.id);
    });

    test('1.4 Logout revokes session on server and clears session in SQLite', async () => {
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(logoutRes.status, 200);

      // Verify token is deleted in database
      const db = getDb();
      const sessionRow = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(tokenA);
      assert.equal(sessionRow, undefined, 'Session token must be deleted from SQLite user_sessions');

      // Subsequent request using revoked token must fail with 401
      const afterRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(afterRes.status, 401);
    });

    test('1.5 Expired or invalid sessions return 401 SESSION_EXPIRED cleanly', async () => {
      const invalidRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer totally-invalid-token-xyz-123' },
      });
      assert.equal(invalidRes.status, 401);
      const invalidBody = await invalidRes.json();
      assert.equal(invalidBody.success, false);
      assert.equal(invalidBody.error.code, 'SESSION_EXPIRED');
    });
  });

  // ==========================================================================
  // 2. AUTHORIZATION & IDOR BOUNDARIES
  // ==========================================================================
  describe('2. Authorization Boundaries & Privacy Enforcement', () => {
    before(async () => {
      // Create user A
      const emailA = `author_a_${Date.now()}@test.studysync.ai`;
      const regA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Author A',
          email: emailA,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const bodyA = await regA.json();
      tokenA = bodyA.data.token;
      testUserA = bodyA.data.user;
      createdUserIds.push(testUserA.id);

      // Create user B
      const emailB = `author_b_${Date.now()}@test.studysync.ai`;
      const regB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Author B',
          email: emailB,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const bodyB = await regB.json();
      tokenB = bodyB.data.token;
      testUserB = bodyB.data.user;
      createdUserIds.push(testUserB.id);
    });

    test('2.1 Private room authorization: Non-member is blocked from reading or posting in private room', async () => {
      // User A creates a private room
      const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          title: 'QA Confidential Room',
          subject: 'Database Systems',
          topic: 'Concurrency Control',
          description: 'Restricted group for transaction research',
          status: 'private',
          roomType: 'Learn Together',
          difficulty: 'Advanced',
        }),
      });
      assert.equal(roomRes.status, 201);
      const room = (await roomRes.json()).data;
      createdRoomIds.push(room.id);

      // User B attempts to read messages without joining (must be 403)
      const readRes = await fetch(`${testApp.baseUrl}/api/rooms/${room.id}/messages`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(readRes.status, 403);

      // User B attempts to post message into private room (must be 403)
      const postRes = await fetch(`${testApp.baseUrl}/api/rooms/${room.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ message_content: 'Intruder message' }),
      });
      assert.equal(postRes.status, 403);
    });

    test('2.2 Direct message isolation: Third-party user cannot view or send to conversation', async () => {
      // Create User C
      const emailC = `outsider_c_${Date.now()}@test.studysync.ai`;
      const regC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Outsider C',
          email: emailC,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });
      const bodyC = await regC.json();
      const tokenC = bodyC.data.token;
      createdUserIds.push(bodyC.data.user.id);

      // User A creates conversation with User B
      const convRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          recipientId: testUserB.id,
          message: 'Direct secret message between A and B',
        }),
      });
      assert.equal(convRes.status, 201);
      const conv = (await convRes.json()).data;
      createdConversationIds.push(conv.id);

      // User C attempts to view messages between A and B (must be 403)
      const viewRes = await fetch(`${testApp.baseUrl}/api/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${tokenC}` },
      });
      assert.equal(viewRes.status, 403);

      // User C attempts to inject message into conversation between A and B (must be 403)
      const injectRes = await fetch(`${testApp.baseUrl}/api/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenC}`,
        },
        body: JSON.stringify({ message_content: 'Unauthorized injection' }),
      });
      assert.equal(injectRes.status, 403);
    });

    test('2.3 Notes authorization: Private notes cannot be viewed, edited, or deleted by other users', async () => {
      // User A creates private note
      const noteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          title: 'User A Private Formula Sheet',
          content: 'Confidential proof: X -> Y',
          subject: 'Database Systems',
          topic: 'Functional Dependencies',
          type: 'Formula Sheet',
          visibility: 'private',
        }),
      });
      assert.equal(noteRes.status, 201);
      const note = (await noteRes.json()).data;
      createdNoteIds.push(note.id);

      // User B attempts to edit User A private note (must be 403)
      const editRes = await fetch(`${testApp.baseUrl}/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ title: 'Tampered Note Title' }),
      });
      assert.equal(editRes.status, 403);

      // User B attempts to delete User A private note (must be 403)
      const delRes = await fetch(`${testApp.baseUrl}/api/notes/${note.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(delRes.status, 403);
    });

    test('2.4 Honest error states: Invalid registration inputs and malformed bodies return 400', async () => {
      // Missing password
      const errRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Test',
          email: 'invalid-email-format',
          password: 'short',
        }),
      });
      assert.equal(errRes.status, 400);
      const errBody = await errRes.json();
      assert.equal(errBody.success, false);
      assert.equal(errBody.error.code, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // 3. PWA BEHAVIOR & SECURITY BOUNDARIES
  // ==========================================================================
  describe('3. PWA Manifest, Service Worker & Cache Integrity', () => {
    test('3.1 Manifest file is valid JSON with standalone mode, icons, and safe scope', () => {
      const manifestPath = path.resolve('public/manifest.webmanifest');
      assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      assert.equal(manifest.display, 'standalone');
      assert.equal(manifest.scope, '/');
      assert.ok(manifest.start_url);
      assert.ok(manifest.name.includes('StudySync'));
      assert.equal(manifest.short_name, 'StudySync');
      assert.ok(manifest.icons.length >= 3);
    });

    test('3.2 Service worker explicitly forbids caching of private /api routes and session headers', () => {
      const swPath = path.resolve('public/sw.js');
      assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');
      const swContent = fs.readFileSync(swPath, 'utf8');

      // Check rule preventing API caching
      assert.ok(
        swContent.includes("url.pathname.startsWith('/api')"),
        'Service worker must guard against caching /api endpoints'
      );
      assert.ok(
        swContent.includes("request.headers.has('authorization')"),
        'Service worker must never cache requests with authorization header'
      );
      assert.ok(
        swContent.includes('NETWORK_OFFLINE'),
        'Service worker must provide honest NETWORK_OFFLINE response when offline'
      );
    });

    test('3.3 Service worker precache list strictly contains shell assets only', () => {
      const swContent = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
      const precacheMatch = swContent.match(/const PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
      assert.ok(precacheMatch, 'PRECACHE_ASSETS array must be defined in sw.js');
      const precacheList = precacheMatch[1];
      assert.ok(precacheList.includes('/index.html'));
      assert.ok(precacheList.includes('/manifest.webmanifest'));
      assert.ok(!precacheList.includes('/api/'), 'Precache must NEVER include /api/');
      assert.ok(!precacheList.includes('token'), 'Precache must NEVER reference tokens');
    });

    test('3.4 PNG icon files exist with standard PNG signatures', () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const icons = [
        'public/icons/icon-192x192.png',
        'public/icons/icon-512x512.png',
        'public/icons/maskable-icon-512x512.png',
        'public/icons/apple-touch-icon.png',
      ];

      for (const icon of icons) {
        const fullPath = path.resolve(icon);
        assert.ok(fs.existsSync(fullPath), `${icon} must exist`);
        const buf = fs.readFileSync(fullPath);
        assert.ok(buf.subarray(0, 8).equals(pngSignature), `${icon} must have valid PNG magic bytes`);
      }
    });
  });

  // ==========================================================================
  // 4. ANDROID READINESS & PACKAGING AUDIT
  // ==========================================================================
  describe('4. Android Capacitor & Packaging Audit', () => {
    test('4.1 Package.json has @capacitor/core in dependencies and CLI tools in devDependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      assert.ok(pkg.dependencies['@capacitor/core'], '@capacitor/core must be in dependencies');
      assert.ok(pkg.devDependencies['@capacitor/cli'], '@capacitor/cli must be in devDependencies');
      assert.ok(pkg.devDependencies['@capacitor/android'], '@capacitor/android must be in devDependencies');
    });

    test('4.2 capacitor.config.json enforces HTTPS androidScheme and disables cleartext', () => {
      const capConfig = JSON.parse(fs.readFileSync(path.resolve('capacitor.config.json'), 'utf8'));
      assert.equal(capConfig.appId, 'ai.studysync.app');
      assert.equal(capConfig.appName, 'StudySync AI');
      assert.equal(capConfig.webDir, 'dist');
      assert.equal(capConfig.server?.androidScheme, 'https');
      assert.equal(capConfig.server?.cleartext, false);
    });

    test('4.3 AndroidManifest.xml links networkSecurityConfig and requires INTERNET permission', () => {
      const manifestContent = fs.readFileSync(path.resolve('android/app/src/main/AndroidManifest.xml'), 'utf8');
      assert.ok(
        manifestContent.includes('android:networkSecurityConfig="@xml/network_security_config"'),
        'Must specify networkSecurityConfig in AndroidManifest'
      );
      assert.ok(
        manifestContent.includes('android.permission.INTERNET'),
        'Must require android.permission.INTERNET'
      );
    });

    test('4.4 network_security_config.xml enforces cleartextTrafficPermitted="false" with scoped loopback', () => {
      const netSecContent = fs.readFileSync(
        path.resolve('android/app/src/main/res/xml/network_security_config.xml'),
        'utf8'
      );
      assert.ok(
        netSecContent.includes('cleartextTrafficPermitted="false"'),
        'Default base config must disable cleartext'
      );
      assert.ok(
        netSecContent.includes('<domain includeSubdomains="true">10.0.2.2</domain>'),
        'Must scope cleartext exception to Android emulator loopback'
      );
    });

    test('4.5 Synced public web assets exist in android/app/src/main/assets/public', () => {
      const publicAssetsDir = path.resolve('android/app/src/main/assets/public');
      assert.ok(fs.existsSync(publicAssetsDir), 'android public assets directory must exist');
      assert.ok(fs.existsSync(path.join(publicAssetsDir, 'index.html')), 'assets/public/index.html must exist');
      assert.ok(
        fs.existsSync(path.join(publicAssetsDir, 'manifest.webmanifest')),
        'assets/public/manifest.webmanifest must exist'
      );
    });
  });
});
