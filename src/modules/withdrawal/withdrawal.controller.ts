import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { WithdrawalService } from "./withdrawal.service";
import { logger } from "../../utils/logger";

export class WithdrawalController {
  static async getMyWithdrawals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const withdrawals = await WithdrawalService.getUserWithdrawals(req.user!.userId);
      res.status(200).json({ success: true, withdrawals });
    } catch (error: any) {
      logger.error("Get my withdrawals error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  static async requestWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { planId, amount, method } = req.body;

      if (!planId || !amount) {
        res.status(400).json({ success: false, error: "planId and amount are required" });
        return;
      }

      const withdrawal = await WithdrawalService.requestWithdrawal(
        req.user!.userId,
        planId,
        parseFloat(amount),
        method?.toUpperCase() || "TRANSFER"
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
        "bank account first"
      ];
      if (clientErrors.some((msg) => error.message?.includes(msg))) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Request withdrawal error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  static async acceptWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const withdrawal = await WithdrawalService.acceptWithdrawal(req.params.id as string);
      res.status(200).json({ success: true, message: "Withdrawal accepted", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }

  static async processWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const withdrawal = await WithdrawalService.processWithdrawal(req.params.id as string);
      res.status(200).json({ success: true, message: "Withdrawal processing", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }

  static async markReadyForPickup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const withdrawal = await WithdrawalService.markReadyForPickup(req.params.id as string);
      res.status(200).json({ success: true, message: "Marked ready for pickup", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }

  static async markTransferSent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reference } = req.body;
      const withdrawal = await WithdrawalService.markTransferSent(req.params.id as string, reference);
      res.status(200).json({ success: true, message: "Transfer marked as sent", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }

  static async completeWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { otp } = req.body;
      const withdrawal = await WithdrawalService.completeWithdrawal(req.params.id as string, otp);
      res.status(200).json({ success: true, message: "Withdrawal completed", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }

  static async holdWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { note } = req.body;
      const withdrawal = await WithdrawalService.holdWithdrawal(req.params.id as string, note);
      res.status(200).json({ success: true, message: "Withdrawal placed on hold", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }

  static async rejectWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reason } = req.body;
      const withdrawal = await WithdrawalService.rejectWithdrawal(req.params.id as string, reason);
      res.status(200).json({ success: true, message: "Withdrawal rejected", withdrawal });
    } catch (error: any) {
      res.status(error.message.includes("not found") ? 404 : 400).json({ success: false, error: error.message });
    }
  }
}
