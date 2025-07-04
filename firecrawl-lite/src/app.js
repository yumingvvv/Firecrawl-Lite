const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const config = require('./utils/config');
const Logger = require('./utils/logger');
const swaggerSpecs = require('./docs/swagger');
const { router: extractRouter, gracefulShutdown } = require('./routes/extract');

class Application {
  constructor() {
    this.app = express();
    this.server = null;
    this.logger = null;
    this.isShuttingDown = false;
    
    console.log('Starting Application constructor...');
    this.initializeLogger();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.setupGracefulShutdown();
    console.log('Application constructor completed');
  }

  initializeLogger() {
    this.logger = new Logger(config.get('logging'));
    this.logger.handleExceptions();
    this.logger.handleRejections();
    
    // Make logger available to routes
    this.app.locals.logger = this.logger;
    this.app.locals.config = config.get();
    
    this.logger.info('Logger initialized', {
      level: config.get('logging.level'),
      environment: config.getEnvironment()
    });
  }

  initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.get('rateLimit.windowMs'),
      max: config.get('rateLimit.max'),
      message: {
        success: false,
        error: {
          message: config.get('rateLimit.message'),
          retryAfter: Math.ceil(config.get('rateLimit.windowMs') / 1000)
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health' || req.path === '/api/extract/health';
      }
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files
    this.app.use(express.static('public'));

    // Trust proxy (for proper IP detection behind load balancers)
    this.app.set('trust proxy', 1);

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logger.logRequest(req, res, responseTime);
      });
      
      next();
    });

    this.logger.info('Middleware initialized');
  }

  initializeRoutes() {
    try {
      // Swagger documentation
      const swaggerOptions = {
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 50px 0; }
        .swagger-ui .info .title { color: #3b4151; }
      `,
      customSiteTitle: "Firecrawl Lite API Documentation",
      customfavIcon: "/favicon.ico",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true
      }
    };
    
    this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, swaggerOptions));
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, swaggerOptions));

    /**
     * @swagger
     * /api/health:
     *   get:
     *     tags: [Health]
     *     summary: General health check
     *     description: Check the overall health status of the API service
     *     responses:
     *       200:
     *         description: Service is healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/HealthResponse'
     */
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: config.getEnvironment(),
          version: process.env.npm_package_version || '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      });
    });

    // API routes
    this.app.use('/api', extractRouter);

    /**
     * @swagger
     * /:
     *   get:
     *     summary: API information
     *     description: Get general information about the Firecrawl Lite API
     *     responses:
     *       200:
     *         description: API information
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 data:
     *                   type: object
     *                   properties:
     *                     name:
     *                       type: string
     *                       example: "Firecrawl Lite"
     *                     description:
     *                       type: string
     *                       example: "Lightweight web content extraction and Markdown conversion service"
     *                     version:
     *                       type: string
     *                       example: "1.0.0"
     *                     environment:
     *                       type: string
     *                       example: "development"
     *                     documentation:
     *                       type: string
     *                       example: "/docs"
     *                     endpoints:
     *                       type: object
     *                       properties:
     *                         extract: { type: string, example: "/api/extract" }
     *                         batch: { type: string, example: "/api/batch" }
     *                         health: { type: string, example: "/api/health" }
     *                         stats: { type: string, example: "/api/extract/stats" }
     */
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        data: {
          name: 'Firecrawl Lite',
          description: 'Lightweight web content extraction and Markdown conversion service',
          version: process.env.npm_package_version || '1.0.0',
          environment: config.getEnvironment(),
          documentation: '/docs',
          endpoints: {
            extract: '/api/extract',
            batch: '/api/batch',
            health: '/api/health',
            stats: '/api/extract/stats'
          }
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          message: 'Endpoint not found',
          path: req.originalUrl,
          method: req.method
        }
      });
    });

    this.logger.info('Routes initialized');
    } catch (error) {
      this.logger.error('Error initializing routes:', error);
      throw error;
    }
  }

  initializeErrorHandling() {
    // Error handling middleware
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Don't leak error details in production
      const isDevelopment = config.isDevelopment();
      
      res.status(error.status || 500).json({
        success: false,
        error: {
          message: error.message || 'Internal Server Error',
          ...(isDevelopment && { stack: error.stack }),
          timestamp: new Date().toISOString()
        }
      });
    });

    this.logger.info('Error handling initialized');
  }

  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, starting graceful shutdown...`);
        this.gracefulShutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
    });
  }

  async gracefulShutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info('Starting graceful shutdown...');

    // Stop accepting new requests
    if (this.server) {
      this.server.close(async () => {
        this.logger.info('HTTP server closed');
        
        try {
          // Shutdown crawler service
          await gracefulShutdown();
          
          // Close logger
          await this.logger.close();
          
          console.log('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    }

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  }

  start() {
    const port = config.get('port');
    
    this.server = this.app.listen(port, () => {
      this.logger.info('Server started', {
        port,
        environment: config.getEnvironment(),
        nodeVersion: process.version,
        pid: process.pid
      });
      
      console.log(`🚀 Firecrawl Lite server running on port ${port}`);
      console.log(`📖 Environment: ${config.getEnvironment()}`);
      console.log(`🔗 Health check: http://localhost:${port}/api/health`);
      console.log(`📋 API docs: http://localhost:${port}/`);
    });

    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        this.logger.error(`Port ${port} is already in use`);
        process.exit(1);
      } else {
        this.logger.error('Server error', { error: error.message });
        throw error;
      }
    });

    return this.server;
  }

  getApp() {
    return this.app;
  }
}

// Create and start the application when this file is run directly
console.log('Creating Application instance...');
const app = new Application();
console.log('Starting server...');
app.start();

module.exports = Application;