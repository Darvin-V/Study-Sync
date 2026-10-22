import { getDb } from '../../db/connection.js';
import { MatchingEngine } from '../matching/matchingEngine.js';
import { FeedbackModel } from '../../models/feedback.model.js';

/**
 * StudySync AI — Personalised Learning Recommendations Service (Phase 9 & 12)
 * 
 * Generates transparent, actionable study recommendations derived
 * directly from real database records (preferences, session history,
 * doubts asked, and available curriculum resources).
 * 
 * In Phase 12, recommendations are tracked through a verified feedback loop
 * that monitors acceptance, dismissal, and observable follow-through.
 */

export const RecommendationTypes = Object.freeze({
  CONTINUE_TOPIC: 'continue_topic',
  PEER_HELP: 'peer_help',
  REVISIT_TOPIC: 'revisit_topic',
  JOIN_ROOM: 'join_room',
  REVIEW_RESOURCE: 'review_resource',
  ONBOARDING_EXPLORE: 'onboarding_explore',
  NEXT_LEARNING_TASK: 'next_learning_task',
  REVISE_WEAK_AREA: 'revise_weak_area',
  REVISE_DIFFICULT_TOPIC: 'revise_difficult_topic',
  UNFINISHED_GOAL: 'unfinished_goal',
  PRACTICE_QUIZ: 'practice_quiz',
});

