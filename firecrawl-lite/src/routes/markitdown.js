const express = require('express');
const joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
const MarkitdownService = require('../services/markitdown.service');

const router = express.Router();

// Validation schema for Markitdown extract request
const markitdownExtractSchema = joi.object({
  url: joi.string().uri().required(),
  options: joi.object({
    condaEnv: joi.string().pattern(/^[a-zA-Z0-9_-]+$/).default('py312-tools'),
    extractImages: joi.boolean().default(true),
    extractLinks: joi.boolean().default(true),
    extractTables: joi.boolean().default(true),
    customTimeout: joi.number().min(10).max(300).optional(), // 10-300 seconds
    userAgent: joi.string().max(200).optional(),
    timeout: joi.number().min(30000).max(300000).default(60000), // 30s - 5min
    saveToFile: joi.boolean().default(false),
    saveDirectory: joi.string().pattern(/^[a-zA-Z0-9_\-\/]+$/).allow('').optional()
  }).default({})
});

// Validation schema for environment check
const envCheckSchema = joi.object({
  condaEnv: joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required()
});

// Initialize Markitdown service
let markitdownService = null;

const initializeMarkitdownService = (options = {}) => {
  if (!markitdownService) {
    markitdownService = new MarkitdownService(options);
  }
  return markitdownService;
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
    return `markitdown_content_${Date.now()}`;
  }
};

const getDefaultDirectory = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `markitdown_${year}-${month}-${day}`;
};

/**
 * @swagger
 * /api/markitdown/extract:
 *   post:
 *     tags: [Markitdown]
 *     summary: Extract content using Markitdown
 *     description: Extract content from a single URL using Microsoft's markitdown tool with conda environment support
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
 *                   condaEnv:
 *                     type: string
 *                     default: "py312-tools"
 *                     example: "py312-tools"
 *                   extractImages:
 *                     type: boolean
 *                     default: true
 *                   extractLinks:
 *                     type: boolean
 *                     default: true
 *                   extractTables:
 *                     type: boolean
 *                     default: true
 *                   customTimeout:
 *                     type: number
 *                     minimum: 10
 *                     maximum: 300
 *                     description: "Timeout in seconds for markitdown command"
 *                   userAgent:
 *                     type: string
 *                     maxLength: 200
 *                     description: "Custom user agent string"
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
    const { error, value } = markitdownExtractSchema.validate(req.body);
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
    
    // Initialize Markitdown service
    const markitdown = initializeMarkitdownService({
      condaEnv: options.condaEnv,
      timeout: options.timeout
    });
    
    // Extract content
    const result = await markitdown.extractUrl(url, options);
    
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
provider: markitdown
condaEnv: ${options.condaEnv}
extractedAt: ${result.data.extractedAt}
---

${result.data.markdown}`;
          
          await fs.writeFile(filePath, markdownContent, 'utf8');
          savedFilePath = path.relative(process.cwd(), filePath);
        } catch (fileError) {
          req.app.locals.logger && req.app.locals.logger.error('Failed to save Markitdown file', {
            url,
            error: fileError.message
          });
        }
      }
      
      // Log successful extraction
      req.app.locals.logger && req.app.locals.logger.info('Markitdown content extracted successfully', {
        url,
        processingTime: result.data.metadata.processingTime,
        contentLength: result.data.markdown.length,
        provider: 'markitdown',
        condaEnv: options.condaEnv,
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
      req.app.locals.logger && req.app.locals.logger.error('Markitdown content extraction failed', {
        url,
        error: result.error.message,
        provider: 'markitdown',
        processingTime: result.error.processingTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to extract content with Markitdown',
          details: result.error.message,
          url,
          provider: 'markitdown',
          processingTime: result.error.processingTime
        }
      });
    }
    
  } catch (error) {
    req.app.locals.logger && req.app.locals.logger.error('Unexpected error in Markitdown extract endpoint', {
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
 * /api/markitdown/health:
 *   get:
 *     tags: [Markitdown]
 *     summary: Markitdown service health check
 *     description: Check the health status of the markitdown service, conda environment, and tool installation
 */
router.get('/health', async (req, res) => {
  try {
    const markitdown = initializeMarkitdownService();
    const healthStatus = await markitdown.healthCheck();
    
    return res.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Markitdown health check failed',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/markitdown/stats:
 *   get:
 *     tags: [Markitdown]
 *     summary: Get Markitdown service statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const markitdown = initializeMarkitdownService();
    const stats = markitdown.getStats();
    
    return res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get Markitdown stats',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/markitdown/check-env:
 *   post:
 *     tags: [Markitdown]
 *     summary: Check conda environment and markitdown installation
 *     description: Verify if the specified conda environment exists and has markitdown installed
 */
router.post('/check-env', async (req, res) => {
  try {
    const { error, value } = envCheckSchema.validate(req.body);
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

    const { condaEnv } = value;
    const markitdown = initializeMarkitdownService();
    
    // Check environment
    const envCheck = await markitdown.checkEnvironment(condaEnv);
    
    // Check markitdown installation
    const markitdownCheck = await markitdown.checkMarkitdownInstallation(condaEnv);
    
    return res.json({
      success: true,
      data: {
        condaEnv,
        environment: envCheck,
        markitdown: markitdownCheck,
        overall: envCheck.exists && markitdownCheck.installed ? 'ready' : 'not-ready',
        checkedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Environment check failed',
        details: error.message
      }
    });
  }
});

module.exports = router;