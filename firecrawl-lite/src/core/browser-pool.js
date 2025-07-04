const { chromium } = require('playwright');
const EventEmitter = require('events');

class BrowserPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.poolSize = options.poolSize || 5;
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.viewport = options.viewport || { width: 1280, height: 720 };
    this.headless = options.headless !== false;
    
    this.browsers = [];
    this.availableBrowsers = [];
    this.busyBrowsers = new Set();
    this.isInitialized = false;
    this.isShuttingDown = false;
    
    this.stats = {
      totalRequests: 0,
      activeRequests: 0,
      restarts: 0,
      errors: 0
    };
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log(`Initializing browser pool with ${this.poolSize} browsers...`);
    
    for (let i = 0; i < this.poolSize; i++) {
      try {
        const browser = await this.createBrowser();
        this.browsers.push(browser);
        this.availableBrowsers.push(browser);
        console.log(`Browser ${i + 1} initialized successfully`);
      } catch (error) {
        console.error(`Failed to initialize browser ${i + 1}:`, error);
        this.stats.errors++;
      }
    }
    
    this.isInitialized = true;
    this.emit('initialized');
    console.log(`Browser pool initialized with ${this.availableBrowsers.length} browsers`);
  }

  async createBrowser() {
    const browser = await chromium.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    browser.on('disconnected', () => {
      this.handleBrowserDisconnect(browser);
    });

    return browser;
  }

  async getBrowser() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isShuttingDown) {
      throw new Error('Browser pool is shutting down');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for available browser'));
      }, this.timeout);

      const tryGetBrowser = () => {
        if (this.availableBrowsers.length > 0) {
          clearTimeout(timeout);
          const browser = this.availableBrowsers.pop();
          this.busyBrowsers.add(browser);
          this.stats.activeRequests++;
          this.stats.totalRequests++;
          resolve(browser);
        } else {
          setTimeout(tryGetBrowser, 100);
        }
      };

      tryGetBrowser();
    });
  }

  async getPage(browser) {
    const context = await browser.newContext({
      userAgent: this.userAgent,
      viewport: this.viewport,
      ignoreHTTPSErrors: true,
      bypassCSP: true
    });

    const page = await context.newPage();
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    return { page, context };
  }

  releaseBrowser(browser) {
    if (this.busyBrowsers.has(browser)) {
      this.busyBrowsers.delete(browser);
      this.stats.activeRequests--;
      
      if (!this.isShuttingDown && browser.isConnected()) {
        this.availableBrowsers.push(browser);
      }
    }
  }

  async handleBrowserDisconnect(browser) {
    console.log('Browser disconnected, removing from pool');
    this.stats.errors++;
    
    const index = this.browsers.indexOf(browser);
    if (index > -1) {
      this.browsers.splice(index, 1);
    }
    
    const availableIndex = this.availableBrowsers.indexOf(browser);
    if (availableIndex > -1) {
      this.availableBrowsers.splice(availableIndex, 1);
    }
    
    this.busyBrowsers.delete(browser);
    
    if (!this.isShuttingDown) {
      try {
        const newBrowser = await this.createBrowser();
        this.browsers.push(newBrowser);
        this.availableBrowsers.push(newBrowser);
        this.stats.restarts++;
        console.log('Browser restarted successfully');
      } catch (error) {
        console.error('Failed to restart browser:', error);
      }
    }
  }

  async healthCheck() {
    const healthyBrowsers = [];
    
    for (const browser of this.browsers) {
      try {
        if (browser.isConnected()) {
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto('data:text/html,<html><body>Health Check</body></html>');
          await page.close();
          await context.close();
          healthyBrowsers.push(browser);
        }
      } catch (error) {
        console.log('Browser health check failed:', error.message);
        this.handleBrowserDisconnect(browser);
      }
    }
    
    return {
      total: this.browsers.length,
      healthy: healthyBrowsers.length,
      available: this.availableBrowsers.length,
      busy: this.busyBrowsers.size,
      stats: this.stats
    };
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    
    console.log('Shutting down browser pool...');
    this.isShuttingDown = true;
    
    const closePromises = this.browsers.map(browser => {
      return browser.close().catch(error => {
        console.error('Error closing browser:', error);
      });
    });
    
    await Promise.all(closePromises);
    
    this.browsers = [];
    this.availableBrowsers = [];
    this.busyBrowsers.clear();
    
    console.log('Browser pool shutdown completed');
    this.emit('shutdown');
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.poolSize,
      totalBrowsers: this.browsers.length,
      availableBrowsers: this.availableBrowsers.length,
      busyBrowsers: this.busyBrowsers.size,
      isInitialized: this.isInitialized,
      isShuttingDown: this.isShuttingDown
    };
  }
}

module.exports = BrowserPool;