"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contribution_controller_1 = require("./contribution.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
// All contribution routes require authentication
router.use(auth_middleware_1.authenticateToken);
// User routes
router.post("/pay", contribution_controller_1.ContributionController.payContribution);
router.get("/my", contribution_controller_1.ContributionController.getUserContributions);
// Admin-only: single approve/reject
router.patch("/:id/approve", role_middleware_1.requireAdmin, contribution_controller_1.ContributionController.approveContribution);
router.patch("/:id/reject", role_middleware_1.requireAdmin, contribution_controller_1.ContributionController.rejectContribution);
// Admin-only: batch approve/reject
router.patch("/batch/:batchId/approve", role_middleware_1.requireAdmin, contribution_controller_1.ContributionController.approveBatch);
router.patch("/batch/:batchId/reject", role_middleware_1.requireAdmin, contribution_controller_1.ContributionController.rejectBatch);
exports.default = router;
