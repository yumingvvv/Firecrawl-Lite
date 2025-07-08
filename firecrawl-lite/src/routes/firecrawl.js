const express = require('express');
const joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
const FirecrawlService = require('../services/firecrawl.service');

const router = express.Router();

// Validation schema for Firecrawl extract request
const firecrawlExtractSchema = joi.object({
  url: joi.string().uri().required(),
  options: joi.object({
    formats: joi.array().items(joi.string().valid('markdown', 'html')).default(['markdown']),
    onlyMainContent: joi.boolean().default(true),
    includeTags: joi.array().items(joi.string()).default([]),
    excludeTags: joi.array().items(joi.string()).default(['nav', 'footer', 'header', '.sidebar']),
    waitFor: joi.number().min(1000).max(30000).default(3000),
    timeout: joi.number().min(5000).max(60000).default(30000),
    screenshot: joi.boolean().default(false),
    fullPageScreenshot: joi.boolean().default(false),
    saveToFile: joi.boolean().default(false),
    saveDirectory: joi.string().pattern(/^[a-zA-Z0-9_\-\/]+$/).allow('').optional()
  }).default({})
});

// Validation schema for Firecrawl batch request
const firecrawlBatchSchema = joi.object({
  urls: joi.array().items(joi.string().uri()).min(1).max(25).required(), // Lower limit due to Firecrawl rate limits
  options: joi.object({
    concurrent: joi.number().min(1).max(5).default(3), // Lower concurrency for Firecrawl
    formats: joi.array().items(joi.string().valid('markdown', 'html')).default(['markdown']),
    onlyMainContent: joi.boolean().default(true),
    includeTags: joi.array().items(joi.string()).default([]),
    excludeTags: joi.array().items(joi.string()).default(['nav', 'footer', 'header', '.sidebar']),
    waitFor: joi.number().min(1000).max(30000).default(3000),
    timeout: joi.number().min(5000).max(60000).default(30000),
    screenshot: joi.boolean().default(false),
    saveToFile: joi.boolean().default(false),
    saveDirectory: joi.string().pattern(/^[a-zA-Z0-9_\-\/]+$/).allow('').optional()
  }).default({})
});

// Validation schema for Firecrawl crawl request
const firecrawlCrawlSchema = joi.object({
  url: joi.string().uri().required(),
  options: joi.object({
    limit: joi.number().min(1).max(1000).default(100),
    formats: joi.array().items(joi.string().valid('markdown', 'html')).default(['markdown']),
    onlyMainContent: joi.boolean().default(true),
    includeTags: joi.array().items(joi.string()).default([]),
    excludeTags: joi.array().items(joi.string()).default(['nav', 'footer', 'header', '.sidebar']),
    waitFor: joi.number().min(1000).max(30000).default(3000),
    excludePaths: joi.array().items(joi.string()).optional(),
    includePaths: joi.array().items(joi.string()).optional(),
    maxDepth: joi.number().min(1).max(10).optional(),
    saveToFile: joi.boolean().default(false),
    saveDirectory: joi.string().pattern(/^[a-zA-Z0-9_\-\/]+$/).allow('').optional()
  }).default({})
});

// Validation schema for Firecrawl map request
const firecrawlMapSchema = joi.object({
  url: joi.string().uri().required(),
  options: joi.object({
    search: joi.string().allow('').optional(),
    limit: joi.number().min(1).max(1000).optional(),
    saveToFile: joi.boolean().default(false),
    saveDirectory: joi.string().pattern(/^[a-zA-Z0-9_\-\/]+$/).allow('').optional()
  }).default({})
});

// Initialize Firecrawl service
let firecrawlService = null;

const initializeFirecrawlService = () => {
  if (!firecrawlService) {
    try {
      firecrawlService = new FirecrawlService();
    } catch (error) {
      console.error('Failed to initialize Firecrawl service:', error.message);
      throw error;
    }
  }
  return firecrawlService;
};

// Helper functions (reuse from extract.js)
const createSafeFilename = (url, title) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, '_');
    const pathname = urlObj.pathname.replace(/[\/\\?%*:|"<>]/g, '_');
    
    if (title) {
      const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 50);
      return `${safeTitle}_${hostname}${pathname}`.replace(/_{2,}/g, '_').replace(/_$/, '');
    }
    
    return `${hostname}${pathname}`.replace(/_{2,}/g, '_').replace(/_$/, '');
  } catch (error) {
    return `firecrawl_content_${Date.now()}`;
  }
};

const getDefaultDirectory = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `firecrawl_${year}-${month}-${day}`;
};

