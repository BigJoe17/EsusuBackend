import { Router } from "express";
import { WithdrawalController } from "./withdrawal.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";

const router = Router();

// All withdrawal routes require authentication
router.use(authenticateToken as any);

// User routes
router.get("/my", WithdrawalController.getMyWithdrawals as any);
router.post("/request", WithdrawalController.requestWithdrawal as any);

// Admin-only
router.patch("/:id/approve", requireAdmin as any, WithdrawalController.approveWithdrawal as any);
router.patch("/:id/reject", requireAdmin as any, WithdrawalController.rejectWithdrawal as any);

export default router;
