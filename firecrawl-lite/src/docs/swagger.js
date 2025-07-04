const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Firecrawl Lite API',
      version: '1.0.0',
      description: 'A lightweight web content extraction and Markdown conversion service',
      contact: {
        name: 'Firecrawl Lite',
        email: 'support@firecrawl-lite.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.firecrawl-lite.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Extract',
        description: 'Content extraction and conversion operations'
      },
      {
        name: 'Health',
        description: 'Service health and monitoring'
      },
      {
        name: 'Stats',
        description: 'Service statistics and metrics'
      }
    ],
    components: {
      schemas: {
        ExtractRequest: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'The URL to extract content from',
              example: 'https://example.com/article'
            },
            options: {
              type: 'object',
              properties: {
                includeImages: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to include images in the output'
                },
                includeLinks: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to include links in the output'
                },
                waitForSelector: {
                  type: 'string',
                  nullable: true,
                  description: 'CSS selector to wait for before extraction'
                },
                timeout: {
                  type: 'integer',
                  minimum: 1000,
                  maximum: 60000,
                  default: 30000,
                  description: 'Timeout in milliseconds'
                },
                format: {
                  type: 'string',
                  enum: ['markdown', 'html'],
                  default: 'markdown',
                  description: 'Output format'
                },
                blockResources: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['stylesheet', 'image', 'media', 'font']
                  },
                  description: 'Resource types to block during page load'
                },
                headers: {
                  type: 'object',
                  additionalProperties: {
                    type: 'string'
                  },
                  description: 'Custom HTTP headers'
                },
                cookies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'value'],
                    properties: {
                      name: { type: 'string' },
                      value: { type: 'string' },
                      domain: { type: 'string' },
                      path: { type: 'string' },
                      httpOnly: { type: 'boolean' },
                      secure: { type: 'boolean' }
                    }
                  }
                },
                conversion: {
                  type: 'object',
                  properties: {
                    headingStyle: {
                      type: 'string',
                      enum: ['atx', 'setext'],
                      default: 'atx'
                    },
                    bulletListMarker: {
                      type: 'string',
                      enum: ['-', '*', '+'],
                      default: '-'
                    },
                    codeBlockStyle: {
                      type: 'string',
                      enum: ['fenced', 'indented'],
                      default: 'fenced'
                    },
                    linkStyle: {
                      type: 'string',
                      enum: ['inlined', 'referenced'],
                      default: 'inlined'
                    }
                  }
                },
                saveToFile: {
                  type: 'boolean',
                  default: false,
                  description: 'Whether to save the extracted content as an MD file'
                },
                saveDirectory: {
                  type: 'string',
                  description: 'Directory name where the MD file will be saved. If not provided, defaults to "extracted_YYYY-MM-DD" format',
                  pattern: '^[a-zA-Z0-9_\\-\\/]+$',
                  example: 'my_docs/extracted'
                }
              }
            }
          }
        },
        BatchRequest: {
          type: 'object',
          required: ['urls'],
          properties: {
            urls: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              minItems: 1,
              maxItems: 50,
              description: 'Array of URLs to extract content from',
              example: ['https://example.com/article1', 'https://example.com/article2']
            },
            options: {
              type: 'object',
              properties: {
                concurrent: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 10,
                  default: 3,
                  description: 'Number of concurrent requests'
                },
                includeImages: {
                  type: 'boolean',
                  default: true
                },
                includeLinks: {
                  type: 'boolean',
                  default: true
                },
                waitForSelector: {
                  type: 'string',
                  nullable: true
                },
                timeout: {
                  type: 'integer',
                  minimum: 1000,
                  maximum: 60000,
                  default: 30000
                },
                format: {
                  type: 'string',
                  enum: ['markdown', 'html'],
                  default: 'markdown'
                },
                blockResources: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['stylesheet', 'image', 'media', 'font']
                  }
                },
                headers: {
                  type: 'object',
                  additionalProperties: {
                    type: 'string'
                  }
                },
                cookies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'value'],
                    properties: {
                      name: { type: 'string' },
                      value: { type: 'string' },
                      domain: { type: 'string' },
                      path: { type: 'string' },
                      httpOnly: { type: 'boolean' },
                      secure: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        ExtractResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://example.com/article'
                },
                title: {
                  type: 'string',
                  example: 'Article Title'
                },
                markdown: {
                  type: 'string',
                  example: '# Article Title\n\nThis is the content...'
                },
                metadata: {
                  type: 'object',
                  properties: {
                    author: { type: 'string' },
                    description: { type: 'string' },
                    keywords: { type: 'string' },
                    publishedTime: { type: 'string' },
                    modifiedTime: { type: 'string' },
                    image: { type: 'string' },
                    siteName: { type: 'string' },
                    url: { type: 'string' },
                    extractedAt: { type: 'string', format: 'date-time' },
                    wordCount: { type: 'integer' },
                    readingTime: { type: 'string' },
                    processingTime: { type: 'integer' },
                    markdownStats: {
                      type: 'object',
                      properties: {
                        wordCount: { type: 'integer' },
                        characterCount: { type: 'integer' }
                      }
                    }
                  }
                },
                extractedAt: {
                  type: 'string',
                  format: 'date-time'
                },
                savedToFile: {
                  type: 'boolean',
                  description: 'Indicates if the content was saved to a file'
                },
                savedFilePath: {
                  type: 'string',
                  description: 'Path where the file was saved (relative to working directory)'
                }
              }
            }
          }
        },
        BatchResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    oneOf: [
                      { $ref: '#/components/schemas/ExtractResponse' },
                      { $ref: '#/components/schemas/ErrorResponse' }
                    ]
                  }
                },
                summary: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    successful: { type: 'integer' },
                    failed: { type: 'integer' },
                    successRate: { type: 'string' },
                    processingTime: { type: 'integer' }
                  }
                },
                processedAt: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'healthy'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                environment: {
                  type: 'string',
                  example: 'development'
                },
                version: {
                  type: 'string',
                  example: '1.0.0'
                },
                uptime: {
                  type: 'number'
                },
                memory: {
                  type: 'object',
                  properties: {
                    rss: { type: 'integer' },
                    heapTotal: { type: 'integer' },
                    heapUsed: { type: 'integer' },
                    external: { type: 'integer' }
                  }
                }
              }
            }
          }
        },
        StatsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                totalRequests: { type: 'integer' },
                successfulRequests: { type: 'integer' },
                failedRequests: { type: 'integer' },
                totalProcessingTime: { type: 'integer' },
                averageProcessingTime: { type: 'integer' },
                successRate: { type: 'string' },
                poolSize: { type: 'integer' },
                totalBrowsers: { type: 'integer' },
                availableBrowsers: { type: 'integer' },
                busyBrowsers: { type: 'integer' },
                isInitialized: { type: 'boolean' },
                isShuttingDown: { type: 'boolean' },
                browserPoolStats: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    healthy: { type: 'integer' },
                    available: { type: 'integer' },
                    busy: { type: 'integer' },
                    stats: {
                      type: 'object',
                      properties: {
                        totalRequests: { type: 'integer' },
                        activeRequests: { type: 'integer' },
                        restarts: { type: 'integer' },
                        errors: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Error message'
                },
                details: {
                  type: 'string'
                },
                url: {
                  type: 'string'
                },
                processingTime: {
                  type: 'integer'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                }
              },
              required: ['message']
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Invalid request parameters'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad Request - Invalid parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        ServiceUnavailable: {
          description: 'Service Unavailable',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Too Many Requests',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/app.js'] // Path to the API files
};

const specs = swaggerJSDoc(options);

module.exports = specs;