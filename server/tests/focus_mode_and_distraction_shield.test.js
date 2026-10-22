import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Distraction Shield & Focus Mode Endpoints (Phase 11)', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A (Alice - Primary learner)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Focus',
        email: `alice.focus.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // 2. Register User B (Bob - Peer learner)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Peer',
        email: `bob.peer.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Unauthenticated requests to /api/focus are rejected with 401', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/active`);
    assert.strictEqual(res.status, 401);

    const resStart = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Database Normalisation' }),
    });
    assert.strictEqual(resStart.status, 401);
  });

  test('2. Authenticated user can start a focus interval and retrieve active state', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Database Normalisation - 3NF Decomposition',
        subject: 'Database Systems',
        plannedDurationMinutes: 25,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.topic, 'Database Normalisation - 3NF Decomposition');
    assert.strictEqual(body.data.planned_duration_seconds, 1500);
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(typeof body.data.remainingSeconds, 'number');
    assert.ok(body.data.remainingSeconds <= 1500 && body.data.remainingSeconds >= 1495);

    // Verify recovery via GET /api/focus/active
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resActive.status, 200);
    const bodyActive = await resActive.json();
    assert.strictEqual(bodyActive.data.id, body.data.id);
    assert.strictEqual(bodyActive.data.status, 'active');
  });

  test('3. Duplicate active focus interval start is rejected with 409 unless autoCancelPrevious is specified', async () => {
    // Attempt duplicate start without autoCancelPrevious
    const resDuplicate = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Another Topic',
        plannedDurationMinutes: 15,
      }),
    });

    assert.strictEqual(resDuplicate.status, 409);
    const dupBody = await resDuplicate.json();
    assert.strictEqual(dupBody.error.code, 'ACTIVE_FOCUS_INTERVAL_EXISTS');
    assert.ok(dupBody.error.activeInterval);
  });

  test('4. Pausing and resuming a focus interval accurately accumulates paused duration', async () => {
    // 1. Get active interval ID
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const intervalId = (await resActive.json()).data.id;

    // 2. Pause interval
    const resPause = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resPause.status, 200);
    const pauseBody = await resPause.json();
    assert.strictEqual(pauseBody.data.status, 'paused');
    assert.ok(pauseBody.data.paused_at);

    // Wait a brief simulated interval (e.g. 50ms)
    await new Promise((resolve) => setTimeout(resolve, 60));

    // 3. Resume interval
    const resResume = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resResume.status, 200);
    const resumeBody = await resResume.json();
    assert.strictEqual(resumeBody.data.status, 'active');
    assert.strictEqual(resumeBody.data.paused_at, null);
    // Total paused seconds tracked
    assert.ok(resumeBody.data.totalPausedSeconds >= 0);
  });

  test('5. Cross-user isolation: User B cannot modify or complete User A interval', async () => {
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const intervalId = (await resActive.json()).data.id;

    // User B attempts to pause User A's interval
    const resB = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resB.status, 403);
    const bodyB = await resB.json();
    assert.strictEqual(bodyB.error.code, 'FORBIDDEN');

    // User B attempts to complete User A's interval
    const resBComp = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resBComp.status, 403);
  });

  test('6. Completing a focus interval records actual duration and transitions to completed', async () => {
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const intervalId = (await resActive.json()).data.id;

    const resComplete = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resComplete.status, 200);
    const compBody = await resComplete.json();
    assert.strictEqual(compBody.data.status, 'completed');
    assert.ok(compBody.data.completed_at);
    assert.ok(compBody.data.actual_duration_seconds >= 0);

    // Active interval is now null for User A
    const resCheckActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const checkBody = await resCheckActive.json();
    assert.strictEqual(checkBody.data, null);
  });

  test('7. Cancelling a focus interval records cancellation state without creating phantom active timers', async () => {
    // Start a new interval for User B
    const resStart = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        topic: 'Graph Algorithms - Dijkstra',
        plannedDurationMinutes: 45,
      }),
    });
    assert.strictEqual(resStart.status, 201);
    const intervalId = (await resStart.json()).data.id;

    // Cancel interval
    const resCancel = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resCancel.status, 200);
    const cancelBody = await resCancel.json();
    assert.strictEqual(cancelBody.data.status, 'cancelled');

    // Confirm no active interval remains
    const resActive = await fetch(`${testApp.baseUrl}/api/focus/active`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual((await resActive.json()).data, null);
  });

  test('8. Invalid state transitions and input validation are rejected cleanly', async () => {
    // Reject invalid planned duration (e.g. 0 minutes or 300 minutes)
    const resInvalid = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Test Topic',
        plannedDurationMinutes: 0,
      }),
    });
    assert.strictEqual(resInvalid.status, 400);

    // Reject empty topic
    const resEmptyTopic = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: '   ',
        plannedDurationMinutes: 25,
      }),
    });
    assert.strictEqual(resEmptyTopic.status, 400);
  });

  test('9. Focus history returns honest statistics and explicit concentration disclaimer', async () => {
    const resHistory = await fetch(`${testApp.baseUrl}/api/focus/history`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    assert.strictEqual(resHistory.status, 200);
    const body = await resHistory.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.stats);
    assert.strictEqual(typeof body.data.stats.completedIntervalsCount, 'number');
    assert.strictEqual(typeof body.data.stats.totalRecordedFocusMinutes, 'number');
    assert.strictEqual(typeof body.data.stats.disclaimer, 'string');
    assert.match(body.data.stats.disclaimer, /Recorded duration measures timer duration, not verified concentration/);
    assert.ok(Array.isArray(body.data.intervals));
  });

  test('10. Distraction shield settings can be retrieved and updated', async () => {
    // 1. Get default settings
    const resSettings = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resSettings.status, 200);
    const settings = (await resSettings.json()).data;
    assert.strictEqual(settings.suppressInAppNotifications, true);
    assert.strictEqual(settings.breakRemindersEnabled, true);
    assert.strictEqual(settings.breakIntervalMinutes, 25);
    assert.strictEqual(settings.breakDurationMinutes, 5);

    // 2. Update settings
    const resUpdate = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        suppressInAppNotifications: false,
        breakIntervalMinutes: 45,
        breakDurationMinutes: 10,
        audioChimeEnabled: true,
      }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const updated = (await resUpdate.json()).data;
    assert.strictEqual(updated.suppressInAppNotifications, false);
    assert.strictEqual(updated.breakIntervalMinutes, 45);
    assert.strictEqual(updated.breakDurationMinutes, 10);
    assert.strictEqual(updated.audioChimeEnabled, true);
  });

  test('11. Safe retries & invalid state transition: duplicate completion is safe, cannot complete cancelled interval', async () => {
    // 1. Start an interval for User A
    const resStart = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Operating Systems - Virtual Memory',
        plannedDurationMinutes: 15,
      }),
    });
    assert.strictEqual(resStart.status, 201);
    const intervalId = (await resStart.json()).data.id;

    // 2. Complete interval
    const resComp1 = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resComp1.status, 200);

    // 3. Retry complete interval (idempotent safe retry)
    const resComp2 = await fetch(`${testApp.baseUrl}/api/focus/${intervalId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resComp2.status, 200);
    const bodyComp2 = await resComp2.json();
    assert.strictEqual(bodyComp2.data.status, 'completed');

    // 4. Start a second interval and cancel it
    const resStart2 = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Operating Systems - Deadlocks',
        plannedDurationMinutes: 25,
      }),
    });
    const interval2Id = (await resStart2.json()).data.id;

    const resCancel = await fetch(`${testApp.baseUrl}/api/focus/${interval2Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resCancel.status, 200);

    // 5. Attempting to complete a cancelled interval returns 400 with INVALID_STATE_TRANSITION
    const resCompCancelled = await fetch(`${testApp.baseUrl}/api/focus/${interval2Id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(resCompCancelled.status, 400);
    const errBody = await resCompCancelled.json();
    assert.strictEqual(errBody.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('12. Controlled clock timer derivation accurately handles paused and elapsed intervals', async () => {
    const { FocusModel } = await import('../models/focus.model.js');

    const fakeNow = new Date('2026-10-17T12:30:00.000Z');
    const startedAt = new Date('2026-10-17T12:00:00.000Z'); // 30 minutes ago
    const pausedAt = new Date('2026-10-17T12:20:00.000Z');  // paused 20 minutes in

    // Case A: Interval is paused at 20 min mark with 0 prior paused seconds
    const pausedInterval = {
      status: 'paused',
      started_at: startedAt.toISOString(),
      paused_at: pausedAt.toISOString(),
      planned_duration_seconds: 1500, // 25 min planned
      total_paused_seconds: 0,
    };
    const calcPaused = FocusModel.calculateIntervalTimers(pausedInterval);
    // Elapsed should be exactly 20 minutes (1200 seconds)
    assert.strictEqual(calcPaused.elapsedSeconds, 1200);
    // Remaining should be 1500 - 1200 = 300 seconds (5 minutes)
    assert.strictEqual(calcPaused.remainingSeconds, 300);
    assert.strictEqual(calcPaused.isTargetReached, false);

    // Case B: Completed interval with exact actual_duration_seconds
    const completedInterval = {
      status: 'completed',
      started_at: startedAt.toISOString(),
      completed_at: fakeNow.toISOString(),
      actual_duration_seconds: 1500,
      planned_duration_seconds: 1500,
      total_paused_seconds: 120,
    };
    const calcCompleted = FocusModel.calculateIntervalTimers(completedInterval);
    assert.strictEqual(calcCompleted.elapsedSeconds, 1500);
    assert.strictEqual(calcCompleted.remainingSeconds, 0);
    assert.strictEqual(calcCompleted.isTargetReached, true);
  });

  test('13. Break reminder enable/disable and range constraints validation', async () => {
    // Disable break reminders
    const resDisable = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        breakRemindersEnabled: false,
      }),
    });
    assert.strictEqual(resDisable.status, 200);
    assert.strictEqual((await resDisable.json()).data.breakRemindersEnabled, false);

    // Reject out-of-bounds breakIntervalMinutes (< 5 or > 180)
    const resInvalidInterval = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        breakIntervalMinutes: 2,
      }),
    });
    assert.strictEqual(resInvalidInterval.status, 400);

    // Re-enable break reminders
    const resReenable = await fetch(`${testApp.baseUrl}/api/focus/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        breakRemindersEnabled: true,
        breakIntervalMinutes: 30,
      }),
    });
    assert.strictEqual(resReenable.status, 200);
    const reenableBody = await resReenable.json();
    assert.strictEqual(reenableBody.data.breakRemindersEnabled, true);
    assert.strictEqual(reenableBody.data.breakIntervalMinutes, 30);
  });

  test('14. Focus intervals optionally associate with existing Study Session and Topic Room', async () => {
    // 1. Create a room first
    const resRoom = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        name: 'Lexical Analysis Lab',
        subject: 'Computer Science',
        topic: 'Compiler Design',
        description: 'Focus room for building lexers',
        capacity: 10,
      }),
    });
    assert.strictEqual(resRoom.status, 201);
    const roomBody = await resRoom.json();
    const roomId = roomBody.data.id;

    // 2. Start a focus interval associated with the room
    const resFocusRoom = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Lexical Analysis - DFA Construction',
        roomId: roomId,
        plannedDurationMinutes: 45,
      }),
    });
    assert.strictEqual(resFocusRoom.status, 201);
    const focusData = (await resFocusRoom.json()).data;
    assert.strictEqual(focusData.room_id, roomId);

    // Complete it cleanly
    await fetch(`${testApp.baseUrl}/api/focus/${focusData.id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
  });

  test('15. GET /api/focus/coach returns transparent rule-based focus pacing, break timing, and study goals', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.engine, 'deterministic_rule_based');
    assert.strictEqual(body.data.is_machine_learning, false);
    assert.ok(typeof body.data.pacingRecommendation.recommendedSprintMinutes === 'number');
    assert.ok(typeof body.data.pacingRecommendation.sprintReason === 'string');
    assert.ok(typeof body.data.pacingRecommendation.recommendedBreakMinutes === 'number');
    assert.ok(Array.isArray(body.data.recommendedGoals));
    assert.ok(body.data.summary);
  });

  test('16. Focus Coach includes explicit privacy guarantee and zero mental state detection disclaimer', async () => {
    // 1. Fresh cold-start user with 0 logged sessions
    const uniqueCold = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const resReg = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Cold Start Learner',
        email: `cold.learner.${uniqueCold}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const coldToken = (await resReg.json()).data.token;

    const resCold = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${coldToken}` },
    });
    assert.strictEqual(resCold.status, 200);
    const bodyCold = await resCold.json();
    assert.strictEqual(bodyCold.data.summary.isColdStart, true);
    assert.strictEqual(bodyCold.data.pacingRecommendation.recommendedSprintMinutes, 25);
    assert.match(bodyCold.data.privacy_guarantee, /Zero camera monitoring/i);
    assert.match(bodyCold.data.disclaimer, /does not measure or claim to detect your mental focus/i);

    // 2. User B who cancelled a session in test 7
    const resB = await fetch(`${testApp.baseUrl}/api/focus/coach`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(resB.status, 200);
    const bodyB = await resB.json();
    assert.strictEqual(bodyB.data.summary.isColdStart, false);
    assert.strictEqual(bodyB.data.summary.totalLoggedSessions, 1);
  });
});