export const LearningRecommendationService = {
  /**
   * Retrieves personalised recommendations for an authenticated user
   */
  getRecommendationsForUser(userId, customDb = null) {
    const db = customDb || getDb();
    const recommendations = [];

    // Fetch recently dismissed or followed-through recommendation targets (past 7 days) to prevent stale duplicates
    let recentlyDismissed = new Set();
    try {
      recentlyDismissed = new Set(
        db.prepare(`
          SELECT LOWER(target_id) AS target_id, LOWER(id) AS id
          FROM recommendation_tracking
          WHERE user_id = ?
            AND lifecycle_status IN ('dismissed', 'followed_through')
            AND datetime(updated_at) >= datetime('now', '-7 days')
        `).all(userId).flatMap((r) => [r.target_id, r.id]).filter(Boolean)
      );
    } catch {
      // Table may not exist yet in early test runs
    }

    // Fetch targets explicitly marked irrelevant by user
    let explicitlyIrrelevantTargets = new Set();
    try {
      explicitlyIrrelevantTargets = new Set(
        db.prepare(`
          SELECT LOWER(target_id) AS target_id
          FROM recommendation_explicit_feedback
          WHERE user_id = ? AND is_relevant = 0
        `).all(userId).map((r) => r.target_id).filter(Boolean)
      );
    } catch {}

    // 1. Fetch user's profile and learning preferences
    const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
    const preferences = db.prepare(`
      SELECT ulp.*, lt.subject, lt.topic_name, lt.difficulty_level
      FROM user_learning_preferences ulp
      JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE ulp.user_id = ?
    `).all(userId);

    const enrolledSubjects = db.prepare(`
      SELECT subject FROM user_subjects WHERE user_id = ?
    `).all(userId).map((s) => s.subject);

    // If completely new user with no preferences, return onboarding exploration
    if (preferences.length === 0 && enrolledSubjects.length === 0) {
      return [
        {
          id: 'rec-onboarding-topics',
          type: RecommendationTypes.ONBOARDING_EXPLORE,
          title: 'Select Your Active Curriculum Topics',
          topic: 'Curriculum Onboarding',
          subject: 'All Subjects',
          reason: 'You have not set your learning preferences yet. Select topics you are studying to enable peer matching.',
          actionType: 'NAVIGATE_ONBOARDING',
          actionUrl: '/onboarding',
          actionLabel: 'Complete Profile',
          ai_enhanced: false,
          engine: 'deterministic_rule_based',
        },
        {
          id: 'rec-onboarding-rooms',
          type: RecommendationTypes.JOIN_ROOM,
          title: 'Explore Open Topic Rooms',
          topic: 'Topic Rooms',
          subject: 'Collaborative Study',
          reason: 'Join an active room to meet students studying Database Systems, Algorithms, and Operating Systems.',
          actionType: 'NAVIGATE_ROOMS',
          actionUrl: '/rooms',
          actionLabel: 'Browse Rooms',
          ai_enhanced: false,
          engine: 'deterministic_rule_based',
        },
      ];
    }

    // 2. Fetch user's study session history
    const recentSessions = db.prepare(`
      SELECT ss.*, sp.joined_at, sp.total_attendance_seconds
      FROM session_participants sp
      JOIN study_sessions ss ON sp.session_id = ss.id
      WHERE sp.user_id = ?
      ORDER BY sp.joined_at DESC
      LIMIT 10
    `).all(userId);

    // 3. Fetch unresolved doubts asked by user in rooms
    const unresolvedQuestions = db.prepare(`
      SELECT rq.*, r.room_name
      FROM room_questions rq
      JOIN rooms r ON rq.room_id = r.id
      WHERE rq.asker_id = ? AND rq.is_resolved = 0
      ORDER BY rq.created_at DESC
      LIMIT 3
    `).all(userId);

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // ADAPTIVE REC: Revise Weak Area or Unmastered Assessment
    // -------------------------------------------------------------
    const weakQuiz = db.prepare(`
      SELECT ta.*, lt.topic_name, lt.subject
      FROM topic_assessments ta
      JOIN learning_topics lt ON ta.topic_id = lt.id
      WHERE ta.user_id = ? AND (ta.passed = 0 OR ta.score_percentage < 70)
      ORDER BY ta.assessed_at DESC
      LIMIT 1
    `).get(userId);

    if (weakQuiz) {
      recommendations.push({
        id: `rec-revise-weak-${weakQuiz.topic_id}`,
        type: RecommendationTypes.REVISE_WEAK_AREA,
        title: `Revise ${weakQuiz.topic_name} (Assessment Review)`,
        topic: weakQuiz.topic_name,
        subject: weakQuiz.subject,
        reason: `Scored ${weakQuiz.score_percentage}% on your recent practice assessment. Targeted revision reinforces foundational concepts before moving to advanced topics.`,
        actionType: 'START_STUDY_SESSION',
        actionUrl: `/sessions?topic=${encodeURIComponent(weakQuiz.topic_name)}`,
        actionLabel: 'Revise Topic',
        topicId: weakQuiz.topic_id,
        suggestedAction: 'Revise notes & practice questions',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // ADAPTIVE REC: Revisit Topics Marked Difficult in Profile/Reflection
    // -------------------------------------------------------------
    const difficultPref = preferences.find(
      (p) => (p.confidence_level === 'needs_improvement' || p.is_improving) && (!weakQuiz || p.topic_id !== weakQuiz.topic_id)
    );
    if (difficultPref && !recommendations.some((r) => r.topic === difficultPref.topic_name)) {
      recommendations.push({
        id: `rec-difficult-${difficultPref.topic_id}`,
        type: RecommendationTypes.REVISE_DIFFICULT_TOPIC,
        title: `Revisit Difficult Topic: ${difficultPref.topic_name}`,
        topic: difficultPref.topic_name,
        subject: difficultPref.subject,
        reason: `You marked ${difficultPref.topic_name} as needs improvement in your Learning DNA preferences. Reviewing notes and key proofs strengthens foundational confidence.`,
        actionType: 'START_STUDY_SESSION',
        actionUrl: `/sessions?topic=${encodeURIComponent(difficultPref.topic_name)}`,
        actionLabel: 'Review Notes & Practice',
        topicId: difficultPref.topic_id,
        suggestedAction: 'Review notes & practice proofs',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // ADAPTIVE REC: Unfinished Study Goals
    // -------------------------------------------------------------
    let unfinishedGoal = null;
    try {
      unfinishedGoal = db.prepare(`
        SELECT id, topic, subject, goal, goal_achieved, created_at
        FROM user_focus_intervals
        WHERE user_id = ? AND goal IS NOT NULL AND TRIM(goal) != ''
          AND (goal_achieved = 'partial' OR goal_achieved = 'no')
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId);
    } catch {
      unfinishedGoal = null;
    }

    if (unfinishedGoal) {
      recommendations.push({
        id: `rec-unfinished-goal-${unfinishedGoal.id}`,
        type: RecommendationTypes.UNFINISHED_GOAL,
        title: `Complete Goal: ${unfinishedGoal.goal}`,
        topic: unfinishedGoal.topic || 'Goal Completion',
        subject: unfinishedGoal.subject || 'Coursework',
        reason: `You logged this goal during an earlier study session on ${unfinishedGoal.topic || 'your coursework'} with incomplete/partial status. Completing planned milestones reinforces learning momentum.`,
        actionType: 'START_STUDY_SESSION',
        actionUrl: `/sessions?topic=${encodeURIComponent(unfinishedGoal.topic || '')}&goal=${encodeURIComponent(unfinishedGoal.goal)}`,
        actionLabel: 'Complete Goal in Session',
        targetId: unfinishedGoal.id,
        suggestedAction: 'Complete learning goal in study sprint',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // ADAPTIVE REC: Next Learning Task in Prerequisite Pathway
    // -------------------------------------------------------------
    const passedAssessments = db.prepare(`
      SELECT ta.*, lt.topic_name, lt.subject
      FROM topic_assessments ta
      JOIN learning_topics lt ON ta.topic_id = lt.id
      WHERE ta.user_id = ? AND ta.passed = 1 AND ta.score_percentage >= 70
      ORDER BY ta.assessed_at DESC
      LIMIT 5
    `).all(userId);

    if (passedAssessments.length > 0) {
      for (const passed of passedAssessments) {
        const nextTopicRow = db.prepare(`
          SELECT lt.id, lt.topic_name, lt.subject
          FROM topic_prerequisites tp
          JOIN learning_topics lt ON tp.topic_id = lt.id
          WHERE tp.prerequisite_topic_id = ?
            AND lt.id NOT IN (
              SELECT topic_id FROM topic_assessments WHERE user_id = ? AND passed = 1
            )
          LIMIT 1
        `).get(passed.topic_id, userId);

        if (nextTopicRow && !recommendations.some((r) => r.topic === nextTopicRow.topic_name)) {
          recommendations.push({
            id: `rec-next-task-${nextTopicRow.id}`,
            type: RecommendationTypes.NEXT_LEARNING_TASK,
            title: `Next Learning Task: ${nextTopicRow.topic_name}`,
            topic: nextTopicRow.topic_name,
            subject: nextTopicRow.subject,
            reason: `You completed prerequisite "${passed.topic_name}" (Quiz score: ${passed.score_percentage}%). Progressing to ${nextTopicRow.topic_name} is the recommended next step in your curriculum pathway.`,
            actionType: 'START_STUDY_SESSION',
            actionUrl: `/sessions?topic=${encodeURIComponent(nextTopicRow.topic_name)}`,
            actionLabel: 'Start Next Task',
            topicId: nextTopicRow.id,
            suggestedAction: 'Advance to next curriculum milestone',
            ai_enhanced: false,
            engine: 'deterministic_rule_based',
          });
          break;
        }
      }
    }

    // -------------------------------------------------------------
    // REC: Continue Studying an Active Topic
    // -------------------------------------------------------------
    // Topics marked needs_improvement or is_improving are prioritized as REVISE_DIFFICULT_TOPIC
    const activePrefs = preferences.filter(
      (p) => p.is_learning_now && p.confidence_level !== 'needs_improvement' && !p.is_improving && !recommendations.some((r) => r.topic === p.topic_name)
    );
    if (activePrefs.length > 0) {
      const topActive = activePrefs[0];
      recommendations.push({
        id: `rec-continue-${topActive.topic_id}`,
        type: RecommendationTypes.CONTINUE_TOPIC,
        title: `Continue Coursework in ${topActive.topic_name}`,
        topic: topActive.topic_name,
        subject: topActive.subject,
        reason: `Marked as an active study target in your learner profile with goal: "${topActive.learning_goal || 'Exam Revision'}".`,
        actionType: 'START_STUDY_SESSION',
        actionUrl: `/discover?subject=${encodeURIComponent(topActive.subject)}&topic=${encodeURIComponent(topActive.topic_name)}`,
        actionLabel: 'Find Study Partner',
        topicId: topActive.topic_id,
        suggestedAction: 'Collaborative practice with study partner',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // ADAPTIVE REC: Suggest Practice Quiz for Studied Topic Without Verified Mastery
    // -------------------------------------------------------------
    try {
      const unverifiedStudied = db.prepare(`
        SELECT DISTINCT ss.topic, ss.subject, lt.id AS topic_id, lt.topic_name
        FROM session_participants sp
        JOIN study_sessions ss ON sp.session_id = ss.id
        JOIN learning_topics lt ON LOWER(ss.topic) = LOWER(lt.topic_name) OR LOWER(ss.topic) LIKE '%' || LOWER(lt.topic_name) || '%'
        WHERE sp.user_id = ? AND (ss.status = 'completed' OR sp.individual_duration_minutes > 0)
          AND lt.id NOT IN (
            SELECT topic_id FROM topic_assessments WHERE user_id = ? AND passed = 1
          )
        LIMIT 1
      `).get(userId, userId);

      if (unverifiedStudied && !recommendations.some((r) => r.topic === unverifiedStudied.topic_name)) {
        recommendations.push({
          id: `rec-practice-quiz-${unverifiedStudied.topic_id}`,
          type: RecommendationTypes.PRACTICE_QUIZ,
          title: `Validate Mastery: Practice Quiz for ${unverifiedStudied.topic_name}`,
          topic: unverifiedStudied.topic_name,
          subject: unverifiedStudied.subject,
          reason: `You completed study sessions on ${unverifiedStudied.topic_name}, but have not yet verified your understanding with a practice assessment.`,
          actionType: 'NAVIGATE_KNOWLEDGE_MAP',
          actionUrl: `/knowledge-map?topic=${encodeURIComponent(unverifiedStudied.topic_name)}`,
          actionLabel: 'Take Practice Quiz',
          topicId: unverifiedStudied.topic_id,
          suggestedAction: 'Take a practice quiz to verify topic understanding',
          ai_enhanced: false,
          engine: 'deterministic_rule_based',
        });
      }
    } catch {
      // Table safety
    }

    // -------------------------------------------------------------
    // REC 2: Peer Help for Difficult Topics / Learning DNA Peer Support
    // -------------------------------------------------------------
    // Check topics where user explicitly requested peer support or marked needs improvement
    const supportNeededPrefs = preferences.filter((p) => p.wants_peer_support || p.is_improving || p.confidence_level === 'needs_improvement');
    
    // Also check if any recent assessment failed (< 70%)
    const failedAssessment = db.prepare(`
      SELECT ta.*, lt.topic_name, lt.subject
      FROM topic_assessments ta
      JOIN learning_topics lt ON ta.topic_id = lt.id
      WHERE ta.user_id = ? AND ta.passed = 0
      ORDER BY ta.assessed_at DESC
      LIMIT 1
    `).get(userId);

    if (supportNeededPrefs.length > 0 || failedAssessment) {
      const targetTopicName = failedAssessment ? failedAssessment.topic_name : supportNeededPrefs[0].topic_name;
      const targetSubject = failedAssessment ? failedAssessment.subject : supportNeededPrefs[0].subject;
      const targetTopicId = failedAssessment ? failedAssessment.topic_id : supportNeededPrefs[0].topic_id;
      const wantsSupport = !failedAssessment && Boolean(supportNeededPrefs[0]?.wants_peer_support);

      // Find an eligible peer candidate with verified strength or willing to teach this topic
      const candidates = MatchingEngine.findMatches(userId, {
        topic: targetTopicName,
        subject: targetSubject,
        limit: 5,
      }, db);

      const willingTeacher = candidates.find((c) =>
        c.willingToTeach?.some((t) => t.toLowerCase().includes(targetTopicName.toLowerCase()) || targetTopicName.toLowerCase().includes(t.toLowerCase())) ||
        c.strengths?.some((s) => s.toLowerCase().includes(targetTopicName.toLowerCase()) || targetTopicName.toLowerCase().includes(s.toLowerCase()))
      ) || candidates[0];

      if (willingTeacher) {
        let reason = `You marked ${targetTopicName} as an area needing improvement. ${willingTeacher.studentName} has verified strength in this topic.`;
        if (failedAssessment) {
          reason = `Scored ${failedAssessment.score_percentage}% on ${targetTopicName} assessment. ${willingTeacher.studentName} has verified strength and can help clarify concepts.`;
        } else if (wantsSupport) {
          reason = `You requested peer support for ${targetTopicName} in your Learning DNA. ${willingTeacher.studentName} is willing to teach and matches your study schedule.`;
        }

        recommendations.push({
          id: `rec-peer-help-${targetTopicId}`,
          type: RecommendationTypes.PEER_HELP,
          title: `Connect with ${willingTeacher.studentName} for ${targetTopicName}`,
          topic: targetTopicName,
          subject: targetSubject,
          reason,
          actionType: 'VIEW_PEER_PROFILE',
          targetPeerId: willingTeacher.studentId,
          targetPeerName: willingTeacher.studentName,
          targetPeerInitials: willingTeacher.studentInitials,
          compatibilityScore: willingTeacher.compatibilityScore,
          actionLabel: `Study with ${willingTeacher.studentName}`,
          suggestedAction: `Connect with ${willingTeacher.studentName} for peer discussion`,
          ai_enhanced: false,
          engine: 'deterministic_rule_based',
        });
      }
    } else if (unresolvedQuestions.length > 0) {
      const q = unresolvedQuestions[0];
      recommendations.push({
        id: `rec-unresolved-doubt-${q.id}`,
        type: RecommendationTypes.PEER_HELP,
        title: `Resolve Doubt in ${q.room_name}`,
        topic: q.topic || 'Doubt Discussion',
        subject: 'Coursework Question',
        reason: `You asked: "${q.question_content.slice(0, 75)}...". Connect with peers in the room to discuss solutions.`,
        actionType: 'NAVIGATE_ROOM',
        actionUrl: `/rooms?room=${q.room_id}`,
        actionLabel: 'View Question in Room',
        suggestedAction: 'Discuss unresolved question in study room',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // REC 3: Spaced Revision for Topic Not Studied Recently
    // -------------------------------------------------------------
    // Compare active preferences with recent sessions
    const studiedTopicNames = new Set(recentSessions.map((s) => s.topic.toLowerCase()));
    const unstudiedPref = preferences.find((p) => !studiedTopicNames.has(p.topic_name.toLowerCase()));

    if (unstudiedPref) {
      recommendations.push({
        id: `rec-spaced-revision-${unstudiedPref.topic_id}`,
        type: RecommendationTypes.REVISIT_TOPIC,
        title: `Review ${unstudiedPref.topic_name} (Spaced Revision)`,
        topic: unstudiedPref.topic_name,
        subject: unstudiedPref.subject,
        reason: `You haven't recorded a study session for ${unstudiedPref.topic_name} recently. Regular recall strengthens retention.`,
        actionType: 'START_STUDY_SESSION',
        actionUrl: `/sessions?topic=${encodeURIComponent(unstudiedPref.topic_name)}`,
        actionLabel: 'Schedule Review',
        suggestedAction: 'Review notes to strengthen long-term memory',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // REC 4: Join an Active Topic Room on User's Subjects
    // -------------------------------------------------------------
    const subjectsToMatch = enrolledSubjects.length > 0 ? enrolledSubjects : ['Database Systems'];
    const placeholders = subjectsToMatch.map(() => '?').join(',');

    const availableRooms = db.prepare(`
      SELECT r.*, COUNT(rm.id) AS member_count
      FROM rooms r
      LEFT JOIN room_memberships rm ON r.id = rm.room_id
      WHERE r.status = 'active'
        AND r.subject IN (${placeholders})
        AND r.id NOT IN (
          SELECT room_id FROM room_memberships WHERE user_id = ?
        )
      GROUP BY r.id
      ORDER BY member_count DESC, r.created_at DESC
      LIMIT 2
    `).all(...subjectsToMatch, userId);

    if (availableRooms.length > 0) {
      const topRoom = availableRooms[0];
      recommendations.push({
        id: `rec-join-room-${topRoom.id}`,
        type: RecommendationTypes.JOIN_ROOM,
        title: `Join Topic Room "${topRoom.room_name}"`,
        topic: topRoom.topic,
        subject: topRoom.subject,
        reason: `Active topic room aligned with your ${topRoom.subject} curriculum with ${topRoom.member_count} enrolled peer${topRoom.member_count !== 1 ? 's' : ''}.`,
        actionType: 'NAVIGATE_ROOM',
        actionUrl: `/rooms?room=${topRoom.id}`,
        actionLabel: 'Join Room',
        roomId: topRoom.id,
        suggestedAction: 'Collaborate with peers in active study room',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // -------------------------------------------------------------
    // REC 5: Revisit a High-Value Study Resource or Cheatsheet
    // -------------------------------------------------------------
    const relevantResources = db.prepare(`
      SELECT nr.*, u.display_name AS author_name
      FROM notes_resources nr
      LEFT JOIN users u ON nr.author_id = u.id
      WHERE nr.is_archived = 0
        AND nr.visibility IN ('public', 'room_shared')
        AND (
          nr.author_id = ? OR
          nr.room_id IN (SELECT room_id FROM room_memberships WHERE user_id = ?)
        )
      ORDER BY nr.created_at DESC
      LIMIT 1
    `).all(userId, userId);

    if (relevantResources.length > 0) {
      const res = relevantResources[0];
      recommendations.push({
        id: `rec-resource-${res.id}`,
        type: RecommendationTypes.REVIEW_RESOURCE,
        title: `Review ${res.title}`,
        topic: res.topic,
        subject: res.subject,
        reason: `Shared ${res.resource_type || 'study notes'} by ${res.author_name || 'peer'} covering ${res.topic}.`,
        actionType: 'VIEW_RESOURCE',
        actionUrl: `/notes`,
        actionLabel: 'Open Notes',
        resourceId: res.id,
        suggestedAction: 'Read shared study notes & summary',
        ai_enhanced: false,
        engine: 'deterministic_rule_based',
      });
    }

    // Phase 12: Filter out recommendations recently dismissed within the past 7 days
    const activeRecommendations = recommendations.filter((rec) => {
      const targets = [
        rec.targetPeerId,
        rec.roomId,
        rec.resourceId,
        rec.topicId,
        rec.targetId,
        rec.topic,
        rec.id,
      ].filter(Boolean).map((t) => String(t).toLowerCase());

      const isDismissed = targets.some((t) =>
        recentlyDismissed.has(t) ||
        explicitlyIrrelevantTargets.has(t) ||
        Array.from(recentlyDismissed).some((d) => t.includes(d) || d.includes(t)) ||
        Array.from(explicitlyIrrelevantTargets).some((d) => t.includes(d) || d.includes(t))
      );
      return !isDismissed;
    });

    // Phase 12: Ensure all generated recommendations have persistent tracking IDs
    const trackedRecommendations = activeRecommendations.map((rec) => {
      try {
        const targetId = rec.targetPeerId || rec.roomId || rec.resourceId || rec.topicId || rec.targetId || rec.topic || rec.id;
        const tracked = FeedbackModel.trackRecommendation({
          id: rec.id,
          userId,
          recommendationType: rec.type,
          targetId: String(targetId),
          topic: rec.topic,
          subject: rec.subject,
          engineVersion: 'v2-adaptive',
        }, db);

        return {
          ...rec,
          trackingId: tracked.id,
          lifecycleStatus: tracked.lifecycle_status,
        };
      } catch {
        return rec;
      }
    });

    return trackedRecommendations;
  },

  /**
   * Records user interaction with a recommendation (e.g. accepted, dismissed, explicit feedback)
   */
  recordInteraction(userId, {
    recommendationId,
    trackingId,
    recommendationType,
    targetId,
    action,
    feedbackText = null,
    isRelevant = null,
    qualityRating = null,
    reasonTag = null,
  }, customDb = null) {
    const db = customDb || getDb();
    const id = `rec-int-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO recommendation_interactions (
        id, user_id, recommendation_type, target_id, action, feedback_text, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      recommendationType || 'general',
      targetId || recommendationId || 'unknown',
      action || 'viewed',
      feedbackText,
      now
    );

    // Phase 12 lifecycle tracking & explicit feedback
    const trackRef = trackingId || targetId || (typeof recommendationId === 'string' ? recommendationId : null);
    if (trackRef && (action === 'accepted' || action === 'dismissed' || action === 'followed_through')) {
      try {
        FeedbackModel.updateRecommendationLifecycle(trackRef, userId, {
          status: action,
          targetId: targetId || null,
          recommendationType: recommendationType || null,
        }, db);
      } catch (err) {
        if (err.code !== 'FORBIDDEN' && err.code !== 'NOT_FOUND') {
          console.error('Failed to update recommendation lifecycle:', err);
        }
      }
    }

    if ((isRelevant !== null && isRelevant !== undefined) || qualityRating !== null || reasonTag !== null || feedbackText) {
      try {
        FeedbackModel.submitRecommendationFeedback(userId, {
          trackingId: trackRef,
          recommendationType: recommendationType || 'general',
          targetId: targetId || recommendationId || 'unknown',
          isRelevant,
          qualityRating,
          reasonTag,
          feedbackText,
        }, db);
      } catch {}
    }

    return { id, trackingId: trackRef, recorded: true, action, timestamp: now };
  },
};

export default LearningRecommendationService;
