/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per client
 */

import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: { requests: number; resetTime: number };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key (default: IP)
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    // Use path-based key so /auth/login and /auth/me have separate counters
    const key = keyGenerator ? keyGenerator(req) : `${ip}:${req.path}`;
    const now = Date.now();

    // Initialize or get existing rate limit data
    if (!store[key] || now > store[key].resetTime) {
      store[key] = {
        requests: 0,
        resetTime: now + windowMs,
      };
    }

    store[key].requests++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - store[key].requests));
    res.setHeader("X-RateLimit-Reset", new Date(store[key].resetTime).toISOString());

    // Check if limit exceeded
    if (store[key].requests > maxRequests) {
      res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Strict rate limiter (e.g. for Login, OTP, Withdrawals)
 * 10 requests per 15 minutes per IP+path
 */
export function strictRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  });
}

/**
 * Moderate rate limiter (e.g. for general POST/PUT endpoints)
 */
export function moderateRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  });
}

/**
 * Relaxed rate limiter (e.g. for general GET endpoints)
 */
export function relaxedRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  });
}
