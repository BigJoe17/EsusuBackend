"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const otp_util_1 = require("../utils/otp.util");
const email_util_1 = require("../utils/email.util");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const error_middleware_1 = require("../middleware/error.middleware");
const JWT_SECRET = env_1.config.JWT_SECRET;
class AuthService {
    /**
     * Register a new user.
     * Creates the user (unverified), generates OTP, sends via email.
     * User must verify OTP before they can log in.
     */
    static async register(data) {
        const { email, password, name } = data;
        // Check if user already exists
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            logger_1.logger.warn("Registration attempted with existing email", { email });
            throw new error_middleware_1.ConflictError("User already exists with this email");
        }
        // Hash password
        const salt = await bcrypt_1.default.genSalt(12);
        const hashedPassword = await bcrypt_1.default.hash(password, salt);
        // Create new user (unverified)
        const newUser = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });
        logger_1.logger.info("New user registered", { email, userId: newUser.id });
        // Generate and send OTP for email verification
        const otpCode = await this.createAndSendOtp(newUser.id, newUser.email);
        const { password: _, ...userWithoutPassword } = newUser;
        return {
            user: userWithoutPassword,
            otpRequired: true,
            message: "Registration successful. Please verify your email with the OTP sent.",
            // Include OTP in dev mode for testing
            ...(env_1.config.NODE_ENV !== "production" && { otp: otpCode }),
        };
    }
    /**
     * Login with email + password.
     * Returns JWT immediately if credentials are valid and user is verified.
     * No OTP required on login — keeps the MVP flow simple.
     */
    static async login(data) {
        const { email, password } = data;
        const user = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (!user) {
            logger_1.logger.warn("Login attempt with non-existent user", { email });
            throw new Error("Invalid credentials");
        }
        if (!user.isVerified) {
            logger_1.logger.info("Unverified user attempted login, resending OTP", { email });
            const otpCode = await this.createAndSendOtp(user.id, user.email);
            return {
                otpRequired: true,
                message: "Account not verified. A new OTP has been sent to your email.",
                ...(env_1.config.NODE_ENV !== "production" && { otp: otpCode }),
            };
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            logger_1.logger.warn("Invalid password for user", { email });
            throw new Error("Invalid credentials");
        }
        logger_1.logger.info("User logged in successfully", { email });
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
    static async verifyOtp(data) {
        const { email, otp } = data;
        const user = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (!user) {
            logger_1.logger.warn("OTP verification for non-existent user", { email });
            throw new Error("User not found");
        }
        // Find the latest unused OTP for this user
        const otpRecord = await prisma_1.default.otpCode.findFirst({
            where: {
                userId: user.id,
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        if (!otpRecord) {
            logger_1.logger.warn("OTP verification failed - expired or not found", { email });
            throw new Error("OTP expired or not found. Please request a new one.");
        }
        // Compare OTP
        const isValid = await (0, otp_util_1.compareOtp)(otp, otpRecord.code);
        if (!isValid) {
            logger_1.logger.warn("OTP verification failed - invalid code", { email });
            throw new Error("Invalid OTP code");
        }
        // Mark OTP as used
        await prisma_1.default.otpCode.update({
            where: { id: otpRecord.id },
            data: { used: true },
        });
        // If user was not verified (registration flow), verify them now
        if (!user.isVerified) {
            await prisma_1.default.user.update({
                where: { id: user.id },
                data: { isVerified: true },
            });
            logger_1.logger.info("User verified after registration", { email });
        }
        logger_1.logger.info("OTP verified, JWT token issued", { email });
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
    static async resendOtp(email) {
        const user = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new Error("User not found");
        }
        // Invalidate all existing unused OTPs
        await prisma_1.default.otpCode.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true },
        });
        const otpCode = await this.createAndSendOtp(user.id, user.email);
        return {
            message: "A new OTP has been sent to your email.",
            ...(env_1.config.NODE_ENV !== "production" && { otp: otpCode }),
        };
    }
    /**
     * Get user profile with aggregated data.
     */
    static async getUserProfile(userId) {
        const user = await prisma_1.default.user.findUnique({
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
        const userPlans = await prisma_1.default.savingsPlan.findMany({
            where: { userId },
            select: { id: true },
        });
        const contributions = await prisma_1.default.contribution.aggregate({
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
    static async createAndSendOtp(userId, email) {
        const code = (0, otp_util_1.generateOtpCode)();
        const hashedCode = await (0, otp_util_1.hashOtp)(code);
        const expiresAt = (0, otp_util_1.getOtpExpiry)();
        await prisma_1.default.otpCode.create({
            data: {
                code: hashedCode,
                userId,
                expiresAt,
            },
        });
        // Send OTP via email (non-blocking, errors are logged not thrown)
        await (0, email_util_1.sendOtpEmail)(email, code);
        return code;
    }
    static generateToken(user) {
        return jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: "7d",
        });
    }
}
exports.AuthService = AuthService;
