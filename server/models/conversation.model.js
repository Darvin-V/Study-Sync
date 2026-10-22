import { getDb, withTransaction } from '../db/connection.js';
import SafetyModel from './safety.model.js';
import NotificationModel from './notification.model.js';
import RoomModel from './room.model.js';
import crypto from 'node:crypto';

/**
 * StudySync AI — Direct Messaging & Conversation Model (Phase 4)
 * 
 * Manages authenticated 1-to-1 conversations and direct messages:
 * - Exactly two distinct participants per conversation (enforced with canonical ordering)
 * - Duplicate conversation prevention via UNIQUE (participant_one_id, participant_two_id)
 * - Safe participant projection without leaking sensitive credentials or tokens
 * - Strict authorization boundary enforcement
 * - Two-way blocking enforcement integration
 */
export const ConversationModel = {
  /**
   * Helper to retrieve active meeting status for an associated study room
   */
  _getMeetingInfo(roomId, db) {
    if (!roomId) return { roomId: null, hasActiveMeeting: false, meetingUrl: null, meetingProvider: null };
    try {
      const room = db.prepare('SELECT id, meeting_active, meeting_url, meeting_provider FROM rooms WHERE id = ?').get(roomId);
      return {
        roomId,
        hasActiveMeeting: Boolean(room?.meeting_active),
        meetingUrl: room?.meeting_url || null,
        meetingProvider: room?.meeting_provider || null,
      };
    } catch {
      return { roomId, hasActiveMeeting: false, meetingUrl: null, meetingProvider: null };
    }
  },

  /**
   * Helper to format a public participant profile without sensitive information
   */
  _formatParticipant(user) {
    if (!user) return null;
    const name = user.display_name || user.name || 'Student';
    const parts = name.trim().split(/\s+/);
    const initials = parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

    return {
      id: user.id,
      displayName: user.display_name,
      name: user.display_name,
      avatarUrl: user.avatar_url || null,
      initials,
      headline: user.headline || 'Student',
      institution: user.show_institution === 0 ? null : (user.institution || null),
    };
  },

  /**
   * Find or create a 1-to-1 conversation between two users
   */
  getOrCreateConversation(userId1, userId2, customDb = null) {
    if (!userId1 || !userId2) {
      const err = new Error('Two participant IDs are required');
      err.statusCode = 400;
      err.code = 'INVALID_PARTICIPANTS';
      throw err;
    }

    if (userId1 === userId2) {
      const err = new Error('Cannot start a conversation with yourself');
      err.statusCode = 400;
      err.code = 'SELF_CONVERSATION';
      throw err;
    }

    const db = customDb || getDb();

    // Verify recipient exists and is active/verified
    const otherUser = db.prepare(`
      SELECT u.id, u.display_name, u.avatar_url, lp.headline, lp.institution,
             COALESCE(ups.show_institution, 1) AS show_institution
      FROM users u
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      WHERE u.id = ? AND (u.is_active IS NULL OR u.is_active = 1)
    `).get(userId2);

    if (!otherUser) {
      const err = new Error('Participant does not exist or is inactive');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    // Check blocking restrictions
    if (SafetyModel.isBlocked(userId1, userId2, db)) {
      const err = new Error('Cannot message this user due to privacy or blocking restrictions');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // Canonical ordering: p1 < p2
    const p1 = userId1 < userId2 ? userId1 : userId2;
    const p2 = userId1 < userId2 ? userId2 : userId1;

    let conv = db.prepare(`
      SELECT * FROM conversations
      WHERE participant_one_id = ? AND participant_two_id = ?
    `).get(p1, p2);

    const now = new Date().toISOString();

    if (!conv) {
      const convId = `conv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO conversations (id, participant_one_id, participant_two_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(convId, p1, p2, now, now);

      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    }

    // Query unread count for userId1
    const unread = db.prepare(`
      SELECT COUNT(*) AS unread_count
      FROM direct_messages
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `).get(conv.id, userId1)?.unread_count || 0;

    const meetingInfo = this._getMeetingInfo(conv.room_id, db);

    return {
      id: conv.id,
      participantOneId: conv.participant_one_id,
      participantTwoId: conv.participant_two_id,
      lastMessageAt: conv.last_message_at,
      lastMessagePreview: conv.last_message_preview,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      unreadCount: unread,
      otherParticipant: this._formatParticipant(otherUser),
      ...meetingInfo,
    };
  },

  /**
   * Get a conversation by ID, enforcing that the requesting user is a participant
   */
  getConversationById(conversationId, currentUserId, customDb = null) {
    if (!conversationId) {
      const err = new Error('Conversation ID is required');
      err.statusCode = 400;
      err.code = 'INVALID_PARAM';
      throw err;
    }

    const db = customDb || getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);

    if (!conv) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Enforce participant authorization
    if (conv.participant_one_id !== currentUserId && conv.participant_two_id !== currentUserId) {
      const err = new Error('You are not authorized to access this conversation');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const otherId = conv.participant_one_id === currentUserId ? conv.participant_two_id : conv.participant_one_id;
    const otherUser = db.prepare(`
      SELECT u.id, u.display_name, u.avatar_url, lp.headline, lp.institution,
             COALESCE(ups.show_institution, 1) AS show_institution
      FROM users u
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      WHERE u.id = ?
    `).get(otherId);

    const unread = db.prepare(`
      SELECT COUNT(*) AS unread_count
      FROM direct_messages
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `).get(conv.id, currentUserId)?.unread_count || 0;

    const meetingInfo = this._getMeetingInfo(conv.room_id, db);

    return {
      id: conv.id,
      participantOneId: conv.participant_one_id,
      participantTwoId: conv.participant_two_id,
      lastMessageAt: conv.last_message_at,
      lastMessagePreview: conv.last_message_preview,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      unreadCount: unread,
      otherParticipant: this._formatParticipant(otherUser),
      ...meetingInfo,
    };
  },

  /**
   * Get all conversations for a user
   */
  getUserConversations(currentUserId, customDb = null) {
    if (!currentUserId) return [];
    const db = customDb || getDb();

    const rows = db.prepare(`
      SELECT c.*
      FROM conversations c
      WHERE c.participant_one_id = ? OR c.participant_two_id = ?
      ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC
    `).all(currentUserId, currentUserId);

    const getOtherUserStmt = db.prepare(`
      SELECT u.id, u.display_name, u.avatar_url, lp.headline, lp.institution,
             COALESCE(ups.show_institution, 1) AS show_institution
      FROM users u
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      WHERE u.id = ?
    `);

    const getUnreadStmt = db.prepare(`
      SELECT COUNT(*) AS unread_count
      FROM direct_messages
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `);

    return rows.map((conv) => {
      const otherId = conv.participant_one_id === currentUserId ? conv.participant_two_id : conv.participant_one_id;
      const otherUser = getOtherUserStmt.get(otherId);
      const unread = getUnreadStmt.get(conv.id, currentUserId)?.unread_count || 0;
      const meetingInfo = this._getMeetingInfo(conv.room_id, db);

      return {
        id: conv.id,
        participantOneId: conv.participant_one_id,
        participantTwoId: conv.participant_two_id,
        lastMessageAt: conv.last_message_at,
        lastMessagePreview: conv.last_message_preview,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        unreadCount: unread,
        otherParticipant: this._formatParticipant(otherUser),
        ...meetingInfo,
      };
    });
  },

  /**
   * Open or create the dedicated 1-to-1 study room for a conversation.
   * Ensures the room exists, both participants are official members, and returns the room.
   */
  getOrCreateStudyRoom(conversationId, currentUserId, customDb = null) {
    if (!conversationId) {
      const err = new Error('Conversation ID is required');
      err.statusCode = 400;
      err.code = 'INVALID_PARAM';
      throw err;
    }

    const db = customDb || getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);

    if (!conv) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Verify requesting user is a participant
    if (conv.participant_one_id !== currentUserId && conv.participant_two_id !== currentUserId) {
      const err = new Error('You are not authorized to access this conversation');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const otherId = conv.participant_one_id === currentUserId
      ? conv.participant_two_id
      : conv.participant_one_id;

    // Check blocking restrictions
    if (SafetyModel.isBlocked(currentUserId, otherId, db)) {
      const err = new Error('Cannot start a study call due to privacy or blocking restrictions');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const currentUser = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(currentUserId);
    const otherUser = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(otherId);

    const currentUserName = currentUser?.display_name || 'Student';
    const otherUserName = otherUser?.display_name || 'Study Partner';

    return withTransaction((txDb) => {
      let roomId = conv.room_id;
      let existingRoom = null;

      if (roomId) {
        existingRoom = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      }

      const now = new Date().toISOString();

      if (!existingRoom || existingRoom.status !== 'active') {
        // Deterministic room ID linked to conversation to avoid duplicate room creation
        roomId = `room-call-${conv.id.replace(/^conv-/, '')}`;

        existingRoom = txDb.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);

        if (!existingRoom) {
          const roomName = `Study Call: ${currentUserName} & ${otherUserName}`;
          const description = `Dedicated private study room for direct 1-to-1 collaboration between ${currentUserName} and ${otherUserName}.`;

          txDb.prepare(`
            INSERT INTO rooms (
              id, room_name, subject, topic, description, room_type, difficulty,
              preferred_languages, creator_id, max_capacity, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'private', 'Intermediate', '["English"]', ?, 4, 'active', ?, ?)
          `).run(
            roomId,
            roomName,
            'Peer Study',
            '1-to-1 Direct Collaboration',
            description,
            currentUserId,
            now,
            now
          );
        }

        // Link room to conversation
        txDb.prepare('UPDATE conversations SET room_id = ?, updated_at = ? WHERE id = ?').run(roomId, now, conv.id);
      }

      // Ensure BOTH participants are registered members in room_memberships
      const mem1Id = `mem-${roomId}-${currentUserId}`;
      txDb.prepare(`
        INSERT INTO room_memberships (id, room_id, user_id, membership_role, joined_at)
        VALUES (?, ?, ?, 'host', ?)
        ON CONFLICT(room_id, user_id) DO NOTHING
      `).run(mem1Id, roomId, currentUserId, now);

      const mem2Id = `mem-${roomId}-${otherId}`;
      txDb.prepare(`
        INSERT INTO room_memberships (id, room_id, user_id, membership_role, joined_at)
        VALUES (?, ?, ?, 'member', ?)
        ON CONFLICT(room_id, user_id) DO NOTHING
      `).run(mem2Id, roomId, otherId, now);

      return RoomModel.findById(roomId, currentUserId, txDb);
    }, db);
  },


  /**
   * Search registered, verified learners who can be messaged (excludes self and blocked users).
   * Supports searching by learner name or subject. Deduplicates matches to ensure clean contact list.
   */
  searchPotentialRecipients(currentUserId, query = '', limit = 50, customDb = null) {
    if (!currentUserId) return [];
    const db = customDb || getDb();
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const term = (query || '').trim();

    let sql = `
      SELECT u.id, u.display_name, u.avatar_url, lp.headline, lp.institution,
             COALESCE(ups.show_institution, 1) AS show_institution,
             GROUP_CONCAT(DISTINCT us.subject) AS user_subjects_list,
             GROUP_CONCAT(DISTINCT lt.subject) AS pref_subjects_list
      FROM (SELECT * FROM users ORDER BY created_at DESC) u
      LEFT JOIN learner_profiles lp ON u.id = lp.user_id
      LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
      LEFT JOIN user_subjects us ON u.id = us.user_id
      LEFT JOIN user_learning_preferences ulp ON u.id = ulp.user_id
      LEFT JOIN learning_topics lt ON ulp.topic_id = lt.id
      WHERE u.id != ?
        AND (u.is_active IS NULL OR u.is_active = 1)
        AND (u.is_verified = 1)
        AND u.id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
        )
    `;
    const params = [currentUserId, currentUserId, currentUserId];

    const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test';
    const currentUser = db.prepare('SELECT email FROM users WHERE id = ?').get(currentUserId);
    const isRequestingDemo = currentUserId === 'darvin-01' || currentUserId === 'student-arun' || (currentUser && currentUser.email && currentUser.email.endsWith('@demo.studysync.ai'));

    if (!isDemoMode && !isRequestingDemo) {
      sql += " AND u.email NOT LIKE '%@demo.studysync.ai' AND u.id NOT IN ('darvin-01', 'student-arun')";
    }

    if (term) {
      sql += ` AND (
        u.display_name LIKE ?
        OR lp.headline LIKE ?
        OR lp.institution LIKE ?
        OR us.subject LIKE ?
        OR lt.subject LIKE ?
        OR lt.topic_name LIKE ?
      )`;
      const wildcard = `%${term}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    sql += ' GROUP BY LOWER(TRIM(u.display_name)) ORDER BY u.display_name ASC LIMIT ?';
    params.push(safeLimit);

    const rows = db.prepare(sql).all(...params);
    return rows.map((u) => {
      const subjects = Array.from(new Set([
        ...(u.user_subjects_list ? u.user_subjects_list.split(',') : []),
        ...(u.pref_subjects_list ? u.pref_subjects_list.split(',') : []),
      ])).filter(Boolean);

      const participant = this._formatParticipant(u);
      return {
        ...participant,
        subjects,
      };
    });
  },

  /**
   * Retrieve messages for a conversation
   */
  getMessages(conversationId, currentUserId, options = {}, customDb = null) {
    const db = customDb || getDb();
    // Verify participant
    this.getConversationById(conversationId, currentUserId, db);

    const limit = options.limit ? Math.max(1, Math.min(100, parseInt(options.limit, 10))) : 50;
    const offset = options.offset ? Math.max(0, parseInt(options.offset, 10)) : 0;

    // Mark unread messages sent by the other participant as read
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE direct_messages
      SET is_read = 1, read_at = ?
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `).run(now, conversationId, currentUserId);

    // Also mark related notifications as read
    try {
      NotificationModel.markReadByReference(currentUserId, 'direct_message', conversationId, db);
    } catch {
      // Non-critical
    }

    let whereClause = 'WHERE dm.conversation_id = ?';
    const params = [conversationId];

    if (options.before) {
      whereClause += ' AND dm.created_at < ?';
      params.push(options.before);
    }

    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM direct_messages dm ${whereClause}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const queryParams = [...params, limit, offset];
    const rawRows = db.prepare(`
      SELECT 
        dm.id,
        dm.conversation_id,
        dm.sender_id,
        dm.message_content,
        dm.is_read,
        dm.read_at,
        dm.created_at,
        u.display_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      ${whereClause}
      ORDER BY dm.created_at ASC
      LIMIT ? OFFSET ?
    `).all(...queryParams);

    const messages = rawRows.map((m) => {
      const name = m.sender_name || 'Student';
      const initials = (name.slice(0, 2)).toUpperCase();
      return {
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        senderName: name,
        senderAvatar: m.sender_avatar,
        initials,
        messageContent: m.message_content,
        text: m.message_content,
        isRead: Boolean(m.is_read),
        readAt: m.read_at,
        createdAt: m.created_at,
        isMine: m.sender_id === currentUserId,
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

  /**
   * Send a direct message in a conversation
   */
  sendMessage(conversationId, senderId, messageContent, customDb = null) {
    const db = customDb || getDb();
    const conv = this.getConversationById(conversationId, senderId, db);

    const otherParticipantId = conv.participantOneId === senderId
      ? conv.participantTwoId
      : conv.participantOneId;

    // Check blocking restrictions
    if (SafetyModel.isBlocked(senderId, otherParticipantId, db)) {
      const err = new Error('Cannot send message due to privacy or blocking restrictions');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const msgId = `dm-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const preview = messageContent.length > 80 ? messageContent.slice(0, 77) + '...' : messageContent;

    return withTransaction((txDb) => {
      txDb.prepare(`
        INSERT INTO direct_messages (id, conversation_id, sender_id, message_content, is_read, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(msgId, conversationId, senderId, messageContent, now);

      txDb.prepare(`
        UPDATE conversations
        SET last_message_at = ?, last_message_preview = ?, updated_at = ?
        WHERE id = ?
      `).run(now, preview, now, conversationId);

      const sender = txDb.prepare('SELECT display_name, avatar_url FROM users WHERE id = ?').get(senderId);
      const name = sender?.display_name || 'Student';

      // Send persistent notification to other participant
      try {
        NotificationModel.createNotification({
          userId: otherParticipantId,
          actorId: senderId,
          type: 'direct_message',
          title: name,
          body: preview,
          targetUrl: `/messages?conv=${conversationId}`,
          referenceId: conversationId,
        }, txDb);
      } catch {
        // Notification creation failure should not abort message sending
      }

      return {
        id: msgId,
        conversationId,
        senderId,
        senderName: name,
        senderAvatar: sender?.avatar_url || null,
        initials: name.slice(0, 2).toUpperCase(),
        messageContent,
        text: messageContent,
        isRead: false,
        readAt: null,
        createdAt: now,
        isMine: true,
        time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }, db);
  },
};

export default ConversationModel;
