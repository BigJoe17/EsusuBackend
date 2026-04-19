/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per client
 */

import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [ip: string]: { requests: number; resetTime: number };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    // Initialize or get existing rate limit data
    if (!store[ip] || now > store[ip].resetTime) {
      store[ip] = {
        requests: 0,
        resetTime: now + windowMs,
      };
    }

    store[ip].requests++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - store[ip].requests));
    res.setHeader("X-RateLimit-Reset", new Date(store[ip].resetTime).toISOString());

    // Check if limit exceeded
    if (store[ip].requests > maxRequests) {
      res.status(429).json({
        success: false,
        error: "Too many requests, please try again later",
        retryAfter: Math.ceil((store[ip].resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Per-endpoint rate limiter
 * Use for sensitive endpoints like login, register
 */
export function strictRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
  });
}

/**
 * General API rate limiter
 */
export function apiRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  });
}
