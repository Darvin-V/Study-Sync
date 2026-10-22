import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Room Loading & UX Resilience Regression Tests', () => {
  let testApp;
  let studentToken;
  let studentUserId;
  let testRoomId;

  before(async () => {
    testApp = await startTestServer();

    // Register a test student
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const regRes = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Room QA Student',
        email: `room.qa.${uniqueSuffix}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regBody = await regRes.json();
    studentToken = regBody.data.token;
    studentUserId = regBody.data.user.id;

    // Create a verified study room
    const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        room_name: 'Algorithms & Data Structures Sprint',
        subject: 'Computer Science',
        topic: 'Graph Algorithms & Trees',
        description: 'Interactive session exploring BFS, DFS, and Dijkstra.',
        room_type: 'Learn Together',
        difficulty: 'Intermediate',
        preferred_languages: ['English'],
        max_capacity: 10,
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

  test('1. Valid room loading returns complete, uncorrupted room environment', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, testRoomId);
    assert.equal(body.data.room_name, 'Algorithms & Data Structures Sprint');
    assert.equal(body.data.creator_id, studentUserId);
    assert.ok(Array.isArray(body.data.members), 'Members roster must be an array');
    assert.ok(body.data.members.length >= 1, 'Creator must be in the roster');
    assert.equal(body.data.is_member, true);
    assert.ok(body.data.created_at, 'created_at timestamp must be present');
  });

  test('2. Non-existent room ID returns clean 404 without internal DB details exposed', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${nonExistentId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    // Ensure no raw SQL or DB traces are leaked
    assert.ok(!body.error.message.includes('SQLITE'));
    assert.ok(!body.error.message.includes('SELECT'));
  });

  test('3. Invalid or whitespace room ID returns 400 INVALID_PARAM', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/%20%20`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_PARAM');
  });

  test('4. Room detail is accessible without authentication (optionalAuth) for previewing', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/rooms/${testRoomId}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, testRoomId);
    // Unauthenticated user should not be marked as a member
    assert.equal(body.data.is_member, false);
  });

  test('5. Room list filtering gracefully handles query permutations without crashing', async () => {
    const searchUrl = `${testApp.baseUrl}/api/rooms?subject=Computer+Science&difficulty=Intermediate&limit=5`;
    const res = await fetch(searchUrl);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    const found = body.data.some((r) => r.id === testRoomId);
    assert.ok(found, 'Created room should appear in filtered subject list');
  });
});
