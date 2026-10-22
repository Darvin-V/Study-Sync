import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import config from '../config/env.js';

/**
 * StudySync AI — Database Connection Manager
 * 
 * Uses Node.js native DatabaseSync for zero-cost, serverless-file SQLite storage.
 * Enforces foreign key integrity and WAL mode for reliability and performance.
 */

let activeDb = null;
let activeDbPath = null;

export function getDb(customPath = null) {
  // If an active DatabaseSync instance was passed directly, return it
  if (customPath && typeof customPath === 'object' && typeof customPath.prepare === 'function') {
    return customPath;
  }

  const targetPath =
    customPath ||
    (process.env.DATABASE_PATH ? path.resolve(process.cwd(), process.env.DATABASE_PATH) : config.databasePath);

  // Return existing instance if target path matches
  if (activeDb && activeDbPath === targetPath) {
    return activeDb;
  }

  // If connected to a different DB path, close old connection
  if (activeDb) {
    closeDb();
  }

  // Ensure directory exists if not an in-memory database
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // Critical SQLite Pragmas: enforce relational integrity
  db.exec('PRAGMA foreign_keys = ON;');
  
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    // Set busy timeout to 5000ms so concurrent requests wait instead of failing immediately with SQLITE_BUSY
    db.exec('PRAGMA busy_timeout = 5000;');
  }

  activeDb = db;
  activeDbPath = targetPath;
  return activeDb;
}

export function closeDb() {
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      // Ignored if already closed
    }
    activeDb = null;
    activeDbPath = null;
  }
}

export function resetDbConnection() {
  closeDb();
}

/**
 * Actively checks database readiness and connectivity
 */
export function checkDbConnection(customPath = null) {
  try {
    const db = getDb(customPath);
    const ping = db.prepare('SELECT 1 AS alive').get();
    if (!ping || ping.alive !== 1) {
      return { ok: false, error: 'Database ping returned unexpected response' };
    }
    return { ok: true, dialect: 'sqlite' };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function withTransaction(callback, customPath = null) {
  const db = getDb(customPath);
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = callback(db);
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

export default {
  getDb,
  closeDb,
  resetDbConnection,
  checkDbConnection,
  withTransaction,
};
