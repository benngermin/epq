// Test script for verifying SSE endpoints
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

// Test data
const testPayload = {
  questionVersionId: 3122,  // From the logs, this appears to be a valid question version
  chosenAnswer: "A", 
  userMessage: null,
  isMobile: false,
  conversationHistory: null
};

async function testSSEEndpoint(endpointPath, name) {
  console.log(`\nTesting ${name}...`);
  console.log(`Endpoint: ${endpointPath}`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, {
      'content-type': response.headers.get('content-type'),
      'cache-control': response.headers.get('cache-control'),
      'connection': response.headers.get('connection')
    });

    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log(`✅ ${name} endpoint is configured correctly for SSE`);
      
      // Read first chunk to verify SSE format
      const reader = response.body;
      const decoder = new TextDecoder();
      
      // Read a small portion to check the format
      const chunk = await new Promise((resolve) => {
        const chunks = [];
        let bytesRead = 0;
        reader.on('data', (data) => {
          chunks.push(data);
          bytesRead += data.length;
          if (bytesRead > 100) { // Read first 100 bytes
            reader.destroy();
            resolve(Buffer.concat(chunks));
          }
        });
        reader.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        // Timeout after 2 seconds
        setTimeout(() => {
          reader.destroy();
          resolve(Buffer.concat(chunks));
        }, 2000);
      });
      
      const text = decoder.decode(chunk);
      console.log(`First chunk preview: ${text.substring(0, 100)}...`);
      
      if (text.includes('data:')) {
        console.log('✅ SSE format confirmed (contains "data:" prefix)');
      }
    } else {
      console.log(`❌ ${name} endpoint failed or not configured for SSE`);
      if (response.status === 404) {
        console.log('   Endpoint not found (404)');
      }
    }
  } catch (error) {
    console.log(`❌ ${name} endpoint test failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('=== SSE Endpoint Test Suite ===');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Test mobile-view SSE endpoint
  await testSSEEndpoint('/api/mobile-view/chatbot/stream-sse', 'Mobile-view SSE');
  
  // Test demo SSE endpoint  
  await testSSEEndpoint('/api/demo/chatbot/stream-sse', 'Demo SSE');
  
  // For comparison, test authenticated endpoint (will fail without auth)
  await testSSEEndpoint('/api/chatbot/stream-sse', 'Authenticated SSE (expected to fail)');
  
  console.log('\n=== Test Complete ===');
}

// Run tests
runTests().catch(console.error);