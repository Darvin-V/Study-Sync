import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Study Call End-to-End Integration & Multi-User Meeting Lifecycle Tests', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let userCId;
  let conversationId;
  let dedicatedRoomId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register Alice
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Host',
        email: `alice.call.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // 2. Register Bob
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Participant',
        email: `bob.call.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;

    // 3. Register Charlie (Bystander)
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie Bystander',
        email: `charlie.call.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resC.status, 201);
    const dataC = await resC.json();
    userCToken = dataC.data.token;
    userCId = dataC.data.user.id;

    // 4. Create direct conversation between Alice and Bob
    const convRes = await fetch(`${testApp.baseUrl}/api/conversations/with/${userBId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    });
    assert.strictEqual(convRes.status, 200);
    const convData = await convRes.json();
    conversationId = convData.data.id;
    assert.ok(conversationId, 'Conversation must be created');
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  test('1. Alice clicks Study Call in conversation: creates or returns dedicated 1-to-1 study room', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/study-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.id, 'Must return a room object with valid ID');
    dedicatedRoomId = body.data.id;

    // Room must have both participants registered in membership roster
    const members = body.data.members || [];
    const memberUserIds = members.map((m) => m.id || m.user_id);
    assert.ok(memberUserIds.includes(userAId), 'Alice must be a member');
    assert.ok(memberUserIds.includes(userBId), 'Bob must be a member');

    // Verify room is private and dedicated
    assert.strictEqual(body.data.room_type, 'private');
    assert.ok(body.data.title.includes('Alice Host') && body.data.title.includes('Bob Participant'));
  });

  test('2. Deterministic room mapping: Bob clicking Study Call resolves the exact same dedicated room', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/study-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, dedicatedRoomId, 'Must resolve the exact same dedicated room ID');
  });

  test('3. Security & Privacy: Charlie (bystander) cannot start or access Alice and Bob study call', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/study-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userCToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('4. Alice starts meeting: meeting becomes active with Alice as host', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        meeting_provider: 'jitsi',
        meeting_url: 'https://meet.jit.si/studysync-test-call',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.meeting_active, true);
    assert.strictEqual(body.data.meeting_host_id, userAId);
    assert.strictEqual(body.data.meeting_url, 'https://meet.jit.si/studysync-test-call');
  });

  test('5. Conversation state reflects active meeting for both participants', async () => {
    // Bob checks the conversation
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.hasActiveMeeting, true);
    assert.strictEqual(body.data.roomId, dedicatedRoomId);
    assert.strictEqual(body.data.meetingUrl, 'https://meet.jit.si/studysync-test-call');

    // Bob also lists his conversations
    const listRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    const conv = listBody.data.find((c) => c.id === conversationId);
    assert.ok(conv, 'Conversation must exist in list');
    assert.strictEqual(conv.hasActiveMeeting, true);
  });

  test('6. Bob joins the active meeting as a participant', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.meeting_active, true);
  });

  test('7. Bob leaves the meeting: meeting remains active for Alice', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}/meeting/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // Meeting must still be active for Alice
    assert.strictEqual(body.data.meeting_active, true);

    // Verify room detail still shows active meeting
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const roomBody = await roomRes.json();
    assert.strictEqual(roomBody.data.meeting_active, true);
  });

  test('8. Bob rejoins the meeting', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.meeting_active, true);
  });

  test('9. Bob (non-host participant) tries to end meeting for everyone: fails with 403 Forbidden', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}/meeting`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);

    // Confirm meeting is STILL active
    const checkRes = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkBody = await checkRes.json();
    assert.strictEqual(checkBody.data.meeting_active, true);
  });

  test('10. Alice (meeting host) ends the meeting: successfully terminates call for everyone', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${dedicatedRoomId}/meeting`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.meeting_active, false);

    // Verify conversation reflects meeting is no longer active
    const convRes = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const convBody = await convRes.json();
    assert.strictEqual(convBody.data.hasActiveMeeting, false);
  });

  test('11. Block check: user cannot start study call if participants are blocked', async () => {
    // Alice blocks Bob
    await fetch(`${testApp.baseUrl}/api/safety/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ targetUserId: userBId }),
    });

    // Bob tries to open study call
    const res = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/study-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error?.message?.includes('blocking restrictions'));
  });
});
