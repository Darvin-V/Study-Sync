import { getDb } from '../../db/connection.js';

/**
 * StudySync AI — Knowledge Map & Progress Service (Phase 10)
 * 
 * Provides transparent, honest mapping of a learner's curriculum topics,
 * active study participation, verified assessment results, and prerequisite pathways.
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Never conflate session time with comprehension or mastery.
 * 2. Keep self-reported confidence strictly distinct from verified assessments.
 * 3. Never fabricate scores when assessments are missing; display "No formal assessment recorded".
 * 4. Ground all recommendations and states in verifiable database records.
 */

export const TOPIC_STATES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  NEEDS_REVIEW: 'needs_review',
  ASSESSED: 'assessed',
});

export const STATE_DEFINITIONS = Object.freeze({
  [TOPIC_STATES.NOT_STARTED]: {
    label: 'Not Started',
    description: 'Curriculum topic with no logged study sessions, active preferences, or assessments.',
    color: 'neutral',
  },
  [TOPIC_STATES.IN_PROGRESS]: {
    label: 'In Progress',
    description: 'Currently marked as an active study focus or has recorded study session attendance.',
    color: 'primary',
  },
  [TOPIC_STATES.NEEDS_REVIEW]: {
    label: 'Needs Review',
    description: 'Self-reported as challenging by the learner, failed an assessment, or studied over 7 days ago without recent review.',
    color: 'warning',
  },
  [TOPIC_STATES.ASSESSED]: {
    label: 'Assessed',
    description: 'Verified assessment record exists in StudySync with a passing score (>= 70%).',
    color: 'success',
  },
});

