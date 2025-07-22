async function testUpdate() {
  // First login
  const loginResponse = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'benn@modia.ai',
      password: 'pass123'
    })
  });
  
  const setCookie = loginResponse.headers.get('set-cookie');
  console.log('Login response:', loginResponse.status);
  
  if (setCookie) {
    // Now test the update endpoint
    console.log('\nCalling update-all-question-sets endpoint...\n');
    const updateResponse = await fetch('http://localhost:5000/api/admin/bubble/update-all-question-sets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': setCookie
      }
    });
    
    const result = await updateResponse.text();
    console.log('Update response:', result);
  }
}

testUpdate().catch(console.error);
