"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (no auth required)
router.post("/register", auth_controller_1.AuthController.register);
router.post("/login", auth_controller_1.AuthController.login);
router.post("/verify-otp", auth_controller_1.AuthController.verifyOtp);
router.post("/resend-otp", auth_controller_1.AuthController.resendOtp);
// Protected routes (JWT required)
router.get("/me", auth_middleware_1.authenticateToken, auth_controller_1.AuthController.getProfile);
router.patch("/change-password", auth_middleware_1.authenticateToken, auth_controller_1.AuthController.changePassword);
exports.default = router;
