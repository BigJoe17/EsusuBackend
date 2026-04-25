import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";

export class PaymentSubmissionService {
  static async createSubmission(
    userId: string,
    planId: string,
    options: {
      amount: number;
      method: "CASH" | "TRANSFER";
      proofUrl: string;
      reference?: string;
      selectedStartDate: Date;
    }
  ) {
    const plan = await prisma.savingsPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new Error("Plan not found");
    if (plan.userId !== userId) throw new Error("You do not own this plan");
    if (!plan.isActive) throw new Error("This plan is no longer active");

    const paymentAmount = options.amount;
    if (paymentAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (paymentAmount % plan.dailyAmount !== 0) {
      throw new Error(
        `Amount must be divisible by daily amount (₦${plan.dailyAmount}). ` +
          `Valid: ₦${plan.dailyAmount}, ₦${plan.dailyAmount * 2}, ₦${plan.dailyAmount * 3}, etc.`
      );
    }

    const normalizedStartDate = new Date(options.selectedStartDate);
    normalizedStartDate.setUTCHours(0, 0, 0, 0);

    if (Number.isNaN(normalizedStartDate.getTime())) {
      throw new Error("A valid start date is required");
    }

    if (normalizedStartDate < plan.startDate || normalizedStartDate >= plan.endDate) {
      throw new Error("Selected start date is outside the plan schedule");
    }

    if (!options.proofUrl?.trim()) {
      throw new Error("Payment proof is required");
    }

    const daysCovered = Math.round(paymentAmount / plan.dailyAmount);

    const submission = await prisma.paymentSubmission.create({
      data: {
        planId,
        userId,
        amount: paymentAmount,
        method: options.method,
        proofUrl: options.proofUrl.trim(),
        reference: options.reference?.trim() || null,
        selectedStartDate: normalizedStartDate,
        daysCovered,
      },
      include: {
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            durationMonths: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    logger.info("Payment submission created", {
      submissionId: submission.id,
      userId,
      planId,
      amount: paymentAmount,
      daysCovered,
      selectedStartDate: normalizedStartDate.toISOString(),
    });

    return submission;
  }

  static async getUserSubmissions(userId: string, planId?: string) {
    const where: Record<string, any> = { userId };

    if (planId) {
      const plan = await prisma.savingsPlan.findUnique({ where: { id: planId } });
      if (!plan || plan.userId !== userId) throw new Error("Plan not found");
      where.planId = planId;
    }

    return prisma.paymentSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: {
        plan: { select: { id: true, dailyAmount: true, durationMonths: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
  }

  static async getAdminSubmissions(status?: string) {
    const where: Record<string, any> = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    return prisma.paymentSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            durationMonths: true,
            startDate: true,
            endDate: true,
          },
        },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
  }
}
