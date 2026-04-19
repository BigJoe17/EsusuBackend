import { Router } from "express";
import { PlanController } from "./plan.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";

const router = Router();

// All plan routes require authentication
router.use(authenticateToken as any);

// User routes
router.post("/create", PlanController.createPlan as any);
router.get("/user", PlanController.getUserPlans as any);
router.get("/:id/schedule", PlanController.getPlanSchedule as any);

// Admin-only: trigger daily contribution generation
router.post("/generate-daily", requireAdmin as any, PlanController.generateDaily as any);

export default router;
