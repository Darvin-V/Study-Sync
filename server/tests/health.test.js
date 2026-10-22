import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Health and Database Connectivity Endpoints', () => {
  let testApp;

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  test('GET /api/health returns 200 and healthy service payload', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.service, 'studysync-backend');
    assert.equal(typeof body.data.uptimeSeconds, 'number');
    assert.ok(body.data.timestamp);
  });

  test('GET /api/health/db returns 200 and active database connectivity', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/health/db`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.database, 'connected');
    assert.equal(body.data.dialect, 'sqlite');
    assert.equal(body.data.enforcesForeignKeys, true);
    assert.ok(body.data.tablesCount >= 10, 'Expected at least 10 database tables');
    assert.ok(body.data.migrationsApplied >= 1, 'Expected at least 1 migration applied');
  });

  test('GET /api returns 200 and metadata with available endpoints', async () => {
    const res = await fetch(`${testApp.baseUrl}/api`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'online');
    assert.ok(Array.isArray(body.data.endpoints));
    assert.ok(body.data.endpoints.includes('/api/health'));
    assert.ok(body.data.endpoints.includes('/api/topics'));
    assert.ok(body.data.endpoints.includes('/api/rooms'));
  });
});
