import { getDb } from '../db/connection.js';

/**
 * StudySync AI — Topic Model
 * 
 * Data access routines for learning topics and curriculum subjects.
 */
export const TopicModel = {
  findAll(options = {}, customDb = null) {
    const db = customDb || getDb();
    let query = 'SELECT * FROM learning_topics WHERE 1=1';
    const params = [];

    if (options.subject) {
      query += ' AND LOWER(subject) = LOWER(?)';
      params.push(options.subject);
    }

    if (options.difficulty) {
      query += ' AND LOWER(difficulty_level) = LOWER(?)';
      params.push(options.difficulty);
    }

    query += ' ORDER BY subject ASC, topic_name ASC';
    return db.prepare(query).all(...params);
  },

  findById(id, customDb = null) {
    const db = customDb || getDb();
    return db.prepare('SELECT * FROM learning_topics WHERE id = ?').get(id) || null;
  },

  findAllSubjects(customDb = null) {
    const db = customDb || getDb();
    const rows = db.prepare(`
      SELECT DISTINCT subject 
      FROM learning_topics 
      ORDER BY subject ASC
    `).all();
    return rows.map((r) => r.subject);
  },

  count(customDb = null) {
    const db = customDb || getDb();
    const row = db.prepare('SELECT COUNT(*) AS count FROM learning_topics').get();
    return row.count;
  },
};

export default TopicModel;
