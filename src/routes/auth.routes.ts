import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// Public routes (no auth required)
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/resend-otp", AuthController.resendOtp);

// Protected routes (JWT required)
router.get("/me", authenticateToken as any, AuthController.getProfile as any);
router.patch("/change-password", authenticateToken as any, AuthController.changePassword as any);

export default router;
