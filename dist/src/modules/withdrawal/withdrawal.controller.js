"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalController = void 0;
const withdrawal_service_1 = require("./withdrawal.service");
const logger_1 = require("../../utils/logger");
class WithdrawalController {
    /**
     * POST /api/withdrawals/request
     */
    static async requestWithdrawal(req, res) {
        try {
            const { planId, amount } = req.body;
            if (!planId || !amount) {
                res.status(400).json({
                    success: false,
                    error: "planId and amount are required",
                });
                return;
            }
            const withdrawal = await withdrawal_service_1.WithdrawalService.requestWithdrawal(req.user.userId, planId, parseFloat(amount));
            res.status(201).json({
                success: true,
                message: "Withdrawal request submitted. Awaiting admin approval.",
                withdrawal,
            });
        }
        catch (error) {
            const clientErrors = [
                "Plan not found",
                "do not own",
                "must be greater",
                "Insufficient balance",
            ];
            if (clientErrors.some((msg) => error.message?.includes(msg))) {
                res.status(400).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Request withdrawal error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * PATCH /api/withdrawals/:id/approve
     */
    static async approveWithdrawal(req, res) {
        try {
            const id = req.params.id;
            const withdrawal = await withdrawal_service_1.WithdrawalService.approveWithdrawal(id);
            res.status(200).json({
                success: true,
                message: "Withdrawal approved",
                withdrawal,
            });
        }
        catch (error) {
            if (error.message === "Withdrawal not found") {
                res.status(404).json({ success: false, error: error.message });
            }
            else if (error.message?.includes("already")) {
                res.status(400).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Approve withdrawal error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * PATCH /api/withdrawals/:id/reject
     */
    static async rejectWithdrawal(req, res) {
        try {
            const id = req.params.id;
            const withdrawal = await withdrawal_service_1.WithdrawalService.rejectWithdrawal(id);
            res.status(200).json({
                success: true,
                message: "Withdrawal rejected",
                withdrawal,
            });
        }
        catch (error) {
            if (error.message === "Withdrawal not found") {
                res.status(404).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Reject withdrawal error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
}
exports.WithdrawalController = WithdrawalController;
