import config from './config/env.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { closeDb, getDb } from './db/connection.js';
import logger from './utils/logger.js';

/**
 * StudySync AI — Server Entry Point
 * 
 * Prepares database migrations/seed, initializes Express app,
 * and starts listening on the configured HTTP host and port with process resilience.
 */
let serverInstance = null;
let isShuttingDown = false;

export async function startServer() {
  try {
    logger.info('Initializing backend environment', {
      host: config.host,
      port: config.port,
      environment: config.nodeEnv,
      databasePath: config.databasePath,
    });
    console.log('[StudySync] Initializing backend environment...');
    console.log(`[StudySync] Database path: ${config.databasePath}`);

    // Ensure database schema is migrated safely
    let dbReady = false;
    try {
      const migrationResult = runMigrations();
      dbReady = true;
      logger.info('Database migrations verified', {
        total: migrationResult.total,
        applied: migrationResult.applied.length,
      });
      console.log(
        `[StudySync] Database migrations verified (${migrationResult.total} total, ${migrationResult.applied.length} newly applied)`
      );

      // Do not automatically create demo users whenever the server starts (enforce real database operations)
      if (process.env.AUTO_SEED === 'true' && !config.isProduction) {
        const db = getDb();
        const countRow = db.prepare('SELECT count(*) AS count FROM learning_topics').get();
        if (countRow.count === 0) {
          console.log('[StudySync] Explicit AUTO_SEED requested. Seeding initial development dataset...');
          seedDatabase();
          console.log('[StudySync] Initial development seed completed.');
        }
      }
    } catch (dbError) {
      logger.error('Database migration/initialization warning — server starting in degraded mode', {
        error: dbError.message,
      });
      console.error('[StudySync] Database initialization warning:', dbError.message);
      console.error('[StudySync] Server will start and report degraded status on /health until database is reachable.');
    }

    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      serverInstance = server;
      logger.startup({
        host: config.host,
        port: config.port,
        environment: config.nodeEnv,
        databaseReady: dbReady,
      });
      console.log('====================================================');
      console.log(`🚀 StudySync AI Backend running on http://${config.host}:${config.port}`);
      console.log(`   Health check:        http://localhost:${config.port}/health`);
      console.log(`   API Health check:    http://localhost:${config.port}/api/health`);
      console.log(`   DB connectivity:     http://localhost:${config.port}/api/health/db`);
      console.log(`   Syllabus Topics:     http://localhost:${config.port}/api/topics`);
      console.log(`   Development Rooms:   http://localhost:${config.port}/api/rooms`);
      console.log(`   CORS Origin allowed: ${config.corsOrigin}`);
      console.log('====================================================');
    });

    // Server network error handling (e.g. EADDRINUSE)
    server.on('error', (err) => {
      logger.error('Server listen error', {
        code: err.code,
        message: err.message,
        port: config.port,
        host: config.host,
      });
      if (err.code === 'EADDRINUSE') {
        console.error(`[StudySync] Port ${config.port} is already in use by another process.`);
        console.error(`[StudySync] Please terminate the conflicting process or set PORT=<available_port>.`);
      } else {
        console.error(`[StudySync] Server network error:`, err.message);
      }
      process.exit(1);
    });

    // Graceful Shutdown Handler
    const shutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n[StudySync] Received ${signal}. Shutting down gracefully...`);
      logger.shutdown({ signal });

      // Fallback timer to prevent hanging connections from blocking process exit
      const forceTimer = setTimeout(() => {
        logger.warn('Forced shutdown initiated after timeout');
        process.exit(1);
      }, 10000);
      forceTimer.unref();

      server.close(() => {
        try {
          closeDb();
          logger.info('Database connections closed cleanly');
        } catch (closeErr) {
          logger.warn('Error during database close', { error: closeErr.message });
        }
        console.log('[StudySync] Database connections closed. Process terminated cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Process-level uncaught exception & rejection handlers
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception occurred', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      console.error('[StudySync] Uncaught Exception:', err.message);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection occurred', {
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      console.error('[StudySync] Unhandled Promise Rejection:', reason instanceof Error ? reason.message : reason);
    });

    return server;
  } catch (error) {
    logger.error('Fatal server startup error', {
      name: error.name,
      message: error.message,
    });
    console.error('[StudySync] Fatal server startup error:', error);
    process.exit(1);
  }
}

// Start server if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer();
}

export default startServer;
