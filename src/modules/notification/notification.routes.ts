import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken as any);

router.get('/me', NotificationController.getMyNotifications as any);
router.patch('/:id/read', NotificationController.markAsRead as any);

export default router;
