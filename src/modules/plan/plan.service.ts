import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";
import { AppSettingsService } from "../../services/app-settings.service";
import {
  getCycleLength,
  getPlanTotalDays,
  getProjectedAdminEarnings,
  getProjectedUserPayout,
} from "../../utils/business-rules";

export class PlanService {
  /**
   * Create a new savings plan.
   * Calculates endDate based on durationMonths and cycleLength.
   */
  static async createPlan(userId: string, data: {
    dailyAmount: number;
    durationMonths: number;
  }) {
    const { dailyAmount, durationMonths } = data;
    const settings = await AppSettingsService.getRuntimeBusinessSettings();

    // Validate duration
    const validDurations = [1, 3, 6, 24];
    if (!validDurations.includes(durationMonths)) {
      throw new Error("Duration must be 1, 3, 6, or 24 months");
    }

    if (dailyAmount <= 0) {
      throw new Error("Daily amount must be greater than 0");
    }

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    const cycleLength = getCycleLength(settings.adminFeeDays);
    const totalDays = getPlanTotalDays(durationMonths, cycleLength);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays);

    const plan = await prisma.savingsPlan.create({
      data: {
        userId,
        dailyAmount,
        cycleLength,
        durationMonths,
        startDate,
        endDate,
      },
    });

    logger.info("Savings plan created", { planId: plan.id, userId, dailyAmount, durationMonths });

