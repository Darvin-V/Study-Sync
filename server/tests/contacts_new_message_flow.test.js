import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Contacts & New Message Flow Tests', () => {
  let testServer;
  let baseUrl;
  let userACookie;
  let userAId;
  let userBId;
  let bobName;
  let davidName;

  before(async () => {
    testServer = await startTestServer();
    baseUrl = testServer.baseUrl;

    const uniqueSuffix = Date.now();
    bobName = `Bob Unique ${uniqueSuffix}`;
    davidName = `David Unique ${uniqueSuffix}`;

    // 1. Register User A (Alice - verified)
    const regResA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `alice.contacts.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `Alice Unique ${uniqueSuffix}`,
      }),
    });
    userACookie = regResA.headers.get('set-cookie');
    const dataA = await regResA.json();
    userAId = dataA.data.user.id;

    // 2. Register User B (Bob - verified)
    const regResB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `bob.contacts.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: bobName,
      }),
    });
    const dataB = await regResB.json();
    userBId = dataB.data.user.id;

    // Add subjects and preferences for Bob
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO user_subjects (id, user_id, subject, created_at)
      VALUES (?, ?, ?, ?)
    `).run(`subj_bob_${uniqueSuffix}`, userBId, 'Quantum Computing QA', now);

    db.prepare(`
      INSERT OR REPLACE INTO learner_profiles (id, user_id, headline, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`prof_bob_${uniqueSuffix}`, userBId, 'Physics Researcher', 'MIT Physics Lab', now, now);

    // 3. Create an UNVERIFIED learner Charlie (is_verified = 0)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(`unverified_charlie_${uniqueSuffix}`, `charlie.${uniqueSuffix}@example.edu`, 'hash123', `Charlie Unverified ${uniqueSuffix}`, now, now);

    // 4. Create DUPLICATE entries for "David Unique" to test deduplication
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(`david_dup_1_${uniqueSuffix}`, `david1.${uniqueSuffix}@example.edu`, 'hash123', davidName, now, now);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(`david_dup_2_${uniqueSuffix}`, `david2.${uniqueSuffix}@example.edu`, 'hash123', davidName, now, now);
  });

  after(async () => {
    if (testServer) {
      await testServer.close();
    }
  });

  it('1. rejects unauthenticated requests to recipients/contacts API', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/recipients`);
    assert.equal(res.status, 401, 'Must return 401 Unauthorized when not logged in');
  });

  it('2. returns verified learners and excludes self and unverified learners', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/recipients`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const contactIds = body.data.map((c) => c.id);
    const contactNames = body.data.map((c) => c.displayName);

    // Current user (Alice) must NOT appear in their own contacts
    assert.ok(!contactIds.includes(userAId), 'Alice should not see herself in contacts');

    // Unverified user Charlie must NOT appear
    assert.ok(!contactNames.some((n) => n.includes('Charlie Unverified')), 'Unverified user should not be in contacts');

    // Bob must appear
    assert.ok(contactNames.includes(bobName), 'Bob should be in verified contacts');

    // Private email addresses must never be exposed
    body.data.forEach((c) => {
      assert.equal(c.email, undefined, 'Private email address must not be exposed in recipient contacts');
    });
  });

  it('3. deduplicates learners with identical display names', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/recipients?q=${encodeURIComponent(davidName)}`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const matches = body.data.filter((c) => c.displayName === davidName);
    assert.equal(matches.length, 1, 'Duplicate learner rows must be collapsed into exactly 1 row');
  });

  it('4. supports searching contacts by academic subject', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/recipients?q=Quantum+Computing`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const foundBob = body.data.some((c) => c.displayName === bobName);
    assert.ok(foundBob, 'Searching by subject "Quantum Computing" should return Bob who studies Quantum Computing QA');
  });

  it('5. supports searching contacts by learner display name', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/recipients?q=${encodeURIComponent(bobName)}`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const foundBob = body.data.some((c) => c.displayName === bobName);
    assert.ok(foundBob, 'Searching by name should return Bob');
  });

  it('6. creating or opening a conversation with a contact is idempotent', async () => {
    // First creation
    const res1 = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    assert.ok(data1.data?.id);
    const convId1 = data1.data.id;

    // Second call to open same contact
    const res2 = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.equal(res2.status, 201);
    const data2 = await res2.json();
    assert.equal(data2.data?.id, convId1, 'Should return the existing conversation ID without creating duplicates');
  });

  it('7. excludes blocked users from contacts list', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    // Alice blocks Bob in user_blocks
    db.prepare(`
      INSERT OR REPLACE INTO user_blocks (id, blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run('block_alice_bob_qa', userAId, userBId, now);

    const res = await fetch(`${baseUrl}/api/conversations/recipients?q=${encodeURIComponent(bobName)}`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    const bobInList = body.data.some((c) => c.displayName === bobName);
    assert.equal(bobInList, false, 'Blocked user Bob must not appear in Alice contacts list');

    // Clean up block
    db.prepare(`DELETE FROM user_blocks WHERE id = ?`).run('block_alice_bob_qa');
  });
});
