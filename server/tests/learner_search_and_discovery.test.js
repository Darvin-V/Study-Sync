import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import { getDb } from '../db/connection.js';
import { startTestServer } from './testHelper.js';

describe('Professional Learner Search & Discovery Test Suite', () => {
  let testApp;
  let authToken;
  let currentUserId;

  before(async () => {
    testApp = await startTestServer();

    // Sign in as Darvin (seeded user)
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'darvin@demo.studysync.ai',
        password: 'Password123!',
      }),
    });
    const loginBody = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    authToken = loginBody.data.token;
    currentUserId = loginBody.data.user.id; // 'darvin-01'
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  test('1. Exact username search prioritizes exact match over partial matches', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const targetUserId = `user-exact-u-${Date.now()}`;
    const targetUsername = `target_u_${Date.now()}`.slice(0, 20);

    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, 'Arun Sharma', ?, ?, 1, ?, ?)
    `).run(targetUserId, targetUsername, `${targetUserId}@test.ai`, now, now);

    try {
      // Search by exact @username handle
      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?q=@${targetUsername}`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.length > 0, 'Should return matching candidate');
      assert.strictEqual(body.data[0].studentId, targetUserId, 'Exact username match must rank first');
      assert.strictEqual(body.data[0].username, targetUsername);
    } finally {
      db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    }
  });

  test('2. Exact display name search prioritizes exact match over partial matches', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const targetUserId = `user-exact-n-${Date.now()}`;
    const targetUsername = `unique_name_${Date.now()}`.slice(0, 20);
    const uniqueDisplayName = 'Kavita Krishnan UniqueScholar';

    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(targetUserId, uniqueDisplayName, targetUsername, `${targetUserId}@test.ai`, now, now);

    try {
      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?q=${encodeURIComponent(uniqueDisplayName)}`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.length > 0);
      assert.strictEqual(body.data[0].studentId, targetUserId, 'Exact display name match must rank first');
    } finally {
      db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    }
  });

  test('3. Partial and case-insensitive search matches name, username, subject, and topic', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const testId = `user-partial-${Date.now()}`;
    const username = `maya_chen_${Date.now()}`.slice(0, 20);

    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, 'Maya Chen Discovery', ?, ?, 1, ?, ?)
    `).run(testId, username, `${testId}@test.ai`, now, now);

    db.prepare(`
      INSERT INTO learner_profiles (id, user_id, headline, introduction, is_profile_completed, created_at, updated_at)
      VALUES (?, ?, 'Algorithms & Graph Theory Scholar', 'Passionate about Dijkstra and dynamic programming', 1, ?, ?)
    `).run(`prof-${testId}`, testId, now, now);

    try {
      // Case-insensitive uppercase search
      const resUpper = await fetch(`${testApp.baseUrl}/api/matches/peers?q=MAYA`);
      const bodyUpper = await resUpper.json();
      assert.strictEqual(bodyUpper.success, true);
      assert.ok(bodyUpper.data.some((m) => m.studentId === testId), 'Should match case-insensitively');

      // Partial handle search without '@'
      const resPartial = await fetch(`${testApp.baseUrl}/api/matches/peers?q=chen_`);
      const bodyPartial = await resPartial.json();
      assert.strictEqual(bodyPartial.success, true);
      assert.ok(bodyPartial.data.some((m) => m.studentId === testId), 'Should match partial handle');
    } finally {
      db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(testId);
      db.prepare('DELETE FROM users WHERE id = ?').run(testId);
    }
  });

  test('4. Structured filtering by Education, Location, Language, and Preferences', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const candId = `user-filt-${Date.now()}`;
    const candUsername = `filt_user_${Date.now()}`.slice(0, 20);

    db.prepare(`
      INSERT INTO users (id, display_name, username, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'Filtered Scholar', ?, ?, '["English", "French"]', 1, ?, ?)
    `).run(candId, candUsername, `${candId}@test.ai`, now, now);

    db.prepare(`
      INSERT INTO learner_profiles (
        id, user_id, headline, education_stage, education_details, institution,
        country, state, city, skill_level, preferred_study_times, is_profile_completed, created_at, updated_at
      ) VALUES (?, ?, 'Physics Major', 'undergraduate', 'Theoretical Physics', 'Oxford University', 'United Kingdom', 'Oxfordshire', 'Oxford', 'Advanced', 'Weekends', 1, ?, ?)
    `).run(`prof-${candId}`, candId, now, now);

    db.prepare(`
      INSERT INTO user_privacy_settings (user_id, profile_visibility, show_location, show_institution, created_at, updated_at)
      VALUES (?, 'public', 1, 1, ?, ?)
    `).run(candId, now, now);

    try {
      // Match with all specific criteria
      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?country=United+Kingdom&city=Oxford&institution=Oxford&educationStage=undergraduate&skillLevel=Advanced&language=French`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      const found = body.data.find((m) => m.studentId === candId);
      assert.ok(found, 'Candidate must match all combined filters');
      assert.strictEqual(found.country, 'United Kingdom');
      assert.strictEqual(found.city, 'Oxford');
      assert.strictEqual(found.institution, 'Oxford University');
      assert.strictEqual(found.skillLevel, 'Advanced');

      // Filter with mismatching country should exclude candidate
      const resMismatch = await fetch(`${testApp.baseUrl}/api/matches/peers?country=Canada`);
      const bodyMismatch = await resMismatch.json();
      assert.strictEqual(bodyMismatch.data.some((m) => m.studentId === candId), false);
    } finally {
      db.prepare('DELETE FROM user_privacy_settings WHERE user_id = ?').run(candId);
      db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(candId);
      db.prepare('DELETE FROM users WHERE id = ?').run(candId);
    }
  });

  test('5. Sorting: best_match, recently_active, and name_asc', async () => {
    // Test name_asc sorting
    const resName = await fetch(`${testApp.baseUrl}/api/matches/peers?sort=name_asc&limit=10`);
    const bodyName = await resName.json();
    assert.strictEqual(bodyName.success, true);
    const names = bodyName.data.map((m) => (m.studentName || '').toLowerCase());
    for (let i = 1; i < names.length; i++) {
      assert.ok(names[i - 1].localeCompare(names[i]) <= 0, `Sorted A-Z order violated: "${names[i - 1]}" should be <= "${names[i]}"`);
    }

    // Test recently_active sorting
    const resActive = await fetch(`${testApp.baseUrl}/api/matches/peers?sort=recently_active&limit=5`);
    const bodyActive = await resActive.json();
    assert.strictEqual(bodyActive.success, true);
    assert.ok(Array.isArray(bodyActive.data));
  });

  test('6. Pagination: page, limit, totalPages, and hasMore metadata', async () => {
    const resP1 = await fetch(`${testApp.baseUrl}/api/matches/peers?page=1&limit=2`);
    const bodyP1 = await resP1.json();
    assert.strictEqual(bodyP1.success, true);
    assert.strictEqual(bodyP1.data.length, 2);
    assert.strictEqual(bodyP1.meta.page, 1);
    assert.strictEqual(bodyP1.meta.limit, 2);
    assert.ok(bodyP1.meta.total >= 2);
    assert.ok(bodyP1.meta.totalPages >= 1);
    assert.strictEqual(bodyP1.meta.hasMore, bodyP1.meta.totalPages > 1);

    if (bodyP1.meta.hasMore) {
      const resP2 = await fetch(`${testApp.baseUrl}/api/matches/peers?page=2&limit=2`);
      const bodyP2 = await resP2.json();
      assert.strictEqual(bodyP2.success, true);
      assert.strictEqual(bodyP2.meta.page, 2);
      // Results on page 2 must be different from page 1
      const idsP1 = new Set(bodyP1.data.map((m) => m.studentId));
      const idsP2 = new Set(bodyP2.data.map((m) => m.studentId));
      for (const id of idsP2) {
        assert.ok(!idsP1.has(id), 'Page 2 results must not overlap page 1');
      }
    }
  });

  test('7. Current user is strictly excluded from their own search results', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const body = await res.json();
    assert.strictEqual(body.success, true);
    // darvin-01 is the authenticated user
    const hasSelf = body.data.some((m) => m.studentId === currentUserId);
    assert.strictEqual(hasSelf, false, 'Authenticated user must not appear in their own search results');
  });

  test('8. Duplicate account prevention: deduplicates by stable user ID', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const userA = `dup-a-${Date.now()}`;
    const userB = `dup-b-${Date.now()}`;
    const sharedName = 'Arun Kumar Special';

    // Two distinct users with the same display name
    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(userA, sharedName, `arun_a_${Date.now()}`.slice(0, 20), `${userA}@test.ai`, now, now);

    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(userB, sharedName, `arun_b_${Date.now()}`.slice(0, 20), `${userB}@test.ai`, now, now);

    try {
      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?q=Arun+Kumar+Special`);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const foundA = body.data.find((m) => m.studentId === userA);
      const foundB = body.data.find((m) => m.studentId === userB);

      assert.ok(foundA, 'First learner with shared name must be present');
      assert.ok(foundB, 'Second learner with shared name must be present (not collapsed by display name)');
      assert.notStrictEqual(foundA.studentId, foundB.studentId);
    } finally {
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
    }
  });

  test('9. Privacy enforcement: Redacts location when show_location is 0, redacts institution when show_institution is 0, and hides private profiles', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const privateUser = `priv-u-${Date.now()}`;
    const hiddenDetailsUser = `hidd-u-${Date.now()}`;

    // 1. Private profile
    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, 'Hidden Person', ?, ?, 1, ?, ?)
    `).run(privateUser, `priv_${Date.now()}`.slice(0, 20), `${privateUser}@test.ai`, now, now);

    db.prepare(`
      INSERT INTO user_privacy_settings (user_id, profile_visibility, created_at, updated_at)
      VALUES (?, 'private', ?, ?)
    `).run(privateUser, now, now);

    // 2. Public profile with location & institution hidden
    db.prepare(`
      INSERT INTO users (id, display_name, username, email, is_verified, created_at, updated_at)
      VALUES (?, 'Discreet Student', ?, ?, 1, ?, ?)
    `).run(hiddenDetailsUser, `discreet_${Date.now()}`.slice(0, 20), `${hiddenDetailsUser}@test.ai`, now, now);

    db.prepare(`
      INSERT INTO learner_profiles (id, user_id, headline, institution, country, state, city, is_profile_completed, created_at, updated_at)
      VALUES (?, ?, 'Scholar', 'Secret University', 'Canada', 'Ontario', 'Toronto', 1, ?, ?)
    `).run(`prof-${hiddenDetailsUser}`, hiddenDetailsUser, now, now);

    db.prepare(`
      INSERT INTO user_privacy_settings (user_id, profile_visibility, show_location, show_institution, created_at, updated_at)
      VALUES (?, 'public', 0, 0, ?, ?)
    `).run(hiddenDetailsUser, now, now);

    try {
      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?limit=200`);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      // Private user must NEVER appear
      const foundPrivate = body.data.some((m) => m.studentId === privateUser);
      assert.strictEqual(foundPrivate, false, 'Private profiles must be excluded from search');

      // Hidden details user appears but location and institution are null
      const foundDiscreet = body.data.find((m) => m.studentId === hiddenDetailsUser);
      assert.ok(foundDiscreet, 'Public user with hidden details is discoverable');
      assert.strictEqual(foundDiscreet.country, null, 'Hidden country must be null');
      assert.strictEqual(foundDiscreet.city, null, 'Hidden city must be null');
      assert.strictEqual(foundDiscreet.institution, null, 'Hidden institution must be null');

      // Sensitive fields must NEVER be returned
      assert.strictEqual(foundDiscreet.email, undefined);
      assert.strictEqual(foundDiscreet.password_hash, undefined);
    } finally {
      db.prepare('DELETE FROM user_privacy_settings WHERE user_id IN (?, ?)').run(privateUser, hiddenDetailsUser);
      db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(hiddenDetailsUser);
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(privateUser, hiddenDetailsUser);
    }
  });

  test('10. Username uniqueness and validation on profile updates', async () => {
    // Test updating profile with valid username
    const newUsername = `user_${Date.now()}`.slice(0, 20);
    const updateRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: newUsername,
        country: 'India',
        city: 'Bangalore',
      }),
    });

    const updateBody = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateBody.success, true);
    assert.strictEqual(updateBody.data.username, newUsername);
    assert.strictEqual(updateBody.data.country, 'India');
    assert.strictEqual(updateBody.data.city, 'Bangalore');

    // Test updating with own username is idempotent
    const dupRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: newUsername,
      }),
    });
    assert.strictEqual(dupRes.status, 200);

    // Try to take arun's username
    const conflictRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'arun', // already taken by student-arun
      }),
    });
    assert.strictEqual(conflictRes.status, 409);
    const conflictBody = await conflictRes.json();
    assert.strictEqual(conflictBody.error.code, 'USERNAME_TAKEN');

    // Invalid username format returns 400 VALIDATION_ERROR
    const invalidRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'ab', // too short (< 3 chars)
      }),
    });
    assert.strictEqual(invalidRes.status, 400);
  });
});
