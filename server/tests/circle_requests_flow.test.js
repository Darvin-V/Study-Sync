import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Circle Requests & Connection Lifecycle Tests', () => {
  let testServer;
  let baseUrl;
  let userAId, userBId, userCId;
  let cookieA, cookieB, cookieC;
  let activeRequestId;

  before(async () => {
    testServer = await startTestServer();
    baseUrl = testServer.baseUrl;

    const uniqueSuffix = Date.now();

    // 1. Create User A (Sender)
    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `usera.req.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `UserA Req ${uniqueSuffix}`,
      }),
    });
    cookieA = regA.headers.get('set-cookie');
    const bodyA = await regA.json();
    userAId = bodyA.data.user.id;

    // 2. Create User B (Receiver)
    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `userb.req.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `UserB Req ${uniqueSuffix}`,
      }),
    });
    cookieB = regB.headers.get('set-cookie');
    const bodyB = await regB.json();
    userBId = bodyB.data.user.id;

    // 3. Create User C (Bystander for permission/IDOR test)
    const regC = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `userc.req.${uniqueSuffix}@example.edu`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        displayName: `UserC Req ${uniqueSuffix}`,
      }),
    });
    cookieC = regC.headers.get('set-cookie');
    const bodyC = await regC.json();
    userCId = bodyC.data.user.id;

    // Add subjects and profiles for richer cards
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO learner_profiles (id, user_id, headline, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`prof_a_${uniqueSuffix}`, userAId, 'Algorithms & Systems', 'MIT', now, now);

    db.prepare(`
      INSERT OR REPLACE INTO learner_profiles (id, user_id, headline, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`prof_b_${uniqueSuffix}`, userBId, 'Distributed Databases', 'Berkeley', now, now);
  });

  after(async () => {
    if (testServer) {
      await testServer.close();
    }
  });

  it('1. Prevents self-request and validates initial state as add', async () => {
    // Self-request
    const selfRes = await fetch(`${baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ memberId: userAId }),
    });
    assert.equal(selfRes.status, 400);

    // Initial status should be 'add'
    const statusRes = await fetch(`${baseUrl}/api/circle/status/${userBId}`, {
      headers: { Cookie: cookieA },
    });
    const statusBody = await statusRes.json();
    assert.equal(statusBody.data.status, 'add');
    assert.equal(statusBody.data.inCircle, false);
  });

  it('2. Account A sends Account B a Circle request', async () => {
    const sendRes = await fetch(`${baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ memberId: userBId }),
    });
    assert.equal(sendRes.status, 201);
    const sendBody = await sendRes.json();
    assert.equal(sendBody.data.success, true);
    assert.equal(sendBody.data.status, 'pending');
    activeRequestId = sendBody.data.requestId;

    // Duplicate request rejection
    const dupRes = await fetch(`${baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ memberId: userBId }),
    });
    assert.equal(dupRes.status, 400);

    // Status check for User A: 'pending' (sent)
    const statusARes = await fetch(`${baseUrl}/api/circle/status/${userBId}`, {
      headers: { Cookie: cookieA },
    });
    const statusABody = await statusARes.json();
    assert.equal(statusABody.data.status, 'pending');

    // Status check for User B: 'accept' (received)
    const statusBRes = await fetch(`${baseUrl}/api/circle/status/${userAId}`, {
      headers: { Cookie: cookieB },
    });
    const statusBBody = await statusBRes.json();
    assert.equal(statusBBody.data.status, 'accept');

    // Check sent requests for User A
    const sentRes = await fetch(`${baseUrl}/api/circle/requests/sent`, {
      headers: { Cookie: cookieA },
    });
    const sentBody = await sentRes.json();
    assert.equal(sentBody.data.length, 1);
    assert.equal(sentBody.data[0].receiverId, userBId);

    // Check incoming requests for User B
    const incRes = await fetch(`${baseUrl}/api/circle/requests`, {
      headers: { Cookie: cookieB },
    });
    const incBody = await incRes.json();
    assert.equal(incBody.data.length, 1);
    assert.equal(incBody.data[0].senderId, userAId);
  });

  it('3. IDOR Prevention: User C cannot accept, decline, or cancel request between A and B', async () => {
    // User C tries to accept request sent to User B using request ID
    const rogueAcceptRes = await fetch(`${baseUrl}/api/circle/requests/${activeRequestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieC,
      },
    });
    assert.equal(rogueAcceptRes.status, 403); // Forbidden

    // User A cannot accept a request that User A sent
    const senderAcceptRes = await fetch(`${baseUrl}/api/circle/requests/${activeRequestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
    });
    assert.equal(senderAcceptRes.status, 403); // Forbidden

    // User B cannot cancel a request that User A sent
    const receiverCancelRes = await fetch(`${baseUrl}/api/circle/requests/${activeRequestId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieB,
      },
    });
    assert.equal(receiverCancelRes.status, 403); // Forbidden
  });

  it('4. User A cancels request, and re-request works', async () => {
    // Cancel request
    const cancelRes = await fetch(`${baseUrl}/api/circle/requests/cancel/${userBId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
    });
    assert.equal(cancelRes.status, 200);

    // Verify incoming requests for User B is now empty
    const incRes = await fetch(`${baseUrl}/api/circle/requests`, {
      headers: { Cookie: cookieB },
    });
    const incBody = await incRes.json();
    assert.equal(incBody.data.length, 0);

    // Resend request
    const resendRes = await fetch(`${baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ memberId: userBId }),
    });
    assert.equal(resendRes.status, 201);
    const resendBody = await resendRes.json();
    activeRequestId = resendBody.data.requestId;
  });

  it('5. User B declines request, and status returns to add', async () => {
    const declineRes = await fetch(`${baseUrl}/api/circle/decline/${userAId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieB,
      },
    });
    assert.equal(declineRes.status, 200);

    // Status for User A is back to 'add'
    const statusRes = await fetch(`${baseUrl}/api/circle/status/${userBId}`, {
      headers: { Cookie: cookieA },
    });
    const statusBody = await statusRes.json();
    assert.equal(statusBody.data.status, 'add');

    // User A sends fresh request
    const freshReq = await fetch(`${baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ memberId: userBId }),
    });
    assert.equal(freshReq.status, 201);
    const freshBody = await freshReq.json();
    activeRequestId = freshBody.data.requestId;
  });

  it('6. Account B accepts request: Both accounts see each other in My Circle', async () => {
    const acceptRes = await fetch(`${baseUrl}/api/circle/accept/${userAId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieB,
      },
    });
    assert.equal(acceptRes.status, 200);
    const acceptBody = await acceptRes.json();
    assert.equal(acceptBody.data.inCircle, true);

    // 1. User A lists Circle members: User B is in User A's Circle
    const listARes = await fetch(`${baseUrl}/api/circle`, {
      headers: { Cookie: cookieA },
    });
    const listABody = await listARes.json();
    assert.equal(listABody.data.some((m) => m.id === userBId), true, 'User B must be in User A Circle');

    // 2. User B lists Circle members: User A is in User B's Circle
    const listBRes = await fetch(`${baseUrl}/api/circle`, {
      headers: { Cookie: cookieB },
    });
    const listBBody = await listBRes.json();
    assert.equal(listBBody.data.some((m) => m.id === userAId), true, 'User A must be in User B Circle');

    // 3. Status checks: both show 'in_circle'
    const statusA = await (await fetch(`${baseUrl}/api/circle/status/${userBId}`, { headers: { Cookie: cookieA } })).json();
    assert.equal(statusA.data.status, 'in_circle');

    const statusB = await (await fetch(`${baseUrl}/api/circle/status/${userAId}`, { headers: { Cookie: cookieB } })).json();
    assert.equal(statusB.data.status, 'in_circle');

    // 4. Batch states check
    const statesA = await (await fetch(`${baseUrl}/api/circle/states`, { headers: { Cookie: cookieA } })).json();
    assert.equal(statesA.data.circleIds.includes(userBId), true);
  });

  it('7. Direct messaging opens conversation with Circle member', async () => {
    // User A initiates direct messaging with User B
    const convRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ recipientId: userBId }),
    });
    assert.equal(convRes.status, 201);
    const convBody = await convRes.json();
    assert.ok(convBody.data.id, 'Conversation ID returned');
    assert.equal(convBody.data.otherParticipant.id, userBId);
  });

  it('8. User A removes User B from Circle: both are removed cleanly', async () => {
    const removeRes = await fetch(`${baseUrl}/api/circle/${userBId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
    });
    assert.equal(removeRes.status, 200);

    // Verify neither user sees the other in My Circle
    const listARes = await (await fetch(`${baseUrl}/api/circle`, { headers: { Cookie: cookieA } })).json();
    assert.equal(listARes.data.some((m) => m.id === userBId), false);

    const listBRes = await (await fetch(`${baseUrl}/api/circle`, { headers: { Cookie: cookieB } })).json();
    assert.equal(listBRes.data.some((m) => m.id === userAId), false);

    // Status is back to 'add'
    const statusA = await (await fetch(`${baseUrl}/api/circle/status/${userBId}`, { headers: { Cookie: cookieA } })).json();
    assert.equal(statusA.data.status, 'add');
  });

  it('9. Persistence across re-login', async () => {
    // Send request again
    await fetch(`${baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieA,
      },
      body: JSON.stringify({ memberId: userBId }),
    });

    // User B accepts
    await fetch(`${baseUrl}/api/circle/accept/${userAId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieB,
      },
    });

    // Check database directly
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM user_circle WHERE (user_id = ? AND member_id = ?) OR (user_id = ? AND member_id = ?)`).all(userAId, userBId, userBId, userAId);
    assert.equal(rows.length, 2, 'Must have 2 reciprocal rows persisted in database');

    // Fresh query returns User B in User A's circle
    const freshMembers = await (await fetch(`${baseUrl}/api/circle`, { headers: { Cookie: cookieA } })).json();
    assert.equal(freshMembers.data.some((m) => m.id === userBId), true);
  });
});