    return prisma.savingsPlan.findUnique({
      where: { id: plan.id },
      include: {
        contributions: true,
        _count: { select: { contributions: true, withdrawals: true } },
      },
    });
  }

  /**
   * Get all plans for a user with contribution summary.
   */
  static async getUserPlans(userId: string) {
    const plans = await prisma.savingsPlan.findMany({
      where: { userId },
      include: {
        _count: {
          select: { contributions: true, withdrawals: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich each plan with savings summary
    const enriched = await Promise.all(
      plans.map(async (plan) => {
        const approved = await prisma.contribution.aggregate({
          where: { planId: plan.id, status: "APPROVED", allocationType: "USER_SAVINGS" },
          _sum: { amount: true },
          _count: true,
        });

        const businessFees = await prisma.contribution.aggregate({
          where: { planId: plan.id, status: "APPROVED", allocationType: "BUSINESS_FEE" },
          _sum: { amount: true },
          _count: true,
        });

        const missed = await prisma.contribution.aggregate({
          where: { planId: plan.id, status: "MISSED" },
          _count: true,
        });

        const pendingSubmissions = await prisma.paymentSubmission.aggregate({
          where: { planId: plan.id, status: "PENDING" },
          _sum: { amount: true },
          _count: true,
        });

        const adminEarnings = getProjectedAdminEarnings(plan.durationMonths, plan.dailyAmount);
        const userMaxEarnings = getProjectedUserPayout(plan.durationMonths, plan.dailyAmount, plan.cycleLength);

        return {
          ...plan,
          summary: {
            totalSaved: approved._sum.amount || 0,
            approvedDays: approved._count,
            pendingDays: pendingSubmissions._count,
            missedDays: missed._count,
            feeDays: businessFees._count,
            totalBusinessFees: businessFees._sum.amount || 0,
            pendingSubmissionAmount: pendingSubmissions._sum.amount || 0,
            adminEarnings,
            userMaxEarnings,
          },
        };
      })
    );

    return enriched;
  }

  /**
   * Get a specific plan with full schedule.
   */
  static async getPlanSchedule(planId: string, userId?: string) {
    const plan = await prisma.savingsPlan.findUnique({
      where: { id: planId },
      include: {
        contributions: {
          orderBy: { date: "asc" },
        },
        paymentSubmissions: {
          orderBy: { submittedAt: "desc" },
        },
        withdrawals: {
          orderBy: { createdAt: "desc" },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!plan) {
      throw new Error("Plan not found");
    }

    // If userId provided, verify ownership (for non-admin access)
    if (userId && plan.userId !== userId) {
      throw new Error("You do not have access to this plan");
    }

    // Build the full schedule (all days from start to end)
    const schedule = [];
    const current = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    let dayNumber = 1;

    while (current < end) {
      const dateStr = current.toISOString().split("T")[0];
      const contribution = plan.contributions.find(
        (c) => c.date.toISOString().split("T")[0] === dateStr
      );

      const cycleDay = ((dayNumber - 1) % plan.cycleLength) + 1;
      const isAdminDay = cycleDay === plan.cycleLength; // day 31 = admin day

      schedule.push({
        day: dayNumber,
        cycleDay,
        date: dateStr,
        isAdminDay,
        isBusinessFee: contribution?.allocationType === "BUSINESS_FEE",
        allocationType: contribution?.allocationType || null,
        amount: plan.dailyAmount,
        status: contribution?.status || (new Date(dateStr) < new Date() ? "MISSED" : "UNPAID"),
        method: contribution?.method || null,
        contributionId: contribution?.id || null,
      });

      current.setDate(current.getDate() + 1);
      dayNumber++;
    }

    // Calculate totals
    const approved = await prisma.contribution.aggregate({
      where: { planId, status: "APPROVED", allocationType: "USER_SAVINGS" },
      _sum: { amount: true },
    });

    const businessFees = await prisma.contribution.aggregate({
      where: { planId, status: "APPROVED", allocationType: "BUSINESS_FEE" },
      _sum: { amount: true },
      _count: true,
    });

    const withdrawn = await prisma.withdrawal.aggregate({
      where: { planId, status: "APPROVED" },
      _sum: { amount: true },
    });

    return {
      plan: {
        id: plan.id,
        dailyAmount: plan.dailyAmount,
        cycleLength: plan.cycleLength,
        durationMonths: plan.durationMonths,
        startDate: plan.startDate,
        endDate: plan.endDate,
        isActive: plan.isActive,
        status: plan.status,
        user: plan.user,
      },
      schedule,
      totals: {
        totalSaved: approved._sum.amount || 0,
        totalBusinessFees: businessFees._sum.amount || 0,
        feeDays: businessFees._count,
        totalWithdrawn: withdrawn._sum.amount || 0,
        availableBalance: (approved._sum.amount || 0) - (withdrawn._sum.amount || 0),
      },
      paymentSubmissions: plan.paymentSubmissions,
      withdrawals: plan.withdrawals,
    };
  }

  /**
   * Generate daily contribution records for all active plans.
   * Call this via a cron job or manual trigger.
   * Creates UNPAID for today, marks past unrecorded days as MISSED.
   */
  static async generateDailyContributions() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const activePlans = await prisma.savingsPlan.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        startDate: { lte: today },
        endDate: { gt: today },
      },
    });

    let created = 0;
    let skipped = 0;

    for (const plan of activePlans) {
      // Check if today's record already exists
      const existing = await prisma.contribution.findUnique({
        where: {
          planId_date: { planId: plan.id, date: today },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.contribution.create({
        data: {
          planId: plan.id,
          date: today,
          amount: plan.dailyAmount,
          status: "UNPAID",
        },
      });
      created++;
    }

    // Mark any past UNPAID contributions (older than today) as MISSED
    const missedCount = await prisma.contribution.updateMany({
      where: {
        status: "UNPAID",
        date: { lt: today },
      },
      data: { status: "MISSED" },
    });

    // Complete plans that have passed their end date
    await prisma.savingsPlan.updateMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        endDate: { lte: today },
      },
      data: {
        isActive: false,
        status: "COMPLETED",
      },
    });

    logger.info("Daily contribution generation complete", {
      created,
      skipped,
      markedMissed: missedCount.count,
    });

    return { created, skipped, markedMissed: missedCount.count };
  }
}
