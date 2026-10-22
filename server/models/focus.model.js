import crypto from 'node:crypto';
import { getDb, withTransaction } from '../db/connection.js';
import { FeedbackModel } from './feedback.model.js';

/**
 * StudySync AI — Focus & Distraction Shield Model (Phase 11)
 * 
 * Manages:
 * - Persistent focus intervals with timestamp-based timer derivation
 * - Paused time accumulation and recovery across page refreshes
 * - Discard / complete confirmation lifecycle
 * - Distraction Shield preferences (in-app alert suppression, break reminders)
 * - Honest statistics separating timer duration from verified concentration
 */
export function generateDefaultPhases(totalSeconds) {
  const total = Math.max(60, Math.min(14400, parseInt(totalSeconds, 10) || 1500));
  const focus = Math.round(total * 0.5);
  const discuss = Math.round(total * 0.2);
  const recall = Math.round(total * 0.2);
  const review = Math.max(0, total - focus - discuss - recall);

  return [
    {
      id: 'focus',
      name: 'Focus',
      label: 'Deep Study',
      durationSeconds: focus,
      description: 'Study the core material, read chapters, and review definitions without distraction.',
    },
    {
      id: 'discuss',
      name: 'Discuss',
      label: 'Explain & Teach',
      durationSeconds: discuss,
      description: 'Explain concepts simply or teach a partner. Solo: vocalize key ideas or summarize in your own words.',
    },
    {
      id: 'recall',
      name: 'Recall',
      label: 'Retrieval Practice',
      durationSeconds: recall,
      description: 'Test yourself without looking at notes. Formulate answers to key questions and verify memory.',
    },
    {
      id: 'review',
      name: 'Review',
      label: 'Review & Doubts',
      durationSeconds: review,
      description: 'Assess what you mastered, record remaining doubts, and decide whether revision is needed.',
    },
  ];
}

