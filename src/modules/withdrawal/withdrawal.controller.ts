import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { WithdrawalService } from "./withdrawal.service";
import { logger } from "../../utils/logger";

export class WithdrawalController {
  /**
   * POST /api/withdrawals/request
   */
  static async requestWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { planId, amount } = req.body;

      if (!planId || !amount) {
        res.status(400).json({
          success: false,
          error: "planId and amount are required",
        });
        return;
      }

      const withdrawal = await WithdrawalService.requestWithdrawal(
        req.user!.userId,
        planId,
        parseFloat(amount)
      );

      res.status(201).json({
        success: true,
        message: "Withdrawal request submitted. Awaiting admin approval.",
        withdrawal,
      });
    } catch (error: any) {
      const clientErrors = [
        "Plan not found",
        "do not own",
        "must be greater",
        "Insufficient balance",
      ];
      if (clientErrors.some((msg) => error.message?.includes(msg))) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Request withdrawal error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * PATCH /api/withdrawals/:id/approve
   */
  static async approveWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const withdrawal = await WithdrawalService.approveWithdrawal(id);

      res.status(200).json({
        success: true,
        message: "Withdrawal approved",
        withdrawal,
      });
    } catch (error: any) {
      if (error.message === "Withdrawal not found") {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message?.includes("already")) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Approve withdrawal error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * PATCH /api/withdrawals/:id/reject
   */
  static async rejectWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const withdrawal = await WithdrawalService.rejectWithdrawal(id);

      res.status(200).json({
        success: true,
        message: "Withdrawal rejected",
        withdrawal,
      });
    } catch (error: any) {
      if (error.message === "Withdrawal not found") {
        res.status(404).json({ success: false, error: error.message });
      } else {
        logger.error("Reject withdrawal error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }
}
