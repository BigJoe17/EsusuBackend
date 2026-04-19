import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";
import { generateOtpCode, hashOtp, compareOtp, getOtpExpiry } from "../utils/otp.util";
import { sendOtpEmail } from "../utils/email.util";
import { config } from "../config/env";
import { logger } from "../utils/logger";
import { ConflictError } from "../middleware/error.middleware";

const JWT_SECRET = config.JWT_SECRET;

export class AuthService {
  /**
   * Register a new user.
   * Creates the user (unverified), generates OTP, sends via email.
   * User must verify OTP before they can log in.
   */
  static async register(data: { email: string; password: string; name?: string }) {
    const { email, password, name } = data;

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
    const token = this.generateToken({ id: user.id, role: user.role });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
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
    const token = this.generateToken({ id: user.id, role: user.role });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: { ...userWithoutPassword, isVerified: true },
      token,
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

  private static generateToken(user: { id: string; role: string }): string {
    return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
  }
}
