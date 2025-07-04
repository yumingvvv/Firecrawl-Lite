const Application = require('./src/app');

async function startDemo() {
  console.log('🚀 Starting Firecrawl Lite with Swagger Documentation...\n');
  
  const app = new Application();
  const server = app.start();
  
  // Give the server a moment to start
  setTimeout(() => {
    console.log('\n📚 Swagger Documentation is now available!');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                                                         │');
    console.log('│  🔗 Swagger UI:    http://localhost:3000/docs          │');
    console.log('│  📋 API Docs:      http://localhost:3000/api-docs      │');
    console.log('│  🏠 API Info:      http://localhost:3000/              │');
    console.log('│  🏥 Health Check:  http://localhost:3000/api/health    │');
    console.log('│                                                         │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n🎯 Available API Endpoints:');
    console.log('  POST /api/extract     - Extract single URL');
    console.log('  POST /api/batch       - Batch extract multiple URLs');
    console.log('  GET  /api/health      - General health check');
    console.log('  GET  /api/extract/health - Service health check');
    console.log('  GET  /api/extract/stats  - Service statistics');
    console.log('\n💡 How to use Swagger UI:');
    console.log('  1. Open http://localhost:3000/docs in your browser');
    console.log('  2. Click on any endpoint to expand it');
    console.log('  3. Click "Try it out" to enable testing');
    console.log('  4. Fill in the parameters and click "Execute"');
    console.log('\n🔧 Example test payload for /api/extract:');
    console.log(JSON.stringify({
      url: "https://httpbin.org/html",
      options: {
        includeImages: false,
        format: "markdown"
      }
    }, null, 2));
    console.log('\n⚡ Press Ctrl+C to stop the server');
    console.log('\n🎉 Happy testing with Swagger UI!');
  }, 2000);
  
  return server;
}

if (require.main === module) {
  startDemo().catch(console.error);
}

module.exports = startDemo;