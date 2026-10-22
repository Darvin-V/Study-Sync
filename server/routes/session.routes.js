import express from 'express';
import { SessionService } from '../services/session.service.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import {
  validateSessionQuery,
  validateCreateSessionInput,
  validateSessionFeedbackInput,
  validateRecordFocusInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = express.Router();

/**
 * GET /api/sessions
 * List persistent study sessions with multi-filtering and pagination
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filters = validateSessionQuery(req.query);
    const currentUserId = req.user?.id || null;
    const result = await SessionService.getSessions(filters, currentUserId);
    res.status(200).json(formatSuccess(result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/history
 * Retrieve authenticated user's participation history
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const filters = validateSessionQuery(req.query);
    const result = await SessionService.getUserHistory(req.user.id, filters);
    res.status(200).json(formatSuccess(result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions
 * Create a new study session with verified creator identity
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const validated = validateCreateSessionInput(req.body);
    const session = await SessionService.createSession(validated, req.user.id);
    res.status(201).json(formatSuccess(session));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/:id/summary
 * Retrieve post-session summary with separate participant durations
 */
router.get('/:id/summary', optionalAuth, async (req, res, next) => {
  try {
    const summary = await SessionService.getSessionSummary(req.params.id);
    res.status(200).json(formatSuccess(summary));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/:id
 * Retrieve session details and participant list by actual ID
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const session = await SessionService.getSessionById(req.params.id, currentUserId);

    if (!session) {
      return res.status(404).json(
        formatError(`Study session not found: ${req.params.id}`, 'NOT_FOUND')
      );
    }

    res.status(200).json(formatSuccess(session));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/start
 * Explicitly start a scheduled session (creator only)
 */
router.post('/:id/start', requireAuth, async (req, res, next) => {
  try {
    const session = await SessionService.startSession(req.params.id, req.user.id);
    res.status(200).json(formatSuccess(session));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/join
 * Join an active study session (creates discrete attendance interval)
 */
router.post('/:id/join', requireAuth, async (req, res, next) => {
  try {
    const session = await SessionService.joinSession(req.params.id, req.user.id);
    res.status(200).json(formatSuccess(session));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/leave
 * Leave an active study session (closes attendance interval and tallies duration)
 */
router.post('/:id/leave', requireAuth, async (req, res, next) => {
  try {
    const session = await SessionService.leaveSession(req.params.id, req.user.id);
    res.status(200).json(formatSuccess(session));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/end
 * End a study session with creator authorization and finalize all durations
 */
router.post('/:id/end', requireAuth, async (req, res, next) => {
  try {
    const summary = await SessionService.endSession(req.params.id, req.user.id);
    res.status(200).json(formatSuccess(summary));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/feedback
 * Submit learner rating and reflection for concluded session
 */
router.post('/:id/feedback', requireAuth, async (req, res, next) => {
  try {
    const validated = validateSessionFeedbackInput(req.body);
    const feedback = await SessionService.submitFeedback(req.params.id, req.user.id, validated);
    res.status(200).json(formatSuccess(feedback));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/peer-feedback
 * Submit lightweight peer review for another participant in this session
 */
router.post('/:id/peer-feedback', requireAuth, async (req, res, next) => {
  try {
    const { validatePeerFeedbackInput } = await import('../schemas/index.js');
    const { FeedbackModel } = await import('../models/feedback.model.js');

    const validated = validatePeerFeedbackInput({
      ...req.body,
      sessionId: req.params.id,
    });
    const result = FeedbackModel.submitPeerFeedback(req.user.id, validated);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    if (error.code === 'INVALID_PEER') {
      return res.status(400).json(formatError(error.message, 'INVALID_PEER'));
    }
    if (error.code === 'PEER_NOT_IN_SESSION') {
      return res.status(400).json(formatError(error.message, 'PEER_NOT_IN_SESSION'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    next(error);
  }
});

/**
 * POST /api/sessions/:id/focus
 * Record self-reported focus time and learner activity status
 */
router.post('/:id/focus', requireAuth, async (req, res, next) => {
  try {
    const validated = validateRecordFocusInput(req.body);
    const session = await SessionService.recordFocus(req.params.id, req.user.id, validated);
    res.status(200).json(formatSuccess(session));
  } catch (error) {
    next(error);
  }
});

export default router;
