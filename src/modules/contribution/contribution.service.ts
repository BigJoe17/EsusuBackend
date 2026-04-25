import prisma from "../../utils/prisma";

export class ContributionService {
  /**
   * Get allocated contribution records for a user, optionally scoped to a plan.
   */
  static async getUserContributions(userId: string, planId?: string) {
    const where: Record<string, any> = {};

    if (planId) {
      const plan = await prisma.savingsPlan.findUnique({ where: { id: planId } });
      if (!plan || plan.userId !== userId) throw new Error("Plan not found");
      where.planId = planId;
    } else {
      const userPlans = await prisma.savingsPlan.findMany({
        where: { userId },
        select: { id: true },
      });
      where.planId = { in: userPlans.map((plan) => plan.id) };
    }

    return prisma.contribution.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        plan: { select: { id: true, dailyAmount: true, durationMonths: true } },
        approvedBy: { select: { id: true, name: true } },
        paymentSubmission: {
          select: {
            id: true,
            amount: true,
            method: true,
            reference: true,
            selectedStartDate: true,
            submittedAt: true,
          },
        },
      },
    });
  }
}
