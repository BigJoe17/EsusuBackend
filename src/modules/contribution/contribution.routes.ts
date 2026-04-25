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
router.get("/submissions/my", ContributionController.getUserPaymentSubmissions as any);

// Admin-only: payment submission queue + approve/reject
router.get("/submissions", requireAdmin as any, ContributionController.getAdminPaymentSubmissions as any);
router.patch("/submissions/:id/approve", requireAdmin as any, ContributionController.approveContribution as any);
router.patch("/submissions/:id/reject", requireAdmin as any, ContributionController.rejectContribution as any);

export default router;
