import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { logger } from "../../utils/logger";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
  secure: true,
});

// Multer: store file in memory for direct Cloudinary upload
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    }
  },
});

export class UploadController {
  /**
   * POST /api/upload/proof
   * Authenticated. Accepts a single image, uploads to Cloudinary, returns the secure URL.
   */
  static async uploadProof(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded" });
        return;
      }

      // Check Cloudinary is configured
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        // Dev fallback: save strictly to local disk
        const uploadDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Clean the name to prevent any path or space issues
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `proof_${req.user!.userId}_${Date.now()}_${safeName}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.writeFileSync(filePath, req.file.buffer);
        
        // Determine the absolute local URL bridging the protocol and running host
        const fullUrl = `${req.protocol}://${req.get("host")}/uploads/${fileName}`;

        logger.info(`[UPLOAD] Local proof saved for user ${req.user!.userId}: ${fullUrl}`);
        
        res.status(200).json({
          success: true,
          url: fullUrl,
          dev: true,
        });
        return;
      }

      // Upload buffer to Cloudinary
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "esusu/proofs",
            resource_type: "image",
            public_id: `proof_${req.user!.userId}_${Date.now()}`,
            overwrite: false,
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file!.buffer);
      });

      logger.info(`[UPLOAD] Proof uploaded for user ${req.user!.userId}: ${uploadResult.secure_url}`);

      res.status(200).json({
        success: true,
        url: uploadResult.secure_url,
      });
    } catch (error: any) {
      logger.error("[UPLOAD] Error uploading proof:", error);
      if (error.message?.includes("Only")) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: "Failed to upload file" });
      }
    }
  }
}
