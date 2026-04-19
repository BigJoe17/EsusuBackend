import { Router } from "express";
import { ContributionController } from "./contribution.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";

const router = Router();

// All contribution routes require authentication
router.use(authenticateToken as any);

// User routes
router.post("/pay", ContributionController.payContribution as any);
router.get("/my", ContributionController.getUserContributions as any);

// Admin-only: single approve/reject
router.patch("/:id/approve", requireAdmin as any, ContributionController.approveContribution as any);
router.patch("/:id/reject", requireAdmin as any, ContributionController.rejectContribution as any);

// Admin-only: batch approve/reject
router.patch("/batch/:batchId/approve", requireAdmin as any, ContributionController.approveBatch as any);
router.patch("/batch/:batchId/reject", requireAdmin as any, ContributionController.rejectBatch as any);

export default router;
