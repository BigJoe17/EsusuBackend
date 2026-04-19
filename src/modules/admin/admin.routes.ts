import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";

const router = Router();

router.use(authenticateToken as any);
router.use(requireAdmin as any);

router.get("/dashboard", AdminController.getDashboard as any);
router.patch("/users/bulk", AdminController.bulkUpdateUsers as any);
router.get("/users", AdminController.getUsers as any);
router.get("/users/:id", AdminController.getUserById as any);
router.get("/plans", AdminController.getPlans as any);
router.get("/contributions", AdminController.getContributions as any);
router.get("/withdrawals", AdminController.getWithdrawals as any);
router.get("/earnings", AdminController.getEarnings as any);

export default router;
