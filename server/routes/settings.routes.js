import { Router } from 'express';
import SettingsModel from '../models/settings.model.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validateSettingsUpdate,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

// Protect all settings endpoints with session authentication
router.use(requireAuth);

/**
 * GET /api/settings
 * Retrieves unified preferences & settings for the authenticated learner.
 * Identity is derived exclusively from the verified session (req.user.id).
 */
router.get('/', (req, res, next) => {
  try {
    const settings = SettingsModel.getMergedSettings(req.user.id);
    res.status(200).json(formatSuccess(settings));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 * Updates preferences and settings for the authenticated learner.
 * Authorized strictly via session; attempts to specify another user ID are safely ignored.
 */
router.put('/', (req, res, next) => {
  try {
    const sanitized = validateSettingsUpdate(req.body);
    const updated = SettingsModel.updateMergedSettings(req.user.id, sanitized);
    res.status(200).json(formatSuccess(updated));
  } catch (error) {
    next(error);
  }
});

export default router;
