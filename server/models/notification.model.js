import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import SafetyModel from './safety.model.js';

/**
 * StudySync AI — Notification Model
 * 
 * Manages persistent social and collaboration notifications for:
 * - Direct peer messages
 * - Study room activity & joins
 * - Question replies & doubts in topic rooms
 * - Study session invitations
 * - Security & account notices
 * 
 * Features:
 * - Strict authorization boundary (users can only access their own notifications)
 * - Two-way blocking enforcement (blocked users cannot generate notifications)
 * - Intelligent deduplication to prevent notification spam
 * - Unread tracking and batch read operations
 */
export const NotificationModel = {
  /**
   * Helper to format actor display details
   */
  _formatActor(user) {
    if (!user) return null;
    const name = user.display_name || user.name || 'Student';
    const parts = name.trim().split(/\s+/);
    const initials = parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

    return {
      id: user.id,
      displayName: name,
      avatarUrl: user.avatar_url || null,
      initials,
    };
  },

  /**
   * Create or update a notification for a user.
   * Enforces self-action exclusion, blocking safety, and deduplication.
   */
  createNotification(data, customDb = null) {
    const {
      userId,
      actorId = null,
      type,
      title,
      body,
      targetUrl = null,
      referenceId = null,
    } = data;

    if (!userId || !type || !title || !body) {
      return null;
    }

    // Never notify self
    if (actorId && userId === actorId) {
      return null;
    }

    const db = customDb || getDb();

    // Check blocking restrictions
    if (actorId && SafetyModel.isBlocked(userId, actorId, db)) {
      return null;
    }

    const now = new Date().toISOString();

    // Deduplication: if an unread notification exists for the same user, type, and referenceId,
    // update it with the fresh content and timestamp rather than creating duplicate spam
    if (referenceId) {
      const existing = db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND type = ? AND reference_id = ? AND is_read = 0
      `).get(userId, type, referenceId);

      if (existing) {
        db.prepare(`
          UPDATE notifications
          SET title = ?, body = ?, target_url = ?, created_at = ?
          WHERE id = ?
        `).run(title, body, targetUrl, now, existing.id);

        return this.getNotificationById(existing.id, userId, db);
      }
    }

    const id = `notif-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, actor_id, type, title, body, target_url, reference_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, userId, actorId, type, title, body, targetUrl, referenceId, now);

    return this.getNotificationById(id, userId, db);
  },

  /**
   * Retrieve a single notification by ID (strictly scoped to owner)
   */
  getNotificationById(id, userId, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare(`
      SELECT n.*, u.display_name AS actor_name, u.avatar_url AS actor_avatar
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      WHERE n.id = ? AND n.user_id = ?
    `).get(id, userId);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      actorId: row.actor_id,
      type: row.type,
      title: row.title,
      body: row.body,
      targetUrl: row.target_url,
      referenceId: row.reference_id,
      isRead: Boolean(row.is_read),
      readAt: row.read_at,
      createdAt: row.created_at,
      actor: row.actor_id ? {
        id: row.actor_id,
        displayName: row.actor_name || 'Student',
        avatarUrl: row.actor_avatar || null,
        initials: (row.actor_name || 'ST').slice(0, 2).toUpperCase(),
      } : null,
    };
  },

  /**
   * Get paginated notifications for a user
   */
  getUserNotifications(userId, options = {}, customDb = null) {
    if (!userId) return { notifications: [], unreadCount: 0, total: 0 };
    const db = customDb || getDb();

    const filter = options.filter === 'unread' ? 'unread' : 'all';
    const limit = Math.max(1, Math.min(50, parseInt(options.limit, 10) || 30));
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    let whereClause = 'WHERE n.user_id = ?';
    const params = [userId];

    if (filter === 'unread') {
      whereClause += ' AND n.is_read = 0';
    }

    const unreadCountRow = db.prepare(`
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId);
    const unreadCount = unreadCountRow?.unread_count || 0;

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total
      FROM notifications n
      ${whereClause}
    `).get(...params);
    const total = totalRow?.total || 0;

    const rows = db.prepare(`
      SELECT n.*, u.display_name AS actor_name, u.avatar_url AS actor_avatar
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const notifications = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      actorId: row.actor_id,
      type: row.type,
      title: row.title,
      body: row.body,
      targetUrl: row.target_url,
      referenceId: row.reference_id,
      isRead: Boolean(row.is_read),
      readAt: row.read_at,
      createdAt: row.created_at,
      actor: row.actor_id ? {
        id: row.actor_id,
        displayName: row.actor_name || 'Student',
        avatarUrl: row.actor_avatar || null,
        initials: (row.actor_name || 'ST').slice(0, 2).toUpperCase(),
      } : null,
    }));

    return {
      notifications,
      unreadCount,
      total,
      limit,
      offset,
      filter,
      hasMore: offset + notifications.length < total,
    };
  },

  /**
   * Get unread notification count only
   */
  getUnreadCount(userId, customDb = null) {
    if (!userId) return 0;
    const db = customDb || getDb();
    const row = db.prepare(`
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId);
    return row?.count || 0;
  },

  /**
   * Mark a single notification as read
   */
  markAsRead(userId, notificationId, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();
    const res = db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = ?
      WHERE id = ? AND user_id = ?
    `).run(now, notificationId, userId);

    return {
      success: res.changes > 0,
      id: notificationId,
      isRead: true,
      readAt: now,
    };
  },

  /**
   * Mark all unread notifications as read for a user
   */
  markAllAsRead(userId, customDb = null) {
    const db = customDb || getDb();
    const now = new Date().toISOString();
    const res = db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = ?
      WHERE user_id = ? AND is_read = 0
    `).run(now, userId);

    return {
      success: true,
      markedCount: res.changes,
      readAt: now,
    };
  },

  /**
   * Mark notifications as read matching a specific reference (e.g. conversationId)
   */
  markReadByReference(userId, type, referenceId, customDb = null) {
    if (!userId || !type || !referenceId) return;
    const db = customDb || getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = ?
      WHERE user_id = ? AND type = ? AND reference_id = ? AND is_read = 0
    `).run(now, userId, type, referenceId);
  },

  /**
   * Delete a notification
   */
  deleteNotification(userId, notificationId, customDb = null) {
    const db = customDb || getDb();
    const res = db.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);

    return {
      success: res.changes > 0,
    };
  },
};

export default NotificationModel;
