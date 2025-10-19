import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  levels,
  transports,
  exitOnError: false,
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Custom logging methods
export const logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
  };

  if (res.statusCode >= 400) {
    logger.error(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, logData);
  } else {
    logger.http(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, logData);
  }
};

export const logError = (error, req = null) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    url: req?.url,
    method: req?.method,
    ip: req?.ip,
    userId: req?.user?.id,
    timestamp: new Date().toISOString(),
  };

  logger.error('Application Error', errorData);
};

export const logSecurity = (event, details) => {
  const securityData = {
    event,
    details,
    timestamp: new Date().toISOString(),
  };

  logger.warn('Security Event', securityData);
};

export const logBusiness = (event, data) => {
  const businessData = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  logger.info('Business Event', businessData);
};

export const logPerformance = (operation, duration, details = {}) => {
  const perfData = {
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString(),
  };

  logger.info('Performance', perfData);
};

export default logger;
