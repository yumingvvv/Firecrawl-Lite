const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MarkitdownService {
  constructor(options = {}) {
    this.options = {
      condaEnv: options.condaEnv || 'py312-tools',
      timeout: options.timeout || 60000, // 60 seconds
      tempDir: options.tempDir || '/tmp',
      retries: options.retries || 2,
      ...options
    };
    
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
    const requestId = uuidv4();
    
    try {
      this.stats.totalRequests++;
      
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL provided');
      }
      
      console.log(`Markitdown: Processing ${url} with request ID ${requestId}`);
      
      // Create temporary file path
      const tempFilename = `markitdown_${requestId}.md`;
      const tempFilePath = path.join(this.options.tempDir, tempFilename);
      
      // Prepare markitdown command
      const condaEnv = options.condaEnv || this.options.condaEnv;
      const additionalArgs = this.buildMarkitdownArgs(options);
      
      // Execute markitdown command
      const result = await this.executeMarkitdownCommand(url, tempFilePath, condaEnv, additionalArgs);
      
      // Read the generated markdown file
      const markdown = await this.readMarkdownFile(tempFilePath);
      
      // Clean up temporary file
      await this.cleanupTempFile(tempFilePath);
      
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`Markitdown: Successfully processed ${url} in ${processingTime}ms`);
      
      return {
        success: true,
        data: {
          url,
          title: this.extractTitle(markdown),
          markdown: markdown,
          metadata: {
            processingTime,
            provider: 'markitdown',
            condaEnv: condaEnv,
            wordCount: this.countWords(markdown),
            readingTime: this.calculateReadingTime(markdown),
            fileSize: markdown.length
          },
          extractedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error(`Markitdown: Failed to process ${url}:`, error.message);
      
      return {
        success: false,
        error: {
          message: error.message,
          url,
          processingTime,
          provider: 'markitdown',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async executeMarkitdownCommand(url, outputPath, condaEnv, additionalArgs) {
    return new Promise((resolve, reject) => {
      // Build the full command with conda activation
      const command = this.buildCommand(url, outputPath, condaEnv, additionalArgs);
      
      console.log(`Markitdown: Executing command: ${command}`);
      
      const process = exec(command, { 
        timeout: this.options.timeout,
        shell: '/bin/bash' // Ensure we use bash for conda commands
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Markitdown command failed with code ${code}. stderr: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to execute markitdown command: ${error.message}`));
      });
      
      // Handle timeout
      setTimeout(() => {
        if (!process.killed) {
          process.kill();
          reject(new Error(`Markitdown command timed out after ${this.options.timeout}ms`));
        }
      }, this.options.timeout);
    });
  }

  buildCommand(url, outputPath, condaEnv, additionalArgs) {
    // Use the direct conda activation approach that works
    const shellInit = this.getShellInit();
    
    // Build the command string with direct activation
    const baseCommand = `${shellInit} ${condaEnv} && markitdown "${url}" -o "${outputPath}"`;
    
    if (additionalArgs.length > 0) {
      return `${baseCommand} ${additionalArgs.join(' ')}`;
    }
    
    return baseCommand;
  }

  getShellInit() {
    // Use direct conda activation path that we know works
    if (process.env.CONDA_EXE) {
      const condaDir = process.env.CONDA_EXE.replace('/bin/conda', '');
      return `source ${condaDir}/bin/activate`;
    }
    
    // Try common conda installation paths
    const commonPaths = [
      '/opt/anaconda3/bin/activate',
      '/opt/miniconda3/bin/activate',
      '/usr/local/anaconda3/bin/activate',
      '/usr/local/miniconda3/bin/activate',
      '~/anaconda3/bin/activate',
      '~/miniconda3/bin/activate'
    ];
    
    // Return the first path that might exist
    return `source /opt/anaconda3/bin/activate`;
  }

  buildMarkitdownArgs(options) {
    const args = [];
    
    // Add custom options based on user preferences
    if (options.extractImages === false) {
      args.push('--ignore-images');
    }
    
    if (options.extractLinks === false) {
      args.push('--ignore-links');
    }
    
    if (options.extractTables === false) {
      args.push('--ignore-tables');
    }
    
    if (options.customTimeout) {
      args.push(`--timeout ${options.customTimeout}`);
    }
    
    if (options.userAgent) {
      args.push(`--user-agent "${options.userAgent}"`);
    }
    
    return args;
  }

  async readMarkdownFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read generated markdown file: ${error.message}`);
    }
  }

  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
    }
  }

  extractTitle(markdown) {
    // Extract title from first H1 heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  async checkEnvironment(condaEnv) {
    try {
      const condaCommand = process.env.CONDA_EXE || '/opt/anaconda3/bin/conda';
      const command = `${condaCommand} info --envs | grep "${condaEnv}"`;
      
      return new Promise((resolve) => {
        exec(command, { shell: '/bin/bash' }, (error, stdout, stderr) => {
          if (error) {
            resolve({
              exists: false,
              error: error.message
            });
          } else {
            const envExists = stdout.includes(condaEnv);
            resolve({
              exists: envExists,
              output: stdout
            });
          }
        });
      });
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  async checkMarkitdownInstallation(condaEnv) {
    try {
      const shellInit = this.getShellInit();
      const command = `${shellInit} ${condaEnv} && markitdown --version`;
      
      return new Promise((resolve) => {
        exec(command, { 
          shell: '/bin/bash',
          timeout: 10000 
        }, (error, stdout, stderr) => {
          if (error) {
            resolve({
              installed: false,
              error: error.message
            });
          } else {
            resolve({
              installed: true,
              version: stdout.trim().split('\n')[0] // Take first line only
            });
          }
        });
      });
    } catch (error) {
      return {
        installed: false,
        error: error.message
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
      provider: 'markitdown',
      defaultCondaEnv: this.options.condaEnv
    };
  }

  async healthCheck() {
    try {
      // Check conda environment
      const envCheck = await this.checkEnvironment(this.options.condaEnv);
      
      // Check markitdown installation
      const markitdownCheck = await this.checkMarkitdownInstallation(this.options.condaEnv);
      
      const isHealthy = envCheck.exists && markitdownCheck.installed;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        provider: 'markitdown',
        environment: {
          condaEnv: this.options.condaEnv,
          envExists: envCheck.exists,
          envError: envCheck.error
        },
        markitdown: {
          installed: markitdownCheck.installed,
          version: markitdownCheck.version,
          error: markitdownCheck.error
        },
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'markitdown',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = MarkitdownService;