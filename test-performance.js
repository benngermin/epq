// Performance testing script for loading optimizations
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000';
const QUESTION_SET_ID = 7;

async function measureApiPerformance() {
  console.log('Performance Test Results\n' + '='.repeat(50));
  
  // Test 1: Original separate API calls (old way)
  console.log('\n1. Original Approach (4 separate API calls):');
  const startOld = Date.now();
  
  await Promise.all([
    fetch(`${API_BASE}/api/question-sets/${QUESTION_SET_ID}`),
    fetch(`${API_BASE}/api/questions/${QUESTION_SET_ID}`),
    fetch(`${API_BASE}/api/courses/1`),
    fetch(`${API_BASE}/api/courses/1/question-sets`)
  ]);
  
  const oldTime = Date.now() - startOld;
  console.log(`   Total time: ${oldTime}ms`);
  
  // Test 2: Optimized single API call (new way)
  console.log('\n2. Optimized Approach (1 combined API call):');
  const startNew = Date.now();
  
  await fetch(`${API_BASE}/api/question-sets/${QUESTION_SET_ID}/optimized`);
  
  const newTime = Date.now() - startNew;
  console.log(`   Total time: ${newTime}ms`);
  
  // Calculate improvement
  const improvement = ((oldTime - newTime) / oldTime * 100).toFixed(1);
  console.log(`\n✓ Performance Improvement: ${improvement}% faster`);
  console.log(`✓ Time saved: ${oldTime - newTime}ms`);
  console.log(`✓ API calls reduced from 4 to 1`);
  
  // Test 3: Courses endpoint comparison
  console.log('\n3. Courses Endpoint Comparison:');
  
  const startCoursesOld = Date.now();
  await fetch(`${API_BASE}/api/courses`);
  const coursesOldTime = Date.now() - startCoursesOld;
  console.log(`   Original: ${coursesOldTime}ms`);
  
  const startCoursesNew = Date.now();
  await fetch(`${API_BASE}/api/courses/optimized`);
  const coursesNewTime = Date.now() - startCoursesNew;
  console.log(`   Optimized: ${coursesNewTime}ms`);
  
  const coursesImprovement = ((coursesOldTime - coursesNewTime) / coursesOldTime * 100).toFixed(1);
  console.log(`   Improvement: ${coursesImprovement}% faster`);
}

// Run the test
measureApiPerformance().catch(console.error);