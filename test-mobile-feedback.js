#!/usr/bin/env node

// Test script for mobile-view feedback submission
import fetch from 'node-fetch';

async function testMobileFeedback() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    console.log('Testing mobile-view feedback submission...');
    
    const response = await fetch(`${baseUrl}/api/mobile-view/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'positive',
        message: 'Test feedback from mobile-view',
        messageId: 'test-msg-' + Date.now(),
        timestamp: new Date().toISOString(),
      }),
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (response.status === 200 && result.success) {
      console.log('✅ Mobile-view feedback submission successful!');
    } else {
      console.log('❌ Mobile-view feedback submission failed');
    }
  } catch (error) {
    console.error('Error testing mobile feedback:', error);
  }
}

// Run the test
testMobileFeedback();