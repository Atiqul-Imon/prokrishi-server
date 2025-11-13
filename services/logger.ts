import winston from 'winston';
import { Request, Response } from 'express';
import { AuthRequest } from '../types/index.js';
import fs from 'fs';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }),
];

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  levels,
  transports,
  exitOnError: false,
});

const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

export const logRequest = (req: Request, res: Response, responseTime: number): void => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as AuthRequest).user?._id?.toString() || 'anonymous',
  };

  if (res.statusCode >= 400) {
    logger.error(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, logData);
  } else {
    logger.http(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, logData);
  }
};

export const logError = (error: Error, req: Request | null = null): void => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    url: req?.url,
    method: req?.method,
    ip: req?.ip,
    userId: (req as AuthRequest)?.user?._id?.toString(),
    timestamp: new Date().toISOString(),
  };

  logger.error('Application Error', errorData);
};

export const logSecurity = (event: string, details: Record<string, any>): void => {
  const securityData = {
    event,
    details,
    timestamp: new Date().toISOString(),
  };

  logger.warn('Security Event', securityData);
};

export const logBusiness = (event: string, data: Record<string, any>): void => {
  const businessData = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  logger.info('Business Event', businessData);
};

export const logPerformance = (
  operation: string,
  duration: number,
  details: Record<string, any> = {}
): void => {
  const perfData = {
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString(),
  };

  logger.info('Performance', perfData);
};

export default logger;

