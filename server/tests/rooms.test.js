import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Rooms API Endpoints', () => {
  let testApp;
  let creatorToken;
  let joinerToken;
  let bystanderToken;
  let creatorUserId;
  let joinerUserId;

  before(async () => {
    testApp = await startTestServer();

    // 1. Sign in as Darvin (seeded user)
    const darvinLogin = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'darvin@demo.studysync.ai',
        password: 'Password123!',
      }),
    });
    const darvinBody = await darvinLogin.json();
    creatorToken = darvinBody.data.token;
    creatorUserId = darvinBody.data.user.id;

    // 2. Register a dedicated joiner account
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const joinerRegister = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Joiner Student',
        email: `joiner.${uniqueSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const joinerBody = await joinerRegister.json();
    joinerToken = joinerBody.data.token;
    joinerUserId = joinerBody.data.user.id;

    // 3. Register a bystander account
    const bystanderRegister = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bystander Student',
        email: `bystander.${uniqueSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bystanderBody = await bystanderRegister.json();
    bystanderToken = bystanderBody.data.token;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // ==========================================================================
  // 1. Existing baseline tests (preserved)
  // ==========================================================================
  test('GET /api/rooms returns development room listings with member count', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);

    const room = body.data.find((r) => r.id === 'room-dbms-norm');
    assert.ok(room);
    assert.equal(room.room_name, 'DBMS — Normalisation');
    assert.equal(room.creator_name, 'Arun');
    assert.ok(room.member_count >= 1);
    assert.ok(Array.isArray(room.preferred_languages));
  });

  test('GET /api/rooms?difficulty=Advanced filters rooms properly', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms?difficulty=Advanced`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    body.data.forEach((r) => {
      assert.equal(r.difficulty.toLowerCase(), 'advanced');
    });
  });

  test('GET /api/rooms/:id returns complete room details, roster, messages and questions', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);

    const room = body.data;
    assert.equal(room.id, 'room-dbms-norm');
    assert.ok(Array.isArray(room.members));
    assert.ok(room.members.length >= 3);
    assert.ok(Array.isArray(room.messages));
    assert.ok(room.messages.length >= 2);
    assert.ok(Array.isArray(room.questions));
    assert.ok(room.questions.length >= 1);

    // Verify structured question and responses
    const question = room.questions[0];
    assert.ok(question.question_content);
    assert.ok(Array.isArray(question.responses));
    assert.ok(question.responses.length >= 1);
  });

  test('GET /api/rooms/:id returns 404 for non-existent room', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/room-does-not-exist`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  // ==========================================================================
  // 2. Room Listing: Search, Filters, Pagination, Invalid Filters
  // ==========================================================================
  test('GET /api/rooms?search=Normalisation searches topic and name', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms?search=Normalisation`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
    const found = body.data.some((r) => r.id === 'room-dbms-norm');
    assert.ok(found);
  });

  test('GET /api/rooms with pagination returns total and page metadata', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms?page=1&limit=2`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.ok(body.meta.total >= 2);
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 2);
    assert.ok(body.meta.totalPages >= 1);
  });

  test('GET /api/rooms with language and subject filters', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms?subject=Database+Systems&language=Tamil`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
    assert.equal(body.data[0].id, 'room-dbms-norm');
  });

  test('GET /api/rooms with invalid filter parameters returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms?difficulty=SuperHard`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length > 0);
  });

  // ==========================================================================
  // 3. Room Recommendations
  // ==========================================================================
  test('GET /api/rooms/recommendations returns deterministically ranked rooms', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/recommendations?limit=3`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length <= 3);
  });

  // ==========================================================================
  // 4. Room Creation & Authorization
  // ==========================================================================
  let createdRoomId;

  test('POST /api/rooms creates room with server-derived creator identity and auto-membership', async () => {
    const payload = {
      room_name: 'Distributed Consensus & Raft Protocol',
      subject: 'Distributed Systems',
      topic: 'Raft Leader Election & Log Replication',
      description: 'Study room for designing fault-tolerant consensus systems.',
      room_type: 'Learn Together',
      difficulty: 'Advanced',
      preferred_languages: ['English'],
      max_capacity: 6,
    };

    const res = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);

    const room = body.data;
    assert.ok(room.id);
    createdRoomId = room.id;
    assert.equal(room.room_name, payload.room_name);
    assert.equal(room.creator_id, creatorUserId); // Must come from server session, not client
    assert.equal(room.memberCount, 1);
    assert.equal(room.is_member, true);

    // Verify creator is listed in the members roster
    const creatorMember = room.members.find((m) => m.user_id === creatorUserId);
    assert.ok(creatorMember);
    assert.equal(creatorMember.membership_role, 'creator');
  });

  test('POST /api/rooms rejects unauthenticated creation with 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_name: 'Unauthed Room Attempt',
        subject: 'Networking',
        topic: 'Routing',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  });

  test('POST /api/rooms rejects invalid input with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        room_name: 'X', // Too short
        subject: '',
        topic: '',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length >= 3);
  });

  // ==========================================================================
  // 5. Room Updates & Permission Boundaries
  // ==========================================================================
  test('PUT /api/rooms/:id allows room creator to update permitted fields', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        description: 'Updated focus: Log compaction and snapshot transfers.',
        max_capacity: 8,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.description, 'Updated focus: Log compaction and snapshot transfers.');
    assert.equal(body.data.max_capacity, 8);
  });

  test('PUT /api/rooms/:id rejects unauthorized updates with 403 FORBIDDEN', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bystanderToken}`, // Not the creator
      },
      body: JSON.stringify({
        room_name: 'Hacked Room Name',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // ==========================================================================
  // 6. Room Memberships: Join, Leave, Capacity, Duplicate Prevention
  // ==========================================================================
  test('POST /api/rooms/:id/join allows authenticated learner to join and updates member count', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${joinerToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.isMember, true);
    assert.equal(body.data.memberCount, 2);

    // Verify membership persisted in GET /api/rooms/:id
    const verifyRes = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}`, {
      headers: { Authorization: `Bearer ${joinerToken}` },
    });
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.data.is_member, true);
    assert.equal(verifyBody.data.memberCount, 2);
  });

  test('POST /api/rooms/:id/join rejects duplicate membership with 409 DUPLICATE_MEMBERSHIP', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${joinerToken}` }, // Already joined
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'DUPLICATE_MEMBERSHIP');
  });

  test('POST /api/rooms/:id/join enforces capacity limits when room is full', async () => {
    // 1. Create a tiny room with max_capacity = 2
    const tinyRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        room_name: 'Pair Programming Focus 1-on-1',
        subject: 'Algorithms',
        topic: 'Graph DP',
        max_capacity: 2, // Creator counts as 1
      }),
    });
    const tinyRoom = (await tinyRes.json()).data;

    // 2. Joiner fills the 2nd slot
    const fillRes = await fetch(`${testApp.baseUrl}/api/rooms/${tinyRoom.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${joinerToken}` },
    });
    assert.equal(fillRes.status, 200);

    // 3. Bystander tries to join full room
    const overfillRes = await fetch(`${testApp.baseUrl}/api/rooms/${tinyRoom.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bystanderToken}` },
    });
    assert.equal(overfillRes.status, 409);
    const overfillBody = await overfillRes.json();
    assert.equal(overfillBody.error.code, 'ROOM_FULL');
  });

  test('POST /api/rooms/:id/leave prevents creator from leaving while other members remain', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creatorToken}` }, // Creator attempts to leave with joiner present
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CREATOR_CANNOT_LEAVE');
  });

  test('POST /api/rooms/:id/leave allows member to leave and updates count', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${joinerToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.isMember, false);
    assert.equal(body.data.memberCount, 1);

    // Verify room detail confirms membership removed
    const verifyRes = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}`, {
      headers: { Authorization: `Bearer ${joinerToken}` },
    });
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.data.is_member, false);
    assert.equal(verifyBody.data.memberCount, 1);
  });

  test('POST /api/rooms/:id/leave rejects non-member leave attempt with 400 NOT_A_MEMBER', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bystanderToken}` }, // Never joined
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_A_MEMBER');
  });

  test('DELETE /api/rooms/:id allows room creator to archive room', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creatorToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'archived');

    // Trying to join an archived room should be rejected
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${createdRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${joinerToken}` },
    });
    assert.equal(joinRes.status, 400);
    const joinBody = await joinRes.json();
    assert.equal(joinBody.error.code, 'ROOM_NOT_JOINABLE');
  });
});
