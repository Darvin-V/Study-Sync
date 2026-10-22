import { Router } from 'express';
import TopicService from '../services/topic.service.js';
import { validateTopicQuery, formatSuccess, formatError } from '../schemas/index.js';

const router = Router();

/**
 * GET /api/topics/subjects
 * Retrieves list of distinct supported subjects
 */
router.get('/subjects', async (req, res, next) => {
  try {
    const subjects = await TopicService.getSubjects();
    res.status(200).json(formatSuccess(subjects, { total: subjects.length }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/topics
 * Read-only endpoint for retrieving supported topics with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = validateTopicQuery(req.query);
    const result = await TopicService.getTopics(filters);
    res.status(200).json(formatSuccess(result.items, { total: result.count, filters }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/topics/:id
 * Retrieves a single topic by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json(formatError('Topic ID is required', 'INVALID_PARAM'));
    }

    const topic = await TopicService.getTopicById(id.trim());
    if (!topic) {
      return res.status(404).json(formatError(`Topic not found for ID: ${id}`, 'NOT_FOUND'));
    }

    res.status(200).json(formatSuccess(topic));
  } catch (error) {
    next(error);
  }
});

export default router;
