import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";
import { PaymentMethod, WithdrawalStatus } from "@prisma/client";
import { sendPushNotification } from "../../utils/push.util";

export class WithdrawalService {
  /**
   * Request a withdrawal from a savings plan.
   * Uses a transaction to fix TOCTOU vulnerability when checking balances.
   */
  static async requestWithdrawal(userId: string, planId: string, amount: number, method: PaymentMethod = "TRANSFER") {
    return prisma.$transaction(async (tx) => {
      // Check if user has a bank account linked (only required for TRANSFER)
      if (method === "TRANSFER") {
        const bankAccount = await tx.bankAccount.findUnique({
          where: { userId }
        });
        if (!bankAccount) {
          throw new Error("Please add a bank account first before requesting a TRANSFER withdrawal.");
        }
      }

      const plan = await tx.savingsPlan.findUnique({
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

      // Calculate available balance within the transaction context
      const approvedContributions = await tx.contribution.aggregate({
        where: { planId, status: "APPROVED", allocationType: "USER_SAVINGS" },
        _sum: { amount: true },
      });

      // Active withdrawals are anything not REJECTED (they reserve balance)
      const activeWithdrawals = await tx.withdrawal.aggregate({
        where: { planId, status: { notIn: ["REJECTED"] } },
        _sum: { amount: true },
      });

      const totalSaved = approvedContributions._sum.amount || 0;
      const totalReserved = activeWithdrawals._sum.amount || 0;
      const availableBalance = totalSaved - totalReserved;

      if (amount > availableBalance) {
        throw new Error(
          `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}. ` +
          `(Total saved: ₦${totalSaved.toLocaleString()}, ` +
          `Reserved for other withdrawals: ₦${totalReserved.toLocaleString()})`
        );
      }

      const withdrawal = await tx.withdrawal.create({
        data: {
          planId,
          amount,
          status: "PENDING",
          method,
        },
        include: {
          plan: {
            select: {
              id: true,
              dailyAmount: true,
              user: { select: { id: true, name: true, email: true, expoPushToken: true } },
            },
          },
        },
      });

      logger.info("Withdrawal requested", { withdrawalId: withdrawal.id, planId, amount, method });

      // Trigger admin notification asynchronously
      // In a real app, you would notify admins specifically. Here we just log or broadcast.
      return {
        ...withdrawal,
        availableBalance: availableBalance - amount,
      };
    });
  }

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

  static async getPendingWithdrawals() {
    return prisma.withdrawal.findMany({
      where: { status: { notIn: ["COMPLETED", "REJECTED"] } }, // Fetch all active pipeline items
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

  // --- STATE MACHINE TRANSITIONS ---

  private static async updateStatus(withdrawalId: string, fromStatuses: WithdrawalStatus[], toStatus: WithdrawalStatus, extraData: any = {}) {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        plan: { include: { user: { select: { id: true, name: true, email: true, expoPushToken: true } } } }
      }
    });

    if (!withdrawal) throw new Error("Withdrawal not found");
    
    if (!fromStatuses.includes(withdrawal.status)) {
      throw new Error(`Cannot transition from ${withdrawal.status} to ${toStatus}`);
    }

    const updated = await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { 
        status: toStatus,
        ...extraData
      },
      include: {
        plan: {
          select: {
            id: true,
            dailyAmount: true,
            user: { select: { id: true, name: true, email: true, expoPushToken: true } },
          },
        },
      },
    });

    return updated;
  }

  private static async notifyUser(withdrawal: any, title: string, body: string, type: "INFO" | "ALERT" = "INFO") {
    const user = withdrawal.plan.user;
    if (!user) return;

    try {
      await Promise.allSettled([
        user.expoPushToken ? sendPushNotification(user.expoPushToken, title, body, { type: "WITHDRAWAL_UPDATE", withdrawalId: withdrawal.id }) : Promise.resolve(),
        prisma.notification.create({
          data: { userId: user.id, title, body, type, channel: "APP" },
        }),
      ]);
    } catch (e) {
      logger.error("Failed to send withdrawal notification", e);
    }
  }

