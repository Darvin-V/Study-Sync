import { Router } from 'express';
import NoteModel from '../models/note.model.js';
import {
  validateCreateNoteInput,
  validateUpdateNoteInput,
  validateNoteQuery,
  formatSuccess,
  formatError,
} from '../schemas/index.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/notes
 * List accessible notes with visibility filtering, search, and pagination
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filters = validateNoteQuery(req.query);
    const result = NoteModel.findAll(filters, req.user?.id);
    res.status(200).json(
      formatSuccess(result.items, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        filters,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notes/:id
 * Retrieve single note by ID with permission checks
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Note ID is required', 'INVALID_PARAM'));
    }

    const note = NoteModel.findById(id.trim(), req.user?.id);
    if (!note) {
      return res.status(404).json(formatError(`Note not found: ${id}`, 'NOT_FOUND'));
    }

    if (note.restricted) {
      return res.status(403).json(
        formatError('You do not have permission to view this private or restricted note', 'FORBIDDEN')
      );
    }

    res.status(200).json(formatSuccess(note));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notes
 * Create a new note with server-derived authenticated author
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const sanitized = validateCreateNoteInput(req.body);
    const created = NoteModel.create(sanitized, req.user.id);
    res.status(201).json(formatSuccess(created));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notes/:id
 * Update an existing note (author only)
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Note ID is required', 'INVALID_PARAM'));
    }

    const sanitized = validateUpdateNoteInput(req.body);
    const updated = NoteModel.update(id.trim(), sanitized, req.user.id);
    res.status(200).json(formatSuccess(updated));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notes/:id
 * Archive / delete a note (author only)
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Note ID is required', 'INVALID_PARAM'));
    }

    const result = NoteModel.delete(id.trim(), req.user.id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

export default router;
