const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = {};
    this.environment = process.env.NODE_ENV || 'development';
    this.loadConfig();
  }

  loadConfig() {
    try {
      // Load environment-specific config
      const configFile = path.join(__dirname, '../../config', `${this.environment}.json`);
      
      if (fs.existsSync(configFile)) {
        const configData = fs.readFileSync(configFile, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        console.warn(`Config file not found: ${configFile}, using defaults`);
        this.loadDefaultConfig();
      }
      
      // Override with environment variables
      this.applyEnvironmentOverrides();
      
      console.log(`Configuration loaded for environment: ${this.environment}`);
      
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.loadDefaultConfig();
    }
  }

  loadDefaultConfig() {
    this.config = {
      port: 3000,
      browser: {
        headless: true,
        poolSize: 5,
        timeout: 30000,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        viewport: {
          width: 1280,
          height: 720
        }
      },
      extraction: {
        waitForSelector: null,
        waitTime: 2000,
        includeImages: true,
        includeLinks: true,
        maxContentLength: 1000000
      },
      cache: {
        ttl: 3600,
        maxSize: "100mb",
        redis: {
          host: "localhost",
          port: 6379,
          password: null,
          db: 0
        }
      },
      rateLimit: {
        windowMs: 900000,
        max: 100,
        message: "Too many requests from this IP"
      },
      logging: {
        level: "info",
        filename: "logs/app.log"
      }
    };
  }

  applyEnvironmentOverrides() {
    // Port
    if (process.env.PORT) {
      this.config.port = parseInt(process.env.PORT, 10);
    }
    
    // Browser pool size
    if (process.env.BROWSER_POOL_SIZE) {
      this.config.browser.poolSize = parseInt(process.env.BROWSER_POOL_SIZE, 10);
    }
    
    // Redis connection
    if (process.env.REDIS_URL) {
      const redisUrl = new URL(process.env.REDIS_URL);
      this.config.cache.redis.host = redisUrl.hostname;
      this.config.cache.redis.port = parseInt(redisUrl.port, 10) || 6379;
      if (redisUrl.password) {
        this.config.cache.redis.password = redisUrl.password;
      }
    }
    
    if (process.env.REDIS_HOST) {
      this.config.cache.redis.host = process.env.REDIS_HOST;
    }
    
    if (process.env.REDIS_PORT) {
      this.config.cache.redis.port = parseInt(process.env.REDIS_PORT, 10);
    }
    
    if (process.env.REDIS_PASSWORD) {
      this.config.cache.redis.password = process.env.REDIS_PASSWORD;
    }
    
    // Logging level
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL;
    }
    
    // Rate limiting
    if (process.env.RATE_LIMIT_MAX) {
      this.config.rateLimit.max = parseInt(process.env.RATE_LIMIT_MAX, 10);
    }
    
    // Browser headless mode
    if (process.env.BROWSER_HEADLESS !== undefined) {
      this.config.browser.headless = process.env.BROWSER_HEADLESS === 'true';
    }
  }

  get(key) {
    return key ? this.getNestedProperty(this.config, key) : this.config;
  }

  getNestedProperty(obj, key) {
    return key.split('.').reduce((o, i) => o && o[i], obj);
  }

  set(key, value) {
    this.setNestedProperty(this.config, key, value);
  }

  setNestedProperty(obj, key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
    target[lastKey] = value;
  }

  getEnvironment() {
    return this.environment;
  }

  isDevelopment() {
    return this.environment === 'development';
  }

  isProduction() {
    return this.environment === 'production';
  }

  isTest() {
    return this.environment === 'test';
  }
}

module.exports = new ConfigManager();