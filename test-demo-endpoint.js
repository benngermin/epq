#!/usr/bin/env node
/**
 * Test script to verify demo endpoint uses deterministic evaluation
 */

const baseUrl = 'http://localhost:5000';

// Test data with known correct answers
const testCases = [
  {
    name: 'Multiple Choice - Correct Answer',
    questionVersionId: 1, // You'll need to replace with actual IDs from your database
    answer: 'A',
    expectedCorrect: true,
    correctAnswer: 'A',
    questionType: 'multipleChoice'
  },
  {
    name: 'Multiple Choice - Wrong Answer',
    questionVersionId: 1,
    answer: 'B',
    expectedCorrect: false,
    correctAnswer: 'A',
    questionType: 'multipleChoice'
  },
  {
    name: 'Numerical Entry - Exact Match',
    questionVersionId: 2,
    answer: '42',
    expectedCorrect: true,
    correctAnswer: '42',
    questionType: 'numericalEntry'
  },
  {
    name: 'Numerical Entry - Within Tolerance',
    questionVersionId: 2,
    answer: '42.005',
    expectedCorrect: true, // Should be true if within 0.01 tolerance
    correctAnswer: '42',
    questionType: 'numericalEntry'
  }
];

async function testDemoEndpoint() {
  console.log('Testing Demo Endpoint Deterministic Evaluation');
  console.log('='.repeat(50));
  
  let passedTests = 0;
  let failedTests = 0;
  
  // First, let's test with a real question version ID from the database
  // We'll make a simple test to verify the endpoint is working
  
  console.log('\n1. Testing endpoint availability...');
  try {
    const response = await fetch(`${baseUrl}/api/demo/question-sets/43/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionVersionId: 99999, // Non-existent ID to test error handling
        answer: 'test'
      })
    });
    
    const data = await response.json();
    
    if (response.status === 404 && data.message === 'Question version not found') {
      console.log('✓ Endpoint properly validates question version existence');
      passedTests++;
    } else {
      console.log('✗ Unexpected response for non-existent question version');
      failedTests++;
    }
  } catch (error) {
    console.error('✗ Failed to connect to endpoint:', error.message);
    failedTests++;
  }
  
  // Test with missing parameters
  console.log('\n2. Testing parameter validation...');
  try {
    const response = await fetch(`${baseUrl}/api/demo/question-sets/43/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing questionVersionId and answer
      })
    });
    
    const data = await response.json();
    
    if (response.status === 400 && data.message === 'Question version ID and answer are required') {
      console.log('✓ Endpoint properly validates required parameters');
      passedTests++;
    } else {
      console.log('✗ Unexpected response for missing parameters');
      failedTests++;
    }
  } catch (error) {
    console.error('✗ Failed to test parameter validation:', error.message);
    failedTests++;
  }
  
  // Test deterministic behavior (same input should give same output)
  console.log('\n3. Testing deterministic behavior...');
  console.log('(Running same answer 10 times to ensure consistency)');
  
  const deterministicTest = {
    questionVersionId: 4641, // Using a real question ID from the logs
    answer: 'A'
  };
  
  const results = [];
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/demo/question-sets/43/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deterministicTest)
      });
      
      if (response.ok) {
        const data = await response.json();
        results.push(data.isCorrect);
      }
    } catch (error) {
      console.error(`  Attempt ${i + 1} failed:`, error.message);
    }
  }
  
  if (results.length > 0) {
    const allSame = results.every(r => r === results[0]);
    if (allSame) {
      console.log(`✓ All ${results.length} attempts returned the same result: ${results[0]}`);
      console.log('  This confirms deterministic evaluation (no randomness)');
      passedTests++;
    } else {
      console.log('✗ Results varied across attempts:', results);
      console.log('  This indicates random behavior still present!');
      failedTests++;
    }
  } else {
    console.log('✗ Could not complete deterministic test');
    failedTests++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);
  console.log(`  Total:  ${passedTests + failedTests}`);
  
  if (failedTests === 0) {
    console.log('\n✅ All tests passed! Demo endpoint is using deterministic evaluation.');
  } else {
    console.log('\n❌ Some tests failed. Please review the implementation.');
  }
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
testDemoEndpoint().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});