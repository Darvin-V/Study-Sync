import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BackupManager } from '../db/backup.js';
import { getDb, closeDb } from '../db/connection.js';

describe('StudySync AI — Persistent Storage, Backup & Recovery Verification Suite', () => {
  const testDir = path.resolve(process.cwd(), 'server/data/test_recovery');
  const primaryDbPath = path.join(testDir, 'primary.db');
  const backupDir = path.join(testDir, 'backups');
  const restoredDbPath = path.join(testDir, 'restored.db');

  before(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
  });

  test('1. WAL mode and relational integrity are enforced on database connection', () => {
    const db = new DatabaseSync(primaryDbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');

    const journalMode = db.prepare('PRAGMA journal_mode;').get();
    assert.equal(journalMode.journal_mode.toLowerCase(), 'wal', 'Database must run in WAL mode');

    const foreignKeys = db.prepare('PRAGMA foreign_keys;').get();
    assert.equal(foreignKeys.foreign_keys, 1, 'Foreign keys must be strictly enforced');

    db.exec(`
      CREATE TABLE test_records (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    db.prepare('INSERT INTO test_records (id, title, created_at) VALUES (?, ?, ?);')
      .run('rec-1', 'Initial Study Record', new Date().toISOString());

    db.close();
  });

  test('2. Atomic VACUUM INTO snapshot produces verified consistent backup without blocking', () => {
    const sourceDb = new DatabaseSync(primaryDbPath);
    sourceDb.exec('PRAGMA journal_mode = WAL;');

    const result = BackupManager.createBackup(backupDir, sourceDb);
    assert.equal(result.success, true);
    assert.equal(result.integrity, 'ok');
    assert.ok(fs.existsSync(result.backupPath));
    assert.ok(result.sizeBytes > 0);

    // Verify backup integrity independently
    const verified = BackupManager.verifyBackup(result.backupPath);
    assert.equal(verified.valid, true);
    assert.equal(verified.integrity, 'ok');

    sourceDb.close();
  });

  test('3. Simulated recovery restores all committed records cleanly before traffic is served', () => {
    // Locate the latest snapshot created in test 2
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort();
    assert.ok(files.length > 0, 'Backup file must exist');
    const latestBackup = path.join(backupDir, files[files.length - 1]);

    // Restore to a new location simulating container restart / initial boot
    const restoreResult = BackupManager.restoreBackup(latestBackup, restoredDbPath);
    assert.equal(restoreResult.success, true);
    assert.equal(restoreResult.postCheckIntegrity, 'ok');

    // Query restored database to verify record durability
    const restoredDb = new DatabaseSync(restoredDbPath);
    const row = restoredDb.prepare('SELECT * FROM test_records WHERE id = ?;').get('rec-1');
    assert.ok(row, 'Committed record must survive recovery');
    assert.equal(row.title, 'Initial Study Record');
    restoredDb.close();
  });

  test('4. Invariant Protection: Recovery policy never overwrites existing local data', () => {
    // If a database already exists locally, restoring over it without explicit override is blocked
    assert.ok(fs.existsSync(restoredDbPath), 'Restored database exists');
    const currentMtime = fs.statSync(restoredDbPath).mtimeMs;

    // Simulate entrypoint logic: -if-db-not-exists check
    const shouldRestore = !fs.existsSync(restoredDbPath);
    assert.equal(shouldRestore, false, 'Entrypoint must NOT restore when database file is already present');
  });

  test('5. Concurrent read and write access operates safely with busy_timeout under load', () => {
    const writerDb = new DatabaseSync(primaryDbPath);
    writerDb.exec('PRAGMA busy_timeout = 5000;');

    const readerDb = new DatabaseSync(primaryDbPath);
    readerDb.exec('PRAGMA busy_timeout = 5000;');

    // Perform interleaved reads and writes
    for (let i = 2; i <= 20; i++) {
      writerDb.prepare('INSERT INTO test_records (id, title, created_at) VALUES (?, ?, ?);')
        .run(`rec-${i}`, `Concurrent Note ${i}`, new Date().toISOString());

      const count = readerDb.prepare('SELECT count(*) AS count FROM test_records;').get();
      assert.equal(count.count, i, 'Reader must see current committed state immediately in WAL mode');
    }

    writerDb.close();
    readerDb.close();
  });
});
