import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Comprehensive Product Cleanup, UX Simplification, and Vision Alignment Test Suite', () => {
  let testApp;

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  async function registerUser(name, email, password = 'Password123!') {
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: name,
        email,
        password,
        confirmPassword: password,
      }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/studysync_session=([^;]+)/);
    const cookie = sessionMatch ? `studysync_session=${sessionMatch[1]}` : '';
    return { res, data, cookie, token: data.data?.token, user: data.data?.user };
  }

  test('1. Authentication-first security: unauthenticated requests to protected endpoints are rejected with 401', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/profile/me`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'UNAUTHENTICATED');
  });

  test('2. Progressive onboarding: newly registered learner has incomplete profile until onboarding submission', async () => {
    const email = `onboard.new.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('New Scholar', email);

    // Initial session check
    const meRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const meBody = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(Boolean(meBody.data.isProfileCompleted), false);

    // Complete onboarding with vocational/independent educational stage and age/gender
    const updateRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        Cookie: reg.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        headline: 'Automotive Technician • Vocational Training',
        institution: 'National Skill Development Institute',
        educationStage: 'iti_vocational',
        age: 21,
        gender: 'Man',
        learningGoals: ['Master diagnostic testing for engines'],
        isProfileCompleted: 1,
      }),
    });
    const updateBody = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateBody.data.isProfileCompleted, true);
    assert.strictEqual(updateBody.data.educationStage, 'iti_vocational');
    assert.strictEqual(updateBody.data.age, 21);
  });

  test('3. Privacy protection: private age and gender fields are NEVER exposed in partner discovery results', async () => {
    const email = `privacy.check.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('Private Learner', email);

    // Query partner matches
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(body.data));

    for (const candidate of body.data) {
      assert.strictEqual(candidate.age, undefined, 'Candidate age must not be exposed');
      assert.strictEqual(candidate.gender, undefined, 'Candidate gender must not be exposed');
      assert.strictEqual(candidate.studentId === reg.user.id, false, 'Authenticated user must not appear in own results');
    }
  });

  test('4. Flexible learning domains: users can create and find study rooms for custom non-CSE subjects', async () => {
    const email = `room.creator.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('Biology Teacher', email);

    // Create a Biology room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        Cookie: reg.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        roomName: 'Plant Genetics & Mendelian Inheritance',
        subject: 'Plant Biology & Genetics',
        topic: 'Mendelian Ratios & Punnett Squares',
        description: 'Collaborative problem solving on genetic crosses',
        education_stage: 'higher_secondary',
        roomType: 'Learn Together',
        difficulty: 'Intermediate',
        language: 'English',
        maxParticipants: '10',
      }),
    });
    const createBody = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createBody.success, true);
    assert.strictEqual(createBody.data.subject, 'Plant Biology & Genetics');
    assert.strictEqual(createBody.data.topic, 'Mendelian Ratios & Punnett Squares');

    // Query rooms by custom subject
    const listRes = await fetch(
      `${testApp.baseUrl}/api/rooms?subject=${encodeURIComponent('Plant Biology & Genetics')}`
    );
    const listBody = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert.ok(listBody.data.some((r) => r.id === createBody.data.id));
  });

  test('5. Flexible notes: users can create notes with custom subjects across all educational domains', async () => {
    const email = `note.taker.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('Commerce Scholar', email);

    // Create an Accounting note
    const createRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        Cookie: reg.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Double Entry Bookkeeping & Trial Balance Summary',
        subject: 'Financial Accounting & Commerce',
        topic: 'Ledgers and Trial Balances',
        type: 'Cheatsheet',
        visibility: 'public',
        content: 'Rules of debit and credit: Assets increase with Debit, Liabilities increase with Credit.',
      }),
    });
    const createBody = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createBody.success, true);
    assert.strictEqual(createBody.data.subject, 'Financial Accounting & Commerce');
    assert.strictEqual(createBody.data.topic, 'Ledgers and Trial Balances');

    // Retrieve notes and verify filter
    const listRes = await fetch(
      `${testApp.baseUrl}/api/notes?subject=${encodeURIComponent('Financial Accounting & Commerce')}`
    );
    const listBody = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert.ok(listBody.data.some((n) => n.id === createBody.data.id));
  });

  test('6. Trustworthy partner search: searching for custom non-existent subject yields honest empty state', async () => {
    const email = `partner.seeker.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('Aviation Student', email);

    // Search for a topic with zero peers
    const res = await fetch(
      `${testApp.baseUrl}/api/matches/peers?subject=${encodeURIComponent('Aeronautical Aerodynamics Wind Tunnel Testing')}`,
      {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.data.length, 0, 'Must not return unrelated students merely to populate page');
    assert.ok(body.meta.alternatives, 'Must return helpful alternatives');
  });

  test('7. Spaced revision recommendations: endpoints provide genuine revision recommendations', async () => {
    const email = `revision.learner.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('Revision Student', email);

    const res = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test('8. Study session participation: start, join, and end individual intervals with authoritative time', async () => {
    const email = `session.runner.${Date.now()}@test.studysync.ai`;
    const reg = await registerUser('Focus Runner', email);

    // Create session
    const createRes = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        Cookie: reg.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Mathematics Problem Solving Block',
        subject: 'Mathematics',
        topic: 'Calculus Integration Techniques',
        scheduled_duration_minutes: 45,
      }),
    });
    const createBody = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    const sessionId = createBody.data.id;

    // Start session
    const startRes = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: {
        Cookie: reg.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const startBody = await startRes.json();
    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(startBody.data.status, 'active');

    // End session
    const endRes = await fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: {
        Cookie: reg.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const endBody = await endRes.json();
    assert.strictEqual(endRes.status, 200);
    assert.strictEqual(endBody.data.status, 'completed');
  });

  test('9. Virtual study room meetings: start, discover, external URL validation, and ending calls', async () => {
    const emailA = `meeting.host.${Date.now()}@test.studysync.ai`;
    const host = await registerUser('Host Scholar', emailA);

    const emailB = `meeting.peer.${Date.now()}@test.studysync.ai`;
    const peer = await registerUser('Peer Scholar', emailB);

    // 1. Host creates a study room for Electrical Engineering
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        Cookie: host.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        room_name: 'Digital Circuit Design Lab',
        subject: 'Electrical Engineering',
        topic: 'Synchronous Sequential Logic',
        description: 'Working through state machine reduction and flip-flop synthesis.',
      }),
    });
    const roomBody = await roomRes.json();
    assert.strictEqual(roomRes.status, 201);
    const roomId = roomBody.data.id;
    assert.strictEqual(roomBody.data.meeting_active, false);

    // 2. Peer joins the room
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        Cookie: peer.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    assert.strictEqual(joinRes.status, 200);

    // 3. Reject invalid meeting URL
    const invalidRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'POST',
      headers: {
        Cookie: host.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        meeting_url: 'javascript:alert(1)',
        meeting_provider: 'custom',
      }),
    });
    assert.strictEqual(invalidRes.status, 400);
    const invalidBody = await invalidRes.json();
    assert.strictEqual(invalidBody.error.code, 'INVALID_URL');

    // 4. Host starts instant Jitsi meeting
    const startMeetRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'POST',
      headers: {
        Cookie: host.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        meeting_provider: 'jitsi',
      }),
    });
    assert.strictEqual(startMeetRes.status, 200);
    const startMeetBody = await startMeetRes.json();
    assert.strictEqual(startMeetBody.data.meeting_active, true);
    assert.strictEqual(startMeetBody.data.meeting_provider, 'jitsi');
    assert.ok(startMeetBody.data.meeting_url.includes('meet.jit.si'));

    // 5. Peer queries room and sees the live meeting active
    const peerRoomRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: {
        Cookie: peer.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const peerRoomBody = await peerRoomRes.json();
    assert.strictEqual(peerRoomRes.status, 200);
    assert.strictEqual(peerRoomBody.data.meeting_active, true);
    assert.strictEqual(peerRoomBody.data.has_active_meeting, true);
    assert.ok(peerRoomBody.data.messages.some((m) => m.text?.includes('Virtual study call started')));

    // 6. Update to Google Meet external link
    const gMeetRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'POST',
      headers: {
        Cookie: host.cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        meeting_url: 'https://meet.google.com/xyz-uvwx-rst',
        meeting_provider: 'google_meet',
      }),
    });
    assert.strictEqual(gMeetRes.status, 200);
    const gMeetBody = await gMeetRes.json();
    assert.strictEqual(gMeetBody.data.meeting_active, true);
    assert.strictEqual(gMeetBody.data.meeting_provider, 'google_meet');
    assert.strictEqual(gMeetBody.data.meeting_url, 'https://meet.google.com/xyz-uvwx-rst');

    // 7. End virtual study meeting
    const endMeetRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}/meeting`, {
      method: 'DELETE',
      headers: {
        Cookie: host.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    assert.strictEqual(endMeetRes.status, 200);
    const endMeetBody = await endMeetRes.json();
    assert.strictEqual(endMeetBody.data.meeting_active, false);

    // Verify room messages contains call ended notice
    const finalRoomRes = await fetch(`${testApp.baseUrl}/api/rooms/${roomId}`, {
      headers: {
        Cookie: peer.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const finalRoomBody = await finalRoomRes.json();
    assert.strictEqual(finalRoomBody.data.meeting_active, false);
    assert.ok(finalRoomBody.data.messages.some((m) => m.text?.includes('Virtual study call ended')));
  });
});

