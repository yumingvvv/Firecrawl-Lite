const express = require('express');
const joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
const CrawlerService = require('../services/crawler.service');

const router = express.Router();

// Validation schema for extract request
const extractSchema = joi.object({
  url: joi.string().uri().required(),
  options: joi.object({
    includeImages: joi.boolean().default(true),
    includeLinks: joi.boolean().default(true),
    waitForSelector: joi.string().allow(null),
    timeout: joi.number().min(1000).max(60000).default(30000),
    format: joi.string().valid('markdown', 'html').default('markdown'),
    blockResources: joi.array().items(joi.string().valid('stylesheet', 'image', 'media', 'font')),
    headers: joi.object(),
    cookies: joi.array().items(joi.object({
      name: joi.string().required(),
      value: joi.string().required(),
      domain: joi.string(),
      path: joi.string(),
      httpOnly: joi.boolean(),
      secure: joi.boolean()
    })),
    conversion: joi.object({
      headingStyle: joi.string().valid('atx', 'setext').default('atx'),
      bulletListMarker: joi.string().valid('-', '*', '+').default('-'),
      codeBlockStyle: joi.string().valid('fenced', 'indented').default('fenced'),
      linkStyle: joi.string().valid('inlined', 'referenced').default('inlined')
    }),
    saveToFile: joi.boolean().default(false),
    saveDirectory: joi.string().pattern(/^[a-zA-Z0-9_\-\/]+$/).allow('').optional(),
    // New advanced options
    waitTime: joi.number().min(1000).max(30000).default(3000),
    waitUntil: joi.string().valid('networkidle0', 'networkidle1', 'load', 'domcontentloaded').default('networkidle0'),
    waitForContentSelectors: joi.boolean().default(true),
    scrollToBottom: joi.boolean().default(true),
    maxContentLength: joi.number().min(10000).max(10000000).default(1000000),
    // Browser configuration
    browser: joi.object({
      headless: joi.boolean().default(true),
      slowMo: joi.number().min(0).max(1000).default(0)
    }),
    // Extraction configuration
    extraction: joi.object({
      waitForSelector: joi.string().allow(null),
      waitTime: joi.number().min(1000).max(30000).default(3000),
      waitForContentSelectors: joi.boolean().default(true),
      scrollToBottom: joi.boolean().default(true),
      maxContentLength: joi.number().min(10000).max(10000000).default(1000000)
    })
  }).default({})
});

// Initialize crawler service
let crawlerService = null;

const initializeCrawlerService = async (config) => {
  if (!crawlerService) {
    crawlerService = new CrawlerService(config);
    await crawlerService.initialize();
  }
  return crawlerService;
};

// Helper function to create a safe filename from URL
const createSafeFilename = (url, title) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, '_');
    const pathname = urlObj.pathname.replace(/[\/\\?%*:|"<>]/g, '_');
    
    // If title exists, use it as primary filename
    if (title) {
      const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 50);
      return `${safeTitle}_${hostname}${pathname}`.replace(/_{2,}/g, '_').replace(/_$/, '');
    }
    
    // Otherwise use URL parts
    return `${hostname}${pathname}`.replace(/_{2,}/g, '_').replace(/_$/, '');
  } catch (error) {
    // Fallback to timestamp if URL parsing fails
    return `extracted_content_${Date.now()}`;
  }
};

// Helper function to get default directory name based on current date
const getDefaultDirectory = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `extracted_${year}-${month}-${day}`;
};

