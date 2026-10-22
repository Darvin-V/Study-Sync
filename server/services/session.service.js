import SessionModel from '../models/session.model.js';

/**
 * StudySync AI — Study Session Service (Phase 7)
 * 
 * Orchestrates business logic, lifecycle transitions, authorization,
 * discrete attendance calculation, and post-session summaries.
 */
export const SessionService = {
  async getSessions(filters = {}, currentUserId = null) {
    const result = SessionModel.findAll(filters, currentUserId);
    return {
      items: result.items,
      count: result.total,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      filtersApplied: filters,
    };
  },

  async getSessionById(id, currentUserId = null) {
    return SessionModel.findById(id, currentUserId);
  },

  async createSession(sessionData, currentUserId) {
    return SessionModel.create(sessionData, currentUserId);
  },

  async startSession(id, currentUserId) {
    return SessionModel.start(id, currentUserId);
  },

  async joinSession(id, currentUserId) {
    return SessionModel.join(id, currentUserId);
  },

  async leaveSession(id, currentUserId) {
    return SessionModel.leave(id, currentUserId);
  },

  async endSession(id, currentUserId) {
    return SessionModel.end(id, currentUserId);
  },

  async getSessionSummary(id) {
    const summary = SessionModel.getSummary(id);
    if (!summary) {
      const err = new Error(`Study session not found: ${id}`);
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
    return summary;
  },

  async submitFeedback(id, currentUserId, feedbackData) {
    return SessionModel.submitFeedback(id, currentUserId, feedbackData);
  },

  async recordFocus(id, currentUserId, focusData) {
    return SessionModel.recordFocus(id, currentUserId, focusData);
  },

  async getUserHistory(currentUserId, filters = {}) {
    return SessionModel.findAll({ ...filters, participatedOnly: true }, currentUserId);
  },
};

export default SessionService;
