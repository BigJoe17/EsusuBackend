import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// Configuration & Logging
import { config, validateEnv } from "./config/env";
import { logger } from "./utils/logger";

// Routes
import authRoutes from "./routes/auth.routes";
import planRoutes from "./modules/plan/plan.routes";
import contributionRoutes from "./modules/contribution/contribution.routes";
import withdrawalRoutes from "./modules/withdrawal/withdrawal.routes";
import adminRoutes from "./modules/admin/admin.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import settingsRoutes from "./modules/settings/settings.routes";

// Cron Jobs
import "./jobs/cron";

// Middlewares
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// Validate environment on startup
try {
  validateEnv();
  logger.info("✅ Environment validation passed");
} catch (error) {
  logger.error("❌ Environment validation failed", error as Error);
  process.exit(1);
}

const app = express();

// Security and Logging Best Practices
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: config.NODE_ENV === "production",
  })
);

// CORS Configuration - Allow mobile app connections
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all origins in development
      if (config.NODE_ENV === "development") {
        return callback(null, true);
      }
      
      // In production, specify allowed origins
      const allowedOrigins = [
        "http://localhost:5000",
        process.env.CORS_ORIGIN,
      ];
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

// Global rate limiting (using battle-tested express-rate-limit)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later" },
  })
);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
// Strict rate limit on auth in production
app.use(
  "/api/auth",
  config.NODE_ENV === "production"
    ? rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, error: "Too many auth attempts" } })
    : (req: any, res: any, next: any) => next(),
  authRoutes
);
app.use("/api/plans", planRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);

// Catch 404 and forward to error handler
app.use(notFoundHandler);

// Global Error Handler (must be last)
app.use(errorHandler);

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`, {
    environment: config.NODE_ENV,
    port: PORT,
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ Unhandled Rejection at:", promise, "reason:", reason as Error);
  process.exit(1);
});