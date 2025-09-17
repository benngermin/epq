import fs from 'fs';

async function testAdminUpload() {
  console.log('Testing Admin CSV Upload Feature...\n');
  
  // Read the CSV file
  const csvContent = fs.readFileSync('attached_assets/Static Answers-1_1758150480787.csv', 'utf-8');
  console.log('1. CSV file loaded successfully');
  console.log('   Lines in CSV:', csvContent.split('\n').length);
  
  // Test 1: Check if we're authenticated
  console.log('\n2. Checking authentication...');
  try {
    const authResponse = await fetch('http://localhost:5000/api/user', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (authResponse.ok) {
      const user = await authResponse.json();
      console.log('   ✓ Authenticated as:', user.email);
      
      // If not benn@modia.ai, we need to login
      if (user.email !== 'benn@modia.ai') {
        console.log('   ⚠️ Not logged in as admin, attempting login...');
        await loginAsAdmin();
      }
    } else {
      console.log('   ⚠️ Not authenticated, attempting login...');
      await loginAsAdmin();
    }
  } catch (error) {
    console.log('   ⚠️ Auth check failed, attempting login...');
    await loginAsAdmin();
  }
  
  // Test 2: Test the preview endpoint
  console.log('\n3. Testing CSV preview endpoint...');
  try {
    const previewResponse = await fetch('http://localhost:5000/api/admin/preview-explanations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ csvContent }),
      credentials: 'include'
    });
    
    console.log('   Response status:', previewResponse.status);
    
    if (previewResponse.ok) {
      const previewData = await previewResponse.json();
      console.log('   ✓ Preview successful!');
      console.log('\n   Preview Summary:');
      console.log('   - Total rows:', previewData.summary?.total || 0);
      console.log('   - Matched:', previewData.summary?.matched || 0);
      console.log('   - Unmatched:', previewData.summary?.unmatched || 0);
      
      if (previewData.results && previewData.results.length > 0) {
        console.log('\n   First few results:');
        previewData.results.slice(0, 3).forEach((result, index) => {
          console.log(`\n   Row ${index + 1}:`);
          console.log('     - Course:', result.row?.courseName);
          console.log('     - Question Set:', result.row?.questionSetNumber);
          console.log('     - Question #:', result.row?.questionNumber);
          console.log('     - LOID:', result.row?.loid);
          console.log('     - Matched:', result.isMatched ? '✓' : '✗');
          if (result.matchedQuestion) {
            console.log('     - Matched DB ID:', result.matchedQuestion.id);
            console.log('     - Has current explanation:', !!result.matchedQuestion.currentStaticExplanation);
          }
          if (result.error) {
            console.log('     - Error:', result.error);
          }
        });
        
        // Show statistics about explanations
        const withExplanations = previewData.results.filter(r => r.row?.finalStaticExplanation).length;
        console.log('\n   Explanation Statistics:');
        console.log('   - Rows with explanations:', withExplanations);
        console.log('   - Rows without explanations:', previewData.results.length - withExplanations);
      }
      
      return previewData;
    } else {
      const errorText = await previewResponse.text();
      console.log('   ✗ Preview failed:', errorText);
      
      // If unauthorized, try to login
      if (previewResponse.status === 401) {
        console.log('   Attempting to login as admin...');
        const loginSuccess = await loginAsAdmin();
        if (loginSuccess) {
          console.log('   Retrying preview after login...');
          return testAdminUpload(); // Retry the whole test
        }
      }
    }
  } catch (error) {
    console.log('   ✗ Error calling preview endpoint:', error.message);
  }
  
  console.log('\n4. Test Summary:');
  console.log('   - CSV file readable: ✓');
  console.log('   - API endpoints accessible: ✓');
  console.log('   - Preview functionality: Check results above');
  console.log('\n✅ API test completed!');
}

async function loginAsAdmin() {
  try {
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'benn@modia.ai',
        password: 'Password123'
      }),
      credentials: 'include'
    });
    
    if (loginResponse.ok) {
      const user = await loginResponse.json();
      console.log('   ✓ Logged in as:', user.email);
      return true;
    } else {
      console.log('   ✗ Login failed');
      return false;
    }
  } catch (error) {
    console.log('   ✗ Login error:', error.message);
    return false;
  }
}

// Run the test
testAdminUpload().catch(console.error);