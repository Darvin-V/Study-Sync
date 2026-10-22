import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './testHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database Schema Constraints & Validation', () => {
  let inMemoryDb;
  let testApp;

  before(async () => {
    // 1. Setup isolated in-memory database with schema
    inMemoryDb = new DatabaseSync(':memory:');
    inMemoryDb.exec('PRAGMA foreign_keys = ON;');

    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../db/migrations/001_initial_schema.sql'),
      'utf8'
    );
    inMemoryDb.exec(migrationSql);

    // 2. Setup HTTP test server for input validation tests
    testApp = await startTestServer();
  });

  after(async () => {
    if (inMemoryDb) inMemoryDb.close();
    if (testApp) await testApp.close();
  });

  test('Foreign key enforcement: Cannot insert room with non-existent creator', () => {
    const insertRoom = inMemoryDb.prepare(`
      INSERT INTO rooms (id, room_name, subject, topic, room_type, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    assert.throws(
      () => {
        insertRoom.run(
          'test-room-1',
          'Ghost Room',
          'Test Subject',
          'Test Topic',
          'Revision',
          'non-existent-user-id',
          new Date().toISOString()
        );
      },
      /FOREIGN KEY constraint failed/i
    );
  });

  test('Unique constraint: Prevents duplicate membership for same user in same room', () => {
    // Insert valid user and room first
    inMemoryDb.prepare(`
      INSERT INTO users (id, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('user-alpha', 'Alpha Student', new Date().toISOString(), new Date().toISOString());

    inMemoryDb.prepare(`
      INSERT INTO rooms (id, room_name, subject, topic, room_type, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('room-alpha', 'Alpha Room', 'Math', 'Calculus', 'Learn Together', 'user-alpha', new Date().toISOString());

    const insertMembership = inMemoryDb.prepare(`
      INSERT INTO room_memberships (id, room_id, user_id, joined_at)
      VALUES (?, ?, ?, ?)
    `);

    // First membership succeeds
    insertMembership.run('mem-alpha-1', 'room-alpha', 'user-alpha', new Date().toISOString());

    // Duplicate membership must fail with UNIQUE constraint failure
    assert.throws(
      () => {
        insertMembership.run('mem-alpha-2', 'room-alpha', 'user-alpha', new Date().toISOString());
      },
      /UNIQUE constraint failed/i
    );
  });

  test('Foreign key cascade: Deleting a room automatically cascades and deletes related memberships', () => {
    // Check membership exists
    const memBefore = inMemoryDb.prepare('SELECT * FROM room_memberships WHERE room_id = ?').all('room-alpha');
    assert.equal(memBefore.length, 1);

    // Delete room
    inMemoryDb.prepare('DELETE FROM rooms WHERE id = ?').run('room-alpha');

    // Memberships must be cleanly deleted by cascade
    const memAfter = inMemoryDb.prepare('SELECT * FROM room_memberships WHERE room_id = ?').all('room-alpha');
    assert.equal(memAfter.length, 0);
  });

  test('Session participants schema distinguishes overall duration from individual participant duration', () => {
    // Insert session with planned duration 45 mins
    inMemoryDb.prepare(`
      INSERT INTO study_sessions (id, topic, creator_id, planned_duration, status, start_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('sess-01', 'Calculus Integration', 'user-alpha', 45, 'active', new Date().toISOString(), new Date().toISOString());

    // Insert participant with individual focus duration 25 mins
    inMemoryDb.prepare(`
      INSERT INTO session_participants (id, session_id, user_id, joined_at, individual_duration_minutes)
      VALUES (?, ?, ?, ?, ?)
    `).run('sp-01', 'sess-01', 'user-alpha', new Date().toISOString(), 25);

    const session = inMemoryDb.prepare('SELECT * FROM study_sessions WHERE id = ?').get('sess-01');
    const participant = inMemoryDb.prepare('SELECT * FROM session_participants WHERE id = ?').get('sp-01');

    assert.equal(session.planned_duration, 45);
    assert.equal(participant.individual_duration_minutes, 25);
    assert.notEqual(session.planned_duration, participant.individual_duration_minutes);
  });

  test('API validation error: Invalid query parameter returns 400 with VALIDATION_ERROR', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics?difficulty=ExpertUltra`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length > 0);
  });

  test('API 404 handling: Invalid route returns structured 404 NOT_FOUND response', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/non-existent-endpoint`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
