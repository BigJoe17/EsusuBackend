import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";

export const requireRole = (allowedRoles: Array<"ADMIN" | "USER">) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: "Forbidden: insufficient permissions" });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(["ADMIN"]);
