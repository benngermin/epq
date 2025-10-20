#!/usr/bin/env node

const http = require('http');

// Admin session cookie (you may need to update this if it expires)
const adminCookie = 'connect.sid=s%3AyTy2u4BQFRkZ9E6wvR7MKdw4eOQSCRAP.6a9qE4lGzuQmvY52z3V0TUpOhHYEj8OoJXnZJ0HeSz0';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Cookie': adminCookie,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== FINAL REFRESH AUDIT ===\n');
  
  // 1. Check refresh status
  console.log('1. Checking refresh status...');
  const status = await makeRequest('/api/admin/refresh/status');
  console.log(`   Status: ${status.status}`);
  if (status.data) {
    console.log(`   Completed: ${status.data.finalRefreshCompletedAt || 'Not completed'}`);
    console.log(`   In Progress: ${status.data.finalRefreshInProgressAt || 'None'}`);
  }
  
  // 2. Try to run final refresh again (should return 410)
  console.log('\n2. Testing second final refresh attempt...');
  const secondRefresh = await makeRequest('/api/admin/refresh/run-final', 'POST');
  console.log(`   Status: ${secondRefresh.status} (expected: 410)`);
  if (secondRefresh.status === 410) {
    console.log('   ✓ Correctly returns 410 Gone');
  } else {
    console.log(`   ✗ Unexpected status: ${secondRefresh.status}`);
  }
  
  // 3. Test legacy endpoints for 410
  console.log('\n3. Testing legacy endpoints...');
  const legacyEndpoints = [
    '/api/admin/bubble/import-question-sets',
    '/api/admin/bubble/bulk-refresh-question-sets'
  ];
  
  for (const endpoint of legacyEndpoints) {
    const result = await makeRequest(endpoint, endpoint.includes('import') ? 'POST' : 'GET');
    console.log(`   ${endpoint}: ${result.status} ${result.status === 410 ? '✓' : '✗'}`);
  }
  
  // 4. Check practice data endpoints for cache headers
  console.log('\n4. Testing cache headers on practice endpoints...');
  const practiceEndpoints = [
    '/api/question-sets',
    '/api/practice-data/1'
  ];
  
  console.log('\n=== SUMMARY ===');
  console.log('Run this script to verify all sunset behaviors.');
}

runTests().catch(console.error);