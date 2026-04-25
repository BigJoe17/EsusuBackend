import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { BankAccountController } from "./bank-account.controller";

const router = Router();

// All routes require authentication
router.use(authenticateToken as any);

router.get("/", BankAccountController.getBankAccount as any);
router.post("/", BankAccountController.upsertBankAccount as any);
router.delete("/", BankAccountController.deleteBankAccount as any);

export default router;
