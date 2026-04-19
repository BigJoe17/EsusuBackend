/**
 * Application Logger
 * Provides structured logging with different log levels
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: any;
}

class Logger {
  private level: LogLevel = "info";

  constructor(level: LogLevel = "info") {
    this.level = level;
  }

  private formatLog(entry: LogEntry): string {
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

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog("debug")) {
      console.log(
        this.formatLog({
          timestamp: new Date().toISOString(),
          level: "debug",
          message,
          data,
        })
      );
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog("info")) {
      console.log(
        this.formatLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message,
          data,
        })
      );
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog("warn")) {
      console.warn(
        this.formatLog({
          timestamp: new Date().toISOString(),
          level: "warn",
          message,
          data,
        })
      );
    }
  }

  error(message: string, error?: Error | any, data?: any): void {
    if (this.shouldLog("error")) {
      console.error(
        this.formatLog({
          timestamp: new Date().toISOString(),
          level: "error",
          message,
          error,
          data,
        })
      );
    }
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || "info"
);
