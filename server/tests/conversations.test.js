import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Secure Direct Messaging & 1-to-1 Conversations API (Phase 4)', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let userCId;
  let sharedConversationId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A (Alice)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice DM',
        email: `alice.dm.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // 2. Register User B (Bob)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob DM',
        email: `bob.dm.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    // 3. Register User C (Charlie / Bystander)
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie Outsider',
        email: `charlie.dm.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resC.status, 201);
    const dataC = await resC.json();
    userCToken = dataC.data.token;
    userCId = dataC.data.user.id;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // Test 1: Unauthenticated access denied
  // ==========================================================================
  test('1. Unauthenticated requests to /api/conversations are rejected with 401', async () => {
    const listRes = await fetch(`${testApp.baseUrl}/api/conversations`);
    assert.strictEqual(listRes.status, 401);

    const postRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.strictEqual(postRes.status, 401);

    const msgRes = await fetch(`${testApp.baseUrl}/api/conversations/conv-fake-id/messages`);
    assert.strictEqual(msgRes.status, 401);
  });

  // ==========================================================================
  // Test 2: Creating a conversation between User A and User B
  // ==========================================================================
  test('2. Authenticated user can create or open a 1-to-1 conversation with a peer', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        recipientId: userBId,
        message: 'Hello Bob, nice to connect for DBMS study!',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.id);
    assert.strictEqual(body.data.otherParticipant.id, userBId);
    assert.strictEqual(body.data.otherParticipant.displayName, 'Bob DM');
    assert.ok(body.data.initialMessage);
    assert.strictEqual(body.data.initialMessage.messageContent, 'Hello Bob, nice to connect for DBMS study!');
    assert.strictEqual(body.data.initialMessage.senderId, userAId);

    sharedConversationId = body.data.id;
  });

  // ==========================================================================
  // Test 3: Duplicate conversation prevention
  // ==========================================================================
  test('3. Opening a conversation between the same users again returns the existing conversation without duplicates', async () => {
    // User B opens conversation with User A
    const resB = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ recipientId: userAId }),
    });

    assert.strictEqual(resB.status, 201);
    const bodyB = await resB.json();
    assert.strictEqual(bodyB.data.id, sharedConversationId, 'Must return the same conversation ID');
    assert.strictEqual(bodyB.data.otherParticipant.id, userAId);

    // Verify in database: exactly 1 conversation exists between A and B
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM conversations
      WHERE (participant_one_id = ? AND participant_two_id = ?)
         OR (participant_one_id = ? AND participant_two_id = ?)
    `).all(userAId, userBId, userBId, userAId);

    assert.strictEqual(rows.length, 1, 'Only one conversation row must exist in SQLite');
  });

  // ==========================================================================
  // Test 4: Cannot start conversation with self or invalid user
  // ==========================================================================
  test('4. Server rejects starting conversation with oneself (400) or non-existent user (404)', async () => {
    // Self-conversation
    const selfRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userAId }),
    });
    assert.strictEqual(selfRes.status, 400);

    // Non-existent user
    const notFoundRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: 'usr-nonexistent-99999' }),
    });
    assert.strictEqual(notFoundRes.status, 404);
  });

  // ==========================================================================
  // Test 5: Sending and retrieving direct messages
  // ==========================================================================
  test('5. Participants can exchange messages and retrieve chronological history', async () => {
    // Bob replies to Alice
    const replyRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        message_content: 'Hi Alice! Excited to study Normalisation together.',
      }),
    });
    assert.strictEqual(replyRes.status, 201);
    const replyBody = await replyRes.json();
    assert.strictEqual(replyBody.data.senderId, userBId);
    assert.strictEqual(replyBody.data.messageContent, 'Hi Alice! Excited to study Normalisation together.');

    // Alice retrieves conversation messages
    const getRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json();
    assert.ok(Array.isArray(getBody.data));
    assert.strictEqual(getBody.data.length, 2);
    assert.strictEqual(getBody.data[0].senderId, userAId);
    assert.strictEqual(getBody.data[0].isMine, true);
    assert.strictEqual(getBody.data[1].senderId, userBId);
    assert.strictEqual(getBody.data[1].isMine, false);
  });

  // ==========================================================================
  // Test 6: Message persistence across server cold restart
  // ==========================================================================
  test('6. Direct messages survive server restart and retain SQLite persistence', async () => {
    const persistText = `Survive cold restart ${Date.now()}`;
    const sendRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: persistText }),
    });
    assert.strictEqual(sendRes.status, 201);
    const sentData = (await sendRes.json()).data;

    // Restart test server
    await testApp.close();
    testApp = await startTestServer();

    // Verify retrieval on fresh server
    const checkRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(checkRes.status, 200);
    const checkBody = await checkRes.json();
    const foundMsg = checkBody.data.find((m) => m.id === sentData.id);
    assert.ok(foundMsg, 'Message must be found after server restart');
    assert.strictEqual(foundMsg.messageContent, persistText);
  });

  // ==========================================================================
  // Test 7: Unauthorized third party cannot access or send messages (403)
  // ==========================================================================
  test('7. Unauthorized bystander (User C) cannot view or send messages in User A and B conversation (403)', async () => {
    // Charlie attempts to view conversation details
    const viewConvRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}`, {
      headers: { Authorization: `Bearer ${userCToken}` },
    });
    assert.strictEqual(viewConvRes.status, 403);

    // Charlie attempts to read conversation messages
    const readMsgRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${userCToken}` },
    });
    assert.strictEqual(readMsgRes.status, 403);

    // Charlie attempts to send a message into Alice & Bob conversation
    const sendMsgRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userCToken}`,
      },
      body: JSON.stringify({ message_content: 'Unauthorized eavesdropping message' }),
    });
    assert.strictEqual(sendMsgRes.status, 403);
  });

  // ==========================================================================
  // Test 8: Sender identity impersonation prevention
  // ==========================================================================
  test('8. Sender identity is derived strictly from server session, ignoring client-provided senderId', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        message_content: 'Authentic message from Bob',
        senderId: userAId, // Attempted spoof: claim to be Alice
        sender_id: userAId,
      }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    // Server must derive sender strictly from User B's token
    assert.strictEqual(body.data.senderId, userBId);
    assert.notStrictEqual(body.data.senderId, userAId);
  });

  // ==========================================================================
  // Test 9: Input validation (blank or excessively long messages)
  // ==========================================================================
  test('9. Blank messages, whitespace-only, and excessively long messages (>2000 chars) are rejected with 400', async () => {
    // Blank message
    const emptyRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: '' }),
    });
    assert.strictEqual(emptyRes.status, 400);

    // Whitespace only
    const wsRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: '     \n\t   ' }),
    });
    assert.strictEqual(wsRes.status, 400);

    // Excessively long message
    const longText = 'A'.repeat(2500);
    const longRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: longText }),
    });
    assert.strictEqual(longRes.status, 400);
  });

  // ==========================================================================
  // Test 10: Respecting user blocks
  // ==========================================================================
  test('10. Blocked users cannot initiate conversations or send direct messages (403)', async () => {
    const db = getDb();
    const blockId = `blk-${Date.now()}`;
    const now = new Date().toISOString();

    // Alice blocks Charlie
    db.prepare(`
      INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(blockId, userAId, userCId, now);

    // Charlie attempts to start conversation with Alice
    const startRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userCToken}`,
      },
      body: JSON.stringify({ recipientId: userAId, message: 'Should be blocked' }),
    });
    assert.strictEqual(startRes.status, 403);

    // Alice also cannot message blocked Charlie
    const aliceRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userCId }),
    });
    assert.strictEqual(aliceRes.status, 403);

    // Clean up block
    db.prepare('DELETE FROM user_blocks WHERE id = ?').run(blockId);
  });
});
