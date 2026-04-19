"use strict";
/**
 * Environment Variable Validation
 * Ensures all required env vars are set on startup
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateEnv = validateEnv;
/**
 * Validate environment variables on app startup
 */
function validateEnv() {
    const requiredVars = [
        "DATABASE_URL",
        "JWT_SECRET",
        "NODE_ENV",
    ];
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    return {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV || "development",
        PORT: parseInt(process.env.PORT || "5000"),
        SMTP_HOST: process.env.SMTP_HOST || "smtp.ethereal.email",
        SMTP_PORT: parseInt(process.env.SMTP_PORT || "587"),
        SMTP_USER: process.env.SMTP_USER || "",
        SMTP_PASS: process.env.SMTP_PASS || "",
        OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || "10"),
        RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
        RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
        LOG_LEVEL: process.env.LOG_LEVEL || "info",
    };
}
// Export validated config as singleton
exports.config = (() => {
    try {
        return validateEnv();
    }
    catch (error) {
        console.error("❌ Environment validation failed:", error);
        process.exit(1);
    }
})();
