async function testUpdate() {
  // First login
  const loginResponse = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'benn@modia.ai',
      password: 'testadmin123'
    })
  });
  
  const setCookie = loginResponse.headers.get('set-cookie');
  console.log('Login response:', loginResponse.status);
  const loginResult = await loginResponse.json();
  console.log('Login result:', loginResult);
  
  if (setCookie && loginResponse.ok) {
    // Now test the update endpoint with a filter for CPCU 500 only
    console.log('\nCalling update-all-question-sets endpoint...\n');
    const updateResponse = await fetch('http://localhost:5000/api/admin/bubble/update-all-question-sets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': setCookie
      }
    });
    
    // Stream the response as it comes in
    const reader = updateResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line) {
          console.log(line);
        }
      }
    }
    
    if (buffer) {
      console.log(buffer);
    }
  }
}

testUpdate().catch(console.error);