export const FocusModel = {
  /**
   * Helper: Derive real elapsed and remaining seconds from timestamps
   */
  calculateIntervalTimers(interval) {
    if (!interval) return null;

    const startedMs = new Date(interval.started_at).getTime();
    const plannedSec = interval.planned_duration_seconds;
    const totalPausedSec = interval.total_paused_seconds || 0;
    const nowMs = Date.now();

    let elapsedSec = 0;

    if (interval.status === 'completed' || interval.status === 'cancelled') {
      elapsedSec = interval.actual_duration_seconds || 0;
    } else if (interval.status === 'paused' && interval.paused_at) {
      const pausedMs = new Date(interval.paused_at).getTime();
      const rawElapsed = Math.max(0, Math.floor((pausedMs - startedMs) / 1000));
      elapsedSec = Math.max(0, rawElapsed - totalPausedSec);
    } else if (interval.status === 'active') {
      const rawElapsed = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
      elapsedSec = Math.max(0, rawElapsed - totalPausedSec);
    }

    const remainingSec = Math.max(0, plannedSec - elapsedSec);
    const isTargetReached = elapsedSec >= plannedSec;

    let parsedPhases = [];
    if (interval.phases) {
      try {
        parsedPhases = typeof interval.phases === 'string' ? JSON.parse(interval.phases) : interval.phases;
      } catch {
        parsedPhases = generateDefaultPhases(plannedSec);
      }
    } else {
      parsedPhases = generateDefaultPhases(plannedSec);
    }

    let parsedCompletedPhases = [];
    if (interval.completed_phases) {
      try {
        parsedCompletedPhases = typeof interval.completed_phases === 'string'
          ? JSON.parse(interval.completed_phases)
          : interval.completed_phases;
      } catch {
        parsedCompletedPhases = [];
      }
    }

    return {
      ...interval,
      elapsedSeconds: elapsedSec,
      remainingSeconds: remainingSec,
      isTargetReached,
      totalPausedSeconds: totalPausedSec,
      plannedDurationMinutes: Math.round(plannedSec / 60),
      actualDurationMinutes: Math.round(elapsedSec / 60),
      goal: interval.goal || null,
      phases: parsedPhases,
      currentPhase: interval.current_phase || 'focus',
      completedPhases: parsedCompletedPhases,
      goalAchieved: interval.goal_achieved || null,
      keyTakeaways: interval.key_takeaways || null,
      confusingDoubts: interval.confusing_doubts || null,
      needsRevision: Boolean(interval.needs_revision),
      earlyExitReason: interval.early_exit_reason || null,
    };
  },

  /**
   * Find current active or paused interval for a user (for page recovery)
   */
  findActiveInterval(userId, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare(`
      SELECT * FROM user_focus_intervals
      WHERE user_id = ? AND status IN ('active', 'paused')
      ORDER BY started_at DESC
      LIMIT 1
    `).get(userId);

    if (!row) return null;
    return this.calculateIntervalTimers(row);
  },

  /**
   * Find interval by ID
   */
  findById(id, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(id);
    if (!row) return null;
    return this.calculateIntervalTimers(row);
  },

  /**
   * Start a new focus interval
   */
  createInterval(data, customDb = null) {
    const db = customDb || getDb();
    const {
      userId,
      topic,
      subject = null,
      goal = null,
      phases = null,
      currentPhase = 'focus',
      plannedDurationSeconds = 1500, // 25 min default
      sessionId = null,
      roomId = null,
      autoCancelPrevious = false,
    } = data;

    // Check if active or paused interval already exists
    const existing = db.prepare(`
      SELECT * FROM user_focus_intervals
      WHERE user_id = ? AND status IN ('active', 'paused')
      LIMIT 1
    `).get(userId);

    if (existing) {
      if (!autoCancelPrevious) {
        const error = new Error('An active or paused focus interval is already in progress.');
        error.code = 'ACTIVE_FOCUS_INTERVAL_EXISTS';
        error.activeInterval = this.calculateIntervalTimers(existing);
        throw error;
      }

      // Auto-cancel previous active interval if requested
      this.cancelInterval(existing.id, userId, { earlyExitReason: 'Auto-cancelled to start new session' }, db);
    }

    const id = `foc-${crypto.randomUUID()}`;
    const startedAt = new Date().toISOString();
    const targetPlannedSec = Math.max(60, Math.min(14400, parseInt(plannedDurationSeconds, 10) || 1500));
    const structuredPhases = phases && Array.isArray(phases) && phases.length > 0
      ? phases
      : generateDefaultPhases(targetPlannedSec);

    db.prepare(`
      INSERT INTO user_focus_intervals (
        id, user_id, session_id, room_id, topic, subject, goal,
        phases, current_phase, completed_phases,
        planned_duration_seconds, actual_duration_seconds,
        status, started_at, paused_at, total_paused_seconds,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 0, 'active', ?, NULL, 0, NULL, ?, ?)
    `).run(
      id,
      userId,
      sessionId,
      roomId,
      topic.trim(),
      subject ? subject.trim() : null,
      goal ? goal.trim() : null,
      JSON.stringify(structuredPhases),
      currentPhase || 'focus',
      targetPlannedSec,
      startedAt,
      startedAt,
      startedAt
    );

    return this.findById(id, db);
  },


  /**
   * Pause active focus interval
   */
  pauseInterval(id, userId, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(id);

    if (!row) {
      const err = new Error('Focus interval not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (row.user_id !== userId) {
      const err = new Error('You are not authorized to pause this focus interval.');
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (row.status !== 'active') {
      // If already paused, idempotent return
      if (row.status === 'paused') {
        return this.calculateIntervalTimers(row);
      }
      const err = new Error(`Cannot pause interval with status '${row.status}'.`);
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE user_focus_intervals
      SET status = 'paused', paused_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, id);

    return this.findById(id, db);
  },

  /**
   * Resume paused focus interval
   */
  resumeInterval(id, userId, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(id);

    if (!row) {
      const err = new Error('Focus interval not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (row.user_id !== userId) {
      const err = new Error('You are not authorized to resume this focus interval.');
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (row.status !== 'paused') {
      // If already active, idempotent return
      if (row.status === 'active') {
        return this.calculateIntervalTimers(row);
      }
      const err = new Error(`Cannot resume interval with status '${row.status}'.`);
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    const now = new Date();
    const pausedAtMs = row.paused_at ? new Date(row.paused_at).getTime() : now.getTime();
    const pauseDiffSeconds = Math.max(0, Math.floor((now.getTime() - pausedAtMs) / 1000));
    const newTotalPaused = (row.total_paused_seconds || 0) + pauseDiffSeconds;

    db.prepare(`
      UPDATE user_focus_intervals
      SET status = 'active', paused_at = NULL, total_paused_seconds = ?, updated_at = ?
      WHERE id = ?
    `).run(newTotalPaused, now.toISOString(), id);

    return this.findById(id, db);
  },

  /**
   * Update active phase and completed phases during session
   */
  updatePhase(id, userId, phaseData, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(id);

    if (!row) {
      const err = new Error('Focus interval not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (row.user_id !== userId) {
      const err = new Error('You are not authorized to update this focus interval.');
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (row.status !== 'active' && row.status !== 'paused') {
      const err = new Error(`Cannot update phase for interval with status '${row.status}'.`);
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    let completedList = [];
    try {
      completedList = JSON.parse(row.completed_phases || '[]');
    } catch {
      completedList = [];
    }

    if (phaseData.completedPhase && !completedList.includes(phaseData.completedPhase)) {
      completedList.push(phaseData.completedPhase);
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE user_focus_intervals
      SET current_phase = ?, completed_phases = ?, updated_at = ?
      WHERE id = ?
    `).run(phaseData.currentPhase, JSON.stringify(completedList), now, id);

    return this.findById(id, db);
  },

  /**
   * Finish / complete focus interval with optional reflection
   */
  completeInterval(id, userId, reflectionData = {}, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(id);

    if (!row) {
      const err = new Error('Focus interval not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (row.user_id !== userId) {
      const err = new Error('You are not authorized to complete this focus interval.');
      err.code = 'FORBIDDEN';
      throw err;
    }

    // Idempotent if already completed
    if (row.status === 'completed') {
      return this.calculateIntervalTimers(row);
    }

    if (row.status === 'cancelled') {
      const err = new Error('Cannot complete an interval that was cancelled.');
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    // Calculate final elapsed time
    const calculated = this.calculateIntervalTimers(row);
    const actualSeconds = calculated.elapsedSeconds;
    const now = new Date().toISOString();

    const goalAchieved = reflectionData.goalAchieved !== undefined ? reflectionData.goalAchieved : (row.goal_achieved || null);
    const keyTakeaways = reflectionData.keyTakeaways !== undefined ? reflectionData.keyTakeaways : (row.key_takeaways || null);
    const confusingDoubts = reflectionData.confusingDoubts !== undefined ? reflectionData.confusingDoubts : (row.confusing_doubts || null);
    const needsRevision = reflectionData.needsRevision !== undefined
      ? (reflectionData.needsRevision ? 1 : 0)
      : (row.needs_revision || 0);

    let earlyExitReason = reflectionData.earlyExitReason !== undefined ? reflectionData.earlyExitReason : (row.early_exit_reason || null);
    if (!earlyExitReason && actualSeconds < (row.planned_duration_seconds * 0.75)) {
      earlyExitReason = `Finished early (${Math.round(actualSeconds / 60)}m of ${Math.round(row.planned_duration_seconds / 60)}m planned)`;
    }

    let completedList = [];
    try {
      completedList = JSON.parse(row.completed_phases || '[]');
    } catch {
      completedList = [];
    }

    if (Array.isArray(reflectionData.completedPhases)) {
      completedList = Array.from(new Set([...completedList, ...reflectionData.completedPhases]));
    } else if (reflectionData.currentPhase && !completedList.includes(reflectionData.currentPhase)) {
      completedList.push(reflectionData.currentPhase);
    }

    const currentPhase = reflectionData.currentPhase || row.current_phase || 'review';

    db.prepare(`
      UPDATE user_focus_intervals
      SET status = 'completed',
          actual_duration_seconds = ?,
          completed_at = ?,
          goal_achieved = ?,
          key_takeaways = ?,
          confusing_doubts = ?,
          needs_revision = ?,
          early_exit_reason = ?,
          completed_phases = ?,
          current_phase = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      actualSeconds,
      now,
      goalAchieved,
      keyTakeaways,
      confusingDoubts,
      needsRevision,
      earlyExitReason,
      JSON.stringify(completedList),
      currentPhase,
      now,
      id
    );

    // If marked for revision, sync into user_learning_preferences so spaced revision recommendations highlight it
    if (needsRevision) {
      try {
        let topicRow = db.prepare('SELECT id FROM learning_topics WHERE LOWER(topic_name) = LOWER(?)').get(row.topic);
        if (!topicRow) {
          const newTopicId = `top-${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(`
            INSERT INTO learning_topics (id, subject, topic_name, created_at)
            VALUES (?, ?, ?, ?)
          `).run(newTopicId, row.subject || 'General Study', row.topic, now);
          topicRow = { id: newTopicId };
        }

        const prefId = `ulp-${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO user_learning_preferences (
            id, user_id, topic_id, learning_goal, skill_level, learning_status,
            preferred_study_duration, is_learning_now, is_strength, is_improving,
            confidence_level, willing_to_teach, wants_peer_support,
            created_at, updated_at
          )
          VALUES (?, ?, ?, 'Exam Revision', 'intermediate', 'active', 25, 1, 0, 1, 'needs_practice', 0, 1, ?, ?)
          ON CONFLICT(user_id, topic_id) DO UPDATE SET
            confidence_level = 'needs_practice',
            wants_peer_support = 1,
            learning_goal = 'Exam Revision',
            is_learning_now = 1,
            is_improving = 1,
            updated_at = excluded.updated_at
        `).run(prefId, userId, topicRow.id, now, now);
      } catch {
        // Fallback safely if schema error
      }
    }

    // Verify recommendation follow-through outcomes for focus intervals
    try {
      FeedbackModel.verifyFocusOutcomes(id, userId, db);
    } catch {
      // Non-blocking
    }

    return this.findById(id, db);
  },

  /**
   * Alias for completeInterval
   */
  completeFocusSession(id, userId, reflectionData = {}, customDb = null) {
    return this.completeInterval(id, userId, reflectionData, customDb);
  },

  /**
   * Cancel / discard focus interval
   */
  cancelInterval(id, userId, cancelData = {}, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT * FROM user_focus_intervals WHERE id = ?').get(id);

    if (!row) {
      const err = new Error('Focus interval not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (row.user_id !== userId) {
      const err = new Error('You are not authorized to cancel this focus interval.');
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (row.status === 'cancelled') {
      return this.calculateIntervalTimers(row);
    }

    const calculated = this.calculateIntervalTimers(row);
    const actualSeconds = calculated.elapsedSeconds;
    const now = new Date().toISOString();
    const reason = cancelData?.earlyExitReason || cancelData?.reason || 'Cancelled by user';

    db.prepare(`
      UPDATE user_focus_intervals
      SET status = 'cancelled',
          actual_duration_seconds = ?,
          completed_at = ?,
          early_exit_reason = ?,
          updated_at = ?
      WHERE id = ?
    `).run(actualSeconds, now, reason, now, id);

    return this.findById(id, db);
  },

  /**
   * Get user's focus history and honest summary statistics
   */
  getHistory(userId, options = {}, customDb = null) {
    const db = customDb || getDb();
    const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    const rows = db.prepare(`
      SELECT * FROM user_focus_intervals
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const intervals = rows.map((r) => this.calculateIntervalTimers(r));

    // Summary Statistics
    const statsRow = db.prepare(`
      SELECT 
        COUNT(*) AS total_intervals,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_intervals,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_intervals,
        SUM(CASE WHEN status = 'completed' THEN actual_duration_seconds ELSE 0 END) AS total_completed_seconds,
        SUM(CASE WHEN status = 'completed' THEN planned_duration_seconds ELSE 0 END) AS planned_completed_seconds,
        SUM(CASE WHEN needs_revision = 1 THEN 1 ELSE 0 END) AS needs_revision_count,
        SUM(CASE WHEN goal IS NOT NULL AND TRIM(goal) != '' THEN 1 ELSE 0 END) AS goals_set_count,
        SUM(CASE WHEN goal_achieved = 'yes' THEN 1 ELSE 0 END) AS goals_achieved_count
      FROM user_focus_intervals
      WHERE user_id = ?
    `).get(userId);

    const completedCount = statsRow?.completed_intervals || 0;
    const totalCompletedSec = statsRow?.total_completed_seconds || 0;
    const plannedCompletedSec = statsRow?.planned_completed_seconds || 0;

    const totalMinutes = Math.round(totalCompletedSec / 60);
    const totalHours = Math.round((totalCompletedSec / 3600) * 10) / 10;
    const avgMins = completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0;

    // Planned vs Actual accuracy percentage
    const adherencePercentage = plannedCompletedSec > 0
      ? Math.min(100, Math.round((totalCompletedSec / plannedCompletedSec) * 100))
      : 0;

    return {
      userId,
      stats: {
        completedIntervalsCount: completedCount,
        cancelledIntervalsCount: statsRow?.cancelled_intervals || 0,
        totalRecordedFocusMinutes: totalMinutes,
        totalRecordedFocusHours: totalHours,
        averageIntervalMinutes: avgMins,
        plannedAdherencePercentage: adherencePercentage,
        needsRevisionCount: statsRow?.needs_revision_count || 0,
        goalsSetCount: statsRow?.goals_set_count || 0,
        goalsAchievedCount: statsRow?.goals_achieved_count || 0,
        disclaimer: 'Recorded duration measures timer duration, not verified concentration, understanding, or mastery.',
      },
      intervals,
    };
  },

  /**
   * Get user's distraction shield and break reminder settings
   */
  getSettings(userId, customDb = null) {
    const db = customDb || getDb();
    let row = db.prepare('SELECT * FROM user_distraction_shield_settings WHERE user_id = ?').get(userId);

    if (!row) {
      // Seed default settings
      db.prepare(`
        INSERT INTO user_distraction_shield_settings (
          user_id, suppress_in_app_notifications, hide_non_essential_nav,
          break_reminders_enabled, break_interval_minutes, break_duration_minutes,
          audio_chime_enabled, updated_at
        ) VALUES (?, 1, 1, 1, 25, 5, 0, CURRENT_TIMESTAMP)
      `).run(userId);

      row = db.prepare('SELECT * FROM user_distraction_shield_settings WHERE user_id = ?').get(userId);
    }

    return {
      userId: row.user_id,
      suppressInAppNotifications: Boolean(row.suppress_in_app_notifications),
      hideNonEssentialNav: Boolean(row.hide_non_essential_nav),
      breakRemindersEnabled: Boolean(row.break_reminders_enabled),
      breakIntervalMinutes: row.break_interval_minutes,
      breakDurationMinutes: row.break_duration_minutes,
      audioChimeEnabled: Boolean(row.audio_chime_enabled),
      updatedAt: row.updated_at,
    };
  },

  /**
   * Update distraction shield settings
   */
  updateSettings(userId, settings, customDb = null) {
    const db = customDb || getDb();
    const current = this.getSettings(userId, db);

    const suppressNotifications = settings.suppressInAppNotifications !== undefined
      ? (settings.suppressInAppNotifications ? 1 : 0)
      : (current.suppressInAppNotifications ? 1 : 0);

    const hideNav = settings.hideNonEssentialNav !== undefined
      ? (settings.hideNonEssentialNav ? 1 : 0)
      : (current.hideNonEssentialNav ? 1 : 0);

    const breakReminders = settings.breakRemindersEnabled !== undefined
      ? (settings.breakRemindersEnabled ? 1 : 0)
      : (current.breakRemindersEnabled ? 1 : 0);

    const breakInterval = settings.breakIntervalMinutes !== undefined
      ? Math.max(5, Math.min(120, parseInt(settings.breakIntervalMinutes, 10) || 25))
      : current.breakIntervalMinutes;

    const breakDuration = settings.breakDurationMinutes !== undefined
      ? Math.max(1, Math.min(60, parseInt(settings.breakDurationMinutes, 10) || 5))
      : current.breakDurationMinutes;

    const chime = settings.audioChimeEnabled !== undefined
      ? (settings.audioChimeEnabled ? 1 : 0)
      : (current.audioChimeEnabled ? 1 : 0);

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_distraction_shield_settings (
        user_id, suppress_in_app_notifications, hide_non_essential_nav,
        break_reminders_enabled, break_interval_minutes, break_duration_minutes,
        audio_chime_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        suppress_in_app_notifications = excluded.suppress_in_app_notifications,
        hide_non_essential_nav = excluded.hide_non_essential_nav,
        break_reminders_enabled = excluded.break_reminders_enabled,
        break_interval_minutes = excluded.break_interval_minutes,
        break_duration_minutes = excluded.break_duration_minutes,
        audio_chime_enabled = excluded.audio_chime_enabled,
        updated_at = excluded.updated_at
    `).run(userId, suppressNotifications, hideNav, breakReminders, breakInterval, breakDuration, chime, now);

    return this.getSettings(userId, db);
  },
};

export default FocusModel;
