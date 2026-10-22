import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDb, closeDb } from './connection.js';
import config from '../config/env.js';

/**
 * StudySync AI — Consistent Online Database Backup & Recovery Utility (Phase 5)
 * 
 * Safe online backup for SQLite in WAL mode:
 * - Uses SQLite native `VACUUM INTO` to create 100% consistent point-in-time snapshots
 * - Flushes all active WAL pages into the snapshot without interrupting active readers/writers
 * - Performs PRAGMA integrity verification on the generated backup file
 * - Provides verified restore procedure with WAL cleanup
 */

export const BackupManager = {
  /**
   * Creates a consistent point-in-time snapshot of the active database.
   */
  createBackup(customOutputDir = null, customDb = null) {
    const db = customDb || getDb();
    const outputDir = path.resolve(
      process.cwd(),
      customOutputDir || path.join(path.dirname(config.databasePath), 'backups')
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `studysync_backup_${timestamp}.db`;
    const destinationPath = path.join(outputDir, filename);

    // Normalize path with forward slashes for SQLite string literal
    const sqliteSafePath = destinationPath.replace(/\\/g, '/');

    // Execute atomic VACUUM INTO
    db.exec(`VACUUM INTO '${sqliteSafePath}'`);

    if (!fs.existsSync(destinationPath)) {
      throw new Error(`Backup file was not created at: ${destinationPath}`);
    }

    const stats = fs.statSync(destinationPath);
    if (stats.size === 0) {
      throw new Error('Backup file was created but has 0 bytes size');
    }

    // Verify integrity of the newly created snapshot
    const verification = this.verifyBackup(destinationPath);

    return {
      success: true,
      backupPath: destinationPath,
      filename,
      sizeBytes: stats.size,
      timestamp: new Date().toISOString(),
      integrity: verification.integrity,
      tablesCount: verification.tablesCount,
      tableCount: verification.tablesCount,
      usersCount: verification.usersCount,
    };
  },

  /**
   * Verifies the structural integrity and schema completeness of a backup file.
   */
  verifyBackup(backupFilePath) {
    const resolvedPath = path.resolve(process.cwd(), backupFilePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Backup file does not exist: ${resolvedPath}`);
    }

    const backupDb = new DatabaseSync(resolvedPath);
    try {
      const integrityRow = backupDb.prepare('PRAGMA integrity_check').get();
      const integrity = integrityRow?.integrity_check || 'unknown';

      if (integrity !== 'ok') {
        throw new Error(`Backup integrity check failed: ${integrity}`);
      }

      const tablesRow = backupDb.prepare(`
        SELECT count(*) AS count 
        FROM sqlite_schema 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).get();

      let usersCount = 0;
      try {
        const uRow = backupDb.prepare('SELECT count(*) AS count FROM users').get();
        usersCount = uRow.count;
      } catch {
        // users table might not exist in blank db
      }

      return {
        valid: true,
        integrity,
        tablesCount: tablesRow.count,
        tableCount: tablesRow.count,
        usersCount,
      };
    } finally {
      backupDb.close();
    }
  },

  /**
   * Restores the database from a verified backup file.
   */
  restoreBackup(backupFilePath, targetDbPath = null) {
    const sourcePath = path.resolve(process.cwd(), backupFilePath);
    const targetPath = path.resolve(process.cwd(), targetDbPath || config.databasePath);

    // Step 1: Pre-flight verify source backup before touching active DB
    const verification = this.verifyBackup(sourcePath);
    if (!verification.valid || verification.integrity !== 'ok') {
      throw new Error(`Cannot restore: Backup failed integrity verification (${verification.integrity})`);
    }

    // Step 2: Close active database connections
    closeDb();

    // Step 3: Remove any existing WAL and SHM companion files at target location
    const walFile = `${targetPath}-wal`;
    const shmFile = `${targetPath}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

    // Step 4: Safely copy the verified backup into the target database path
    fs.copyFileSync(sourcePath, targetPath);

    // Step 5: Reconnect and verify target database
    const restoredDb = getDb(targetPath);
    const postCheck = restoredDb.prepare('PRAGMA integrity_check').get();

    return {
      success: true,
      restoredFrom: sourcePath,
      targetDbPath: targetPath,
      postCheckIntegrity: postCheck.integrity_check,
      tablesCount: verification.tablesCount,
      usersCount: verification.usersCount,
    };
  },
};

// CLI invocation support (e.g. node server/db/backup.js create)
if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
  const action = process.argv[2] || 'create';
  try {
    if (action === 'create') {
      const result = BackupManager.createBackup();
      console.log('[Backup] Snapshot created successfully:');
      console.log(`  File: ${result.filename}`);
      console.log(`  Size: ${(result.sizeBytes / 1024).toFixed(1)} KB`);
      console.log(`  Integrity: ${result.integrity}`);
      console.log(`  Tables: ${result.tablesCount}, Users: ${result.usersCount}`);
    } else if (action === 'verify') {
      const file = process.argv[3];
      if (!file) throw new Error('Specify file to verify: node backup.js verify <file>');
      const res = BackupManager.verifyBackup(file);
      console.log(`[Backup] Verified: integrity=${res.integrity}, tables=${res.tablesCount}`);
    } else if (action === 'restore') {
      const file = process.argv[3];
      if (!file) throw new Error('Specify file to restore: node backup.js restore <file>');
      const res = BackupManager.restoreBackup(file);
      console.log(`[Backup] Restored successfully: postCheck=${res.postCheckIntegrity}`);
    }
  } catch (err) {
    console.error('[Backup Error]:', err.message);
    process.exit(1);
  }
}

export default BackupManager;
