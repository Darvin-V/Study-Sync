import { getDb } from '../../db/connection.js';

/**
 * StudySync AI — Recommendation Evaluation & Feedback Metrics Service (Phase 4 / Phase 12)
 * 
 * Computes transparent, verifiable engineering metrics directly from recorded application data.
 * Adheres to strict statistical honesty:
 * - Documents precise numerators and denominators
 * - Distinguishes missing feedback from negative feedback
 * - Reports sample size (N) openly and flags small samples
 * - Never claims AI model learning or educational mastery without evidence
 * - Evaluates across Adaptive Learning, Study Partner Matching, and Focus Coach
 * - Supports both platform-wide and authenticated user-isolated evaluation scopes
 */
export const EvaluationMetricsService = {
  /**
   * Computes comprehensive recommendation and feedback evaluation metrics.
   * Supports user-specific scoping or platform-wide evaluation.
   */
  getEvaluationMetrics(userIdOrDb = null, customDb = null) {
    let userId = null;
    let db = null;

    if (userIdOrDb && typeof userIdOrDb === 'object' && typeof userIdOrDb.prepare === 'function') {
      db = userIdOrDb;
      userId = null;
    } else {
      userId = typeof userIdOrDb === 'string' ? userIdOrDb : null;
      db = customDb || getDb();
    }

    const userRecWhere = userId ? 'WHERE user_id = ?' : '';
    const userRecParams = userId ? [userId] : [];

    const userPeerWhere = userId ? 'WHERE giver_user_id = ?' : '';
    const userPeerParams = userId ? [userId] : [];

    const userExpWhere = userId ? 'WHERE user_id = ?' : '';
    const userExpParams = userId ? [userId] : [];

    // ========================================================================
    // 1. Recommendation Lifecycle Totals
    // ========================================================================
    const recTotals = db.prepare(`
      SELECT 
        COUNT(*) AS total_tracked,
        SUM(CASE WHEN lifecycle_status = 'presented' THEN 1 ELSE 0 END) AS presented_count,
        SUM(CASE WHEN lifecycle_status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
        SUM(CASE WHEN lifecycle_status = 'dismissed' THEN 1 ELSE 0 END) AS dismissed_count,
        SUM(CASE WHEN lifecycle_status = 'followed_through' THEN 1 ELSE 0 END) AS followed_through_count
      FROM recommendation_tracking
      ${userRecWhere}
    `).get(...userRecParams);

    const totalTracked = recTotals?.total_tracked || 0;
    const acceptedOnly = recTotals?.accepted_count || 0;
    const dismissedCount = recTotals?.dismissed_count || 0;
    const followedThroughCount = recTotals?.followed_through_count || 0;
    const totalAcceptedOrFollowed = acceptedOnly + followedThroughCount;

    // Acceptance Rate = (Accepted + Followed Through) / Total Tracked
    const acceptanceRate = totalTracked > 0
      ? Math.round((totalAcceptedOrFollowed / totalTracked) * 100)
      : null;

    // Follow-Through Rate = Followed Through / (Accepted + Followed Through)
    const followThroughRate = totalAcceptedOrFollowed > 0
      ? Math.round((followedThroughCount / totalAcceptedOrFollowed) * 100)
      : null;

    // ========================================================================
    // 2. Peer Collaboration Feedback Metrics
    // ========================================================================
    const peerTotals = db.prepare(`
      SELECT 
        COUNT(*) AS total_reviews,
        SUM(CASE WHEN was_helpful = 1 THEN 1 ELSE 0 END) AS helpful_yes,
        SUM(CASE WHEN was_helpful = 0 THEN 1 ELSE 0 END) AS helpful_no,
        SUM(CASE WHEN was_helpful IS NOT NULL THEN 1 ELSE 0 END) AS helpful_answered,
        SUM(CASE WHEN would_study_again = 1 THEN 1 ELSE 0 END) AS repeat_yes,
        SUM(CASE WHEN would_study_again = 0 THEN 1 ELSE 0 END) AS repeat_no,
        SUM(CASE WHEN would_study_again IS NOT NULL THEN 1 ELSE 0 END) AS repeat_answered,
        SUM(CASE WHEN topic_relevance = 1 THEN 1 ELSE 0 END) AS topic_rel_yes,
        SUM(CASE WHEN topic_relevance IS NOT NULL THEN 1 ELSE 0 END) AS topic_rel_answered
      FROM peer_collaboration_feedback
      ${userPeerWhere}
    `).get(...userPeerParams);

    const totalPeerReviews = peerTotals?.total_reviews || 0;
    const helpfulAnswered = peerTotals?.helpful_answered || 0;
    const helpfulYes = peerTotals?.helpful_yes || 0;
    const helpfulRate = helpfulAnswered > 0
      ? Math.round((helpfulYes / helpfulAnswered) * 100)
      : null;

    const repeatAnswered = peerTotals?.repeat_answered || 0;
    const repeatYes = peerTotals?.repeat_yes || 0;
    const repeatStudyRate = repeatAnswered > 0
      ? Math.round((repeatYes / repeatAnswered) * 100)
      : null;

    const topicRelAnswered = peerTotals?.topic_rel_answered || 0;
    const topicRelYes = peerTotals?.topic_rel_yes || 0;
    const peerTopicRelevanceRate = topicRelAnswered > 0
      ? Math.round((topicRelYes / topicRelAnswered) * 100)
      : null;

    // ========================================================================
    // 3. Explicit Recommendation Relevance Metrics
    // ========================================================================
    const recFeedbackTotals = db.prepare(`
      SELECT 
        COUNT(*) AS total_feedback,
        SUM(CASE WHEN is_relevant = 1 THEN 1 ELSE 0 END) AS relevant_yes,
        SUM(CASE WHEN is_relevant = 0 THEN 1 ELSE 0 END) AS relevant_no,
        SUM(CASE WHEN is_relevant IS NOT NULL THEN 1 ELSE 0 END) AS relevant_answered,
        AVG(quality_rating) AS avg_quality_rating
      FROM recommendation_explicit_feedback
      ${userExpWhere}
    `).get(...userExpParams);

    const totalRecFeedback = recFeedbackTotals?.total_feedback || 0;
    const relevantAnswered = recFeedbackTotals?.relevant_answered || 0;
    const relevantYes = recFeedbackTotals?.relevant_yes || 0;
    const recommendationRelevanceRate = relevantAnswered > 0
      ? Math.round((relevantYes / relevantAnswered) * 100)
      : null;
    const avgQualityRating = recFeedbackTotals?.avg_quality_rating
      ? Number(recFeedbackTotals.avg_quality_rating.toFixed(1))
      : null;

    // ========================================================================
    // 4. Phase 4 Evaluation Metrics: Adaptive Learning
    // ========================================================================
    const adaptiveTypes = [
      'continue_topic',
      'revisit_topic',
      'revise_weak_area',
      'revise_difficult_topic',
      'unfinished_goal',
      'practice_quiz',
      'next_learning_task',
    ];
    const adaptivePlaceholders = adaptiveTypes.map(() => '?').join(',');

    const adaptiveQuery = `
      SELECT 
        COUNT(*) AS total_tracked,
        SUM(CASE WHEN lifecycle_status = 'followed_through' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN lifecycle_status IN ('accepted', 'followed_through') THEN 1 ELSE 0 END) AS accepted_count
      FROM recommendation_tracking
      WHERE recommendation_type IN (${adaptivePlaceholders})
      ${userId ? 'AND user_id = ?' : ''}
    `;
    const adaptiveParams = userId ? [...adaptiveTypes, userId] : adaptiveTypes;
    const adaptiveRow = db.prepare(adaptiveQuery).get(...adaptiveParams);

    const adaptiveTotalTracked = adaptiveRow?.total_tracked || 0;
    const adaptiveCompletedCount = adaptiveRow?.completed_count || 0;
    const adaptiveRecCompletionRate = adaptiveTotalTracked > 0
      ? Math.round((adaptiveCompletedCount / adaptiveTotalTracked) * 100)
      : null;

    // Distinct Recommended Topics Subsequent Practice Rate:
    const distinctTopicsQuery = `
      SELECT DISTINCT LOWER(TRIM(topic)) AS topic_name, MIN(presented_at) AS first_presented
      FROM recommendation_tracking
      WHERE topic IS NOT NULL AND TRIM(topic) != ''
      ${userId ? 'AND user_id = ?' : ''}
      GROUP BY LOWER(TRIM(topic))
    `;
    const distinctTopicsRows = db.prepare(distinctTopicsQuery).all(...userRecParams);
    const distinctTopicsRecommendedCount = distinctTopicsRows.length;

    let distinctTopicsPracticedCount = 0;
    for (const dt of distinctTopicsRows) {
      let isPracticed = false;
      const tName = dt.topic_name;
      const presented = dt.first_presented || '1970-01-01';

      if (userId) {
        const sessRow = db.prepare(`
          SELECT 1 FROM session_participants sp
          JOIN study_sessions ss ON sp.session_id = ss.id
          WHERE sp.user_id = ?
            AND (LOWER(ss.topic) = ? OR LOWER(ss.topic) LIKE '%' || ? || '%')
            AND datetime(COALESCE(sp.joined_at, ss.created_at)) >= datetime(?)
          LIMIT 1
        `).get(userId, tName, tName, presented);

        if (sessRow) {
          isPracticed = true;
        } else {
          const focusRow = db.prepare(`
            SELECT 1 FROM user_focus_intervals
            WHERE user_id = ?
              AND (LOWER(topic) = ? OR LOWER(topic) LIKE '%' || ? || '%')
              AND status = 'completed'
              AND datetime(created_at) >= datetime(?)
            LIMIT 1
          `).get(userId, tName, tName, presented);
          if (focusRow) isPracticed = true;
        }
      } else {
        const sessRow = db.prepare(`
          SELECT 1 FROM study_sessions ss
          WHERE (LOWER(ss.topic) = ? OR LOWER(ss.topic) LIKE '%' || ? || '%')
            AND datetime(ss.created_at) >= datetime(?)
          LIMIT 1
        `).get(tName, tName, presented);
        if (sessRow) isPracticed = true;
      }

      if (isPracticed) distinctTopicsPracticedCount++;
    }

    const topicPracticeRate = distinctTopicsRecommendedCount > 0
      ? Math.round((distinctTopicsPracticedCount / distinctTopicsRecommendedCount) * 100)
      : null;

    // Quiz Performance Changes on Comparable Repeated Assessments:
    const quizUserWhere = userId ? 'WHERE user_id = ?' : '';
    const quizUserParams = userId ? [userId] : [];

    const quizRows = db.prepare(`
      SELECT topic_id, score_percentage, assessed_at
      FROM topic_assessments
      ${quizUserWhere}
      ORDER BY assessed_at ASC
    `).all(...quizUserParams);

    const quizMap = new Map();
    for (const q of quizRows) {
      if (!quizMap.has(q.topic_id)) {
        quizMap.set(q.topic_id, []);
      }
      quizMap.get(q.topic_id).push(q.score_percentage);
    }

    let comparableTopicsCount = 0;
    let sumQuizDeltas = 0;

    for (const [tId, scores] of quizMap.entries()) {
      if (scores.length >= 2) {
        comparableTopicsCount++;
        const earliest = scores[0];
        const latest = scores[scores.length - 1];
        sumQuizDeltas += (latest - earliest);
      }
    }

    const avgQuizDelta = comparableTopicsCount > 0
      ? Math.round((sumQuizDeltas / comparableTopicsCount) * 10) / 10
      : null;

    // ========================================================================
    // 5. Phase 4 Evaluation Metrics: Study Partner Matching
    // ========================================================================
    const peerQuery = `
      SELECT 
        COUNT(*) AS total_peer_tracked,
        SUM(CASE WHEN lifecycle_status IN ('accepted', 'followed_through') THEN 1 ELSE 0 END) AS accepted_count,
        SUM(CASE WHEN lifecycle_status = 'followed_through' OR outcome_event IN ('session_completed', 'room_joined', 'circle_connected', 'invite_sent', 'invite_accepted') THEN 1 ELSE 0 END) AS connected_count
      FROM recommendation_tracking
      WHERE recommendation_type = 'peer_help'
      ${userId ? 'AND user_id = ?' : ''}
    `;
    const peerRow = db.prepare(peerQuery).get(...userRecParams);

    const peerTotalTracked = peerRow?.total_peer_tracked || 0;
    const peerAcceptedCount = peerRow?.accepted_count || 0;
    const peerAcceptanceRate = peerTotalTracked > 0
      ? Math.round((peerAcceptedCount / peerTotalTracked) * 100)
      : null;

    let verifiedConnectionsCount = peerRow?.connected_count || 0;
    if (userId) {
      const circleCount = db.prepare(`
        SELECT COUNT(DISTINCT member_id) AS cnt
        FROM user_circle
        WHERE user_id = ?
      `).get(userId)?.cnt || 0;
      if (circleCount > verifiedConnectionsCount && circleCount <= peerTotalTracked) {
        verifiedConnectionsCount = circleCount;
      }
    }

    const connectionDenominator = peerAcceptedCount > 0 ? peerAcceptedCount : peerTotalTracked;
    const connectionSuccessRate = connectionDenominator > 0
      ? Math.min(100, Math.round((verifiedConnectionsCount / connectionDenominator) * 100))
      : null;

    // ========================================================================
    // 6. Phase 4 Evaluation Metrics: Focus Coach
    // ========================================================================
    const goalIntervalWhere = userId
      ? "WHERE user_id = ? AND goal IS NOT NULL AND TRIM(goal) != '' AND status = 'completed'"
      : "WHERE goal IS NOT NULL AND TRIM(goal) != '' AND status = 'completed'";
    const goalParams = userId ? [userId] : [];

    const goalRow = db.prepare(`
      SELECT 
        COUNT(*) AS total_goals_logged,
        SUM(CASE WHEN goal_achieved = 'yes' THEN 1 ELSE 0 END) AS goals_achieved
      FROM user_focus_intervals
      ${goalIntervalWhere}
    `).get(...goalParams);

    const totalGoalsLogged = goalRow?.total_goals_logged || 0;
    const goalsAchievedCount = goalRow?.goals_achieved || 0;
    const goalAchievedRate = totalGoalsLogged > 0
      ? Math.round((goalsAchievedCount / totalGoalsLogged) * 100)
      : null;

    // Session completion compared with user's own historical baseline (N >= 5)
    let intervalsList = [];
    let sessionsList = [];
    if (userId) {
      intervalsList = db.prepare(`
        SELECT status, created_at FROM user_focus_intervals WHERE user_id = ? ORDER BY created_at ASC
      `).all(userId);
      sessionsList = db.prepare(`
        SELECT s.status, sp.joined_at AS created_at FROM session_participants sp
        JOIN study_sessions s ON sp.session_id = s.id
        WHERE sp.user_id = ? ORDER BY sp.joined_at ASC
      `).all(userId);
    } else {
      intervalsList = db.prepare(`
        SELECT status, created_at FROM user_focus_intervals ORDER BY created_at ASC
      `).all();
      sessionsList = db.prepare(`
        SELECT status, created_at FROM study_sessions ORDER BY created_at ASC
      `).all();
    }

    const allSessions = [
      ...intervalsList.map((i) => ({ isCompleted: i.status === 'completed', createdAt: i.created_at || '1970-01-01' })),
      ...sessionsList.map((s) => ({ isCompleted: s.status === 'completed', createdAt: s.createdAt || '1970-01-01' })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const totalSessionsLogged = allSessions.length;
    const isSufficientHistory = totalSessionsLogged >= 5;
    let baselineCompletionRate = null;
    let recentCompletionRate = null;
    let completionDeltaPercentagePoints = null;
    let baselineComparisonExplanation = 'Requires at least 5 recorded sessions to establish a reliable personal baseline.';

    if (isSufficientHistory) {
      const recentWindowSize = Math.min(5, Math.max(1, Math.floor(totalSessionsLogged / 2)));
      const baselineWindow = allSessions.slice(0, allSessions.length - recentWindowSize);
      const recentWindow = allSessions.slice(allSessions.length - recentWindowSize);

      const baselineCompleted = baselineWindow.filter((s) => s.isCompleted).length;
      const recentCompleted = recentWindow.filter((s) => s.isCompleted).length;

      baselineCompletionRate = Math.round((baselineCompleted / baselineWindow.length) * 100);
      recentCompletionRate = Math.round((recentCompleted / recentWindow.length) * 100);
      completionDeltaPercentagePoints = recentCompletionRate - baselineCompletionRate;
      baselineComparisonExplanation = `Recent completion rate (${recentCompletionRate}%, last ${recentWindow.length} sessions) compared against historical baseline (${baselineCompletionRate}%, prior ${baselineWindow.length} sessions).`;
    }

    // Focus Coach Suggestion Usefulness Feedback:
    const coachFeedbackWhere = userId
      ? `WHERE user_id = ? AND (recommendation_type IN ('focus_coach', 'focus_coach_goal', 'focus_pacing') OR reason_tag LIKE '%coach%' OR feedback_text LIKE '%coach%')`
      : `WHERE (recommendation_type IN ('focus_coach', 'focus_coach_goal', 'focus_pacing') OR reason_tag LIKE '%coach%' OR feedback_text LIKE '%coach%')`;
    const coachFeedbackParams = userId ? [userId] : [];

    const coachFbRow = db.prepare(`
      SELECT 
        COUNT(*) AS total_feedback,
        SUM(CASE WHEN is_relevant = 1 OR quality_rating >= 4 THEN 1 ELSE 0 END) AS useful_count
      FROM recommendation_explicit_feedback
      ${coachFeedbackWhere}
    `).get(...coachFeedbackParams);

    const coachAnsweredCount = coachFbRow?.total_feedback || 0;
    const coachUsefulCount = coachFbRow?.useful_count || 0;
    const coachUsefulnessRate = coachAnsweredCount > 0
      ? Math.round((coachUsefulCount / coachAnsweredCount) * 100)
      : null;

    // Completed recommended sessions
    const sessionOutcomeRow = db.prepare(`
      SELECT 
        COUNT(DISTINCT rt.outcome_entity_id) AS completed_recommended_sessions
      FROM recommendation_tracking rt
      JOIN study_sessions ss ON rt.outcome_entity_id = ss.id
      WHERE rt.outcome_event = 'session_completed' AND ss.status = 'completed'
      ${userId ? 'AND rt.user_id = ?' : ''}
    `).get(...userRecParams);

    const completedRecSessions = sessionOutcomeRow?.completed_recommended_sessions || 0;

    // ========================================================================
    // 7. Structured Response Packaging
    // ========================================================================
    const acceptanceRateObj = {
      name: 'Recommendation Acceptance Rate',
      ratePercentage: acceptanceRate,
      percentage: acceptanceRate,
      formatted: acceptanceRate !== null ? `${acceptanceRate}%` : 'No data',
      numerator: totalAcceptedOrFollowed,
      denominator: totalTracked,
      sampleSize: totalTracked,
      formula: '(Accepted + Followed Through) / Total Tracked',
      definition: 'Proportion of generated study recommendations that learners consciously accepted or completed.',
      sampleSizeLabel: totalTracked < 5 ? `Small sample size (N = ${totalTracked})` : `Sufficient sample (N = ${totalTracked})`,
      isSmallSample: totalTracked < 5,
    };

    const followThroughRateObj = {
      name: 'Recommendation Follow-Through Rate',
      ratePercentage: followThroughRate,
      percentage: followThroughRate,
      formatted: followThroughRate !== null ? `${followThroughRate}%` : 'No data',
      numerator: followedThroughCount,
      denominator: totalAcceptedOrFollowed,
      sampleSize: totalAcceptedOrFollowed,
      formula: 'Followed Through / Total Accepted',
      definition: 'Proportion of accepted recommendations that resulted in a verified observable event (e.g. session completed, room joined).',
      sampleSizeLabel: totalAcceptedOrFollowed < 5 ? `Small sample size (N = ${totalAcceptedOrFollowed})` : `Sufficient sample (N = ${totalAcceptedOrFollowed})`,
      isSmallSample: totalAcceptedOrFollowed < 5,
    };

    const peerHelpfulnessRateObj = {
      name: 'Peer Helpfulness Rate',
      ratePercentage: helpfulRate,
      percentage: helpfulRate,
      formatted: helpfulRate !== null ? `${helpfulRate}%` : 'No data',
      numerator: helpfulYes,
      denominator: helpfulAnswered,
      sampleSize: helpfulAnswered,
      formula: 'Helpful Votes / Total Answered Peer Reviews',
      definition: 'Proportion of peer study collaborations where the partner was confirmed to be helpful for the topic.',
      sampleSizeLabel: helpfulAnswered < 5 ? `Small sample size (N = ${helpfulAnswered})` : `Sufficient sample (N = ${helpfulAnswered})`,
      isSmallSample: helpfulAnswered < 5,
    };

    const repeatCollaborationRateObj = {
      name: 'Repeat Collaboration Rate',
      ratePercentage: repeatStudyRate,
      percentage: repeatStudyRate,
      formatted: repeatStudyRate !== null ? `${repeatStudyRate}%` : 'No data',
      numerator: repeatYes,
      denominator: repeatAnswered,
      sampleSize: repeatAnswered,
      formula: 'Repeat Study Yes / Total Answered Reviews',
      definition: 'Proportion of study partnerships where learners expressed a desire to study together again.',
      sampleSizeLabel: repeatAnswered < 5 ? `Small sample size (N = ${repeatAnswered})` : `Sufficient sample (N = ${repeatAnswered})`,
      isSmallSample: repeatAnswered < 5,
    };

    const relevanceRateObj = {
      name: 'Topic & Recommendation Relevance Rate',
      ratePercentage: recommendationRelevanceRate,
      percentage: recommendationRelevanceRate,
      formatted: recommendationRelevanceRate !== null ? `${recommendationRelevanceRate}%` : 'No data',
      numerator: relevantYes,
      denominator: relevantAnswered,
      sampleSize: relevantAnswered,
      avgQualityRating,
      formula: 'Marked Relevant / Total Explicit Recommendation Ratings',
      definition: 'Proportion of suggested study topics, rooms, and resources confirmed as relevant to current learning goals.',
      sampleSizeLabel: relevantAnswered < 5 ? `Small sample size (N = ${relevantAnswered})` : `Sufficient sample (N = ${relevantAnswered})`,
      isSmallSample: relevantAnswered < 5,
    };

    // Phase 4 Adaptive Learning
    const adaptiveLearning = {
      recommendationCompletionRate: {
        name: 'Adaptive Learning Recommendation Completion Rate',
        ratePercentage: adaptiveRecCompletionRate,
        percentage: adaptiveRecCompletionRate,
        formatted: adaptiveRecCompletionRate !== null ? `${adaptiveRecCompletionRate}%` : 'No data',
        numerator: adaptiveCompletedCount,
        denominator: adaptiveTotalTracked,
        sampleSize: adaptiveTotalTracked,
        formula: 'Followed Through Adaptive Recommendations / Total Presented Adaptive Recommendations',
        definition: 'Proportion of presented adaptive learning recommendations that reached verified completion (followed through).',
        sampleSizeLabel: adaptiveTotalTracked < 5 ? `Small sample size (N = ${adaptiveTotalTracked})` : `Sufficient sample (N = ${adaptiveTotalTracked})`,
        isSmallSample: adaptiveTotalTracked < 5,
      },
      recommendedTopicsPracticeRate: {
        name: 'Recommended Topics Subsequent Practice Rate',
        ratePercentage: topicPracticeRate,
        percentage: topicPracticeRate,
        formatted: topicPracticeRate !== null ? `${topicPracticeRate}%` : 'No data',
        numerator: distinctTopicsPracticedCount,
        denominator: distinctTopicsRecommendedCount,
        sampleSize: distinctTopicsRecommendedCount,
        formula: 'Distinct Recommended Topics Practised / Total Distinct Recommended Topics',
        definition: 'Percentage of recommended curriculum topics that the user subsequently practised or revised in study sessions or focus intervals.',
        sampleSizeLabel: distinctTopicsRecommendedCount < 5 ? `Small sample size (N = ${distinctTopicsRecommendedCount})` : `Sufficient sample (N = ${distinctTopicsRecommendedCount})`,
        isSmallSample: distinctTopicsRecommendedCount < 5,
      },
      quizPerformanceChange: {
        name: 'Quiz Performance Change on Comparable Assessments',
        averageDeltaPercentagePoints: avgQuizDelta,
        formatted: avgQuizDelta !== null ? `${avgQuizDelta >= 0 ? '+' : ''}${avgQuizDelta}%` : 'No comparable data',
        sampleSize: comparableTopicsCount,
        topicsEvaluated: comparableTopicsCount,
        formula: 'Average of (Latest Score - Earliest Score) across topics with >= 2 assessments',
        definition: 'Average percentage point change between initial and subsequent practice assessments on identical topics.',
        sampleSizeLabel: comparableTopicsCount < 3 ? `Small sample size (N = ${comparableTopicsCount})` : `Sufficient sample (N = ${comparableTopicsCount})`,
        isSmallSample: comparableTopicsCount < 3,
        note: comparableTopicsCount === 0 ? 'No repeated assessments recorded for comparable topics yet.' : `Evaluated across ${comparableTopicsCount} comparable topic(s).`,
      },
    };

    // Phase 4 Study Partner Matching
    const studyPartnerMatching = {
      recommendationAcceptanceRate: {
        name: 'Study Partner Recommendation Acceptance Rate',
        ratePercentage: peerAcceptanceRate,
        percentage: peerAcceptanceRate,
        formatted: peerAcceptanceRate !== null ? `${peerAcceptanceRate}%` : 'No data',
        numerator: peerAcceptedCount,
        denominator: peerTotalTracked,
        sampleSize: peerTotalTracked,
        formula: '(Accepted + Followed Through Peer Recommendations) / Total Presented Peer Recommendations',
        definition: 'Proportion of suggested study partner recommendations that the learner accepted or followed through on.',
        sampleSizeLabel: peerTotalTracked < 5 ? `Small sample size (N = ${peerTotalTracked})` : `Sufficient sample (N = ${peerTotalTracked})`,
        isSmallSample: peerTotalTracked < 5,
      },
      successfulConnectionRate: {
        name: 'Successful Connection or Study Room Creation Rate',
        ratePercentage: connectionSuccessRate,
        percentage: connectionSuccessRate,
        formatted: connectionSuccessRate !== null ? `${connectionSuccessRate}%` : 'No data',
        numerator: verifiedConnectionsCount,
        denominator: connectionDenominator,
        sampleSize: connectionDenominator,
        formula: 'Verified Connections or Shared Sessions / Total Accepted Peer Recommendations',
        definition: 'Proportion of accepted partner recommendations that culminated in a verified Circle connection, shared study session, or room membership.',
        sampleSizeLabel: connectionDenominator < 5 ? `Small sample size (N = ${connectionDenominator})` : `Sufficient sample (N = ${connectionDenominator})`,
        isSmallSample: connectionDenominator < 5,
      },
      repeatCollaborationRate: repeatCollaborationRateObj,
    };

    // Phase 4 Focus Coach
    const focusCoach = {
      suggestedGoalCompletionRate: {
        name: 'Focus Coach Suggested-Goal Completion Rate',
        ratePercentage: goalAchievedRate,
        percentage: goalAchievedRate,
        formatted: goalAchievedRate !== null ? `${goalAchievedRate}%` : 'No data',
        numerator: goalsAchievedCount,
        denominator: totalGoalsLogged,
        sampleSize: totalGoalsLogged,
        formula: 'Goals Achieved (goal_achieved = "yes") / Total Sprints with Recorded Goals',
        definition: 'Proportion of completed focus sprint sessions where the student recorded their learning goal as achieved.',
        sampleSizeLabel: totalGoalsLogged < 5 ? `Small sample size (N = ${totalGoalsLogged})` : `Sufficient sample (N = ${totalGoalsLogged})`,
        isSmallSample: totalGoalsLogged < 5,
      },
      sessionCompletionComparison: {
        name: 'Session Completion vs Historical Baseline',
        isSufficientHistory,
        sampleSize: totalSessionsLogged,
        baselineCompletionRate,
        recentCompletionRate,
        completionDeltaPercentagePoints,
        formatted: isSufficientHistory && completionDeltaPercentagePoints !== null
          ? `${completionDeltaPercentagePoints >= 0 ? '+' : ''}${completionDeltaPercentagePoints}%`
          : 'Insufficient history',
        formula: 'Recent 5 Sessions Completion Rate - Prior Baseline Completion Rate',
        definition: 'Compares the learner\'s recent session completion rate against their own historical baseline when sufficient history exists (N >= 5).',
        sampleSizeLabel: isSufficientHistory ? `Sufficient history (N = ${totalSessionsLogged})` : `Insufficient history (N = ${totalSessionsLogged})`,
        isSmallSample: !isSufficientHistory,
        explanation: baselineComparisonExplanation,
      },
      suggestionUsefulnessRate: {
        name: 'Focus Coach Suggestion Usefulness Rate',
        ratePercentage: coachUsefulnessRate,
        percentage: coachUsefulnessRate,
        formatted: coachUsefulnessRate !== null ? `${coachUsefulnessRate}%` : 'No data',
        numerator: coachUsefulCount,
        denominator: coachAnsweredCount,
        sampleSize: coachAnsweredCount,
        formula: 'Useful Coach Ratings (is_relevant = 1 or rating >= 4) / Total Submitted Focus Coach Ratings',
        definition: 'Proportion of Focus Coach pacing and goal recommendations explicitly rated as useful by the learner.',
        sampleSizeLabel: coachAnsweredCount < 5 ? `Small sample size (N = ${coachAnsweredCount})` : `Sufficient sample (N = ${coachAnsweredCount})`,
        isSmallSample: coachAnsweredCount < 5,
      },
    };

    return {
      timestamp: new Date().toISOString(),
      scope: userId ? 'user' : 'global',
      userId: userId || null,
      summary: {
        totalRecommendationsTracked: totalTracked,
        totalPeerReviewsRecorded: totalPeerReviews,
        totalExplicitRecommendationFeedback: totalRecFeedback,
        totalSessionsRecorded: totalSessionsLogged,
        isColdStart: totalTracked === 0 && totalPeerReviews === 0,
      },
      metrics: {
        // Backwards compatible top-level properties
        acceptanceRate: acceptanceRateObj,
        followThroughRate: followThroughRateObj,
        peerHelpfulnessRate: peerHelpfulnessRateObj,
        repeatStudyDesireRate: repeatCollaborationRateObj,
        repeatCollaborationRate: repeatCollaborationRateObj,
        relevanceRate: relevanceRateObj,
        recommendationRelevanceRate: relevanceRateObj,

        // Direct aliases for Phase 4 metric keys
        recommendationCompletionRate: adaptiveLearning.recommendationCompletionRate,
        recommendedTopicsPracticeRate: adaptiveLearning.recommendedTopicsPracticeRate,
        quizPerformanceChange: adaptiveLearning.quizPerformanceChange,
        successfulConnectionRate: studyPartnerMatching.successfulConnectionRate,
        suggestedGoalCompletionRate: focusCoach.suggestedGoalCompletionRate,
        sessionCompletionComparison: focusCoach.sessionCompletionComparison,
        suggestionUsefulnessRate: focusCoach.suggestionUsefulnessRate,

        // Phase 4 Categorized Namespaces
        adaptiveLearning,
        studyPartnerMatching,
        focusCoach,
      },
      verifiedOutcomes: {
        completedRecommendedSessions: completedRecSessions,
        followedThroughEventsCount: followedThroughCount,
      },
      disclaimer: 'Metrics reflect observable application actions and explicit user feedback. Correlation between recommendations and session attendance does not prove cognitive concentration or educational mastery.',
    };
  },
};

export default EvaluationMetricsService;
