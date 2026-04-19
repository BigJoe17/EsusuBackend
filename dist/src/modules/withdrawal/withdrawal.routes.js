"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const withdrawal_controller_1 = require("./withdrawal.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
// All withdrawal routes require authentication
router.use(auth_middleware_1.authenticateToken);
// User routes
router.post("/request", withdrawal_controller_1.WithdrawalController.requestWithdrawal);
// Admin-only
router.patch("/:id/approve", role_middleware_1.requireAdmin, withdrawal_controller_1.WithdrawalController.approveWithdrawal);
router.patch("/:id/reject", role_middleware_1.requireAdmin, withdrawal_controller_1.WithdrawalController.rejectWithdrawal);
exports.default = router;
