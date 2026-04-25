import cron from 'node-cron';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { sendPushNotification } from '../utils/push.util';

/**
 * Daily Defaulter Check (runs at 01:00 AM every day)
 * - Finds users with 2 or more MISSED contributions
 * - Creates a PENALTY AdminEarning record
 * - Creates a Notification in-app record
 * - Sends a real Expo push notification to the user's device
 */
cron.schedule('0 1 * * *', async () => {
  logger.info('[CRON] Starting Daily Defaulter Check...');

  try {
    // 1. Find users with 2+ missed payments
    const missedContributions = await prisma.contribution.groupBy({
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
      const plan = await prisma.savingsPlan.findUnique({
        where: { id: group.planId },
        include: { user: true }
      });

      if (!plan || !plan.user) continue;

      const userId = plan.user.id;

      // Ensure we don't penalize the same user for the exact same plan on the same day repeatedly
      const todayString = new Date().toISOString().split('T')[0];
      const recentNotification = await prisma.notification.findFirst({
        where: {
          userId,
          title: 'Immediate Action Required: Missed Payments',
          createdAt: {
            gte: new Date(todayString + 'T00:00:00.000Z')
          }
        }
      });

      if (recentNotification) continue; // Already penalized today

      // 2. Create PENALTY AdminEarning (₦500 fixed)
      const penaltyAmount = 500;
      await prisma.adminEarning.create({
        data: {
          sourceType: 'PENALTY',
          sourceId: plan.id,
          amount: penaltyAmount,
          description: `Defaulter Penalty for Plan ${plan.id}`
        }
      });

      // 3. Create in-app Notification record
      const bodyStr = `You have missed ${group._count?.id ?? 0} scheduled payments. A penalty of ₦${penaltyAmount} has been recorded. Please process your payments immediately.`;

      await prisma.notification.create({
        data: {
          userId,
          title: 'Immediate Action Required: Missed Payments',
          body: bodyStr,
          type: 'ALERT',
          channel: 'APP'
        }
      });

      // 4. Send real Expo push notification
      await sendPushNotification(
        plan.user.expoPushToken,
        '⚠️ Missed Payments Alert',
        bodyStr,
        { type: 'DEFAULTER_ALERT', planId: plan.id }
      );

      logger.info(`[CRON] Defaulter notified: ${plan.user.email}, missed: ${group._count?.id}`);
    }

    logger.info('[CRON] Daily Defaulter Check Completed successfully.');
  } catch (error) {
    logger.error('[CRON] Daily Defaulter Check FAILED:', error);
  }
});
