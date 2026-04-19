"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const logger_1 = require("../../utils/logger");
class PlanService {
    /**
     * Create a new savings plan.
     * Calculates endDate based on durationMonths and cycleLength.
     */
    static async createPlan(userId, data) {
        const { dailyAmount, durationMonths } = data;
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
        // Calculate end date: durationMonths * 31 days per cycle
        const totalDays = durationMonths * 31;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + totalDays);
        const plan = await prisma_1.default.savingsPlan.create({
            data: {
                userId,
                dailyAmount,
                cycleLength: 31,
                durationMonths,
                startDate,
                endDate,
            },
        });
        logger_1.logger.info("Savings plan created", { planId: plan.id, userId, dailyAmount, durationMonths });
        // Generate today's first contribution record
        await prisma_1.default.contribution.create({
            data: {
                planId: plan.id,
                date: startDate,
                amount: dailyAmount,
                status: "PENDING",
            },
        });
        return prisma_1.default.savingsPlan.findUnique({
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
    static async getUserPlans(userId) {
        const plans = await prisma_1.default.savingsPlan.findMany({
            where: { userId },
            include: {
                _count: {
                    select: { contributions: true, withdrawals: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        // Enrich each plan with savings summary
        const enriched = await Promise.all(plans.map(async (plan) => {
            const approved = await prisma_1.default.contribution.aggregate({
                where: { planId: plan.id, status: "APPROVED" },
                _sum: { amount: true },
                _count: true,
            });
            const pending = await prisma_1.default.contribution.aggregate({
                where: { planId: plan.id, status: "PENDING" },
                _count: true,
            });
            const missed = await prisma_1.default.contribution.aggregate({
                where: { planId: plan.id, status: "MISSED" },
                _count: true,
            });
            const totalCycles = Math.ceil(plan.durationMonths * 31 / plan.cycleLength);
            const adminEarnings = totalCycles * plan.dailyAmount; // 1 day per cycle
            const userMaxEarnings = (plan.durationMonths * 31 * plan.dailyAmount) - adminEarnings;
            return {
                ...plan,
                summary: {
                    totalSaved: approved._sum.amount || 0,
                    approvedDays: approved._count,
                    pendingDays: pending._count,
                    missedDays: missed._count,
                    adminEarnings,
                    userMaxEarnings,
                },
            };
        }));
        return enriched;
    }
    /**
     * Get a specific plan with full schedule.
     */
    static async getPlanSchedule(planId, userId) {
        const plan = await prisma_1.default.savingsPlan.findUnique({
            where: { id: planId },
            include: {
                contributions: {
                    orderBy: { date: "asc" },
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
            const contribution = plan.contributions.find((c) => c.date.toISOString().split("T")[0] === dateStr);
            const cycleDay = ((dayNumber - 1) % plan.cycleLength) + 1;
            const isAdminDay = cycleDay === plan.cycleLength; // day 31 = admin day
            schedule.push({
                day: dayNumber,
                cycleDay,
                date: dateStr,
                isAdminDay,
                amount: plan.dailyAmount,
                status: contribution?.status || (new Date(dateStr) < new Date() ? "MISSED" : "UNPAID"),
                method: contribution?.method || null,
                contributionId: contribution?.id || null,
            });
            current.setDate(current.getDate() + 1);
            dayNumber++;
        }
        // Calculate totals
        const approved = await prisma_1.default.contribution.aggregate({
            where: { planId, status: "APPROVED" },
            _sum: { amount: true },
        });
        const withdrawn = await prisma_1.default.withdrawal.aggregate({
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
                totalWithdrawn: withdrawn._sum.amount || 0,
                availableBalance: (approved._sum.amount || 0) - (withdrawn._sum.amount || 0),
            },
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
        const activePlans = await prisma_1.default.savingsPlan.findMany({
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
            const existing = await prisma_1.default.contribution.findUnique({
                where: {
                    planId_date: { planId: plan.id, date: today },
                },
            });
            if (existing) {
                skipped++;
                continue;
            }
            await prisma_1.default.contribution.create({
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
        const missedCount = await prisma_1.default.contribution.updateMany({
            where: {
                status: "UNPAID",
                date: { lt: today },
            },
            data: { status: "MISSED" },
        });
        // Complete plans that have passed their end date
        await prisma_1.default.savingsPlan.updateMany({
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
        logger_1.logger.info("Daily contribution generation complete", {
            created,
            skipped,
            markedMissed: missedCount.count,
        });
        return { created, skipped, markedMissed: missedCount.count };
    }
}
exports.PlanService = PlanService;
