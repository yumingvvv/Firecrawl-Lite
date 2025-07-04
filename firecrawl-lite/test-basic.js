const CrawlerService = require('./src/services/crawler.service');

async function testBasicFunctionality() {
  console.log('🧪 Testing basic functionality...');
  
  try {
    // Initialize crawler service
    const crawler = new CrawlerService({
      browser: {
        poolSize: 2,
        headless: true
      }
    });
    
    await crawler.initialize();
    console.log('✅ Crawler service initialized');
    
    // Test with a simple web page
    const testUrl = 'https://httpbin.org/html';
    
    console.log('🔍 Testing content extraction...');
    const result = await crawler.crawlUrl(testUrl);
    
    if (result.success) {
      console.log('✅ Content extraction successful');
      console.log('📄 Title:', result.data.title);
      console.log('📝 Markdown preview:', result.data.markdown.substring(0, 100) + '...');
      console.log('📊 Word count:', result.data.metadata.markdownStats.wordCount);
    } else {
      console.log('❌ Content extraction failed:', result.error.message);
    }
    
    // Test health check
    console.log('🏥 Testing health check...');
    const health = await crawler.healthCheck();
    console.log('✅ Health check:', health.status);
    
    // Shutdown
    await crawler.shutdown();
    console.log('🛑 Crawler service shutdown');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testBasicFunctionality().catch(console.error);