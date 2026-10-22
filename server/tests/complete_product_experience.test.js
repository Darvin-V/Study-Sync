import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Complete Product Experience & Unified User Journeys Audit', () => {
  let testApp;
  let studentAToken, studentAId, studentACookie;
  let studentBToken, studentBId, studentBCookie;
  let sharedRoomId;
  let sharedConversationId;

  before(async () => {
    testApp = await startTestServer();
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register Student A (e.g. Biology & Chemistry student)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Amina Bio',
        email: `amina.${tag}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    studentAToken = dataA.data.token;
    studentAId = dataA.data.user.id;
    studentACookie = resA.headers.get('set-cookie');

    // Complete Student A's Academic Profile (Biology & Genetics)
    const profA = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        displayName: 'Amina Bio',
        headline: 'Molecular Biology Sophomore',
        institution: 'Faculty of Life Sciences',
        introduction: 'Focusing on Mendelian Genetics and Cellular Respiration problem sets.',
        skillLevel: 'Intermediate',
        preferredStudyTimes: 'Weekday Evenings',
        preferredStudyDuration: 45,
      }),
    });
    assert.strictEqual(profA.status, 200);

    // 2. Register Student B (Compatible peer learner in Biology)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Dev Genetics',
        email: `dev.${tag}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    studentBToken = dataB.data.token;
    studentBId = dataB.data.user.id;
    studentBCookie = resB.headers.get('set-cookie');

    // Complete Student B's Academic Profile
    const profB = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentBToken}`,
      },
      body: JSON.stringify({
        displayName: 'Dev Genetics',
        headline: 'Biochemistry Senior',
        institution: 'Department of Biochemistry',
        introduction: 'Preparing for qualifying exams in Genetics & Enzyme Kinetics.',
        skillLevel: 'Advanced',
        preferredStudyTimes: 'Weekday Evenings',
        preferredStudyDuration: 45,
      }),
    });
    assert.strictEqual(profB.status, 200);
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  // --------------------------------------------------------------------------
  // Journey 1: Home Launchpad & Non-CS Topic Discovery
  // --------------------------------------------------------------------------
  test('1. Main Learning Journey: Student can search for non-CS subject (Biology) and discover matching peers', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Biology&intent=learn_together`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  test('2. Student can send a study invite directly to a discovered peer', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/safety/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        receiverId: studentBId,
        topic: 'Mendelian Genetics',
        message: 'Would you like to study Genetics together?',
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.receiverId || json.data.receiver_id, studentBId);
  });

  // --------------------------------------------------------------------------
  // Journey 2: Canonical Direct Messaging Flow
  // --------------------------------------------------------------------------
  test('3. Starting a conversation from Discovery card opens canonical 1-to-1 conversation', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        recipientId: studentBId,
        message: 'Hello Dev, want to revise genetics problem set 2 together?',
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.id);
    sharedConversationId = json.data.id;
  });

  test('4. Exchanging direct messages delivers content with persistence and updates unread counts', async () => {
    // Student B checks conversation list and sees 1 unread message
    const listRes = await fetch(`${testApp.baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listJson = await listRes.json();
    const conv = listJson.data.find((c) => c.id === sharedConversationId);
    assert.ok(conv);
    assert.strictEqual(conv.unreadCount, 1);

    // Student B opens thread (fetching messages clears unread count)
    const msgsRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.strictEqual(msgsRes.status, 200);
    const msgsJson = await msgsRes.json();
    assert.strictEqual(msgsJson.data.length, 1);
    assert.strictEqual(msgsJson.data[0].messageContent, 'Hello Dev, want to revise genetics problem set 2 together?');

    // Student B replies
    const replyRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentBToken}`,
      },
      body: JSON.stringify({ message_content: 'Sounds great! Let us join a study room.' }),
    });
    assert.strictEqual(replyRes.status, 201);

    // Student A reads messages
    const aMsgsRes = await fetch(`${testApp.baseUrl}/api/conversations/${sharedConversationId}/messages`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(aMsgsRes.status, 200);
    const aMsgsJson = await aMsgsRes.json();
    assert.strictEqual(aMsgsJson.data.length, 2);
  });

  // --------------------------------------------------------------------------
  // Journey 3: Study Spaces / Topic Rooms & Virtual Meetings
  // --------------------------------------------------------------------------
  test('5. Student creates a topic-based Study Space (Biology & Genetics)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        room_name: 'Genetics Problem Sprints',
        subject: 'Biology',
        topic: 'Mendelian Genetics',
        description: 'Collaborative problem solving on Punnett squares and dihybrid crosses.',
        room_type: 'Learn Together',
        difficulty: 'Intermediate',
        preferred_languages: ['English'],
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.id);
    sharedRoomId = json.data.id;
  });

  test('6. Peer learner joins the Study Room and posts in discussion', async () => {
    // Student B joins the room
    const joinRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.strictEqual(joinRes.status, 200);

    // Student B posts a message in room discussion
    const postRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentBToken}`,
      },
      body: JSON.stringify({
        message_content: 'Ready to work on problem 4.',
        topic_tag: 'Problem4',
      }),
    });
    assert.strictEqual(postRes.status, 201);

    // Room discussion retrieves the persistent message
    const getRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/messages`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(getRes.status, 200);
    const getJson = await getRes.json();
    assert.ok(getJson.data.some((m) => m.message_content === 'Ready to work on problem 4.'));
  });

  test('7. Room details provide server-verified roster and meeting state', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, sharedRoomId);
    assert.strictEqual(json.data.member_count, 2);
  });

  // --------------------------------------------------------------------------
  // Journey 4: Profile, Learning DNA & Personal Notes
  // --------------------------------------------------------------------------
  test('8. Student can create and manage personal study notes in Profile/Resources', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        title: 'Mendelian Laws Summary',
        subject: 'Biology',
        topic: 'Mendelian Genetics',
        content: 'Law of Segregation and Law of Independent Assortment key principles.',
        type: 'Lecture Summary',
        visibility: 'private',
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.title, 'Mendelian Laws Summary');
  });

  test('9. Student can update Learning DNA (collaboration style & strengths)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        collaborationStyle: 'Structured problem sprint with concept review',
        preferredStudyTimes: 'Weekday Evenings',
        learningGoals: ['Master dihybrid crosses', 'Ace Midterm 1'],
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.collaborationStyle, 'Structured problem sprint with concept review');
  });

  // --------------------------------------------------------------------------
  // Journey 5: Settings & Security Controls
  // --------------------------------------------------------------------------
  test('10. Student can update Theme and Language in Settings', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentAToken}`,
      },
      body: JSON.stringify({
        theme: 'dark',
        language: 'ta',
        focus_duration_minutes: 30,
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.theme, 'dark');
    assert.strictEqual(json.data.language, 'ta');
  });

  test('11. IDOR Prevention: Student cannot access private note of another student', async () => {
    // Student A created a private note in test 8; get all notes for Student A
    const listRes = await fetch(`${testApp.baseUrl}/api/notes?authorId=${studentAId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const listJson = await listRes.json();
    const noteA = listJson.data.find((n) => n.title === 'Mendelian Laws Summary');
    assert.ok(noteA);

    // Student B attempts to delete or update Student A's private note -> rejected with 403
    const delRes = await fetch(`${testApp.baseUrl}/api/notes/${noteA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.strictEqual(delRes.status, 403);
  });
});
