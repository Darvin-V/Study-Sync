import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import NotificationModel from '../models/notification.model.js';
import { formatSuccess, formatError } from '../schemas/index.js';

const router = Router();

// All notification operations require authentication
router.use(requireAuth);

/**
 * GET /api/notifications
 * Retrieve paginated notifications with All / Unread filtering
 */
router.get('/', (req, res, next) => {
  try {
    const { filter = 'all', limit, offset } = req.query;
    const result = NotificationModel.getUserNotifications(req.user.id, {
      filter,
      limit,
      offset,
    });

    res.status(200).json(
      formatSuccess(result.notifications, {
        unreadCount: result.unreadCount,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        filter: result.filter,
        hasMore: result.hasMore,
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/unread-count
 * Lightweight endpoint for badge synchronization
 */
router.get('/unread-count', (req, res, next) => {
  try {
    const count = NotificationModel.getUnreadCount(req.user.id);
    res.status(200).json(formatSuccess({ count }));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json(formatError('Invalid notification ID', 'INVALID_PARAM'));
    }

    const result = NotificationModel.markAsRead(req.user.id, id.trim());
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.post('/mark-all-read', (req, res, next) => {
  try {
    const result = NotificationModel.markAllAsRead(req.user.id);
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Dismiss or delete a notification
 */
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json(formatError('Invalid notification ID', 'INVALID_PARAM'));
    }

    const result = NotificationModel.deleteNotification(req.user.id, id.trim());
    res.status(200).json(formatSuccess(result));
  } catch (error) {
    next(error);
  }
});

export default router;