  static async acceptWithdrawal(withdrawalId: string) {
    const updated = await this.updateStatus(withdrawalId, ["PENDING", "ON_HOLD"], "ACCEPTED", { acceptedAt: new Date() });
    await this.notifyUser(updated, "Withdrawal Accepted", `Your withdrawal request of ₦${updated.amount.toLocaleString()} has been accepted and is moving to processing.`);
    return updated;
  }

  static async processWithdrawal(withdrawalId: string) {
    const updated = await this.updateStatus(withdrawalId, ["ACCEPTED", "ON_HOLD"], "PROCESSING", { processingAt: new Date() });
    await this.notifyUser(updated, "Withdrawal Processing", `We are currently processing your withdrawal of ₦${updated.amount.toLocaleString()}.`);
    return updated;
  }

  static async markReadyForPickup(withdrawalId: string) {
    // Generate 6 digit OTP
    const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date();
    otpExpiresAt.setDate(otpExpiresAt.getDate() + 3); // 3 days to pick up

    const updated = await this.updateStatus(withdrawalId, ["PROCESSING", "ON_HOLD"], "READY_FOR_PICKUP", { 
      readyForPickupAt: new Date(),
      pickupOtp,
      otpExpiresAt
    });

    await this.notifyUser(updated, "Cash Ready for Pickup!", `Your cash of ₦${updated.amount.toLocaleString()} is ready for pickup. Your secure OTP is ${pickupOtp}. Do not share this until you arrive.`, "ALERT");
    return updated;
  }

  static async markTransferSent(withdrawalId: string, reference: string) {
    if (!reference) throw new Error("Transfer reference is required");
    const updated = await this.updateStatus(withdrawalId, ["PROCESSING", "ON_HOLD"], "TRANSFER_SENT", { 
      transferSentAt: new Date(),
      reference
    });

    await this.notifyUser(updated, "Transfer Sent!", `Your withdrawal of ₦${updated.amount.toLocaleString()} has been sent to your bank. Ref: ${reference}`, "INFO");
    return updated;
  }

  static async completeWithdrawal(withdrawalId: string, providedOtp?: string) {
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error("Withdrawal not found");

    if (withdrawal.method === "CASH") {
      if (withdrawal.status !== "READY_FOR_PICKUP") {
        throw new Error("Cash withdrawal must be READY_FOR_PICKUP before completing");
      }
      if (!providedOtp || providedOtp !== withdrawal.pickupOtp) {
        throw new Error("Invalid or missing OTP for cash pickup");
      }
      if (withdrawal.otpExpiresAt && new Date() > withdrawal.otpExpiresAt) {
        throw new Error("Pickup OTP has expired");
      }
    } else {
      if (withdrawal.status !== "TRANSFER_SENT" && withdrawal.status !== "PROCESSING") {
        throw new Error(`Cannot complete transfer from status ${withdrawal.status}`);
      }
    }

    const updated = await this.updateStatus(withdrawalId, [withdrawal.status], "COMPLETED", { 
      completedAt: new Date(),
      otpVerifiedAt: withdrawal.method === "CASH" ? new Date() : null
    });

    await this.notifyUser(updated, "Withdrawal Completed ✅", `Your withdrawal of ₦${updated.amount.toLocaleString()} is complete. Thank you for saving with us!`);
    return updated;
  }

  static async holdWithdrawal(withdrawalId: string, note?: string) {
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error("Withdrawal not found");

    const updated = await this.updateStatus(withdrawalId, [withdrawal.status], "ON_HOLD", { 
      holdAt: new Date(),
      adminNote: note
    });

    await this.notifyUser(updated, "Withdrawal On Hold", `Your withdrawal has been placed on hold. ${note ? `Reason: ${note}` : "Please contact support for more details."}`, "ALERT");
    return updated;
  }

  static async rejectWithdrawal(withdrawalId: string, reason?: string) {
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error("Withdrawal not found");

    const updated = await this.updateStatus(withdrawalId, [withdrawal.status], "REJECTED", { 
      rejectedAt: new Date(),
      adminNote: reason || "Request rejected by admin"
    });

    await this.notifyUser(updated, "Withdrawal Rejected", `Your withdrawal request of ₦${updated.amount.toLocaleString()} was rejected. ${reason ? `Reason: ${reason}` : ""}`, "ALERT");
    return updated;
  }
}
