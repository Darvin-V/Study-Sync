import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('StudySync AI — Comprehensive E2E Acceptance Journeys (A through G)', { concurrency: 1 }, () => {
  let testApp;
  let userA = {
    displayName: 'Aarav Sharma',
    email: `aarav.${Date.now()}@test.studysync.ai`,
    password: 'Password123!',
    token: null,
    cookie: null,
    id: null,
  };
  let userB = {
    displayName: 'Priya Ramanathan',
    email: `priya.${Date.now()}@test.studysync.ai`,
    password: 'Password123!',
    token: null,
    cookie: null,
    id: null,
  };
  let userC = {
    displayName: 'Intruder Charlie',
    email: `charlie.${Date.now()}@test.studysync.ai`,
    password: 'Password123!',
    token: null,
    cookie: null,
    id: null,
  };

  let sharedRoomId = null;
  let sharedRoomCode = null;
  let sharedConversationId = null;
  let sharedNoteId = null;
  let callRoomId = null;
  let focusIntervalId = null;

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  // =========================================================================
  // JOURNEY A: NEW USER REGISTRATION & AUTHENTICATION LIFECYCLE
  // =========================================================================
  test('A.1 Register User A with OTP verification requirement', async () => {
    const regRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-require-otp-verification': 'true',
      },
      body: JSON.stringify({
        displayName: userA.displayName,
        email: userA.email,
        password: userA.password,
        confirmPassword: userA.password,
      }),
    });

    assert.strictEqual(regRes.status, 201);
    const body = await regRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.requiresVerification, true);
    assert.strictEqual(body.data.email, userA.email);

    // Verify no session cookie or token was prematurely issued
    assert.strictEqual(body.data.token, undefined);
    const cookieHeader = regRes.headers.get('set-cookie');
    assert.ok(!cookieHeader || !cookieHeader.includes('studysync_session='), 'Must not set session cookie before OTP verification');
  });

  test('A.2 Verify OTP, activate User A account, and receive authenticated session', async () => {
    const db = getDb();
    const challenge = db.prepare('SELECT * FROM email_verifications WHERE LOWER(email) = LOWER(?) AND used_at IS NULL ORDER BY created_at DESC LIMIT 1').get(userA.email);
    assert.ok(challenge, 'Must store OTP challenge in SQLite');

    // Attempt invalid OTP first
    const badOtpRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userA.email,
        otp: '000000',
      }),
    });
    assert.strictEqual(badOtpRes.status, 400);

    // Verify with test-cached OTP
    const { emailService } = await import('../services/email/emailService.js');
    const testOtp = emailService._getRecentTestOtp(userA.email);
    assert.ok(testOtp, 'Must have recorded test OTP in test environment');

    const verifyRes = await fetch(`${testApp.baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userA.email,
        otp: testOtp,
      }),
    });

    assert.strictEqual(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.strictEqual(verifyBody.success, true);
    assert.ok(verifyBody.data.token, 'Must issue token on verification');
    userA.token = verifyBody.data.token;
    userA.id = verifyBody.data.user.id;

    const setCookie = verifyRes.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('studysync_session='), 'Must set HttpOnly session cookie');
    userA.cookie = setCookie.split(';')[0];
  });

  test('A.3 Complete Onboarding Profile for User A', async () => {
    const onboardRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        headline: 'Algorithms & AI Enthusiast',
        institution: 'National Institute of Technology',
        skill_level: 'Intermediate',
        is_profile_completed: 1,
      }),
    });

    assert.strictEqual(onboardRes.status, 200);
    const onboardBody = await onboardRes.json();
    assert.strictEqual(onboardBody.success, true);
    assert.strictEqual(Boolean(onboardBody.data.isProfileCompleted), true);
  });

  test('A.4 Session persistence across simulated page refresh (GET /api/auth/me)', async () => {
    // Via Cookie
    const meCookieRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Cookie: userA.cookie },
    });
    assert.strictEqual(meCookieRes.status, 200);
    const meCookieBody = await meCookieRes.json();
    assert.strictEqual(meCookieBody.data.user.id, userA.id);

    // Via Bearer header
    const meBearerRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(meBearerRes.status, 200);
    const meBearerBody = await meBearerRes.json();
    assert.strictEqual(meBearerBody.data.user.id, userA.id);
  });

  test('A.5 Logout revokes session token in database and clears session cookie', async () => {
    const logoutRes = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        Cookie: userA.cookie,
      },
    });
    assert.strictEqual(logoutRes.status, 200);

    // Subsequent access with old token must fail
    const checkRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(checkRes.status, 401);
  });

  test('A.6 Re-login with valid credentials succeeds and issues fresh session', async () => {
    const loginRes = await fetch(`${testApp.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userA.email,
        password: userA.password,
      }),
    });

    assert.strictEqual(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.strictEqual(loginBody.success, true);
    assert.strictEqual(loginBody.data.user.id, userA.id);
    userA.token = loginBody.data.token;
    const setCookie = loginRes.headers.get('set-cookie');
    userA.cookie = setCookie ? setCookie.split(';')[0] : `studysync_session=${userA.token}`;
  });

  // =========================================================================
  // JOURNEY B: FIND, SEARCH, AND CONNECT (DISCOVER & CIRCLE)
  // =========================================================================
  test('B.0 Register User B and Intruder User C for multi-user tests', async () => {
    // Register User B
    const regRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: userB.displayName,
        email: userB.email,
        password: userB.password,
        confirmPassword: userB.password,
      }),
    });
    assert.strictEqual(regRes.status, 201);
    const body = await regRes.json();
    userB.token = body.data.token;
    userB.id = body.data.user.id;
    userB.cookie = `studysync_session=${userB.token}`;

    // User B sets up profile
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({
        headline: 'Operating Systems & Concurrency Researcher',
        institution: 'IIT Madras',
        country: 'India',
        city: 'Chennai',
        education_stage: 'undergraduate',
        skill_level: 'Advanced',
        is_profile_completed: 1,
      }),
    });

    // Register User C (Intruder)
    const regC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: userC.displayName,
        email: userC.email,
        password: userC.password,
        confirmPassword: userC.password,
      }),
    });
    assert.strictEqual(regC.status, 201);
    const bodyC = await regC.json();
    userC.token = bodyC.data.token;
    userC.id = bodyC.data.user.id;
    userC.cookie = `studysync_session=${userC.token}`;
  });

  test('B.1 User A searches for User B by display name and institution', async () => {
    const searchRes = await fetch(`${testApp.baseUrl}/api/matches/peers?q=Priya`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    assert.strictEqual(searchRes.status, 200);
    const body = await searchRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    const found = body.data.find((m) => m.studentId === userB.id);
    assert.ok(found, 'Search must return User B');
    assert.strictEqual(found.displayName, userB.displayName);

    // Verify self-exclusion: User A is never in results
    const selfFound = body.data.find((m) => m.studentId === userA.id);
    assert.strictEqual(selfFound, undefined, 'User A must not appear in own peer search');
  });

  test('B.2 User A sends Circle connection request to User B', async () => {
    const reqRes = await fetch(`${testApp.baseUrl}/api/circle/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        memberId: userB.id,
      }),
    });
    assert.strictEqual(reqRes.status, 201);
    const body = await reqRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'pending');
  });

  test('B.3 User B accepts Circle connection request from User A', async () => {
    const acceptRes = await fetch(`${testApp.baseUrl}/api/circle/accept/${userA.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
    });
    assert.strictEqual(acceptRes.status, 200);
    const body = await acceptRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.inCircle, true);

    // Verify both see each other in My Circle
    const listARes = await fetch(`${testApp.baseUrl}/api/circle`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const listABody = await listARes.json();
    assert.ok(listABody.data.some((m) => m.id === userB.id));

    const listBRes = await fetch(`${testApp.baseUrl}/api/circle`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    const listBBody = await listBRes.json();
    assert.ok(listBBody.data.some((m) => m.id === userA.id));
  });

  test('B.4 User A opens direct conversation with User B', async () => {
    const convRes = await fetch(`${testApp.baseUrl}/api/conversations/with/${userB.id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(convRes.status, 200);
    const body = await convRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.id);
    sharedConversationId = body.data.id;
  });

  // =========================================================================
  // JOURNEY C: STUDY TOGETHER (TOPIC ROOMS, ROOM CODE, CHAT & NOTE SHARING)
  // =========================================================================
  test('C.1 User A creates room with novel subject and topic', async () => {
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        room_name: 'Quantum Circuit Compilation Lab',
        subject: 'Quantum Computing',
        topic: 'ZX-Calculus Optimization',
        description: 'Collaborative analysis of quantum circuit synthesis using ZX-calculus graph rewrites.',
        room_type: 'Learn Together',
        difficulty: 'Advanced',
        language: 'English',
      }),
    });

    assert.strictEqual(roomRes.status, 201);
    const body = await roomRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.id);
    assert.ok(body.data.room_code, 'Must generate room code');
    sharedRoomId = body.data.id;
    sharedRoomCode = body.data.room_code;
  });

  test('C.2 User B joins room via room code and appears in participant list', async () => {
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/join-by-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({
        room_code: sharedRoomCode,
      }),
    });

    assert.strictEqual(joinRes.status, 200);
    const joinBody = await joinRes.json();
    assert.strictEqual(joinBody.success, true);
    assert.strictEqual(joinBody.data.roomId, sharedRoomId);

    // Verify members list contains both A and B
    const roomDetailRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const roomDetail = await roomDetailRes.json();
    const memberIds = roomDetail.data.members.map((p) => p.user_id || p.id);
    assert.ok(memberIds.includes(userA.id), 'User A must be in room members');
    assert.ok(memberIds.includes(userB.id), 'User B must be in room members');
  });

  test('C.3 Real-time bi-directional messaging between User A and User B', async () => {
    // User A sends message
    const msgARes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        message_content: 'Shall we review the Clifford+T decomposition rules today?',
      }),
    });
    assert.strictEqual(msgARes.status, 201);

    // User B sends response message with Tamil Unicode
    const msgBRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
      body: JSON.stringify({
        message_content: 'ஆம், தொடங்கலாம்! (Yes, let us begin!)',
      }),
    });
    assert.strictEqual(msgBRes.status, 201);

    // User A reads conversation messages and verifies ordering and content
    const fetchMsgRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(fetchMsgRes.status, 200);
    const msgsBody = await fetchMsgRes.json();
    assert.strictEqual(msgsBody.success, true);
    assert.ok(msgsBody.data.length >= 2);

    const latest = msgsBody.data[msgsBody.data.length - 1];
    assert.strictEqual(latest.text, 'ஆம், தொடங்கலாம்! (Yes, let us begin!)');
    assert.strictEqual(latest.senderId, userB.id);
  });

  test('C.4 User A creates study note and shares with User B in the room', async () => {
    const noteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        title: 'ZX-Calculus Spider Rules & Phase Tracking',
        content: '# Spider Fusion Rule\nGreen spiders fuse: `G(α) + G(β) = G(α + β)`. Red spiders fuse symmetrically.',
        subject: 'Quantum Computing',
        topic: 'ZX-Calculus Optimization',
        visibility: 'room_shared',
        room_id: sharedRoomId,
      }),
    });

    assert.strictEqual(noteRes.status, 201);
    const noteBody = await noteRes.json();
    assert.strictEqual(noteBody.success, true);
    assert.ok(noteBody.data.id);
    sharedNoteId = noteBody.data.id;

    // User B retrieves note successfully
    const getNoteRes = await fetch(`${testApp.baseUrl}/api/notes/${sharedNoteId}`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert.strictEqual(getNoteRes.status, 200);
    const getNoteBody = await getNoteRes.json();
    assert.strictEqual(getNoteBody.data.title, 'ZX-Calculus Spider Rules & Phase Tracking');
    assert.strictEqual(getNoteBody.data.author_id, userA.id);
  });

  // =========================================================================
  // JOURNEY D: STUDY CALL / VIDEO CALL LIFECYCLE
  // =========================================================================
  test('D.1 User A starts Study Call from direct conversation', async () => {
    const callRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/study-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
    });

    assert.strictEqual(callRes.status, 200);
    const callBody = await callRes.json();
    assert.strictEqual(callBody.success, true);
    assert.ok(callBody.data.id);
    callRoomId = callBody.data.id;
  });

  test('D.2 User A starts virtual meeting with Jitsi URL', async () => {
    const jitsiUrl = `https://meet.jit.si/studysync-call-${callRoomId.slice(-8)}`;
    const startRes = await fetch(`${testApp.baseUrl}/api/rooms/${callRoomId}/meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        meeting_url: jitsiUrl,
        meeting_provider: 'jitsi',
      }),
    });

    assert.strictEqual(startRes.status, 200);
    const startBody = await startRes.json();
    assert.strictEqual(startBody.success, true);
    assert.strictEqual(Boolean(startBody.data.meeting_active), true);
    assert.strictEqual(startBody.data.meeting_url, jitsiUrl);
  });

  test('D.3 User B sees active call status and joins meeting', async () => {
    const joinMeetingRes = await fetch(`${testApp.baseUrl}/api/rooms/${callRoomId}/meeting/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
    });

    assert.strictEqual(joinMeetingRes.status, 200);
    const joinBody = await joinMeetingRes.json();
    assert.strictEqual(joinBody.success, true);
    assert.strictEqual(Boolean(joinBody.data.is_user_in_meeting), true);
  });

  test('D.4 User B leaves meeting; meeting remains active for host User A', async () => {
    const leaveRes = await fetch(`${testApp.baseUrl}/api/rooms/${callRoomId}/meeting/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userB.token}`,
      },
    });

    assert.strictEqual(leaveRes.status, 200);

    // Verify meeting is still active for User A
    const statusRes = await fetch(`${testApp.baseUrl}/api/rooms/${callRoomId}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const statusBody = await statusRes.json();
    assert.strictEqual(Boolean(statusBody.data.meeting_active), true);
  });

  test('D.5 User A (Host) ends meeting for all participants', async () => {
    const endRes = await fetch(`${testApp.baseUrl}/api/rooms/${callRoomId}/meeting`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
    });

    assert.strictEqual(endRes.status, 200);
    const endBody = await endRes.json();
    assert.strictEqual(endBody.success, true);
    assert.strictEqual(Boolean(endBody.data.meeting_active), false);
  });

  // =========================================================================
  // JOURNEY E: FOCUS SESSION & TIMER COMPLETION
  // =========================================================================
  test('E.1 User A starts a 25-minute focus interval on target topic', async () => {
    const startRes = await fetch(`${testApp.baseUrl}/api/focus/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        topic: 'ZX-Calculus Graph Rewrites',
        subject: 'Quantum Computing',
        plannedDurationMinutes: 25,
        roomId: sharedRoomId,
      }),
    });

    assert.strictEqual(startRes.status, 201);
    const body = await startRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.planned_duration_seconds, 1500);
    focusIntervalId = body.data.id;
  });

  test('E.2 User A pauses and resumes focus session', async () => {
    // Pause
    const pauseRes = await fetch(`${testApp.baseUrl}/api/focus/${focusIntervalId}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
    });
    assert.strictEqual(pauseRes.status, 200);
    const pauseBody = await pauseRes.json();
    assert.strictEqual(pauseBody.data.status, 'paused');

    // Resume
    const resumeRes = await fetch(`${testApp.baseUrl}/api/focus/${focusIntervalId}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
    });
    assert.strictEqual(resumeRes.status, 200);
    const resumeBody = await resumeRes.json();
    assert.strictEqual(resumeBody.data.status, 'active');
  });

  test('E.3 User A completes focus session and verifies history', async () => {
    const compRes = await fetch(`${testApp.baseUrl}/api/focus/${focusIntervalId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        notes: 'Completed all rewrite diagrams successfully.',
      }),
    });

    assert.strictEqual(compRes.status, 200);
    const compBody = await compRes.json();
    assert.strictEqual(compBody.success, true);
    assert.strictEqual(compBody.data.status, 'completed');

    // Verify session history via GET /api/focus/history
    const histRes = await fetch(`${testApp.baseUrl}/api/focus/history`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.strictEqual(histRes.status, 200);
    const histBody = await histRes.json();
    assert.ok(histBody.data.intervals.some((h) => h.id === focusIntervalId));
  });

  // =========================================================================
  // JOURNEY F: SECURITY, ISOLATION & IDOR DEFENSE
  // =========================================================================
  test('F.1 User C is blocked from accessing User A and User B conversation messages', async () => {
    const getMsgRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    assert.strictEqual(getMsgRes.status, 403);
  });

  test('F.2 User C is blocked from injecting messages into User A and User B conversation', async () => {
    const postMsgRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userC.token}`,
      },
      body: JSON.stringify({
        message_content: 'Malicious injection attempt by User C',
      }),
    });
    assert.strictEqual(postMsgRes.status, 403);
  });

  test('F.3 User C is blocked from viewing User A private notes', async () => {
    // Create private note for User A
    const privNoteRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        title: 'User A Ultra-Secret Personal Note',
        content: 'Confidential research keys and credentials.',
        subject: 'Security',
        topic: 'Access Control',
        visibility: 'private',
      }),
    });
    const privNote = (await privNoteRes.json()).data;
    assert.ok(privNote?.id);

    // User C attempts to view
    const viewRes = await fetch(`${testApp.baseUrl}/api/notes/${privNote.id}`, {
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    assert.strictEqual(viewRes.status, 403);

    // User C attempts to delete
    const delRes = await fetch(`${testApp.baseUrl}/api/notes/${privNote.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    assert.strictEqual(delRes.status, 403);
  });

  test('F.4 User C is blocked from accessing private study room without authorization', async () => {
    // User A creates private room
    const privRoomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        room_name: 'Strictly Private Lab',
        subject: 'Cryptography',
        topic: 'Zero Knowledge Proofs',
        room_type: 'Learn Together',
        status: 'private',
      }),
    });
    assert.strictEqual(privRoomRes.status, 201);
    const privRoom = (await privRoomRes.json()).data;
    assert.ok(privRoom?.id);

    // User C cannot view messages in private room
    const intruderRoomRes = await fetch(`${testApp.baseUrl}/api/rooms/${privRoom.id}/messages`, {
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    assert.strictEqual(intruderRoomRes.status, 403);

    // Private room does not appear in public room discovery for User C
    const listRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      headers: { Authorization: `Bearer ${userC.token}` },
    });
    const listBody = await listRes.json();
    assert.strictEqual(listBody.data.some((r) => r.id === privRoom.id), false);
  });

  test('F.5 User C is blocked from viewing or modifying User A settings and profile', async () => {
    // User C attempts to update User A's profile by injecting target user id
    const badUpdateRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userC.token}`,
      },
      body: JSON.stringify({
        id: userA.id,
        headline: 'Defaced Headline by Hacker C',
      }),
    });

    assert.strictEqual(badUpdateRes.status, 200);

    // Verify User A profile was not modified
    const checkARes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const checkABody = await checkARes.json();
    assert.strictEqual(checkABody.data.headline, 'Algorithms & AI Enthusiast');
  });

  // =========================================================================
  // JOURNEY G: WEB & MOBILE CONSISTENCY & DUAL-ISSUANCE
  // =========================================================================
  test('G.1 Web browser uses HttpOnly session cookie without Bearer header', async () => {
    const webRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: {
        Cookie: userA.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    assert.strictEqual(webRes.status, 200);
    const webBody = await webRes.json();
    assert.strictEqual(webBody.data.user.id, userA.id);
  });

  test('G.2 Native mobile app uses Authorization: Bearer token without cookies', async () => {
    const mobileRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${userA.token}`,
        'User-Agent': 'StudySync-Capacitor-Android/0.1.0',
      },
    });
    assert.strictEqual(mobileRes.status, 200);
    const mobileBody = await mobileRes.json();
    assert.strictEqual(mobileBody.data.user.id, userA.id);
  });

  test('G.3 Language preference supports Tamil "தமிழ்" across both web and native clients', async () => {
    // Update language to Tamil as User A
    const setLangRes = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        language: 'ta',
      }),
    });
    assert.strictEqual(setLangRes.status, 200);

    // Verify language is persisted as 'ta'
    const getLangRes = await fetch(`${testApp.baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const getLangBody = await getLangRes.json();
    assert.strictEqual(getLangBody.data.language, 'ta');
  });
});