/**
 * @swagger
 * /api/extract:
 *   post:
 *     tags: [Extract]
 *     summary: Extract content from a single URL
 *     description: Extract and convert web page content to Markdown format using intelligent content extraction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtractRequest'
 *           examples:
 *             basic:
 *               summary: Basic extraction
 *               value:
 *                 url: "https://example.com/article"
 *                 options:
 *                   includeImages: true
 *                   format: "markdown"
 *             advanced:
 *               summary: Advanced extraction with custom options
 *               value:
 *                 url: "https://blog.example.com/post"
 *                 options:
 *                   includeImages: false
 *                   includeLinks: true
 *                   waitForSelector: ".content"
 *                   timeout: 15000
 *                   blockResources: ["stylesheet", "font"]
 *                   conversion:
 *                     headingStyle: "atx"
 *                     bulletListMarker: "-"
 *             withFileSave:
 *               summary: Extract and save to file
 *               value:
 *                 url: "https://docs.example.com/guide"
 *                 options:
 *                   format: "markdown"
 *                   saveToFile: true
 *                   saveDirectory: "docs/extracted"
 *     responses:
 *       200:
 *         description: Content extracted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtractResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/extract', async (req, res) => {
  try {
    // Validate request
    const { error, value } = extractSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request parameters',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { url, options } = value;
    
    // Map new options to the crawler service format
    const crawlerOptions = {
      ...options,
      // Map waitUntil to the correct format for playwright
      waitUntil: options.waitUntil === 'networkidle0' ? 'networkidle' : 
                 options.waitUntil === 'networkidle1' ? 'networkidle' :
                 options.waitUntil
    };
    
    // Initialize crawler service with app config and pass extraction options
    const crawler = await initializeCrawlerService({
      ...req.app.locals.config,
      extraction: {
        waitTime: options.waitTime,
        waitForContentSelectors: options.waitForContentSelectors,
        scrollToBottom: options.scrollToBottom,
        maxContentLength: options.maxContentLength,
        ...options.extraction
      }
    });
    
    // Extract content
    const startTime = Date.now();
    const result = await crawler.crawlUrl(url, crawlerOptions);
    const processingTime = Date.now() - startTime;
    
    if (result.success) {
      // Save to file if requested
      let savedFilePath = null;
      if (options.saveToFile) {
        try {
          // Use default date-based directory if not specified
          const directoryName = options.saveDirectory || getDefaultDirectory();
          
          // Create directory if it doesn't exist
          const saveDir = path.join(process.cwd(), directoryName);
          await fs.mkdir(saveDir, { recursive: true });
          
          // Create filename
          const filename = createSafeFilename(url, result.data.title) + '.md';
          const filePath = path.join(saveDir, filename);
          
          // Create markdown content with metadata header
          const markdownContent = `---
title: ${result.data.title || 'Untitled'}
url: ${result.data.url}
extractedAt: ${result.data.extractedAt}
---

${result.data.markdown}`;
          
          // Write file
          await fs.writeFile(filePath, markdownContent, 'utf8');
          savedFilePath = path.relative(process.cwd(), filePath);
          
          req.app.locals.logger && req.app.locals.logger.info('Content saved to file', {
            url,
            filePath: savedFilePath
          });
        } catch (fileError) {
          req.app.locals.logger && req.app.locals.logger.error('Failed to save file', {
            url,
            error: fileError.message
          });
          // Don't fail the request if file save fails
        }
      }
      
      // Log successful extraction
      req.app.locals.logger && req.app.locals.logger.info('Content extracted successfully', {
        url,
        processingTime,
        contentLength: result.data.markdown.length,
        savedToFile: options.saveToFile,
        savedFilePath,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      const responseData = {
        success: true,
        data: {
          url: result.data.url,
          title: result.data.title,
          markdown: result.data.markdown,
          metadata: {
            ...result.data.metadata,
            processingTime
          },
          extractedAt: result.data.extractedAt
        }
      };
      
      // Add file info if saved
      if (savedFilePath) {
        responseData.data.savedToFile = true;
        responseData.data.savedFilePath = savedFilePath;
      }
      
      return res.json(responseData);
    } else {
      // Log failed extraction
      req.app.locals.logger && req.app.locals.logger.error('Content extraction failed', {
        url,
        error: result.error.message,
        processingTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to extract content',
          details: result.error.message,
          url,
          processingTime: result.error.processingTime
        }
      });
    }
    
  } catch (error) {
    // Log unexpected errors
    req.app.locals.logger && req.app.locals.logger.error('Unexpected error in extract endpoint', {
      error: error.message,
      stack: error.stack,
      url: req.body.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
      }
    });
  }
});

/**
 * @swagger
 * /api/extract/health:
 *   get:
 *     tags: [Health]
 *     summary: Service health check
 *     description: Check the health status of the extraction service and browser pool
 *     responses:
 *       200:
 *         description: Service is healthy
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
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     browserPool:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         healthy: { type: integer }
 *                         available: { type: integer }
 *                         busy: { type: integer }
 *                     testCrawl:
 *                       type: boolean
 *                     stats:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
router.get('/health', async (req, res) => {
  try {
    if (!crawlerService) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Service not initialized'
        }
      });
    }
    
    const healthStatus = await crawlerService.healthCheck();
    
    return res.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Health check failed',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/extract/stats:
 *   get:
 *     tags: [Stats]
 *     summary: Get service statistics
 *     description: Retrieve detailed statistics about the extraction service performance and usage
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatsResponse'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
router.get('/stats', async (req, res) => {
  try {
    if (!crawlerService) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Service not initialized'
        }
      });
    }
    
    const stats = crawlerService.getStats();
    
    return res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get stats',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/batch:
 *   post:
 *     tags: [Extract]
 *     summary: Extract content from multiple URLs
 *     description: Batch process multiple URLs with configurable concurrency and extract content from all of them
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchRequest'
 *           examples:
 *             basic:
 *               summary: Basic batch extraction
 *               value:
 *                 urls: ["https://example.com/article1", "https://example.com/article2"]
 *                 options:
 *                   concurrent: 3
 *             advanced:
 *               summary: Advanced batch with custom options
 *               value:
 *                 urls: ["https://news.ycombinator.com", "https://reddit.com", "https://github.com"]
 *                 options:
 *                   concurrent: 2
 *                   includeImages: false
 *                   timeout: 20000
 *                   blockResources: ["stylesheet", "image"]
 *     responses:
 *       200:
 *         description: Batch processing completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/batch', async (req, res) => {
  try {
    // Validation schema for batch request
    const batchSchema = joi.object({
      urls: joi.array().items(joi.string().uri()).min(1).max(50).required(),
      options: joi.object({
        concurrent: joi.number().min(1).max(10).default(3),
        includeImages: joi.boolean().default(true),
        includeLinks: joi.boolean().default(true),
        waitForSelector: joi.string().allow(null),
        timeout: joi.number().min(1000).max(60000).default(30000),
        format: joi.string().valid('markdown', 'html').default('markdown'),
        blockResources: joi.array().items(joi.string().valid('stylesheet', 'image', 'media', 'font')),
        headers: joi.object(),
        cookies: joi.array().items(joi.object({
          name: joi.string().required(),
          value: joi.string().required(),
          domain: joi.string(),
          path: joi.string(),
          httpOnly: joi.boolean(),
          secure: joi.boolean()
        }))
      }).default({})
    });
    
    // Validate request
    const { error, value } = batchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request parameters',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { urls, options } = value;
    
    // Initialize crawler service
    const crawler = await initializeCrawlerService(req.app.locals.config);
    
    // Process batch
    const startTime = Date.now();
    const result = await crawler.crawlMultipleUrls(urls, options);
    const processingTime = Date.now() - startTime;
    
    // Log batch processing
    req.app.locals.logger && req.app.locals.logger.info('Batch processing completed', {
      urlCount: urls.length,
      successful: result.summary.successful,
      failed: result.summary.failed,
      processingTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    return res.json({
      success: true,
      data: {
        results: result.results,
        summary: {
          ...result.summary,
          processingTime
        },
        processedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    // Log unexpected errors
    req.app.locals.logger && req.app.locals.logger.error('Unexpected error in batch endpoint', {
      error: error.message,
      stack: error.stack,
      urlCount: req.body.urls ? req.body.urls.length : 0,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
      }
    });
  }
});

// Graceful shutdown handler
const gracefulShutdown = async () => {
  if (crawlerService) {
    console.log('Shutting down crawler service...');
    await crawlerService.shutdown();
    crawlerService = null;
  }
};

// Export router and shutdown handler
module.exports = {
  router,
  gracefulShutdown
};