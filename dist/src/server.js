"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Configuration & Logging
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const plan_routes_1 = __importDefault(require("./modules/plan/plan.routes"));
const contribution_routes_1 = __importDefault(require("./modules/contribution/contribution.routes"));
const withdrawal_routes_1 = __importDefault(require("./modules/withdrawal/withdrawal.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const notification_routes_1 = __importDefault(require("./modules/notification/notification.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
// Cron Jobs
require("./jobs/cron");
// Middlewares
const error_middleware_1 = require("./middleware/error.middleware");
// Validate environment on startup
try {
    (0, env_1.validateEnv)();
    logger_1.logger.info("✅ Environment validation passed");
}
catch (error) {
    logger_1.logger.error("❌ Environment validation failed", error);
    process.exit(1);
}
const app = (0, express_1.default)();
// Security and Logging Best Practices
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: env_1.config.NODE_ENV === "production",
}));
// CORS Configuration - Allow mobile app connections
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // Allow all origins in development
        if (env_1.config.NODE_ENV === "development") {
            return callback(null, true);
        }
        // In production, specify allowed origins
        const allowedOrigins = [
            "http://localhost:5000",
            process.env.CORS_ORIGIN,
        ];
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json({ limit: "10kb" }));
app.use(express_1.default.urlencoded({ limit: "10kb", extended: true }));
// Global rate limiting (using battle-tested express-rate-limit)
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later" },
}));
// Health check route
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// API Routes
// Strict rate limit on auth in production
app.use("/api/auth", env_1.config.NODE_ENV === "production"
    ? (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, error: "Too many auth attempts" } })
    : (req, res, next) => next(), auth_routes_1.default);
app.use("/api/plans", plan_routes_1.default);
app.use("/api/contributions", contribution_routes_1.default);
app.use("/api/withdrawals", withdrawal_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/notifications", notification_routes_1.default);
app.use("/api/settings", settings_routes_1.default);
// Catch 404 and forward to error handler
app.use(error_middleware_1.notFoundHandler);
// Global Error Handler (must be last)
app.use(error_middleware_1.errorHandler);
const PORT = env_1.config.PORT;
const server = app.listen(PORT, () => {
    logger_1.logger.info(`🚀 Server running on http://localhost:${PORT}`, {
        environment: env_1.config.NODE_ENV,
        port: PORT,
    });
});
// Graceful shutdown
process.on("SIGTERM", () => {
    logger_1.logger.info("SIGTERM signal received: closing HTTP server");
    server.close(() => {
        logger_1.logger.info("HTTP server closed");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    logger_1.logger.info("SIGINT signal received: closing HTTP server");
    server.close(() => {
        logger_1.logger.info("HTTP server closed");
        process.exit(0);
    });
});
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    logger_1.logger.error("❌ Uncaught Exception:", error);
    process.exit(1);
});
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    logger_1.logger.error("❌ Unhandled Rejection at:", { promise, reason });
    process.exit(1);
});
