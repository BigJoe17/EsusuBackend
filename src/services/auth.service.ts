import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../utils/prisma";
import { generateOtpCode, hashOtp, compareOtp, getOtpExpiry } from "../utils/otp.util";
import { sendOtpEmail, sendPasswordResetEmail } from "../utils/email.util";
import { config } from "../config/env";

import { logger } from "../utils/logger";
import { AuthorizationError, ConflictError } from "../middleware/error.middleware";
import { AppSettingsService } from "./app-settings.service";

const JWT_SECRET = config.JWT_SECRET;
const JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET;

export class AuthService {
  /**
   * Register a new user.
   * Creates the user (unverified), generates OTP, sends via email.
   * User must verify OTP before they can log in.
   */
  static async register(data: { email: string; password: string; name?: string }) {
    const { email, password, name } = data;
    const settings = await AppSettingsService.getRuntimeBusinessSettings();

    if (!settings.allowSignup) {
      logger.warn("Registration blocked because signup is disabled", { email });
      throw new AuthorizationError("New registrations are currently disabled");
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.warn("Registration attempted with existing email", { email });
      throw new ConflictError("User already exists with this email");
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user (unverified)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    logger.info("New user registered", { email, userId: newUser.id });

    // Generate and send OTP for email verification
    const otpCode = await this.createAndSendOtp(newUser.id, newUser.email);

    const { password: _, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword,
      otpRequired: true,
      message: "Registration successful. Please verify your email with the OTP sent.",
      // Include OTP in dev mode for testing
      ...(config.NODE_ENV !== "production" && { otp: otpCode }),
    };
  }

  /**
   * Login with email + password.
   * Returns JWT immediately if credentials are valid and user is verified.
   * No OTP required on login — keeps the MVP flow simple.
   */
  static async login(data: { email: string; password: string }) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logger.warn("Login attempt with non-existent user", { email });
      throw new Error("Invalid credentials");
    }

    if (user.isSuspended) {
      logger.warn("Suspended user attempted login", { email, userId: user.id });
      throw new Error("Account suspended");
    }

