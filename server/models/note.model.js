import { getDb } from '../db/connection.js';

function calculateReadTime(content = '') {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(wordCount / 200));
  return `${mins} min read`;
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Recently';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * Format note database row into complete frontend/API entity
 */
function formatNoteRow(row, currentUserId = null) {
  if (!row) return null;
  const isOwner = Boolean(currentUserId && row.author_id === currentUserId);
  const content = row.content || '';
  const excerpt = row.description || (content ? content.slice(0, 140).replace(/[#*`]/g, '').trim() + '...' : '');

  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    topic: row.topic,
    author: row.author_name || 'Anonymous',
    author_id: row.author_id,
    authorId: row.author_id,
    authorInitials: (row.author_name || 'U').slice(0, 2).toUpperCase(),
    author_avatar: row.author_avatar || null,
    type: row.resource_type || 'Note',
    resource_type: row.resource_type || 'Note',
    content,
    description: row.description || '',
    excerpt,
    resource_reference: row.resource_reference || null,
    url: row.resource_reference || null,
    room_id: row.room_id || null,
    relatedRoomId: row.room_id || null,
    room_name: row.room_name || null,
    session_id: row.session_id || null,
    relatedSessionId: row.session_id || null,
    session_title: row.session_title || null,
    visibility: row.visibility || 'public',
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at,
    updated_at: row.updated_at,
    updatedAt: formatTimeAgo(row.updated_at),
    readTime: calculateReadTime(content),
    isOwner,
  };
}

/**
 * StudySync AI — Note and Resource Model
 * 
 * Provides secure data access for academic notes, shared resources,
 * and visibility boundary enforcement.
 */
export const NoteModel = {
  /**
   * List accessible notes with visibility permissions and filters
   */
  findAll(filters = {}, currentUserId = null, customDb = null) {
    const db = customDb || getDb();
    const params = [];

    let whereClause = 'WHERE n.is_archived = 0';

    // 1. Strict Visibility Permission Filter
    if (currentUserId) {
      whereClause += `
        AND (
          n.visibility = 'public'
          OR n.author_id = ?
          OR (
            n.visibility = 'room_shared'
            AND n.room_id IS NOT NULL
            AND (
              EXISTS (SELECT 1 FROM room_memberships rm WHERE rm.room_id = n.room_id AND rm.user_id = ?)
              OR EXISTS (SELECT 1 FROM rooms r_own WHERE r_own.id = n.room_id AND r_own.creator_id = ?)
            )
          )
          OR (
            n.visibility = 'session_shared'
            AND n.session_id IS NOT NULL
            AND (
              EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = n.session_id AND sp.user_id = ?)
              OR EXISTS (SELECT 1 FROM study_sessions ss_own WHERE ss_own.id = n.session_id AND ss_own.creator_id = ?)
            )
          )
        )
      `;
      params.push(currentUserId, currentUserId, currentUserId, currentUserId, currentUserId);
    } else {
      // Unauthenticated users can strictly view public notes only
      whereClause += " AND n.visibility = 'public'";
    }

    // 2. Query Filters
    if (filters.subject) {
      whereClause += ' AND LOWER(n.subject) = LOWER(?)';
      params.push(filters.subject);
    }
    if (filters.topic) {
      whereClause += ' AND LOWER(n.topic) LIKE LOWER(?)';
      params.push(`%${filters.topic}%`);
    }
    if (filters.type) {
      whereClause += ' AND LOWER(n.resource_type) = LOWER(?)';
      params.push(filters.type);
    }
    if (filters.roomId) {
      whereClause += ' AND n.room_id = ?';
      params.push(filters.roomId);
    }
    if (filters.sessionId) {
      whereClause += ' AND n.session_id = ?';
      params.push(filters.sessionId);
    }
    if (filters.visibility) {
      whereClause += ' AND n.visibility = ?';
      params.push(filters.visibility);
    }
    if (filters.authorId) {
      whereClause += ' AND n.author_id = ?';
      params.push(filters.authorId);
    }
    if (filters.search) {
      whereClause += ' AND (LOWER(n.title) LIKE LOWER(?) OR LOWER(n.description) LIKE LOWER(?) OR LOWER(n.topic) LIKE LOWER(?))';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM notes_resources n
      ${whereClause}
    `;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    // Pagination
    const page = filters.page ? Math.max(1, parseInt(filters.page, 10)) : 1;
    const limit = filters.limit ? Math.max(1, Math.min(100, parseInt(filters.limit, 10))) : 50;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        n.*,
        u.display_name AS author_name,
        u.avatar_url AS author_avatar,
        r.room_name,
        ss.title AS session_title
      FROM notes_resources n
      JOIN users u ON n.author_id = u.id
      LEFT JOIN rooms r ON n.room_id = r.id
      LEFT JOIN study_sessions ss ON n.session_id = ss.id
      ${whereClause}
      ORDER BY n.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(query).all(...params, limit, offset);
    const items = rows.map((r) => formatNoteRow(r, currentUserId));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Retrieve a single note with permission enforcement
   */
  findById(id, currentUserId = null, customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare(`
      SELECT 
        n.*,
        u.display_name AS author_name,
        u.avatar_url AS author_avatar,
        r.room_name,
        ss.title AS session_title
      FROM notes_resources n
      JOIN users u ON n.author_id = u.id
      LEFT JOIN rooms r ON n.room_id = r.id
      LEFT JOIN study_sessions ss ON n.session_id = ss.id
      WHERE n.id = ? AND n.is_archived = 0
    `).get(id);

    if (!row) return null;

    // Visibility Check
    if (row.visibility === 'private') {
      if (!currentUserId || row.author_id !== currentUserId) {
        return { restricted: true };
      }
    } else if (row.visibility === 'room_shared' && row.room_id) {
      if (!currentUserId) return { restricted: true };
      if (row.author_id !== currentUserId) {
        const isMember = db.prepare(`
          SELECT 1 FROM room_memberships WHERE room_id = ? AND user_id = ?
        `).get(row.room_id, currentUserId);
        const isOwner = db.prepare(`
          SELECT 1 FROM rooms WHERE id = ? AND creator_id = ?
        `).get(row.room_id, currentUserId);
        if (!isMember && !isOwner) {
          return { restricted: true };
        }
      }
    } else if (row.visibility === 'session_shared' && row.session_id) {
      if (!currentUserId) return { restricted: true };
      if (row.author_id !== currentUserId) {
        const isParticipant = db.prepare(`
          SELECT 1 FROM session_participants WHERE session_id = ? AND user_id = ?
        `).get(row.session_id, currentUserId);
        const isSessionCreator = db.prepare(`
          SELECT 1 FROM study_sessions WHERE id = ? AND creator_id = ?
        `).get(row.session_id, currentUserId);
        if (!isParticipant && !isSessionCreator) {
          return { restricted: true };
        }
      }
    }

    return formatNoteRow(row, currentUserId);
  },

  /**
   * Create a new note with server-derived author ID
   */
  create(data, authorId, customDb = null) {
    const db = customDb || getDb();
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Verify room access if room_id provided
    if (data.room_id) {
      const room = db.prepare('SELECT id, creator_id FROM rooms WHERE id = ?').get(data.room_id);
      if (!room) {
        const error = new Error(`Topic room not found: ${data.room_id}`);
        error.statusCode = 404;
        error.code = 'ROOM_NOT_FOUND';
        throw error;
      }
    }

    // Verify session access if session_id provided
    if (data.session_id) {
      const session = db.prepare('SELECT id FROM study_sessions WHERE id = ?').get(data.session_id);
      if (!session) {
        const error = new Error(`Study session not found: ${data.session_id}`);
        error.statusCode = 404;
        error.code = 'SESSION_NOT_FOUND';
        throw error;
      }
    }

    db.prepare(`
      INSERT INTO notes_resources (
        id, title, content, description, resource_reference, resource_type,
        subject, topic, author_id, room_id, session_id, visibility, is_archived,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      data.title,
      data.content || '',
      data.description || '',
      data.resource_reference || null,
      data.resource_type || 'Note',
      data.subject,
      data.topic,
      authorId,
      data.room_id || null,
      data.session_id || null,
      data.visibility || 'public',
      now,
      now
    );

    return this.findById(id, authorId, db);
  },

  /**
   * Update note fields (author only)
   */
  update(id, data, currentUserId, customDb = null) {
    const db = customDb || getDb();
    const existing = db.prepare('SELECT * FROM notes_resources WHERE id = ? AND is_archived = 0').get(id);

    if (!existing) {
      const err = new Error(`Note not found: ${id}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (existing.author_id !== currentUserId) {
      const err = new Error('You are not authorized to modify this note');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const title = data.title !== undefined ? data.title : existing.title;
    const content = data.content !== undefined ? data.content : existing.content;
    const description = data.description !== undefined ? data.description : existing.description;
    const subject = data.subject !== undefined ? data.subject : existing.subject;
    const topic = data.topic !== undefined ? data.topic : existing.topic;
    const resource_type = data.resource_type !== undefined ? data.resource_type : existing.resource_type;
    const visibility = data.visibility !== undefined ? data.visibility : existing.visibility;
    const room_id = data.room_id !== undefined ? data.room_id : existing.room_id;
    const session_id = data.session_id !== undefined ? data.session_id : existing.session_id;
    const resource_reference = data.resource_reference !== undefined ? data.resource_reference : existing.resource_reference;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE notes_resources
      SET title = ?, content = ?, description = ?, subject = ?, topic = ?,
          resource_type = ?, visibility = ?, room_id = ?, session_id = ?,
          resource_reference = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title, content, description, subject, topic,
      resource_type, visibility, room_id, session_id,
      resource_reference, now, id
    );

    return this.findById(id, currentUserId, db);
  },

  /**
   * Archive / delete note (author only)
   */
  delete(id, currentUserId, customDb = null) {
    const db = customDb || getDb();
    const existing = db.prepare('SELECT * FROM notes_resources WHERE id = ? AND is_archived = 0').get(id);

    if (!existing) {
      const err = new Error(`Note not found: ${id}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (existing.author_id !== currentUserId) {
      const err = new Error('You are not authorized to delete this note');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE notes_resources SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, id);

    return { deleted: true, id };
  },

  count(customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT COUNT(*) AS count FROM notes_resources WHERE is_archived = 0').get();
    return row.count;
  },
};

export default NoteModel;
