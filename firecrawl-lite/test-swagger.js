const axios = require('axios');

async function testSwaggerDocumentation() {
  console.log('📚 Testing Swagger Documentation...\n');
  
  const baseURL = 'http://localhost:3000';
  
  try {
    // Test if server is running
    console.log('🔍 Checking if server is running...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('✅ Server is running:', healthResponse.data.data.status);
    
    // Test Swagger UI endpoints
    console.log('\n📋 Testing Swagger endpoints...');
    
    // Test /docs endpoint
    try {
      const docsResponse = await axios.get(`${baseURL}/docs`, {
        headers: { 'Accept': 'text/html' }
      });
      console.log('✅ /docs endpoint accessible (Status:', docsResponse.status, ')');
    } catch (error) {
      console.log('❌ /docs endpoint failed:', error.response?.status || error.code);
    }
    
    // Test /api-docs endpoint  
    try {
      const apiDocsResponse = await axios.get(`${baseURL}/api-docs`, {
        headers: { 'Accept': 'text/html' }
      });
      console.log('✅ /api-docs endpoint accessible (Status:', apiDocsResponse.status, ')');
    } catch (error) {
      console.log('❌ /api-docs endpoint failed:', error.response?.status || error.code);
    }
    
    // Test root endpoint with documentation link
    console.log('\n🏠 Testing root endpoint...');
    const rootResponse = await axios.get(`${baseURL}/`);
    if (rootResponse.data.success && rootResponse.data.data.documentation) {
      console.log('✅ Root endpoint includes documentation link:', rootResponse.data.data.documentation);
    }
    
    console.log('\n🎉 Swagger documentation tests completed!');
    console.log('\n📖 Access your API documentation at:');
    console.log(`   🔗 ${baseURL}/docs`);
    console.log(`   🔗 ${baseURL}/api-docs`);
    console.log('\n💡 You can now test all API endpoints directly from the Swagger UI!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running. Please start the server first with: npm start');
    } else {
      console.error('❌ Test failed:', error.response?.data || error.message);
    }
  }
}

// Instructions for testing
async function showTestingInstructions() {
  console.log('\n📋 How to test API endpoints in Swagger UI:');
  console.log('1. Start the server: npm start');
  console.log('2. Open http://localhost:3000/docs in your browser');
  console.log('3. Expand any endpoint (e.g., POST /api/extract)');
  console.log('4. Click "Try it out" button');
  console.log('5. Fill in the request parameters');
  console.log('6. Click "Execute" to test the endpoint');
  console.log('\n🔧 Example test data for /api/extract:');
  console.log(JSON.stringify({
    url: "https://httpbin.org/html",
    options: {
      includeImages: false,
      format: "markdown",
      timeout: 15000
    }
  }, null, 2));
  console.log('\n🔧 Example test data for /api/batch:');
  console.log(JSON.stringify({
    urls: [
      "https://httpbin.org/html",
      "https://httpbin.org/json"
    ],
    options: {
      concurrent: 2,
      includeImages: false
    }
  }, null, 2));
}

testSwaggerDocumentation()
  .then(() => showTestingInstructions())
  .catch(console.error);