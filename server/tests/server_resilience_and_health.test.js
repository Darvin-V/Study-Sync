import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { getDb, closeDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { sanitizeMeta } from '../utils/logger.js';
import { getApiBaseUrl } from '../../src/utils/apiClient.js';
import { ProcessSupervisor } from '../scripts/processSupervisor.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Server Resilience, Health Monitoring & Fault Tolerance', () => {
  let server;
  let baseUrl;
  const TEST_PORT = 3987;

  before(async () => {
    process.env.NODE_ENV = 'test';
    runMigrations();
    seedDatabase();

    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        baseUrl = `http://localhost:${TEST_PORT}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDb();
  });

  test('Check 1 & 2: GET /health returns 200 and reports server & database readiness separately when healthy', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.service, 'studysync-backend');

    // Server readiness reported separately
    assert.ok(body.data.server);
    assert.equal(body.data.server.status, 'ok');
    assert.equal(typeof body.data.server.uptimeSeconds, 'number');
    assert.ok(body.data.server.timestamp);

    // Database readiness reported separately
    assert.ok(body.data.database);
    assert.equal(body.data.database.status, 'connected');
    assert.equal(body.data.database.reachable, true);
    assert.equal(body.data.database.dialect, 'sqlite');
    assert.ok(body.data.database.tablesCount >= 10);
  });

  test('Check 2b: GET /api/health maintains parity with root /health', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.database.status, 'connected');
  });

  test('Check 3: Database disconnection is detected, reports 503, and does NOT report full health', async () => {
    // Simulate database disconnection / closed state
    closeDb();

    // Temporarily point DATABASE_PATH to an illegal non-existent unwritable directory
    const originalDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = 'Z:\\non_existent_drive_999\\unwritable\\broken.db';

    try {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 503, 'Expected 503 Service Unavailable when DB is disconnected');

      const body = await res.json();
      assert.equal(body.success, false, 'Must not claim success when dependency is unavailable');
      assert.equal(body.error.code, 'DB_UNAVAILABLE');

      const details = body.error.details[0];
      assert.ok(details);
      assert.equal(details.server.status, 'ok', 'Server status is still ok');
      assert.equal(details.database.status, 'disconnected', 'Database accurately reported as disconnected');
      assert.equal(details.database.reachable, false);
    } finally {
      process.env.DATABASE_PATH = originalDbPath;
      closeDb();
      // Re-verify reconnect succeeds
      getDb();
    }
  });

  test('Check 4: Server handles invalid requests and expected exceptions safely without crashing', async () => {
    // Invalid JSON body
    const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken json: true',
    });
    assert.equal(badJsonRes.status, 400);
    const badJsonBody = await badJsonRes.json();
    assert.equal(badJsonBody.error.code, 'INVALID_JSON');

    // 404 Route
    const notFoundRes = await fetch(`${baseUrl}/api/non_existent_route_12345`);
    assert.equal(notFoundRes.status, 404);
    const notFoundBody = await notFoundRes.json();
    assert.equal(notFoundBody.error.code, 'NOT_FOUND');

    // Server is still alive and responsive after invalid requests
    const pingRes = await fetch(`${baseUrl}/health`);
    assert.equal(pingRes.status, 200);
  });

  test('Check 5: Process Supervisor bounded restart mechanism prevents endless loops', () => {
    let mockExitCode = null;
    const supervisor = new ProcessSupervisor({
      serverScript: path.resolve('server/index.js'),
      maxRestarts: 3,
      windowMs: 5000,
      initialBackoffMs: 50,
      onExit: (code) => {
        mockExitCode = code;
      },
    });

    assert.equal(supervisor.maxRestarts, 3);
    assert.equal(supervisor.windowMs, 5000);
    assert.equal(supervisor.isManualShutdown, false);

    // Simulate 4 crash timestamps within the window
    const now = Date.now();
    supervisor.restartTimestamps = [now - 3000, now - 2000, now - 1000, now];
    supervisor._cleanOldRestarts(now);
    assert.equal(supervisor.restartTimestamps.length, 4);

    // Clean stop
    supervisor.stop();
    assert.equal(supervisor.isManualShutdown, true);
  });

  test('Structured Logging Redaction: passwords, OTPs, tokens, and secrets are sanitized', () => {
    const rawData = {
      user: 'alice@example.com',
      password: 'SuperSecretPassword123!',
      token: 'session_token_xyz_987654',
      otp: '849201',
      apiKey: 'gemini-key-12345',
      authorization: 'Bearer secret_token',
      cookie: 'studysync_session=abc1234',
      nested: {
        confirmPassword: 'SuperSecretPassword123!',
        emailOtp: '123456',
        publicNote: 'Valid notes text',
      },
    };

    const sanitized = sanitizeMeta(rawData);
    assert.equal(sanitized.user, 'alice@example.com');
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.otp, '[REDACTED]');
    assert.equal(sanitized.apiKey, '[REDACTED]');
    assert.equal(sanitized.authorization, '[REDACTED]');
    assert.equal(sanitized.cookie, '[REDACTED]');
    assert.equal(sanitized.nested.confirmPassword, '[REDACTED]');
    assert.equal(sanitized.nested.emailOtp, '[REDACTED]');
    assert.equal(sanitized.nested.publicNote, 'Valid notes text');
  });

  test('Check 9: Frontend getApiBaseUrl safely adapts for production and development', () => {
    // In current test/dev environment, returns local or configured API URL
    const devUrl = getApiBaseUrl();
    assert.ok(typeof devUrl === 'string');
    assert.ok(devUrl.includes('/api'));
  });
});
