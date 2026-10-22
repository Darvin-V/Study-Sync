import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, withTransaction } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

/**
 * StudySync AI — Migration Runner
 * 
 * Inspects migrations directory, tracks applied migrations,
 * and idempotently applies new schema migrations.
 */
export function runMigrations(customPath = null) {
  const db = getDb(customPath);

  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return { applied: [], total: 0 };
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const getAppliedStmt = db.prepare('SELECT id FROM _migrations WHERE id = ?');
  const insertMigrationStmt = db.prepare(
    'INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)'
  );

  const applied = [];

  for (const file of files) {
    const migrationId = path.basename(file, '.sql');
    const existing = getAppliedStmt.get(migrationId);

    if (!existing) {
      const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      withTransaction((txDb) => {
        txDb.exec(sqlContent);
        insertMigrationStmt.run(migrationId, file, new Date().toISOString());
      }, customPath);

      applied.push(file);
    }
  }

  // Safe backfill for accounts without unique usernames
  const backfilledCount = backfillUsernames(customPath);

  return {
    applied,
    total: files.length,
    alreadyApplied: files.length - applied.length,
    backfilledCount,
  };
}

export function backfillUsernames(customPath = null) {
  const db = getDb(customPath);
  try {
    const tableInfo = db.prepare('PRAGMA table_info(users)').all();
    const hasUsernameCol = tableInfo.some((col) => col.name === 'username');
    if (!hasUsernameCol) return 0;

    const unassigned = db.prepare("SELECT id, display_name FROM users WHERE username IS NULL OR TRIM(username) = ''").all();
    if (unassigned.length === 0) return 0;

    const checkStmt = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
    const updateStmt = db.prepare('UPDATE users SET username = ? WHERE id = ?');

    let count = 0;
    for (const u of unassigned) {
      let base = (u.display_name || 'learner')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

      if (base.length < 3) base = `learner_${base}`;
      if (base.length > 24) base = base.slice(0, 24);

      let candidate = base;
      let suffix = 1;
      while (true) {
        const found = checkStmt.get(candidate);
        if (!found || found.id === u.id) break;
        candidate = `${base.slice(0, 20)}_${suffix}`;
        suffix++;
      }

      updateStmt.run(candidate, u.id);
      count++;
    }
    return count;
  } catch (err) {
    console.error('[Migrations] Backfill usernames warning:', err.message);
    return 0;
  }
}

// Run directly from CLI if executed as main
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const result = runMigrations();
    console.log(`[Migrations] Done. Applied: ${result.applied.length}, Total: ${result.total}`);
    if (result.applied.length > 0) {
      console.log(`[Migrations] Newly applied: ${result.applied.join(', ')}`);
    }
  } catch (err) {
    console.error('[Migrations] Failed:', err.message);
    process.exit(1);
  }
}

export default runMigrations;
