import { getDb } from '../db/connection.js';

async function verify() {
  console.log('--- Verifying Real Database Records ---');
  const db = getDb();
  
  const users = db.prepare('SELECT id, email, display_name, is_verified FROM users').all();
  console.log('Users in production DB:', users);

  const demoUsers = users.filter(u => u.email.includes('@demo.studysync.ai') || u.id === 'darvin-01' || u.id === 'student-arun');
  const realUsers = users.filter(u => !demoUsers.some(d => d.id === u.id));

  console.log(`Demo users (${demoUsers.length}):`, demoUsers.map(u => `${u.display_name} (${u.email})`));
  console.log(`Real users (${realUsers.length}):`, realUsers.map(u => `${u.display_name} (${u.email})`));

  // Check demo user count constraint: "Keep no more than two approved demo records or demo accounts"
  if (demoUsers.length > 2) {
    console.error('FAIL: More than 2 demo users found!');
  } else {
    console.log('PASS: Demo user count <= 2');
  }

  // Check demo user isolation
  // 1. Circle requests or circle memberships involving demo users and real users
  const crossCircle = db.prepare(`
    SELECT * FROM user_circle 
    WHERE (user_id IN ('darvin-01', 'student-arun') AND member_id NOT IN ('darvin-01', 'student-arun'))
       OR (member_id IN ('darvin-01', 'student-arun') AND user_id NOT IN ('darvin-01', 'student-arun'))
  `).all();
  console.log('Cross-circle connections with demo users:', crossCircle.length);
  if (crossCircle.length === 0) {
    console.log('PASS: Demo users have no circle ties to real users.');
  }

  // 2. Conversations between real and demo
  const crossConversations = db.prepare(`
    SELECT * FROM conversations
    WHERE (participant_one_id IN ('darvin-01', 'student-arun') AND participant_two_id NOT IN ('darvin-01', 'student-arun'))
       OR (participant_two_id IN ('darvin-01', 'student-arun') AND participant_one_id NOT IN ('darvin-01', 'student-arun'))
  `).all();
  console.log('Cross-conversations with demo users:', crossConversations.length);
  if (crossConversations.length === 0) {
    console.log('PASS: Demo users have no conversations with real users.');
  }

  // 3. Rooms
  const rooms = db.prepare('SELECT id, room_name, creator_id, status FROM rooms').all();
  console.log('Rooms in DB:', rooms);

  // 4. Notes
  const notes = db.prepare('SELECT id, title, author_id FROM notes_resources').all();
  console.log('Notes in DB:', notes);

  // 5. Sessions
  const sessions = db.prepare('SELECT id, topic, creator_id, status FROM study_sessions').all();
  console.log('Sessions in DB:', sessions);

  console.log('--- Verification Complete ---');
}

verify().catch(console.error);
