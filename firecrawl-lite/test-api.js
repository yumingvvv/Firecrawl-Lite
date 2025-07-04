const axios = require('axios');

async function testAPI() {
  console.log('🧪 Testing API endpoints...');
  
  const baseURL = 'http://localhost:3000';
  
  try {
    // Test health endpoint
    console.log('🏥 Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('✅ Health check:', healthResponse.data.data.status);
    
    // Test extract endpoint
    console.log('🔍 Testing extract endpoint...');
    const extractResponse = await axios.post(`${baseURL}/api/extract`, {
      url: 'https://httpbin.org/html',
      options: {
        includeImages: true,
        format: 'markdown'
      }
    });
    
    if (extractResponse.data.success) {
      console.log('✅ Extract successful');
      console.log('📄 Title:', extractResponse.data.data.title || 'No title');
      console.log('📝 Content length:', extractResponse.data.data.markdown.length);
      console.log('⏱️ Processing time:', extractResponse.data.data.metadata.processingTime + 'ms');
    } else {
      console.log('❌ Extract failed:', extractResponse.data.error.message);
    }
    
    console.log('🎉 API tests completed successfully!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running. Please start the server first with: npm start');
    } else {
      console.error('❌ API test failed:', error.response?.data || error.message);
    }
  }
}

testAPI();