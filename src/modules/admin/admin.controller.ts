import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { ContributionService } from "../contribution/contribution.service";
import { WithdrawalService } from "../withdrawal/withdrawal.service";
import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";

export class AdminController {
  /**
   * GET /api/admin/users
   */
  static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: { plans: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json({ success: true, users });
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
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const plans = await prisma.savingsPlan.findMany({
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
      });

      res.status(200).json({ success: true, plans });
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
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const contributions = await prisma.contribution.findMany({
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
        },
      });

      res.status(200).json({ success: true, contributions });
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
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const withdrawals = await prisma.withdrawal.findMany({
        where,
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

      res.status(200).json({ success: true, withdrawals });
    } catch (error: any) {
      logger.error("Get admin withdrawals error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/earnings
   * Calculate total admin earnings across all plans.
   * Admin earns 1 day per completed 31-day cycle.
   */
  static async getEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const plans = await prisma.savingsPlan.findMany({
        include: {
          _count: { select: { contributions: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      let totalAdminEarnings = 0;
      const planEarnings = plans.map((plan) => {
        const daysSoFar = Math.floor(
          (Date.now() - plan.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const completedCycles = Math.floor(daysSoFar / plan.cycleLength);
        const earnings = completedCycles * plan.dailyAmount;
        totalAdminEarnings += earnings;

        return {
          planId: plan.id,
          user: plan.user,
          dailyAmount: plan.dailyAmount,
          durationMonths: plan.durationMonths,
          completedCycles,
          adminEarnings: earnings,
          status: plan.status,
        };
      });

      // Total future earnings projection
      const activePlans = plans.filter((p) => p.isActive);
      let projectedTotalEarnings = 0;
      for (const plan of activePlans) {
        const totalCycles = Math.floor((plan.durationMonths * 31) / plan.cycleLength);
        projectedTotalEarnings += totalCycles * plan.dailyAmount;
      }

      res.status(200).json({
        success: true,
        totalAdminEarnings,
        projectedTotalEarnings,
        activePlansCount: activePlans.length,
        totalPlansCount: plans.length,
        breakdown: planEarnings,
      });
    } catch (error: any) {
      logger.error("Get admin earnings error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/dashboard
   * Consolidated insights: Earnings, Defaulters, Top Contributors, Daily Collections
   */
  static async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const todayString = new Date().toISOString().split("T")[0];
      
      const [users, plans, contributions] = await Promise.all([
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
        prisma.savingsPlan.findMany({ include: { user: true } }),
        prisma.contribution.findMany({ include: { plan: { include: { user: true } } } })
      ]);

      // Daily Collections (Sum of TODAY's APPROVED components)
      const dailyCollections = contributions
        .filter(c => c.status === "APPROVED" && c.date.toISOString().split("T")[0] === todayString)
        .reduce((sum, c) => sum + c.amount, 0);
        
      const pendingApprovals = contributions.filter(c => c.status === "PENDING").length;

      // Defaulters (Users grouped by MISSED + UNPAID count)
      const userDefaulters = new Map<string, { user: any, count: number }>();
      // Top Contributors (Users grouped by APPROVED total amount)
      const userContributors = new Map<string, { user: any, amount: number }>();

      for(const c of contributions) {
        const userId = c.plan?.user?.id;
        if(!userId) continue;

        // If today or past, and UNPAID/MISSED, count as defaulter strike
        if ((c.status === "MISSED" || c.status === "UNPAID") && c.date <= new Date()) {
          const entry = userDefaulters.get(userId) || { user: c.plan.user, count: 0 };
          entry.count += 1;
          userDefaulters.set(userId, entry);
        }

        if (c.status === "APPROVED") {
          const entry = userContributors.get(userId) || { user: c.plan.user, amount: 0 };
          entry.amount += c.amount;
          userContributors.set(userId, entry);
        }
      }

      // Sort
      const defaulters = Array.from(userDefaulters.values())
        .filter(u => u.count > 0)
        .sort((a,b) => b.count - a.count)
        .slice(0, 5); // top 5
        
      const topContributors = Array.from(userContributors.values())
        .sort((a,b) => b.amount - a.amount)
        .slice(0, 5); // top 5

      // Earnings logic (same as /earnings)
      let adminEarnings = 0;
      plans.forEach(plan => {
         const daysSoFar = Math.floor((Date.now() - plan.startDate.getTime()) / (1000 * 60 * 60 * 24));
         // Only apply earnings to valid cycles
         if (daysSoFar > 0) {
           const completedCycles = Math.floor(daysSoFar / plan.cycleLength);
           adminEarnings += completedCycles * plan.dailyAmount;
         }
      });

      res.status(200).json({
        success: true,
        data: {
          totalUsers: users.length,
          pendingApprovals,
          dailyCollections,
          adminEarnings,
          defaulters,
          topContributors
        }
      });
    } catch (error: any) {
      logger.error("Get admin dashboard error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/admin/users/:id
   * Fetch specific user deep profile
   */
  static async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true, email: true, name: true, isVerified: true, createdAt: true,
          plans: {
            include: {
              contributions: { orderBy: { date: "asc" } },
              withdrawals: { orderBy: { createdAt: "desc" } }
            }
          }
        }
      });
      if(!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }
      res.status(200).json({ success: true, user });
    } catch (error: any) {
      logger.error("Get admin user by ID error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * PATCH /api/admin/users/bulk
   * Bulk suspends or verifies users
   */
  static async bulkUpdateUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userIds, action } = req.body;
      if (!userIds || !Array.isArray(userIds) || !action) {
        res.status(400).json({ success: false, error: 'Invalid payload' });
        return;
      }

      const isVerified = action === 'verify';

      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { isVerified }
      });

      res.status(200).json({ success: true, message: `Successfully updated ${userIds.length} users.` });
    } catch (error: any) {
      logger.error("Bulk update users error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}
