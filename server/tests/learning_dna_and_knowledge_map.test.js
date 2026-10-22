import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './testHelper.js';
import { getDb } from '../db/connection.js';
import { TOPIC_STATES } from '../services/knowledgeMap/knowledgeMapService.js';

describe('Learning DNA & Interactive Knowledge Map Endpoints (Phase 10)', () => {
  let testApp;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;

  before(async () => {
    testApp = await startTestServer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Register User A (Alice - Primary learner)
    const resA = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Learner',
        email: `alice.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataA = await resA.json();
    userAToken = dataA.data.token;
    userAId = dataA.data.user.id;

    // 2. Register User B (Bob - Peer learner)
    const resB = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Peer',
        email: `bob.${unique}@test.studysync.ai`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const dataB = await resB.json();
    userBToken = dataB.data.token;
    userBId = dataB.data.user.id;
  });

  after(async () => {
    if (testApp?.close) {
      await testApp.close();
    }
  });

  test('1. Unauthenticated requests to /api/dna and /api/knowledge-map are rejected with 401', async () => {
    const resDna = await fetch(`${testApp.baseUrl}/api/dna`);
    assert.strictEqual(resDna.status, 401);

    const resMap = await fetch(`${testApp.baseUrl}/api/knowledge-map`);
    assert.strictEqual(resMap.status, 401);

    const resProg = await fetch(`${testApp.baseUrl}/api/knowledge-map/progress`);
    assert.strictEqual(resProg.status, 401);
  });

  test('2. New user can retrieve baseline Learning DNA with clear field explanations and empty preferences', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/dna`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.userId, userAId);
    assert.strictEqual(body.data.displayName, 'Alice Learner');
    assert.ok(body.data.collaborationStyle);
    assert.ok(Array.isArray(body.data.confidentTopics));
    assert.ok(Array.isArray(body.data.difficultTopics));
    assert.ok(Array.isArray(body.data.willingToTeachTopics));
    assert.ok(Array.isArray(body.data.wantsPeerSupportTopics));
    assert.ok(body.data.fieldExplanations);
    assert.ok(body.data.fieldExplanations.collaborationStyle);
    assert.ok(body.data.fieldExplanations.confidentTopics);
    assert.ok(body.data.fieldExplanations.willingToTeachTopics);
  });

  test('3. Authenticated user can update own Learning DNA with collaboration style, confidences, willing to teach, and peer support', async () => {
    const updatePayload = {
      collaborationStyle: 'Concept exchange & peer teaching',
      preferredStudyTimes: 'Weekend mornings & late evenings',
      preferredStudyDuration: 60,
      subjects: ['Database Systems', 'Algorithms & Complexity'],
      topics: [
        {
          topic_id: 'topic-dbms',
          confidence_level: 'confident',
          willing_to_teach: true,
          wants_peer_support: false,
          learning_goal: 'Explain BCNF decomposition to peers',
          is_learning_now: true,
        },
        {
          topic_id: 'topic-dp',
          confidence_level: 'needs_improvement',
          willing_to_teach: false,
          wants_peer_support: true,
          learning_goal: 'Master memoization vs tabulation with a peer tutor',
          is_learning_now: true,
        },
      ],
    };

    const res = await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.collaborationStyle, 'Concept exchange & peer teaching');
    assert.strictEqual(body.data.preferredStudyDuration, 60);

    // Verify confident topics
    assert.strictEqual(body.data.confidentTopics.length, 1);
    assert.strictEqual(body.data.confidentTopics[0].id, 'topic-dbms');

    // Verify difficult topics
    assert.strictEqual(body.data.difficultTopics.length, 1);
    assert.strictEqual(body.data.difficultTopics[0].id, 'topic-dp');

    // Verify willing to teach
    assert.strictEqual(body.data.willingToTeachTopics.length, 1);
    assert.strictEqual(body.data.willingToTeachTopics[0].id, 'topic-dbms');

    // Verify peer support requested
    assert.strictEqual(body.data.wantsPeerSupportTopics.length, 1);
    assert.strictEqual(body.data.wantsPeerSupportTopics[0].id, 'topic-dp');
  });

  test('4. Security & Isolation: User B cannot modify User A Learning DNA', async () => {
    // User B attempts to change collaboration style for their own account
    const resB = await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        collaborationStyle: 'Quiet co-working with periodic Q&A',
      }),
    });
    assert.strictEqual(resB.status, 200);

    // Verify User A remained unchanged
    const resA = await fetch(`${testApp.baseUrl}/api/dna`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const dataA = await resA.json();
    assert.strictEqual(dataA.data.collaborationStyle, 'Concept exchange & peer teaching');
  });

  test('5. Knowledge Map accurately computes states: not_started, in_progress, needs_review, and assessed', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/knowledge-map`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.allTopics.length > 0);
    assert.ok(body.data.stateDefinitions);

    // topic-dp was marked as needs_improvement -> state MUST be needs_review
    const dpTopic = body.data.allTopics.find((t) => t.id === 'topic-dp');
    assert.ok(dpTopic);
    assert.strictEqual(dpTopic.state, TOPIC_STATES.NEEDS_REVIEW);
    assert.strictEqual(dpTopic.wantsPeerSupport, true);
    assert.ok(dpTopic.recommendedAction);
    assert.strictEqual(dpTopic.recommendedAction.type, 'find_peer');

    // topic-dbms was marked confident and learning_now without formal assessment -> state MUST be in_progress
    const dbmsTopic = body.data.allTopics.find((t) => t.id === 'topic-dbms');
    assert.ok(dbmsTopic);
    assert.strictEqual(dbmsTopic.state, TOPIC_STATES.IN_PROGRESS);
    assert.strictEqual(dbmsTopic.assessment.hasAssessment, false);
    assert.strictEqual(dbmsTopic.assessment.displayText, 'No formal assessment recorded');

    // topic-linalg has no session, no preference, no assessment -> state MUST be not_started
    const linalgTopic = body.data.allTopics.find((t) => t.id === 'topic-linalg');
    assert.ok(linalgTopic);
    assert.strictEqual(linalgTopic.state, TOPIC_STATES.NOT_STARTED);
    assert.strictEqual(linalgTopic.assessment.hasAssessment, false);
  });

  test('6. Verified Topic Assessment: Recording a passing score changes topic state to "assessed" with real score percentage', async () => {
    // Record real assessment for topic-dbms (85% score, practice_quiz)
    const postRes = await fetch(`${testApp.baseUrl}/api/knowledge-map/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        topicId: 'topic-dbms',
        scorePercentage: 85.5,
        assessmentType: 'practice_quiz',
        notes: 'Passed Normalization proofs with high marks.',
      }),
    });
    assert.strictEqual(postRes.status, 201);
    const postData = await postRes.json();
    assert.strictEqual(postData.data.scorePercentage, 85.5);
    assert.strictEqual(postData.data.passed, true);

    // Refresh Knowledge Map and verify state is now "assessed"
    const mapRes = await fetch(`${testApp.baseUrl}/api/knowledge-map`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const mapBody = await mapRes.json();
    const updatedDbms = mapBody.data.allTopics.find((t) => t.id === 'topic-dbms');

    assert.strictEqual(updatedDbms.state, TOPIC_STATES.ASSESSED);
    assert.strictEqual(updatedDbms.assessment.hasAssessment, true);
    assert.strictEqual(updatedDbms.assessment.scorePercentage, 85.5);
    assert.strictEqual(updatedDbms.assessment.passed, true);
    assert.ok(updatedDbms.assessment.displayText.includes('85.5%'));
    assert.ok(updatedDbms.assessment.displayText.includes('Passed'));
  });

  test('7. Transparent Progress Signals: Strict separation of self-reported confidence, session hours, and assessments', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/knowledge-map/progress`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    const { selfReportedConfidence, verifiedAssessments, studyActivity } = body.data;

    // Self-reported confidence metrics
    assert.strictEqual(selfReportedConfidence.confidentCount, 1); // topic-dbms
    assert.strictEqual(selfReportedConfidence.needsImprovementCount, 1); // topic-dp
    assert.ok(selfReportedConfidence.explanation.includes('Self-reported comfort level'));

    // Verified assessment metrics (distinct from confidence)
    assert.strictEqual(verifiedAssessments.hasAssessments, true);
    assert.strictEqual(verifiedAssessments.totalAssessmentsTaken, 1);
    assert.strictEqual(verifiedAssessments.passedAssessmentsCount, 1);
    assert.strictEqual(verifiedAssessments.averageScorePercentage, 85.5);
    assert.ok(verifiedAssessments.explanation.includes('Formal quiz and exam scores'));

    // Study session attendance (measures participation, NOT comprehension)
    assert.ok(studyActivity.explanation.includes('measures participation, not verified comprehension'));
  });

  test('8. Topic Prerequisites & Learning Pathways: Shows prerequisite relationships and unlocked next steps', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/knowledge-map/paths`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.totalPrerequisiteRules > 0);
    assert.ok(body.data.pathways['Database Systems']);

    // Check that Database Systems pathway includes SQL Joins -> DBMS Normalisation
    const dbmsPathway = body.data.pathways['Database Systems'];
    const normStep = dbmsPathway.find((p) => p.topic.id === 'topic-dbms');
    assert.ok(normStep);
    assert.strictEqual(normStep.prerequisite.id, 'topic-dbms-joins');
    assert.ok(normStep.reason);
  });

  test('9. Recommendation Engine Integration: Recommends peer tutors for topics where user requested peer support', async () => {
    // Make User B willing to teach topic-dp
    await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        topics: [
          {
            topic_id: 'topic-dp',
            confidence_level: 'confident',
            willing_to_teach: true,
            wants_peer_support: false,
            is_learning_now: true,
          },
        ],
      }),
    });

    // User A requested peer support for topic-dp. Fetch study recommendations for User A
    const recRes = await fetch(`${testApp.baseUrl}/api/recommendations/study`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(recRes.status, 200);

    const recBody = await recRes.json();
    assert.strictEqual(recBody.success, true);
    const recList = Array.isArray(recBody.data) ? recBody.data : (recBody.data?.recommendations || []);
    assert.ok(recList.length > 0);

    // Look for peer recommendation targeting topic-dp
    const dpRec = recList.find(
      (r) => r.type === 'peer_help' && (r.topic.includes('Dynamic Programming') || r.topic.includes('dp'))
    );
    assert.ok(dpRec, 'Expected peer_help recommendation for Dynamic Programming');
    assert.ok(dpRec.reason.includes('peer support') || dpRec.reason.includes('needs improvement') || dpRec.reason.includes('improvement'));
  });

  test('10. Invalid DNA inputs return 400 VALIDATION_ERROR with structured error details', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/dna`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        preferredStudyDuration: -5, // Invalid negative duration
        topics: 'not-an-array',     // Invalid topics format
      }),
    });
    assert.strictEqual(res.status, 400);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length >= 2);
  });
});
