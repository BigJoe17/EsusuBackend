import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { PlanService } from "./plan.service";
import { logger } from "../../utils/logger";

export class PlanController {
  /**
   * POST /api/plans/create
   */
  static async createPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dailyAmount, durationMonths } = req.body;

      if (!dailyAmount || !durationMonths) {
        res.status(400).json({
          success: false,
          error: "dailyAmount and durationMonths are required",
        });
        return;
      }

      const plan = await PlanService.createPlan(req.user!.userId, {
        dailyAmount: parseFloat(dailyAmount),
        durationMonths: parseInt(durationMonths),
      });

      res.status(201).json({
        success: true,
        message: "Savings plan created successfully",
        plan,
      });
    } catch (error: any) {
      const clientErrors = ["Duration must be", "Daily amount must be"];
      if (clientErrors.some((msg) => error.message?.includes(msg))) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Create plan error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * GET /api/plans/user
   */
  static async getUserPlans(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const plans = await PlanService.getUserPlans(req.user!.userId);
      res.status(200).json({ success: true, plans });
    } catch (error: any) {
      logger.error("Get user plans error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/plans/:id/schedule
   */
  static async getPlanSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const isAdmin = req.user!.role === "ADMIN";
      const schedule = await PlanService.getPlanSchedule(id, isAdmin ? undefined : req.user!.userId);
      res.status(200).json({ success: true, ...schedule });
    } catch (error: any) {
      if (error.message === "Plan not found") {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message?.includes("do not have access")) {
        res.status(403).json({ success: false, error: error.message });
      } else {
        logger.error("Get plan schedule error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * POST /api/plans/generate-daily (admin or cron trigger)
   */
  static async generateDaily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await PlanService.generateDailyContributions();
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      logger.error("Generate daily contributions error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}
