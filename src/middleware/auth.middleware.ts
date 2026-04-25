import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";
import { config } from "../config/env";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: "USER" | "ADMIN";
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ success: false, error: "Access token required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      userId?: string;
      role?: "USER" | "ADMIN";
    };

    if (!decoded?.userId) {
      res.status(403).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    let role = decoded.role;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, isSuspended: true },
    });

    if (!user) {
      res.status(403).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ success: false, error: "Account suspended" });
      return;
    }

    role = role || user.role;
    req.user = { userId: decoded.userId, role };
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: "Invalid or expired token" });
  }
};
