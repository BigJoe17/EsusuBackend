import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util';

export class NotificationController {
  /**
   * GET /api/notifications/me
   */
  static async getMyNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = getPaginationParams(req.query);
      const userId = req.user!.userId;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          skip,
          take: limit,
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      const paginated = createPaginatedResponse(notifications, total, { page, limit, skip });
      res.status(200).json({ success: true, notifications: paginated.data, meta: paginated.meta });
    } catch (error: any) {
      logger.error('Get notifications error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }

      if (notification.userId !== userId) {
        res.status(403).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      res.status(200).json({ success: true, notification: updated });
    } catch (error: any) {
      logger.error('Mark notification read error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
