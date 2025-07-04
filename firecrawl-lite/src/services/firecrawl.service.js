const FirecrawlApp = require('@mendable/firecrawl-js').default;

class FirecrawlService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.FIRECRAWL_API_KEY;
    this.baseUrl = options.baseUrl || process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev';
    
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is required. Please set FIRECRAWL_API_KEY in environment variables.');
    }
    
    this.client = new FirecrawlApp({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl
    });
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };
  }

  async extractUrl(url, options = {}) {
    const startTime = Date.now();
    
    try {
      this.stats.totalRequests++;
      
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL provided');
      }
      
      // Prepare Firecrawl options
      const firecrawlOptions = {
        formats: options.formats || ['markdown'],
        onlyMainContent: options.onlyMainContent !== false,
        includeTags: options.includeTags || [],
        excludeTags: options.excludeTags || ['nav', 'footer', 'header', '.sidebar'],
        waitFor: options.waitFor || 3000,
        timeout: options.timeout || 30000,
        ...(options.screenshot && { screenshot: options.screenshot }),
        ...(options.fullPageScreenshot && { fullPageScreenshot: options.fullPageScreenshot })
      };
      
      console.log(`Firecrawl: Scraping ${url}...`);
      const result = await this.client.scrapeUrl(url, firecrawlOptions);
      
      if (!result.success) {
        throw new Error(result.error || 'Firecrawl scraping failed');
      }
      
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`Firecrawl: Successfully processed ${url} in ${processingTime}ms`);
      
      return {
        success: true,
        data: {
          url,
          title: result.metadata?.title || '',
          markdown: result.markdown || '',
          html: result.html || '',
          metadata: {
            ...result.metadata,
            processingTime,
            provider: 'firecrawl',
            wordCount: this.countWords(result.markdown || ''),
            readingTime: this.calculateReadingTime(result.markdown || '')
          },
          screenshot: result.screenshot,
          extractedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error(`Firecrawl: Failed to process ${url}:`, error.message);
      
      return {
        success: false,
        error: {
          message: error.message,
          url,
          processingTime,
          provider: 'firecrawl',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async extractMultipleUrls(urls, options = {}) {
    const concurrent = Math.min(options.concurrent || 3, urls.length, 10); // Firecrawl has rate limits
    const results = [];
    
    console.log(`Firecrawl: Starting batch crawl of ${urls.length} URLs with concurrency: ${concurrent}`);
    
    // Process URLs in batches
    for (let i = 0; i < urls.length; i += concurrent) {
      const batch = urls.slice(i, i + concurrent);
      
      console.log(`Firecrawl: Processing batch ${Math.floor(i / concurrent) + 1} (${batch.length} URLs)`);
      
      const batchPromises = batch.map(url => this.extractUrl(url, options));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Brief pause between batches to respect rate limits
      if (i + concurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Firecrawl: Batch crawl completed. Successful: ${successful}, Failed: ${failed}`);
    
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

  async crawlWebsite(url, options = {}) {
    const startTime = Date.now();
    
    try {
      this.stats.totalRequests++;
      
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL provided');
      }
      
      // Prepare crawl options
      const crawlOptions = {
        limit: options.limit || 100,
        scrapeOptions: {
          formats: options.formats || ['markdown'],
          onlyMainContent: options.onlyMainContent !== false,
          includeTags: options.includeTags || [],
          excludeTags: options.excludeTags || ['nav', 'footer', 'header', '.sidebar'],
          waitFor: options.waitFor || 3000
        },
        ...(options.excludePaths && { excludePaths: options.excludePaths }),
        ...(options.includePaths && { includePaths: options.includePaths }),
        ...(options.maxDepth && { maxDepth: options.maxDepth })
      };
      
      console.log(`Firecrawl: Starting crawl of ${url}...`);
      const crawlResult = await this.client.crawlUrl(url, crawlOptions);
      
      if (!crawlResult.success) {
        throw new Error(crawlResult.error || 'Firecrawl crawling failed');
      }
      
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`Firecrawl: Successfully crawled ${url} (${crawlResult.data?.length || 0} pages) in ${processingTime}ms`);
      
      return {
        success: true,
        data: {
          baseUrl: url,
          pages: crawlResult.data || [],
          summary: {
            totalPages: crawlResult.data?.length || 0,
            processingTime,
            provider: 'firecrawl'
          },
          crawledAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error(`Firecrawl: Failed to crawl ${url}:`, error.message);
      
      return {
        success: false,
        error: {
          message: error.message,
          url,
          processingTime,
          provider: 'firecrawl',
          timestamp: new Date().toISOString()
        }
      };
    }
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

  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  calculateReadingTime(text, wordsPerMinute = 200) {
    const wordCount = this.countWords(text);
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min read`;
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      provider: 'firecrawl',
      apiEndpoint: this.baseUrl
    };
  }

  async healthCheck() {
    try {
      // Test with a simple URL
      const testResult = await this.extractUrl('https://example.com', { 
        timeout: 10000,
        onlyMainContent: true 
      });
      
      return {
        status: testResult.success ? 'healthy' : 'unhealthy',
        provider: 'firecrawl',
        testScrape: testResult.success,
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'firecrawl',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = FirecrawlService;