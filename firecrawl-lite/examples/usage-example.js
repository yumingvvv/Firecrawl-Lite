const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function exampleUsage() {
  console.log('🚀 Firecrawl Lite Usage Examples\n');

  try {
    // 1. Single URL extraction
    console.log('📝 Example 1: Single URL extraction');
    const singleResult = await axios.post(`${API_BASE}/extract`, {
      url: 'https://news.ycombinator.com',
      options: {
        includeImages: false,
        includeLinks: true,
        format: 'markdown',
        timeout: 10000
      }
    });

    if (singleResult.data.success) {
      console.log('✅ Success!');
      console.log(`📄 Title: ${singleResult.data.data.title}`);
      console.log(`📊 Word count: ${singleResult.data.data.metadata.markdownStats.wordCount}`);
      console.log(`⏱️ Processing time: ${singleResult.data.data.metadata.processingTime}ms`);
      console.log(`📝 Content preview: ${singleResult.data.data.markdown.substring(0, 200)}...\n`);
    }

    // 2. Batch extraction
    console.log('📝 Example 2: Batch URL extraction');
    const batchResult = await axios.post(`${API_BASE}/batch`, {
      urls: [
        'https://httpbin.org/html',
        'https://httpbin.org/json'
      ],
      options: {
        concurrent: 2,
        includeImages: false,
        timeout: 15000
      }
    });

    if (batchResult.data.success) {
      console.log('✅ Batch processing complete!');
      console.log(`📊 Total URLs: ${batchResult.data.data.summary.total}`);
      console.log(`✅ Successful: ${batchResult.data.data.summary.successful}`);
      console.log(`❌ Failed: ${batchResult.data.data.summary.failed}`);
      console.log(`📈 Success rate: ${batchResult.data.data.summary.successRate}`);
      console.log(`⏱️ Total processing time: ${batchResult.data.data.summary.processingTime}ms\n`);
    }

    // 3. Health check
    console.log('📝 Example 3: Health check');
    const healthResult = await axios.get(`${API_BASE}/health`);
    console.log('✅ Server status:', healthResult.data.data.status);
    console.log(`🆙 Uptime: ${Math.round(healthResult.data.data.uptime)} seconds\n`);

    // 4. Service statistics
    console.log('📝 Example 4: Service statistics');
    const statsResult = await axios.get(`${API_BASE}/extract/stats`);
    if (statsResult.data.success) {
      console.log('📊 Service Statistics:');
      console.log(`📈 Total requests: ${statsResult.data.data.totalRequests}`);
      console.log(`✅ Successful: ${statsResult.data.data.successfulRequests}`);
      console.log(`❌ Failed: ${statsResult.data.data.failedRequests}`);
      console.log(`📊 Success rate: ${statsResult.data.data.successRate}`);
      console.log(`⏱️ Average processing time: ${statsResult.data.data.averageProcessingTime}ms`);
    }

    console.log('\n🎉 All examples completed successfully!');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Please make sure the server is running on port 3000.');
      console.log('💡 Start the server with: npm start');
    } else {
      console.error('❌ Error:', error.response?.data?.error?.message || error.message);
    }
  }
}

// Custom extraction with advanced options
async function advancedExample() {
  console.log('\n🔬 Advanced Usage Example\n');

  try {
    const result = await axios.post(`${API_BASE}/extract`, {
      url: 'https://blog.github.com',
      options: {
        includeImages: true,
        includeLinks: true,
        waitTime: 3000,
        timeout: 30000,
        blockResources: ['stylesheet', 'font'],
        conversion: {
          headingStyle: 'atx',
          bulletListMarker: '-',
          codeBlockStyle: 'fenced'
        }
      }
    });

    if (result.data.success) {
      console.log('✅ Advanced extraction successful!');
      console.log(`📄 Title: ${result.data.data.title}`);
      console.log(`🔗 URL: ${result.data.data.url}`);
      console.log(`📊 Metadata:`, JSON.stringify(result.data.data.metadata, null, 2));
    }

  } catch (error) {
    console.error('❌ Advanced example failed:', error.response?.data?.error?.message || error.message);
  }
}

// Run examples
if (require.main === module) {
  exampleUsage()
    .then(() => advancedExample())
    .catch(console.error);
}

module.exports = { exampleUsage, advancedExample };