/**
 * @swagger
 * /api/firecrawl/extract:
 *   post:
 *     tags: [Firecrawl]
 *     summary: Extract content using Firecrawl API
 *     description: Extract content from a single URL using Firecrawl's advanced crawling capabilities
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: "https://docs.example.com/guide"
 *               options:
 *                 type: object
 *                 properties:
 *                   formats:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [markdown, html]
 *                     default: ["markdown"]
 *                   onlyMainContent:
 *                     type: boolean
 *                     default: true
 *                   waitFor:
 *                     type: number
 *                     minimum: 1000
 *                     maximum: 30000
 *                     default: 3000
 *                   screenshot:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       200:
 *         description: Content extracted successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Extraction failed
 */
router.post('/extract', async (req, res) => {
  try {
    // Validate request
    const { error, value } = firecrawlExtractSchema.validate(req.body);
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
    
    // Initialize Firecrawl service
    const firecrawl = initializeFirecrawlService();
    
    // Extract content
    const result = await firecrawl.extractUrl(url, options);
    
    if (result.success) {
      // Save to file if requested
      let savedFilePath = null;
      if (options.saveToFile) {
        try {
          const directoryName = options.saveDirectory || getDefaultDirectory();
          const saveDir = path.join(process.cwd(), directoryName);
          await fs.mkdir(saveDir, { recursive: true });
          
          const filename = createSafeFilename(url, result.data.title) + '.md';
          const filePath = path.join(saveDir, filename);
          
          const markdownContent = `---
title: ${result.data.title || 'Untitled'}
url: ${result.data.url}
provider: firecrawl
extractedAt: ${result.data.extractedAt}
---

${result.data.markdown}`;
          
          await fs.writeFile(filePath, markdownContent, 'utf8');
          savedFilePath = path.relative(process.cwd(), filePath);
        } catch (fileError) {
          req.app.locals.logger && req.app.locals.logger.error('Failed to save Firecrawl file', {
            url,
            error: fileError.message
          });
        }
      }
      
      // Log successful extraction
      req.app.locals.logger && req.app.locals.logger.info('Firecrawl content extracted successfully', {
        url,
        processingTime: result.data.metadata.processingTime,
        contentLength: result.data.markdown.length,
        provider: 'firecrawl',
        savedToFile: options.saveToFile,
        savedFilePath,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      const responseData = {
        success: true,
        data: result.data
      };
      
      if (savedFilePath) {
        responseData.data.savedToFile = true;
        responseData.data.savedFilePath = savedFilePath;
      }
      
      return res.json(responseData);
    } else {
      // Log failed extraction
      req.app.locals.logger && req.app.locals.logger.error('Firecrawl content extraction failed', {
        url,
        error: result.error.message,
        provider: 'firecrawl',
        processingTime: result.error.processingTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to extract content with Firecrawl',
          details: result.error.message,
          url,
          provider: 'firecrawl',
          processingTime: result.error.processingTime
        }
      });
    }
    
  } catch (error) {
    // Handle service initialization errors
    if (error.message.includes('API key')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Firecrawl API key not configured',
          details: 'Please set FIRECRAWL_API_KEY in environment variables'
        }
      });
    }
    
    req.app.locals.logger && req.app.locals.logger.error('Unexpected error in Firecrawl extract endpoint', {
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
 * /api/firecrawl/batch:
 *   post:
 *     tags: [Firecrawl]
 *     summary: Extract content from multiple URLs using Firecrawl
 *     description: Batch process multiple URLs with Firecrawl API
 */
router.post('/batch', async (req, res) => {
  try {
    const { error, value } = firecrawlBatchSchema.validate(req.body);
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
    
    const firecrawl = initializeFirecrawlService();
    const result = await firecrawl.extractMultipleUrls(urls, options);
    
    // Save files if requested
    if (options.saveToFile) {
      const directoryName = options.saveDirectory || getDefaultDirectory();
      const saveDir = path.join(process.cwd(), directoryName);
      await fs.mkdir(saveDir, { recursive: true });
      
      // Save each successful result to a file
      for (const res of result.results) {
        if (res.success && res.data) {
          try {
            const filename = createSafeFilename(res.data.url, res.data.title) + '.md';
            const filePath = path.join(saveDir, filename);
            
            const markdownContent = `---
title: ${res.data.title || 'Untitled'}
url: ${res.data.url}
provider: firecrawl
extractedAt: ${res.data.extractedAt}
---

${res.data.markdown}`;
            
            await fs.writeFile(filePath, markdownContent, 'utf8');
            res.data.savedToFile = true;
            res.data.savedFilePath = path.relative(process.cwd(), filePath);
          } catch (fileError) {
            req.app.locals.logger && req.app.locals.logger.error('Failed to save batch file', {
              url: res.data.url,
              error: fileError.message
            });
          }
        }
      }
    }
    
    req.app.locals.logger && req.app.locals.logger.info('Firecrawl batch processing completed', {
      urlCount: urls.length,
      successful: result.summary.successful,
      failed: result.summary.failed,
      provider: 'firecrawl',
      saveToFile: options.saveToFile,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    return res.json({
      success: true,
      data: {
        results: result.results,
        summary: result.summary,
        processedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    if (error.message.includes('API key')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Firecrawl API key not configured',
          details: 'Please set FIRECRAWL_API_KEY in environment variables'
        }
      });
    }
    
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
 * /api/firecrawl/health:
 *   get:
 *     tags: [Firecrawl]
 *     summary: Firecrawl service health check
 */
router.get('/health', async (req, res) => {
  try {
    const firecrawl = initializeFirecrawlService();
    const healthStatus = await firecrawl.healthCheck();
    
    return res.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    if (error.message.includes('API key')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Firecrawl API key not configured',
          details: 'Please set FIRECRAWL_API_KEY in environment variables'
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Firecrawl health check failed',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/firecrawl/stats:
 *   get:
 *     tags: [Firecrawl]
 *     summary: Get Firecrawl service statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const firecrawl = initializeFirecrawlService();
    const stats = firecrawl.getStats();
    
    return res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    if (error.message.includes('API key')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Firecrawl API key not configured',
          details: 'Please set FIRECRAWL_API_KEY in environment variables'
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get Firecrawl stats',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/firecrawl/map:
 *   post:
 *     tags: [Firecrawl]
 *     summary: Map website URLs using Firecrawl
 *     description: Extract all URLs from a website with optional search filtering
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: "https://docs.example.com"
 *               options:
 *                 type: object
 *                 properties:
 *                   search:
 *                     type: string
 *                     description: Search query to filter URLs
 *                     example: "api"
 *                   limit:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 1000
 *                     description: Maximum number of URLs to return
 *                   saveToFile:
 *                     type: boolean
 *                     default: false
 *                   saveDirectory:
 *                     type: string
 *     responses:
 *       200:
 *         description: Website mapped successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Mapping failed
 */
router.post('/map', async (req, res) => {
  try {
    // Validate request
    const { error, value } = firecrawlMapSchema.validate(req.body);
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
    
    // Initialize Firecrawl service
    const firecrawl = initializeFirecrawlService();
    
    // Map website
    const result = await firecrawl.mapWebsite(url, options);
    
    if (result.success) {
      // Save to file if requested
      let savedFilePath = null;
      if (options.saveToFile) {
        try {
          const directoryName = options.saveDirectory || getDefaultDirectory();
          const saveDir = path.join(process.cwd(), directoryName);
          await fs.mkdir(saveDir, { recursive: true });
          
          const filename = createSafeFilename(url, 'sitemap') + '_links.json';
          const filePath = path.join(saveDir, filename);
          
          const jsonContent = {
            baseUrl: result.data.baseUrl,
            search: result.data.summary.search,
            totalLinks: result.data.summary.totalLinks,
            mappedAt: result.data.mappedAt,
            links: result.data.links
          };
          
          await fs.writeFile(filePath, JSON.stringify(jsonContent, null, 2), 'utf8');
          savedFilePath = path.relative(process.cwd(), filePath);
        } catch (fileError) {
          req.app.locals.logger && req.app.locals.logger.error('Failed to save Firecrawl map file', {
            url,
            error: fileError.message
          });
        }
      }
      
      // Log successful mapping
      req.app.locals.logger && req.app.locals.logger.info('Firecrawl website mapped successfully', {
        url,
        search: options.search,
        totalLinks: result.data.summary.totalLinks,
        processingTime: result.data.summary.processingTime,
        provider: 'firecrawl',
        savedToFile: options.saveToFile,
        savedFilePath,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      const responseData = {
        success: true,
        data: result.data
      };
      
      if (savedFilePath) {
        responseData.data.savedToFile = true;
        responseData.data.savedFilePath = savedFilePath;
      }
      
      return res.json(responseData);
    } else {
      // Log failed mapping
      req.app.locals.logger && req.app.locals.logger.error('Firecrawl website mapping failed', {
        url,
        error: result.error.message,
        provider: 'firecrawl',
        processingTime: result.error.processingTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to map website with Firecrawl',
          details: result.error.message,
          url,
          provider: 'firecrawl',
          processingTime: result.error.processingTime
        }
      });
    }
    
  } catch (error) {
    // Handle service initialization errors
    if (error.message.includes('API key')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Firecrawl API key not configured',
          details: 'Please set FIRECRAWL_API_KEY in environment variables'
        }
      });
    }
    
    req.app.locals.logger && req.app.locals.logger.error('Unexpected error in Firecrawl map endpoint', {
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

module.exports = router;