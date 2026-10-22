import { Router } from 'express';
import LearningDNAModel from '../models/learningDna.model.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validateDnaUpdate,
  formatSuccess,
  formatError,
} from '../schemas/index.js';

const router = Router();

// Protect all DNA endpoints with authentication middleware
router.use(requireAuth);

/**
 * GET /api/dna
 * Retrieves the authenticated learner's complete, personalized Learning DNA
 */
router.get('/', async (req, res, next) => {
  try {
    const dna = LearningDNAModel.getLearningDNA(req.user.id);
    if (!dna) {
      return res.status(404).json(
        formatError('Learning DNA profile not found for authenticated user', 'NOT_FOUND')
      );
    }

    res.status(200).json(formatSuccess(dna));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/dna
 * Updates the authenticated learner's Learning DNA
 * Strictly locked to req.user.id to enforce user profile ownership
 */
router.put('/', async (req, res, next) => {
  try {
    const sanitized = validateDnaUpdate(req.body);
    const updatedDna = LearningDNAModel.updateLearningDNA(req.user.id, sanitized);

    res.status(200).json(formatSuccess(updatedDna));
  } catch (error) {
    next(error);
  }
});

export default router;
