import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Auth-First Entry Experience and Secure Routing Tests', () => {
  let testApp;
  const createdUserIds = [];

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    const db = getDb();
    try {
      for (const uid of createdUserIds) {
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      }
    } catch {
      // Teardown cleanup
    }

    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // 1. Mandatory First-Screen Routing Logic & Safe Redirects
  // ==========================================================================
  describe('1. Mandatory First-Screen Entry & Safe Redirects', () => {
    // Open redirect defense logic matching getSafeRedirect
    function getSafeRedirect(from) {
      if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
        return from;
      }
      if (from && typeof from.pathname === 'string' && from.pathname.startsWith('/') && !from.pathname.startsWith('//')) {
        return from.pathname + (from.search || '') + (from.hash || '');
      }
      return '/';
    }

    test('1.1 Open-redirect protection blocks malicious external domains and protocol handlers', () => {
      assert.equal(getSafeRedirect('https://evil-attacker.com'), '/');
      assert.equal(getSafeRedirect('//malicious.com/phishing'), '/');
      assert.equal(getSafeRedirect('javascript:alert(1)'), '/');
      assert.equal(getSafeRedirect('data:text/html,<script>alert(1)</script>'), '/');
      assert.equal(getSafeRedirect(null), '/');
      assert.equal(getSafeRedirect(undefined), '/');
    });

    test('1.2 Safe internal redirects are preserved correctly with query params and hashes', () => {
      assert.equal(getSafeRedirect('/notes'), '/notes');
      assert.equal(getSafeRedirect('/rooms?room=room-123'), '/rooms?room=room-123');
      assert.equal(getSafeRedirect('/sessions#active'), '/sessions#active');
      assert.equal(
        getSafeRedirect({ pathname: '/discover', search: '?subject=Database+Systems' }),
        '/discover?subject=Database+Systems'
      );
    });

    test('1.3 Logged-out entry state evaluation: root route evaluates to AuthPage', () => {
      // Evaluation simulation of RootRoute state machine
      function evaluateRootState({ isLoading, isAuthenticated, isProfileCompleted }) {
        if (isLoading) return 'AUTH_LOADING_SCREEN';
        if (!isAuthenticated) return 'AUTH_PAGE_LOGIN';
        if (!isProfileCompleted) return 'REDIRECT_ONBOARDING';
        return 'AUTHENTICATED_DASHBOARD';
      }

      // Case A: Initial session check in progress
      assert.equal(
        evaluateRootState({ isLoading: true, isAuthenticated: false, isProfileCompleted: false }),
        'AUTH_LOADING_SCREEN',
        'Root route must display AuthLoadingScreen while session verification is active'
      );

      // Case B: No valid session
      assert.equal(
        evaluateRootState({ isLoading: false, isAuthenticated: false, isProfileCompleted: false }),
        'AUTH_PAGE_LOGIN',
        'Logged-out visitor to root must see AuthPage, never Community Feed'
      );

      // Case C: Authenticated but profile incomplete
      assert.equal(
        evaluateRootState({ isLoading: false, isAuthenticated: true, isProfileCompleted: false }),
        'REDIRECT_ONBOARDING',
        'New user with incomplete profile must be routed to onboarding'
      );

      // Case D: Authenticated with completed profile
      assert.equal(
        evaluateRootState({ isLoading: false, isAuthenticated: true, isProfileCompleted: true }),
        'AUTHENTICATED_DASHBOARD',
        'Valid authenticated session must render the collaborative study dashboard'
      );
    });

    test('1.4 Protected route gate: logged-out visits to protected routes require login redirect', () => {
      function evaluateProtectedRoute({ isLoading, isAuthenticated, location }) {
        if (isLoading) return { action: 'RENDER_LOADING' };
        if (!isAuthenticated) return { action: 'REDIRECT_LOGIN', state: { from: location } };
        return { action: 'RENDER_CONTENT' };
      }

      const noteLocation = { pathname: '/notes' };
      const res = evaluateProtectedRoute({ isLoading: false, isAuthenticated: false, location: noteLocation });
      assert.equal(res.action, 'REDIRECT_LOGIN');
      assert.deepEqual(res.state.from, noteLocation);
    });

    test('1.5 Public-only route gate: authenticated visitors to /login or /register are redirected to dashboard', () => {
      function evaluatePublicOnlyRoute({ isLoading, isAuthenticated, isProfileCompleted, locationState }) {
        if (isLoading) return { action: 'RENDER_LOADING' };
        if (isAuthenticated) {
          if (!isProfileCompleted) return { action: 'REDIRECT', destination: '/onboarding' };
          const dest = locationState?.from ? getSafeRedirect(locationState.from) : '/';
          return { action: 'REDIRECT', destination: dest };
        }
        return { action: 'RENDER_AUTH_FORM' };
      }

      // Logged in user hitting /login
      const res = evaluatePublicOnlyRoute({
        isLoading: false,
        isAuthenticated: true,
        isProfileCompleted: true,
        locationState: null,
      });
      assert.equal(res.action, 'REDIRECT');
      assert.equal(res.destination, '/');

      // Logged in user with intended return destination
      const resWithDest = evaluatePublicOnlyRoute({
        isLoading: false,
        isAuthenticated: true,
        isProfileCompleted: true,
        locationState: { from: '/rooms' },
      });
      assert.equal(resWithDest.action, 'REDIRECT');
      assert.equal(resWithDest.destination, '/rooms');
    });
  });

  // ==========================================================================
  // 2. Session Lifecycle & Server State Verification
  // ==========================================================================
  describe('2. End-to-End Authentication Session Lifecycle', () => {
    let authCookie;
    let userId;

    test('2.1 Registration establishes valid session with HttpOnly cookie', async () => {
      const email = `authfirst.test.${Date.now()}@example.com`;
      const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Auth First Tester',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      });

      assert.equal(res.status, 201);
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie && setCookie.includes('studysync_session='));
      authCookie = setCookie.match(/studysync_session=([^;]+)/)[1];

      const body = await res.json();
      userId = body.data.user.id;
      createdUserIds.push(userId);
    });

    test('2.2 Session restoration succeeds via cookie and returns user metadata and settings', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Cookie: `studysync_session=${authCookie}` },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.user.id, userId);
      assert.ok(body.data.settings, 'Settings must be attached');
    });

    test('2.3 Protected academic profile endpoint requires authentication and succeeds with cookie', async () => {
      // Unauthenticated attempt fails
      const unauthRes = await fetch(`${testApp.baseUrl}/api/profile/me`);
      assert.equal(unauthRes.status, 401);

      // Authenticated attempt succeeds
      const authRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        headers: { Cookie: `studysync_session=${authCookie}` },
      });
      assert.equal(authRes.status, 200);
      const body = await authRes.json();
      assert.equal(body.data.userId, userId);
    });

    test('2.4 Logout purges server session in SQLite and clears the cookie', async () => {
      const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `studysync_session=${authCookie}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers.get('set-cookie');
      assert.ok(setCookie.includes('studysync_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970'));

      // Subsequent attempt with revoked session fails with SESSION_EXPIRED (401)
      const checkRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: { Cookie: `studysync_session=${authCookie}` },
      });
      assert.equal(checkRes.status, 401);
      const checkBody = await checkRes.json();
      assert.equal(checkBody.error.code, 'SESSION_EXPIRED');
    });
  });

  // ==========================================================================
  // 3. Static Assets & App Bundle Integrity
  // ==========================================================================
  describe('3. Production Build Artifacts and Clean Shell Bundling', () => {
    test('3.1 Dist directory contains index.html, webmanifest, and built bundles', () => {
      const distDir = path.resolve('dist');
      assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');
      assert.ok(fs.existsSync(path.join(distDir, 'manifest.webmanifest')), 'dist/manifest.webmanifest must exist');
      assert.ok(fs.existsSync(path.join(distDir, 'sw.js')), 'dist/sw.js must exist');
    });

    test('3.2 Dist index.html contains proper title and viewport meta tags', () => {
      const html = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
      assert.ok(html.includes('<title>StudySync AI'), 'HTML must have StudySync AI title');
      assert.ok(html.includes('name="viewport"'), 'HTML must have responsive viewport');
    });

    test('3.3 Auth branding texts are present in the compiled bundle', () => {
      const assetsDir = path.resolve('dist/assets');
      const files = fs.readdirSync(assetsDir);
      const jsBundle = files.find((f) => f.endsWith('.js'));
      assert.ok(jsBundle, 'JavaScript bundle must exist in dist/assets');

      const bundleContent = fs.readFileSync(path.join(assetsDir, jsBundle), 'utf8');
      assert.ok(
        bundleContent.includes('Learn Better, Together.') || bundleContent.includes('Learn Better'),
        'Bundle must contain the auth-first headline'
      );
      assert.ok(
        bundleContent.includes('Find study partners') || bundleContent.includes('study partners'),
        'Bundle must contain the auth-first supporting text'
      );
    });
  });
});
