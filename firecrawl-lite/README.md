# Firecrawl Lite

A lightweight web content extraction and Markdown conversion service built with Playwright, Readability, and Turndown.

## Features

- 🌐 Web content extraction using Playwright browser automation
- 📄 Intelligent content extraction with Mozilla Readability algorithm
- 🔄 HTML to Markdown conversion with Turndown
- ⚡ Browser pool management for optimal performance
- 🚀 REST API with comprehensive error handling
- 📊 Request rate limiting and security middleware
- 📝 Structured logging with Winston

## Quick Start

### Installation

```bash
cd firecrawl-lite
npm install
```

### Start the server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on port 3000 by default.

### API Documentation

Interactive API documentation is available via Swagger UI:

- 📖 **Swagger UI**: http://localhost:3000/docs
- 📋 **API Docs**: http://localhost:3000/api-docs

The Swagger interface allows you to:
- View detailed API specifications
- Test endpoints directly in the browser
- See request/response examples
- Understand parameter requirements

### API Usage

#### Extract single URL

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "options": {
      "includeImages": true,
      "format": "markdown"
    }
  }'
```

#### Batch extraction

```bash
curl -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/article1",
      "https://example.com/article2"
    ],
    "options": {
      "concurrent": 3
    }
  }'
```

#### Health check

```bash
curl http://localhost:3000/api/health
```

#### Service statistics

```bash
curl http://localhost:3000/api/extract/stats
```

### Testing with Swagger UI

1. Start the server: `npm start`
2. Open [http://localhost:3000/docs](http://localhost:3000/docs) in your browser
3. Click on any endpoint to expand it
4. Click the "Try it out" button
5. Fill in the request parameters
6. Click "Execute" to test the API

**Example payloads for testing:**

**Single URL extraction:**
```json
{
  "url": "https://httpbin.org/html",
  "options": {
    "includeImages": false,
    "format": "markdown",
    "timeout": 15000
  }
}
```

**Batch processing:**
```json
{
  "urls": [
    "https://httpbin.org/html",
    "https://example.com"
  ],
  "options": {
    "concurrent": 2,
    "includeImages": false
  }
}
```

## Configuration

Configuration files are located in the `config/` directory:
- `development.json` - Development environment settings
- `production.json` - Production environment settings

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `BROWSER_POOL_SIZE` - Number of browser instances
- `REDIS_URL` - Redis connection URL
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Development

```bash
# Start in development mode with auto-restart
npm run dev

# Run tests
npm test

# Check application health
curl http://localhost:3000/api/health
```

## Architecture

- **Browser Pool**: Manages Playwright browser instances for optimal resource usage
- **Content Extractor**: Uses Mozilla Readability for intelligent content extraction
- **Markdown Converter**: Converts HTML to clean Markdown with Turndown
- **Crawler Service**: Orchestrates the extraction pipeline
- **REST API**: Express.js server with comprehensive middleware

## License

ISC