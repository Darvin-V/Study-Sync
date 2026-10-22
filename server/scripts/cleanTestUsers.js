import { getDb } from '../db/connection.js';

const db = getDb();

const testUserIds = db.prepare(`
  SELECT id FROM users 
  WHERE (
    email LIKE '%.test.%'
    OR email LIKE '%@example.%'
    OR email LIKE '%@test.%'
    OR email LIKE '%@university.edu'
    OR email LIKE '%@domain.edu'
    OR email LIKE '%@test.studysync.ai'
    OR email LIKE '%@test.p14.ai'
    OR id LIKE 'inc-%'
    OR id LIKE 'test-%'
    OR id LIKE 'peer-%'
  )
  AND email != 'mightystar024@gmail.com'
  AND id != 'darvin-01'
  AND id != 'student-arun'
`).all().map(u => u.id);

console.log('Found test users to clean:', testUserIds.length);

if (testUserIds.length > 0) {
  const placeholders = testUserIds.map(() => '?').join(',');

  // Delete rooms created by test users
  db.prepare(`DELETE FROM rooms WHERE creator_id IN (${placeholders})`).run(...testUserIds);
  // Delete sessions created by test users
  db.prepare(`DELETE FROM study_sessions WHERE creator_id IN (${placeholders})`).run(...testUserIds);
  // Delete notes authored by test users
  db.prepare(`DELETE FROM notes_resources WHERE author_id IN (${placeholders})`).run(...testUserIds);
  // Now delete test users
  const res = db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...testUserIds);
  console.log('Successfully cleaned users. Deleted:', res.changes);
}

const count = db.prepare('SELECT count(*) as total FROM users').get();
console.log('Remaining seeded users:', count.total);
