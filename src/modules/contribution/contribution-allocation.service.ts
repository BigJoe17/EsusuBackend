import { ContributionAllocationType, PaymentSubmissionStatus, Prisma, PrismaClient } from "@prisma/client";
import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";
import { sendPushNotification } from "../../utils/push.util";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

export class ContributionAllocationService {
  static async approveSubmission(submissionId: string, adminId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const submission = (await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
        include: {
          plan: true,
          user: {
            select: { id: true, name: true, email: true, expoPushToken: true },
          },
        },
      })) as any;

      if (!submission) {
        throw new Error("Payment submission not found");
      }

      if (submission.status !== PaymentSubmissionStatus.PENDING) {
        throw new Error(`Payment submission is already ${submission.status.toLowerCase()}`);
      }

      const plan = submission.plan;
      if (!plan.isActive) {
        throw new Error("This plan is no longer active");
      }

      const allocationDates = await this.getAllocatableDates(tx, submission.planId, submission.selectedStartDate, submission.daysCovered);

      if (allocationDates.length < submission.daysCovered) {
        throw new Error(
          `Not enough payable days from ${submission.selectedStartDate.toISOString().split("T")[0]}. ` +
            `Requested: ${submission.daysCovered}, Available: ${allocationDates.length}.`
        );
      }

      const cycleNumbers = Array.from(
        new Set(
          allocationDates.map((date) => this.getCycleMetadata(plan.startDate, date, plan.cycleLength).cycleNumber)
        )
      );

      // Pre-fetch everything we need to minimize DB round-trips inside the transaction
      const [existingFeeCycles, existingContributions] = await Promise.all([
        tx.contribution.findMany({
          where: {
            planId: submission.planId,
            status: "APPROVED",
            allocationType: ContributionAllocationType.BUSINESS_FEE,
            cycleNumber: { in: cycleNumbers },
          },
          select: { cycleNumber: true },
        }),
        tx.contribution.findMany({
          where: {
            planId: submission.planId,
            date: { in: allocationDates }
          }
        })
      ]);

      const feeCyclesSet = new Set<number>(
        existingFeeCycles
          .map((c) => c.cycleNumber)
          .filter((n): n is number => typeof n === "number")
      );

      const existingContribMap = new Map(
        existingContributions.map(c => [c.date.toISOString().split("T")[0], c])
      );

      const createdOrUpdated: any[] = [];
      const feeAllocatedForCycles = new Set<number>(feeCyclesSet);
      const now = new Date();

      for (const date of allocationDates) {
        const key = date.toISOString().split("T")[0];
        const existingContribution = existingContribMap.get(key);

        const { cycleNumber, dayInCycle } = this.getCycleMetadata(plan.startDate, date, plan.cycleLength);
        const allocationType = feeAllocatedForCycles.has(cycleNumber)
          ? ContributionAllocationType.USER_SAVINGS
          : ContributionAllocationType.BUSINESS_FEE;

        feeAllocatedForCycles.add(cycleNumber);

        const contributionData: Prisma.ContributionUncheckedCreateInput = {
          planId: submission.planId,
          date,
          amount: plan.dailyAmount,
          status: "APPROVED",
          method: submission.method,
          proofUrl: submission.proofUrl,
          reference: submission.reference || null,
          batchId: submission.id,
          approvedById: adminId,
          approvedAt: now,
          rejectionReason: null,
          allocationType,
          cycleNumber,
          dayInCycle,
          paymentSubmissionId: submission.id,
        };

        const contribution = existingContribution
          ? await tx.contribution.update({
              where: { id: existingContribution.id },
              data: contributionData,
            })
          : await tx.contribution.create({
              data: contributionData,
            });

        createdOrUpdated.push(contribution);

        if (allocationType === ContributionAllocationType.BUSINESS_FEE) {
          await tx.adminEarning.create({
            data: {
              sourceType: "FEE",
              sourceId: contribution.id,
              amount: contribution.amount,
              description: `Cycle fee from submission ${submission.id}`,
            },
          });
        }
      }

      const reviewedSubmission = await tx.paymentSubmission.update({
        where: { id: submission.id },
        data: {
          status: PaymentSubmissionStatus.APPROVED,
          reviewedAt: now,
          reviewedById: adminId,
          rejectionReason: null,
        },
        include: {
          plan: {
            include: { user: { select: { id: true, name: true, email: true, expoPushToken: true } } },
          },
          user: {
            select: { id: true, name: true, email: true, expoPushToken: true },
          },
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
          contributions: true,
        },
      });

      return {
        submission: reviewedSubmission,
        allocatedContributions: createdOrUpdated,
      };
    }, {
      timeout: 30000 // 30 seconds to handle bulk allocations on remote DBs
    });

    // Fire push notification + create in-app notification OUTSIDE transaction
    try {
      const submission = result?.submission as any;
      const userId = submission?.userId;
      const user = submission?.user;
      const pushToken = user?.expoPushToken;

      if (userId) {
        const notifTitle = "✅ Payment Approved!";
        const notifBody = `Your payment of ₦${submission.amount.toLocaleString()} for ${result.allocatedContributions.length} day${result.allocatedContributions.length !== 1 ? "s" : ""} has been approved.`;

        Promise.allSettled([
          pushToken ? sendPushNotification(pushToken, notifTitle, notifBody, { type: "PAYMENT_APPROVED" }) : Promise.resolve(),
          prisma.notification.create({
            data: { userId, title: notifTitle, body: notifBody, type: "INFO", channel: "APP" },
          }),
        ]).catch(e => logger.error("Async notification error:", e));
      }
    } catch (e) {
      logger.error("Failed to trigger post-approval notifications:", e);
    }

    return result;
  }

  static async rejectSubmission(submissionId: string, adminId: string, reason?: string) {
    const submission = await prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error("Payment submission not found");
    }

    if (submission.status !== PaymentSubmissionStatus.PENDING) {
      throw new Error(`Payment submission is already ${submission.status.toLowerCase()}`);
    }

    const rejected = await prisma.paymentSubmission.update({
      where: { id: submissionId },
      data: {
        status: PaymentSubmissionStatus.REJECTED,
        rejectionReason: reason || "Payment not verified",
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      include: {
        plan: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        user: {
          select: { id: true, name: true, email: true, expoPushToken: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Fire push + in-app notification
    const pushToken = (rejected.user as any).expoPushToken;
    const notifTitle = "❌ Payment Rejected";
    const notifBody = `Your payment of ₦${submission.amount.toLocaleString()} was rejected. Reason: ${reason || "Payment not verified"}. Please resubmit.`;

    await Promise.allSettled([
      sendPushNotification(pushToken, notifTitle, notifBody, { type: "PAYMENT_REJECTED" }),
      prisma.notification.create({
        data: { userId: submission.userId, title: notifTitle, body: notifBody, type: "ALERT", channel: "APP" },
      }),
    ]);

    return rejected;
  }

  private static async getAllocatableDates(
    tx: PrismaTransaction,
    planId: string,
    selectedStartDate: Date,
    daysCovered: number
  ) {
    const plan = await tx.savingsPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error("Plan not found");
    }

    const normalizedStart = new Date(selectedStartDate);
    normalizedStart.setUTCHours(0, 0, 0, 0);

    if (normalizedStart < plan.startDate || normalizedStart >= plan.endDate) {
      throw new Error("Selected start date is outside the plan schedule");
    }

    const existingContributions = await tx.contribution.findMany({
      where: { planId },
      orderBy: { date: "asc" },
    });

    const existingMap = new Map(
      existingContributions.map((contribution) => [contribution.date.toISOString().split("T")[0], contribution])
    );

    const candidateDates: Date[] = [];
    const cursor = new Date(normalizedStart);

    while (cursor < plan.endDate && candidateDates.length < daysCovered) {
      const key = cursor.toISOString().split("T")[0];
      const record = existingMap.get(key);

      if (!record || record.status !== "APPROVED") {
        candidateDates.push(new Date(cursor));
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return candidateDates;
  }

  private static getCycleMetadata(planStartDate: Date, contributionDate: Date, cycleLength: number) {
    const start = new Date(planStartDate);
    start.setUTCHours(0, 0, 0, 0);
    const date = new Date(contributionDate);
    date.setUTCHours(0, 0, 0, 0);

    const dayOffset = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cycleNumber = Math.floor(dayOffset / cycleLength) + 1;
    const dayInCycle = (dayOffset % cycleLength) + 1;

    return { cycleNumber, dayInCycle };
  }
}
