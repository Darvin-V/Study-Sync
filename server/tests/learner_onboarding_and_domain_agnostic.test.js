import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';

describe('Learner Onboarding, Privacy, and Domain-Agnostic Learning Test Suite', () => {
  let testApp;
  const createdUserIds = [];
  const createdRoomIds = [];

  before(async () => {
    testApp = await startTestServer();
  });

  after(async () => {
    const db = getDb();
    try {
      for (const roomId of createdRoomIds) {
        db.prepare('DELETE FROM room_memberships WHERE room_id = ?').run(roomId);
        db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(roomId);
        db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
      }
      for (const uid of createdUserIds) {
        db.prepare('DELETE FROM user_learning_preferences WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_subjects WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM learner_profiles WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(uid);
        db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      }
    } catch {
      // Teardown cleanup
    }

    if (testApp) await testApp.close();
  });

  // Helper for registering a test learner
  async function registerLearner(name, email, password = 'Password123!') {
    const res = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        displayName: name,
        email,
        password,
        confirmPassword: password,
      }),
    });

    const cookie = res.headers.get('set-cookie');
    const data = await res.json();
    if (data.data?.user?.id) {
      createdUserIds.push(data.data.user.id);
    }
    return { status: res.status, data, cookie, token: data.data?.token };
  }

  // ==========================================================================
  // Phase 2: Mandatory Onboarding Lifecycle & Route Guards
  // ==========================================================================
  describe('1. Mandatory Onboarding Lifecycle', () => {
    test('1.1 New registration initializes with isProfileCompleted = false requiring onboarding', async () => {
      const email = `newlearner.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('New Learner', email);

      assert.equal(reg.status, 201);
      assert.equal(reg.data.success, true);
      assert.equal(reg.data.data.isProfileCompleted, false);

      // Verify GET /api/auth/me returns isProfileCompleted = false
      const meRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const meData = await meRes.json();
      assert.equal(meRes.status, 200);
      assert.equal(meData.data.isProfileCompleted, false);
    });

    test('1.2 Completing onboarding persists profile, sets isProfileCompleted = true, and unlocks dashboard', async () => {
      const email = `completedlearner.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Jordan Taylor', email);

      const updateRes = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          displayName: 'Jordan Taylor',
          age: 17,
          gender: 'Non-binary',
          educationStage: 'higher_secondary',
          headline: 'Grade 12 • Science (Physics & Mathematics)',
          institution: 'City Higher Secondary School',
          educationDetails: {
            fieldOrMajor: 'Science',
            currentLevelOrYear: 'Grade 12',
            boardOrStream: 'State Board',
          },
          learningGoals: [
            'Prepare for upcoming school or university examinations',
            'Master coursework problem sets and weekly assignments',
          ],
          preferredStudyTimes: 'Weekday evenings',
          preferredStudyDuration: 45,
          isProfileCompleted: true,
        }),
      });

      const updateData = await updateRes.json();
      assert.equal(updateRes.status, 200);
      assert.equal(updateData.success, true);
      assert.equal(updateData.data.isProfileCompleted, true);
      assert.equal(updateData.data.age, 17);
      assert.equal(updateData.data.gender, 'Non-binary');
      assert.equal(updateData.data.educationStage, 'higher_secondary');

      // Verify GET /api/auth/me now reflects isProfileCompleted = true
      const meRes = await fetch(`${testApp.baseUrl}/api/auth/me`, {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const meData = await meRes.json();
      assert.equal(meRes.status, 200);
      assert.equal(meData.data.isProfileCompleted, true);
    });
  });

  // ==========================================================================
  // Phase 3 & 4: Profile Privacy & Domain-Agnostic Educational Stages
  // ==========================================================================
  describe('2. Learner Profile Privacy & Diverse Educational Stages', () => {
    test('2.1 Age and gender are private by default and NEVER exposed in public peer matching results', async () => {
      const email = `privacylearner.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Sam Morgan', email);

      // Save profile with private age and gender
      await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          age: 15,
          gender: 'Woman',
          educationStage: 'secondary_school',
          headline: 'Grade 10 • Mathematics & Science',
          institution: 'Hillside Secondary School',
          isProfileCompleted: true,
        }),
      });

      // Query peer matching as a different user
      const partnerEmail = `partnersearcher.${Date.now()}@test.studysync.ai`;
      const searcherReg = await registerLearner('Searcher Peer', partnerEmail);

      const matchRes = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Mathematics`, {
        headers: {
          Cookie: searcherReg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const matchData = await matchRes.json();

      assert.equal(matchRes.status, 200);
      const returnedCandidates = matchData.data || [];
      const samCandidate = returnedCandidates.find((c) => c.displayName === 'Sam Morgan');

      if (samCandidate) {
        assert.equal(samCandidate.age, undefined, 'Age must not be exposed in match candidate object');
        assert.equal(samCandidate.gender, undefined, 'Gender must not be exposed in match candidate object');
        assert.equal(samCandidate.password_hash, undefined, 'Password hash must never be exposed');
      }
    });

    test('2.2 Gender disclosure can be left undisclosed (Prefer not to say)', async () => {
      const email = `undisclosed.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Alex Scholar', email);

      const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          gender: 'Prefer not to say',
          educationStage: 'independent_other',
          headline: 'Independent Scholar',
          isProfileCompleted: true,
        }),
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.gender, 'Prefer not to say');
    });

    test('2.3 Adapts cleanly to vocational / technical trade learner profile', async () => {
      const email = `vocational.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Kavitha Trade', email);

      const res = await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          age: 19,
          educationStage: 'iti_vocational',
          headline: 'Year 2 • Welding & Metallurgy',
          institution: 'Regional Industrial Training Institute',
          educationDetails: {
            fieldOrMajor: 'Welding & Metallurgy',
            currentLevelOrYear: 'Year 2 Apprentice',
            boardOrStream: 'National Council for Vocational Training',
          },
          learningGoals: ['Learn a new technical, trade, or vocational skill'],
          isProfileCompleted: true,
        }),
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.educationStage, 'iti_vocational');
      assert.equal(data.data.headline, 'Year 2 • Welding & Metallurgy');
    });
  });

  // ==========================================================================
  // Phase 5: User-Driven Study Room Creation (Non-CSE, Free-Text Entry)
  // ==========================================================================
  describe('3. User-Driven Study Room Creation Across Domains', () => {
    test('3.1 User can create a room for school mathematics with arbitrary subject & topic text', async () => {
      const email = `mathcreator.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Priya Math', email);

      const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Class 5 Mathematics — Fractions & Decimals',
          subject: 'Class 5 Mathematics',
          topic: 'Fractions and Decimal Operations',
          description: 'Working through practice problem sets and visual fraction models together.',
          education_stage: 'Primary School (Grades 1-5)',
          roomType: 'Learn Together',
          difficulty: 'Beginner',
        }),
      });

      const createData = await createRes.json();
      assert.equal(createRes.status, 201);
      assert.equal(createData.success, true);
      assert.equal(createData.data.subject, 'Class 5 Mathematics');
      assert.equal(createData.data.topic, 'Fractions and Decimal Operations');
      assert.equal(createData.data.education_stage, 'Primary School (Grades 1-5)');

      createdRoomIds.push(createData.data.id);

      // Verify room details persist and retrieve correctly
      const getRes = await fetch(`${testApp.baseUrl}/api/rooms/${createData.data.id}`, {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const getData = await getRes.json();
      assert.equal(getRes.status, 200);
      assert.equal(getData.data.subject, 'Class 5 Mathematics');
      assert.equal(getData.data.topic, 'Fractions and Decimal Operations');
    });

    test('3.2 User can create a room for vocational training with non-CSE topic', async () => {
      const email = `voccreator.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Ravi Welder', email);

      const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Welding Workshop — Arc Welding Safety Protocols',
          subject: 'Vocational Training & Trades',
          topic: 'Arc Welding Safety Protocols',
          description: 'Reviewing personal protective equipment and ventilation safety standards.',
          education_stage: 'ITI / Vocational Training',
          roomType: 'Revision',
          difficulty: 'Intermediate',
        }),
      });

      const createData = await createRes.json();
      assert.equal(createRes.status, 201);
      assert.equal(createData.success, true);
      assert.equal(createData.data.subject, 'Vocational Training & Trades');
      assert.equal(createData.data.topic, 'Arc Welding Safety Protocols');

      createdRoomIds.push(createData.data.id);
    });

    test('3.3 User can create a room for postgraduate economics (Econometrics)', async () => {
      const email = `econcreator.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Deepa Econ', email);

      const createRes = await fetch(`${testApp.baseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Econometrics Reading Group — Instrumental Variables',
          subject: 'Postgraduate Economics',
          topic: 'Instrumental Variables & Endogeneity',
          description: 'Discussing identification strategies and 2SLS regression techniques.',
          education_stage: 'Postgraduate Degree',
          roomType: 'Peer Teaching',
          difficulty: 'Advanced',
        }),
      });

      const createData = await createRes.json();
      assert.equal(createRes.status, 201);
      assert.equal(createData.success, true);
      assert.equal(createData.data.subject, 'Postgraduate Economics');
      assert.equal(createData.data.topic, 'Instrumental Variables & Endogeneity');

      createdRoomIds.push(createData.data.id);
    });
  });

  // ==========================================================================
  // Phase 6 & 7: Partner Matching Correctness & Self-Exclusion
  // ==========================================================================
  describe('4. Partner Matching Self-Exclusion & Honest Data', () => {
    test('4.1 Current user NEVER appears in their own study partner matching results', async () => {
      const email = `selfmatchingtest.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Self Exclusion Student', email);

      // Set completed profile for matching
      await fetch(`${testApp.baseUrl}/api/profile/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          headline: 'Undergraduate • Database Systems',
          isProfileCompleted: true,
        }),
      });

      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Database+Systems`, {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const data = await res.json();
      assert.equal(res.status, 200);

      const matches = data.data || [];
      const currentUserId = reg.data.data.user.id;

      const selfFound = matches.some(
        (m) => m.studentId === currentUserId || m.id === `match-${currentUserId}`
      );
      assert.equal(selfFound, false, 'The authenticated user must never be returned in their own study partner recommendations');
    });

    test('4.2 Returns honest alternatives and empty state when no peers match the search criteria', async () => {
      const email = `uniquepartnersearch.${Date.now()}@test.studysync.ai`;
      const reg = await registerLearner('Niche Researcher', email);

      const res = await fetch(`${testApp.baseUrl}/api/matches/peers?subject=Extremely+Rare+Subject+Nobody+Studies`, {
        headers: {
          Cookie: reg.cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(data.data));

      // Check alternatives structure when matches are empty
      if (data.data.length === 0) {
        assert.ok(data.meta?.alternatives, 'Alternatives must be provided for honest next steps');
        assert.ok(typeof data.meta.alternatives.explanation === 'string');
      }
    });
  });
});
