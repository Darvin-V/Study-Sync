import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Topics API Endpoints', () => {
  let testApp;

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    if (testApp) await testApp.close();
  });

  test('GET /api/topics returns all curriculum topics', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 6);
    assert.ok(body.meta.total >= 6);

    const first = body.data[0];
    assert.ok(first.id);
    assert.ok(first.subject);
    assert.ok(first.topic_name);
  });

  test('GET /api/topics/subjects returns distinct subjects list', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics/subjects`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.includes('Database Systems'));
    assert.ok(body.data.includes('Algorithms & Complexity'));
    assert.ok(body.data.includes('Operating Systems'));
  });

  test('GET /api/topics?subject=Database+Systems filters by subject', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics?subject=Database+Systems`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    body.data.forEach((t) => {
      assert.equal(t.subject, 'Database Systems');
    });
  });

  test('GET /api/topics?difficulty=Advanced filters by difficulty', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics?difficulty=Advanced`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    body.data.forEach((t) => {
      assert.equal(t.difficulty_level.toLowerCase(), 'advanced');
    });
  });

  test('GET /api/topics/:id returns a specific topic by id', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics/topic-dbms`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 'topic-dbms');
    assert.equal(body.data.subject, 'Database Systems');
    assert.equal(body.data.topic_name, 'DBMS — Normalisation');
  });

  test('GET /api/topics/:id returns 404 for unknown topic id', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/topics/non-existent-topic-xyz`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
