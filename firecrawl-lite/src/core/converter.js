const TurndownService = require('turndown');
const { JSDOM } = require('jsdom');

class MarkdownConverter {
  constructor(options = {}) {
    this.options = {
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      preformattedCode: false,
      ...options
    };
    
    this.turndownService = this.initializeTurndownService();
  }

  initializeTurndownService() {
    const turndownService = new TurndownService(this.options);
    
    // Add custom rules
    this.addCustomRules(turndownService);
    
    return turndownService;
  }

  addCustomRules(turndownService) {
    // Custom rule for handling code blocks
    turndownService.addRule('fencedCodeBlock', {
      filter: function (node, options) {
        return (
          options.codeBlockStyle === 'fenced' &&
          node.nodeName === 'PRE' &&
          node.firstChild &&
          node.firstChild.nodeName === 'CODE'
        );
      },
      replacement: function (content, node, options) {
        const className = node.firstChild.className || '';
        const language = (className.match(/language-(\S+)/) || [null, ''])[1];
        
        return (
          '\n\n' + options.fence + language + '\n' +
          node.firstChild.textContent +
          '\n' + options.fence + '\n\n'
        );
      }
    });

    // Custom rule for handling tables
    turndownService.addRule('table', {
      filter: 'table',
      replacement: function (content, node) {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        
        let markdown = '\n\n';
        
        rows.forEach((row, index) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          const cellContents = cells.map(cell => cell.textContent.trim().replace(/\|/g, '\\|'));
          
          markdown += '| ' + cellContents.join(' | ') + ' |\n';
          
          // Add separator after header row
          if (index === 0) {
            markdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
          }
        });
        
        return markdown + '\n';
      }
    });

    // Custom rule for handling images with better alt text
    turndownService.addRule('image', {
      filter: 'img',
      replacement: function (content, node) {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        const title = node.getAttribute('title') || '';
        
        if (!src) return '';
        
        const titlePart = title ? ` "${title}"` : '';
        return `![${alt}](${src}${titlePart})`;
      }
    });

    // Custom rule for handling links with better title handling
    turndownService.addRule('link', {
      filter: 'a',
      replacement: function (content, node) {
        const href = node.getAttribute('href') || '';
        const title = node.getAttribute('title') || '';
        
        if (!href) return content;
        
        const titlePart = title ? ` "${title}"` : '';
        return `[${content}](${href}${titlePart})`;
      }
    });

    // Custom rule for handling blockquotes
    turndownService.addRule('blockquote', {
      filter: 'blockquote',
      replacement: function (content) {
        content = content.replace(/^\n+|\n+$/g, '');
        content = content.replace(/^/gm, '> ');
        return '\n\n' + content + '\n\n';
      }
    });

    // Custom rule for handling horizontal rules
    turndownService.addRule('horizontalRule', {
      filter: 'hr',
      replacement: function () {
        return '\n\n---\n\n';
      }
    });

    // Custom rule for handling subscript and superscript
    turndownService.addRule('subscript', {
      filter: 'sub',
      replacement: function (content) {
        return `<sub>${content}</sub>`;
      }
    });

    turndownService.addRule('superscript', {
      filter: 'sup',
      replacement: function (content) {
        return `<sup>${content}</sup>`;
      }
    });

    // Custom rule for handling strikethrough
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function (content) {
        return `~~${content}~~`;
      }
    });

    // Custom rule for handling keyboard keys
    turndownService.addRule('keyboard', {
      filter: 'kbd',
      replacement: function (content) {
        return `<kbd>${content}</kbd>`;
      }
    });
  }

  async convertToMarkdown(html, options = {}) {
    try {
      // Clean and prepare HTML
      const cleanedHtml = this.cleanHtml(html, options);
      
      // Convert to markdown
      let markdown = this.turndownService.turndown(cleanedHtml);
      
      // Post-process markdown
      markdown = this.postProcessMarkdown(markdown);
      
      return {
        markdown,
        wordCount: this.countWords(markdown),
        characterCount: markdown.length,
        convertedAt: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Markdown conversion failed: ${error.message}`);
    }
  }

  cleanHtml(html, options = {}) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script',
      'style',
      'noscript',
      'iframe',
      'object',
      'embed',
      'video',
      'audio',
      '.advertisement',
      '.ads',
      '.social-share',
      '.comments',
      '[style*="display: none"]',
      '[style*="visibility: hidden"]'
    ];
    
    unwantedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Clean up attributes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      // Remove style attributes
      el.removeAttribute('style');
      
      // Remove onclick and other event handlers
      const attributes = Array.from(el.attributes);
      attributes.forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    // Fix relative URLs if base URL is provided
    if (options.baseUrl) {
      this.fixRelativeUrls(document, options.baseUrl);
    }
    
    // Remove empty paragraphs and divs
    const emptyElements = document.querySelectorAll('p:empty, div:empty');
    emptyElements.forEach(el => el.remove());
    
    return document.body.innerHTML;
  }

  fixRelativeUrls(document, baseUrl) {
    try {
      const base = new URL(baseUrl);
      
      // Fix image URLs
      const images = document.querySelectorAll('img[src]');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('/')) {
          img.setAttribute('src', new URL(src, base).href);
        }
      });
      
      // Fix link URLs
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          link.setAttribute('href', new URL(href, base).href);
        }
      });
      
    } catch (error) {
      console.error('Failed to fix relative URLs:', error);
    }
  }

  postProcessMarkdown(markdown) {
    // Remove excessive whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    
    // Fix spacing around headers
    markdown = markdown.replace(/^(#{1,6}\s.+)$/gm, (match, header) => {
      return `\n${header}\n`;
    });
    
    // Fix spacing around lists
    markdown = markdown.replace(/^(\s*[-*+]\s.+)$/gm, (match, listItem) => {
      return listItem;
    });
    
    // Fix spacing around code blocks
    markdown = markdown.replace(/^```/gm, '\n```');
    markdown = markdown.replace(/```$/gm, '```\n');
    
    // Remove trailing whitespace
    markdown = markdown.replace(/[ \t]+$/gm, '');
    
    // Ensure single newline at end
    markdown = markdown.replace(/\n*$/, '\n');
    
    return markdown.trim();
  }

  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Convert with custom options
  async convertWithOptions(html, customOptions = {}) {
    const tempService = new TurndownService({
      ...this.options,
      ...customOptions
    });
    
    this.addCustomRules(tempService);
    
    const cleanedHtml = this.cleanHtml(html, customOptions);
    let markdown = tempService.turndown(cleanedHtml);
    markdown = this.postProcessMarkdown(markdown);
    
    return {
      markdown,
      wordCount: this.countWords(markdown),
      characterCount: markdown.length,
      convertedAt: new Date().toISOString()
    };
  }

  // Get conversion statistics
  getConversionStats(originalHtml, convertedMarkdown) {
    const htmlDom = new JSDOM(originalHtml);
    const htmlText = htmlDom.window.document.body.textContent || '';
    
    return {
      originalHtmlLength: originalHtml.length,
      originalTextLength: htmlText.length,
      markdownLength: convertedMarkdown.length,
      compressionRatio: (convertedMarkdown.length / originalHtml.length).toFixed(2),
      wordCount: this.countWords(convertedMarkdown),
      originalWordCount: this.countWords(htmlText),
      conversionEfficiency: (this.countWords(convertedMarkdown) / this.countWords(htmlText)).toFixed(2)
    };
  }
}

module.exports = MarkdownConverter;