import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// ─── Public Routes ─────────────────────────────────────────────────
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/resend-otp", AuthController.resendOtp);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
// ─── Protected Routes (JWT required) ───────────────────────────────
router.get("/me", authenticateToken as any, AuthController.getProfile as any);
router.patch("/change-password", authenticateToken as any, AuthController.changePassword as any);
router.post("/push-token", authenticateToken as any, AuthController.savePushToken as any);

export default router;
