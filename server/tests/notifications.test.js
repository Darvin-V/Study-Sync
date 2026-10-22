import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import NotificationModel from '../models/notification.model.js';

describe('StudySync AI Notification System & Event Integration', () => {
  let testApp;
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let conversationId;
  const unique = Date.now();

  before(async () => {
    testApp = await startTestServer();

    // Register User A (Alice)
    const regResA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Notification',
        email: `alice.notif.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regA = await regResA.json();
    userAToken = regA.data.token;
    userAId = regA.data.user.id;

    // Register User B (Bob)
    const regResB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Notification',
        email: `bob.notif.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regB = await regResB.json();
    userBToken = regB.data.token;
    userBId = regB.data.user.id;
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  test('1. Unauthenticated requests are rejected with 401', async () => {
    const resGet = await fetch(`${testApp.baseUrl}/api/notifications`);
    assert.strictEqual(resGet.status, 401);

    const resCount = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`);
    assert.strictEqual(resCount.status, 401);

    const resMarkAll = await fetch(`${testApp.baseUrl}/api/notifications/mark-all-read`, {
      method: 'POST',
    });
    assert.strictEqual(resMarkAll.status, 401);

    const resPatch = await fetch(`${testApp.baseUrl}/api/notifications/notif-123/read`, {
      method: 'PATCH',
    });
    assert.strictEqual(resPatch.status, 401);

    const resDelete = await fetch(`${testApp.baseUrl}/api/notifications/notif-123`, {
      method: 'DELETE',
    });
    assert.strictEqual(resDelete.status, 401);
  });

  test('2. New user starts with empty notification inbox and 0 unread', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(data.data, []);
    assert.strictEqual(data.meta.unreadCount, 0);

    const countRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const countData = await countRes.json();
    assert.strictEqual(countData.data.count, 0);
  });

  test('3. Real Event: Direct Message creates notification and increments unread count', async () => {
    // Alice sends Bob a direct message via conversation creation
    const sendMsgRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        recipientId: userBId,
        message: 'Hey Bob, want to study algorithms together?',
      }),
    });
    assert.strictEqual(sendMsgRes.status, 201);
    const convData = await sendMsgRes.json();
    conversationId = convData.data.id;

    // Alice unread count should be 0 (sender)
    const aliceCountRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const aliceCount = await aliceCountRes.json();
    assert.strictEqual(aliceCount.data.count, 0);

    // Bob unread count should be 1
    const bobCountRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const bobCount = await bobCountRes.json();
    assert.strictEqual(bobCount.data.count, 1);

    // Bob fetches notifications
    const bobNotifsRes = await fetch(`${testApp.baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const bobNotifs = await bobNotifsRes.json();
    assert.strictEqual(bobNotifs.data.length, 1);
    const notif = bobNotifs.data[0];
    assert.strictEqual(notif.type, 'direct_message');
    assert.strictEqual(notif.isRead, false);
    assert.ok(notif.title.includes('Alice Notification'));
    assert.ok(notif.body.includes('Hey Bob, want to study'));
    assert.ok(notif.targetUrl.startsWith('/messages'));
  });

  test('4. Deduplication: Subsequent message in same conversation updates existing notification instead of duplicating', async () => {
    // Alice sends Bob a second message in the same conversation
    const sendMsgRes2 = await fetch(`${testApp.baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        message_content: 'Let me know what time works best!',
      }),
    });
    assert.strictEqual(sendMsgRes2.status, 201);

    // Bob should still have only 1 notification (deduplicated unread conversation notification)
    const bobNotifsRes = await fetch(`${testApp.baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const bobNotifs = await bobNotifsRes.json();
    assert.strictEqual(bobNotifs.data.length, 1);
    assert.strictEqual(bobNotifs.meta.unreadCount, 1);
    assert.ok(bobNotifs.data[0].body.includes('what time works best'));
  });

  test('5. Filtering: All vs Unread filters work correctly', async () => {
    // Query with filter=all
    const allRes = await fetch(`${testApp.baseUrl}/api/notifications?filter=all`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const allData = await allRes.json();
    assert.strictEqual(allData.data.length, 1);
    assert.strictEqual(allData.meta.filter, 'all');

    // Query with filter=unread
    const unreadRes = await fetch(`${testApp.baseUrl}/api/notifications?filter=unread`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const unreadData = await unreadRes.json();
    assert.strictEqual(unreadData.data.length, 1);
    assert.strictEqual(unreadData.meta.filter, 'unread');
  });

  test('6. Mark single notification as read', async () => {
    const listRes = await fetch(`${testApp.baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const listData = await listRes.json();
    const notifId = listData.data[0].id;

    // Mark as read
    const patchRes = await fetch(`${testApp.baseUrl}/api/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.data.success, true);
    assert.strictEqual(patchData.data.isRead, true);

    // Check unread count is now 0
    const countRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const countData = await countRes.json();
    assert.strictEqual(countData.data.count, 0);

    // Filter=unread should now be empty
    const unreadRes = await fetch(`${testApp.baseUrl}/api/notifications?filter=unread`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const unreadData = await unreadRes.json();
    assert.strictEqual(unreadData.data.length, 0);

    // Filter=all should still have the 1 notification, now marked isRead: true
    const allRes = await fetch(`${testApp.baseUrl}/api/notifications?filter=all`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const allData = await allRes.json();
    assert.strictEqual(allData.data.length, 1);
    assert.strictEqual(allData.data[0].isRead, true);
  });

  test('7. Real Event: Room join activity notifies room creator', async () => {
    // Alice creates a study room
    const createRoomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        room_name: 'Deep Learning Study Pod',
        subject: 'Computer Science',
        topic: 'Machine Learning',
        max_capacity: 5,
      }),
    });
    assert.strictEqual(createRoomRes.status, 201);
    const createRoom = await createRoomRes.json();
    const roomId = createRoom.data.id;

    // Bob joins Alice's room
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(joinRes.status, 200);

    // Alice should receive room_activity notification
    const aliceNotifsRes = await fetch(`${testApp.baseUrl}/api/notifications?filter=unread`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const aliceNotifs = await aliceNotifsRes.json();
    assert.strictEqual(aliceNotifs.data.length, 1);
    const roomNotif = aliceNotifs.data[0];
    assert.strictEqual(roomNotif.type, 'room_activity');
    assert.ok(roomNotif.title.includes('joined'));
    assert.ok(roomNotif.body.includes('Deep Learning Study Pod'));
    assert.strictEqual(roomNotif.targetUrl, `/rooms/${roomId}`);
  });

  test('8. Real Event: Session / Study Invite creates notification', async () => {
    // Bob sends Alice a study invite
    const inviteRes = await fetch(`${testApp.baseUrl}/api/safety/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        receiverId: userAId,
        topic: 'Calculus Problem Session',
        message: 'Let us practice integrals!',
      }),
    });
    assert.strictEqual(inviteRes.status, 201);

    // Alice now has 2 unread notifications (room join + session invite)
    const aliceCountRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const aliceCount = await aliceCountRes.json();
    assert.strictEqual(aliceCount.data.count, 2);
  });

  test('9. Mark all as read clears all unread notifications', async () => {
    // Alice marks all as read
    const markAllRes = await fetch(`${testApp.baseUrl}/api/notifications/mark-all-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(markAllRes.status, 200);
    const markAllData = await markAllRes.json();
    assert.strictEqual(markAllData.data.success, true);
    assert.strictEqual(markAllData.data.markedCount, 2);

    // Alice unread count is 0
    const countRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const countData = await countRes.json();
    assert.strictEqual(countData.data.count, 0);
  });

  test('10. Blocking Safety: Blocked users cannot generate notifications', async () => {
    // Alice blocks Bob
    const blockRes = await fetch(`${testApp.baseUrl}/api/safety/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        targetUserId: userBId,
      }),
    });
    assert.strictEqual(blockRes.status, 200);

    // Attempting to create a notification directly via model from Bob to Alice
    const blockedNotif = NotificationModel.createNotification({
      userId: userAId,
      actorId: userBId,
      type: 'direct_message',
      title: 'Spam test',
      body: 'Should be blocked',
    });
    assert.strictEqual(blockedNotif, null, 'Notification from blocked user must be dropped');

    // Alice unread count remains 0
    const countRes = await fetch(`${testApp.baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const countData = await countRes.json();
    assert.strictEqual(countData.data.count, 0);
  });

  test('11. Delete notification: User can delete own notification; cannot delete another user notification', async () => {
    // Alice gets list of notifications
    const aliceListRes = await fetch(`${testApp.baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const aliceList = await aliceListRes.json();
    assert.ok(aliceList.data.length >= 2);
    const targetNotifId = aliceList.data[0].id;

    // Bob tries to delete Alice's notification
    const bobDelRes = await fetch(`${testApp.baseUrl}/api/notifications/${targetNotifId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(bobDelRes.status, 200);
    const bobDelData = await bobDelRes.json();
    assert.strictEqual(bobDelData.data.success, false, 'Bob cannot delete Alice notification');

    // Alice deletes her own notification
    const aliceDelRes = await fetch(`${testApp.baseUrl}/api/notifications/${targetNotifId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(aliceDelRes.status, 200);
    const aliceDelData = await aliceDelRes.json();
    assert.strictEqual(aliceDelData.data.success, true);

    // Alice notification count decreased by 1
    const aliceAfterRes = await fetch(`${testApp.baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const aliceAfter = await aliceAfterRes.json();
    assert.strictEqual(aliceAfter.data.length, aliceList.data.length - 1);
  });
});