export const KnowledgeMapService = {
  /**
   * Retrieves the comprehensive Knowledge Map for a learner
   */
  getKnowledgeMap(userId, filters = {}, customDb = null) {
    const db = customDb || getDb();

    // 1. Fetch curriculum topics
    let topicQuery = 'SELECT * FROM learning_topics';
    const params = [];
    if (filters.subject && filters.subject !== 'all') {
      topicQuery += ' WHERE subject = ?';
      params.push(filters.subject);
    }
    topicQuery += ' ORDER BY subject ASC, topic_name ASC';
    const topics = db.prepare(topicQuery).all(...params);

    // 2. Fetch learner's topic preferences
    const preferences = db.prepare(`
      SELECT * FROM user_learning_preferences WHERE user_id = ?
    `).all(userId);
    const prefMap = new Map(preferences.map((p) => [p.topic_id, p]));

    // 3. Fetch learner's verified assessments
    const assessments = db.prepare(`
      SELECT * FROM topic_assessments WHERE user_id = ? ORDER BY assessed_at DESC
    `).all(userId);
    // Group assessments by topic_id (taking latest if multiple)
    const assessmentMap = new Map();
    for (const a of assessments) {
      if (!assessmentMap.has(a.topic_id)) {
        assessmentMap.set(a.topic_id, a);
      }
    }

    // 4. Fetch learner's study session history
    const sessions = db.prepare(`
      SELECT ss.id, ss.topic, ss.subject, sp.joined_at, sp.total_attendance_seconds, sp.participation_status
      FROM session_participants sp
      JOIN study_sessions ss ON sp.session_id = ss.id
      WHERE sp.user_id = ?
      ORDER BY sp.joined_at DESC
    `).all(userId);

    // 5. Fetch prerequisite relationships
    const prerequisites = db.prepare(`
      SELECT tp.*, 
        source.topic_name AS source_name, source.subject AS source_subject,
        target.topic_name AS target_name, target.subject AS target_subject
      FROM topic_prerequisites tp
      JOIN learning_topics source ON tp.prerequisite_topic_id = source.id
      JOIN learning_topics target ON tp.topic_id = target.id
    `).all();

    // 6. Fetch active Topic Rooms for next-step actions
    const activeRooms = db.prepare(`
      SELECT id, room_name, subject, topic, max_capacity
      FROM rooms
      WHERE status = 'active'
    `).all();

    // Build map nodes
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const topicNodes = topics.map((t) => {
      const pref = prefMap.get(t.id);
      const assessment = assessmentMap.get(t.id);

      // Match sessions by exact topic id or normalized topic name
      const matchingSessions = sessions.filter((s) => {
        if (!s.topic) return false;
        const normSessionTopic = s.topic.toLowerCase().trim();
        const normTopicName = t.topic_name.toLowerCase().trim();
        return normSessionTopic.includes(normTopicName) || normTopicName.includes(normSessionTopic);
      });

      const sessionCount = matchingSessions.length;
      const lastSession = matchingSessions[0] || null;
      const lastStudiedAt = lastSession ? lastSession.joined_at : null;
      const totalAttendanceSeconds = matchingSessions.reduce((acc, s) => acc + (s.total_attendance_seconds || 0), 0);
      const hasStudied = sessionCount > 0;
      const daysSinceLastStudy = lastStudiedAt ? Math.floor((now - new Date(lastStudiedAt).getTime()) / (1000 * 60 * 60 * 24)) : null;

      // Extract self-reported preference flags
      const confidenceLevel = pref?.confidence_level || (pref?.is_strength ? 'confident' : pref?.is_improving ? 'needs_improvement' : 'unspecified');
      const willingToTeach = Boolean(pref?.willing_to_teach);
      const wantsPeerSupport = Boolean(pref?.wants_peer_support);
      const isLearningNow = Boolean(pref?.is_learning_now);
      const learningGoal = pref?.learning_goal || null;

      // Determine honest topic state
      let state = TOPIC_STATES.NOT_STARTED;
      let stateReason = 'No logged study sessions, active preferences, or assessment records.';

      if (assessment && assessment.passed === 1 && assessment.score_percentage >= 70) {
        state = TOPIC_STATES.ASSESSED;
        stateReason = `Verified assessment passed with ${assessment.score_percentage}% score on ${new Date(assessment.assessed_at).toLocaleDateString()}.`;
      } else if (
        confidenceLevel === 'needs_improvement' ||
        pref?.is_improving === 1 ||
        (assessment && assessment.passed === 0) ||
        (hasStudied && daysSinceLastStudy !== null && daysSinceLastStudy > 7)
      ) {
        state = TOPIC_STATES.NEEDS_REVIEW;
        if (confidenceLevel === 'needs_improvement') {
          stateReason = 'Self-reported by learner as an area needing improvement.';
        } else if (assessment && assessment.passed === 0) {
          stateReason = `Scored ${assessment.score_percentage}% on assessment (passing score is 70%). Practice recommended.`;
        } else {
          stateReason = `Last studied ${daysSinceLastStudy} days ago; spaced review recommended.`;
        }
      } else if (hasStudied || isLearningNow || (confidenceLevel !== 'unspecified' && confidenceLevel !== 'neutral')) {
        state = TOPIC_STATES.IN_PROGRESS;
        stateReason = hasStudied
          ? `Participated in ${sessionCount} study session(s); formal assessment pending.`
          : 'Selected as currently learning in study preferences.';
      }

      // Prerequisites for this topic
      const topicPrereqs = prerequisites
        .filter((p) => p.topic_id === t.id)
        .map((p) => ({
          prerequisiteTopicId: p.prerequisite_topic_id,
          name: p.source_name,
          subject: p.source_subject,
          reason: p.reason,
          isCompleted: assessmentMap.get(p.prerequisite_topic_id)?.passed === 1,
        }));

      // Topics that this topic unlocks (dependents)
      const topicDependents = prerequisites
        .filter((p) => p.prerequisite_topic_id === t.id)
        .map((p) => ({
          targetTopicId: p.topic_id,
          name: p.target_name,
          subject: p.target_subject,
          reason: p.reason,
        }));

      // Find relevant Room if active
      const relatedRoom = activeRooms.find((r) => {
        const normRoomTopic = (r.topic || '').toLowerCase();
        const normName = t.topic_name.toLowerCase();
        return normRoomTopic.includes(normName) || normName.includes(normRoomTopic) || r.subject === t.subject;
      });

      // Recommended next action
      let recommendedAction = null;
      if (state === TOPIC_STATES.NEEDS_REVIEW) {
        if (wantsPeerSupport) {
          recommendedAction = {
            type: 'find_peer',
            label: 'Find Peer Tutor',
            url: `/discover?topic=${encodeURIComponent(t.topic_name)}&subject=${encodeURIComponent(t.subject)}`,
            reason: 'You requested peer support for this topic. Connect with students willing to teach.',
          };
        } else {
          recommendedAction = {
            type: 'revise',
            label: 'Start Revision Session',
            url: `/sessions?topic=${encodeURIComponent(t.topic_name)}`,
            reason: 'Spaced repetition session recommended to reinforce concepts.',
          };
        }
      } else if (state === TOPIC_STATES.IN_PROGRESS) {
        if (relatedRoom) {
          recommendedAction = {
            type: 'join_room',
            label: `Join "${relatedRoom.room_name}"`,
            url: `/rooms/${relatedRoom.id}`,
            reason: 'Collaborative room active right now covering this subject.',
          };
        } else {
          recommendedAction = {
            type: 'study_session',
            label: 'Plan Practice Session',
            url: `/sessions`,
            reason: 'Schedule a focused session with peer study partners.',
          };
        }
      } else if (state === TOPIC_STATES.NOT_STARTED) {
        const allPrereqsMet = topicPrereqs.every((p) => p.isCompleted);
        if (topicPrereqs.length === 0 || allPrereqsMet) {
          recommendedAction = {
            type: 'start_topic',
            label: 'Begin Topic',
            url: `/rooms?subject=${encodeURIComponent(t.subject)}`,
            reason: topicPrereqs.length > 0 ? 'All prerequisites completed! Ready to begin.' : 'Foundational topic ready to explore.',
          };
        } else {
          const uncompleted = topicPrereqs.filter((p) => !p.isCompleted);
          recommendedAction = {
            type: 'prerequisite_first',
            label: `Prerequisite: ${uncompleted[0]?.name || 'Review Prereq'}`,
            url: `/knowledge-map`,
            reason: `Foundational concepts in ${uncompleted[0]?.name || 'prior topics'} recommended first.`,
          };
        }
      } else if (state === TOPIC_STATES.ASSESSED) {
        if (willingToTeach) {
          recommendedAction = {
            type: 'teach_peers',
            label: 'Help Peers in Discover',
            url: `/discover?subject=${encodeURIComponent(t.subject)}`,
            reason: 'You scored well on this topic and opted in to help peer learners.',
          };
        } else if (topicDependents.length > 0) {
          recommendedAction = {
            type: 'advance',
            label: `Advance to ${topicDependents[0].name}`,
            url: `/knowledge-map`,
            reason: 'You have mastered this concept; advance along your curriculum path.',
          };
        } else {
          recommendedAction = {
            type: 'maintenance_quiz',
            label: 'Review Notes & Cheatsheets',
            url: `/notes`,
            reason: 'Solid comprehension recorded. Review shared peer summaries.',
          };
        }
      }

      return {
        id: t.id,
        topicName: t.topic_name,
        subject: t.subject,
        difficultyLevel: t.difficulty_level || 'Intermediate',
        description: t.description,
        state,
        stateLabel: STATE_DEFINITIONS[state].label,
        stateReason,
        confidenceLevel,
        willingToTeach,
        wantsPeerSupport,
        isLearningNow,
        learningGoal,
        studyActivity: {
          hasStudied,
          sessionCount,
          lastStudiedAt,
          daysSinceLastStudy,
          totalAttendanceMinutes: Math.round(totalAttendanceSeconds / 60),
          explanation: 'Logged attendance in study sessions. Time spent indicates participation, not comprehension.',
        },
        assessment: {
          hasAssessment: Boolean(assessment),
          scorePercentage: assessment ? assessment.score_percentage : null,
          passed: assessment ? Boolean(assessment.passed) : null,
          assessmentType: assessment ? assessment.assessment_type : null,
          assessedAt: assessment ? assessment.assessed_at : null,
          displayText: assessment
            ? `${assessment.score_percentage}% • ${assessment.passed ? 'Passed' : 'Needs Practice'} (${assessment.assessment_type})`
            : 'No formal assessment recorded',
        },
        prerequisites: topicPrereqs,
        dependents: topicDependents,
        recommendedAction,
      };
    });

    // Group topics by subject
    const subjectMap = new Map();
    for (const node of topicNodes) {
      if (!subjectMap.has(node.subject)) {
        subjectMap.set(node.subject, []);
      }
      subjectMap.get(node.subject).push(node);
    }

    const subjectsSummary = Array.from(subjectMap.entries()).map(([subjectName, subjectTopics]) => {
      const counts = {
        total: subjectTopics.length,
        [TOPIC_STATES.NOT_STARTED]: subjectTopics.filter((t) => t.state === TOPIC_STATES.NOT_STARTED).length,
        [TOPIC_STATES.IN_PROGRESS]: subjectTopics.filter((t) => t.state === TOPIC_STATES.IN_PROGRESS).length,
        [TOPIC_STATES.NEEDS_REVIEW]: subjectTopics.filter((t) => t.state === TOPIC_STATES.NEEDS_REVIEW).length,
        [TOPIC_STATES.ASSESSED]: subjectTopics.filter((t) => t.state === TOPIC_STATES.ASSESSED).length,
      };
      return {
        subject: subjectName,
        topicsCount: subjectTopics.length,
        stateCounts: counts,
        assessedPercentage: Math.round((counts[TOPIC_STATES.ASSESSED] / counts.total) * 100),
        topics: subjectTopics,
      };
    });

    const totalTopicsCount = topicNodes.length;
    const globalStateCounts = {
      [TOPIC_STATES.NOT_STARTED]: topicNodes.filter((t) => t.state === TOPIC_STATES.NOT_STARTED).length,
      [TOPIC_STATES.IN_PROGRESS]: topicNodes.filter((t) => t.state === TOPIC_STATES.IN_PROGRESS).length,
      [TOPIC_STATES.NEEDS_REVIEW]: topicNodes.filter((t) => t.state === TOPIC_STATES.NEEDS_REVIEW).length,
      [TOPIC_STATES.ASSESSED]: topicNodes.filter((t) => t.state === TOPIC_STATES.ASSESSED).length,
    };

    return {
      userId,
      totalTopics: totalTopicsCount,
      stateCounts: globalStateCounts,
      stateDefinitions: STATE_DEFINITIONS,
      subjects: subjectsSummary,
      allTopics: topicNodes,
    };
  },

  /**
   * Retrieves transparent, unbundled progress signals
   * Keeps self-reported confidence separate from actual verified assessments and session attendance.
   */
  getProgressSignals(userId, customDb = null) {
    const db = customDb || getDb();

    // 1. Self-Reported Confidence Signals
    const preferences = db.prepare(`
      SELECT confidence_level, is_strength, is_improving, willing_to_teach, wants_peer_support
      FROM user_learning_preferences
      WHERE user_id = ?
    `).all(userId);

    let confidentCount = 0;
    let neutralCount = 0;
    let needsImprovementCount = 0;
    let willingToTeachCount = 0;
    let wantsPeerSupportCount = 0;

    for (const p of preferences) {
      if (p.confidence_level === 'confident' || p.is_strength === 1) confidentCount++;
      else if (p.confidence_level === 'needs_improvement' || p.is_improving === 1) needsImprovementCount++;
      else neutralCount++;

      if (p.willing_to_teach) willingToTeachCount++;
      if (p.wants_peer_support) wantsPeerSupportCount++;
    }

    // 2. Verified Assessment Signals
    const assessments = db.prepare(`
      SELECT score_percentage, passed, assessment_type, assessed_at
      FROM topic_assessments
      WHERE user_id = ?
      ORDER BY assessed_at DESC
    `).all(userId);

    const totalAssessmentsTaken = assessments.length;
    const passedAssessmentsCount = assessments.filter((a) => a.passed === 1).length;
    const avgScore = totalAssessmentsTaken > 0
      ? Math.round((assessments.reduce((acc, a) => acc + a.score_percentage, 0) / totalAssessmentsTaken) * 10) / 10
      : null;

    // 3. Study Session Attendance Signals
    const sessions = db.prepare(`
      SELECT sp.total_attendance_seconds, sp.joined_at, ss.topic, ss.subject
      FROM session_participants sp
      JOIN study_sessions ss ON sp.session_id = ss.id
      WHERE sp.user_id = ?
    `).all(userId);

    const completedSessionsCount = sessions.length;
    const totalAttendanceSeconds = sessions.reduce((acc, s) => acc + (s.total_attendance_seconds || 0), 0);
    const totalAttendedHours = Math.round((totalAttendanceSeconds / 3600) * 10) / 10;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentSessionCountLast7Days = sessions.filter((s) => s.joined_at >= sevenDaysAgo).length;

    // 4. Peer Knowledge Exchange Signals
    const notesCount = db.prepare('SELECT COUNT(*) AS count FROM notes_resources WHERE author_id = ?').get(userId)?.count || 0;
    const questionsAsked = db.prepare('SELECT COUNT(*) AS count FROM room_questions WHERE asker_id = ?').get(userId)?.count || 0;
    const questionsResolved = db.prepare('SELECT COUNT(*) AS count FROM room_questions WHERE asker_id = ? AND is_resolved = 1').get(userId)?.count || 0;
    const repliesGiven = db.prepare('SELECT COUNT(*) AS count FROM question_responses WHERE responder_id = ?').get(userId)?.count || 0;

    return {
      userId,
      selfReportedConfidence: {
        totalConfiguredTopics: preferences.length,
        confidentCount,
        neutralCount,
        needsImprovementCount,
        willingToTeachCount,
        wantsPeerSupportCount,
        explanation: 'Self-reported comfort level chosen by you; reflects how confident you feel, not verified exam results.',
      },
      verifiedAssessments: {
        hasAssessments: totalAssessmentsTaken > 0,
        totalAssessmentsTaken,
        passedAssessmentsCount,
        averageScorePercentage: avgScore,
        explanation: 'Formal quiz and exam scores recorded in StudySync. Unassessed topics are clearly marked as unassessed.',
      },
      studyActivity: {
        completedSessionsCount,
        totalAttendedHours,
        totalAttendedMinutes: Math.round(totalAttendanceSeconds / 60),
        recentSessionCountLast7Days,
        explanation: 'Actual study sessions attended with peers. Attendance measures participation, not verified comprehension.',
      },
      knowledgeExchange: {
        notesCreatedCount: notesCount,
        questionsAskedCount: questionsAsked,
        questionsResolvedCount: questionsResolved,
        repliesGivenCount: repliesGiven,
        explanation: 'Study materials shared and peer doubts resolved in collaborative Topic Rooms.',
      },
    };
  },

  /**
   * Retrieves topic prerequisite sequences and suggested learning paths
   */
  getLearningPaths(userId, subject = null, customDb = null) {
    const db = customDb || getDb();

    // 1. Fetch prerequisite graph edges
    let edgeQuery = `
      SELECT tp.*,
        source.topic_name AS source_name, source.subject AS source_subject, source.difficulty_level AS source_difficulty,
        target.topic_name AS target_name, target.subject AS target_subject, target.difficulty_level AS target_difficulty
      FROM topic_prerequisites tp
      JOIN learning_topics source ON tp.prerequisite_topic_id = source.id
      JOIN learning_topics target ON tp.topic_id = target.id
    `;
    const params = [];
    if (subject && subject !== 'all') {
      edgeQuery += ' WHERE target.subject = ?';
      params.push(subject);
    }
    const edges = db.prepare(edgeQuery).all(...params);

    // 2. Fetch user's assessment records
    const assessments = db.prepare(`
      SELECT topic_id, score_percentage, passed
      FROM topic_assessments
      WHERE user_id = ?
    `).all(userId);
    const assessedMap = new Map(assessments.map((a) => [a.topic_id, a]));

    // 3. Fetch user's topic preferences
    const preferences = db.prepare(`
      SELECT * FROM user_learning_preferences WHERE user_id = ?
    `).all(userId);
    const prefMap = new Map(preferences.map((p) => [p.topic_id, p]));

    // 4. Construct pathways (grouped by subject)
    const pathwaysBySubject = {};

    for (const edge of edges) {
      const subj = edge.target_subject;
      if (!pathwaysBySubject[subj]) {
        pathwaysBySubject[subj] = [];
      }

      const sourceAssessment = assessedMap.get(edge.prerequisite_topic_id);
      const targetAssessment = assessedMap.get(edge.topic_id);
      const targetPref = prefMap.get(edge.topic_id);

      const sourceCompleted = sourceAssessment?.passed === 1;
      const targetCompleted = targetAssessment?.passed === 1;

      let stepStatus = 'ready_to_learn';
      if (targetCompleted) {
        stepStatus = 'completed';
      } else if (!sourceCompleted) {
        stepStatus = 'prerequisite_pending';
      } else if (targetPref?.is_learning_now) {
        stepStatus = 'learning_now';
      }

      pathwaysBySubject[subj].push({
        id: edge.id,
        prerequisite: {
          id: edge.prerequisite_topic_id,
          name: edge.source_name,
          difficulty: edge.source_difficulty,
          isCompleted: sourceCompleted,
          score: sourceAssessment?.score_percentage || null,
        },
        topic: {
          id: edge.topic_id,
          name: edge.target_name,
          difficulty: edge.target_difficulty,
          isCompleted: targetCompleted,
          score: targetAssessment?.score_percentage || null,
          confidenceLevel: targetPref?.confidence_level || 'neutral',
        },
        stepStatus,
        reason: edge.reason,
      });
    }

    // 5. Determine recommended next topic sequence
    const suggestedNextTopics = [];
    for (const edge of edges) {
      const sourceAssessment = assessedMap.get(edge.prerequisite_topic_id);
      const targetAssessment = assessedMap.get(edge.topic_id);

      // If prerequisite is passed but target is not yet assessed
      if (sourceAssessment?.passed === 1 && (!targetAssessment || targetAssessment.passed === 0)) {
        suggestedNextTopics.push({
          topicId: edge.topic_id,
          topicName: edge.target_name,
          subject: edge.target_subject,
          difficulty: edge.target_difficulty,
          unlockedBy: edge.source_name,
          reason: `Prerequisite "${edge.source_name}" completed! Ready for ${edge.target_name}.`,
          actionUrl: `/rooms?topic=${encodeURIComponent(edge.target_name)}`,
        });
      }
    }

    return {
      userId,
      pathways: pathwaysBySubject,
      suggestedNextTopics,
      totalPrerequisiteRules: edges.length,
    };
  },

  /**
   * Records a verified assessment result for a learner
   */
  recordAssessment(userId, assessmentData, customDb = null) {
    const db = customDb || getDb();
    const { topicId, scorePercentage, assessmentType = 'practice_quiz', notes = null } = assessmentData;

    if (!topicId || typeof topicId !== 'string') {
      throw new Error('Valid topicId is required');
    }
    const score = Number(scorePercentage);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error('Score percentage must be a number between 0 and 100');
    }

    const passed = score >= 70 ? 1 : 0;
    const now = new Date().toISOString();
    const id = `assess-${userId}-${topicId}-${Date.now()}`;

    const stmt = db.prepare(`
      INSERT INTO topic_assessments (id, user_id, topic_id, assessment_type, score_percentage, passed, notes, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, topicId, assessmentType, score, passed, notes, now);

    return {
      id,
      userId,
      topicId,
      assessmentType,
      scorePercentage: score,
      passed: Boolean(passed),
      assessedAt: now,
    };
  },
};

export default KnowledgeMapService;
