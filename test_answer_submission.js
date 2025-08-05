// Test answer submission to verify authentication is working
import fetch from 'node-fetch';

async function testAnswerSubmission() {
  try {
    // First, get the session cookie by logging in
    console.log('1. Logging in...');
    const loginRes = await fetch('http://localhost:5000/api/auth/local/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'benn@modia.ai',
        password: 'password123'
      }),
    });

    if (!loginRes.ok) {
      console.error('Login failed:', await loginRes.text());
      return;
    }

    // Extract session cookie
    const setCookies = loginRes.headers.raw()['set-cookie'];
    if (!setCookies) {
      console.error('No session cookie received');
      return;
    }
    
    const sessionCookie = setCookies[0].split(';')[0];
    console.log('Session cookie:', sessionCookie);

    // 2. Get current user to verify authentication
    console.log('\n2. Verifying authentication...');
    const userRes = await fetch('http://localhost:5000/api/user', {
      headers: {
        'Cookie': sessionCookie
      }
    });

    if (!userRes.ok) {
      console.error('User fetch failed:', await userRes.text());
      return;
    }

    const user = await userRes.json();
    console.log('Authenticated as:', user.email);

    // 3. Get a question set to practice
    console.log('\n3. Getting question set 56...');
    const questionSetRes = await fetch('http://localhost:5000/api/question-sets/56', {
      headers: {
        'Cookie': sessionCookie
      }
    });

    if (!questionSetRes.ok) {
      console.error('Question set fetch failed:', await questionSetRes.text());
      return;
    }

    const questionSet = await questionSetRes.json();
    console.log('Question set:', questionSet.title);

    // 4. Get questions for this set
    console.log('\n4. Getting questions...');
    const questionsRes = await fetch('http://localhost:5000/api/questions/56', {
      headers: {
        'Cookie': sessionCookie
      }
    });

    if (!questionsRes.ok) {
      console.error('Questions fetch failed:', await questionsRes.text());
      return;
    }

    const questions = await questionsRes.json();
    console.log('Total questions:', questions.length);

    if (questions.length === 0) {
      console.error('No questions found');
      return;
    }

    // 5. Submit an answer for the first question
    const firstQuestion = questions[0];
    const questionVersionId = firstQuestion.latestVersion?.id;
    
    if (!questionVersionId) {
      console.error('No question version found');
      return;
    }

    console.log('\n5. Submitting answer...');
    console.log('Question:', firstQuestion.latestVersion.questionText);
    console.log('Answer choices:', firstQuestion.latestVersion.answerChoices);
    
    const answerRes = await fetch('http://localhost:5000/api/question-sets/56/answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        questionVersionId: questionVersionId,
        answer: 'A'
      })
    });

    if (!answerRes.ok) {
      console.error('Answer submission failed:', await answerRes.text());
      return;
    }

    const result = await answerRes.json();
    console.log('\nAnswer submitted successfully!');
    console.log('Result:', result);

    // 6. Check if the answer was saved
    console.log('\n6. Verifying answer was saved...');
    const statsRes = await fetch('http://localhost:5000/api/analytics/overall', {
      headers: {
        'Cookie': sessionCookie
      }
    });

    if (statsRes.ok) {
      const stats = await statsRes.json();
      console.log('Total answers in system:', stats.questionsAnswered);
      console.log('Total test runs:', stats.activeTestRuns);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAnswerSubmission();