import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";

export class WithdrawalService {
  /**
   * Request a withdrawal from a savings plan.
   * Validates that the amount doesn't exceed the available balance.
   */
  static async requestWithdrawal(userId: string, planId: string, amount: number) {
    // Check if user has a bank account linked
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { userId }
    });

    if (!bankAccount) {
      throw new Error("Please add a bank account first before requesting a withdrawal.");
    }

    const plan = await prisma.savingsPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error("Plan not found");
    }

    if (plan.userId !== userId) {
      throw new Error("You do not own this plan");
    }

    if (amount <= 0) {
      throw new Error("Withdrawal amount must be greater than 0");
    }

    // Calculate available balance
    const approvedContributions = await prisma.contribution.aggregate({
      where: { planId, status: "APPROVED", allocationType: "USER_SAVINGS" },
      _sum: { amount: true },
    });

    const approvedWithdrawals = await prisma.withdrawal.aggregate({
      where: { planId, status: "APPROVED" },
      _sum: { amount: true },
    });

    const pendingWithdrawals = await prisma.withdrawal.aggregate({
      where: { planId, status: "PENDING" },
      _sum: { amount: true },
    });

    const totalSaved = approvedContributions._sum.amount || 0;
    const totalWithdrawn = approvedWithdrawals._sum.amount || 0;
    const totalPending = pendingWithdrawals._sum.amount || 0;

    const availableBalance = totalSaved - totalWithdrawn - totalPending;

    if (amount > availableBalance) {
      throw new Error(
        `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}. ` +
        `(Total saved: ₦${totalSaved.toLocaleString()}, ` +
        `Withdrawn: ₦${totalWithdrawn.toLocaleString()}, ` +
        `Pending: ₦${totalPending.toLocaleString()})`
      );
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        planId,
        amount,
        status: "PENDING",
      },
      include: {
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    logger.info("Withdrawal requested", { withdrawalId: withdrawal.id, planId, amount });

    return {
      ...withdrawal,
      availableBalance: availableBalance - amount,
    };
  }

  /**
   * Get withdrawals for a specific user.
   */
  static async getUserWithdrawals(userId: string) {
    return prisma.withdrawal.findMany({
      where: {
        plan: { userId }
      },
      orderBy: { createdAt: "desc" },
      include: {
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            durationMonths: true
          }
        }
      }
    });
  }

  /**
   * Admin approves a withdrawal.
   */
  static async approveWithdrawal(withdrawalId: string) {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    if (withdrawal.status === "APPROVED") {
      throw new Error("Withdrawal is already approved");
    }

    if (withdrawal.status === "REJECTED") {
      throw new Error("Withdrawal has been rejected");
    }

    const updated = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: "APPROVED" },
      include: {
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    logger.info("Withdrawal approved", { withdrawalId, planId: withdrawal.planId });

    return updated;
  }

  /**
   * Admin rejects a withdrawal.
   */
  static async rejectWithdrawal(withdrawalId: string) {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    const updated = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: "REJECTED" },
      include: {
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    logger.info("Withdrawal rejected", { withdrawalId, planId: withdrawal.planId });

    return updated;
  }

  /**
   * Get all pending withdrawals (admin view).
   */
  static async getPendingWithdrawals() {
    return prisma.withdrawal.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
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
  }
}
