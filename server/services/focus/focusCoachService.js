import { getDb } from '../../db/connection.js';
import { FeedbackModel } from '../../models/feedback.model.js';

/**
 * StudySync AI — AI Focus Coach Service
 * 
 * CORE PRINCIPLES & PRIVACY ASSURANCES:
 * 1. Zero Paid APIs / Zero Cost: Uses deterministic, explainable, testable heuristic algorithms.
 * 2. Strictly Honest: Clearly labeled as rule-based heuristic analysis, NOT machine-learning prediction.
 * 3. Never Claims Mental State: Does not claim to detect attention, concentration, or mental fatigue.
 * 4. Minimal, Legitimate Data: Analyzes only database records of session durations, voluntary breaks,
 *    quiz scores, and optional self-reported notes. Zero camera, eye-tracking, or keystroke monitoring.
 */

export const FocusCoachService = {
  /**
   * Generates personalised, practical study habits and pacing recommendations
   * derived from authentic database records for the specified user.
   */
  generateFocusAdvice(userId, customDb = null) {
    const db = customDb || getDb();

    // 1. Fetch user's recorded focus intervals (last 30)
    let intervals = [];
    try {
      intervals = db.prepare(`
        SELECT id, planned_duration_seconds, actual_duration_seconds, total_paused_seconds,
               status, goal, goal_achieved, early_exit_reason, needs_revision, topic, subject,
               created_at, completed_at
        FROM user_focus_intervals
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 30
      `).all(userId);
    } catch {
      intervals = [];
    }

    // 1b. Fetch user's recorded study sessions & attendance (last 30)
    let studySessions = [];
    try {
      studySessions = db.prepare(`
        SELECT s.id, s.topic, s.subject, s.planned_duration, s.status, s.title,
               sp.individual_duration_minutes, sp.joined_at, sp.left_at,
               sp.participation_status
        FROM session_participants sp
        JOIN study_sessions s ON sp.session_id = s.id
        WHERE sp.user_id = ?
        ORDER BY sp.joined_at DESC
        LIMIT 30
      `).all(userId);
    } catch {
      studySessions = [];
    }

    // 2. Fetch user's recent verified quiz assessments (last 10)
    let assessments = [];
    try {
      assessments = db.prepare(`
        SELECT ta.id, ta.topic_id, ta.score_percentage, ta.passed, ta.assessed_at,
               lt.topic_name, lt.subject
        FROM topic_assessments ta
        JOIN learning_topics lt ON ta.topic_id = lt.id
        WHERE ta.user_id = ?
        ORDER BY ta.assessed_at DESC
        LIMIT 10
      `).all(userId);
    } catch {
      assessments = [];
    }

    // 3. Fetch user's active curriculum topics & identified weak areas
    let preferences = [];
    try {
      preferences = db.prepare(`
        SELECT ulp.*, lt.topic_name, lt.subject
        FROM user_learning_preferences ulp
        JOIN learning_topics lt ON ulp.topic_id = lt.id
        WHERE ulp.user_id = ?
      `).all(userId);
    } catch {
      preferences = [];
    }

    // Compute legitimate study session aggregates across focus intervals and study sessions
    const totalIntervals = intervals.length;
    const completedIntervals = intervals.filter((i) => i.status === 'completed');
    const cancelledIntervals = intervals.filter((i) => i.status === 'cancelled');

    const completedStudySessions = studySessions.filter(
      (s) => s.status === 'completed' || (s.individual_duration_minutes && s.individual_duration_minutes > 0)
    );

    const totalLoggedSessions = totalIntervals + studySessions.length;
    const totalCompletedSessions = completedIntervals.length + completedStudySessions.length;
    const completionRate = totalLoggedSessions > 0 ? Math.round((totalCompletedSessions / totalLoggedSessions) * 100) : 0;

    let totalActualMinutes = 0;
    let totalPlannedMinutes = 0;
    let totalPausedMinutes = 0;

    for (const iv of completedIntervals) {
      totalActualMinutes += Math.round((iv.actual_duration_seconds || 0) / 60);
      totalPlannedMinutes += Math.round((iv.planned_duration_seconds || 0) / 60);
      totalPausedMinutes += Math.round((iv.total_paused_seconds || 0) / 60);
    }

    for (const s of completedStudySessions) {
      totalActualMinutes += s.individual_duration_minutes || s.planned_duration || 0;
      totalPlannedMinutes += s.planned_duration || 0;
    }

    const avgActualMinutes = totalCompletedSessions > 0 ? Math.round(totalActualMinutes / totalCompletedSessions) : 0;
    const avgPausedMinutes = completedIntervals.length > 0 ? Math.round((totalPausedMinutes / completedIntervals.length) * 10) / 10 : 0;

    // Goals & Reflection summary
    const goalsAchievedCount = completedIntervals.filter((i) => i.goal_achieved === 'yes').length;
    const unfinishedGoalInterval = completedIntervals.find(
      (i) => i.goal && i.goal.trim().length > 0 && i.goal_achieved !== 'yes'
    ) || intervals.find((i) => i.goal && i.goal.trim().length > 0 && i.goal_achieved !== 'yes');

    const needsRevisionTopics = [
      ...new Set(
        completedIntervals
          .filter((i) => i.needs_revision === 1 && i.topic)
          .map((i) => i.topic)
      ),
    ];

    // Distractions voluntarily reported during cancellations or reflections
    const reportedDistractions = [
      ...new Set(
        cancelledIntervals
          .map((i) => i.early_exit_reason)
          .filter((r) => r && r !== 'Cancelled by user')
      ),
    ];

    // Quiz performance analysis
    const failedQuizzes = assessments.filter((a) => !a.passed || a.score_percentage < 70);
    const avgQuizScore = assessments.length > 0
      ? Math.round(assessments.reduce((sum, a) => sum + (a.score_percentage || 0), 0) / assessments.length)
      : null;

    // =========================================================
    // DETERMINISTIC HEURISTIC RECOMMENDATIONS
    // =========================================================

    let recommendedSprintMinutes = 25;
    let sprintReason = '';
    let sprintConfidence = 'baseline';

    if (totalLoggedSessions === 0) {
      // New user cold-start
      recommendedSprintMinutes = 25;
      sprintReason = 'Starting baseline: The classical 25-minute Pomodoro sprint is recommended to establish a consistent study cadence without cognitive fatigue.';
      sprintConfidence = 'standard_baseline';
    } else if (completionRate < 60 && totalLoggedSessions >= 3) {
      // User frequently cancels longer sessions
      recommendedSprintMinutes = 15;
      sprintReason = `Based on your recent ${completionRate}% completion rate across ${totalLoggedSessions} sessions, shorter 15-minute sprints reduce friction and help build completion momentum.`;
      sprintConfidence = 'derived_from_history';
    } else if (avgActualMinutes >= 40 && completionRate >= 80) {
      // User comfortably sustains extended blocks
      recommendedSprintMinutes = 45;
      sprintReason = `You consistently complete sessions averaging ${avgActualMinutes} minutes with an ${completionRate}% completion rate. A 45-minute deep study block aligns with your current stamina.`;
      sprintConfidence = 'derived_from_history';
    } else {
      // Standard balanced pace
      recommendedSprintMinutes = 25;
      sprintReason = `Your average completed session is ${avgActualMinutes || 25} minutes. Maintaining 25-minute focused blocks provides an ideal balance of depth and endurance.`;
      sprintConfidence = 'derived_from_history';
    }

    // Break Timing & Cadence Recommendation
    let recommendedBreakMinutes = 5;
    let recommendedCadenceMinutes = 25;
    let breakReason = '';

    if (avgPausedMinutes > 6) {
      recommendedBreakMinutes = 8;
      recommendedCadenceMinutes = recommendedSprintMinutes;
      breakReason = `Your logs show an average of ${avgPausedMinutes} minutes in voluntary pauses per session. Scheduling dedicated 8-minute breaks between sprints provides adequate recovery.`;
    } else if (recommendedSprintMinutes >= 45) {
      recommendedBreakMinutes = 10;
      recommendedCadenceMinutes = 45;
      breakReason = 'For extended 45-minute focus intervals, a 10-minute restorative break (hydration, standing, resting eyes) is recommended before starting your next block.';
    } else {
      recommendedBreakMinutes = 5;
      recommendedCadenceMinutes = 25;
      breakReason = 'A 5-minute break following every 25-minute sprint helps consolidate memory and prevent mental fatigue.';
    }

    // Concrete Practical Study Goals Recommendation
    const recommendedGoals = [];

    // Goal 1: Address failed quiz if present
    if (failedQuizzes.length > 0) {
      const topFailed = failedQuizzes[0];
      recommendedGoals.push({
        id: `goal-quiz-${topFailed.topic_id}`,
        type: 'quiz_revision',
        priority: 'high',
        topic: topFailed.topic_name,
        subject: topFailed.subject,
        goal: `Revise core concepts in ${topFailed.topic_name} and retake practice quiz (previous score: ${topFailed.score_percentage}%).`,
        reason: `Your verified assessment on ${topFailed.topic_name} recorded ${topFailed.score_percentage}% on ${topFailed.assessed_at ? topFailed.assessed_at.slice(0, 10) : 'recent date'}.`,
        suggestedMinutes: recommendedSprintMinutes,
      });
    }

    // Goal 2: Resume unfinished goal if present
    if (unfinishedGoalInterval) {
      recommendedGoals.push({
        id: `goal-resume-${unfinishedGoalInterval.id}`,
        type: 'resume_unfinished_goal',
        priority: 'high',
        topic: unfinishedGoalInterval.topic || 'General Study',
        subject: unfinishedGoalInterval.subject || 'Coursework',
        goal: `Follow through on goal: ${unfinishedGoalInterval.goal}`,
        reason: 'You logged this goal in a previous focus interval but did not record it as fully completed.',
        suggestedMinutes: recommendedSprintMinutes,
      });
    }

    // Goal 3: Topics explicitly marked as needing revision in reflection
    if (needsRevisionTopics.length > 0) {
      const revTopic = needsRevisionTopics[0];
      if (!recommendedGoals.some((g) => g.topic === revTopic)) {
        recommendedGoals.push({
          id: `goal-reflection-${encodeURIComponent(revTopic)}`,
          type: 'reflection_revision',
          priority: 'medium',
          topic: revTopic,
          subject: 'Flagged for Revision',
          goal: `Work through 3 problem examples or write a 1-page concept summary for ${revTopic}.`,
          reason: 'You marked this topic as needing revision in your post-session reflection.',
          suggestedMinutes: recommendedSprintMinutes,
        });
      }
    }

    // Goal 4: Explicit learning goal configured in preferences
    const prefWithCustomGoal = preferences.find(
      (p) => p.learning_goal && p.learning_goal.trim().length > 0 && !recommendedGoals.some((g) => g.goal.includes(p.learning_goal))
    );
    if (prefWithCustomGoal && recommendedGoals.length < 3) {
      recommendedGoals.push({
        id: `goal-pref-${prefWithCustomGoal.topic_id}`,
        type: 'curriculum_goal',
        priority: 'medium',
        topic: prefWithCustomGoal.topic_name,
        subject: prefWithCustomGoal.subject,
        goal: prefWithCustomGoal.learning_goal,
        reason: `Configured learning target from your Learning DNA for ${prefWithCustomGoal.topic_name}.`,
        suggestedMinutes: recommendedSprintMinutes,
      });
    }

    // Goal 5: Topics where learner wants peer support or marked needs improvement
    const weakPrefs = preferences.filter(
      (p) => p.confidence_level === 'needs_improvement' || p.wants_peer_support
    );
    if (weakPrefs.length > 0 && recommendedGoals.length < 3) {
      const weak = weakPrefs[0];
      if (!recommendedGoals.some((g) => g.topic === weak.topic_name)) {
        recommendedGoals.push({
          id: `goal-weak-${weak.topic_id}`,
          type: 'weak_area',
          priority: 'medium',
          topic: weak.topic_name,
          subject: weak.subject,
          goal: `Deep dive into ${weak.topic_name} definitions, theorems, or architecture diagrams.`,
          reason: 'Marked as an area needing improvement in your Learning DNA preferences.',
          suggestedMinutes: recommendedSprintMinutes,
        });
      }
    }

    // Goal 6: Default foundational habit goal if list is short
    if (recommendedGoals.length < 2 && preferences.length > 0) {
      const activePref = preferences.find((p) => p.is_learning_now) || preferences[0];
      if (!recommendedGoals.some((g) => g.topic === activePref.topic_name)) {
        recommendedGoals.push({
          id: `goal-active-${activePref.topic_id}`,
          type: 'coursework_target',
          priority: 'standard',
          topic: activePref.topic_name,
          subject: activePref.subject,
          goal: `Complete one curriculum section or problem set for ${activePref.topic_name}.`,
          reason: 'Current active study coursework from your learner profile.',
          suggestedMinutes: recommendedSprintMinutes,
        });
      }
    } else if (recommendedGoals.length === 0) {
      recommendedGoals.push({
        id: 'goal-cold-start-default',
        type: 'onboarding_baseline',
        priority: 'standard',
        topic: 'Curriculum Exploration',
        subject: 'General Study',
        goal: 'Complete a 25-minute introductory session on your primary syllabus topic.',
        reason: 'Foundational baseline goal for new learners establishing study habits.',
        suggestedMinutes: 25,
      });
    }

    // Distraction insights (if user opted to share exit reasons)
    let distractionInsight = null;
    if (reportedDistractions.length > 0) {
      distractionInsight = {
        hasReportedDistractions: true,
        distractionsList: reportedDistractions.slice(0, 3),
        advice: `You previously noted interruptions such as "${reportedDistractions[0]}". Activating StudySync Distraction Shield suppresses in-app notifications to protect your sprint.`,
      };
    } else {
      distractionInsight = {
        hasReportedDistractions: false,
        advice: 'No recurring distractions logged. You can optionally record early exit reasons when ending a sprint to identify interruption patterns.',
      };
    }

    const finalGoals = recommendedGoals.slice(0, 3);

    // Track presented goals for recommendation evaluation
    if (userId) {
      for (const rg of finalGoals) {
        try {
          FeedbackModel.trackRecommendation({
            id: `rec-fc-${rg.id}`,
            userId,
            recommendationType: 'focus_coach_goal',
            targetId: rg.id,
            topic: rg.topic,
            subject: rg.subject,
            engineVersion: 'v1-focus-coach',
          }, db);
        } catch {
          // Non-blocking
        }
      }
    }

    return {
      engine: 'deterministic_rule_based',
      is_machine_learning: false,
      ai_label: 'Deterministic Heuristic Focus Coach',
      methodology: 'Transparent rule-based heuristic derived directly from past interval lengths, voluntary pauses, and verified quiz scores.',
      privacy_guarantee: 'Zero camera monitoring, keystroke logging, or background surveillance. Operates 100% locally on your database records.',
      disclaimer: 'StudySync AI does not measure or claim to detect your mental focus, concentration level, or psychological state.',
      summary: {
        totalLoggedSessions,
        completedSessions: totalCompletedSessions,
        completionRatePercentage: completionRate,
        averageRecordedMinutes: avgActualMinutes,
        averagePausedMinutes: avgPausedMinutes,
        goalsAchievedCount,
        quizzesAnalyzed: assessments.length,
        averageQuizScore: avgQuizScore,
        isColdStart: totalLoggedSessions === 0,
      },
      pacingRecommendation: {
        recommendedSprintMinutes,
        sprintReason,
        sprintConfidence,
        recommendedBreakMinutes,
        recommendedCadenceMinutes,
        breakReason,
      },
      recommendedGoals: finalGoals,
      distractionInsight,
    };
  },
};

export default FocusCoachService;
