import crypto from 'node:crypto';
import { getDb, withTransaction } from '../db/connection.js';
import { sanitizeContentText, validateSafeUrl } from '../schemas/index.js';
import NotificationModel from './notification.model.js';

/**
 * Generates a human-readable room code candidate based on subject/topic/name
 * e.g. DBMS-4X9M, BIO-7K2P, MATH-8N3Q
 */
export function generateRoomCodeCandidate(subject, topic, roomName) {
  let prefix = 'SYNC';
  const text = (subject || topic || roomName || '').trim().toUpperCase();

  if (/DATABASE|DBMS|SQL/i.test(text)) prefix = 'DBMS';
  else if (/ALGO|DYNAMIC/i.test(text)) prefix = 'ALGO';
  else if (/OPERAT|OS\b/i.test(text)) prefix = 'OS';
  else if (/BIO/i.test(text)) prefix = 'BIO';
  else if (/MATH|CALC|ALGEBRA/i.test(text)) prefix = 'MATH';
  else if (/NETW|TCP/i.test(text)) prefix = 'NET';
  else if (/CHEM/i.test(text)) prefix = 'CHEM';
  else if (/PHYS/i.test(text)) prefix = 'PHYS';
  else if (/CODE|DEV|JS|PYTHON|JAVA/i.test(text)) prefix = 'CODE';
  else if (/AI|MACHINE/i.test(text)) prefix = 'AI';
  else {
    const words = text.replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      prefix = words.map((w) => w[0]).join('').slice(0, 4);
    } else {
      const clean = text.replace(/[^A-Z0-9]/g, '');
      prefix = clean.slice(0, 4) || 'SYNC';
    }
  }

  prefix = prefix.slice(0, 5) || 'SYNC';

  // Suffix: 4 secure random chars from unambiguous alphabet (excludes 0, O, 1, I)
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = crypto.randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[randomBytes[i] % alphabet.length];
  }

  return `${prefix}-${suffix}`;
}

/**
 * Generates a cryptographically secure, collision-free unique room code in SQLite
 */
export function generateUniqueRoomCode(subject, topic, roomName, db) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = generateRoomCodeCandidate(subject, topic, roomName);
    const existing = db.prepare('SELECT id FROM rooms WHERE UPPER(room_code) = UPPER(?)').get(candidate);
    if (!existing) {
      return candidate;
    }
  }
  return `SYNC-${crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)}`;
}

/**
 * StudySync AI — Room & Membership Model (Phase 6)
 * 
 * Complete relational data access for persistent topic rooms,
 * memberships, access authorization, and deterministic recommendations.
 */
