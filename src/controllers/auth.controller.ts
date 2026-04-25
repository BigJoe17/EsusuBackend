import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import prisma from "../utils/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  validateRegistration,
  validateLogin,
  validateOtpVerification,
} from "../utils/validation";
import { AuthorizationError, ValidationError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";
import bcrypt from "bcrypt";

export class AuthController {
  /**
   * POST /api/auth/register
   * Register a new user and send OTP.
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateRegistration(req.body);
      if (!validation.valid) {
        throw new ValidationError("Validation failed", validation.errors);
      }

      const { email, password, name } = req.body;

      const result = await AuthService.register({ email, password, name });
      logger.info("User registered successfully", { email });
      res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error.message === "User already exists with this email") {
        logger.warn("Registration attempted with existing email", {
          email: req.body?.email,
        });
        res.status(409).json({ success: false, error: error.message });
      } else if (error instanceof AuthorizationError) {
        res.status(403).json({ success: false, error: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message, errors: error.errors });
      } else {
        logger.error("Register error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * POST /api/auth/login
   * Login with email + password. Returns JWT directly (or OTP prompt if unverified).
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateLogin(req.body);
      if (!validation.valid) {
        throw new ValidationError("Validation failed", validation.errors);
      }

      const { email, password } = req.body;

      const result = await AuthService.login({ email, password });
      logger.info("User login processed", { email });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error.message === "Invalid credentials") {
        logger.warn("Invalid login attempt", { email: req.body?.email });
        res.status(401).json({ success: false, error: error.message });
      } else if (error.message === "Account suspended") {
        logger.warn("Suspended login attempt blocked", { email: req.body?.email });
        res.status(403).json({ success: false, error: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message, errors: error.errors });
      } else {
        logger.error("Login error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * POST /api/auth/verify-otp
   * Verify OTP and issue JWT token (used after registration).
   */
  static async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateOtpVerification(req.body);
      if (!validation.valid) {
        throw new ValidationError("Validation failed", validation.errors);
      }

      const { email, otp } = req.body;

      const result = await AuthService.verifyOtp({ email, otp });
      logger.info("OTP verified successfully", { email });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      const clientErrors = [
        "User not found",
        "OTP expired or not found. Please request a new one.",
        "Invalid OTP code",
        "Account suspended",
      ];

      if (clientErrors.includes(error.message)) {
        logger.warn("OTP verification failed", { email: req.body?.email, reason: error.message });
        res.status(400).json({ success: false, error: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message, errors: error.errors });
      } else {
        logger.error("Verify OTP error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * POST /api/auth/resend-otp
   * Resend a new OTP to the user's email.
   */
  static async resendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        throw new ValidationError("Email is required", [
          { field: "email", message: "Email is required" },
        ]);
      }

      const result = await AuthService.resendOtp(email);
      logger.info("OTP resent successfully", { email });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error.message === "User not found") {
        logger.warn("Resend OTP for non-existent user", { email: req.body?.email });
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message === "Account suspended") {
        logger.warn("Suspended resend OTP attempt blocked", { email: req.body?.email });
        res.status(403).json({ success: false, error: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message, errors: error.errors });
      } else {
        logger.error("Resend OTP error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }

  /**
   * GET /api/auth/me
   * Get the authenticated user's profile.
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, name: true, email: true, role: true, isVerified: true, isSuspended: true, createdAt: true },
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }

      res.status(200).json({ success: true, user });
    } catch (error: any) {
      logger.error("Get profile error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * PATCH /api/auth/change-password
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.userId;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, error: "Missing password parameters" });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
         res.status(400).json({ success: false, error: "Invalid current password" });
         return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      logger.error("Change password error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * POST /api/auth/push-token
   * Save or update the authenticated user's Expo push token.
   */
  static async savePushToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        res.status(400).json({ success: false, error: "Push token is required" });
        return;
      }

      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { expoPushToken: token },
      });

      logger.info("Push token saved", { userId: req.user!.userId });
      res.status(200).json({ success: true, message: "Push token saved" });
    } catch (error: any) {
      logger.error("Save push token error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Sends a password reset OTP to the user's email.
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ success: false, error: "Email is required" });
        return;
      }

      const result = await AuthService.forgotPassword(email);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      // Always return 200 to avoid email enumeration
      logger.warn("Forgot password attempt:", error);
      res.status(200).json({
        success: true,
        message: "If an account with that email exists, a reset code has been sent.",
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Verifies the reset OTP and sets the new password.
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        res.status(400).json({ success: false, error: "email, otp, and newPassword are required" });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
        return;
      }

      const result = await AuthService.resetPassword({ email, otp, newPassword });
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      const clientErrors = ["User not found", "OTP expired or not found. Please request a new one.", "Invalid OTP code"];
      if (clientErrors.includes(error.message)) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        logger.error("Reset password error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  }
}
