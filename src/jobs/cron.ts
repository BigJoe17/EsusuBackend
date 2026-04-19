import cron from 'node-cron';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * Daily Defaulter Check (runs at 01:00 AM every day)
 * - Finds users with 2 or more MISSED contributions
 * - Creates a PENALTY AdminEarning record
 * - Creates a Notification for the user
 * - Mocks sending an SMS (Twilio / Africa's Talking)
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
      having: {
        id: {
          gte: 2,
        },
      },
    });

    for (const group of missedContributions) {
      const plan = await prisma.savingsPlan.findUnique({
        where: { id: group.planId },
        include: { user: true }
      });

      if (!plan || !plan.user) continue;

      const userId = plan.user.id;

      // Ensure we don't penalize the same user for the exact same plan on the same day repeatedly
      // Check if we already sent a notification today
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

      // 2. Create PENALTY AdminEarning (e.g. fixed 500 NGN)
      const penaltyAmount = 500;
      await prisma.adminEarning.create({
        data: {
          sourceType: 'PENALTY',
          sourceId: plan.id,
          amount: penaltyAmount,
          description: `Defaulter Penalty for Plan ${plan.id}`
        }
      });

      // 3. Create Notification
      const bodyStr = `You have missed ${group._count.id} scheduled payments for your active savings plan. A penalty of ₦${penaltyAmount} has been recorded. Please process your payments immediately.`;
      
      await prisma.notification.create({
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
      logger.info(`[SMS MOCK] Sent to ${plan.user.email} (Phone): ${bodyStr}`);
    }

    logger.info('[CRON] Daily Defaulter Check Completed successfully.');
  } catch (error) {
    logger.error('[CRON] Daily Defaulter Check FAILED:', error);
  }
});
