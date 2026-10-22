import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Safety, Privacy & Trust Endpoints (Phase 14)', () => {
  let testApp;
  let db;

  // Test users
  let aliceToken, aliceId;
  let bobToken, bobId;
  let charlieToken, charlieId;
  let moderatorToken, moderatorId;

  let sharedRoomId;

  before(async () => {
    testApp = await startTestServer();
    db = getDb();

    // Clean up any stale test users
    const staleUsers = db.prepare(`
      SELECT id FROM users 
      WHERE email LIKE '%@test.p14.%' OR email LIKE '%@test.studysync.ai'
    `).all();
    for (const u of staleUsers) {
      try { db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM room_memberships WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?').run(u.id, u.id); } catch {}
      try { db.prepare('DELETE FROM user_reports WHERE reporter_id = ? OR reported_user_id = ?').run(u.id, u.id); } catch {}
      try { db.prepare('DELETE FROM user_privacy_settings WHERE user_id = ?').run(u.id); } catch {}
      try { db.prepare('DELETE FROM study_invites WHERE sender_id = ? OR receiver_id = ?').run(u.id, u.id); } catch {}
      try { db.prepare('DELETE FROM users WHERE id = ?').run(u.id); } catch {}
    }

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User Alice (Student)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Trust',
        email: `alice.${unique}@test.p14.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    aliceToken = dataA.data.token;
    aliceId = dataA.data.user.id;

    // 2. Register User Bob (Student)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Safe',
        email: `bob.${unique}@test.p14.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    bobToken = dataB.data.token;
    bobId = dataB.data.user.id;

    // 3. Register User Charlie (Student)
    const resC = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Charlie Discreet',
        email: `charlie.${unique}@test.p14.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataC = await resC.json();
    charlieToken = dataC.data.token;
    charlieId = dataC.data.user.id;

    // 4. Register Moderator User
    const resM = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Mod Agent',
        email: `mod.${unique}@test.p14.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataM = await resM.json();
    moderatorToken = dataM.data.token;
    moderatorId = dataM.data.user.id;

    // Elevate moderator role in database
    db.prepare("UPDATE users SET role = 'moderator' WHERE id = ?").run(moderatorId);

    // Populate learner profiles
    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        headline: 'Sophomore • Computer Science',
        institution: 'Faculty of Computing',
        skill_level: 'Intermediate',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 45,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        preferences: [{
          topic_id: 'topic-dbms-joins',
          learning_goal: 'Exam Revision',
          skill_level: 'Intermediate',
          is_learning_now: 1,
          is_strength: 1,
          willing_to_teach: 1,
        }],
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({
        headline: 'Junior • Software Engineering',
        institution: 'School of Technology',
        skill_level: 'Advanced',
        preferred_study_times: 'Weekday Evenings',
        preferred_study_duration: 60,
        is_profile_completed: 1,
      }),
    });

    await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({
        preferences: [{
          topic_id: 'topic-dbms-joins',
          learning_goal: 'Exam Revision',
          skill_level: 'Advanced',
          is_learning_now: 1,
          is_strength: 1,
          willing_to_teach: 1,
        }],
      }),
    });

    // Create a shared topic room between Alice and Bob
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        room_name: 'P14 Trust Room',
        subject: 'Database Systems',
        topic: 'Relational Algebra & SQL Joins',
        description: 'Room for verifying shared room blocking policies',
        max_capacity: 10,
      }),
    });
    const roomData = await roomRes.json();
    sharedRoomId = roomData.data.id;

    // Bob joins the room
    await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
  });

  after(async () => {
    try {
      const staleUsers = db.prepare(`
        SELECT id FROM users 
        WHERE email LIKE '%@test.p14.%'
      `).all();
      for (const u of staleUsers) {
        try { db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM room_memberships WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?').run(u.id, u.id); } catch {}
        try { db.prepare('DELETE FROM user_reports WHERE reporter_id = ? OR reported_user_id = ?').run(u.id, u.id); } catch {}
        try { db.prepare('DELETE FROM user_privacy_settings WHERE user_id = ?').run(u.id); } catch {}
        try { db.prepare('DELETE FROM study_invites WHERE sender_id = ? OR receiver_id = ?').run(u.id, u.id); } catch {}
        try { db.prepare('DELETE FROM users WHERE id = ?').run(u.id); } catch {}
      }
    } catch {}

    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Privacy Settings: Default settings are created and queryable via GET /api/safety/privacy', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.profileVisibility, 'public');
    assert.strictEqual(body.data.showActivityStatus, true);
    assert.strictEqual(body.data.showLearningPreferences, true);
    assert.strictEqual(body.data.showInstitution, true);
    assert.strictEqual(body.data.allowStudyInvites, true);
  });

  test('2. Privacy Settings: Authenticated learner can update visibility and field privacy via PUT /api/safety/privacy', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        profileVisibility: 'rooms_only',
        showActivityStatus: false,
        showInstitution: false,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.profileVisibility, 'rooms_only');
    assert.strictEqual(body.data.showActivityStatus, false);
    assert.strictEqual(body.data.showInstitution, false);

    // Revert for subsequent test compatibility
    await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ profileVisibility: 'public', showActivityStatus: true, showInstitution: true }),
    });
  });

  test('3. Privacy Settings: Invalid settings values are rejected with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        profileVisibility: 'invisible_to_everyone_invalid',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  test('4. Discoverability & Privacy: Private profile is excluded from matching and direct peer profile endpoint', async () => {
    // Set Bob's profile to private
    await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ profileVisibility: 'private' }),
    });

    // Alice searches for peers
    const searchRes = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const searchBody = await searchRes.json();
    const bobInSearch = searchBody.data?.find((p) => p.studentId === bobId);
    assert.strictEqual(bobInSearch, undefined, 'Bob should not appear in search when profile is private');

    // Alice directly accesses Bob's peer profile
    const directRes = await fetch(`${testApp.baseUrl}/api/matches/peers/${bobId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(directRes.status, 404, 'Private profile should return 404');

    // Restore Bob's profile to public
    await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ profileVisibility: 'public' }),
    });
  });

  test('5. Discoverability & Privacy: Rooms-only profile enforces shared topic room boundary', async () => {
    // Set Charlie's profile to rooms_only
    await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${charlieToken}` },
      body: JSON.stringify({ profileVisibility: 'rooms_only' }),
    });

    // Alice has NOT joined any shared room with Charlie -> should be 403 FORBIDDEN
    const outsiderRes = await fetch(`${testApp.baseUrl}/api/matches/peers/${charlieId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(outsiderRes.status, 403, 'Access to rooms-only profile without shared room must be 403');

    // Charlie joins the shared topic room
    await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${charlieToken}` },
    });

    // Now Alice and Charlie share a room -> Alice should now be permitted to view Charlie's peer profile
    const memberRes = await fetch(`${testApp.baseUrl}/api/matches/peers/${charlieId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(memberRes.status, 200, 'Access to rooms-only profile with shared room must be permitted');
  });

  test('6. Field Privacy: When institution or learning preferences are hidden, they are omitted in responses', async () => {
    // Bob hides his institution and activity status
    await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({
        showInstitution: false,
        showActivityStatus: false,
      }),
    });

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers/${bobId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.institution, null, 'Institution must be masked to null');
    assert.strictEqual(body.data.presenceStatus, 'offline', 'Activity status must be masked to offline');

    // Restore
    await fetch(`${testApp.baseUrl}/api/safety/privacy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ showInstitution: true, showActivityStatus: true }),
    });
  });

  test('7. Blocking: Authenticated learner can block another user and view blocked list', async () => {
    // Alice blocks Charlie
    const blockRes = await fetch(`${testApp.baseUrl}/api/safety/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ userId: charlieId }),
    });

    assert.strictEqual(blockRes.status, 200);
    const blockBody = await blockRes.json();
    assert.strictEqual(blockBody.success, true);
    assert.strictEqual(blockBody.data.isBlocked, true);

    // Verify blocked list
    const listRes = await fetch(`${testApp.baseUrl}/api/safety/blocks`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.data.some((b) => b.blocked_id === charlieId));

    // Blocking self returns 400
    const selfBlockRes = await fetch(`${testApp.baseUrl}/api/safety/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ userId: aliceId }),
    });
    assert.strictEqual(selfBlockRes.status, 400);
  });

  test('8. Blocking Policy: Two-way recommendation exclusion and study invitation prevention', async () => {
    // Charlie attempts to send a study invite to Alice (who blocked him)
    const inviteRes = await fetch(`${testApp.baseUrl}/api/safety/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${charlieToken}` },
      body: JSON.stringify({
        receiverId: aliceId,
        topic: 'Relational Algebra & SQL Joins',
        message: 'Can we study together?',
      }),
    });
    assert.strictEqual(inviteRes.status, 403, 'Blocked user cannot send study invites');

    // Alice searches for peers: Charlie must NOT be returned
    const aliceSearch = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const aliceSearchData = await aliceSearch.json();
    assert.strictEqual(aliceSearchData.data?.find((p) => p.studentId === charlieId), undefined);

    // Charlie searches for peers: Alice must NOT be returned (two-way exclusion)
    const charlieSearch = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    const charlieSearchData = await charlieSearch.json();
    assert.strictEqual(charlieSearchData.data?.find((p) => p.studentId === aliceId), undefined);
  });

  test('9. Blocking in Shared Rooms: Preserves membership but masks questions and replies', async () => {
    // Charlie posts a question in the shared room
    const questionRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${charlieToken}` },
      body: JSON.stringify({
        question_content: 'How do outer joins work in SQLite?',
        topic: 'Relational Algebra & SQL Joins',
      }),
    });
    assert.strictEqual(questionRes.status, 201);

    // Alice views the shared room (Alice has Charlie blocked)
    const roomRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(roomRes.status, 200);
    const roomData = await roomRes.json();

    const charlieQuestion = roomData.data.questions?.find((q) => q.asker_id === charlieId);
    assert.ok(charlieQuestion, 'Question record should exist');
    assert.strictEqual(charlieQuestion.isBlocked, true, 'isBlocked must be true for blocked asker');
    assert.strictEqual(charlieQuestion.question, '[Question from blocked user hidden]');

    // Bob views the room (Bob has NOT blocked Charlie) -> Bob sees the real content
    const bobRoomRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobRoomData = await bobRoomRes.json();
    const bobQuestionView = bobRoomData.data.questions?.find((q) => q.asker_id === charlieId);
    assert.strictEqual(bobQuestionView.isBlocked, false);
    assert.strictEqual(bobQuestionView.question, 'How do outer joins work in SQLite?');

    // Unblock Charlie
    const unblockRes = await fetch(`${testApp.baseUrl}/api/safety/blocks/${charlieId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(unblockRes.status, 200);
  });

  test('10. Reporting: Report submission records category, description, and status with duplicate protection', async () => {
    // Alice reports Charlie for suspicious behavior
    const repRes = await fetch(`${testApp.baseUrl}/api/safety/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        reportedUserId: charlieId,
        category: 'suspicious_behavior',
        description: 'Repeatedly pasting suspicious external links into study chat.',
      }),
    });

    assert.strictEqual(repRes.status, 201);
    const repBody = await repRes.json();
    assert.strictEqual(repBody.success, true);
    assert.strictEqual(repBody.data.status, 'pending');
    assert.strictEqual(repBody.data.category, 'suspicious_behavior');

    // Duplicate submission protection: Attempting to submit another report for same target while pending returns 409
    const dupRes = await fetch(`${testApp.baseUrl}/api/safety/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        reportedUserId: charlieId,
        category: 'spam',
        description: 'Duplicate attempt',
      }),
    });
    assert.strictEqual(dupRes.status, 409);
    const dupBody = await dupRes.json();
    assert.strictEqual(dupBody.error.code, 'DUPLICATE_REPORT');
  });

  test('11. Moderation Workflow: Non-moderator cannot view or review reports (403 FORBIDDEN)', async () => {
    // Regular student Alice tries to view moderation reports
    const studentRes = await fetch(`${testApp.baseUrl}/api/safety/moderation/reports`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(studentRes.status, 403, 'Ordinary student must receive 403 FORBIDDEN');
    const studentBody = await studentRes.json();
    assert.strictEqual(studentBody.error.code, 'FORBIDDEN');
  });

  test('12. Moderation Workflow: Authorized moderator can view reports and take actions', async () => {
    // Moderator views pending reports
    const modRes = await fetch(`${testApp.baseUrl}/api/safety/moderation/reports?status=pending`, {
      headers: { Authorization: `Bearer ${moderatorToken}` },
    });
    assert.strictEqual(modRes.status, 200);
    const modData = await modRes.json();
    assert.ok(Array.isArray(modData.data));
    const targetReport = modData.data.find((r) => r.reported_user_id === charlieId);
    assert.ok(targetReport, 'Target report should be present in moderator queue');

    // Moderator reviews the report
    const actionRes = await fetch(`${testApp.baseUrl}/api/safety/moderation/reports/${targetReport.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${moderatorToken}` },
      body: JSON.stringify({
        status: 'resolved',
        actionTaken: 'User warned for link sharing',
        moderatorNotes: 'Reviewed link logs and issued standard reminder of community guidelines.',
      }),
    });
    assert.strictEqual(actionRes.status, 200);
    const actionData = await actionRes.json();
    assert.strictEqual(actionData.data.status, 'resolved');
    assert.strictEqual(actionData.data.action_taken, 'User warned for link sharing');
  });

  test('13. Content Safeguards: Rejects unsafe URLs and strips script injection tags', async () => {
    // Attempt to share an unsafe javascript: URL in resources
    const badUrlRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        title: 'Exploit Notes',
        url: 'javascript:alert(document.cookie)',
      }),
    });
    assert.strictEqual(badUrlRes.status, 400);

    // Share resource with safe https: URL
    const goodUrlRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        title: 'PostgreSQL Joins Cheat Sheet',
        url: 'https://www.postgresql.org/docs/current/queries-table-expressions.html',
      }),
    });
    assert.strictEqual(goodUrlRes.status, 201);

    // Question content sanitization: <script> tags stripped
    const xssQuestionRes = await fetch(`${testApp.baseUrl}/api/rooms/${sharedRoomId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        question_content: 'How do indexing structures work? <script>alert("xss")</script>',
        topic: 'Database Systems',
      }),
    });
    assert.strictEqual(xssQuestionRes.status, 201);
    const xssData = await xssQuestionRes.json();
    assert.ok(!xssData.data.question.includes('<script>'), 'Script tags must be stripped');
    assert.ok(xssData.data.question.includes('How do indexing structures work?'));
  });

  test('14. Data Minimization: Learner can clear all optional learning preferences', async () => {
    const clearRes = await fetch(`${testApp.baseUrl}/api/profile/preferences`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    assert.strictEqual(clearRes.status, 200);
    const clearData = await clearRes.json();
    assert.strictEqual(clearData.success, true);
    assert.strictEqual(clearData.data.cleared, true);

    // Verify preferences in database are now 0 for Alice
    const countRow = db.prepare('SELECT count(*) as count FROM user_learning_preferences WHERE user_id = ?').get(aliceId);
    assert.strictEqual(countRow.count, 0);
  });

  test('15. Account Deactivation: Password check, soft-deactivation, and session revocation', async () => {
    // 1. Wrong password returns 401
    const badPwRes = await fetch(`${testApp.baseUrl}/api/account/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({
        password: 'WrongPassword!',
        confirmation: 'CONFIRM',
      }),
    });
    assert.strictEqual(badPwRes.status, 401);

    // 2. Correct password and confirmation successfully deactivates account
    const deactRes = await fetch(`${testApp.baseUrl}/api/account/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({
        password: 'Password123!',
        confirmation: 'CONFIRM',
      }),
    });
    assert.strictEqual(deactRes.status, 200);
    const deactData = await deactRes.json();
    assert.strictEqual(deactData.data.is_active, 0);

    // 3. User Bob can no longer authenticate with prior token
    const postDeactRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert.strictEqual(postDeactRes.status, 401, 'Deactivated account token must be revoked');

    // 4. Bob cannot be found in peer matching
    const searchRes = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=${encodeURIComponent('Relational Algebra & SQL Joins')}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const searchBody = await searchRes.json();
    assert.strictEqual(searchBody.data?.find((p) => p.studentId === bobId), undefined);
  });
});
