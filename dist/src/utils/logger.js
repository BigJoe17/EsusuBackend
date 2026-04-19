"use strict";
/**
 * Application Logger
 * Provides structured logging with different log levels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    level = "info";
    constructor(level = "info") {
        this.level = level;
    }
    formatLog(entry) {
        const { timestamp, level, message, data, error } = entry;
        let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        if (data) {
            log += ` ${JSON.stringify(data)}`;
        }
        if (error) {
            log += `\n${error.stack || error.message || JSON.stringify(error)}`;
        }
        return log;
    }
    shouldLog(level) {
        const levels = ["debug", "info", "warn", "error"];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }
    debug(message, data) {
        if (this.shouldLog("debug")) {
            console.log(this.formatLog({
                timestamp: new Date().toISOString(),
                level: "debug",
                message,
                data,
            }));
        }
    }
    info(message, data) {
        if (this.shouldLog("info")) {
            console.log(this.formatLog({
                timestamp: new Date().toISOString(),
                level: "info",
                message,
                data,
            }));
        }
    }
    warn(message, data) {
        if (this.shouldLog("warn")) {
            console.warn(this.formatLog({
                timestamp: new Date().toISOString(),
                level: "warn",
                message,
                data,
            }));
        }
    }
    error(message, error, data) {
        if (this.shouldLog("error")) {
            console.error(this.formatLog({
                timestamp: new Date().toISOString(),
                level: "error",
                message,
                error,
                data,
            }));
        }
    }
}
exports.logger = new Logger(process.env.LOG_LEVEL || "info");
