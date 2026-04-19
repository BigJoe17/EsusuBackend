"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContributionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../../utils/prisma"));
const logger_1 = require("../../utils/logger");
class ContributionService {
    /**
     * Pay contributions for a plan. Supports single-day and bulk payments.
     * All payments start as PENDING — only an admin can approve.
     *
     * @param userId - the paying user
     * @param planId - which savings plan
     * @param amount - total amount (must be divisible by dailyAmount)
     * @param method - "CASH" or "TRANSFER"
     * @param proofUrl - optional receipt/screenshot URL
     * @param reference - optional transfer ref or receipt number
     */
    static async payContribution(userId, planId, options = {}) {
        const { method, proofUrl, reference } = options;
        // Verify plan ownership
        const plan = await prisma_1.default.savingsPlan.findUnique({
            where: { id: planId },
        });
        if (!plan)
            throw new Error("Plan not found");
        if (plan.userId !== userId)
            throw new Error("You do not own this plan");
        if (!plan.isActive)
            throw new Error("This plan is no longer active");
        // Default to single day
        const paymentAmount = options.amount || plan.dailyAmount;
        // Validate divisibility
        if (paymentAmount % plan.dailyAmount !== 0) {
            throw new Error(`Amount must be divisible by daily amount (₦${plan.dailyAmount}). ` +
                `Valid: ₦${plan.dailyAmount}, ₦${plan.dailyAmount * 2}, ₦${plan.dailyAmount * 3}, etc.`);
        }
        if (paymentAmount <= 0)
            throw new Error("Amount must be greater than 0");
        const daysToPay = Math.round(paymentAmount / plan.dailyAmount);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        // Build all valid dates in plan
        const candidateDates = [];
        const cursor = new Date(plan.startDate);
        const maxDate = new Date(plan.endDate);
        while (cursor < maxDate) {
            candidateDates.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        // Find existing contributions
        const existing = await prisma_1.default.contribution.findMany({
            where: { planId },
            orderBy: { date: "asc" },
        });
        const existingMap = new Map(existing.map((c) => [c.date.toISOString().split("T")[0], c]));
        // Find payable dates (not APPROVED or PENDING)
        const datesToPay = [];
        for (const date of candidateDates) {
            if (datesToPay.length >= daysToPay)
                break;
            const key = date.toISOString().split("T")[0];
            const rec = existingMap.get(key);
            if (!rec || rec.status === "UNPAID" || rec.status === "MISSED" || rec.status === "REJECTED") {
                datesToPay.push(date);
            }
            // PENDING and APPROVED are skipped
        }
        if (datesToPay.length < daysToPay) {
            throw new Error(`Not enough unpaid days. Requested: ${daysToPay}, Available: ${datesToPay.length}. ` +
                `Max payment: ₦${(datesToPay.length * plan.dailyAmount).toLocaleString()}`);
        }
        // Process: create/update contributions as PENDING
        const batchId = crypto_1.default.randomUUID();
        const results = [];
        for (const date of datesToPay) {
            const key = date.toISOString().split("T")[0];
            const rec = existingMap.get(key);
            const data = {
                status: "PENDING",
                method: method || null,
                proofUrl: proofUrl || null,
                reference: reference || null,
                batchId,
                // Clear any previous rejection
                approvedById: null,
                approvedAt: null,
                rejectionReason: null,
            };
            if (rec) {
                const updated = await prisma_1.default.contribution.update({
                    where: { id: rec.id },
                    data,
                });
                results.push(updated);
            }
            else {
                const created = await prisma_1.default.contribution.create({
                    data: {
                        planId,
                        date,
                        amount: plan.dailyAmount,
                        ...data,
                    },
                });
                results.push(created);
            }
        }
        logger_1.logger.info("Payment recorded — awaiting admin approval", {
            userId, planId, batchId, daysPaid: daysToPay, totalAmount: paymentAmount, method,
        });
        return {
            batchId,
            daysPaid: daysToPay,
            totalAmount: paymentAmount,
            dailyAmount: plan.dailyAmount,
            method: method || null,
            status: "PENDING",
            contributions: results,
            dateRange: {
                from: datesToPay[0].toISOString().split("T")[0],
                to: datesToPay[datesToPay.length - 1].toISOString().split("T")[0],
            },
        };
    }
    // ─── Admin Approval / Rejection ──────────────────────────────────
    /**
     * Admin approves a single contribution.
     */
    static async approveContribution(contributionId, adminId) {
        const contribution = await prisma_1.default.contribution.findUnique({
            where: { id: contributionId },
        });
        if (!contribution)
            throw new Error("Contribution not found");
        if (contribution.status === "APPROVED")
            throw new Error("Already approved");
        const updated = await prisma_1.default.contribution.update({
            where: { id: contributionId },
            data: {
                status: "APPROVED",
                approvedById: adminId,
                approvedAt: new Date(),
                rejectionReason: null,
            },
            include: {
                plan: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                approvedBy: { select: { id: true, name: true, email: true } },
            },
        });
        logger_1.logger.info("Contribution approved", { contributionId, adminId });
        return updated;
    }
    /**
     * Admin rejects a single contribution with a reason.
     */
    static async rejectContribution(contributionId, adminId, reason) {
        const contribution = await prisma_1.default.contribution.findUnique({
            where: { id: contributionId },
        });
        if (!contribution)
            throw new Error("Contribution not found");
        if (contribution.status === "APPROVED")
            throw new Error("Cannot reject an approved contribution");
        const updated = await prisma_1.default.contribution.update({
            where: { id: contributionId },
            data: {
                status: "REJECTED",
                approvedById: adminId,
                approvedAt: new Date(),
                rejectionReason: reason || "Payment not verified",
            },
            include: {
                plan: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                approvedBy: { select: { id: true, name: true, email: true } },
            },
        });
        logger_1.logger.info("Contribution rejected", { contributionId, adminId, reason });
        return updated;
    }
    /**
     * Admin approves all PENDING contributions in a batch.
     */
    static async approveBatch(batchId, adminId) {
        const pending = await prisma_1.default.contribution.findMany({
            where: { batchId, status: "PENDING" },
        });
        if (pending.length === 0)
            throw new Error("No pending contributions in this batch");
        const result = await prisma_1.default.contribution.updateMany({
            where: { batchId, status: "PENDING" },
            data: {
                status: "APPROVED",
                approvedById: adminId,
                approvedAt: new Date(),
            },
        });
        logger_1.logger.info("Batch approved", { batchId, adminId, count: result.count });
        return { batchId, approvedCount: result.count };
    }
    /**
     * Admin rejects all PENDING contributions in a batch.
     */
    static async rejectBatch(batchId, adminId, reason) {
        const pending = await prisma_1.default.contribution.findMany({
            where: { batchId, status: "PENDING" },
        });
        if (pending.length === 0)
            throw new Error("No pending contributions in this batch");
        const result = await prisma_1.default.contribution.updateMany({
            where: { batchId, status: "PENDING" },
            data: {
                status: "REJECTED",
                approvedById: adminId,
                approvedAt: new Date(),
                rejectionReason: reason || "Batch rejected",
            },
        });
        logger_1.logger.info("Batch rejected", { batchId, adminId, count: result.count });
        return { batchId, rejectedCount: result.count };
    }
    // ─── Read Operations ─────────────────────────────────────────────
    /**
     * Get contributions for a user, optionally filtered by planId.
     */
    static async getUserContributions(userId, planId) {
        const where = {};
        if (planId) {
            const plan = await prisma_1.default.savingsPlan.findUnique({ where: { id: planId } });
            if (!plan || plan.userId !== userId)
                throw new Error("Plan not found");
            where.planId = planId;
        }
        else {
            const userPlans = await prisma_1.default.savingsPlan.findMany({
                where: { userId },
                select: { id: true },
            });
            where.planId = { in: userPlans.map((p) => p.id) };
        }
        return prisma_1.default.contribution.findMany({
            where,
            orderBy: { date: "desc" },
            include: {
                plan: { select: { id: true, dailyAmount: true, durationMonths: true } },
                approvedBy: { select: { id: true, name: true } },
            },
        });
    }
    /**
     * Get all pending contributions (admin view).
     */
    static async getPendingContributions() {
        return prisma_1.default.contribution.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            include: {
                plan: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    }
    /**
     * Get all contributions by status (admin view).
     */
    static async getContributionsByStatus(status) {
        const where = {};
        if (status)
            where.status = status.toUpperCase();
        return prisma_1.default.contribution.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                plan: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                approvedBy: { select: { id: true, name: true } },
            },
        });
    }
}
exports.ContributionService = ContributionService;