export const RoomModel = {
  /**
   * List rooms with filtering, search, pagination, and optional user membership flag
   */
  findAll(filters = {}, currentUserId = null, customDb = null) {
    const db = customDb || getDb();
    const params = [];
    const countParams = [];

    let whereClause = ' WHERE 1=1';

    // Status filter (default: 'active')
    if (filters.status && filters.status !== 'all') {
      whereClause += ' AND LOWER(r.status) = LOWER(?)';
      params.push(filters.status);
      countParams.push(filters.status);
    } else if (!filters.status) {
      whereClause += " AND r.status = 'active'";
    }

    // Search filter across room name, topic, subject, and description
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      whereClause += ` AND (
        LOWER(r.room_name) LIKE ? OR
        LOWER(r.topic) LIKE ? OR
        LOWER(r.subject) LIKE ? OR
        LOWER(COALESCE(r.description, '')) LIKE ?
      )`;
      params.push(term, term, term, term);
      countParams.push(term, term, term, term);
    }

    // Subject filter
    if (filters.subject && filters.subject !== 'all') {
      whereClause += ' AND LOWER(r.subject) = LOWER(?)';
      params.push(filters.subject);
      countParams.push(filters.subject);
    }

    // Topic filter
    if (filters.topic) {
      whereClause += ' AND LOWER(r.topic) LIKE ?';
      const topicTerm = `%${filters.topic.toLowerCase()}%`;
      params.push(topicTerm);
      countParams.push(topicTerm);
    }

    // Room type filter
    if (filters.room_type && filters.room_type !== 'all') {
      whereClause += ' AND LOWER(r.room_type) = LOWER(?)';
      params.push(filters.room_type);
      countParams.push(filters.room_type);
    }

    // Difficulty filter
    if (filters.difficulty && filters.difficulty !== 'all') {
      whereClause += ' AND LOWER(r.difficulty) = LOWER(?)';
      params.push(filters.difficulty);
      countParams.push(filters.difficulty);
    }

    // Language filter
    if (filters.language && filters.language !== 'all') {
      whereClause += ' AND LOWER(r.preferred_languages) LIKE ?';
      const langTerm = `%${filters.language.toLowerCase()}%`;
      params.push(langTerm);
      countParams.push(langTerm);
    }

    // Private rooms visibility boundary:
    // Community/public rooms are discoverable by all learners.
    // Private rooms (room_type = 'private' or status = 'private') are strictly restricted to authorized creators and members.
    if (currentUserId) {
      whereClause += ` AND (
        (LOWER(COALESCE(r.room_type, '')) != 'private' AND LOWER(COALESCE(r.status, '')) != 'private')
        OR r.creator_id = ?
        OR EXISTS (SELECT 1 FROM room_memberships rm_auth WHERE rm_auth.room_id = r.id AND rm_auth.user_id = ?)
      )`;
      params.push(currentUserId, currentUserId);
      countParams.push(currentUserId, currentUserId);
    } else {
      whereClause += ` AND (LOWER(COALESCE(r.room_type, '')) != 'private' AND LOWER(COALESCE(r.status, '')) != 'private')`;
    }

    // 1. Total matching count
    const countSql = `SELECT COUNT(DISTINCT r.id) AS total FROM rooms r ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...countParams);
    const total = totalRow ? totalRow.total : 0;

    // 2. Main query
    let membershipSelect = '0 AS is_member';
    if (currentUserId) {
      membershipSelect = `MAX(CASE WHEN rm.user_id = ? THEN 1 ELSE 0 END) AS is_member`;
      params.unshift(currentUserId);
    }

    let query = `
      SELECT 
        r.id,
        r.room_name,
        r.subject,
        r.topic,
        r.description,
        r.room_type,
        r.difficulty,
        r.preferred_languages,
        r.creator_id,
        u.display_name AS creator_name,
        u.avatar_url AS creator_avatar,
        r.max_capacity,
        r.status,
        r.education_stage,
        r.meeting_url,
        r.meeting_provider,
        r.meeting_active,
        r.meeting_started_at,
        r.room_code,
        r.code_join_enabled,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT rm.id) AS member_count,
        ${membershipSelect}
      FROM rooms r
      LEFT JOIN users u ON r.creator_id = u.id
      LEFT JOIN room_memberships rm ON r.id = rm.room_id
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;

    // Pagination
    const page = filters.page ? Math.max(1, parseInt(filters.page, 10)) : 1;
    const limit = filters.limit ? Math.max(1, Math.min(100, parseInt(filters.limit, 10))) : 50;
    const offset = (page - 1) * limit;

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);

    const items = rows.map((row) => {
      const languages = safeParseJson(row.preferred_languages, ['English']);
      const isMember = Boolean(row.is_member);
      const memberCount = Number(row.member_count) || 0;

      return {
        id: row.id,
        room_name: row.room_name,
        name: row.room_name,
        title: row.room_name,
        subject: row.subject,
        topic: row.topic,
        description: row.description || '',
        room_type: row.room_type,
        roomType: row.room_type,
        difficulty: row.difficulty,
        preferred_languages: languages,
        languages,
        language: languages[0] || 'English',
        creator_id: row.creator_id,
        creator_name: row.creator_name || 'Anonymous',
        creator: row.creator_name || 'Anonymous',
        max_capacity: row.max_capacity,
        maxCapacity: row.max_capacity,
        status: row.status,
        education_stage: row.education_stage || null,
        educationStage: row.education_stage || null,
        meeting_url: row.meeting_url || null,
        meeting_provider: row.meeting_provider || null,
        meeting_active: Boolean(row.meeting_active),
        has_active_meeting: Boolean(row.meeting_active),
        meeting_started_at: row.meeting_started_at || null,
        room_code: row.room_code || null,
        roomCode: row.room_code || null,
        code_join_enabled: row.code_join_enabled !== 0,
        codeJoinEnabled: row.code_join_enabled !== 0,
        member_count: memberCount,
        memberCount,
        activeNowCount: memberCount,
        activityStatus: row.status === 'active' ? 'Active now' : 'Archived',
        statusCategory: row.status === 'active' ? 'Active' : 'Inactive',
        is_member: isMember,
        isMember,
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
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
   * Retrieve single room details with roster, messages, questions, and membership state
   */
  findById(id, currentUserId = null, customDb = null) {
    const db = customDb || getDb();

    // 1. Room base info with public creator profile
    const room = db.prepare(`
      SELECT 
        r.id,
        r.room_name,
        r.subject,
        r.topic,
        r.description,
        r.room_type,
        r.difficulty,
        r.preferred_languages,
        r.creator_id,
        r.max_capacity,
        r.status,
        r.education_stage,
        r.meeting_url,
        r.meeting_provider,
        r.meeting_active,
        r.meeting_started_at,
        r.meeting_host_id,
        r.room_code,
        r.code_join_enabled,
        r.created_at,
        r.updated_at,
        u.display_name AS creator_name,
        u.avatar_url AS creator_avatar,
        lp.headline AS creator_headline,
        lp.skill_level AS creator_skill_level
      FROM rooms r
      LEFT JOIN users u ON r.creator_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      WHERE r.id = ?
    `).get(id);

    if (!room) return null;

    const languages = safeParseJson(room.preferred_languages, ['English']);

    // 2. Room Members Roster
    const rawMembers = db.prepare(`
      SELECT 
        rm.id AS membership_id,
        rm.membership_role,
        rm.joined_at,
        u.id AS user_id,
        u.display_name,
        u.avatar_url,
        lp.headline,
        lp.skill_level
      FROM room_memberships rm
      JOIN users u ON rm.user_id = u.id
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      WHERE rm.room_id = ?
      ORDER BY rm.joined_at ASC
    `).all(id);

    const members = rawMembers.map((m) => ({
      membership_id: m.membership_id,
      id: m.user_id,
      user_id: m.user_id,
      name: m.display_name,
      display_name: m.display_name,
      initials: (m.display_name || 'U').slice(0, 2).toUpperCase(),
      avatar_url: m.avatar_url,
      headline: m.headline || '',
      learningLevel: m.skill_level || 'Intermediate',
      membership_role: m.membership_role,
      joined_at: m.joined_at,
      status: 'Studying',
      task: m.membership_role === 'creator' ? 'Room Moderator' : 'Active Member',
    }));

    // 3. User Membership Check
    const isMember = currentUserId
      ? members.some((m) => m.user_id === currentUserId)
      : false;

    // 4. Room Messages & Safety Masking
    let blockedUserIds = new Set();
    if (currentUserId) {
      try {
        const blocks = db.prepare(`
          SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = ?
        `).all(currentUserId, currentUserId);
        blockedUserIds = new Set(blocks.map((b) => b.uid));
      } catch (err) {
        // user_blocks table may not exist in mock db or early migrations
      }
    }

    const rawMessages = db.prepare(`
      SELECT 
        m.id,
        m.message_content,
        m.created_at,
        u.id AS sender_id,
        u.display_name AS sender_name
      FROM room_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
      LIMIT 100
    `).all(id);

    const messages = rawMessages.map((m) => {
      const isBlockedSender = blockedUserIds.has(m.sender_id);
      return {
        id: m.id,
        sender_id: m.sender_id,
        sender: isBlockedSender ? 'Blocked User' : m.sender_name,
        sender_name: isBlockedSender ? 'Blocked User' : m.sender_name,
        initials: isBlockedSender ? 'BU' : (m.sender_name || 'U').slice(0, 2).toUpperCase(),
        text: isBlockedSender ? '[Message from blocked user hidden]' : m.message_content,
        message_content: isBlockedSender ? '[Message from blocked user hidden]' : m.message_content,
        isBlocked: isBlockedSender,
        created_at: m.created_at,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    // 5. Questions and Responses
    const rawQuestions = db.prepare(`
      SELECT 
        q.id,
        q.question_content,
        q.topic,
        q.is_resolved,
        q.created_at,
        q.updated_at,
        u.id AS asker_id,
        u.display_name AS asker_name
      FROM room_questions q
      JOIN users u ON q.asker_id = u.id
      WHERE q.room_id = ?
      ORDER BY q.created_at DESC
    `).all(id);

    const getResponsesStmt = db.prepare(`
      SELECT 
        qr.id,
        qr.response_content,
        qr.created_at,
        u.id AS responder_id,
        u.display_name AS responder_name
      FROM question_responses qr
      JOIN users u ON qr.responder_id = u.id
      WHERE qr.question_id = ?
      ORDER BY qr.created_at ASC
    `);

    const questions = rawQuestions.map((q) => {
      const rawResponses = getResponsesStmt.all(q.id);
      const responses = rawResponses.map((r) => {
        const isRespBlocked = blockedUserIds.has(r.responder_id);
        return {
          id: r.id,
          responder_id: r.responder_id,
          author: isRespBlocked ? 'Blocked User' : r.responder_name,
          authorInitials: isRespBlocked ? 'BU' : (r.responder_name || 'U').slice(0, 2).toUpperCase(),
          text: isRespBlocked ? '[Response from blocked user hidden]' : r.response_content,
          response_content: isRespBlocked ? '[Response from blocked user hidden]' : r.response_content,
          isBlocked: isRespBlocked,
          created_at: r.created_at,
          time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      });

      const isAskerBlocked = blockedUserIds.has(q.asker_id);
      return {
        id: q.id,
        question: isAskerBlocked ? '[Question from blocked user hidden]' : q.question_content,
        question_content: isAskerBlocked ? '[Question from blocked user hidden]' : q.question_content,
        topic: q.topic || room.topic,
        asker_id: q.asker_id,
        asker: isAskerBlocked ? 'Blocked User' : q.asker_name,
        askerInitials: isAskerBlocked ? 'BU' : (q.asker_name || 'U').slice(0, 2).toUpperCase(),
        resolved: Boolean(q.is_resolved),
        is_resolved: Boolean(q.is_resolved),
        isBlocked: isAskerBlocked,
        created_at: q.created_at,
        time: new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responses,
      };
    });

    // 6. Resources linked to room
    const rawResources = db.prepare(`
      SELECT 
        nr.id,
        nr.title,
        nr.content,
        nr.resource_reference,
        nr.resource_type,
        nr.topic,
        nr.created_at,
        u.display_name AS author_name
      FROM notes_resources nr
      LEFT JOIN users u ON nr.author_id = u.id
      WHERE nr.room_id = ?
      ORDER BY nr.created_at DESC
    `).all(id);

    const resources = rawResources.map((res) => ({
      id: res.id,
      title: res.title,
      type: res.resource_type,
      topic: res.topic || room.topic,
      description: res.content ? res.content.slice(0, 160) : (res.resource_reference || 'Study resource'),
      author: res.author_name,
      created_at: res.created_at,
    }));

    const memberCount = members.length;

    // 7. Video Meeting Lifecycle & Attendance
    let meetingActive = Boolean(room.meeting_active);
    if (meetingActive && room.meeting_started_at) {
      const started = new Date(room.meeting_started_at).getTime();
      // Auto-expire meetings older than 4 hours to prevent zombie active statuses
      if (!isNaN(started) && Date.now() - started > 4 * 60 * 60 * 1000) {
        try {
          db.prepare('UPDATE rooms SET meeting_active = 0, meeting_host_id = NULL WHERE id = ?').run(id);
          db.prepare('DELETE FROM room_meeting_participants WHERE room_id = ?').run(id);
          meetingActive = false;
        } catch {}
      }
    }

    let meetingParticipantCount = 0;
    let isUserInMeeting = false;
    try {
      const participants = db.prepare('SELECT user_id FROM room_meeting_participants WHERE room_id = ?').all(id);
      meetingParticipantCount = participants.length;
      if (currentUserId) {
        isUserInMeeting = participants.some((p) => p.user_id === currentUserId);
      }
    } catch {}

    const isMeetingHost = Boolean(
      currentUserId && meetingActive && (
        room.meeting_host_id
          ? room.meeting_host_id === currentUserId
          : room.creator_id === currentUserId
      )
    );
    const canEndMeeting = isMeetingHost;

    return {
      id: room.id,
      room_name: room.room_name,
      name: room.room_name,
      title: room.room_name,
      subject: room.subject,
      topic: room.topic,
      description: room.description || '',
      room_type: room.room_type,
      roomType: room.room_type,
      difficulty: room.difficulty,
      preferred_languages: languages,
      languages,
      language: languages[0] || 'English',
      creator_id: room.creator_id,
      creator_name: room.creator_name || 'Anonymous',
      creator: room.creator_name || 'Anonymous',
      creator_headline: room.creator_headline || '',
      creator_avatar: room.creator_avatar,
      max_capacity: room.max_capacity,
      maxCapacity: room.max_capacity,
      status: room.status,
      education_stage: room.education_stage || null,
      educationStage: room.education_stage || null,
      meeting_url: room.meeting_url || null,
      meeting_provider: room.meeting_provider || null,
      meeting_active: meetingActive,
      has_active_meeting: meetingActive,
      meeting_started_at: room.meeting_started_at || null,
      meeting_host_id: room.meeting_host_id || null,
      room_code: room.room_code || null,
      roomCode: room.room_code || null,
      code_join_enabled: room.code_join_enabled !== 0,
      codeJoinEnabled: room.code_join_enabled !== 0,
      meeting_participant_count: meetingParticipantCount,
      is_user_in_meeting: isUserInMeeting,
      is_meeting_host: isMeetingHost,
      can_end_meeting: canEndMeeting,
      created_at: room.created_at,
      updated_at: room.updated_at || room.created_at,
      member_count: memberCount,
      memberCount,
      activeNowCount: memberCount,
      activityStatus: room.status === 'active' ? 'Active now' : 'Archived',
      statusCategory: room.status === 'active' ? 'Active' : 'Inactive',
      is_member: isMember,
      isMember,
      members,
      messages,
      mockMessages: messages,
      questions,
      resources,
      learningGoal: `Collaborate and master ${room.topic} through active peer review.`,
      currentFocus: room.topic,
    };
  },

  /**
   * Create a new room with verified server identity and automatic creator membership
   */
  create(roomData, customDb = null) {
    return withTransaction((txDb) => {
      const roomId = roomData.id || `room-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString();
      const languages = Array.isArray(roomData.preferred_languages)
        ? roomData.preferred_languages
        : ['English'];

      const roomCode = roomData.room_code || generateUniqueRoomCode(roomData.subject, roomData.topic, roomData.room_name, txDb);
      const codeJoinEnabled = roomData.code_join_enabled !== undefined ? (roomData.code_join_enabled ? 1 : 0) : 1;

      // 1. Insert room record
      txDb.prepare(`
        INSERT INTO rooms (
          id, room_name, subject, topic, description,
          room_type, difficulty, preferred_languages,
          creator_id, max_capacity, status, education_stage,
          meeting_url, meeting_provider, meeting_active, meeting_started_at,
          room_code, code_join_enabled,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        roomId,
        roomData.room_name,
        roomData.subject,
        roomData.topic,
        roomData.description || '',
        roomData.room_type || 'Learn Together',
        roomData.difficulty || 'Intermediate',
        JSON.stringify(languages),
        roomData.creator_id,
        roomData.max_capacity || 8,
        roomData.status || 'active',
        roomData.education_stage || null,
        roomData.meeting_url || null,
        roomData.meeting_provider || null,
        roomData.meeting_active ? 1 : 0,
        roomData.meeting_started_at || null,
        roomCode,
        codeJoinEnabled,
        now,
        now
      );

      // 2. Automatically make the verified creator a room member
      const membershipId = `mem-${crypto.randomUUID().slice(0, 8)}`;
      txDb.prepare(`
        INSERT INTO room_memberships (id, room_id, user_id, membership_role, joined_at)
        VALUES (?, ?, ?, 'creator', ?)
      `).run(membershipId, roomId, roomData.creator_id, now);

      // 3. Record learning activity
      try {
        txDb.prepare(`
          INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
          VALUES (?, ?, 'room_created', ?, ?, ?)
        `).run(
          `act-${crypto.randomUUID().slice(0, 8)}`,
          roomData.creator_id,
          `Created study room "${roomData.room_name}"`,
          roomId,
          now
        );
      } catch {
        // Non-blocking for activity logging
      }

      return this.findById(roomId, roomData.creator_id, txDb);
    }, customDb);
  },

  /**
   * Update an existing room with permitted fields
   */
  update(id, updateData, customDb = null) {
    return withTransaction((txDb) => {
      const existing = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
      if (!existing) return null;

      const fields = [];
      const values = [];

      if (updateData.room_name !== undefined) {
        fields.push('room_name = ?');
        values.push(updateData.room_name);
      }
      if (updateData.subject !== undefined) {
        fields.push('subject = ?');
        values.push(updateData.subject);
      }
      if (updateData.topic !== undefined) {
        fields.push('topic = ?');
        values.push(updateData.topic);
      }
      if (updateData.description !== undefined) {
        fields.push('description = ?');
        values.push(updateData.description);
      }
      if (updateData.room_type !== undefined) {
        fields.push('room_type = ?');
        values.push(updateData.room_type);
      }
      if (updateData.difficulty !== undefined) {
        fields.push('difficulty = ?');
        values.push(updateData.difficulty);
      }
      if (updateData.preferred_languages !== undefined) {
        fields.push('preferred_languages = ?');
        values.push(JSON.stringify(updateData.preferred_languages));
      }
      if (updateData.max_capacity !== undefined) {
        fields.push('max_capacity = ?');
        values.push(updateData.max_capacity);
      }
      if (updateData.status !== undefined) {
        fields.push('status = ?');
        values.push(updateData.status);
      }
      if (updateData.education_stage !== undefined) {
        fields.push('education_stage = ?');
        values.push(updateData.education_stage);
      }
      if (updateData.meeting_url !== undefined) {
        fields.push('meeting_url = ?');
        values.push(updateData.meeting_url);
      }
      if (updateData.meeting_provider !== undefined) {
        fields.push('meeting_provider = ?');
        values.push(updateData.meeting_provider);
      }
      if (updateData.meeting_active !== undefined) {
        fields.push('meeting_active = ?');
        values.push(updateData.meeting_active ? 1 : 0);
      }
      if (updateData.meeting_started_at !== undefined) {
        fields.push('meeting_started_at = ?');
        values.push(updateData.meeting_started_at);
      }
      if (updateData.code_join_enabled !== undefined) {
        fields.push('code_join_enabled = ?');
        values.push(updateData.code_join_enabled ? 1 : 0);
      }
      if (updateData.room_code !== undefined) {
        fields.push('room_code = ?');
        values.push(updateData.room_code);
      }

      const now = new Date().toISOString();
      fields.push('updated_at = ?');
      values.push(now);

      values.push(id);

      const sql = `UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`;
      txDb.prepare(sql).run(...values);

      return this.findById(id, null, txDb);
    }, customDb);
  },

  /**
   * Archive a room instead of destructive hard delete
   */
  archive(id, customDb = null) {
    return this.update(id, { status: 'archived' }, customDb);
  },

  /**
   * Start a live virtual study meeting in the room
   */
  startMeeting(roomId, userId, meetingData = {}, customDb = null) {
    return withTransaction((txDb) => {
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      if (room.status !== 'active') {
        const err = new Error('Cannot start a meeting in an archived room');
        err.code = 'ROOM_ARCHIVED';
        err.statusCode = 400;
        throw err;
      }

      // Check membership (room creator or member)
      const isMember = txDb.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, userId);
      if (!isMember && room.creator_id !== userId) {
        const err = new Error('You must be a member of this room to start a meeting');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      const provider = meetingData.meeting_provider || 'jitsi';
      let meetingUrl = meetingData.meeting_url ? meetingData.meeting_url.trim() : '';

      if (!meetingUrl) {
        // Free zero-config open WebRTC meeting room
        meetingUrl = `https://meet.jit.si/studysync-${roomId.replace(/[^a-zA-Z0-9-]/g, '')}`;
      }

      const now = new Date().toISOString();

      txDb.prepare(`
        UPDATE rooms 
        SET meeting_url = ?, meeting_provider = ?, meeting_active = 1, meeting_started_at = ?, meeting_host_id = ?, updated_at = ?
        WHERE id = ?
      `).run(meetingUrl, provider, now, userId, now, roomId);

      // Record creator/host as active meeting participant
      try {
        txDb.prepare(`
          INSERT INTO room_meeting_participants (room_id, user_id, joined_at, last_ping_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(room_id, user_id) DO UPDATE SET last_ping_at = excluded.last_ping_at
        `).run(roomId, userId, now, now);
      } catch {
        // Table created via migration 016
      }

      // System announcement in chat
      const providerLabel = provider === 'jitsi'
        ? 'Jitsi Meet (Free WebRTC Video)'
        : provider === 'google_meet'
          ? 'Google Meet'
          : provider === 'zoom'
            ? 'Zoom'
            : 'Virtual Study Call';

      try {
        const msgId = `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        txDb.prepare(`
          INSERT INTO room_messages (id, room_id, sender_id, message_content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          msgId,
          roomId,
          userId,
          `🎙️ Virtual study call started via ${providerLabel}. Click "Join Meeting" to collaborate.`,
          now
        );
      } catch {
        // Non-fatal if chat insert fails
      }

      return this.findById(roomId, userId, txDb);
    }, customDb);
  },

  /**
   * Participant joins the active virtual study meeting in the room
   */
  joinMeeting(roomId, userId, customDb = null) {
    return withTransaction((txDb) => {
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      const isMember = txDb.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, userId);
      if (!isMember && room.creator_id !== userId) {
        const err = new Error('You must be a member of this room to join its meeting');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      if (!room.meeting_active || !room.meeting_url) {
        const err = new Error('There is no active meeting in this room');
        err.code = 'NO_ACTIVE_MEETING';
        err.statusCode = 400;
        throw err;
      }

      const now = new Date().toISOString();
      try {
        txDb.prepare(`
          INSERT INTO room_meeting_participants (room_id, user_id, joined_at, last_ping_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(room_id, user_id) DO UPDATE SET last_ping_at = excluded.last_ping_at
        `).run(roomId, userId, now, now);
      } catch {}

      return this.findById(roomId, userId, txDb);
    }, customDb);
  },

  /**
   * Participant leaves the virtual study meeting (does NOT terminate the call for other participants)
   */
  leaveMeeting(roomId, userId, customDb = null) {
    return withTransaction((txDb) => {
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      try {
        txDb.prepare('DELETE FROM room_meeting_participants WHERE room_id = ? AND user_id = ?').run(roomId, userId);
      } catch {}

      // Notice: We do NOT set meeting_active = 0 here.
      // Other students in the room may still be collaborating in the call.
      // Only the host/creator calling endMeeting ends the call for everyone.

      return this.findById(roomId, userId, txDb);
    }, customDb);
  },

  /**
   * End the live virtual study meeting in the room for all participants
   */
  endMeeting(roomId, userId, customDb = null) {
    return withTransaction((txDb) => {
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      const isMember = txDb.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, userId);
      if (!isMember && room.creator_id !== userId) {
        const err = new Error('You must be a member of this room to end a meeting');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      // Check authorization: only the meeting host can end the meeting for everyone
      const isHost = room.meeting_host_id
        ? room.meeting_host_id === userId
        : room.creator_id === userId;
      if (!isHost) {
        const err = new Error('Only the host of this study meeting can end the meeting for everyone. Participants can exit using Leave Call.');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      const now = new Date().toISOString();

      txDb.prepare(`
        UPDATE rooms 
        SET meeting_active = 0, meeting_url = NULL, meeting_host_id = NULL, updated_at = ?
        WHERE id = ?
      `).run(now, roomId);

      try {
        txDb.prepare('DELETE FROM room_meeting_participants WHERE room_id = ?').run(roomId);
      } catch {}

      try {
        const msgId = `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        txDb.prepare(`
          INSERT INTO room_messages (id, room_id, sender_id, message_content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          msgId,
          roomId,
          userId,
          '⏹️ Virtual study call ended. Notes and room discussion remain saved for study review.',
          now
        );
      } catch {
        // Non-fatal
      }

      return this.findById(roomId, userId, txDb);
    }, customDb);
  },

  /**
   * Join a room with capacity and duplicate membership checks
   */
  join(roomId, userId, customDb = null) {
    return withTransaction((txDb) => {
      // 1. Validate room exists
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      if (room.status !== 'active') {
        const err = new Error('This room is archived and no longer accepting new members');
        err.code = 'ROOM_NOT_JOINABLE';
        err.statusCode = 400;
        throw err;
      }

      // 2. Check if already a member
      const existingMembership = txDb.prepare(
        'SELECT id FROM room_memberships WHERE room_id = ? AND user_id = ?'
      ).get(roomId, userId);

      if (existingMembership) {
        const err = new Error('You are already a member of this room');
        err.code = 'DUPLICATE_MEMBERSHIP';
        err.statusCode = 409;
        throw err;
      }

      // 3. Enforce capacity
      const countRow = txDb.prepare(
        'SELECT COUNT(*) AS count FROM room_memberships WHERE room_id = ?'
      ).get(roomId);
      const currentCount = countRow ? countRow.count : 0;

      if (currentCount >= room.max_capacity) {
        const err = new Error(`Room has reached maximum capacity of ${room.max_capacity} members`);
        err.code = 'ROOM_FULL';
        err.statusCode = 409;
        throw err;
      }

      // 4. Create membership
      const membershipId = `mem-${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      txDb.prepare(`
        INSERT INTO room_memberships (id, room_id, user_id, membership_role, joined_at)
        VALUES (?, ?, ?, 'member', ?)
      `).run(membershipId, roomId, userId, now);

      // 5. Activity log
      try {
        txDb.prepare(`
          INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
          VALUES (?, ?, 'room_joined', ?, ?, ?)
        `).run(
          `act-${crypto.randomUUID().slice(0, 8)}`,
          userId,
          `Joined study room "${room.room_name}"`,
          roomId,
          now
        );
      } catch {
        // Non-blocking
      }

      // 6. Notify room creator
      if (room.creator_id && room.creator_id !== userId) {
        try {
          const joiner = txDb.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
          NotificationModel.createNotification({
            userId: room.creator_id,
            actorId: userId,
            type: 'room_activity',
            title: `${joiner?.display_name || 'A scholar'} joined your room`,
            body: `Joined "${room.room_name}"`,
            targetUrl: `/rooms/${roomId}`,
            referenceId: `room-${roomId}-${userId}`,
          }, txDb);
        } catch {
          // Non-blocking
        }
      }

      return {
        membershipId,
        roomId,
        userId,
        membershipRole: 'member',
        joinedAt: now,
        isMember: true,
        memberCount: currentCount + 1,
      };
    }, customDb);
  },

  /**
   * Find a room by its human-readable room code (case-insensitive, trims accidental spaces)
   */
  findByCode(code, currentUserId = null, customDb = null) {
    if (!code || typeof code !== 'string') return null;
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return null;

    const db = customDb || getDb();
    const row = db.prepare('SELECT id FROM rooms WHERE UPPER(room_code) = UPPER(?)').get(cleanCode);
    if (!row) return null;

    return this.findById(row.id, currentUserId, db);
  },

  /**
   * Join a study room securely using a human-readable room code
   * Validates room existence, active status, code join permissions, capacity, and blocks
   */
  joinByCode(code, userId, customDb = null) {
    if (!code || typeof code !== 'string') {
      const err = new Error('Room code is required');
      err.code = 'INVALID_ROOM_CODE';
      err.statusCode = 400;
      throw err;
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length === 0) {
      const err = new Error('Room code cannot be empty');
      err.code = 'INVALID_ROOM_CODE';
      err.statusCode = 400;
      throw err;
    }

    return withTransaction((txDb) => {
      // 1. Locate room case-insensitively
      const room = txDb.prepare('SELECT * FROM rooms WHERE UPPER(room_code) = UPPER(?)').get(cleanCode);
      if (!room) {
        const err = new Error(`No study room found matching code "${cleanCode}". Please verify the code and try again.`);
        err.code = 'INVALID_ROOM_CODE';
        err.statusCode = 404;
        throw err;
      }

      // 2. Validate room status (active vs archived)
      if (room.status !== 'active') {
        const err = new Error('This study room invitation has expired because the room has been archived or closed.');
        err.code = 'EXPIRED_INVITATION';
        err.statusCode = 410;
        throw err;
      }

      // 3. Validate code joining permission
      if (room.code_join_enabled === 0) {
        const err = new Error('Code-based joining has been disabled for this study room by the host.');
        err.code = 'ROOM_RESTRICTED';
        err.statusCode = 403;
        throw err;
      }

      // 4. Safety & Trust: Verify neither user has blocked the other
      try {
        const isBlocked = txDb.prepare(`
          SELECT 1 FROM user_blocks 
          WHERE (blocker_id = ? AND blocked_id = ?) 
             OR (blocker_id = ? AND blocked_id = ?)
        `).get(userId, room.creator_id, room.creator_id, userId);

        if (isBlocked) {
          const err = new Error('You cannot join this study room due to user safety preferences.');
          err.code = 'FORBIDDEN';
          err.statusCode = 403;
          throw err;
        }
      } catch (err) {
        if (err.code === 'FORBIDDEN') throw err;
      }

      // 5. Check if user is already a member
      const existingMembership = txDb.prepare(
        'SELECT id FROM room_memberships WHERE room_id = ? AND user_id = ?'
      ).get(room.id, userId);

      if (existingMembership) {
        const fullRoom = this.findById(room.id, userId, txDb);
        return {
          room: fullRoom,
          joined: false,
          alreadyMember: true,
          message: 'You are already a member of this room',
          roomId: room.id,
        };
      }

      // 6. Enforce capacity limit
      const countRow = txDb.prepare(
        'SELECT COUNT(*) AS count FROM room_memberships WHERE room_id = ?'
      ).get(room.id);
      const currentCount = countRow ? countRow.count : 0;

      if (currentCount >= room.max_capacity) {
        const err = new Error(`This study room has reached its maximum capacity of ${room.max_capacity} members.`);
        err.code = 'ROOM_FULL';
        err.statusCode = 409;
        throw err;
      }

      // 7. Insert membership
      const membershipId = `mem-${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      txDb.prepare(`
        INSERT INTO room_memberships (id, room_id, user_id, membership_role, joined_at)
        VALUES (?, ?, ?, 'member', ?)
      `).run(membershipId, room.id, userId, now);

      // 8. Record learning activity
      try {
        txDb.prepare(`
          INSERT INTO learning_activities (id, user_id, activity_type, description, entity_id, created_at)
          VALUES (?, ?, 'room_joined', ?, ?, ?)
        `).run(
          `act-${crypto.randomUUID().slice(0, 8)}`,
          userId,
          `Joined study room "${room.room_name}" via invite code`,
          room.id,
          now
        );
      } catch {}

      // 9. Notify room creator
      if (room.creator_id && room.creator_id !== userId) {
        try {
          const joiner = txDb.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
          NotificationModel.createNotification({
            userId: room.creator_id,
            actorId: userId,
            type: 'room_activity',
            title: `${joiner?.display_name || 'A scholar'} joined your room`,
            body: `Joined "${room.room_name}" with room code`,
            targetUrl: `/rooms/${room.id}`,
            referenceId: `room-${room.id}-${userId}`,
          }, txDb);
        } catch {}
      }

      const fullRoom = this.findById(room.id, userId, txDb);
      return {
        room: fullRoom,
        joined: true,
        alreadyMember: false,
        membershipId,
        roomId: room.id,
      };
    }, customDb);
  },

  /**
   * Regenerate room code (Host only)
   */
  regenerateCode(roomId, userId, customDb = null) {
    return withTransaction((txDb) => {
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      if (room.creator_id !== userId) {
        const err = new Error('Only the room host can regenerate the room code.');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      const newCode = generateUniqueRoomCode(room.subject, room.topic, room.room_name, txDb);
      const now = new Date().toISOString();

      txDb.prepare('UPDATE rooms SET room_code = ?, updated_at = ? WHERE id = ?').run(newCode, now, roomId);

      return {
        roomId,
        room_code: newCode,
        roomCode: newCode,
        code_join_enabled: Boolean(room.code_join_enabled),
        codeJoinEnabled: Boolean(room.code_join_enabled),
      };
    }, customDb);
  },

  /**
   * Toggle or set code-based joining permission (Host only)
   */
  toggleCodeJoin(roomId, userId, enabled = null, customDb = null) {
    return withTransaction((txDb) => {
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      if (room.creator_id !== userId) {
        const err = new Error('Only the room host can update code joining permissions.');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      const nextEnabled = enabled !== null
        ? (enabled ? 1 : 0)
        : (room.code_join_enabled ? 0 : 1);

      const now = new Date().toISOString();
      txDb.prepare('UPDATE rooms SET code_join_enabled = ?, updated_at = ? WHERE id = ?').run(nextEnabled, now, roomId);

      return {
        roomId,
        room_code: room.room_code,
        roomCode: room.room_code,
        code_join_enabled: Boolean(nextEnabled),
        codeJoinEnabled: Boolean(nextEnabled),
      };
    }, customDb);
  },

  /**
   * Leave a room with ownership safety checks
   */
  leave(roomId, userId, customDb = null) {
    return withTransaction((txDb) => {
      // 1. Validate room exists
      const room = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) {
        const err = new Error(`Room not found: ${roomId}`);
        err.code = 'NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      // 2. Check current membership
      const membership = txDb.prepare(
        'SELECT id, membership_role FROM room_memberships WHERE room_id = ? AND user_id = ?'
      ).get(roomId, userId);

      if (!membership) {
        const err = new Error('You are not a member of this room');
        err.code = 'NOT_A_MEMBER';
        err.statusCode = 400;
        throw err;
      }

      // 3. Count total members
      const countRow = txDb.prepare(
        'SELECT COUNT(*) AS count FROM room_memberships WHERE room_id = ?'
      ).get(roomId);
      const totalMembers = countRow ? countRow.count : 1;

      // 4. Guard owner/creator leaving
      const isOwner = room.creator_id === userId || membership.membership_role === 'creator';
      if (isOwner && totalMembers > 1) {
        const err = new Error(
          'Room creator cannot leave while other learners are still in the room. Please archive the room or transfer ownership first.'
        );
        err.code = 'CREATOR_CANNOT_LEAVE';
        err.statusCode = 400;
        throw err;
      }

      // 5. Delete membership
      txDb.prepare(
        'DELETE FROM room_memberships WHERE room_id = ? AND user_id = ?'
      ).run(roomId, userId);

      // If owner was the sole member leaving, archive the room to keep it manageable
      if (isOwner && totalMembers === 1) {
        txDb.prepare("UPDATE rooms SET status = 'archived' WHERE id = ?").run(roomId);
      }

      const updatedCount = Math.max(0, totalMembers - 1);

      return {
        left: true,
        roomId,
        userId,
        isMember: false,
        memberCount: updatedCount,
      };
    }, customDb);
  },

  /**
   * Retrieve deterministic room recommendations based on learner's syllabus topics
   */
  getRecommendations(userId, limit = 4, customDb = null) {
    const db = customDb || getDb();

    // 1. Fetch user's active subjects and topics
    let subjects = [];
    let topics = [];

    if (userId) {
      const userSubjects = db.prepare(
        'SELECT subject FROM user_subjects WHERE user_id = ?'
      ).all(userId);
      subjects = userSubjects.map((s) => s.subject.toLowerCase());

      const userPrefs = db.prepare(`
        SELECT lt.subject, lt.topic_name
        FROM user_learning_preferences ulp
        JOIN learning_topics lt ON ulp.topic_id = lt.id
        WHERE ulp.user_id = ? AND ulp.is_learning_now = 1
      `).all(userId);

      topics = userPrefs.map((p) => p.topic_name.toLowerCase());
      subjects.push(...userPrefs.map((p) => p.subject.toLowerCase()));
      subjects = [...new Set(subjects)];
    }

    // 2. Fetch all active rooms
    const activeRooms = this.findAll({ status: 'active', limit: 20 }, userId, db).items;

    if (activeRooms.length === 0) return [];

    // 3. Deterministic ranking:
    // +20 points if room topic matches user's active topic
    // +10 points if room subject matches user's active subject
    // +points based on active member count (more active rooms ranked higher)
    const scoredRooms = activeRooms.map((room) => {
      let score = 0;
      const roomSub = (room.subject || '').toLowerCase();
      const roomTop = (room.topic || '').toLowerCase();

      if (topics.some((t) => roomTop.includes(t) || t.includes(roomTop))) {
        score += 20;
      }
      if (subjects.some((s) => roomSub === s)) {
        score += 10;
      }
      score += Math.min(room.member_count, 10);

      return { room, score };
    });

    scoredRooms.sort((a, b) => b.score - a.score);

    return scoredRooms.slice(0, limit).map((s) => s.room);
  },

  /**
   * List questions with their replies for a specific room (with blocking-aware masking)
   */
  getQuestions(roomId, currentUserId = null, customDb = null) {
    const db = customDb || getDb();

    let blockedUserIds = new Set();
    if (currentUserId) {
      try {
        const blocks = db.prepare(`
          SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = ?
        `).all(currentUserId, currentUserId);
        blockedUserIds = new Set(blocks.map((b) => b.uid));
      } catch (err) {
        // user_blocks table may not exist in mock db or early migrations
      }
    }

    const rawQuestions = db.prepare(`
      SELECT 
        q.id,
        q.question_content,
        q.topic,
        q.is_resolved,
        q.created_at,
        q.updated_at,
        u.id AS asker_id,
        u.display_name AS asker_name
      FROM room_questions q
      JOIN users u ON q.asker_id = u.id
      WHERE q.room_id = ?
      ORDER BY q.created_at DESC
    `).all(roomId);

    const getResponsesStmt = db.prepare(`
      SELECT 
        qr.id,
        qr.response_content,
        qr.created_at,
        u.id AS responder_id,
        u.display_name AS responder_name
      FROM question_responses qr
      JOIN users u ON qr.responder_id = u.id
      WHERE qr.question_id = ?
      ORDER BY qr.created_at ASC
    `);

    return rawQuestions.map((q) => {
      const rawResponses = getResponsesStmt.all(q.id);
      const responses = rawResponses.map((r) => {
        const isRespBlocked = blockedUserIds.has(r.responder_id);
        return {
          id: r.id,
          responder_id: r.responder_id,
          author: isRespBlocked ? 'Blocked User' : r.responder_name,
          authorInitials: isRespBlocked ? 'BU' : (r.responder_name || 'U').slice(0, 2).toUpperCase(),
          text: isRespBlocked ? '[Response from blocked user hidden]' : r.response_content,
          response_content: isRespBlocked ? '[Response from blocked user hidden]' : r.response_content,
          isBlocked: isRespBlocked,
          created_at: r.created_at,
          time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      });

      const isAskerBlocked = blockedUserIds.has(q.asker_id);
      return {
        id: q.id,
        room_id: roomId,
        question: isAskerBlocked ? '[Question from blocked user hidden]' : q.question_content,
        question_content: isAskerBlocked ? '[Question from blocked user hidden]' : q.question_content,
        topic: q.topic || 'General Doubt',
        asker_id: q.asker_id,
        asker: isAskerBlocked ? 'Blocked User' : q.asker_name,
        askerInitials: isAskerBlocked ? 'BU' : (q.asker_name || 'U').slice(0, 2).toUpperCase(),
        resolved: Boolean(q.is_resolved),
        is_resolved: Boolean(q.is_resolved),
        isBlocked: isAskerBlocked,
        replyCount: responses.length,
        created_at: q.created_at,
        updated_at: q.updated_at,
        time: new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responses,
      };
    });
  },

  /**
   * Post a question/doubt in a room (room members/creator only)
   */
  createQuestion(roomId, askerId, data, customDb = null) {
    const db = customDb || getDb();
    const room = db.prepare('SELECT id, topic, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Verify membership or room ownership
    const isMember = db.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, askerId);
    if (!isMember && room.creator_id !== askerId) {
      const err = new Error('You must be a member of this room to post a doubt');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const topic = sanitizeContentText(data.topic || room.topic || 'General Doubt');
    const cleanContent = sanitizeContentText(data.question_content);

    db.prepare(`
      INSERT INTO room_questions (id, room_id, asker_id, question_content, topic, is_resolved, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, roomId, askerId, cleanContent, topic, now, now);

    const asker = db.prepare('SELECT display_name FROM users WHERE id = ?').get(askerId);

    return {
      id,
      room_id: roomId,
      question: cleanContent,
      question_content: cleanContent,
      topic,
      asker_id: askerId,
      asker: asker?.display_name || 'You',
      askerInitials: (asker?.display_name || 'U').slice(0, 2).toUpperCase(),
      resolved: false,
      is_resolved: false,
      replyCount: 0,
      created_at: now,
      updated_at: now,
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      responses: [],
    };
  },

  /**
   * Reply to a question (room members/creator only)
   */
  createQuestionReply(roomId, questionId, responderId, data, customDb = null) {
    const db = customDb || getDb();
    const room = db.prepare('SELECT id, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const question = db.prepare('SELECT id, asker_id, question_content FROM room_questions WHERE id = ? AND room_id = ?').get(questionId, roomId);
    if (!question) {
      const err = new Error(`Question not found in room: ${questionId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Verify membership or room ownership
    const isMember = db.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, responderId);
    if (!isMember && room.creator_id !== responderId) {
      const err = new Error('You must be a member of this room to reply to a doubt');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const id = `resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const cleanContent = sanitizeContentText(data.response_content);

    db.prepare(`
      INSERT INTO question_responses (id, question_id, responder_id, response_content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, questionId, responderId, cleanContent, now);

    db.prepare('UPDATE room_questions SET updated_at = ? WHERE id = ?').run(now, questionId);

    const responder = db.prepare('SELECT display_name FROM users WHERE id = ?').get(responderId);

    // Notify question author
    if (question.asker_id && question.asker_id !== responderId) {
      try {
        const roomData = db.prepare('SELECT room_name FROM rooms WHERE id = ?').get(roomId);
        NotificationModel.createNotification({
          userId: question.asker_id,
          actorId: responderId,
          type: 'question_reply',
          title: `${responder?.display_name || 'A scholar'} replied to your question`,
          body: `"${cleanContent.slice(0, 60)}" in ${roomData?.room_name || 'Room'}`,
          targetUrl: `/rooms/${roomId}?tab=doubts`,
          referenceId: questionId,
        }, db);
      } catch {
        // Ignored
      }
    }

    return {
      id,
      question_id: questionId,
      responder_id: responderId,
      author: responder?.display_name || 'You',
      authorInitials: (responder?.display_name || 'U').slice(0, 2).toUpperCase(),
      text: cleanContent,
      response_content: cleanContent,
      created_at: now,
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  },

  /**
   * Mark a question as resolved or open (question asker or room creator only)
   */
  toggleResolveQuestion(roomId, questionId, userId, customDb = null) {
    const db = customDb || getDb();
    const room = db.prepare('SELECT id, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const question = db.prepare('SELECT * FROM room_questions WHERE id = ? AND room_id = ?').get(questionId, roomId);
    if (!question) {
      const err = new Error(`Question not found: ${questionId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (question.asker_id !== userId && room.creator_id !== userId) {
      const err = new Error('Only the question author or room creator can resolve this question');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const nextResolved = question.is_resolved ? 0 : 1;
    const now = new Date().toISOString();

    db.prepare('UPDATE room_questions SET is_resolved = ?, updated_at = ? WHERE id = ?').run(nextResolved, now, questionId);

    return {
      id: questionId,
      room_id: roomId,
      is_resolved: Boolean(nextResolved),
      resolved: Boolean(nextResolved),
      updated_at: now,
    };
  },

  /**
   * Delete a question (author or room creator only)
   */
  deleteQuestion(roomId, questionId, userId, customDb = null) {
    const db = customDb || getDb();
    const room = db.prepare('SELECT id, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const question = db.prepare('SELECT * FROM room_questions WHERE id = ? AND room_id = ?').get(questionId, roomId);
    if (!question) {
      const err = new Error(`Question not found: ${questionId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (question.asker_id !== userId && room.creator_id !== userId) {
      const err = new Error('Only the question author or room creator can delete this question');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    db.prepare('DELETE FROM room_questions WHERE id = ?').run(questionId);

    return { deleted: true, id: questionId };
  },

  /**
   * List shared resources in a room
   */
  getResources(roomId, customDb = null) {
    const db = customDb || getDb();
    const rows = db.prepare(`
      SELECT 
        nr.id,
        nr.title,
        nr.content,
        nr.description,
        nr.resource_reference,
        nr.resource_type,
        nr.topic,
        nr.author_id,
        nr.created_at,
        nr.updated_at,
        u.display_name AS author_name
      FROM notes_resources nr
      LEFT JOIN users u ON nr.author_id = u.id
      WHERE nr.room_id = ? AND nr.is_archived = 0
      ORDER BY nr.created_at DESC
    `).all(roomId);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.resource_type || 'Resource',
      resource_type: r.resource_type || 'Resource',
      topic: r.topic || '',
      description: r.description || r.content || '',
      url: r.resource_reference || null,
      resource_reference: r.resource_reference || null,
      author: r.author_name || 'Peer',
      author_id: r.author_id,
      authorInitials: (r.author_name || 'P').slice(0, 2).toUpperCase(),
      created_at: r.created_at,
      time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  },

  /**
   * Share a resource in a room (room members/creator only)
   */
  createResource(roomId, authorId, data, customDb = null) {
    const db = customDb || getDb();
    const room = db.prepare('SELECT id, subject, topic, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Verify membership or room ownership
    const isMember = db.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, authorId);
    if (!isMember && room.creator_id !== authorId) {
      const err = new Error('You must be a member of this room to share a resource');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const topic = sanitizeContentText(data.topic || room.topic || 'General');
    const type = data.resource_type || data.type || 'Resource';
    const desc = sanitizeContentText(data.description || '');
    const title = sanitizeContentText(data.title || '');
    const ref = data.resource_reference || data.url || null;

    if (ref && !ref.startsWith('/')) {
      if (!validateSafeUrl(ref)) {
        const err = new Error('Invalid or unsafe resource URL. Only HTTP and HTTPS addresses are allowed.');
        err.statusCode = 400;
        err.code = 'INVALID_INPUT';
        throw err;
      }
    }

    db.prepare(`
      INSERT INTO notes_resources (
        id, title, content, description, resource_reference, resource_type,
        subject, topic, author_id, room_id, visibility, is_archived,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'room_shared', 0, ?, ?)
    `).run(
      id,
      title,
      desc,
      desc,
      ref,
      type,
      room.subject,
      topic,
      authorId,
      roomId,
      now,
      now
    );

    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(authorId);

    return {
      id,
      title: data.title,
      type,
      resource_type: type,
      topic,
      description: desc,
      url: ref,
      resource_reference: ref,
      author: user?.display_name || 'You',
      author_id: authorId,
      authorInitials: (user?.display_name || 'U').slice(0, 2).toUpperCase(),
      created_at: now,
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  },

  /**
   * Delete a resource (uploader or room creator only)
   */
  deleteResource(roomId, resourceId, userId, customDb = null) {
    const db = customDb || getDb();
    const room = db.prepare('SELECT id, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const resource = db.prepare('SELECT * FROM notes_resources WHERE id = ? AND room_id = ? AND is_archived = 0').get(resourceId, roomId);
    if (!resource) {
      const err = new Error(`Resource not found: ${resourceId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (resource.author_id !== userId && room.creator_id !== userId) {
      const err = new Error('Only the uploader or room creator can delete this resource');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE notes_resources SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, resourceId);

    return { deleted: true, id: resourceId };
  },

  /**
   * Send a persistent chat message in a room (authorized members and creator only)
   */
  createMessage(roomId, senderId, data, customDb = null) {
    const db = customDb || getDb();

    // 1. Validate room exists
    const room = db.prepare('SELECT id, room_name, status, room_type, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Validate room is not archived
    if (room.status === 'archived') {
      const err = new Error('This room is archived and no longer accepting messages');
      err.statusCode = 400;
      err.code = 'ROOM_ARCHIVED';
      throw err;
    }

    // 3. Enforce room membership (member or creator)
    const isMember = db.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, senderId);
    if (!isMember && room.creator_id !== senderId) {
      const err = new Error('You must be a member of this room to send messages');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // 4. Generate persistent message ID and timestamp
    const id = `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const cleanContent = sanitizeContentText(data.message_content);

    // 5. Insert into room_messages using parameterized query
    db.prepare(`
      INSERT INTO room_messages (id, room_id, sender_id, message_content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, roomId, senderId, cleanContent, now);

    // 6. Update room updated_at timestamp
    db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(now, roomId);

    // 7. Retrieve sender profile details
    const sender = db.prepare(`
      SELECT u.id, u.display_name, u.avatar_url, lp.headline, lp.skill_level
      FROM users u
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      WHERE u.id = ?
    `).get(senderId);

    const senderName = sender?.display_name || 'Scholar';
    const initials = (senderName || 'U').slice(0, 2).toUpperCase();
    const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      id,
      room_id: roomId,
      sender_id: senderId,
      sender: senderName,
      sender_name: senderName,
      initials,
      avatar_url: sender?.avatar_url || null,
      message_content: cleanContent,
      text: cleanContent,
      topicTag: data.topicTag || null,
      created_at: now,
      time: timeStr,
    };
  },

  /**
   * Retrieve persistent messages for a room with pagination, ordering, and block masking
   */
  getMessages(roomId, currentUserId = null, options = {}, customDb = null) {
    const db = customDb || getDb();

    // 1. Validate room exists
    const room = db.prepare('SELECT id, room_name, status, room_type, creator_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      const err = new Error(`Topic room not found: ${roomId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Enforce private room access boundary
    const isPrivateRoom = room.status === 'private' || String(room.room_type || '').toLowerCase() === 'private';
    if (isPrivateRoom) {
      if (!currentUserId) {
        const err = new Error('Authentication required to access this private room');
        err.statusCode = 401;
        err.code = 'UNAUTHENTICATED';
        throw err;
      }

      const isMember = db.prepare('SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?').get(roomId, currentUserId);
      if (!isMember && room.creator_id !== currentUserId) {
        const err = new Error('You do not have permission to view messages in this private room');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    // 3. Safety Block Masking
    let blockedUserIds = new Set();
    if (currentUserId) {
      try {
        const blocks = db.prepare(`
          SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = ?
        `).all(currentUserId, currentUserId);
        blockedUserIds = new Set(blocks.map((b) => b.uid));
      } catch {
        // user_blocks may not exist in minimal environments
      }
    }

    // 4. Pagination & Ordering
    const limit = options.limit ? Math.max(1, Math.min(100, parseInt(options.limit, 10))) : 50;
    const offset = options.offset ? Math.max(0, parseInt(options.offset, 10)) : 0;

    let whereClause = 'WHERE m.room_id = ?';
    const params = [roomId];

    if (options.before) {
      whereClause += ' AND m.created_at < ?';
      params.push(options.before);
    }

    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM room_messages m ${whereClause}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const queryParams = [...params, limit, offset];
    const rawRows = db.prepare(`
      SELECT 
        m.id,
        m.message_content,
        m.created_at,
        u.id AS sender_id,
        u.display_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM room_messages m
      JOIN users u ON m.sender_id = u.id
      ${whereClause}
      ORDER BY m.created_at ASC
      LIMIT ? OFFSET ?
    `).all(...queryParams);

    const messages = rawRows.map((m) => {
      const isBlockedSender = blockedUserIds.has(m.sender_id);
      return {
        id: m.id,
        room_id: roomId,
        sender_id: m.sender_id,
        sender: isBlockedSender ? 'Blocked User' : m.sender_name,
        sender_name: isBlockedSender ? 'Blocked User' : m.sender_name,
        initials: isBlockedSender ? 'BU' : (m.sender_name || 'U').slice(0, 2).toUpperCase(),
        avatar_url: isBlockedSender ? null : m.sender_avatar,
        text: isBlockedSender ? '[Message from blocked user hidden]' : m.message_content,
        message_content: isBlockedSender ? '[Message from blocked user hidden]' : m.message_content,
        isBlocked: isBlockedSender,
        created_at: m.created_at,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    return {
      messages,
      total,
      limit,
      offset,
      hasMore: offset + messages.length < total,
    };
  },

  count(customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT COUNT(*) AS count FROM rooms').get();
    return row.count;
  },
};

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export default RoomModel;
