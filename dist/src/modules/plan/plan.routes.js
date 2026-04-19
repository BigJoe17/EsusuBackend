"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plan_controller_1 = require("./plan.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
// All plan routes require authentication
router.use(auth_middleware_1.authenticateToken);
// User routes
router.post("/create", plan_controller_1.PlanController.createPlan);
router.get("/user", plan_controller_1.PlanController.getUserPlans);
router.get("/:id/schedule", plan_controller_1.PlanController.getPlanSchedule);
// Admin-only: trigger daily contribution generation
router.post("/generate-daily", role_middleware_1.requireAdmin, plan_controller_1.PlanController.generateDaily);
exports.default = router;
