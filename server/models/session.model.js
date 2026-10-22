import crypto from 'node:crypto';
import { getDb, withTransaction } from '../db/connection.js';
import { FeedbackModel } from './feedback.model.js';

/**
 * StudySync AI — Study Session Model (Phase 7)
 * 
 * Persistent study sessions, individual participation intervals,
 * server-authoritative duration calculations, and post-session summaries.
 */
export const SessionModel = {
  /**
   * List sessions with filtering, search, and pagination
   */
  findAll(filters = {}, currentUserId = null, customDb = null) {
    const db = customDb || getDb();
    const params = [];
    const countParams = [];

    let whereClause = ' WHERE 1=1';

    // Status filter
    if (filters.status && filters.status !== 'all') {
      whereClause += ' AND LOWER(s.status) = LOWER(?)';
      params.push(filters.status);
      countParams.push(filters.status);
    }

    // Room ID filter
    if (filters.roomId) {
      whereClause += ' AND s.room_id = ?';
      params.push(filters.roomId);
      countParams.push(filters.roomId);
    }

    // Topic filter
    if (filters.topic) {
      whereClause += ' AND LOWER(s.topic) LIKE LOWER(?)';
      params.push(`%${filters.topic}%`);
      countParams.push(`%${filters.topic}%`);
    }

    // Search query
    if (filters.search) {
      const q = `%${filters.search}%`;
      whereClause += ' AND (LOWER(s.topic) LIKE LOWER(?) OR LOWER(s.title) LIKE LOWER(?) OR LOWER(s.subject) LIKE LOWER(?))';
      params.push(q, q, q);
      countParams.push(q, q, q);
    }

    // Filter to sessions the user participated in or created (for history)
    if (filters.participatedOnly && currentUserId) {
      whereClause += ' AND (s.creator_id = ? OR EXISTS (SELECT 1 FROM session_participants sp2 WHERE sp2.session_id = s.id AND sp2.user_id = ?))';
      params.push(currentUserId, currentUserId);
      countParams.push(currentUserId, currentUserId);
    }

    // Count total matches
    const countSql = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM study_sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      ${whereClause}
    `;
    const totalRow = db.prepare(countSql).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    // Pagination
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        s.*,
        u.display_name AS creator_name,
        u.avatar_url AS creator_avatar,
        r.room_name,
        COUNT(DISTINCT sp.id) AS participant_count,
        MAX(CASE WHEN sp.user_id = ? THEN 1 ELSE 0 END) AS is_participant,
        MAX(CASE WHEN sp.user_id = ? THEN sp.individual_duration_minutes ELSE 0 END) AS my_duration_minutes,
        MAX(CASE WHEN sp.user_id = ? THEN sp.participation_status ELSE NULL END) AS my_status
      FROM study_sessions s
      JOIN users u ON s.creator_id = u.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.start_at DESC
      LIMIT ? OFFSET ?
    `;

    const allParams = [
      currentUserId || 'anonymous',
      currentUserId || 'anonymous',
      currentUserId || 'anonymous',
      ...params,
      limit,
      offset,
    ];

    const rows = db.prepare(query).all(...allParams);

    // Format session entries for consumer consistency
    const items = rows.map((s) => {
      // Collect participant names for compact card rendering
      const participantRows = db.prepare(`
        SELECT u.display_name
        FROM session_participants sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.session_id = ?
        LIMIT 5
      `).all(s.id);

      return {
        ...s,
        participantNames: participantRows.map((p) => p.display_name),
        durationMinutes: s.planned_duration,
        statusLabel: s.status === 'active' ? 'Focus Block Active' : s.status === 'completed' ? 'Completed' : 'Scheduled',
        is_participant: Boolean(s.is_participant),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Retrieve session by ID with full participant breakdown and calculated intervals
   */
  findById(id, currentUserId = null, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare(`
      SELECT 
        s.*,
        u.display_name AS creator_name,
        u.avatar_url AS creator_avatar,
        lp.headline AS creator_headline,
        lp.skill_level AS creator_skill_level,
        r.room_name
      FROM study_sessions s
      JOIN users u ON s.creator_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(id);

    if (!session) return null;

    // Retrieve participants
    const participantRows = db.prepare(`
      SELECT 
        sp.id AS participant_record_id,
        sp.session_id,
        sp.user_id,
        sp.joined_at,
        sp.left_at,
        sp.individual_duration_minutes,
        sp.participation_status,
        sp.recorded_study_minutes,
        sp.total_attendance_seconds,
        u.display_name,
        u.avatar_url,
        lp.headline,
        lp.skill_level,
        lp.institution
      FROM session_participants sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      WHERE sp.session_id = ?
      ORDER BY sp.joined_at ASC
    `).all(id);

    const now = Date.now();

    // Map each participant with derived interval durations
    const participants = participantRows.map((p) => {
      // Retrieve attendance intervals
      const intervals = db.prepare(`
        SELECT id, joined_at, left_at, duration_seconds
        FROM session_attendance_intervals
        WHERE session_id = ? AND user_id = ?
        ORDER BY joined_at ASC
      `).all(id, p.user_id);

      let totalSecs = 0;
      let isActivelyAttending = false;

      intervals.forEach((inv) => {
        if (inv.left_at) {
          totalSecs += inv.duration_seconds || 0;
        } else {
          // Open active interval
          isActivelyAttending = true;
          const openDuration = Math.max(0, Math.floor((now - new Date(inv.joined_at).getTime()) / 1000));
          totalSecs += openDuration;
        }
      });

      // If no discrete intervals were created (e.g. legacy seed), fallback to stored total or joined_at
      if (intervals.length === 0) {
        if (p.left_at) {
          totalSecs = Math.max(0, Math.floor((new Date(p.left_at).getTime() - new Date(p.joined_at).getTime()) / 1000));
        } else {
          isActivelyAttending = true;
          totalSecs = Math.max(0, Math.floor((now - new Date(p.joined_at).getTime()) / 1000));
        }
      }

      const attendanceMinutes = Math.round(totalSecs / 60);

      return {
        ...p,
        attendance_seconds: totalSecs,
        attendance_minutes: attendanceMinutes,
        individual_duration_minutes: p.individual_duration_minutes || attendanceMinutes,
        recorded_study_minutes: p.recorded_study_minutes || 0,
        is_active: isActivelyAttending,
        isCurrentUser: currentUserId ? p.user_id === currentUserId : false,
        intervals,
      };
    });

    // Calculate overall elapsed seconds for authoritative timer recovery
    let secondsElapsed = 0;
    const startTimestamp = session.actual_start_at || session.start_at;

    if (session.status === 'active' && startTimestamp) {
      secondsElapsed = Math.max(0, Math.floor((now - new Date(startTimestamp).getTime()) / 1000));
    } else if (session.status === 'completed' && startTimestamp && (session.actual_end_at || session.end_at)) {
      const endTimestamp = session.actual_end_at || session.end_at;
      secondsElapsed = Math.max(0, Math.floor((new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime()) / 1000));
    }

    // Retrieve post-session feedback
    const feedbackList = db.prepare(`
      SELECT 
        sf.*,
        u.display_name,
        u.avatar_url
      FROM session_feedback sf
      JOIN users u ON sf.user_id = u.id
      WHERE sf.session_id = ?
      ORDER BY sf.created_at DESC
    `).all(id);

    // Linked room notes or questions if applicable
    let linkedNotes = [];
    let linkedQuestions = [];
    if (session.room_id) {
      linkedNotes = db.prepare(`
        SELECT nr.id, nr.title, nr.subject, nr.topic, u.display_name AS author_name, nr.created_at
        FROM notes_resources nr
        JOIN users u ON nr.author_id = u.id
        WHERE nr.room_id = ? OR (LOWER(nr.subject) = LOWER(?) AND LOWER(nr.topic) = LOWER(?))
        LIMIT 5
      `).all(session.room_id, session.subject || '', session.topic);

      linkedQuestions = db.prepare(`
        SELECT id, question_content AS question, is_resolved, created_at
        FROM room_questions
        WHERE room_id = ?
        LIMIT 5
      `).all(session.room_id);
    }

    const isParticipant = currentUserId ? participants.some((p) => p.user_id === currentUserId) : false;
    const isCreator = currentUserId ? session.creator_id === currentUserId : false;

    return {
      ...session,
      participants,
      participant_count: participants.length,
      participantNames: participants.map((p) => p.display_name),
      secondsElapsed,
      timeElapsedSeconds: secondsElapsed,
      timeTotalSeconds: session.planned_duration * 60,
      feedback: feedbackList,
      linkedNotes,
      linkedQuestions,
      is_participant: isParticipant,
      is_creator: isCreator,
    };
  },

  /**
   * Create a persistent study session with creator auto-enrollment
   */
  create(sessionData, creatorUserId, customDb = null) {
    const db = customDb || getDb();
    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const isStartingActive = sessionData.status === 'active';
    const startAt = isStartingActive ? now : (sessionData.scheduled_start_at || now);
    const actualStartAt = isStartingActive ? now : null;
    const status = isStartingActive ? 'active' : 'scheduled';

    withTransaction((txDb) => {
      // 1. Insert session record
      txDb.prepare(`
        INSERT INTO study_sessions (
          id, topic, subject, room_id, creator_id, title, description,
          planned_duration, status, start_at, end_at, scheduled_start_at,
          actual_start_at, actual_end_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        sessionData.topic,
        sessionData.subject || 'General Study',
        sessionData.room_id || null,
        creatorUserId,
        sessionData.title || `${sessionData.topic} Study Session`,
        sessionData.description || '',
        sessionData.planned_duration || 45,
        status,
        startAt,
        null,
        sessionData.scheduled_start_at || null,
        actualStartAt,
        null,
        now,
        now
      );

      // 2. Auto-enroll creator in session_participants
      const partId = `part-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      txDb.prepare(`
        INSERT INTO session_participants (
          id, session_id, user_id, joined_at, left_at,
          individual_duration_minutes, participation_status,
          recorded_study_minutes, total_attendance_seconds
        )
        VALUES (?, ?, ?, ?, NULL, 0, ?, 0, 0)
      `).run(
        partId,
        sessionId,
        creatorUserId,
        now,
        status === 'active' ? 'active' : 'scheduled'
      );

      // 3. If starting actively, create the initial attendance interval
      if (isStartingActive) {
        const intervalId = `int-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        txDb.prepare(`
          INSERT INTO session_attendance_intervals (
            id, session_id, user_id, joined_at, left_at, duration_seconds
          )
          VALUES (?, ?, ?, ?, NULL, 0)
        `).run(intervalId, sessionId, creatorUserId, now);
      }

      // 4. Log learning activity
      txDb.prepare(`
        INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        creatorUserId,
        'session_created',
        `Created study session for ${sessionData.topic}`,
        sessionId,
        now
      );
    }, customDb);

    return this.findById(sessionId, creatorUserId, db);
  },

  /**
   * Start a scheduled session
   */
  start(sessionId, userId, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      const err = new Error('Study session not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      const err = new Error('Cannot start a completed or cancelled session');
      err.statusCode = 400;
      err.code = 'SESSION_ALREADY_FINISHED';
      throw err;
    }

    // If already active, return cleanly (idempotent safe)
    if (session.status === 'active') {
      return this.findById(sessionId, userId, db);
    }

    // Only session creator can start
    if (session.creator_id !== userId) {
      const err = new Error('Only the session creator is authorized to start this session');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const now = new Date().toISOString();

    withTransaction((txDb) => {
      txDb.prepare(`
        UPDATE study_sessions
        SET status = 'active', actual_start_at = ?, start_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, now, sessionId);

      // Open attendance intervals for all participants currently enrolled
      const participants = txDb.prepare('SELECT user_id FROM session_participants WHERE session_id = ?').all(sessionId);
      for (const p of participants) {
        txDb.prepare(`
          UPDATE session_participants
          SET participation_status = 'active', left_at = NULL
          WHERE session_id = ? AND user_id = ?
        `).run(sessionId, p.user_id);

        const openInt = txDb.prepare(`
          SELECT id FROM session_attendance_intervals
          WHERE session_id = ? AND user_id = ? AND left_at IS NULL
        `).get(sessionId, p.user_id);

        if (!openInt) {
          const intId = `int-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
          txDb.prepare(`
            INSERT INTO session_attendance_intervals (id, session_id, user_id, joined_at, left_at, duration_seconds)
            VALUES (?, ?, ?, ?, NULL, 0)
          `).run(intId, sessionId, p.user_id, now);
        }
      }
    }, customDb);

    return this.findById(sessionId, userId, db);
  },

  /**
   * Join an active study session (prevents duplicate active participation)
   */
  join(sessionId, userId, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      const err = new Error('Study session not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      const err = new Error('Cannot join a completed or cancelled study session');
      err.statusCode = 400;
      err.code = 'SESSION_COMPLETED';
      throw err;
    }

    // Check if the user is ALREADY actively attending
    const openInterval = db.prepare(`
      SELECT id FROM session_attendance_intervals
      WHERE session_id = ? AND user_id = ? AND left_at IS NULL
    `).get(sessionId, userId);

    if (openInterval) {
      const err = new Error('User is already actively participating in this session');
      err.statusCode = 409;
      err.code = 'DUPLICATE_ACTIVE_PARTICIPATION';
      throw err;
    }

    const now = new Date().toISOString();

    withTransaction((txDb) => {
      // 1. Check if user already has a session_participants record (rejoining!)
      const existingParticipant = txDb.prepare(`
        SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?
      `).get(sessionId, userId);

      if (existingParticipant) {
        // Rejoin: Reactivate participant record without wiping historical attendance
        txDb.prepare(`
          UPDATE session_participants
          SET participation_status = 'active', left_at = NULL
          WHERE session_id = ? AND user_id = ?
        `).run(sessionId, userId);
      } else {
        // First join: Create participant record
        const partId = `part-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        txDb.prepare(`
          INSERT INTO session_participants (
            id, session_id, user_id, joined_at, left_at,
            individual_duration_minutes, participation_status,
            recorded_study_minutes, total_attendance_seconds
          )
          VALUES (?, ?, ?, ?, NULL, 0, 'active', 0, 0)
        `).run(partId, sessionId, userId, now);
      }

      // 2. Open a discrete new attendance interval
      const intervalId = `int-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      txDb.prepare(`
        INSERT INTO session_attendance_intervals (
          id, session_id, user_id, joined_at, left_at, duration_seconds
        )
        VALUES (?, ?, ?, ?, NULL, 0)
      `).run(intervalId, sessionId, userId, now);

      // 3. Log activity
      txDb.prepare(`
        INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId,
        'session_joined',
        `Joined study session for ${session.topic}`,
        sessionId,
        now
      );
    }, customDb);

    return this.findById(sessionId, userId, db);
  },

  /**
   * Leave a study session (records leave time and calculates attendance interval)
   */
  leave(sessionId, userId, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      const err = new Error('Study session not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Check for open attendance interval
    const openInterval = db.prepare(`
      SELECT id, joined_at FROM session_attendance_intervals
      WHERE session_id = ? AND user_id = ? AND left_at IS NULL
    `).get(sessionId, userId);

    if (!openInterval) {
      const err = new Error('User is not an active participant in this study session');
      err.statusCode = 400;
      err.code = 'NOT_A_PARTICIPANT';
      throw err;
    }

    const now = new Date().toISOString();

    withTransaction((txDb) => {
      // 1. Close the open attendance interval with server calculated duration
      const intervalDuration = Math.max(
        0,
        Math.floor((new Date(now).getTime() - new Date(openInterval.joined_at).getTime()) / 1000)
      );

      txDb.prepare(`
        UPDATE session_attendance_intervals
        SET left_at = ?, duration_seconds = ?
        WHERE id = ?
      `).run(now, intervalDuration, openInterval.id);

      // 2. Sum all completed intervals for this participant
      const totalRow = txDb.prepare(`
        SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
        FROM session_attendance_intervals
        WHERE session_id = ? AND user_id = ?
      `).get(sessionId, userId);

      const totalSecs = totalRow ? totalRow.total_seconds : 0;
      const mins = Math.round(totalSecs / 60);

      // 3. Update participant record
      txDb.prepare(`
        UPDATE session_participants
        SET left_at = ?, total_attendance_seconds = ?, individual_duration_minutes = ?, participation_status = 'left'
        WHERE session_id = ? AND user_id = ?
      `).run(now, totalSecs, mins, sessionId, userId);

      // 4. Activity log
      txDb.prepare(`
        INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId,
        'session_left',
        `Left study session for ${session.topic}`,
        sessionId,
        now
      );
    }, customDb);

    return this.findById(sessionId, userId, db);
  },

  /**
   * End a study session with creator authorization and finalize all attendance intervals
   */
  end(sessionId, userId, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      const err = new Error('Study session not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Safe repeated end handling (idempotent)
    if (session.status === 'completed') {
      return this.getSummary(sessionId, db);
    }

    // Only session creator is authorized to end
    if (session.creator_id !== userId) {
      const err = new Error('Only the session creator is authorized to end this study session');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const now = new Date().toISOString();

    withTransaction((txDb) => {
      // 1. Mark session as completed
      txDb.prepare(`
        UPDATE study_sessions
        SET status = 'completed', actual_end_at = ?, end_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, now, sessionId);

      // 2. Close any remaining open intervals for all active participants
      const openIntervals = txDb.prepare(`
        SELECT id, user_id, joined_at
        FROM session_attendance_intervals
        WHERE session_id = ? AND left_at IS NULL
      `).all(sessionId);

      for (const inv of openIntervals) {
        const intervalDuration = Math.max(
          0,
          Math.floor((new Date(now).getTime() - new Date(inv.joined_at).getTime()) / 1000)
        );

        txDb.prepare(`
          UPDATE session_attendance_intervals
          SET left_at = ?, duration_seconds = ?
          WHERE id = ?
        `).run(now, intervalDuration, inv.id);
      }

      // 3. Finalize all participants' individual totals
      const participants = txDb.prepare(`
        SELECT user_id, left_at
        FROM session_participants
        WHERE session_id = ?
      `).all(sessionId);

      for (const p of participants) {
        const totalRow = txDb.prepare(`
          SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
          FROM session_attendance_intervals
          WHERE session_id = ? AND user_id = ?
        `).get(sessionId, p.user_id);

        const totalSecs = totalRow ? totalRow.total_seconds : 0;
        const mins = Math.round(totalSecs / 60);

        txDb.prepare(`
          UPDATE session_participants
          SET left_at = COALESCE(left_at, ?),
              total_attendance_seconds = ?,
              individual_duration_minutes = ?,
              participation_status = 'completed'
          WHERE session_id = ? AND user_id = ?
        `).run(now, totalSecs, mins, sessionId, p.user_id);
      }

      // 4. Activity log
      txDb.prepare(`
        INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId,
        'session_completed',
        `Concluded study session for ${session.topic}`,
        sessionId,
        now
      );

      // 5. Phase 12: Verify recommendation follow-through outcomes
      try {
        FeedbackModel.verifySessionOutcomes(sessionId, txDb);
      } catch {}
    }, customDb);

    return this.getSummary(sessionId, db);
  },

  /**
   * Retrieve completed session summary with individual participant attendance breakdown
   */
  getSummary(sessionId, customDb = null) {
    const db = customDb || getDb();
    const session = this.findById(sessionId, null, db);

    if (!session) return null;

    // Derive actual session duration
    let actualDurationMinutes = session.planned_duration;
    if (session.actual_start_at && session.actual_end_at) {
      const ms = new Date(session.actual_end_at).getTime() - new Date(session.actual_start_at).getTime();
      actualDurationMinutes = Math.max(1, Math.round(ms / 60000));
    }

    return {
      sessionId: session.id,
      topic: session.topic,
      subject: session.subject,
      title: session.title,
      room_id: session.room_id,
      room_name: session.room_name,
      status: session.status,
      start_at: session.actual_start_at || session.start_at,
      end_at: session.actual_end_at || session.end_at,
      planned_duration_minutes: session.planned_duration,
      actual_duration_minutes: actualDurationMinutes,
      participant_count: session.participants.length,
      participants: session.participants.map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        attendance_minutes: p.attendance_minutes,
        attendance_seconds: p.attendance_seconds,
        recorded_study_minutes: p.recorded_study_minutes || 0,
        status: p.participation_status,
      })),
      feedback: session.feedback || [],
      linkedNotes: session.linkedNotes || [],
      linkedQuestions: session.linkedQuestions || [],
    };
  },

  /**
   * Submit optional learner reflection / feedback
   */
  submitFeedback(sessionId, userId, feedbackData, customDb = null) {
    const db = customDb || getDb();
    const session = db.prepare('SELECT id FROM study_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      const err = new Error('Study session not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const feedbackId = `fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO session_feedback (id, session_id, user_id, rating, reflection, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, user_id) DO UPDATE SET
        rating = excluded.rating,
        reflection = excluded.reflection,
        created_at = excluded.created_at
    `).run(
      feedbackId,
      sessionId,
      userId,
      feedbackData.rating || 'Helpful',
      feedbackData.reflection || '',
      now
    );

    return db.prepare(`
      SELECT * FROM session_feedback WHERE session_id = ? AND user_id = ?
    `).get(sessionId, userId);
  },

  /**
   * Update self-reported focus time and status for current participant
   * (Enforces security: only allows updating own participation)
   */
  recordFocus(sessionId, userId, focusData, customDb = null) {
    const db = customDb || getDb();
    const participant = db.prepare(`
      SELECT * FROM session_participants WHERE session_id = ? AND user_id = ?
    `).get(sessionId, userId);

    if (!participant) {
      const err = new Error('Participant not found in this session');
      err.statusCode = 404;
      err.code = 'NOT_A_PARTICIPANT';
      throw err;
    }

    const updates = [];
    const params = [];

    if (focusData.recorded_study_minutes !== undefined) {
      updates.push('recorded_study_minutes = ?');
      params.push(focusData.recorded_study_minutes);
    }

    if (focusData.status) {
      updates.push('participation_status = ?');
      params.push(focusData.status);
    }

    if (updates.length > 0) {
      params.push(sessionId, userId);
      db.prepare(`
        UPDATE session_participants
        SET ${updates.join(', ')}
        WHERE session_id = ? AND user_id = ?
      `).run(...params);
    }

    return this.findById(sessionId, userId, db);
  },

  /**
   * Retrieve total count of sessions
   */
  count(customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT COUNT(*) AS count FROM study_sessions').get();
    return row.count;
  },
};

export default SessionModel;
