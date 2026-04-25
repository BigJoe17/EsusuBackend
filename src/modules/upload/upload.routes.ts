import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { UploadController, upload } from "./upload.controller";

const router = Router();

/**
 * POST /api/upload/proof
 * Upload a payment proof image. Returns { url: "https://..." }
 */
router.post(
  "/proof",
  authenticateToken,
  upload.single("image"),
  UploadController.uploadProof
);

export default router;
