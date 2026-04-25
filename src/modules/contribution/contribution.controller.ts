import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { ContributionService } from "./contribution.service";
import { PaymentSubmissionService } from "./payment-submission.service";
import { ContributionAllocationService } from "./contribution-allocation.service";
import { logger } from "../../utils/logger";

export class ContributionController {
  /**
   * POST /api/contributions/pay
   * User submits a payment request for admin review.
   */
  static async payContribution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { planId, amount, method, proofUrl, reference, selectedStartDate } = req.body;

      if (!planId) {
        res.status(400).json({ success: false, error: "planId is required" });
        return;
      }

      if (!amount) {
        res.status(400).json({ success: false, error: "amount is required" });
        return;
      }

      if (!method) {
        res.status(400).json({ success: false, error: "method is required" });
        return;
      }

      if (!selectedStartDate) {
        res.status(400).json({ success: false, error: "selectedStartDate is required" });
        return;
      }

      const submission = await PaymentSubmissionService.createSubmission(req.user!.userId, planId, {
        amount: parseFloat(amount),
        method: method?.toUpperCase(),
        proofUrl,
        reference,
        selectedStartDate: new Date(selectedStartDate),
      });

      res.status(201).json({
        success: true,
        message: `${submission.daysCovered} day${submission.daysCovered > 1 ? "s" : ""} submitted for review. Awaiting admin verification.`,
        submission,
      });
    } catch (error: any) {
      const clientErrors = [
        "Plan not found",
        "do not own",
        "no longer active",
        "outside the plan",
        "must be divisible",
        "must be greater",
        "Payment proof is required",
        "valid start date is required",
      ];

      if (clientErrors.some((msg) => error.message?.includes(msg))) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Create payment submission error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * PATCH /api/contributions/submissions/:id/approve
   */
  static async approveContribution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await ContributionAllocationService.approveSubmission(id, req.user!.userId);

      res.status(200).json({
        success: true,
        message: `${result.allocatedContributions.length} contribution day${result.allocatedContributions.length !== 1 ? "s" : ""} allocated successfully`,
        ...result,
      });
    } catch (error: any) {
      // Detailed logging for debugging 500 errors
      logger.error(`Approve payment submission error [${req.params.id}]:`, {
        message: error.message,
        stack: error.stack,
        userId: req.user?.userId
      });

      if (error.message === "Payment submission not found") {
        res.status(404).json({ success: false, error: error.message });
      } else if (
        error.message?.includes("already") ||
        error.message?.includes("Not enough payable") ||
        error.message?.includes("outside the plan")
      ) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: "Internal server error: " + error.message });
      }
    }
  }

  /**
   * PATCH /api/contributions/submissions/:id/reject
   */
  static async rejectContribution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const submission = await ContributionAllocationService.rejectSubmission(id, req.user!.userId, reason);

      res.status(200).json({
        success: true,
        message: "Payment submission rejected",
        submission,
      });
    } catch (error: any) {
      if (error.message === "Payment submission not found") {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message?.includes("already")) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Reject payment submission error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * GET /api/contributions/my
   */
  static async getUserContributions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const planId = req.query.planId as string | undefined;
      const contributions = await ContributionService.getUserContributions(req.user!.userId, planId);
      res.status(200).json({ success: true, contributions });
    } catch (error: any) {
      logger.error("Get user contributions error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/contributions/submissions/my
   */
  static async getUserPaymentSubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const planId = req.query.planId as string | undefined;
      const submissions = await PaymentSubmissionService.getUserSubmissions(req.user!.userId, planId);
      res.status(200).json({ success: true, submissions });
    } catch (error: any) {
      logger.error("Get user payment submissions error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/contributions/submissions?status=PENDING
   */
  static async getAdminPaymentSubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const submissions = await PaymentSubmissionService.getAdminSubmissions(status);
      res.status(200).json({ success: true, submissions });
    } catch (error: any) {
      logger.error("Get admin payment submissions error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}
