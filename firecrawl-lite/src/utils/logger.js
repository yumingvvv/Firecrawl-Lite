const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'info',
      filename: config.filename || 'logs/app.log',
      maxSize: config.maxSize || '10m',
      maxFiles: config.maxFiles || 5,
      ...config
    };
    
    this.logger = this.createLogger();
  }

  createLogger() {
    // Ensure log directory exists
    const logDir = path.dirname(this.config.filename);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ];

    const transports = [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(meta).length > 0) {
              log += ` ${JSON.stringify(meta)}`;
            }
            return log;
          })
        )
      }),
      
      // File transport
      new winston.transports.File({
        filename: this.config.filename,
        maxsize: this.parseSize(this.config.maxSize),
        maxFiles: this.config.maxFiles,
        format: winston.format.combine(...formats)
      })
    ];

    // Add error-specific file transport in production
    if (process.env.NODE_ENV === 'production') {
      const errorLogFile = this.config.filename.replace('.log', '.error.log');
      transports.push(
        new winston.transports.File({
          filename: errorLogFile,
          level: 'error',
          maxsize: this.parseSize(this.config.maxSize),
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(...formats)
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(...formats),
      defaultMeta: {
        service: 'firecrawl-lite',
        environment: process.env.NODE_ENV || 'development'
      },
      transports,
      exitOnError: false
    });
  }

  parseSize(sizeStr) {
    const units = { b: 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = sizeStr.toString().toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    return parseInt(match[1]) * (units[match[2]] || 1);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  http(message, meta = {}) {
    this.logger.http(message, meta);
  }

  // Method to log HTTP requests
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('Content-Length') || 0
    };

    if (res.statusCode >= 400) {
      this.error('HTTP Request Error', logData);
    } else {
      this.http('HTTP Request', logData);
    }
  }

  // Method to create child logger with additional context
  child(defaultMeta) {
    const childLogger = winston.createLogger({
      level: this.config.level,
      format: this.logger.format,
      defaultMeta: { ...this.logger.defaultMeta, ...defaultMeta },
      transports: this.logger.transports
    });

    return {
      info: (message, meta = {}) => childLogger.info(message, meta),
      error: (message, meta = {}) => childLogger.error(message, meta),
      warn: (message, meta = {}) => childLogger.warn(message, meta),
      debug: (message, meta = {}) => childLogger.debug(message, meta),
      http: (message, meta = {}) => childLogger.http(message, meta)
    };
  }

  // Method to handle uncaught exceptions
  handleExceptions() {
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: this.config.filename.replace('.log', '.exceptions.log'),
        maxsize: this.parseSize(this.config.maxSize),
        maxFiles: this.config.maxFiles
      })
    );
  }

  // Method to handle unhandled rejections
  handleRejections() {
    this.logger.rejections.handle(
      new winston.transports.File({
        filename: this.config.filename.replace('.log', '.rejections.log'),
        maxsize: this.parseSize(this.config.maxSize),
        maxFiles: this.config.maxFiles
      })
    );
  }

  // Graceful shutdown
  close() {
    return new Promise((resolve) => {
      this.logger.close(() => {
        resolve();
      });
    });
  }
}

module.exports = Logger;