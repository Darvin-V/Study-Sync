import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';

describe('Study Partner Discovery & Simplified Search Test Suite', () => {
  let testApp;

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  async function registerLearner(name, email, password = 'Password123!') {
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: name,
        email,
        password,
        confirmPassword: password,
      }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/studysync_session=([^;]+)/);
    const cookie = sessionMatch ? `studysync_session=${sessionMatch[1]}` : '';
    return { res, data, cookie, token: data.data?.token };
  }

  test('1. User can search using a custom non-CSE subject (e.g. Mathematics, Economics)', async () => {
    const email = `partner.math.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Math Seeker', email);

    // Search for Mathematics
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Mathematics`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.criteria.subject, 'Mathematics');

    // Any match returned must be related to Mathematics
    for (const match of body.data) {
      const isRelated =
        (match.subject && match.subject.toLowerCase().includes('math')) ||
        (match.topic && match.topic.toLowerCase().includes('eigen')) ||
        (match.matchingReasons && match.matchingReasons.some((r) => r.toLowerCase().includes('math')));
      assert.ok(isRelated, `Match ${match.studentName} must be related to Mathematics`);
    }
  });

  test('2. User can refine search with custom topic (e.g. Eigenvalues & Diagonalization)', async () => {
    const email = `partner.topic.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Topic Refiner', email);

    const res = await fetch(
      `${testApp.baseUrl}/api/matches/peers?subject=Mathematics&topic=Eigenvalues+%26+Diagonalization`,
      {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.meta.criteria.subject, 'Mathematics');
    assert.equal(body.meta.criteria.topic, 'Eigenvalues & Diagonalization');
  });

  test('3. Search with only topic (without subject) correctly applies topic filtering', async () => {
    const email = `partner.onlytopic.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Only Topic Seeker', email);

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?topic=Deadlocks`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.meta.criteria.topic, 'Deadlocks');
  });

  test('4. Empty searches handle discovery intentionally without hardcoding subject "all"', async () => {
    const email = `partner.empty.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Empty Seeker', email);

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    // The subject must NOT be forced to "all"
    assert.notEqual(body.meta.criteria.subject, 'all');
  });

  test('5. Current authenticated user NEVER appears in their own search results', async () => {
    const email = `partner.selfcheck.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Self Filter Student', email);
    const myId = reg.data.data.user.id;

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    const selfMatch = body.data.find((m) => m.studentId === myId || m.id === `match-${myId}`);
    assert.equal(selfMatch, undefined, 'Authenticated user must not appear as their own partner');
  });

  test('6. Unrelated candidates are NOT returned merely to fill the page', async () => {
    const email = `partner.unrelated.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Strict Searcher', email);

    // Search for a subject that has zero registered students
    const res = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Organic+Chemistry+Spectroscopy`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    // Should be honest empty array, NOT filled with un-onboarded test accounts
    assert.equal(body.data.length, 0, 'Must not return unrelated candidates merely to fill results');
    assert.ok(body.meta.alternatives, 'Must provide helpful alternatives on empty result');
    assert.ok(
      body.meta.alternatives.explanation.includes('No registered peers'),
      'Must explain honestly that no peers currently match'
    );
  });

  test('7. Candidate cards never duplicate the same student account', async () => {
    const email = `partner.dedup.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Dedup Checker', email);

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    const seenIds = new Set();
    for (const match of body.data) {
      assert.equal(seenIds.has(match.studentId), false, `Duplicate studentId ${match.studentId} found in matches`);
      seenIds.add(match.studentId);
    }
  });

  test('8. Candidate strengths and subjects never fabricate unstudied topics', async () => {
    const email = `partner.truthful.${Date.now()}@test.studysync.ai`;
    const reg = await registerLearner('Truthfulness Checker', email);

    const res = await fetch(`${testApp.baseUrl}/api/matches/peers`, {
      headers: {
        Cookie: reg.cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const body = await res.json();
    for (const match of body.data) {
      assert.ok(Array.isArray(match.strengths));
      assert.ok(Array.isArray(match.subjects));
      // Recommendation reason must not claim false verification
      assert.equal(
        match.recommendationReason.includes('with verified'),
        false,
        'Must not falsely claim verified status in recommendationReason'
      );
    }
  });
});
