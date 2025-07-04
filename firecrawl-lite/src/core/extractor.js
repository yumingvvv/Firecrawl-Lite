const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

class ContentExtractor {
  constructor(options = {}) {
    this.options = {
      waitForSelector: options.waitForSelector || null,
      waitTime: options.waitTime || 2000,
      includeImages: options.includeImages !== false,
      includeLinks: options.includeLinks !== false,
      maxContentLength: options.maxContentLength || 1000000,
      timeout: options.timeout || 30000,
      ...options
    };
  }

  async extractContent(page, url) {
    try {
      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for specific selector if provided
      if (this.options.waitForSelector) {
        await page.waitForSelector(this.options.waitForSelector, { 
          timeout: this.options.timeout 
        });
      }
      
      // Additional wait time for dynamic content
      if (this.options.waitTime > 0) {
        await page.waitForTimeout(this.options.waitTime);
      }

      // Get page content
      const content = await page.content();
      const title = await page.title();
      
      // Extract metadata
      const metadata = await this.extractMetadata(page);
      
      // Use Readability for content extraction
      const readableContent = this.extractReadableContent(content, url);
      
      if (!readableContent) {
        throw new Error('Failed to extract readable content');
      }

      // Process content based on options
      const processedContent = this.processContent(readableContent);
      
      return {
        title: readableContent.title || title,
        content: processedContent.content,
        textContent: readableContent.textContent,
        length: readableContent.length,
        excerpt: readableContent.excerpt,
        byline: readableContent.byline,
        dir: readableContent.dir,
        lang: readableContent.lang,
        metadata: {
          ...metadata,
          url,
          extractedAt: new Date().toISOString(),
          wordCount: this.countWords(readableContent.textContent),
          readingTime: this.calculateReadingTime(readableContent.textContent)
        }
      };

    } catch (error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  extractReadableContent(html, url) {
    try {
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;
      
      // Remove script and style tags
      const scripts = document.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());
      
      const reader = new Readability(document);
      const article = reader.parse();
      
      return article;
    } catch (error) {
      console.error('Readability extraction failed:', error);
      return null;
    }
  }

  async extractMetadata(page) {
    const metadata = {};
    
    try {
      // Extract meta tags
      const metaTags = await page.evaluate(() => {
        const metas = Array.from(document.querySelectorAll('meta'));
        const result = {};
        
        metas.forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          
          if (name && content) {
            result[name] = content;
          }
        });
        
        return result;
      });
      
      // Extract structured data
      const structuredData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const data = [];
        
        scripts.forEach(script => {
          try {
            const json = JSON.parse(script.textContent);
            data.push(json);
          } catch (e) {
            // Ignore invalid JSON
          }
        });
        
        return data;
      });
      
      // Extract Open Graph data
      const ogData = {};
      Object.keys(metaTags).forEach(key => {
        if (key.startsWith('og:')) {
          ogData[key.replace('og:', '')] = metaTags[key];
        }
      });
      
      // Extract Twitter Card data
      const twitterData = {};
      Object.keys(metaTags).forEach(key => {
        if (key.startsWith('twitter:')) {
          twitterData[key.replace('twitter:', '')] = metaTags[key];
        }
      });
      
      return {
        ...metaTags,
        openGraph: ogData,
        twitter: twitterData,
        structuredData,
        author: metaTags.author || ogData.author || twitterData.creator,
        description: metaTags.description || ogData.description || twitterData.description,
        keywords: metaTags.keywords,
        publishedTime: metaTags['article:published_time'] || ogData.published_time,
        modifiedTime: metaTags['article:modified_time'] || ogData.modified_time,
        image: ogData.image || twitterData.image,
        siteName: ogData.site_name
      };
      
    } catch (error) {
      console.error('Metadata extraction failed:', error);
      return {};
    }
  }

  processContent(readableContent) {
    let content = readableContent.content;
    
    // Remove unwanted elements
    const dom = new JSDOM(content);
    const document = dom.window.document;
    
    // Remove ads, social media widgets, and other unwanted content
    const unwantedSelectors = [
      '.advertisement',
      '.ads',
      '.social-share',
      '.social-media',
      '.comments',
      '.related-posts',
      '.sidebar',
      '.footer',
      '.header',
      '.navigation',
      '.nav',
      '.menu',
      '[class*="ad-"]',
      '[class*="ads-"]',
      '[id*="ad-"]',
      '[id*="ads-"]'
    ];
    
    unwantedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Process images
    if (!this.options.includeImages) {
      const images = document.querySelectorAll('img');
      images.forEach(img => img.remove());
    } else {
      // Convert relative URLs to absolute
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('/')) {
          // This would need the base URL to work properly
          // For now, we'll leave it as is
        }
      });
    }
    
    // Process links
    if (!this.options.includeLinks) {
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent;
        const textNode = document.createTextNode(text);
        link.parentNode.replaceChild(textNode, link);
      });
    }
    
    // Clean up empty paragraphs and divs
    const emptyElements = document.querySelectorAll('p:empty, div:empty');
    emptyElements.forEach(el => el.remove());
    
    // Trim content length if needed
    content = document.body.innerHTML;
    if (content.length > this.options.maxContentLength) {
      content = content.substring(0, this.options.maxContentLength) + '...';
    }
    
    return {
      content,
      textContent: document.body.textContent,
      processedAt: new Date().toISOString()
    };
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

  async extractWithRetry(page, url, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.extractContent(page, url);
      } catch (error) {
        lastError = error;
        console.log(`Extraction attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }
}

module.exports = ContentExtractor;