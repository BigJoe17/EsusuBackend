"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanController = void 0;
const plan_service_1 = require("./plan.service");
const logger_1 = require("../../utils/logger");
class PlanController {
    /**
     * POST /api/plans/create
     */
    static async createPlan(req, res) {
        try {
            const { dailyAmount, durationMonths } = req.body;
            if (!dailyAmount || !durationMonths) {
                res.status(400).json({
                    success: false,
                    error: "dailyAmount and durationMonths are required",
                });
                return;
            }
            const plan = await plan_service_1.PlanService.createPlan(req.user.userId, {
                dailyAmount: parseFloat(dailyAmount),
                durationMonths: parseInt(durationMonths),
            });
            res.status(201).json({
                success: true,
                message: "Savings plan created successfully",
                plan,
            });
        }
        catch (error) {
            const clientErrors = ["Duration must be", "Daily amount must be"];
            if (clientErrors.some((msg) => error.message?.includes(msg))) {
                res.status(400).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Create plan error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * GET /api/plans/user
     */
    static async getUserPlans(req, res) {
        try {
            const plans = await plan_service_1.PlanService.getUserPlans(req.user.userId);
            res.status(200).json({ success: true, plans });
        }
        catch (error) {
            logger_1.logger.error("Get user plans error:", error);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
    /**
     * GET /api/plans/:id/schedule
     */
    static async getPlanSchedule(req, res) {
        try {
            const id = req.params.id;
            const isAdmin = req.user.role === "ADMIN";
            const schedule = await plan_service_1.PlanService.getPlanSchedule(id, isAdmin ? undefined : req.user.userId);
            res.status(200).json({ success: true, ...schedule });
        }
        catch (error) {
            if (error.message === "Plan not found") {
                res.status(404).json({ success: false, error: error.message });
            }
            else if (error.message?.includes("do not have access")) {
                res.status(403).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Get plan schedule error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * POST /api/plans/generate-daily (admin or cron trigger)
     */
    static async generateDaily(req, res) {
        try {
            const result = await plan_service_1.PlanService.generateDailyContributions();
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            logger_1.logger.error("Generate daily contributions error:", error);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
}
exports.PlanController = PlanController;
