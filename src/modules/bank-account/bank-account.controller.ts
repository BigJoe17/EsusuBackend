import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import prisma from "../../utils/prisma";
import { logger } from "../../utils/logger";

export class BankAccountController {
  /**
   * POST /api/bank-account
   * Create or update the authenticated user's bank account details.
   */
  static async upsertBankAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bankName, accountNumber, accountName } = req.body;

      if (!bankName || !accountNumber || !accountName) {
        res.status(400).json({
          success: false,
          error: "bankName, accountNumber, and accountName are required",
        });
        return;
      }

      if (accountNumber.length < 10 || accountNumber.length > 11) {
        res.status(400).json({
          success: false,
          error: "Account number must be 10-11 digits",
        });
        return;
      }

      const bankAccount = await prisma.bankAccount.upsert({
        where: { userId: req.user!.userId },
        update: { bankName, accountNumber, accountName },
        create: { userId: req.user!.userId, bankName, accountNumber, accountName },
      });

      logger.info("Bank account saved", { userId: req.user!.userId });
      res.status(200).json({ success: true, bankAccount });
    } catch (error: any) {
      logger.error("Upsert bank account error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * GET /api/bank-account
   * Get the authenticated user's bank account.
   */
  static async getBankAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { userId: req.user!.userId },
      });

      res.status(200).json({ success: true, bankAccount: bankAccount || null });
    } catch (error: any) {
      logger.error("Get bank account error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * DELETE /api/bank-account
   * Remove the user's saved bank account.
   */
  static async deleteBankAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await prisma.bankAccount.deleteMany({
        where: { userId: req.user!.userId },
      });

      res.status(200).json({ success: true, message: "Bank account removed" });
    } catch (error: any) {
      logger.error("Delete bank account error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}
