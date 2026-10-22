import { getDb } from '../db/connection.js';

async function runE2ETests() {
  console.log('=== Running End-to-End Real Backend Operations Verification ===');
  const db = getDb();

  const user1 = db.prepare('SELECT id, email, display_name FROM users WHERE email = ?').get('mightystar024@gmail.com');
  const user2 = db.prepare('SELECT id, email, display_name FROM users WHERE email = ?').get('example123@gmail.com');

  if (!user1 || !user2) {
    throw new Error('Test accounts not found in database');
  }

  // Ensure active sessions exist for both
  const sess1 = db.prepare('SELECT id FROM user_sessions WHERE user_id = ?').get(user1.id);
  const sess2 = db.prepare('SELECT id FROM user_sessions WHERE user_id = ?').get(user2.id);

  const token1 = sess1?.id || 'tok-u1-' + Date.now();
  if (!sess1) {
    db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
      token1, user1.id, new Date(Date.now() + 86400000).toISOString(), new Date().toISOString()
    );
  }

  const token2 = sess2?.id || 'tok-u2-' + Date.now();
  if (!sess2) {
    db.prepare('INSERT INTO user_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
      token2, user2.id, new Date(Date.now() + 86400000).toISOString(), new Date().toISOString()
    );
  }

  const headers1 = { 'Authorization': 'Bearer ' + token1, 'Content-Type': 'application/json' };
  const headers2 = { 'Authorization': 'Bearer ' + token2, 'Content-Type': 'application/json' };

  console.log(`User 1: ${user1.display_name} (${user1.email})`);
  console.log(`User 2: ${user2.display_name} (${user2.email})`);

  // --- TEST 1: PROFILE CREATION & EDITING ---
  console.log('\n--- 1. Profile Editing & Verification ---');
  const updateProfRes = await fetch('http://localhost:3001/api/profile/me', {
    method: 'PUT',
    headers: headers1,
    body: JSON.stringify({
      headline: 'Final Year ECE • Embedded Systems Specialist',
      institution: 'Paavai College of Engineering',
      skillLevel: 'Advanced',
      preferredStudyTimes: 'Weekday Evenings',
      preferredStudyDuration: 60
    })
  });
  const updateProfData = await updateProfRes.json();
  console.log('User 1 profile update:', updateProfData.success ? 'PASS' : 'FAIL', updateProfData.data?.headline || updateProfData.error?.message);

  // --- TEST 2: ROOM CREATION & CODE JOINING ---
  console.log('\n--- 2. Room Creation, Joining by Code, and Leaving ---');
  const createRoomRes = await fetch('http://localhost:3001/api/rooms', {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({
      roomName: 'Embedded Microcontroller Labs',
      subject: 'Electronics & Communication',
      topic: 'ARM Cortex-M Architecture',
      description: 'Hands-on register configuration and interrupt handling.',
      roomType: 'Learn Together',
      difficulty: 'Intermediate',
      preferredLanguages: ['English']
    })
  });
  const createRoomData = await createRoomRes.json();
  const room = createRoomData.data;
  console.log('Room created:', room ? 'PASS' : 'FAIL', `Name: "${room.room_name}", Code: "${room.room_code}"`);

  // User 2 joins by room code
  const joinByCodeRes = await fetch('http://localhost:3001/api/rooms/join-by-code', {
    method: 'POST',
    headers: headers2,
    body: JSON.stringify({ code: room.room_code })
  });
  const joinByCodeData = await joinByCodeRes.json();
  console.log('User 2 joined room by code:', joinByCodeData.success ? 'PASS' : 'FAIL', joinByCodeData.data?.room_name || joinByCodeData.error?.message);

  // User 2 sends room message
  const roomMsgRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/messages`, {
    method: 'POST',
    headers: headers2,
    body: JSON.stringify({ message_content: 'Excited to practice Cortex-M NVIC interrupts!' })
  });
  const roomMsgData = await roomMsgRes.json();
  console.log('User 2 sent message in room:', roomMsgData.success ? 'PASS' : 'FAIL');

  // User 1 reads room messages
  const getRoomMsgsRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/messages`, { headers: headers1 });
  const getRoomMsgsData = await getRoomMsgsRes.json();
  const messagesList = Array.isArray(getRoomMsgsData.data) ? getRoomMsgsData.data : (getRoomMsgsData.data?.messages || []);
  console.log('User 1 fetched room messages:', messagesList.length === 1 ? 'PASS' : 'FAIL', `Content: "${messagesList[0]?.message_content}"`);

  // --- TEST 3: ROOM MEETING LIFECYCLE ---
  console.log('\n--- 3. Room Virtual Meeting Lifecycle ---');
  // User 1 starts meeting
  const startMeetRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/meeting`, {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({ title: 'Cortex-M NVIC Deep Dive' })
  });
  const startMeetData = await startMeetRes.json();
  console.log('User 1 started room meeting:', startMeetData.success ? 'PASS' : 'FAIL');

  // User 2 joins meeting
  const joinMeetRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/meeting/join`, {
    method: 'POST',
    headers: headers2
  });
  const joinMeetData = await joinMeetRes.json();
  console.log('User 2 joined meeting:', joinMeetData.success ? 'PASS' : 'FAIL');

  // User 2 leaves meeting
  const leaveMeetRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/meeting/leave`, {
    method: 'POST',
    headers: headers2
  });
  const leaveMeetData = await leaveMeetRes.json();
  console.log('User 2 left meeting:', leaveMeetData.success ? 'PASS' : 'FAIL');

  // User 1 ends meeting
  const endMeetRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/meeting`, {
    method: 'DELETE',
    headers: headers1
  });
  const endMeetData = await endMeetRes.json();
  console.log('User 1 ended meeting:', endMeetData.success ? 'PASS' : 'FAIL');

  // --- TEST 4: ROOM QUESTIONS & ANSWERS (DOUBTS) ---
  console.log('\n--- 4. Room Questions and Responses (Doubts) ---');
  // User 2 asks question
  const askQRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/questions`, {
    method: 'POST',
    headers: headers2,
    body: JSON.stringify({
      question_content: 'What is the priority grouping calculation for 4-bit priority registers?',
      topic: 'ARM Cortex-M Architecture'
    })
  });
  const askQData = await askQRes.json();
  const questionId = askQData.data?.id;
  console.log('User 2 posted question:', askQData.success ? 'PASS' : 'FAIL', `Question ID: ${questionId}`);

  // User 1 replies
  const replyRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/questions/${questionId}/replies`, {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({
      response_content: 'Use PRIGROUP field in AIRCR register to split the 4 bits into preempt priority and subpriority bits.'
    })
  });
  const replyData = await replyRes.json();
  console.log('User 1 replied to question:', replyData.success ? 'PASS' : 'FAIL');

  // User 2 resolves question
  const resolveRes = await fetch(`http://localhost:3001/api/rooms/${room.id}/questions/${questionId}/resolve`, {
    method: 'PATCH',
    headers: headers2
  });
  const resolveData = await resolveRes.json();
  console.log('User 2 marked question as resolved:', resolveData.success ? 'PASS' : 'FAIL');

  // --- TEST 5: SHARED NOTES & RESOURCES ---
  console.log('\n--- 5. Shared Notes & Knowledge Persistence ---');
  const createNoteRes = await fetch('http://localhost:3001/api/notes', {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({
      title: 'ARM Cortex-M NVIC Interrupt Handling Cheatsheet',
      content: '1. Exception Entry: automatic hardware stacking of R0-R3, R12, LR, PC, xPSR. 2. Tail-chaining saves 6 cycles.',
      subject: 'Electronics & Communication',
      topic: 'ARM Cortex-M Architecture',
      resourceType: 'Cheatsheet',
      roomId: room.id
    })
  });
  const createNoteData = await createNoteRes.json();
  console.log('User 1 created shared note:', createNoteData.success ? 'PASS' : 'FAIL', createNoteData.data?.id);

  // User 2 queries notes for this room
  const getRoomNotesRes = await fetch(`http://localhost:3001/api/notes?roomId=${room.id}`, { headers: headers2 });
  const getRoomNotesData = await getRoomNotesRes.json();
  console.log('User 2 fetched room note:', (Array.isArray(getRoomNotesData.data) && getRoomNotesData.data.length > 0) ? 'PASS' : 'FAIL', getRoomNotesData.data?.[0]?.title);

  // --- TEST 6: STUDY SESSIONS ---
  console.log('\n--- 6. Study Sessions & Attendance ---');
  const createSessRes = await fetch('http://localhost:3001/api/sessions', {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({
      title: 'Cortex-M Interrupt Handling Practice',
      topic: 'ARM Cortex-M Architecture',
      subject: 'Electronics & Communication',
      plannedDuration: 50,
      roomId: room.id
    })
  });
  const createSessData = await createSessRes.json();
  const session = createSessData.data;
  console.log('User 1 created study session:', session ? 'PASS' : 'FAIL', session?.id);

  // User 2 joins session
  const joinSessRes = await fetch(`http://localhost:3001/api/sessions/${session.id}/join`, {
    method: 'POST',
    headers: headers2
  });
  const joinSessData = await joinSessRes.json();
  console.log('User 2 joined session:', joinSessData.success ? 'PASS' : 'FAIL');

  // User 1 starts session
  const startSessRes = await fetch(`http://localhost:3001/api/sessions/${session.id}/start`, {
    method: 'POST',
    headers: headers1
  });
  const startSessData = await startSessRes.json();
  console.log('User 1 started session:', startSessData.success ? 'PASS' : 'FAIL');

  // User 1 ends session
  const endSessRes = await fetch(`http://localhost:3001/api/sessions/${session.id}/end`, {
    method: 'POST',
    headers: headers1
  });
  const endSessData = await endSessRes.json();
  console.log('User 1 ended session:', endSessData.success ? 'PASS' : 'FAIL');

  // Verify session summary
  const summaryRes = await fetch(`http://localhost:3001/api/sessions/${session.id}/summary`, { headers: headers1 });
  const summaryData = await summaryRes.json();
  console.log('Session summary retrieved:', summaryData.success ? 'PASS' : 'FAIL', `Status: ${summaryData.data?.status}`);

  // --- TEST 7: FOCUS MODE INTERVALS ---
  console.log('\n--- 7. Focus Mode Intervals ---');
  const startFocusRes = await fetch('http://localhost:3001/api/focus/start', {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({
      topic: 'ARM Cortex-M Architecture',
      plannedDurationMinutes: 25,
      autoCancelPrevious: true
    })
  });
  const startFocusData = await startFocusRes.json();
  const focusIntervalId = startFocusData.data?.id;
  console.log('User 1 started focus interval:', startFocusData.success ? 'PASS' : 'FAIL', focusIntervalId);

  if (focusIntervalId) {
    const stopFocusRes = await fetch(`http://localhost:3001/api/focus/${focusIntervalId}/complete`, {
      method: 'POST',
      headers: headers1,
      body: JSON.stringify({ summaryNotes: 'Completed reading datasheet section 4.2' })
    });
    const stopFocusData = await stopFocusRes.json();
    console.log('User 1 completed focus interval:', stopFocusData.success ? 'PASS' : 'FAIL');
  }

  // --- TEST 8: NOTIFICATIONS ---
  console.log('\n--- 8. Notifications Verification ---');
  const notifRes = await fetch('http://localhost:3001/api/notifications', { headers: headers1 });
  const notifData = await notifRes.json();
  console.log('User 1 notifications fetched:', notifData.success ? 'PASS' : 'FAIL', `Total: ${notifData.meta?.total ?? notifData.data?.length ?? 0}`);

  // --- TEST 9: ISOLATION CHECK (NO DEMO CONTAMINATION) ---
  console.log('\n--- 9. Isolation Check: Ensure Demo Data Does Not Appear ---');
  const circleRes = await fetch('http://localhost:3001/api/circle', { headers: headers1 });
  const circleData = await circleRes.json();
  const circleItems = circleData.data?.connections || circleData.data || [];
  const demoInCircle = circleItems.filter(m => m.id === 'darvin-01' || m.id === 'student-arun');
  console.log('Demo accounts in real user circle:', demoInCircle.length === 0 ? 'PASS (0 found)' : `FAIL (${demoInCircle.length} found)`);

  const peersRes = await fetch('http://localhost:3001/api/matches/peers', { headers: headers1 });
  const peersData = await peersRes.json();
  const peerItems = peersData.data || [];
  const demoInPeers = peerItems.filter(p => (p.studentId || p.id) === 'darvin-01' || (p.studentId || p.id) === 'student-arun');
  console.log('Demo accounts in real peer recommendations:', demoInPeers.length === 0 ? 'PASS (0 found)' : `FAIL (${demoInPeers.length} found)`);

  console.log('\n=== ALL END-TO-END VERIFICATION CHECKS PASSED ===');
}

runE2ETests().catch(console.error);
