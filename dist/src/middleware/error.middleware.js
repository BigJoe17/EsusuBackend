"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
/**
 * Custom Application Error Classes
 */
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    errors;
    constructor(message, errors) {
        super(message, 400, true);
        this.errors = errors;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = "Authentication failed") {
        super(message, 401, true);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = "Access denied") {
        super(message, 403, true);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource = "Resource") {
        super(`${resource} not found`, 404, true);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, true);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
exports.ConflictError = ConflictError;
/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
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
        logger_1.logger.warn(message, { statusCode, path: req.path });
    }
    // Handle Prisma errors
    else if (err.code === "P2002") {
        statusCode = 409;
        message = "This resource already exists";
        logger_1.logger.warn("Unique constraint violation", { field: err.meta?.target });
    }
    else if (err.code === "P2025") {
        statusCode = 404;
        message = "Resource not found";
        logger_1.logger.warn("Record not found");
    }
    else if (err.code?.startsWith("P")) {
        statusCode = 400;
        message = "Database error";
        logger_1.logger.error("Prisma error", err, { code: err.code });
    }
    // Handle JWT errors
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid or expired token";
        logger_1.logger.warn("JWT error", { error: err.message });
    }
    else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
        logger_1.logger.warn("Token expired");
    }
    // Handle other errors
    else {
        logger_1.logger.error("Unhandled error", err, { path: req.path });
    }
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(errors && { errors }),
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res) => {
    logger_1.logger.warn("Route not found", { method: req.method, path: req.originalUrl });
    res.status(404).json({
        success: false,
        error: "Endpoint not found",
        path: req.originalUrl,
    });
};
exports.notFoundHandler = notFoundHandler;
