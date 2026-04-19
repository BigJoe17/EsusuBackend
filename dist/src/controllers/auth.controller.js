"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const prisma_1 = __importDefault(require("../utils/prisma"));
const validation_1 = require("../utils/validation");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
const bcrypt_1 = __importDefault(require("bcrypt"));
class AuthController {
    /**
     * POST /api/auth/register
     * Register a new user and send OTP.
     */
    static async register(req, res) {
        try {
            const validation = (0, validation_1.validateRegistration)(req.body);
            if (!validation.valid) {
                throw new error_middleware_1.ValidationError("Validation failed", validation.errors);
            }
            const { email, password, name } = req.body;
            const result = await auth_service_1.AuthService.register({ email, password, name });
            logger_1.logger.info("User registered successfully", { email });
            res.status(201).json({
                success: true,
                ...result,
            });
        }
        catch (error) {
            if (error.message === "User already exists with this email") {
                logger_1.logger.warn("Registration attempted with existing email", {
                    email: req.body?.email,
                });
                res.status(409).json({ success: false, error: error.message });
            }
            else if (error instanceof error_middleware_1.ValidationError) {
                res.status(400).json({ success: false, error: error.message, errors: error.errors });
            }
            else {
                logger_1.logger.error("Register error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * POST /api/auth/login
     * Login with email + password. Returns JWT directly (or OTP prompt if unverified).
     */
    static async login(req, res) {
        try {
            const validation = (0, validation_1.validateLogin)(req.body);
            if (!validation.valid) {
                throw new error_middleware_1.ValidationError("Validation failed", validation.errors);
            }
            const { email, password } = req.body;
            const result = await auth_service_1.AuthService.login({ email, password });
            logger_1.logger.info("User login processed", { email });
            res.status(200).json({
                success: true,
                ...result,
            });
        }
        catch (error) {
            if (error.message === "Invalid credentials") {
                logger_1.logger.warn("Invalid login attempt", { email: req.body?.email });
                res.status(401).json({ success: false, error: error.message });
            }
            else if (error instanceof error_middleware_1.ValidationError) {
                res.status(400).json({ success: false, error: error.message, errors: error.errors });
            }
            else {
                logger_1.logger.error("Login error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * POST /api/auth/verify-otp
     * Verify OTP and issue JWT token (used after registration).
     */
    static async verifyOtp(req, res) {
        try {
            const validation = (0, validation_1.validateOtpVerification)(req.body);
            if (!validation.valid) {
                throw new error_middleware_1.ValidationError("Validation failed", validation.errors);
            }
            const { email, otp } = req.body;
            const result = await auth_service_1.AuthService.verifyOtp({ email, otp });
            logger_1.logger.info("OTP verified successfully", { email });
            res.status(200).json({
                success: true,
                ...result,
            });
        }
        catch (error) {
            const clientErrors = [
                "User not found",
                "OTP expired or not found. Please request a new one.",
                "Invalid OTP code",
            ];
            if (clientErrors.includes(error.message)) {
                logger_1.logger.warn("OTP verification failed", { email: req.body?.email, reason: error.message });
                res.status(400).json({ success: false, error: error.message });
            }
            else if (error instanceof error_middleware_1.ValidationError) {
                res.status(400).json({ success: false, error: error.message, errors: error.errors });
            }
            else {
                logger_1.logger.error("Verify OTP error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * POST /api/auth/resend-otp
     * Resend a new OTP to the user's email.
     */
    static async resendOtp(req, res) {
        try {
            const { email } = req.body;
            if (!email || typeof email !== "string") {
                throw new error_middleware_1.ValidationError("Email is required", [
                    { field: "email", message: "Email is required" },
                ]);
            }
            const result = await auth_service_1.AuthService.resendOtp(email);
            logger_1.logger.info("OTP resent successfully", { email });
            res.status(200).json({
                success: true,
                ...result,
            });
        }
        catch (error) {
            if (error.message === "User not found") {
                logger_1.logger.warn("Resend OTP for non-existent user", { email: req.body?.email });
                res.status(404).json({ success: false, error: error.message });
            }
            else if (error instanceof error_middleware_1.ValidationError) {
                res.status(400).json({ success: false, error: error.message, errors: error.errors });
            }
            else {
                logger_1.logger.error("Resend OTP error:", error);
                res.status(500).json({ success: false, error: "Internal server error" });
            }
        }
    }
    /**
     * GET /api/auth/me
     * Get the authenticated user's profile.
     */
    static async getProfile(req, res) {
        try {
            const user = await prisma_1.default.user.findUnique({
                where: { id: req.user.userId },
                select: { id: true, name: true, email: true, role: true, isVerified: true, createdAt: true },
            });
            if (!user) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }
            res.status(200).json({ success: true, user });
        }
        catch (error) {
            logger_1.logger.error("Get profile error:", error);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
    /**
     * PATCH /api/auth/change-password
     */
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.userId;
            if (!currentPassword || !newPassword) {
                res.status(400).json({ success: false, error: "Missing password parameters" });
                return;
            }
            const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
            if (!user) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }
            const isMatch = await bcrypt_1.default.compare(currentPassword, user.password);
            if (!isMatch) {
                res.status(400).json({ success: false, error: "Invalid current password" });
                return;
            }
            const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
            await prisma_1.default.user.update({
                where: { id: userId },
                data: { password: hashedPassword }
            });
            res.status(200).json({ success: true, message: "Password updated successfully" });
        }
        catch (error) {
            logger_1.logger.error("Change password error:", error);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
}
exports.AuthController = AuthController;
