import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import { UserSessionModel } from '../models/userSession.model.js';
import { _resetRateLimits } from '../middleware/authMiddleware.js';

describe('Room Code & Invite Feature Tests', () => {
  let testApp;
  let arunToken; // Creator of room-dbms-norm
  let arunUserId;
  let mayaToken; // Second learner
  let mayaUserId;
  let priyaToken; // Third learner
  let priyaUserId;
  let darvinToken; // Fourth learner
  let darvinUserId;

  before(async () => {
    testApp = await startTestServer();
    _resetRateLimits();

    // Sign in as Arun (creator of room-dbms-norm)
    const arunRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arun@demo.studysync.ai', password: 'Password123!' }),
    });
    const arunData = await arunRes.json();
    arunToken = arunData.data.token;
    arunUserId = arunData.data.user.id;

    // Sign in as Maya (creator of room-dp-lcs)
    const mayaRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@demo.studysync.ai', password: 'Password123!' }),
    });
    const mayaData = await mayaRes.json();
    mayaToken = mayaData.data.token;
    mayaUserId = mayaData.data.user.id;

    // Sign in as Priya
    const priyaRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@demo.studysync.ai', password: 'Password123!' }),
    });
    const priyaData = await priyaRes.json();
    priyaToken = priyaData.data.token;
    priyaUserId = priyaData.data.user.id;

    // Sign in as Darvin
    const darvinRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'darvin@demo.studysync.ai', password: 'Password123!' }),
    });
    const darvinData = await darvinRes.json();
    darvinToken = darvinData.data.token;
    darvinUserId = darvinData.data.user.id;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // ============================================================================
  // 1. Unique Code Generation and Persistence
  // ============================================================================
  test('1.1 Every study room has a human-readable room code and code join flag', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm`, {
      headers: { Authorization: `Bearer ${arunToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.room_code, 'DBMS-4X9M');
    assert.equal(body.data.code_join_enabled, true);
  });

  test('1.2 Creating a new study room automatically generates a unique human-readable room code', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arunToken}`,
      },
      body: JSON.stringify({
        room_name: 'Biology 101 — Cell Mitosis',
        subject: 'Biology',
        topic: 'Cell Mitosis & Meiosis Stages',
        description: 'Collaborative peer revision for upcoming biology midterms.',
        room_type: 'Learn Together',
        difficulty: 'Intermediate',
        preferred_languages: ['English'],
        max_capacity: 4,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.room_code, 'Must generate room code');
    assert.match(body.data.room_code, /^[A-Z0-9]{2,5}-[A-Z0-9]{4}$/, 'Format must be human-readable PREFIX-SUFFIX');
    assert.ok(body.data.room_code.startsWith('BIO-'), 'Prefix should match subject keyword BIO');
    assert.equal(body.data.code_join_enabled, true);

    // Verify persistence in SQLite
    const db = getDb();
    const stored = db.prepare('SELECT room_code, code_join_enabled FROM rooms WHERE id = ?').get(body.data.id);
    assert.equal(stored.room_code, body.data.room_code);
    assert.equal(stored.code_join_enabled, 1);
  });

  test('1.3 Database uniqueness constraint strictly prevents duplicate room codes', async () => {
    const db = getDb();
    const existing = db.prepare('SELECT room_code FROM rooms WHERE room_code IS NOT NULL LIMIT 1').get();
    assert.ok(existing);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO rooms (
          id, room_name, subject, topic, room_type, difficulty,
          creator_id, max_capacity, status, room_code, code_join_enabled, created_at, updated_at
        ) VALUES ('room-dup-test', 'Duplicate Room', 'Test', 'Test', 'Learn Together', 'Intermediate', 'arun-01', 4, 'active', ?, 1, datetime('now'), datetime('now'))
      `).run(existing.room_code);
    }, /UNIQUE constraint failed/i);
  });

  // ============================================================================
  // 2. Joining with a Valid Code from a Second Account
  // ============================================================================
  test('2.1 Second learner joins room using exact uppercase code', async () => {
    // Maya creates a new private biology room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({
        room_name: 'Genetics Lab — CRISPR Discussion',
        subject: 'Biology',
        topic: 'CRISPR Gene Editing Protocols',
        max_capacity: 6,
      }),
    });
    const created = await createRes.json();
    const newRoomCode = created.data.room_code;
    const newRoomId = created.data.id;

    // Priya joins using newRoomCode
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`,
      },
      body: JSON.stringify({ code: newRoomCode }),
    });

    assert.equal(joinRes.status, 200);
    const joinBody = await joinRes.json();
    assert.equal(joinBody.success, true);
    assert.equal(joinBody.data.joined, true);
    assert.equal(joinBody.data.room.id, newRoomId);
    assert.equal(joinBody.data.room.is_member, true);

    // Verify Priya is in room roster
    const memberFound = joinBody.data.room.members.some((m) => m.user_id === priyaUserId);
    assert.equal(memberFound, true, 'Joined user must appear in room roster');
  });

  test('2.2 Case-insensitivity: joining with lowercase code succeeds', async () => {
    // Darvin creates a new room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${darvinToken}`,
      },
      body: JSON.stringify({
        room_name: 'Calculus III — Vector Fields',
        subject: 'Mathematics',
        topic: 'Green Theorem and Curl',
        max_capacity: 6,
      }),
    });
    const created = await createRes.json();
    const code = created.data.room_code;

    // Maya joins using lowercase code
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: code.toLowerCase() }),
    });

    assert.equal(joinRes.status, 200);
    const joinBody = await joinRes.json();
    assert.equal(joinBody.success, true);
    assert.equal(joinBody.data.joined, true);
    assert.equal(joinBody.data.room.id, created.data.id);
  });

  test('2.3 Trimming: ignores accidental leading, trailing, and mixed whitespace', async () => {
    // Arun creates a room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arunToken}`,
      },
      body: JSON.stringify({
        room_name: 'Database Storage Engines',
        subject: 'Database Systems',
        topic: 'B-Trees vs LSM Trees',
        max_capacity: 5,
      }),
    });
    const created = await createRes.json();
    const code = created.data.room_code;

    // Priya joins with spaces around code
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`,
      },
      body: JSON.stringify({ code: `   ${code.toLowerCase()}   ` }),
    });

    assert.equal(joinRes.status, 200);
    const joinBody = await joinRes.json();
    assert.equal(joinBody.success, true);
    assert.equal(joinBody.data.joined, true);
  });

  // ============================================================================
  // 3. Invalid Codes, Duplicate Codes, and Unauthorized Access
  // ============================================================================
  test('3.1 Unauthenticated request to /api/rooms/join-by-code is rejected with 401', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DBMS-4X9M' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  });

  test('3.2 Unverified user account cannot join rooms with code (403 EMAIL_NOT_VERIFIED)', async () => {
    const db = getDb();
    const unverifiedId = `unver-${Date.now()}`;
    const now = new Date().toISOString();

    // Create unverified student in database
    db.prepare(`
      INSERT INTO users (id, display_name, email, preferred_languages, is_verified, created_at, updated_at)
      VALUES (?, 'Unverified Learner', ?, '["English"]', 0, ?, ?)
    `).run(unverifiedId, `${unverifiedId}@test.ai`, now, now);

    // Create session token for unverified student via UserSessionModel
    const session = UserSessionModel.create(unverifiedId);

    const res = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ code: 'DBMS-4X9M' }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
  });

  test('3.3 Non-existent room code returns 404 INVALID_ROOM_CODE without exposing details', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: 'NONEXIST-9999' }),
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_ROOM_CODE');
    assert.match(body.error.message, /No study room found matching code/);
    assert.equal(body.data, undefined, 'Must not return room payload');
  });

  test('3.4 Blank or missing code returns 400 with helpful error message', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: '   ' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_ROOM_CODE');
  });

  test('3.5 Idempotency: Joining a room user is already in safely returns 200 with alreadyMember: true', async () => {
    // Maya is already a creator/member of room-dp-lcs (ALGO-8K2P)
    const res = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: 'ALGO-8K2P' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.alreadyMember, true);
    assert.equal(body.data.joined, false);
    assert.equal(body.data.room.id, 'room-dp-lcs');
  });

  // ============================================================================
  // 4. Capacity and Room Restrictions
  // ============================================================================
  test('4.1 Full room rejects join-by-code with HTTP 409 ROOM_FULL', async () => {
    // Darvin creates a room with capacity of 2 (Darvin is member 1)
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${darvinToken}`,
      },
      body: JSON.stringify({
        room_name: 'Pair Focus Room — Proofs',
        subject: 'Mathematics',
        topic: 'Gödel Incompleteness Proofs',
        max_capacity: 2,
      }),
    });
    const created = await createRes.json();
    assert.equal(createRes.status, 201);
    const pairCode = created.data.room_code;

    // Maya joins as member 2 (room is now at full capacity 2/2)
    const mayaJoinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: pairCode }),
    });
    assert.equal(mayaJoinRes.status, 200);

    // Priya tries to join the full room -> gets 409 ROOM_FULL
    const priyaJoinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`,
      },
      body: JSON.stringify({ code: pairCode }),
    });

    assert.equal(priyaJoinRes.status, 409);
    const body = await priyaJoinRes.json();
    assert.equal(body.error.code, 'ROOM_FULL');
    assert.match(body.error.message, /maximum capacity of 2 members/);
  });

  test('4.2 Host disabling code-based joining blocks join-by-code with 403 ROOM_RESTRICTED', async () => {
    // Arun creates a room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arunToken}`,
      },
      body: JSON.stringify({
        room_name: 'Restricted Seminar Room',
        subject: 'Computer Science',
        topic: 'Compilers — Lexical Analysis',
        max_capacity: 5,
      }),
    });
    const created = await createRes.json();
    const roomId = created.data.id;
    const roomCode = created.data.room_code;

    // Arun disables code joining
    const toggleRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/code/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arunToken}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(toggleRes.status, 200);
    const toggleBody = await toggleRes.json();
    assert.equal(toggleBody.data.code_join_enabled, false);

    // Maya tries to join with code
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: roomCode }),
    });
    assert.equal(joinRes.status, 403);
    const joinBody = await joinRes.json();
    assert.equal(joinBody.error.code, 'ROOM_RESTRICTED');
    assert.match(joinBody.error.message, /Code-based joining has been disabled/);

    // Host re-enables code joining
    await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/code/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arunToken}`,
      },
      body: JSON.stringify({ enabled: true }),
    });

    // Maya joins successfully now
    const retryRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: roomCode }),
    });
    assert.equal(retryRes.status, 200);
  });

  test('4.3 Archived room returns 410 EXPIRED_INVITATION', async () => {
    // Darvin creates a room then archives it
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${darvinToken}`,
      },
      body: JSON.stringify({
        room_name: 'Temporary Lab Session',
        subject: 'Physics',
        topic: 'Optics and Diffraction',
        max_capacity: 5,
      }),
    });
    const created = await createRes.json();
    const roomId = created.data.id;
    const roomCode = created.data.room_code;

    // Archive room
    await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${darvinToken}` },
    });

    // Maya tries to join archived room by code
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({ code: roomCode }),
    });

    assert.equal(joinRes.status, 410);
    const joinBody = await joinRes.json();
    assert.equal(joinBody.error.code, 'EXPIRED_INVITATION');
  });

  // ============================================================================
  // 5. Host Code Regeneration & Permissions
  // ============================================================================
  test('5.1 Host can regenerate code, which immediately invalidates the old code', async () => {
    // Maya creates a room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
      body: JSON.stringify({
        room_name: 'Quantum Mechanics Discussion',
        subject: 'Physics',
        topic: 'Schrodinger Wave Equation',
        max_capacity: 5,
      }),
    });
    const created = await createRes.json();
    const roomId = created.data.id;
    const oldCode = created.data.room_code;

    // Maya regenerates code
    const regenRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/code/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaToken}`,
      },
    });
    assert.equal(regenRes.status, 200);
    const regenBody = await regenRes.json();
    const newCode = regenBody.data.room_code;
    assert.notEqual(newCode, oldCode, 'New code must differ from previous code');

    // Trying to join with old code fails with 404 INVALID_ROOM_CODE
    const oldJoinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`,
      },
      body: JSON.stringify({ code: oldCode }),
    });
    assert.equal(oldJoinRes.status, 404);

    // Joining with new code succeeds
    const newJoinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`,
      },
      body: JSON.stringify({ code: newCode }),
    });
    assert.equal(newJoinRes.status, 200);
  });

  test('5.2 Non-host participant is strictly forbidden from regenerating room code (403)', async () => {
    // Room created by Arun
    const res = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm/code/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`, // Priya is not creator of room-dbms-norm
      },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('5.3 Non-host participant is strictly forbidden from toggling code joining (403)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm/code/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${priyaToken}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // ============================================================================
  // 6. Rate Limiting Repeated Invalid Join Attempts
  // ============================================================================
  test('6.1 Rate-limits repeated invalid join attempts with HTTP 429 TOO_MANY_REQUESTS', async () => {
    _resetRateLimits();

    // 5 consecutive invalid code requests
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${darvinToken}`,
        },
        body: JSON.stringify({ code: `INVALID-${i}-${Date.now()}` }),
      });
      assert.equal(res.status, 404);
    }

    // 6th invalid attempt is intercepted by joinCodeRateLimiter
    const rateLimitedRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${darvinToken}`,
      },
      body: JSON.stringify({ code: 'INVALID-BLOCKED' }),
    });

    assert.equal(rateLimitedRes.status, 429);
    const body = await rateLimitedRes.json();
    assert.equal(body.error.code, 'TOO_MANY_REQUESTS');
    assert.match(body.error.message, /Too many invalid room code attempts/);

    _resetRateLimits();
  });

  // ============================================================================
  // 7. Existing Features Integrity (Creation, Messaging, Meetings, Host Controls)
  // ============================================================================
  test('7.1 Persistent chat messaging works normally for newly joined member', async () => {
    // Darvin joins Arun's room via code
    // Arun created room 'DBMS — Normalisation' (DBMS-4X9M)
    // Make sure Darvin joins or is in room
    await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${darvinToken}`,
      },
      body: JSON.stringify({ code: 'DBMS-4X9M' }),
    });

    const uniqueMsg = `Code join test verification message at ${Date.now()}`;
    const msgRes = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${darvinToken}`,
      },
      body: JSON.stringify({ message: uniqueMsg }),
    });

    assert.equal(msgRes.status, 201);
    const msgBody = await msgRes.json();
    assert.equal(msgBody.success, true);
    assert.equal(msgBody.data.message_content, uniqueMsg);
  });

  test('7.2 Virtual study meetings still function and preserve host authorization boundaries', async () => {
    // Arun starts meeting in room-dbms-norm
    const startRes = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arunToken}`,
      },
      body: JSON.stringify({ meeting_provider: 'jitsi' }),
    });
    assert.equal(startRes.status, 200);

    // Non-host Darvin tries to end meeting -> 403 Forbidden
    const nonHostEndRes = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm/meeting`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${darvinToken}` },
    });
    assert.equal(nonHostEndRes.status, 403);

    // Host Arun ends meeting -> 200 OK
    const hostEndRes = await fetch(`${testApp.baseUrl}/api/rooms/room-dbms-norm/meeting`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${arunToken}` },
    });
    assert.equal(hostEndRes.status, 200);
  });
});
