import crypto from 'node:crypto';
import { getDb, withTransaction } from '../db/connection.js';

/**
 * StudySync AI — Feedback & Recommendation Tracking Model (Phase 12)
 * 
 * Manages:
 * - Tracking recommendation presentations and lifecycle transitions
 * - Explicit recommendation relevance feedback
 * - Post-session peer collaboration evaluations
 * - Observable outcome verification (sessions completed, rooms joined, assessments taken)
 * - Candidate peer statistics for adaptive matching
 */
export const FeedbackModel = {
  /**
   * Track a generated recommendation (or retrieve existing active presentation to prevent duplicates)
   */
  trackRecommendation({
    id: customId = null,
    userId,
    recommendationType,
    targetId,
    topic = null,
    subject = null,
    engineVersion = 'v1-baseline',
  }, customDb = null) {
    const db = customDb || getDb();

    // If customId provided, check if that specific tracking record already exists
    if (customId) {
      const existingById = db.prepare(`
        SELECT * FROM recommendation_tracking WHERE id = ? AND user_id = ?
      `).get(customId, userId);
      if (existingById) {
        return existingById;
      }
    }

    // Look for an existing presented recommendation for this user, type, and target within the past 24 hours
    const existing = db.prepare(`
      SELECT * FROM recommendation_tracking
      WHERE user_id = ?
        AND recommendation_type = ?
        AND (target_id = ? OR id = ?)
        AND lifecycle_status = 'presented'
        AND datetime(presented_at) >= datetime('now', '-24 hours')
      ORDER BY presented_at DESC
      LIMIT 1
    `).get(userId, recommendationType, targetId, customId || targetId);

    if (existing) {
      return existing;
    }

    const id = customId || `rec-trk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO recommendation_tracking (
        id, user_id, recommendation_type, target_id,
        topic, subject, engine_version, lifecycle_status,
        presented_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'presented', ?, ?, ?)
    `).run(
      id,
      userId,
      recommendationType,
      targetId,
      topic,
      subject,
      engineVersion,
      now,
      now,
      now
    );

    return db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(id);
  },

  /**
   * Update recommendation lifecycle status (accepted, dismissed, followed_through)
   */
  updateRecommendationLifecycle(trackingId, userId, {
    status,
    outcomeEvent = null,
    outcomeEntityId = null,
    targetId = null,
    recommendationType = null,
  }, customDb = null) {
    const db = customDb || getDb();
    let row = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(trackingId);

    if (!row) {
      // Fallback: look up by target_id or recommendation id matching this user
      const strippedId = typeof trackingId === 'string' ? trackingId.replace(/^rec-[a-z-]+-/, '') : trackingId;
      row = db.prepare(`
        SELECT * FROM recommendation_tracking
        WHERE user_id = ? AND (
          id = ? OR
          target_id = ? OR
          target_id = ? OR
          (? IS NOT NULL AND target_id = ?) OR
          (? IS NOT NULL AND LOWER(target_id) LIKE '%' || LOWER(?) || '%') OR
          LOWER(?) LIKE '%' || LOWER(target_id) || '%'
        )
        ORDER BY presented_at DESC
        LIMIT 1
      `).get(
        userId,
        trackingId,
        trackingId,
        strippedId,
        targetId, targetId,
        targetId, targetId,
        trackingId
      );
    }

    if (!row) {
      // If no tracking record existed yet for this user, create one directly so that
      // the status (e.g. followed_through or dismissed) is recorded and suppressed
      const now = new Date().toISOString();
      const newTrackId = `rec-trk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const effectiveTarget = targetId || trackingId;
      db.prepare(`
        INSERT INTO recommendation_tracking (
          id, user_id, recommendation_type, target_id, engine_version,
          lifecycle_status, presented_at, accepted_at, dismissed_at, followed_through_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newTrackId,
        userId,
        recommendationType || 'adaptive',
        effectiveTarget,
        'v2-adaptive',
        status,
        now,
        status === 'accepted' || status === 'followed_through' ? now : null,
        status === 'dismissed' ? now : null,
        status === 'followed_through' ? now : null,
        now
      );
      return db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(newTrackId);
    }

    if (row.user_id !== userId) {
      const err = new Error('You are not authorized to update this recommendation record');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    const now = new Date().toISOString();
    let acceptedAt = row.accepted_at;
    let dismissedAt = row.dismissed_at;
    let followedThroughAt = row.followed_through_at;

    if (status === 'accepted') {
      acceptedAt = now;
    } else if (status === 'dismissed') {
      dismissedAt = now;
    } else if (status === 'followed_through') {
      followedThroughAt = now;
      if (!acceptedAt) acceptedAt = now;
    }

    db.prepare(`
      UPDATE recommendation_tracking
      SET lifecycle_status = ?,
          accepted_at = ?,
          dismissed_at = ?,
          followed_through_at = ?,
          outcome_event = COALESCE(?, outcome_event),
          outcome_entity_id = COALESCE(?, outcome_entity_id),
          updated_at = ?
      WHERE id = ?
    `).run(status, acceptedAt, dismissedAt, followedThroughAt, outcomeEvent, outcomeEntityId, now, row.id);

    return db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(row.id);
  },

  /**
   * Submit or update explicit feedback on a recommendation
   */
  submitRecommendationFeedback(userId, {
    trackingId,
    recommendationType,
    targetId,
    isRelevant = null,
    qualityRating = null,
    reasonTag = null,
    feedbackText = null,
  }, customDb = null) {
    const db = customDb || getDb();

    // Verify tracking record if provided
    let verifiedTrackingId = trackingId || null;
    let recType = recommendationType;
    let trgId = targetId;

    if (verifiedTrackingId) {
      const trackRow = db.prepare('SELECT * FROM recommendation_tracking WHERE id = ?').get(verifiedTrackingId);
      if (trackRow) {
        if (trackRow.user_id !== userId) {
          const err = new Error('Not authorized to give feedback on another user\'s recommendation');
          err.code = 'FORBIDDEN';
          err.statusCode = 403;
          throw err;
        }
        recType = trackRow.recommendation_type;
        trgId = trackRow.target_id;

        // Auto-update lifecycle if relevant or dismissed
        if (isRelevant === 0 && trackRow.lifecycle_status === 'presented') {
          this.updateRecommendationLifecycle(verifiedTrackingId, userId, { status: 'dismissed' }, db);
        } else if (isRelevant === 1 && trackRow.lifecycle_status === 'presented') {
          this.updateRecommendationLifecycle(verifiedTrackingId, userId, { status: 'accepted' }, db);
        }
      }
    }

    if (!recType || !trgId) {
      const err = new Error('Recommendation type and target ID are required');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const id = `rec-fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO recommendation_explicit_feedback (
        id, recommendation_tracking_id, user_id, recommendation_type, target_id,
        is_relevant, quality_rating, reason_tag, feedback_text, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(recommendation_tracking_id, user_id) DO UPDATE SET
        is_relevant = excluded.is_relevant,
        quality_rating = excluded.quality_rating,
        reason_tag = excluded.reason_tag,
        feedback_text = excluded.feedback_text,
        updated_at = excluded.updated_at
    `).run(
      id,
      verifiedTrackingId,
      userId,
      recType,
      trgId,
      isRelevant !== undefined && isRelevant !== null ? (isRelevant ? 1 : 0) : null,
      qualityRating,
      reasonTag,
      feedbackText,
      now,
      now
    );

    return db.prepare(`
      SELECT * FROM recommendation_explicit_feedback
      WHERE user_id = ? AND (recommendation_tracking_id = ? OR (recommendation_type = ? AND target_id = ?))
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(userId, verifiedTrackingId, recType, trgId);
  },

  /**
   * Submit or update post-session peer collaboration feedback
   */
  submitPeerFeedback(giverUserId, {
    sessionId,
    targetPeerId,
    wasHelpful = null,
    wouldStudyAgain = null,
    topicRelevance = null,
    feedbackNotes = null,
  }, customDb = null) {
    const db = customDb || getDb();

    if (giverUserId === targetPeerId) {
      const err = new Error('Cannot submit peer feedback for yourself');
      err.code = 'INVALID_PEER';
      err.statusCode = 400;
      throw err;
    }

    // Verify session participation if sessionId is provided
    if (sessionId) {
      const session = db.prepare('SELECT id FROM study_sessions WHERE id = ?').get(sessionId);
      if (!session) {
        const err = new Error('Study session not found');
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      const giverParticipant = db.prepare(`
        SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?
      `).get(sessionId, giverUserId);

      if (!giverParticipant) {
        const err = new Error('You cannot review a study session you did not participate in');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      const targetParticipant = db.prepare(`
        SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?
      `).get(sessionId, targetPeerId);

      if (!targetParticipant) {
        const err = new Error('The target peer was not a participant in this study session');
        err.code = 'PEER_NOT_IN_SESSION';
        err.statusCode = 400;
        throw err;
      }
    }

    const id = `p-fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO peer_collaboration_feedback (
        id, session_id, giver_user_id, target_peer_id,
        was_helpful, would_study_again, topic_relevance, feedback_notes,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, giver_user_id, target_peer_id) DO UPDATE SET
        was_helpful = excluded.was_helpful,
        would_study_again = excluded.would_study_again,
        topic_relevance = excluded.topic_relevance,
        feedback_notes = excluded.feedback_notes,
        updated_at = excluded.updated_at
    `).run(
      id,
      sessionId || null,
      giverUserId,
      targetPeerId,
      wasHelpful !== undefined && wasHelpful !== null ? (wasHelpful ? 1 : 0) : null,
      wouldStudyAgain !== undefined && wouldStudyAgain !== null ? (wouldStudyAgain ? 1 : 0) : null,
      topicRelevance !== undefined && topicRelevance !== null ? (topicRelevance ? 1 : 0) : null,
      feedbackNotes,
      now,
      now
    );

    return db.prepare(`
      SELECT * FROM peer_collaboration_feedback
      WHERE giver_user_id = ? AND target_peer_id = ? AND (session_id = ? OR session_id IS NULL)
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(giverUserId, targetPeerId, sessionId || null);
  },

  /**
   * Retrieves pairwise feedback between two learners
   */
  getPairwiseFeedback(giverUserId, targetPeerId, customDb = null) {
    const db = customDb || getDb();
    return db.prepare(`
      SELECT * FROM peer_collaboration_feedback
      WHERE giver_user_id = ? AND target_peer_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(giverUserId, targetPeerId);
  },

  /**
   * Retrieves aggregated candidate peer feedback statistics
   */
  getCandidatePeerStats(candidateId, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare(`
      SELECT 
        COUNT(*) AS total_reviews,
        SUM(CASE WHEN was_helpful = 1 THEN 1 ELSE 0 END) AS helpful_count,
        SUM(CASE WHEN would_study_again = 1 THEN 1 ELSE 0 END) AS repeat_study_count
      FROM peer_collaboration_feedback
      WHERE target_peer_id = ?
    `).get(candidateId);

    const total = row?.total_reviews || 0;
    const helpful = row?.helpful_count || 0;
    const repeat = row?.repeat_study_count || 0;

    return {
      totalReviews: total,
      helpfulCount: helpful,
      repeatStudyCount: repeat,
      helpfulRate: total > 0 ? Math.round((helpful / total) * 100) : null,
      repeatRate: total > 0 ? Math.round((repeat / total) * 100) : null,
    };
  },

  /**
   * Retrieves all feedback submitted by the authenticated user
   */
  getMySubmittedFeedback(userId, customDb = null) {
    const db = customDb || getDb();

    const recommendationFeedback = db.prepare(`
      SELECT 
        ref.*,
        rt.topic,
        rt.subject,
        rt.engine_version
      FROM recommendation_explicit_feedback ref
      LEFT JOIN recommendation_tracking rt ON ref.recommendation_tracking_id = rt.id
      WHERE ref.user_id = ?
      ORDER BY ref.updated_at DESC
      LIMIT 50
    `).all(userId);

    const peerFeedback = db.prepare(`
      SELECT 
        pcf.*,
        u.display_name AS peer_name,
        ss.topic AS session_topic,
        ss.subject AS session_subject
      FROM peer_collaboration_feedback pcf
      JOIN users u ON pcf.target_peer_id = u.id
      LEFT JOIN study_sessions ss ON pcf.session_id = ss.id
      WHERE pcf.giver_user_id = ?
      ORDER BY pcf.updated_at DESC
      LIMIT 50
    `).all(userId);

    return {
      recommendationFeedback,
      peerFeedback,
    };
  },

  /**
   * Observable Outcome Verifier: Session Completion
   * Called when a study session concludes. Identifies matching accepted recommendations
   * and marks them as followed through with 'session_completed'.
   */
  verifySessionOutcomes(sessionId, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(sessionId);
    if (!session) return 0;

    const participants = db.prepare(`
      SELECT user_id, total_attendance_seconds FROM session_participants WHERE session_id = ?
    `).all(sessionId);

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const p of participants) {
      // Find other participants in the session
      const otherUserIds = participants.filter((o) => o.user_id !== p.user_id).map((o) => o.user_id);

      for (const otherId of otherUserIds) {
        // Did user have an active recommendation for this peer?
        const rows = db.prepare(`
          SELECT id FROM recommendation_tracking
          WHERE user_id = ?
            AND recommendation_type = 'peer_help'
            AND target_id = ?
            AND lifecycle_status IN ('presented', 'accepted')
        `).all(p.user_id, otherId);

        for (const row of rows) {
          db.prepare(`
            UPDATE recommendation_tracking
            SET lifecycle_status = 'followed_through',
                followed_through_at = ?,
                accepted_at = COALESCE(accepted_at, ?),
                outcome_event = 'session_completed',
                outcome_entity_id = ?,
                updated_at = ?
            WHERE id = ?
          `).run(now, now, sessionId, now, row.id);
          updatedCount++;
        }
      }

      // Did user have an active recommendation for this topic?
      const topicRows = db.prepare(`
        SELECT id FROM recommendation_tracking
        WHERE user_id = ?
          AND recommendation_type IN ('continue_topic', 'revisit_topic', 'revise_weak_area', 'revise_difficult_topic', 'unfinished_goal', 'practice_quiz', 'next_learning_task')
          AND (LOWER(topic) = LOWER(?) OR LOWER(target_id) = LOWER(?) OR LOWER(target_id) LIKE '%' || LOWER(?) || '%')
          AND lifecycle_status IN ('presented', 'accepted')
      `).all(p.user_id, session.topic, session.topic, session.topic);

      for (const row of topicRows) {
        db.prepare(`
          UPDATE recommendation_tracking
          SET lifecycle_status = 'followed_through',
              followed_through_at = ?,
              accepted_at = COALESCE(accepted_at, ?),
              outcome_event = 'session_completed',
              outcome_entity_id = ?,
              updated_at = ?
          WHERE id = ?
        `).run(now, now, sessionId, now, row.id);
        updatedCount++;
      }
    }

    return updatedCount;
  },

  /**
   * Observable Outcome Verifier: Focus Interval Completion
   * Called when a focus sprint concludes. Transitions matching topic or goal
   * recommendations to followed_through with outcome_event = 'focus_interval_completed'.
   */
  verifyFocusOutcomes(intervalId, userId, customDb = null) {
    const db = customDb || getDb();
    const interval = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(intervalId);
    if (!interval) return 0;

    let updatedCount = 0;
    const now = new Date().toISOString();

    const topic = interval.topic ? interval.topic.trim().toLowerCase() : null;
    const goal = interval.goal ? interval.goal.trim().toLowerCase() : null;

    if (topic) {
      const topicRows = db.prepare(`
        SELECT id FROM recommendation_tracking
        WHERE user_id = ?
          AND recommendation_type IN ('continue_topic', 'revisit_topic', 'revise_weak_area', 'revise_difficult_topic', 'unfinished_goal', 'next_learning_task', 'focus_coach_goal')
          AND (LOWER(topic) = LOWER(?) OR LOWER(target_id) = LOWER(?) OR LOWER(target_id) LIKE '%' || LOWER(?) || '%')
          AND lifecycle_status IN ('presented', 'accepted')
      `).all(userId, topic, topic, topic);

      for (const row of topicRows) {
        db.prepare(`
          UPDATE recommendation_tracking
          SET lifecycle_status = 'followed_through',
              followed_through_at = ?,
              accepted_at = COALESCE(accepted_at, ?),
              outcome_event = 'focus_interval_completed',
              outcome_entity_id = ?,
              updated_at = ?
          WHERE id = ?
        `).run(now, now, intervalId, now, row.id);
        updatedCount++;
      }
    }

    if (goal) {
      const goalRows = db.prepare(`
        SELECT id FROM recommendation_tracking
        WHERE user_id = ?
          AND recommendation_type = 'focus_coach_goal'
          AND lifecycle_status IN ('presented', 'accepted')
      `).all(userId);

      for (const row of goalRows) {
        db.prepare(`
          UPDATE recommendation_tracking
          SET lifecycle_status = 'followed_through',
              followed_through_at = ?,
              accepted_at = COALESCE(accepted_at, ?),
              outcome_event = 'focus_interval_completed',
              outcome_entity_id = ?,
              updated_at = ?
          WHERE id = ?
        `).run(now, now, intervalId, now, row.id);
        updatedCount++;
      }
    }

    return updatedCount;
  },

  /**
   * Observable Outcome Verifier: Circle Connection
   * Called when a peer connection or Circle invitation is confirmed.
   * Marks corresponding peer recommendation as followed_through with outcome_event = 'circle_connected'.
   */
  verifyCircleOutcomes(userId, contactId, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const rows = db.prepare(`
      SELECT id FROM recommendation_tracking
      WHERE user_id = ?
        AND recommendation_type = 'peer_help'
        AND target_id = ?
        AND lifecycle_status IN ('presented', 'accepted')
    `).all(userId, contactId);

    let updated = 0;
    for (const row of rows) {
      db.prepare(`
        UPDATE recommendation_tracking
        SET lifecycle_status = 'followed_through',
            followed_through_at = ?,
            accepted_at = COALESCE(accepted_at, ?),
            outcome_event = 'circle_connected',
            outcome_entity_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, now, contactId, now, row.id);
      updated++;
    }

    return updated;
  },

  /**
   * Observable Outcome Verifier: Room Joined
   */
  verifyRoomOutcomes(roomId, userId, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const rows = db.prepare(`
      SELECT id FROM recommendation_tracking
      WHERE user_id = ?
        AND recommendation_type = 'join_room'
        AND target_id = ?
        AND lifecycle_status IN ('presented', 'accepted')
    `).all(userId, roomId);

    let updated = 0;
    for (const row of rows) {
      db.prepare(`
        UPDATE recommendation_tracking
        SET lifecycle_status = 'followed_through',
            followed_through_at = ?,
            accepted_at = COALESCE(accepted_at, ?),
            outcome_event = 'room_joined',
            outcome_entity_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, now, roomId, now, row.id);
      updated++;
    }

    return updated;
  },

  /**
   * Observable Outcome Verifier: Assessment Completed
   */
  verifyAssessmentOutcomes(topicId, userId, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();

    const topicRow = db.prepare('SELECT topic_name FROM learning_topics WHERE id = ?').get(topicId);
    const topicName = topicRow?.topic_name || topicId;

    const rows = db.prepare(`
      SELECT id FROM recommendation_tracking
      WHERE user_id = ?
        AND (target_id = ? OR LOWER(topic) = LOWER(?))
        AND lifecycle_status IN ('presented', 'accepted')
    `).all(userId, topicId, topicName);

    let updated = 0;
    for (const row of rows) {
      db.prepare(`
        UPDATE recommendation_tracking
        SET lifecycle_status = 'followed_through',
            followed_through_at = ?,
            accepted_at = COALESCE(accepted_at, ?),
            outcome_event = 'assessment_taken',
            outcome_entity_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, now, topicId, now, row.id);
      updated++;
    }

    return updated;
  },
};

export default FeedbackModel;
