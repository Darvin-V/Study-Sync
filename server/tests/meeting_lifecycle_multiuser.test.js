import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('StudySync Video Meeting Lifecycle & Multi-User State Synchronization Tests', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let roomId;

  before(async () => {
    testApp = await startTestServer();

    // 1. Register User A (Host & Room Creator)
    const suffixA = `${Date.now()}-userA`;
    const regResA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Host Alice',
        email: `alice.${suffixA}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regBodyA = await regResA.json();
    userAToken = regBodyA.data.token;
    userAId = regBodyA.data.user.id;

    // 2. Register User B (Peer Participant)
    const suffixB = `${Date.now()}-userB`;
    const regResB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Peer Bob',
        email: `bob.${suffixB}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regBodyB = await regResB.json();
    userBToken = regBodyB.data.token;
    userBId = regBodyB.data.user.id;

    // 3. User A creates a room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        room_name: 'Quantum Mechanics Lab',
        subject: 'Physics',
        topic: 'Wave-Particle Duality',
        description: 'Interactive peer review and equation derivation.',
        room_type: 'Learn Together',
        difficulty: 'Advanced',
        preferred_languages: ['English'],
        max_capacity: 10,
      }),
    });
    const createBody = await createRes.json();
    roomId = createBody.data.id;

    // 4. User B joins the room as a member
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });
    assert.strictEqual(joinRes.status, 200);
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  test('1. Before meeting: Room reports inactive meeting state for all users', async () => {
    const resA = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const bodyA = await resA.json();
    assert.strictEqual(bodyA.data.meeting_active, false);
    assert.strictEqual(bodyA.data.has_active_meeting, false);
    assert.strictEqual(bodyA.data.meeting_url, null);
    assert.strictEqual(bodyA.data.meeting_participant_count, 0);
    assert.strictEqual(bodyA.data.is_user_in_meeting, false);
    assert.strictEqual(bodyA.data.is_meeting_host, false);
    assert.strictEqual(bodyA.data.can_end_meeting, false);

    // Joining before meeting has started fails with clear code
    const prematureJoin = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(prematureJoin.status, 400);
    const prematureBody = await prematureJoin.json();
    assert.strictEqual(prematureBody.error.code, 'NO_ACTIVE_MEETING');
  });

  test('2. Start meeting: Host initiates call, registers as participant, and sets meeting_active = true', async () => {
    const meetingUrl = 'https://meet.jit.si/studysync-quantum-lab-9922';
    const startRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        meeting_provider: 'jitsi',
      }),
    });

    assert.strictEqual(startRes.status, 200);
    const startBody = await startRes.json();
    assert.strictEqual(startBody.success, true);
    assert.strictEqual(startBody.data.meeting_active, true);
    assert.strictEqual(startBody.data.meeting_host_id, userAId);
    assert.strictEqual(startBody.data.is_user_in_meeting, true);
    assert.strictEqual(startBody.data.is_meeting_host, true);
    assert.strictEqual(startBody.data.can_end_meeting, true);
    assert.strictEqual(startBody.data.meeting_participant_count, 1);
  });

  test('3. Peer joins meeting: Both users see updated participant count, peer is marked in meeting', async () => {
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(joinRes.status, 200);
    const joinBody = await joinRes.json();
    assert.strictEqual(joinBody.success, true);
    assert.strictEqual(joinBody.data.is_user_in_meeting, true);
    // User B is a participant and CANNOT end meeting
    assert.strictEqual(joinBody.data.is_meeting_host, false);
    assert.strictEqual(joinBody.data.can_end_meeting, false);
    assert.strictEqual(joinBody.data.meeting_participant_count, 2);

    // Verify User A also sees 2 participants and remains verified host
    const checkA = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkABody = await checkA.json();
    assert.strictEqual(checkABody.data.meeting_active, true);
    assert.strictEqual(checkABody.data.meeting_participant_count, 2);
    assert.strictEqual(checkABody.data.is_meeting_host, true);
    assert.strictEqual(checkABody.data.can_end_meeting, true);
  });

  test('4. Participant leaves meeting: Meeting remains active for others and participant count decrements', async () => {
    // User B leaves call
    const leaveRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(leaveRes.status, 200);
    const leaveBody = await leaveRes.json();
    assert.strictEqual(leaveBody.success, true);
    assert.strictEqual(leaveBody.data.is_user_in_meeting, false);
    // CRITICAL: Meeting MUST still be active for remaining peers
    assert.strictEqual(leaveBody.data.meeting_active, true);
    assert.strictEqual(leaveBody.data.meeting_participant_count, 1);
    assert.strictEqual(leaveBody.data.is_meeting_host, false);
    assert.strictEqual(leaveBody.data.can_end_meeting, false);

    // Host User A is still active in meeting
    const checkHost = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkHostBody = await checkHost.json();
    assert.strictEqual(checkHostBody.data.meeting_active, true);
    assert.strictEqual(checkHostBody.data.is_user_in_meeting, true);
    assert.strictEqual(checkHostBody.data.is_meeting_host, true);
    assert.strictEqual(checkHostBody.data.can_end_meeting, true);
    assert.strictEqual(checkHostBody.data.meeting_participant_count, 1);
  });

  test('5. Non-host participant cannot terminate meeting for everyone', async () => {
    // User B tries to DELETE the meeting
    const endRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userBToken}`,
      },
    });

    assert.strictEqual(endRes.status, 403);
    const endBody = await endRes.json();
    assert.strictEqual(endBody.success, false);
    assert.strictEqual(endBody.error.code, 'FORBIDDEN');
    assert.match(endBody.error.message, /host/i);

    // Verify meeting is STILL active
    const checkRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkBody = await checkRes.json();
    assert.strictEqual(checkBody.data.meeting_active, true);
  });

  test('6. Rejoining: User B rejoins without duplicate records or errors', async () => {
    const rejoinRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(rejoinRes.status, 200);
    const rejoinBody = await rejoinRes.json();
    assert.strictEqual(rejoinBody.success, true);
    assert.strictEqual(rejoinBody.data.is_user_in_meeting, true);
    assert.strictEqual(rejoinBody.data.meeting_participant_count, 2);
  });

  test('7. Authorized End Call: Host terminates meeting for everyone and clears state', async () => {
    const endRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    });

    assert.strictEqual(endRes.status, 200);
    const endBody = await endRes.json();
    assert.strictEqual(endBody.success, true);
    assert.strictEqual(endBody.data.meeting_active, false);
    assert.strictEqual(endBody.data.has_active_meeting, false);
    assert.strictEqual(endBody.data.meeting_participant_count, 0);

    // Refresh check for both Host and Participant
    const refreshA = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const bodyA = await refreshA.json();
    assert.strictEqual(bodyA.data.meeting_active, false);
    assert.strictEqual(bodyA.data.is_user_in_meeting, false);
    assert.strictEqual(bodyA.data.can_end_meeting, false);

    const refreshB = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const bodyB = await refreshB.json();
    assert.strictEqual(bodyB.data.meeting_active, false);
    assert.strictEqual(bodyB.data.is_user_in_meeting, false);
    assert.strictEqual(bodyB.data.is_meeting_host, false);
    assert.strictEqual(bodyB.data.can_end_meeting, false);
  });

  test('8. Prevents joining an ended meeting unless a new meeting is started', async () => {
    // Participant User B attempts to join ended meeting
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(joinRes.status, 400);
    const joinBody = await joinRes.json();
    assert.strictEqual(joinBody.success, false);
    assert.strictEqual(joinBody.error.code, 'NO_ACTIVE_MEETING');
  });

  test('9. Host leaving keeps meeting active for peers; host can rejoin and end for everyone', async () => {
    // Host starts a new meeting
    const startRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        meeting_url: 'https://meet.jit.si/studysync-quantum-round-2',
        meeting_provider: 'jitsi',
      }),
    });
    assert.strictEqual(startRes.status, 200);

    // Participant joins
    const joinB = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(joinB.status, 200);

    // Host leaves meeting (does NOT terminate for User B)
    const hostLeave = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(hostLeave.status, 200);
    const hostLeaveBody = await hostLeave.json();
    assert.strictEqual(hostLeaveBody.data.is_user_in_meeting, false);
    assert.strictEqual(hostLeaveBody.data.meeting_active, true);
    assert.strictEqual(hostLeaveBody.data.meeting_participant_count, 1);

    // User B is still in meeting
    const checkB = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const checkBBody = await checkB.json();
    assert.strictEqual(checkBBody.data.meeting_active, true);
    assert.strictEqual(checkBBody.data.is_user_in_meeting, true);
    // User B is a participant and CANNOT end meeting
    assert.strictEqual(checkBBody.data.is_meeting_host, false);
    assert.strictEqual(checkBBody.data.can_end_meeting, false);

    // Host rejoins meeting
    const hostRejoin = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(hostRejoin.status, 200);
    const hostRejoinBody = await hostRejoin.json();
    assert.strictEqual(hostRejoinBody.data.is_user_in_meeting, true);
    assert.strictEqual(hostRejoinBody.data.is_meeting_host, true);
    assert.strictEqual(hostRejoinBody.data.can_end_meeting, true);

    // Host terminates meeting for everyone
    const endRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(endRes.status, 200);
  });

  test('10. Client-supplied host spoofing attempts are safely rejected on the backend', async () => {
    // Start meeting as User A
    await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        meeting_url: 'https://meet.jit.si/studysync-spoof-test',
        meeting_provider: 'jitsi',
      }),
    });

    // User B attempts to end meeting by injecting fake host flags
    const spoofRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting?is_host=true&is_meeting_host=true`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        isHost: true,
        is_meeting_host: true,
        can_end_meeting: true,
      }),
    });

    assert.strictEqual(spoofRes.status, 403);
    const spoofBody = await spoofRes.json();
    assert.strictEqual(spoofBody.success, false);
    assert.strictEqual(spoofBody.error.code, 'FORBIDDEN');

    // Clean up: Host ends meeting
    await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
  });
});
