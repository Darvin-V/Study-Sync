import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Messaging Navigation, Canonical Destination & Partner Discovery Flow Audit', () => {
  let testApp;
  let userAToken, userAId;
  let userBToken, userBId;
  let conversationId;

  before(async () => {
    testApp = await startTestServer();
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Register User A (Student finding partner)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Student One',
        email: `student1.${tag}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // Register User B (Peer learner discovered in Partner Discovery)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Student Two',
        email: `student2.${tag}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  test('1. First-time student has clean empty conversation list', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(data.data, []);
  });

  test('2. Starting a conversation from Partner Discovery creates canonical conversation', async () => {
    // User A clicks "Message" on User B's card -> routes to canonical system
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.id);
    assert.strictEqual(json.data.otherParticipant.id, userBId);
    conversationId = json.data.id;
  });

  test('3. Re-triggering Message from Partner Discovery returns existing conversation (idempotent)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.data.id, conversationId);
  });

  test('4. Conversation list now includes active conversation with partner details', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.length, 1);
    assert.strictEqual(json.data[0].id, conversationId);
    assert.strictEqual(json.data[0].otherParticipant.id, userBId);
  });

  test('5. Direct navigation / Page refresh loads conversation by ID directly (?conv=id)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, conversationId);
    assert.strictEqual(json.data.otherParticipant.id, userBId);
  });

  test('6. Sending a direct message persists and delivers content', async () => {
    const messageContent = 'Hi! Ready to collaborate on DBMS normalisation?';
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: messageContent }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.messageContent, messageContent);
    assert.strictEqual(json.data.senderId, userAId);
  });

  test('7. Partner (User B) sees conversation, unread badge, and message history', async () => {
    // Check conversation list for User B
    const listRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listJson = await listRes.json();
    assert.strictEqual(listJson.data.length, 1);
    assert.strictEqual(listJson.data[0].unreadCount, 1);
    assert.strictEqual(listJson.data[0].otherParticipant.id, userAId);

    // Opening thread fetches messages and marks them as read
    const msgsRes = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(msgsRes.status, 200);
    const msgsJson = await msgsRes.json();
    assert.strictEqual(msgsJson.data.length, 1);
    assert.strictEqual(msgsJson.data[0].messageContent, 'Hi! Ready to collaborate on DBMS normalisation?');

    // Subsequent check shows unread count is cleared (0)
    const afterRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const afterJson = await afterRes.json();
    assert.strictEqual(afterJson.data[0].unreadCount, 0);
  });

  test('8. Partner (User B) replies and User A receives message', async () => {
    const replyContent = 'Yes, let us start with 3NF synthesis algorithm problem set!';
    const replyRes = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ message_content: replyContent }),
    });
    assert.strictEqual(replyRes.status, 201);

    // User A fetches messages
    const aMsgsRes = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(aMsgsRes.status, 200);
    const aMsgsJson = await aMsgsRes.json();
    assert.strictEqual(aMsgsJson.data.length, 2);
    assert.strictEqual(aMsgsJson.data[1].messageContent, replyContent);
    assert.strictEqual(aMsgsJson.data[1].isMine, false);
  });
});
