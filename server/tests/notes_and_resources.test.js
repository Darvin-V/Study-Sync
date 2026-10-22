import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Persistent Notes, Resources & Knowledge Exchange Endpoints', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let outsiderToken;
  let outsiderId;
  let testRoomId;
  let testSessionId;
  let userAPrivateNoteId;
  let userAPublicNoteId;
  let roomSharedNoteId;
  let testQuestionId;
  let testResourceId;

  before(async () => {
    testApp = await startTestServer();

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Alice',
        email: `alice.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bodyA = await resA.json();
    userAToken = bodyA.data.token;
    userAId = bodyA.data.user.id;

    // 2. Register User B
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Bob',
        email: `bob.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bodyB = await resB.json();
    userBToken = bodyB.data.token;
    userBId = bodyB.data.user.id;

    // 3. Register Outsider
    const resOutsider = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'User Outsider',
        email: `outsider.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const bodyOutsider = await resOutsider.json();
    outsiderToken = bodyOutsider.data.token;
    outsiderId = bodyOutsider.data.user.id;

    // 4. Create a test room with User A as creator
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        room_name: 'Alice Distributed Systems Lab',
        subject: 'Computer Networks',
        topic: 'Raft Consensus',
        description: 'Room for exploring leader election and log replication.',
        room_type: 'Learn Together',
        difficulty: 'Advanced',
      }),
    });
    const roomBody = await roomRes.json();
    testRoomId = roomBody.data.id;

    // 5. User B joins the test room
    await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    // 6. Create a test session with User A
    const sessRes = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topic: 'Raft Consensus',
        subject: 'Computer Networks',
        title: 'Raft Protocol Sprint',
        plannedDuration: 45,
        roomId: testRoomId,
      }),
    });
    const sessBody = await sessRes.json();
    testSessionId = sessBody.data.id;
  });

  after(async () => {
    if (testApp?.close) await testApp.close();
  });

  test('1. Authenticated user can create a public note and retrieve it', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: 'Raft Consensus Protocol Summary',
        content: '### Leader Election\nHeartbeats prevent elections from starting.',
        subject: 'Computer Networks',
        topic: 'Raft Consensus',
        type: 'Lecture Summary',
        visibility: 'public',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Raft Consensus Protocol Summary');
    assert.equal(body.data.author_id, userAId);
    assert.equal(body.data.visibility, 'public');
    userAPublicNoteId = body.data.id;

    // Verify retrieval
    const getRes = await fetch(`${testApp.baseUrl}/api/notes/${userAPublicNoteId}`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.data.id, userAPublicNoteId);
  });

  test('2. Reject note creation with missing or invalid input (400 VALIDATION_ERROR)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: '', // Empty title
        subject: 'Computer Networks',
        topic: 'Raft',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('3. Private Note Isolation: User B and unauthenticated requests cannot view User A private note', async () => {
    // User A creates a private note
    const createRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: 'Alice Private Exam Cheatsheet',
        content: 'Confidential personal notes.',
        subject: 'Computer Networks',
        topic: 'Raft Consensus',
        visibility: 'private',
      }),
    });

    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    userAPrivateNoteId = createBody.data.id;

    // User A can view their own private note
    const aRes = await fetch(`${testApp.baseUrl}/api/notes/${userAPrivateNoteId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(aRes.status, 200);

    // User B receives 403 Forbidden
    const bRes = await fetch(`${testApp.baseUrl}/api/notes/${userAPrivateNoteId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(bRes.status, 403);

    // Unauthenticated request receives 403 Forbidden
    const unauthRes = await fetch(`${testApp.baseUrl}/api/notes/${userAPrivateNoteId}`);
    assert.equal(unauthRes.status, 403);

    // User B listing notes does not include Alice private note
    const bListRes = await fetch(`${testApp.baseUrl}/api/notes`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const bListBody = await bListRes.json();
    assert.ok(bListBody.data.every((n) => n.id !== userAPrivateNoteId));
  });

  test('4. Room-Shared Note: Accessible to room member (User B) but forbidden to outsider', async () => {
    // User A creates room-shared note linked to testRoomId
    const res = await fetch(`${testApp.baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: 'Room Shared Lab Exercises',
        content: 'Exercises for room members.',
        subject: 'Computer Networks',
        topic: 'Raft Consensus',
        visibility: 'room_shared',
        room_id: testRoomId,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    roomSharedNoteId = body.data.id;

    // User B is a member of testRoomId -> can view
    const bRes = await fetch(`${testApp.baseUrl}/api/notes/${roomSharedNoteId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(bRes.status, 200);

    // Outsider is not a member of testRoomId -> receives 403 Forbidden
    const outRes = await fetch(`${testApp.baseUrl}/api/notes/${roomSharedNoteId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert.equal(outRes.status, 403);
  });

  test('5. Note Editing: Author can edit note, but non-author receives 403 Forbidden', async () => {
    // User B attempts to edit User A's note -> 403
    const unauthorizedEdit = await fetch(`${testApp.baseUrl}/api/notes/${userAPublicNoteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        title: 'Tampered Title',
      }),
    });
    assert.equal(unauthorizedEdit.status, 403);

    // User A edits their note -> 200 OK
    const authorizedEdit = await fetch(`${testApp.baseUrl}/api/notes/${userAPublicNoteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        title: 'Raft Consensus Protocol Summary (Updated V2)',
      }),
    });
    assert.equal(authorizedEdit.status, 200);
    const editBody = await authorizedEdit.json();
    assert.equal(editBody.data.title, 'Raft Consensus Protocol Summary (Updated V2)');
  });

  test('6. Note Deletion / Archival: Author can delete, non-author receives 403 Forbidden', async () => {
    // User B attempts to delete User A's note -> 403
    const unauthorizedDel = await fetch(`${testApp.baseUrl}/api/notes/${userAPrivateNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(unauthorizedDel.status, 403);

    // User A deletes their private note -> 200 OK
    const authorizedDel = await fetch(`${testApp.baseUrl}/api/notes/${userAPrivateNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(authorizedDel.status, 200);

    // Subsequent retrieval returns 404 Not Found
    const checkRes = await fetch(`${testApp.baseUrl}/api/notes/${userAPrivateNoteId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(checkRes.status, 404);
  });

  test('7. Shared Resources: Room member can share resource with validated URL', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        title: 'Raft Algorithm Paper PDF Reference',
        type: 'PDF',
        topic: 'Raft Consensus',
        description: 'In Search of an Understandable Consensus Algorithm by Ongaro and Ousterhout.',
        url: 'https://raft.github.io/raft.pdf',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Raft Algorithm Paper PDF Reference');
    assert.equal(body.data.url, 'https://raft.github.io/raft.pdf');
    testResourceId = body.data.id;
  });

  test('8. Shared Resources: Reject resource creation with invalid URL format', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Resource',
        url: 'not-a-valid-http-url',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  test('9. Shared Resources: Non-member cannot share resource in room (403 Forbidden)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({
        title: 'Outsider Resource',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('10. Knowledge Exchange: Room member can ask a question/doubt in room', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        question: 'How does Raft guarantee log matching when candidate terms diverge?',
        topic: 'Log Matching Property',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.resolved, false);
    assert.equal(body.data.asker_id, userBId);
    testQuestionId = body.data.id;
  });

  test('11. Knowledge Exchange: Non-member cannot ask question in room (403 Forbidden)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({
        question: 'Outsider question attempt',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('12. Knowledge Exchange: Authorized room member can reply to a question', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/questions/${testQuestionId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        text: 'The leader appends log entries and enforces AppendEntries consistency check on prevLogIndex and prevLogTerm.',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.responder_id, userAId);
  });

  test('13. Knowledge Exchange: Question author can resolve the doubt', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/questions/${testQuestionId}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.resolved, true);
  });

  test('14. Knowledge Exchange: Bystander cannot resolve another user question (403 Forbidden)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/questions/${testQuestionId}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });

    assert.equal(res.status, 403);
  });

  test('15. Shared Resources: Non-owner/non-creator cannot delete shared resource', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/resources/${testResourceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });

    assert.equal(res.status, 403);
  });

  test('16. Shared Resources: Uploader can delete shared resource', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}/resources/${testResourceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.deleted, true);
  });
});
