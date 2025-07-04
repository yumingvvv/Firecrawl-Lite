const BrowserPool = require('../core/browser-pool');
const ContentExtractor = require('../core/extractor');
const MarkdownConverter = require('../core/converter');

class CrawlerService {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      concurrent: 1,
      ...options
    };
    
    this.browserPool = new BrowserPool(options.browser || {});
    this.extractor = new ContentExtractor(options.extraction || {});
    this.converter = new MarkdownConverter(options.conversion || {});
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };
  }

  async initialize() {
    await this.browserPool.initialize();
    console.log('Crawler service initialized');
  }

  async crawlUrl(url, options = {}) {
    const startTime = Date.now();
    let browser = null;
    let page = null;
    let context = null;
    
    try {
      this.stats.totalRequests++;
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL provided');
      }
      
      // Get browser from pool
      browser = await this.browserPool.getBrowser();
      
      // Create page with context
      const { page: newPage, context: newContext } = await this.browserPool.getPage(browser);
      page = newPage;
      context = newContext;
      
      // Configure page
      await this.configurePage(page, options);
      
      // Navigate to URL
      console.log(`Navigating to: ${url}`);
      const response = await page.goto(url, {
        waitUntil: options.waitUntil || ['networkidle0', 'domcontentloaded'],
        timeout: this.options.timeout
      });
      
      // Check if navigation was successful
      if (!response || !response.ok()) {
        throw new Error(`Navigation failed with status: ${response ? response.status() : 'unknown'}`);
      }
      
      // Extract content
      console.log('Extracting content...');
      const extractedContent = await this.extractor.extractWithRetry(page, url, this.options.maxRetries);
      
      // Convert to markdown
      console.log('Converting to markdown...');
      const markdownResult = await this.converter.convertToMarkdown(
        extractedContent.content,
        { baseUrl: url, ...options.conversion }
      );
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`Successfully processed ${url} in ${processingTime}ms`);
      
      return {
        success: true,
        data: {
          url,
          title: extractedContent.title,
          markdown: markdownResult.markdown,
          metadata: {
            ...extractedContent.metadata,
            processingTime,
            markdownStats: {
              wordCount: markdownResult.wordCount,
              characterCount: markdownResult.characterCount
            }
          },
          extractedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error(`Failed to process ${url}:`, error.message);
      
      return {
        success: false,
        error: {
          message: error.message,
          url,
          processingTime,
          timestamp: new Date().toISOString()
        }
      };
      
    } finally {
      // Clean up resources
      if (page) {
        await page.close().catch(e => console.error('Error closing page:', e));
      }
      if (context) {
        await context.close().catch(e => console.error('Error closing context:', e));
      }
      if (browser) {
        this.browserPool.releaseBrowser(browser);
      }
    }
  }

  async configurePage(page, options = {}) {
    // Set custom timeout
    page.setDefaultTimeout(this.options.timeout);
    
    // Block unnecessary resources if specified
    if (options.blockResources) {
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const blockedTypes = options.blockResources || [];
        
        if (blockedTypes.includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }
    
    // Set cookies if provided
    if (options.cookies) {
      await page.context().addCookies(options.cookies);
    }
    
    // Set additional headers
    if (options.headers) {
      await page.setExtraHTTPHeaders(options.headers);
    }
    
    // Handle JavaScript errors
    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
    });
    
    // Handle console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
  }

  async crawlMultipleUrls(urls, options = {}) {
    const concurrent = Math.min(options.concurrent || this.options.concurrent, urls.length);
    const results = [];
    
    console.log(`Starting batch crawl of ${urls.length} URLs with concurrency: ${concurrent}`);
    
    // Process URLs in batches
    for (let i = 0; i < urls.length; i += concurrent) {
      const batch = urls.slice(i, i + concurrent);
      
      console.log(`Processing batch ${Math.floor(i / concurrent) + 1} (${batch.length} URLs)`);
      
      const batchPromises = batch.map(url => this.crawlUrl(url, options));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Brief pause between batches to avoid overwhelming the server
      if (i + concurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Batch crawl completed. Successful: ${successful}, Failed: ${failed}`);
    
    return {
      success: true,
      results,
      summary: {
        total: urls.length,
        successful,
        failed,
        successRate: (successful / urls.length * 100).toFixed(2) + '%'
      }
    };
  }

  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  updateStats(processingTime, success) {
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = Math.round(this.stats.totalProcessingTime / this.stats.totalRequests);
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      browserPoolStats: this.browserPool.getStats()
    };
  }

  async healthCheck() {
    try {
      const browserHealth = await this.browserPool.healthCheck();
      const testUrl = 'data:text/html,<html><body><h1>Health Check</h1></body></html>';
      
      const result = await this.crawlUrl(testUrl);
      
      return {
        status: 'healthy',
        browserPool: browserHealth,
        testCrawl: result.success,
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async shutdown() {
    console.log('Shutting down crawler service...');
    await this.browserPool.shutdown();
    console.log('Crawler service shutdown completed');
  }
}

module.exports = CrawlerService;