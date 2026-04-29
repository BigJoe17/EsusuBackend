import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";
import { getProjectedAdminEarnings } from "../../utils/business-rules";
import { getPaginationParams, createPaginatedResponse } from "../../utils/pagination.util";

export class AdminController {
  /**
   * GET /api/admin/users
   */
  static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = getPaginationParams(req.query);

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isVerified: true,
            isSuspended: true,
            createdAt: true,
            _count: {
              select: { plans: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count(),
      ]);

      const paginated = createPaginatedResponse(users, total, { page, limit, skip });
      res.status(200).json({ success: true, users: paginated.data, meta: paginated.meta });
    } catch (error: any) {
      logger.error("Get users error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/plans
   */
  static async getPlans(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = getPaginationParams(req.query);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const [plans, total] = await Promise.all([
        prisma.savingsPlan.findMany({
          skip,
          take: limit,
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { contributions: true, withdrawals: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.savingsPlan.count({ where }),
      ]);

      const paginated = createPaginatedResponse(plans, total, { page, limit, skip });
      res.status(200).json({ success: true, plans: paginated.data, meta: paginated.meta });
    } catch (error: any) {
      logger.error("Get admin plans error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/contributions?status=PENDING
   */
  static async getContributions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = getPaginationParams(req.query);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const [contributions, total] = await Promise.all([
        prisma.contribution.findMany({
          skip,
          take: limit,
          where,
          orderBy: { date: "desc" },
          include: {
            plan: {
              select: {
                id: true,
                dailyAmount: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
            paymentSubmission: {
              select: {
                id: true,
                amount: true,
                method: true,
                selectedStartDate: true,
                submittedAt: true,
              },
            },
          },
        }),
        prisma.contribution.count({ where }),
      ]);

      const paginated = createPaginatedResponse(contributions, total, { page, limit, skip });
      res.status(200).json({ success: true, contributions: paginated.data, meta: paginated.meta });
    } catch (error: any) {
      logger.error("Get admin contributions error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/withdrawals?status=PENDING
   */
  static async getWithdrawals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = getPaginationParams(req.query);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          skip,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          include: {
            plan: {
              select: {
                id: true,
                dailyAmount: true,
                durationMonths: true,
                user: { 
                  select: { 
                    id: true, 
                    name: true, 
                    email: true,
                    bankAccount: {
                      select: {
                        bankName: true,
                        accountNumber: true,
                        accountName: true,
                      }
                    }
                  } 
                },
              },
            },
          },
        }),
        prisma.withdrawal.count({ where }),
      ]);

      const paginated = createPaginatedResponse(withdrawals, total, { page, limit, skip });
      res.status(200).json({ success: true, withdrawals: paginated.data, meta: paginated.meta });
    } catch (error: any) {
      logger.error("Get admin withdrawals error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/withdrawals/export
   * Exports withdrawals as CSV
   */
  static async exportWithdrawals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const withdrawals = await prisma.withdrawal.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          plan: {
            select: {
              user: { 
                select: { 
                  name: true, 
                  email: true, 
                  bankAccount: {
                    select: {
                      bankName: true,
                      accountNumber: true,
                      accountName: true,
                    }
                  }
                } 
              },
            },
          },
        },
      });

      let csv = 'ID,Date,User Name,User Email,Amount,Status,Bank Name,Account Number,Account Name\n';
      
      withdrawals.forEach((w) => {
        const user = w.plan.user;
        const bank = user.bankAccount;
        
        csv += `${w.id},${new Date(w.createdAt).toISOString()}` +
               `,${user.name},${user.email},${w.amount},${w.status}` +
               `,${bank?.bankName || ''},${bank?.accountNumber || ''},${bank?.accountName || ''}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=withdrawals.csv');
      res.status(200).send(csv);
    } catch (error: any) {
      logger.error("Export admin withdrawals error:", error);
      res.status(500).send("Internal server error");
    }
  }

  /**
   * GET /api/admin/earnings
   * Calculate admin earnings analytics across approved fee allocations and penalties.
   */
  static async getEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = getPaginationParams(req.query);

      // 1. Aggregations for total earnings
      const [feeEarningsResult, penaltiesResult, projectedEarningsResult, totalPlans, activePlansCount] = await Promise.all([
        prisma.contribution.aggregate({
          where: { status: "APPROVED", allocationType: "BUSINESS_FEE" },
          _sum: { amount: true },
        }),
        prisma.adminEarning.aggregate({
          where: { sourceType: "PENALTY" },
          _sum: { amount: true },
        }),
        prisma.$queryRaw<{ total: number }[]>`
          SELECT SUM("durationMonths" * "dailyAmount")::float as total
          FROM "SavingsPlan"
          WHERE "isActive" = true
        `,
        prisma.savingsPlan.count(),
        prisma.savingsPlan.count({ where: { isActive: true } }),
      ]);

      const totalFeeEarnings = feeEarningsResult._sum.amount || 0;
      const penaltyEarnings = penaltiesResult._sum.amount || 0;
      const totalAdminEarnings = totalFeeEarnings + penaltyEarnings;
      const projectedTotalEarnings = projectedEarningsResult[0]?.total || 0;

      // 2. Paginated breakdown
      const plans = await prisma.savingsPlan.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const planIds = plans.map(p => p.id);

      const feeContributions = await prisma.contribution.groupBy({
        by: ['planId'],
        where: {
          planId: { in: planIds },
          status: "APPROVED",
          allocationType: "BUSINESS_FEE",
        },
        _sum: { amount: true },
        _count: { id: true }
      });

      const feeContributionsMap = new Map(
        feeContributions.map(c => [c.planId, c])
      );

      const planEarnings = plans.map((plan) => {
        const stats = feeContributionsMap.get(plan.id);
        return {
          planId: plan.id,
          user: plan.user,
          dailyAmount: plan.dailyAmount,
          durationMonths: plan.durationMonths,
          completedCycles: stats?._count.id || 0,
          adminEarnings: stats?._sum.amount || 0,
          status: plan.status,
        };
      });

        const paginated = createPaginatedResponse(planEarnings, totalPlans, { page, limit, skip });
        res.status(200).json({
          success: true,
          totalAdminEarnings,
          totalFeeEarnings,
          penaltyEarnings,
          projectedTotalEarnings,
          activePlansCount,
          totalPlansCount: totalPlans,
          breakdown: paginated.data,
          meta: paginated.meta,
        });
    } catch (error: any) {
      logger.error("Get admin earnings error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/dashboard
   * Consolidated insights: Earnings, defaulters, top savers, pending queue, daily collections
   */
  static async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const todayString = new Date().toISOString().split("T")[0];
      const startOfDay = new Date(todayString);
      const endOfDay = new Date(todayString);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      logger.info("[DASHBOARD] Fetching consolidated metrics...");
      const startTime = Date.now();

      // Execute aggregated queries in parallel
      const [
        totalUsers,
        totalPlans,
        pendingApprovals,
        dailyCollectionsSum,
        penaltySum,
        feeEarningsSum,
        recentPendingSubmissions,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.savingsPlan.count(),
        prisma.paymentSubmission.count({ where: { status: "PENDING" } }),
        prisma.paymentSubmission.aggregate({
          where: {
            status: "APPROVED",
            reviewedAt: { gte: startOfDay, lt: endOfDay },
          },
          _sum: { amount: true },
        }),
        prisma.adminEarning.aggregate({
          where: { sourceType: "PENALTY" },
          _sum: { amount: true },
        }),
        prisma.contribution.aggregate({
          where: { status: "APPROVED", allocationType: "BUSINESS_FEE" },
          _sum: { amount: true },
        }),
        prisma.paymentSubmission.findMany({
          where: { status: "PENDING" },
          orderBy: { submittedAt: "desc" },
          take: 5,
          include: {
            user: { select: { id: true, name: true, email: true } },
            plan: { select: { id: true, dailyAmount: true, durationMonths: true } },
          },
        }),
      ]);

      const parallelTime = Date.now() - startTime;
      logger.debug(`[DASHBOARD] Parallel aggregates took ${parallelTime}ms`);

      const dailyCollections = dailyCollectionsSum._sum.amount || 0;
      const penaltyEarnings = penaltySum._sum.amount || 0;
      const feeEarnings = feeEarningsSum._sum.amount || 0;

      // Execute complex grouped metrics using fast raw SQL to prevent massive memory arrays
      // Defaulters: Top 5 users with missed/unpaid contributions past their target date
      logger.debug("[DASHBOARD] Fetching defaulters...");
      const defaultersResult: any[] = await prisma.$queryRaw`
        SELECT u.id, u.name, u.email, COUNT(c.id)::int as count
        FROM "Contribution" c
        JOIN "SavingsPlan" p ON c."planId" = p.id
        JOIN "User" u ON p."userId" = u.id
        WHERE c.status IN ('MISSED', 'UNPAID') AND c.date <= NOW()
        GROUP BY u.id, u.name, u.email
        ORDER BY count DESC
        LIMIT 5;
      `;

      logger.debug("[DASHBOARD] Fetching top contributors...");
      // Top Contributors: Top 5 users with the most approved savings
      const topContributorsResult: any[] = await prisma.$queryRaw`
        SELECT u.id, u.name, u.email, SUM(c.amount)::float as amount
        FROM "Contribution" c
        JOIN "SavingsPlan" p ON c."planId" = p.id
        JOIN "User" u ON p."userId" = u.id
        WHERE c.status = 'APPROVED' AND c."allocationType" = 'USER_SAVINGS'
        GROUP BY u.id, u.name, u.email
        ORDER BY amount DESC
        LIMIT 5;
      `;

      const totalTime = Date.now() - startTime;
      logger.info(`[DASHBOARD] Full dashboard fetch took ${totalTime}ms`);

      // Structure results exactly identical to the original unoptimized memory-loop structure
      const defaulters = defaultersResult.map((u) => ({
        user: { id: u.id, name: u.name, email: u.email },
        count: u.count,
      }));

      const topContributors = topContributorsResult.map((u) => ({
        user: { id: u.id, name: u.name, email: u.email },
        amount: u.amount || 0,
      }));

      res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalPlans,
          pendingApprovals,
          dailyCollections,
          adminEarnings: feeEarnings + penaltyEarnings,
          feeEarnings,
          penaltyEarnings,
          defaulters,
          topContributors,
          recentPendingSubmissions,
        }
      });
    } catch (error: any) {
      logger.error("Get admin dashboard error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/users/:id
   * Fetch specific user deep profile with pre-computed financial stats
   */
  static async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      if (!id || id === 'undefined') {
        res.status(400).json({ success: false, error: "Invalid user ID" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          isSuspended: true,
          createdAt: true,
          bankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
              accountName: true,
            }
          },
          plans: {
            include: {
              contributions: { orderBy: { date: "asc" } },
              withdrawals: { orderBy: { createdAt: "desc" } }
            }
          }
        }
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }

      // Pre-compute financial stats server-side so frontend doesn't need complex math
      let totalSaved = 0;
      let totalBusinessFees = 0;
      let pendingWithdrawals = 0;
      let completedWithdrawals = 0;
      let totalWithdrawn = 0;
      let approvedContributions = 0;
      let pendingContributions = 0;
      let missedContributions = 0;

      const allWithdrawals: any[] = [];

      for (const plan of user.plans) {
        for (const contrib of plan.contributions) {
          if (contrib.status === 'APPROVED') {
            if (contrib.allocationType === 'BUSINESS_FEE') {
              totalBusinessFees += contrib.amount;
            } else {
              totalSaved += contrib.amount;
            }
            approvedContributions++;
          } else if (contrib.status === 'PENDING') {
            pendingContributions++;
          } else if (contrib.status === 'MISSED' || contrib.status === 'UNPAID') {
            missedContributions++;
          }
        }

        for (const withdrawal of plan.withdrawals) {
          allWithdrawals.push({
            ...withdrawal,
            planDailyAmount: plan.dailyAmount,
            planDurationMonths: plan.durationMonths,
          });
          if (withdrawal.status === 'PENDING' || withdrawal.status === 'ACCEPTED' || withdrawal.status === 'PROCESSING') {
            pendingWithdrawals += withdrawal.amount;
          } else if (withdrawal.status === 'COMPLETED') {
            completedWithdrawals += withdrawal.amount;
            totalWithdrawn += withdrawal.amount;
          }
        }
      }

      const availableBalance = totalSaved - totalWithdrawn - pendingWithdrawals;

      res.status(200).json({
        success: true,
        user,
        stats: {
          totalSaved,
          totalBusinessFees,
          availableBalance: Math.max(0, availableBalance),
          pendingWithdrawals,
          completedWithdrawals,
          approvedContributions,
          pendingContributions,
          missedContributions,
          totalPlans: user.plans.length,
          activePlans: user.plans.filter(p => p.isActive).length,
        },
        withdrawals: allWithdrawals,
      });
    } catch (error: any) {
      logger.error("Get admin user by ID error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * PATCH /api/admin/users/bulk
   * Bulk updates verification or suspension status for users
   */
  static async bulkUpdateUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userIds, action } = req.body;
      if (!userIds || !Array.isArray(userIds) || !action) {
        res.status(400).json({ success: false, error: 'Invalid payload' });
        return;
      }

      if (!['verify', 'suspend', 'unsuspend'].includes(action)) {
        res.status(400).json({ success: false, error: 'Unsupported bulk action' });
        return;
      }

      const updateData =
        action === 'verify'
          ? { isVerified: true }
          : action === 'suspend'
            ? { isSuspended: true }
            : { isSuspended: false };

      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: updateData
      });

      const actionLabel =
        action === 'verify' ? 'verified' : action === 'suspend' ? 'suspended' : 're-activated';

      res.status(200).json({ success: true, message: `Successfully ${actionLabel} ${userIds.length} users.` });
    } catch (error: any) {
      logger.error("Bulk update users error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}
