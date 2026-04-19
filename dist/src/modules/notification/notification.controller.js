"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const logger_1 = require("../../utils/logger");
class NotificationController {
    /**
     * GET /api/notifications/me
     */
    static async getMyNotifications(req, res) {
        try {
            const userId = req.user.userId;
            const notifications = await prisma_1.default.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            });
            res.status(200).json({ success: true, notifications });
        }
        catch (error) {
            logger_1.logger.error('Get notifications error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
    /**
     * PATCH /api/notifications/:id/read
     */
    static async markAsRead(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user.userId;
            const notification = await prisma_1.default.notification.findUnique({
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
            const updated = await prisma_1.default.notification.update({
                where: { id },
                data: { isRead: true },
            });
            res.status(200).json({ success: true, notification: updated });
        }
        catch (error) {
            logger_1.logger.error('Mark notification read error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}
exports.NotificationController = NotificationController;
