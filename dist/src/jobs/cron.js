"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const logger_1 = require("../utils/logger");
/**
 * Daily Defaulter Check (runs at 01:00 AM every day)
 * - Finds users with 2 or more MISSED contributions
 * - Creates a PENALTY AdminEarning record
 * - Creates a Notification for the user
 * - Mocks sending an SMS (Twilio / Africa's Talking)
 */
node_cron_1.default.schedule('0 1 * * *', async () => {
    logger_1.logger.info('[CRON] Starting Daily Defaulter Check...');
    try {
        // 1. Find users with 2+ missed payments
        const missedContributions = await prisma_1.default.contribution.groupBy({
            by: ['planId'],
            where: {
                status: 'MISSED',
            },
            _count: {
                id: true,
            },
        });
        // Filter for 2 or more missed payments
        const defaulters = missedContributions.filter(g => (g._count?.id ?? 0) >= 2);
        for (const group of defaulters) {
            const plan = await prisma_1.default.savingsPlan.findUnique({
                where: { id: group.planId },
                include: { user: true }
            });
            if (!plan || !plan.user)
                continue;
            const userId = plan.user.id;
            // Ensure we don't penalize the same user for the exact same plan on the same day repeatedly
            // Check if we already sent a notification today
            const todayString = new Date().toISOString().split('T')[0];
            const recentNotification = await prisma_1.default.notification.findFirst({
                where: {
                    userId,
                    title: 'Immediate Action Required: Missed Payments',
                    createdAt: {
                        gte: new Date(todayString + 'T00:00:00.000Z')
                    }
                }
            });
            if (recentNotification)
                continue; // Already penalized today
            // 2. Create PENALTY AdminEarning (e.g. fixed 500 NGN)
            const penaltyAmount = 500;
            await prisma_1.default.adminEarning.create({
                data: {
                    sourceType: 'PENALTY',
                    sourceId: plan.id,
                    amount: penaltyAmount,
                    description: `Defaulter Penalty for Plan ${plan.id}`
                }
            });
            // 3. Create Notification
            const bodyStr = `You have missed ${group._count?.id ?? 0} scheduled payments for your active savings plan. A penalty of ₦${penaltyAmount} has been recorded. Please process your payments immediately.`;
            await prisma_1.default.notification.create({
                data: {
                    userId,
                    title: 'Immediate Action Required: Missed Payments',
                    body: bodyStr,
                    type: 'ALERT',
                    channel: 'SMS'
                }
            });
            // 4. MOCK SMS GATEWAY CALL
            // If we had Twilio: const client = twilio(accountSid, authToken); client.messages.create({...})
            logger_1.logger.info(`[SMS MOCK] Sent to ${plan.user.email} (Phone): ${bodyStr}`);
        }
        logger_1.logger.info('[CRON] Daily Defaulter Check Completed successfully.');
    }
    catch (error) {
        logger_1.logger.error('[CRON] Daily Defaulter Check FAILED:', error);
    }
});
