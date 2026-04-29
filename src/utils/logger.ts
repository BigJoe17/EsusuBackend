import winston from "winston";
import { config } from "../config/env";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `[${timestamp}] ${level}: ${message}`;
  
  if (Object.keys(meta).length) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

export const logger = winston.createLogger({
  level: config.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        customFormat
      ),
    }),
  ],
});
