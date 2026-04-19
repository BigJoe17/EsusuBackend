import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Custom Application Error Classes
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public errors?: any[]) {
    super(message, 400, true);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, 401, true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403, true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors = undefined;

  // Handle custom app errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    if (err instanceof ValidationError) {
      errors = err.errors;
    }
    logger.warn(message, { statusCode, path: req.path });
  }
  // Handle Prisma errors
  else if (err.code === "P2002") {
    statusCode = 409;
    message = "This resource already exists";
    logger.warn("Unique constraint violation", { field: err.meta?.target });
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "Resource not found";
    logger.warn("Record not found");
  } else if (err.code?.startsWith("P")) {
    statusCode = 400;
    message = "Database error";
    logger.error("Prisma error", err, { code: err.code });
  }
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid or expired token";
    logger.warn("JWT error", { error: err.message });
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    logger.warn("Token expired");
  }
  // Handle other errors
  else {
    logger.error("Unhandled error", err, { path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn("Route not found", { method: req.method, path: req.originalUrl });
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl,
  });
};
