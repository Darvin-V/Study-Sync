import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('External Virtual Meeting Link QA & Integration Tests', () => {
  let testApp;
  let hostToken;
  let hostUserId;
  let peerToken;
  let peerUserId;
  let testRoomId;

  before(async () => {
    testApp = await startTestServer();

    // 1. Register host student
    const hostSuffix = `${Date.now()}-host`;
    const hostRegRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Host Scholar',
        email: `host.${hostSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const hostRegBody = await hostRegRes.json();
    hostToken = hostRegBody.data.token;
    hostUserId = hostRegBody.data.user.id;

    // 2. Register peer student
    const peerSuffix = `${Date.now()}-peer`;
    const peerRegRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Peer Scholar',
        email: `peer.${peerSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const peerRegBody = await peerRegRes.json();
    peerToken = peerRegBody.data.token;
    peerUserId = peerRegBody.data.user.id;

    // 3. Create a room by host
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        room_name: 'Calculus Review Space',
        subject: 'Mathematics',
        topic: 'Multivariable Calculus',
        description: 'Collaborative problem solving and concept review.',
        room_type: 'Learn Together',
        difficulty: 'Intermediate',
        preferred_languages: ['English'],
        max_capacity: 8,
      }),
    });
    const createBody = await createRes.json();
    testRoomId = createBody.data.id;
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  test('1. Rejects unsafe or invalid external meeting URLs', async () => {
    // 1.1 Unsafe javascript protocol
    const unsafeRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        meeting_url: 'javascript:alert(document.cookie)',
        meeting_provider: 'custom',
      }),
    });
    assert.strictEqual(unsafeRes.status, 400);
    const unsafeBody = await unsafeRes.json();
    assert.strictEqual(unsafeBody.success, false);
    assert.strictEqual(unsafeBody.error.code, 'INVALID_URL');

    // 1.2 Missing protocol
    const noProtoRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        meeting_url: 'meet.google.com/abc-defg-hij',
        meeting_provider: 'google_meet',
      }),
    });
    assert.strictEqual(noProtoRes.status, 400);
    const noProtoBody = await noProtoRes.json();
    assert.strictEqual(noProtoBody.success, false);
    assert.strictEqual(noProtoBody.error.code, 'INVALID_URL');
  });

  test('2. Saves and starts Google Meet meeting link successfully', async () => {
    const meetUrl = 'https://meet.google.com/xyz-uvwx-rst';
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        meeting_url: meetUrl,
        meeting_provider: 'google_meet',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.meeting_active, true);
    assert.strictEqual(body.data.meeting_url, meetUrl);
    assert.strictEqual(body.data.meeting_provider, 'google_meet');
    assert.ok(body.data.meeting_started_at);
  });

  test('3. Persists meeting state across refresh (GET /api/rooms/:id)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}`, {
      headers: {
        Authorization: `Bearer ${hostToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.meeting_active, true);
    assert.strictEqual(body.data.has_active_meeting, true);
    assert.strictEqual(body.data.meeting_url, 'https://meet.google.com/xyz-uvwx-rst');
    assert.strictEqual(body.data.meeting_provider, 'google_meet');
  });

  test('4. Updates meeting link to a Zoom session', async () => {
    const zoomUrl = 'https://us04web.zoom.us/j/9876543210?pwd=secretpassword';
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        meeting_url: zoomUrl,
        meeting_provider: 'zoom',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.meeting_active, true);
    assert.strictEqual(body.data.meeting_url, zoomUrl);
    assert.strictEqual(body.data.meeting_provider, 'zoom');

    // Verify peer also sees the Zoom meeting
    const peerRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}`, {
      headers: {
        Authorization: `Bearer ${peerToken}`,
      },
    });
    const peerBody = await peerRes.json();
    assert.strictEqual(peerBody.data.meeting_active, true);
    assert.strictEqual(peerBody.data.meeting_url, zoomUrl);
    assert.strictEqual(peerBody.data.meeting_provider, 'zoom');
  });

  test('5. Ends the active virtual meeting and clears active state', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/meeting`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${hostToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.meeting_active, false);

    // Refresh check
    const refreshRes = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}`, {
      headers: {
        Authorization: `Bearer ${hostToken}`,
      },
    });
    const refreshBody = await refreshRes.json();
    assert.strictEqual(refreshBody.data.meeting_active, false);
    assert.strictEqual(refreshBody.data.has_active_meeting, false);
  });

  test('6. Rejects meeting start by non-member of private/unjoined room', async () => {
    // Non-member trying to start meeting in a room they have not joined
    const strangerSuffix = `${Date.now()}-stranger`;
    const strangerReg = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Stranger Scholar',
        email: `stranger.${strangerSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const strangerBody = await strangerReg.json();
    const strangerToken = strangerBody.data.token;

    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${strangerToken}`,
      },
      body: JSON.stringify({
        meeting_url: 'https://meet.google.com/test-room',
        meeting_provider: 'google_meet',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });
});
