"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContributionController = void 0;
const contribution_service_1 = require("./contribution.service");
const logger_1 = require("../../utils/logger");
class ContributionController {
    /**
     * POST /api/contributions/pay
     * User records a payment. Status = PENDING until admin approves.
     *
     * Body: { planId, amount?, method?, proofUrl?, reference? }
     */
    static async payContribution(req, res) {
        try {
            const { planId, amount, method, proofUrl, reference } = req.body;
            if (!planId) {
                res.status(400).json({ success: false, error: "planId is required" });
                return;
            }
            const result = await contribution_service_1.ContributionService.payContribution(req.user.userId, planId, {
                amount: amount ? parseFloat(amount) : undefined,
                method: method?.toUpperCase(),
                proofUrl,
                reference,
            });
            res.status(201).json({
                success: true,
                message: `${result.daysPaid} day${result.daysPaid > 1 ? "s" : ""} recorded. Awaiting admin verification.`,
                ...result,
            });
        }
        catch (error) {
            const clientErrors = [
                "Plan not found", "do not own", "no longer active",
                "outside the plan", "must be divisible", "must be greater",
                "Not enough unpaid",
            ];
            if (clientErrors.some((msg) => error.message?.includes(msg))) {
                res.status(400).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Pay contribution error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * PATCH /api/contributions/:id/approve
     * Admin approves a contribution after verifying payment.
     */
    static async approveContribution(req, res) {
        try {
            const id = req.params.id;
            const contribution = await contribution_service_1.ContributionService.approveContribution(id, req.user.userId);
            res.status(200).json({
                success: true,
                message: "Contribution verified and approved",
                contribution,
            });
        }
        catch (error) {
            if (error.message === "Contribution not found") {
                res.status(404).json({ success: false, error: error.message });
            }
            else if (error.message?.includes("Already")) {
                res.status(400).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Approve contribution error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * PATCH /api/contributions/:id/reject
     * Admin rejects a contribution.
     */
    static async rejectContribution(req, res) {
        try {
            const id = req.params.id;
            const { reason } = req.body;
            const contribution = await contribution_service_1.ContributionService.rejectContribution(id, req.user.userId, reason);
            res.status(200).json({
                success: true,
                message: "Contribution rejected",
                contribution,
            });
        }
        catch (error) {
            if (error.message === "Contribution not found") {
                res.status(404).json({ success: false, error: error.message });
            }
            else if (error.message?.includes("Cannot reject")) {
                res.status(400).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Reject contribution error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * PATCH /api/contributions/batch/:batchId/approve
     * Admin approves all pending contributions in a batch.
     */
    static async approveBatch(req, res) {
        try {
            const batchId = req.params.batchId;
            const result = await contribution_service_1.ContributionService.approveBatch(batchId, req.user.userId);
            res.status(200).json({
                success: true,
                message: `${result.approvedCount} contributions approved`,
                ...result,
            });
        }
        catch (error) {
            if (error.message?.includes("No pending")) {
                res.status(404).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Approve batch error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * PATCH /api/contributions/batch/:batchId/reject
     * Admin rejects all pending contributions in a batch.
     */
    static async rejectBatch(req, res) {
        try {
            const batchId = req.params.batchId;
            const { reason } = req.body;
            const result = await contribution_service_1.ContributionService.rejectBatch(batchId, req.user.userId, reason);
            res.status(200).json({
                success: true,
                message: `${result.rejectedCount} contributions rejected`,
                ...result,
            });
        }
        catch (error) {
            if (error.message?.includes("No pending")) {
                res.status(404).json({ success: false, error: error.message });
            }
            else {
                logger_1.logger.error("Reject batch error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * GET /api/contributions/my
     * Get user's contributions. Optional ?planId= filter.
     */
    static async getUserContributions(req, res) {
        try {
            const planId = req.query.planId;
            const contributions = await contribution_service_1.ContributionService.getUserContributions(req.user.userId, planId);
            res.status(200).json({ success: true, contributions });
        }
        catch (error) {
            logger_1.logger.error("Get user contributions error:", error);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
}
exports.ContributionController = ContributionController;
