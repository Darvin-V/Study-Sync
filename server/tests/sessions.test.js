import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Study Sessions & Individual Participation Tracking Endpoints', () => {
  let testApp;
  let creatorToken;
  let creatorUserId;
  let joinerToken;
  let joinerUserId;
  let bystanderToken;
  let bystanderUserId;

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
        displayName: 'Session Participant',
        email: `participant.${uniqueSuffix}@test.studysync.ai`,
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
        displayName: 'Bystander Learner',
        email: `bystander.${uniqueSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bystanderBody = await bystanderRegister.json();
    bystanderToken = bystanderBody.data.token;
    bystanderUserId = bystanderBody.data.user.id;
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  let createdSessionId;

  // 1. Create Session
  test('1. Authenticated user can create a study session with server-verified creator identity', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        topic: 'Distributed Consensus & Raft Protocol',
        subject: 'Distributed Systems',
        roomId: 'room-tcp-congestion',
        title: 'Raft Leader Election & Log Replication',
        description: 'Collaborative analysis of Raft state machines and term transitions.',
        plannedDuration: 50,
        startNow: true,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.equal(body.data.creator_id, creatorUserId);
    assert.equal(body.data.topic, 'Distributed Consensus & Raft Protocol');
    assert.equal(body.data.status, 'active');
    assert.equal(body.data.planned_duration, 50);

    // Creator should be automatically enrolled as an active participant
    assert.equal(body.data.participant_count, 1);
    assert.equal(body.data.participants[0].user_id, creatorUserId);
    assert.equal(body.data.participants[0].is_active, true);

    createdSessionId = body.data.id;
  });

  // 2. Reject Invalid Session Data
  test('2. Reject invalid session creation data with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        topic: '', // Invalid empty topic
        plannedDuration: -10, // Invalid duration
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length >= 2);
  });

  // 3. Join Session
  test('3. Authenticated learner can join an active session and start an attendance interval', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.participant_count, 2);

    const participant = body.data.participants.find((p) => p.user_id === joinerUserId);
    assert.ok(participant, 'Joiner should exist in participants roster');
    assert.equal(participant.is_active, true);
    assert.equal(participant.participation_status, 'active');
    assert.ok(participant.intervals.length >= 1, 'Should have an attendance interval');
  });

  // 4. Prevent Duplicate Active Participation
  test('4. Prevent duplicate active participation (returns 409 DUPLICATE_ACTIVE_PARTICIPATION)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`,
      },
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'DUPLICATE_ACTIVE_PARTICIPATION');
  });

  // 5. Leave Session
  test('5. Participant can leave session, closing their attendance interval', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const participant = body.data.participants.find((p) => p.user_id === joinerUserId);
    assert.equal(participant.is_active, false);
    assert.equal(participant.participation_status, 'left');
    assert.ok(participant.left_at, 'Should have recorded left_at timestamp');
    assert.ok(participant.intervals[0].left_at, 'Interval should be closed');
  });

  // 6. Leaving when not actively participating returns 400 NOT_A_PARTICIPANT
  test('6. Leaving when not actively attending returns 400 NOT_A_PARTICIPANT', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`,
      },
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_A_PARTICIPANT');
  });

  // 7. Rejoin and Preserve Historical Attendance
  test('7. Rejoining starts a new attendance interval and preserves prior attendance', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const participant = body.data.participants.find((p) => p.user_id === joinerUserId);
    assert.equal(participant.is_active, true);
    assert.equal(participant.participation_status, 'active');
    // Participant should now have 2 discrete intervals (the closed first interval, and the new active interval)
    assert.equal(participant.intervals.length, 2);
    assert.ok(participant.intervals[0].left_at, 'First interval remains preserved and closed');
    assert.equal(participant.intervals[1].left_at, null, 'Second interval is open and active');
  });

  // 8. Distinguish Attendance Time from Self-Reported Focused Study Time
  test('8. Distinguish server-calculated attendance duration from self-reported study time', async () => {
    // Participant submits self-reported focus time
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/focus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`,
      },
      body: JSON.stringify({
        focusMinutes: 18,
        status: 'Focused',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const participant = body.data.participants.find((p) => p.user_id === joinerUserId);
    assert.equal(participant.recorded_study_minutes, 18);
    // Attendance minutes is derived from server intervals, which is distinct from recorded focus
    assert.notEqual(participant.recorded_study_minutes, undefined);
    assert.notEqual(participant.attendance_minutes, undefined);
  });

  // 9. Unauthorized User Cannot Modify Another Participant's Focus
  test('9. Prevent cross-user attendance modification (unauthenticated or non-participant)', async () => {
    // Bystander attempts to submit focus time for joiner's session without participating
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/focus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bystanderToken}`,
      },
      body: JSON.stringify({
        focusMinutes: 99,
      }),
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_A_PARTICIPANT');
  });

  // 10. Start Session Authorization
  test('10. Scheduled session can only be started by authorized creator', async () => {
    // Create a scheduled session
    const createRes = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        topic: 'Compiler Design — LR Parsing Tables',
        subject: 'Compiler Construction',
        plannedDuration: 60,
        startNow: false, // Scheduled
      }),
    });
    const created = await createRes.json();
    const scheduledId = created.data.id;
    assert.equal(created.data.status, 'scheduled');

    // Bystander tries to start it -> 403 Forbidden
    const unauthStart = await fetch(`${testApp.baseUrl}/api/sessions/${scheduledId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bystanderToken}`,
      },
    });
    assert.equal(unauthStart.status, 403);
    const unauthBody = await unauthStart.json();
    assert.equal(unauthBody.error.code, 'FORBIDDEN');

    // Creator starts it -> 200 OK
    const authStart = await fetch(`${testApp.baseUrl}/api/sessions/${scheduledId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
    });
    assert.equal(authStart.status, 200);
    const startBody = await authStart.json();
    assert.equal(startBody.data.status, 'active');
    assert.ok(startBody.data.actual_start_at);
  });

  // 11. End Session Authorization
  test('11. Only session creator is authorized to end the study session (403 for non-creator)', async () => {
    const unauthEnd = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joinerToken}`, // Joiner is not creator
      },
    });

    assert.equal(unauthEnd.status, 403);
    const body = await unauthEnd.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  // 12. End Session Concludes All Intervals and Returns Summary
  test('12. Authorized creator can end session, finalizing all participant intervals', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'completed');
    assert.ok(body.data.end_at);
    assert.equal(body.data.participant_count, 2);

    // Each participant should have a separate attendance breakdown
    assert.ok(Array.isArray(body.data.participants));
    assert.equal(body.data.participants.length, 2);
    for (const p of body.data.participants) {
      assert.ok(p.user_id);
      assert.ok(p.display_name);
      assert.equal(p.status, 'completed');
      assert.notEqual(p.attendance_seconds, undefined);
    }
  });

  // 13. Repeated End Requests Handled Safely (Idempotent)
  test('13. Repeated end requests are handled safely and return completed summary', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'completed');
  });

  // 14. Prevent Joining a Completed Session
  test('14. Prevent joining a completed session (returns 400 SESSION_COMPLETED)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bystanderToken}`,
      },
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'SESSION_COMPLETED');
  });

  // 15. Server-Authoritative Timer Recovery
  test('15. Session details provide server-authoritative timer values that survive refresh', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}`, {
      headers: {
        Authorization: `Bearer ${creatorToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.secondsElapsed >= 0);
    assert.equal(body.data.timeTotalSeconds, 50 * 60);
    assert.equal(body.data.status, 'completed');
  });

  // 16. Post-Session Feedback Submission
  test('16. Participants can submit post-session feedback and reflection', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        rating: 'Very helpful',
        reflection: 'Understood Raft term election invariants and split-vote handling.',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.rating, 'Very helpful');
    assert.equal(body.data.reflection, 'Understood Raft term election invariants and split-vote handling.');
  });

  // 17. Retrieve Session Summary
  test('17. Retrieve completed session summary via GET /api/sessions/:id/summary', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/${createdSessionId}/summary`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.topic, 'Distributed Consensus & Raft Protocol');
    assert.equal(body.data.status, 'completed');
    assert.equal(body.data.participant_count, 2);
    assert.ok(body.data.feedback.length >= 1);
  });

  // 18. Retrieve User Session History
  test('18. Retrieve authenticated user session history via GET /api/sessions/history', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions/history`, {
      headers: {
        Authorization: `Bearer ${creatorToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    const found = body.data.find((s) => s.id === createdSessionId);
    assert.ok(found, 'Created session should appear in user history');
  });

  // 19. Room Integration: List Sessions for Accessible Room
  test('19. Room integration: List sessions for accessible room via GET /api/rooms/:id/sessions', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/room-tcp-congestion/sessions`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    const found = body.data.find((s) => s.id === createdSessionId);
    assert.ok(found, 'Session should be accessible via room sessions endpoint');
  });

  // 20. List Sessions with Filtering
  test('20. List sessions with status and topic filter via GET /api/sessions', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/sessions?status=completed&topic=Raft`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
    assert.equal(body.data[0].status, 'completed');
  });
});
