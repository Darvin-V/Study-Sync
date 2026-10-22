import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Study Room Persistent Chat API (Phase 2)', () => {
  let testApp;
  let memberToken;
  let memberUserId;
  let nonMemberToken;
  let nonMemberUserId;
  let privateRoomId;
  const testRoomId = 'room-dbms-norm';

  before(async () => {
    testApp = await startTestServer();

    // 1. Authenticate as seeded member (Darvin is in room-dbms-norm)
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'darvin@demo.studysync.ai',
        password: 'Password123!',
      }),
    });
    const loginBody = await loginRes.json();
    memberToken = loginBody.data.token;
    memberUserId = loginBody.data.user.id;

    // Ensure member is joined to testRoomId
    await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
    });

    // 2. Register an external user who is NOT a member of the room
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nonMemberRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'External Learner',
        email: `outsider.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const nonMemberBody = await nonMemberRes.json();
    nonMemberToken = nonMemberBody.data.token;
    nonMemberUserId = nonMemberBody.data.user.id;
  });

  after(async () => {
    try {
      getDb().prepare("DELETE FROM room_messages WHERE id NOT IN ('msg-01', 'msg-02', 'msg-03')").run();
    } catch {
      // Ignore database cleanup error during shutdown
    }
    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // Test 1: Authorized member retrieving room messages
  // ==========================================================================
  test('1. Authorized member can retrieve room messages via GET /api/rooms/:id/messages', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    const totalCount = body.total ?? body.meta?.total;
    assert.ok(typeof totalCount === 'number');

    if (body.data.length > 0) {
      const msg = body.data[0];
      assert.ok(msg.id);
      assert.ok(msg.room_id);
      assert.ok(msg.sender_id);
      assert.ok(msg.message_content || msg.text);
      assert.ok(msg.created_at);
      assert.ok(msg.sender);
      // Ensure sensitive data is NEVER exposed
      assert.equal(msg.password_hash, undefined);
      assert.equal(msg.token, undefined);
    }
  });

  // ==========================================================================
  // Test 2: Authorized member sending a valid message
  // ==========================================================================
  test('2. Authorized member can send a valid message via POST /api/rooms/:id/messages', async () => {
    const uniqueText = `Proof step verified at ${Date.now()}`;
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        message_content: uniqueText,
        topicTag: 'BCNF',
      }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.equal(body.data.room_id, testRoomId);
    assert.equal(body.data.sender_id, memberUserId);
    assert.equal(body.data.message_content, uniqueText);
    assert.equal(body.data.text, uniqueText);
    assert.equal(body.data.topicTag, 'BCNF');
    assert.ok(body.data.created_at);
    assert.ok(body.data.sender);
  });

  // ==========================================================================
  // Test 3: Message persistence after server restart
  // ==========================================================================
  test('3. Message persists across server restart and SQLite queries', async () => {
    const persistText = `Persistent verification stamp ${Date.now()}`;
    const sendRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        message_content: persistText,
        topicTag: 'Persistence',
      }),
    });
    assert.equal(sendRes.status, 201);
    const sentData = (await sendRes.json()).data;

    // Verify directly in SQLite database
    const db = getDb();
    const row = db.prepare('SELECT * FROM room_messages WHERE id = ?').get(sentData.id);
    assert.ok(row, 'Message must be found in SQLite database');
    assert.equal(row.message_content, persistText);
    assert.equal(row.room_id, testRoomId);
    assert.equal(row.sender_id, memberUserId);

    // Restart the test server to simulate cold restart
    await testApp.close();
    testApp = await startTestServer();

    // Verify message retrieval from brand new server instance
    const checkRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages?limit=100`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(checkRes.status, 200);
    const checkBody = await checkRes.json();
    const persistedMsg = checkBody.data.find((m) => m.id === sentData.id);
    assert.ok(persistedMsg, 'Message must survive server restart and be retrieved');
    assert.equal(persistedMsg.message_content, persistText);

    // Clean up test message
    getDb().prepare('DELETE FROM room_messages WHERE id = ?').run(sentData.id);
  });

  // ==========================================================================
  // Test 4: Unauthenticated user being denied access
  // ==========================================================================
  test('4. Unauthenticated user is denied access to retrieve or send messages (401)', async () => {
    // GET without token
    const getRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`);
    assert.equal(getRes.status, 401);

    // POST without token
    const postRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_content: 'Unauthorized attempt' }),
    });
    assert.equal(postRes.status, 401);
  });

  // ==========================================================================
  // Test 5: Non-member access rules & private rooms
  // ==========================================================================
  test('5. Non-member cannot send messages to room and cannot read private rooms (403)', async () => {
    // Non-member attempting to send message to room they have not joined
    const sendRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nonMemberToken}`,
      },
      body: JSON.stringify({ message_content: 'Non-member post attempt' }),
    });
    assert.equal(sendRes.status, 403);
    const sendBody = await sendRes.json();
    assert.equal(sendBody.success, false);
    assert.equal(sendBody.error.code, 'FORBIDDEN');

    // Create a private room owned by memberUserId to test private access boundaries
    const privRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        title: 'Private Study Group BCNF',
        subject: 'Database Systems',
        topic: 'Query Optimization',
        description: 'Private invite-only study room for advanced queries.',
        status: 'private',
        roomType: 'Learn Together',
        difficulty: 'Advanced',
      }),
    });
    assert.equal(privRes.status, 201);
    const privBody = await privRes.json();
    const privRoomId = privBody.data.id;

    // Non-member attempting to read private room messages
    const readPrivRes = await fetch(`${testApp.baseUrl}/api/rooms/${privRoomId}/messages`, {
      headers: { Authorization: `Bearer ${nonMemberToken}` },
    });
    assert.equal(readPrivRes.status, 403);
    const readPrivBody = await readPrivRes.json();
    assert.equal(readPrivBody.success, false);
    assert.equal(readPrivBody.error.code, 'FORBIDDEN');

    // Authorized creator/member CAN read private room messages
    const memberReadPrivRes = await fetch(`${testApp.baseUrl}/api/rooms/${privRoomId}/messages`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(memberReadPrivRes.status, 200);
  });

  // ==========================================================================
  // Test 6: Client attempting to impersonate another user
  // ==========================================================================
  test('6. Server rejects client impersonation and derives sender identity strictly from session', async () => {
    const maliciousSenderId = 'victim-user-id-999';
    const fakeSenderName = 'Dr. Impersonator';

    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        message_content: 'Trying to forge sender identity',
        sender_id: maliciousSenderId,
        senderId: maliciousSenderId,
        sender: fakeSenderName,
        displayName: fakeSenderName,
      }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    // Must be bound to memberUserId from session, NOT maliciousSenderId
    assert.equal(body.data.sender_id, memberUserId);
    assert.notEqual(body.data.sender_id, maliciousSenderId);
    assert.notEqual(body.data.sender, fakeSenderName);

    // Verify in database row
    const db = getDb();
    const row = db.prepare('SELECT sender_id FROM room_messages WHERE id = ?').get(body.data.id);
    assert.equal(row.sender_id, memberUserId);
  });

  // ==========================================================================
  // Test 7: Blank messages, invalid room IDs, and bounds
  // ==========================================================================
  test('7. Blank messages, whitespace-only messages, and invalid room IDs are rejected', async () => {
    // Blank message
    const emptyRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ message_content: '' }),
    });
    assert.equal(emptyRes.status, 400);

    // Whitespace only
    const wsRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ message_content: '   \n\t   ' }),
    });
    assert.equal(wsRes.status, 400);

    // Message exceeding 2000 chars
    const giantRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ message_content: 'a'.repeat(2001) }),
    });
    assert.equal(giantRes.status, 400);

    // Non-existent room ID
    const notFoundRes = await fetch(`${testApp.baseUrl}/api/rooms/room-non-existent-9999/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ message_content: 'Hello?' }),
    });
    assert.equal(notFoundRes.status, 404);
  });

  // ==========================================================================
  // Test 8: Message ordering and pagination
  // ==========================================================================
  test('8. Messages are ordered chronologically and pagination limits work accurately', async () => {
    // Send 3 distinct sequential messages
    for (let i = 1; i <= 3; i++) {
      await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          message_content: `Sequential test message #${i} - ${Date.now()}`,
        }),
      });
    }

    // Retrieve page 1 with limit=2
    const page1Res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages?limit=2&offset=0`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(page1Res.status, 200);
    const page1 = await page1Res.json();
    assert.equal(page1.data.length, 2);
    const totalCount = page1.total ?? page1.meta?.total;
    assert.ok(totalCount >= 3);
    assert.equal(page1.limit ?? page1.meta?.limit, 2);
    assert.equal(page1.offset ?? page1.meta?.offset, 0);

    // Verify chronological order: msg[0].created_at <= msg[1].created_at
    const t0 = new Date(page1.data[0].created_at).getTime();
    const t1 = new Date(page1.data[1].created_at).getTime();
    assert.ok(t0 <= t1, 'Messages must be sorted in ascending chronological order');

    // Retrieve page 2 with limit=2&offset=2
    const page2Res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/messages?limit=2&offset=2`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(page2Res.status, 200);
    const page2 = await page2Res.json();
    assert.ok(page2.data.length >= 1);
    assert.notEqual(page1.data[0].id, page2.data[0].id);
  });

  // ==========================================================================
  // Test 9: Database integrity check - existing records intact
  // ==========================================================================
  test('9. Database integrity: Existing users, rooms, memberships, and notes remain intact', async () => {
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    assert.ok(userCount >= 4, 'User accounts must remain intact');

    const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
    assert.ok(roomCount >= 2, 'Rooms must remain intact');

    const membershipCount = db.prepare('SELECT COUNT(*) as count FROM room_memberships').get().count;
    assert.ok(membershipCount >= 1, 'Memberships must remain intact');

    const notesCount = db.prepare('SELECT COUNT(*) as count FROM notes_resources').get().count;
    assert.ok(notesCount >= 1, 'Notes and resources must remain intact');
  });
});
