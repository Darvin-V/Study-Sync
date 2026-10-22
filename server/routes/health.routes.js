import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { formatSuccess, formatError } from '../schemas/index.js';

const router = Router();
const startTime = Date.now();

/**
 * Health check helper to probe database status
 */
function probeDatabase() {
  try {
    const db = getDb();
    const ping = db.prepare('SELECT 1 AS alive').get();
    if (!ping || ping.alive !== 1) {
      return { connected: false, error: 'Database ping returned unexpected response' };
    }

    let tablesCount = 0;
    let migrationsApplied = 0;

    try {
      const tables = db.prepare(`
        SELECT count(*) AS count 
        FROM sqlite_schema 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'
      `).get();
      tablesCount = tables.count;

      const mig = db.prepare('SELECT count(*) AS count FROM _migrations').get();
      migrationsApplied = mig.count;
    } catch {
      // Ignored if migrations/schema queries fail
    }

    return {
      connected: true,
      tablesCount,
      migrationsApplied,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message || 'Database connection unavailable',
    };
  }
}

/**
 * GET /health or GET /api/health
 * Comprehensive health probe reporting server status and database readiness separately.
 * Does NOT report full health (returns 503) when required database dependency is unavailable.
 */
router.get('/', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const dbHealth = probeDatabase();

  const serverStatus = {
    status: 'ok',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
  };

  const databaseStatus = dbHealth.connected
    ? {
        status: 'connected',
        reachable: true,
        dialect: 'sqlite',
        tablesCount: dbHealth.tablesCount,
        migrationsApplied: dbHealth.migrationsApplied,
      }
    : {
        status: 'disconnected',
        reachable: false,
        dialect: 'sqlite',
        error: dbHealth.error,
      };

  if (!dbHealth.connected) {
    return res.status(503).json(
      formatError('Backend service degraded: database dependency is unavailable', 'DB_UNAVAILABLE', [
        {
          server: serverStatus,
          database: databaseStatus,
        },
      ])
    );
  }

  return res.status(200).json(
    formatSuccess({
      status: 'ok',
      service: 'studysync-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      version: '0.1.0',
      server: serverStatus,
      database: databaseStatus,
    })
  );
});

/**
 * GET /health/db or GET /api/health/db
 * Dedicated database readiness and connectivity check
 */
router.get('/db', (req, res) => {
  const dbHealth = probeDatabase();

  if (!dbHealth.connected) {
    return res.status(503).json(
      formatError('Database connection unavailable', 'DB_CONNECTION_ERROR', [
        { error: dbHealth.error },
      ])
    );
  }

  return res.status(200).json(
    formatSuccess({
      status: 'ok',
      database: 'connected',
      dialect: 'sqlite',
      enforcesForeignKeys: true,
      tablesCount: dbHealth.tablesCount,
      migrationsApplied: dbHealth.migrationsApplied,
      timestamp: new Date().toISOString(),
    })
  );
});

export default router;
