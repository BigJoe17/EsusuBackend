"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const env_1 = require("../config/env");
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        res.status(401).json({ success: false, error: "Access token required" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.config.JWT_SECRET);
        if (!decoded?.userId) {
            res.status(403).json({ success: false, error: "Invalid or expired token" });
            return;
        }
        let role = decoded.role;
        if (!role) {
            const user = await prisma_1.default.user.findUnique({
                where: { id: decoded.userId },
                select: { role: true },
            });
            if (!user) {
                res.status(403).json({ success: false, error: "Invalid or expired token" });
                return;
            }
            role = user.role;
        }
        req.user = { userId: decoded.userId, role };
        next();
    }
    catch (error) {
        res.status(403).json({ success: false, error: "Invalid or expired token" });
    }
};
exports.authenticateToken = authenticateToken;
