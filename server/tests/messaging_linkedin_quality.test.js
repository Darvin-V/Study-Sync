import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Professional LinkedIn-Quality Messaging System Regression Test Suite', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let userCId;
  let conversationId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A (Alice)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Tester',
        email: `alice.msg.${unique}@test.studysync.ai`,
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
        displayName: 'Bob Partner',
        email: `bob.msg.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    // 3. Register User C (Charlie - Bystander)
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie Bystander',
        email: `charlie.msg.${unique}@test.studysync.ai`,
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

  test('1. Searching recipients returns registered users and excludes self', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/recipients?q=Bob`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    const bob = data.data.find((u) => u.id === userBId);
    assert.ok(bob, 'Bob should appear in recipients search');
    assert.strictEqual(bob.displayName, 'Bob Partner');

    // Self must never appear
    const self = data.data.find((u) => u.id === userAId);
    assert.strictEqual(self, undefined, 'User A should never appear in their own recipient search');
  });

  test('2. Self-messaging is strictly rejected by server (400)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userAId }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('3. Starting a conversation between User A and User B succeeds and deduplicates', async () => {
    const res1 = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.strictEqual(res1.status, 201);
    const data1 = await res1.json();
    conversationId = data1.data.id;
    assert.ok(conversationId);

    // Call create again; must return same conversation without duplicate
    const res2 = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.strictEqual(res2.status, 201);
    const data2 = await res2.json();
    assert.strictEqual(data2.data.id, conversationId, 'Idempotent conversation creation');
  });

  test('4. Two-way messaging in both directions persists chronological order', async () => {
    // A -> B
    const sendResA = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: 'Hi Bob, are you free for a study sprint?' }),
    });
    assert.strictEqual(sendResA.status, 201);
    const msgA = (await sendResA.json()).data;
    assert.strictEqual(msgA.isMine, true);
    assert.strictEqual(msgA.senderId, userAId);

    // B -> A
    const sendResB = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ message_content: 'Hey Alice! Yes, let us review Chapter 4.' }),
    });
    assert.strictEqual(sendResB.status, 201);
    const msgB = (await sendResB.json()).data;
    assert.strictEqual(msgB.isMine, true);
    assert.strictEqual(msgB.senderId, userBId);

    // A retrieves messages
    const getResA = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(getResA.status, 200);
    const msgs = (await getResA.json()).data;
    assert.strictEqual(msgs.length >= 2, true);
    assert.strictEqual(msgs[0].messageContent, 'Hi Bob, are you free for a study sprint?');
    assert.strictEqual(msgs[1].messageContent, 'Hey Alice! Yes, let us review Chapter 4.');
  });

  test('5. Reopening conversation persists messages across re-fetching', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.data.id, conversationId);
    assert.ok(data.data.lastMessagePreview.includes('Chapter 4'));
  });

  test('6. Unread count tracking and read marking', async () => {
    // Send new message from A to B
    await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ message_content: 'Unread test message' }),
    });

    // Check Bob's conversations list -> unread count should be >= 1
    const listB = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const convsB = (await listB.json()).data;
    const targetConv = convsB.find((c) => c.id === conversationId);
    assert.ok(targetConv.unreadCount >= 1, 'Unread count should be positive');

    // Bob opens messages -> marks as read
    await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    // Check Bob's conversations list again -> unread count should be 0
    const listBAfter = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const convsBAfter = (await listBAfter.json()).data;
    const targetConvAfter = convsBAfter.find((c) => c.id === conversationId);
    assert.strictEqual(targetConvAfter.unreadCount, 0, 'Unread count should be cleared to 0');
  });

  test('7. Unauthorized bystander (User C) cannot access conversation or messages (403)', async () => {
    const resConv = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${userCToken}` },
    });
    assert.strictEqual(resConv.status, 403);

    const resMsgs = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${userCToken}` },
    });
    assert.strictEqual(resMsgs.status, 403);

    const sendRes = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userCToken}`,
      },
      body: JSON.stringify({ message_content: 'Hacked intrusion attempt' }),
    });
    assert.strictEqual(sendRes.status, 403);
  });

  test('8. Blocked user safety: Blocked users are excluded from recipient search and messaging (403)', async () => {
    // User A blocks User C
    const blockRes = await fetch(`${testApp.baseUrl}/api/safety/blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ userId: userCId }),
    });
    assert.strictEqual(blockRes.status, 200);

    // User A searches recipients -> User C should not appear
    const searchRes = await fetch(`${testApp.baseUrl}/api/conversations/recipients?q=Charlie`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const searchData = (await searchRes.json()).data;
    assert.strictEqual(searchData.find((u) => u.id === userCId), undefined, 'Blocked user should not appear in search');

    // User C searches recipients -> User A should not appear
    const searchResC = await fetch(`${testApp.baseUrl}/api/conversations/recipients?q=Alice`, {
      headers: { Authorization: `Bearer ${userCToken}` },
    });
    const searchDataC = (await searchResC.json()).data;
    assert.strictEqual(searchDataC.find((u) => u.id === userAId), undefined, 'Blocker should not appear in search');

    // User C attempts to start conversation with User A -> rejected with 403
    const convAttempt = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userCToken}`,
      },
      body: JSON.stringify({ recipientId: userAId }),
    });
    assert.strictEqual(convAttempt.status, 403);
  });
});
