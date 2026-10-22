import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Circle Relationships & Messaging Integrity Tests', () => {
  let testServer;
  let baseUrl;
  let userACookie;
  let userAId;
  let userBCookie;
  let userBId;
  let userCId;
  let blockedUserId;
  let unverifiedUserId;

  before(async () => {
    testServer = await startTestServer();
    baseUrl = testServer.baseUrl;

    const uniqueSuffix = Date.now();

    // 1. Register User A (Alice - verified)
    const regResA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `alice.circle.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `Alice Circle ${uniqueSuffix}`,
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
        email: `bob.circle.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `Bob Circle ${uniqueSuffix}`,
      }),
    });
    userBCookie = regResB.headers.get('set-cookie');
    const dataB = await regResB.json();
    userBId = dataB.data.user.id;

    // 3. Register User C (Charlie - verified)
    const regResC = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `charlie.circle.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `Charlie Circle ${uniqueSuffix}`,
      }),
    });
    const dataC = await regResC.json();
    userCId = dataC.data.user.id;

    // Add profile and subjects for Bob and Charlie
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO user_subjects (id, user_id, subject, created_at)
      VALUES (?, ?, ?, ?)
    `).run(`subj_bob_${uniqueSuffix}`, userBId, 'Advanced Distributed Systems', now);

    db.prepare(`
      INSERT OR REPLACE INTO learner_profiles (id, user_id, headline, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`prof_bob_${uniqueSuffix}`, userBId, 'Cloud Computing Fellow', 'Stanford University', now, now);

    db.prepare(`
      INSERT OR IGNORE INTO user_subjects (id, user_id, subject, created_at)
      VALUES (?, ?, ?, ?)
    `).run(`subj_charlie_${uniqueSuffix}`, userCId, 'Linear Algebra & Calculus', now);

    // 4. Create an unverified user
    unverifiedUserId = `unverified_${uniqueSuffix}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(unverifiedUserId, `unverified.${uniqueSuffix}@example.edu`, 'hash123', `Unverified ${uniqueSuffix}`, now, now);

    // 5. Create a user to be blocked by Alice
    blockedUserId = `blocked_${uniqueSuffix}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(blockedUserId, `blocked.${uniqueSuffix}@example.edu`, 'hash123', `Blocked Student ${uniqueSuffix}`, now, now);

    db.prepare(`
      INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(`block_${uniqueSuffix}`, userAId, blockedUserId, now);
  });

  after(async () => {
    if (testServer) {
      await testServer.close();
    }
  });

  it('1. Rejects unauthenticated requests to /api/circle', async () => {
    const res = await fetch(`${baseUrl}/api/circle`);
    assert.equal(res.status, 401, 'Must require authentication');
  });

  it('2. Prevents user from adding themselves to their Circle', async () => {
    const res = await fetch(`${baseUrl}/api/circle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: userACookie,
      },
      body: JSON.stringify({ memberId: userAId }),
    });
    assert.equal(res.status, 400, 'Adding self must be rejected with 400');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error?.message || '', /Cannot add yourself/i);
  });

  it('3. Prevents adding unverified users to Circle', async () => {
    const res = await fetch(`${baseUrl}/api/circle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: userACookie,
      },
      body: JSON.stringify({ memberId: unverifiedUserId }),
    });
    assert.equal(res.status, 400, 'Adding unverified user must return 400');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error?.message || '', /unverified/i);
  });

  it('4. Prevents adding blocked users to Circle', async () => {
    const res = await fetch(`${baseUrl}/api/circle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: userACookie,
      },
      body: JSON.stringify({ memberId: blockedUserId }),
    });
    assert.equal(res.status, 403, 'Adding blocked user must return 403 Forbidden');
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error?.message || '', /blocked/i);
  });

  it('5. Successfully adds a verified learner to Circle and does NOT auto-create conversations or meetings', async () => {
    // Check initial conversation count for Alice
    const convBeforeRes = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Cookie: userACookie },
    });
    const convBefore = await convBeforeRes.json();
    const countBefore = convBefore.data?.length || 0;

    // Add Bob to Alice's Circle
    const addRes = await fetch(`${baseUrl}/api/circle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ memberId: userBId }),
    });
    assert.equal(addRes.status, 201, 'Should return 201 Created');
    const addBody = await addRes.json();
    assert.equal(addBody.success, true);
    assert.equal(addBody.data.inCircle, true);

    // Verify conversation count did NOT increase (no auto-conversation)
    const convAfterRes = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Cookie: userACookie },
    });
    const convAfter = await convAfterRes.json();
    const countAfter = convAfter.data?.length || 0;
    assert.equal(countAfter, countBefore, 'Adding to Circle must not create a conversation');
  });

  it('6. Adding duplicate member to Circle is idempotent', async () => {
    const addAgainRes = await fetch(`${baseUrl}/api/circle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ memberId: userBId }),
    });
    assert.ok(addAgainRes.status === 200 || addAgainRes.status === 201);
    const body = await addAgainRes.json();
    assert.equal(body.success, true);

    // Verify single row in user_circle
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM user_circle WHERE user_id = ? AND member_id = ?`).all(userAId, userBId);
    assert.equal(rows.length, 1, 'There must only be 1 row in user_circle for this pair');
  });

  it('7. Fetches Circle member IDs and checks inCircle status', async () => {
    // 1. /api/circle/ids
    const idsRes = await fetch(`${baseUrl}/api/circle/ids`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(idsRes.status, 200);
    const idsBody = await idsRes.json();
    assert.equal(idsBody.success, true);
    assert.ok(Array.isArray(idsBody.data));
    assert.ok(idsBody.data.includes(userBId), 'IDs must include Bob');
    assert.ok(!idsBody.data.includes(userCId), 'IDs must not include Charlie yet');

    // 2. /api/circle/check/:memberId
    const checkB = await fetch(`${baseUrl}/api/circle/check/${userBId}`, {
      headers: { Cookie: userACookie },
    });
    const checkBBody = await checkB.json();
    assert.equal(checkBBody.data.inCircle, true);

    const checkC = await fetch(`${baseUrl}/api/circle/check/${userCId}`, {
      headers: { Cookie: userACookie },
    });
    const checkCBody = await checkC.json();
    assert.equal(checkCBody.data.inCircle, false);
  });

  it('8. Lists Circle members with query filtering and excludes private emails', async () => {
    // Add Charlie as well
    await fetch(`${baseUrl}/api/circle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ memberId: userCId }),
    });

    // 1. Fetch all Circle members
    const listRes = await fetch(`${baseUrl}/api/circle`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.success, true);
    assert.equal(listBody.data.length, 2, 'Alice should have 2 Circle members');

    // Ensure email is NEVER exposed
    listBody.data.forEach((m) => {
      assert.equal(m.email, undefined, 'Private email address must not be exposed');
    });

    // 2. Query filter by subject 'Distributed'
    const searchSubjectRes = await fetch(`${baseUrl}/api/circle?query=Distributed`, {
      headers: { Cookie: userACookie },
    });
    const searchSubjectBody = await searchSubjectRes.json();
    assert.equal(searchSubjectBody.data.length, 1);
    assert.equal(searchSubjectBody.data[0].id, userBId);

    // 3. Query filter by name 'Charlie'
    const searchNameRes = await fetch(`${baseUrl}/api/circle?query=Charlie`, {
      headers: { Cookie: userACookie },
    });
    const searchNameBody = await searchNameRes.json();
    assert.equal(searchNameBody.data.length, 1);
    assert.equal(searchNameBody.data[0].id, userCId);
  });

  it('9. Removes member from Circle while preserving conversation and message history', async () => {
    // First, explicitly create a conversation between Alice and Bob
    const createConvRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.equal(createConvRes.status, 201);
    const convBody = await createConvRes.json();
    const convId = convBody.data.id;

    // Send a message in the conversation
    const sendMsgRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userACookie,
      },
      body: JSON.stringify({ content: 'Hello Bob from Circle test!' }),
    });
    assert.equal(sendMsgRes.status, 201);

    // Now remove Bob from Alice's Circle
    const removeRes = await fetch(`${baseUrl}/api/circle/${userBId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: userACookie,
      },
    });
    assert.equal(removeRes.status, 200);
    const removeBody = await removeRes.json();
    assert.equal(removeBody.success, true);
    assert.equal(removeBody.data.inCircle, false);

    // Verify Bob is no longer in Alice's Circle
    const checkAfter = await fetch(`${baseUrl}/api/circle/check/${userBId}`, {
      headers: { Cookie: userACookie },
    });
    const checkAfterBody = await checkAfter.json();
    assert.equal(checkAfterBody.data.inCircle, false);

    // CRITICAL: Verify conversation and message history remain accessible!
    const getConvRes = await fetch(`${baseUrl}/api/conversations/${convId}`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(getConvRes.status, 200, 'Conversation must still exist');

    const getMsgsRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
      headers: { Cookie: userACookie },
    });
    assert.equal(getMsgsRes.status, 200, 'Messages must still be accessible');
    const msgsBody = await getMsgsRes.json();
    const messages = msgsBody.data?.messages || msgsBody.data || [];
    assert.ok(messages.length >= 1, 'Message history must be intact');
    assert.equal(messages[0].text || messages[0].messageContent, 'Hello Bob from Circle test!');
  });
});
