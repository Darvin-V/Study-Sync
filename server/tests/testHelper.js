import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { closeDb } from '../db/connection.js';

/**
 * Test Server Helper
 * Starts the Express app on an ephemeral port (port 0) for testing.
 */
export async function startTestServer() {
  process.env.NODE_ENV = 'test';
  // Ensure migrations and seed are ready
  runMigrations();
  seedDatabase();

  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;
      resolve({
        server,
        baseUrl,
        close: () =>
          new Promise((done) => {
            server.close(() => {
              closeDb();
              done();
            });
          }),
      });
    });
    server.on('error', reject);
  });
}
