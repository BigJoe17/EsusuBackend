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

// Admin-only transitions
router.patch("/:id/accept", requireAdmin as any, WithdrawalController.acceptWithdrawal as any);
router.patch("/:id/process", requireAdmin as any, WithdrawalController.processWithdrawal as any);
router.patch("/:id/ready-for-pickup", requireAdmin as any, WithdrawalController.markReadyForPickup as any);
router.patch("/:id/transfer-sent", requireAdmin as any, WithdrawalController.markTransferSent as any);
router.patch("/:id/complete", requireAdmin as any, WithdrawalController.completeWithdrawal as any);
router.patch("/:id/hold", requireAdmin as any, WithdrawalController.holdWithdrawal as any);
router.patch("/:id/reject", requireAdmin as any, WithdrawalController.rejectWithdrawal as any);

export default router;