    if (!user.isVerified) {
      logger.info("Unverified user attempted login, resending OTP", { email });
      const otpCode = await this.createAndSendOtp(user.id, user.email);
      return {
        otpRequired: true,
        message: "Account not verified. A new OTP has been sent to your email.",
        ...(config.NODE_ENV !== "production" && { otp: otpCode }),
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn("Invalid password for user", { email });
      throw new Error("Invalid credentials");
    }

    logger.info("User logged in successfully", { email });
    const tokens = await this.generateTokens({ id: user.id, role: user.role });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: "Login successful",
    };
  }

  /**
   * Verify OTP — used after registration to verify email.
   * Marks user as verified and issues JWT.
   */
  static async verifyOtp(data: { email: string; otp: string }) {
    const { email, otp } = data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logger.warn("OTP verification for non-existent user", { email });
      throw new Error("User not found");
    }

    if (user.isSuspended) {
      logger.warn("Suspended user attempted OTP verification", { email, userId: user.id });
      throw new Error("Account suspended");
    }

    // Find the latest unused OTP for this user
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      logger.warn("OTP verification failed - expired or not found", { email });
      throw new Error("OTP expired or not found. Please request a new one.");
    }

    // Compare OTP
    const isValid = await compareOtp(otp, otpRecord.code);
    if (!isValid) {
      logger.warn("OTP verification failed - invalid code", { email });
      throw new Error("Invalid OTP code");
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // If user was not verified (registration flow), verify them now
    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
      logger.info("User verified after registration", { email });
    }

    logger.info("OTP verified, JWT token issued", { email });
    const tokens = await this.generateTokens({ id: user.id, role: user.role });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: { ...userWithoutPassword, isVerified: true },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: "Verification successful",
    };
  }

  /**
   * Resend OTP — for users who need a new code.
   */
  static async resendOtp(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isSuspended) {
      throw new Error("Account suspended");
    }

    // Invalidate all existing unused OTPs
    await prisma.otpCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const otpCode = await this.createAndSendOtp(user.id, user.email);

    return {
      message: "A new OTP has been sent to your email.",
      ...(config.NODE_ENV !== "production" && { otp: otpCode }),
    };
  }

  /**
   * Get user profile with aggregated data.
   */
  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        isSuspended: true,
        createdAt: true,
        _count: {
          select: { plans: true },
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get total approved contributions across all user's plans
    const userPlans = await prisma.savingsPlan.findMany({
      where: { userId },
      select: { id: true },
    });

    const contributions = await prisma.contribution.aggregate({
      where: {
        planId: { in: userPlans.map((p) => p.id) },
        status: "APPROVED",
      },
      _sum: { amount: true },
    });

    return {
      ...user,
      totalSaved: contributions._sum.amount || 0,
      activePlansCount: user._count.plans,
    };
  }

  /**
   * Forgot password — send a reset OTP to user's email.
   * Always succeeds silently to prevent email enumeration.
   */
  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isSuspended) {
      // Silently succeed — caller handles enumeration protection at controller level
      return { message: "If an account with that email exists, a reset code has been sent." };
    }

    // Invalidate all existing unused OTPs
    await prisma.otpCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const code = generateOtpCode();
    const hashedCode = await hashOtp(code);
    const expiresAt = getOtpExpiry();

    await prisma.otpCode.create({
      data: { code: hashedCode, userId: user.id, expiresAt },
    });

    await sendPasswordResetEmail(email, code);
    logger.info("Password reset OTP sent", { email });

    return {
      message: "If an account with that email exists, a reset code has been sent.",
      ...(config.NODE_ENV !== "production" && { otp: code }),
    };
  }

  /**
   * Reset password — verifies OTP and updates password.
   */
  static async resetPassword(data: { email: string; otp: string; newPassword: string }) {
    const { email, otp, newPassword } = data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("User not found");
    if (user.isSuspended) throw new Error("Account suspended");

    const otpRecord = await prisma.otpCode.findFirst({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) throw new Error("OTP expired or not found. Please request a new one.");

    const isValid = await compareOtp(otp, otpRecord.code);
    if (!isValid) throw new Error("Invalid OTP code");

    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

    logger.info("Password reset successfully", { email });
    return { message: "Password reset successfully. Please log in with your new password." };
  }

  /**
   * Refresh the access token using a valid refresh token.
   */
  static async refreshSession(refreshToken: string) {
    if (!refreshToken) throw new AuthorizationError("Refresh token required");

    try {
      // Verify token signature first
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };

      // Verify token exists in DB and is not expired
      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        if (tokenRecord) {
          await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
        }
        throw new AuthorizationError("Invalid or expired refresh token");
      }

      if (tokenRecord.user.isSuspended) {
        throw new AuthorizationError("Account suspended");
      }

      // Rotate tokens (delete old, create new)
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      const tokens = await this.generateTokens({ id: tokenRecord.user.id, role: tokenRecord.user.role });

      return {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new AuthorizationError("Invalid refresh token");
    }
  }

  /**
   * Logout user by deleting their refresh token.
   */
  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    try {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
    } catch (e) {
      // Ignore if token doesn't exist
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(userId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  // ─── Private Helpers ────────────────────────────────────────────

  /**
   * Create an OTP record and send it via email.
   * Returns the plain OTP code (for dev response).
   */
  private static async createAndSendOtp(userId: string, email: string): Promise<string> {
    const code = generateOtpCode();
    const hashedCode = await hashOtp(code);
    const expiresAt = getOtpExpiry();

    await prisma.otpCode.create({
      data: {
        code: hashedCode,
        userId,
        expiresAt,
      },
    });

    // Send OTP via email (non-blocking, errors are logged not thrown)
    await sendOtpEmail(email, code);

    return code;
  }

  private static async generateTokens(user: { id: string; role: string }) {
    // Access token - short lived (15 minutes)
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "15m",
    });

    // Refresh token - long lived (7 days)
    const refreshTokenPayload = crypto.randomBytes(40).toString("hex");
    const refreshToken = jwt.sign({ userId: user.id, jti: refreshTokenPayload }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
