import { Router } from 'express';
import FocusModel from '../models/focus.model.js';
import { FocusCoachService } from '../services/focus/focusCoachService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validateFocusStartInput,
  validateFocusCompleteInput,
  validateFocusPhaseInput,
  validateDistractionSettingsInput,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

// Protect all focus endpoints with server-derived authenticated identity
router.use(requireAuth);

/**
 * GET /api/focus/active
 * Retrieves the currently active or paused focus interval for the user.
 * Enables automatic timer and shield recovery across page refreshes.
 */
router.get('/active', async (req, res, next) => {
  try {
    const activeInterval = FocusModel.findActiveInterval(req.user.id);
    res.status(200).json(formatSuccess(activeInterval));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/focus/start
 * Starts a new focus interval.
 * Rejects with 409 if an active interval already exists (unless autoCancelPrevious: true).
 */
router.post('/start', async (req, res, next) => {
  try {
    const sanitized = validateFocusStartInput(req.body);
    const interval = FocusModel.createInterval({
      ...sanitized,
      userId: req.user.id,
    });

    res.status(201).json(formatSuccess(interval));
  } catch (error) {
    if (error.code === 'ACTIVE_FOCUS_INTERVAL_EXISTS') {
      return res.status(409).json({
        success: false,
        error: {
          message: error.message,
          code: 'ACTIVE_FOCUS_INTERVAL_EXISTS',
          activeInterval: error.activeInterval,
        },
      });
    }
    next(error);
  }
});

/**
 * POST /api/focus/:id/pause
 * Pauses a currently active focus interval.
 */
router.post('/:id/pause', async (req, res, next) => {
  try {
    const interval = FocusModel.pauseInterval(req.params.id, req.user.id);
    res.status(200).json(formatSuccess(interval));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json(formatError(error.message, 'NOT_FOUND'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    if (error.code === 'INVALID_STATE_TRANSITION') {
      return res.status(400).json(formatError(error.message, 'INVALID_STATE_TRANSITION'));
    }
    next(error);
  }
});

/**
 * POST /api/focus/:id/resume
 * Resumes a paused focus interval, accumulating paused duration.
 */
router.post('/:id/resume', async (req, res, next) => {
  try {
    const interval = FocusModel.resumeInterval(req.params.id, req.user.id);
    res.status(200).json(formatSuccess(interval));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json(formatError(error.message, 'NOT_FOUND'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    if (error.code === 'INVALID_STATE_TRANSITION') {
      return res.status(400).json(formatError(error.message, 'INVALID_STATE_TRANSITION'));
    }
    next(error);
  }
});

/**
 * POST /api/focus/:id/phase
 * Transitions the focus session to another phase (Focus -> Discuss -> Recall -> Review)
 */
router.post('/:id/phase', async (req, res, next) => {
  try {
    const sanitized = validateFocusPhaseInput(req.body);
    const interval = FocusModel.updatePhase(req.params.id, req.user.id, sanitized);
    res.status(200).json(formatSuccess(interval));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json(formatError(error.message, 'NOT_FOUND'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    if (error.code === 'INVALID_STATE_TRANSITION') {
      return res.status(400).json(formatError(error.message, 'INVALID_STATE_TRANSITION'));
    }
    next(error);
  }
});

/**
 * POST /api/focus/:id/complete
 * Completes a focus interval and records actual elapsed duration and learning reflections.
 */
router.post('/:id/complete', async (req, res, next) => {
  try {
    const sanitized = validateFocusCompleteInput(req.body || {});
    const interval = FocusModel.completeInterval(req.params.id, req.user.id, sanitized);
    res.status(200).json(formatSuccess(interval));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json(formatError(error.message, 'NOT_FOUND'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    if (error.code === 'INVALID_STATE_TRANSITION') {
      return res.status(400).json(formatError(error.message, 'INVALID_STATE_TRANSITION'));
    }
    next(error);
  }
});

/**
 * POST /api/focus/:id/cancel
 * Cancels / discards a running or paused focus interval.
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const cancelData = {
      earlyExitReason: req.body?.reason || req.body?.earlyExitReason || 'Cancelled by user',
    };
    const interval = FocusModel.cancelInterval(req.params.id, req.user.id, cancelData);
    res.status(200).json(formatSuccess(interval));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json(formatError(error.message, 'NOT_FOUND'));
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json(formatError(error.message, 'FORBIDDEN'));
    }
    next(error);
  }
});

/**
 * GET /api/focus/history
 * Retrieves the user's recorded focus intervals and transparent statistics.
 */
router.get('/history', async (req, res, next) => {
  try {
    const history = FocusModel.getHistory(req.user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.status(200).json(formatSuccess(history));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/focus/coach
 * Returns personalized pacing, break, and goal recommendations from
 * legitimate, minimal study session logs, voluntary breaks, and quiz results.
 */
router.get('/coach', async (req, res, next) => {
  try {
    const advice = FocusCoachService.generateFocusAdvice(req.user.id);
    res.status(200).json(formatSuccess(advice));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/focus/settings
 * Retrieves user's distraction shield & break reminder preferences.
 */
router.get('/settings', async (req, res, next) => {
  try {
    const settings = FocusModel.getSettings(req.user.id);
    res.status(200).json(formatSuccess(settings));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/focus/settings
 * Updates user's distraction shield & break reminder preferences.
 */
router.put('/settings', async (req, res, next) => {
  try {
    const sanitized = validateDistractionSettingsInput(req.body);
    const updated = FocusModel.updateSettings(req.user.id, sanitized);
    res.status(200).json(formatSuccess(updated));
  } catch (error) {
    next(error);
  }
});

export default router;
