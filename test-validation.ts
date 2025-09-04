#!/usr/bin/env tsx
/**
 * Answer Validation Test Runner
 * Run with: tsx test-validation.ts
 */

import { validateAnswer, QuestionType } from './server/utils/answer-validation';
import { normalizeQuestionBlanks } from './server/utils/blank-normalizer';

console.log('🧪 EPQ Answer Validation Test Suite\n');
console.log('=' .repeat(60));

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(
  description: string,
  userAnswer: string,
  correctAnswer: string,
  questionType: string,
  options: any,
  expected: boolean
) {
  totalTests++;
  const result = validateAnswer(userAnswer, correctAnswer, questionType, options);
  const passed = result === expected;
  
  if (passed) {
    passedTests++;
    console.log(`${GREEN}✓${RESET} ${description}`);
  } else {
    failedTests++;
    console.log(`${RED}✗${RESET} ${description}`);
    console.log(`  Expected: ${expected}, Got: ${result}`);
    console.log(`  User: "${userAnswer}"`);
    console.log(`  Correct: "${correctAnswer}"`);
  }
  
  return passed;
}

// Test Blank Normalization
console.log('\n📝 Testing Blank Normalization\n');
console.log('-'.repeat(60));

const blankTests = [
  { input: 'A blank_1 test', expected: 'A ___ test' },
  { input: 'Multiple blank_1 and blank_2 here', expected: 'Multiple ___ and ___ here' },
  { input: 'Brackets [] test', expected: 'Brackets ___ test' },
  { input: 'Mix blank_1 and []', expected: 'Mix ___ and ___' },
  { input: 'Already has _____', expected: 'Already has ___' }
];

blankTests.forEach(test => {
  const { normalizedText } = normalizeQuestionBlanks(test.input);
  if (normalizedText === test.expected) {
    console.log(`${GREEN}✓${RESET} "${test.input}" → "${normalizedText}"`);
  } else {
    console.log(`${RED}✗${RESET} "${test.input}" → "${normalizedText}" (expected: "${test.expected}")`);
  }
});

// Test Each Question Type
console.log('\n🎯 Testing Question Types\n');
console.log('-'.repeat(60));

// 1. Multiple Choice
console.log('\n1️⃣  MULTIPLE CHOICE');
runTest(
  'Correct letter answer',
  'A',
  'A',
  QuestionType.MULTIPLE_CHOICE,
  {},
  true
);
runTest(
  'Case insensitive match',
  'a',
  'A',
  QuestionType.MULTIPLE_CHOICE,
  {},
  true
);
runTest(
  'Wrong answer',
  'B',
  'A',
  QuestionType.MULTIPLE_CHOICE,
  {},
  false
);

// 2. Numerical Entry
console.log('\n2️⃣  NUMERICAL ENTRY');
runTest(
  'Exact number match',
  '100',
  '100',
  QuestionType.NUMERICAL_ENTRY,
  {},
  true
);
runTest(
  'Decimal variation accepted',
  '100.00',
  '100',
  QuestionType.NUMERICAL_ENTRY,
  { acceptableAnswers: ['100', '100.0', '100.00'] },
  true
);
runTest(
  'Wrong number',
  '99',
  '100',
  QuestionType.NUMERICAL_ENTRY,
  {},
  false
);

// 3. Short Answer
console.log('\n3️⃣  SHORT ANSWER');
runTest(
  'Single answer correct',
  'photosynthesis',
  'photosynthesis',
  QuestionType.SHORT_ANSWER,
  { caseSensitive: false },
  true
);
runTest(
  'Case sensitive mismatch',
  'Photosynthesis',
  'photosynthesis',
  QuestionType.SHORT_ANSWER,
  { caseSensitive: true },
  false
);
runTest(
  'Multiple blanks as JSON',
  '{"1":"answer 1","2":"answer 2"}',
  'answer 1, answer 2',
  QuestionType.SHORT_ANSWER,
  { caseSensitive: false },
  true
);

// 4. Select From List
console.log('\n4️⃣  SELECT FROM LIST');
runTest(
  'Single dropdown correct',
  'choice 1',
  '',
  QuestionType.SELECT_FROM_LIST,
  {
    blanks: [{
      blank_id: 1,
      answer_choices: ['choice 1', 'choice 2'],
      correct_answer: 'choice 1'
    }]
  },
  true
);
runTest(
  'Multiple dropdowns',
  '{"1":"option A","2":"option C"}',
  '',
  QuestionType.SELECT_FROM_LIST,
  {
    blanks: [
      { blank_id: 1, answer_choices: ['option A', 'option B'], correct_answer: 'option A' },
      { blank_id: 2, answer_choices: ['option C', 'option D'], correct_answer: 'option C' }
    ]
  },
  true
);

// 5. Drag and Drop
console.log('\n5️⃣  DRAG AND DROP');
runTest(
  'Correct zone placement',
  '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3"]}',
  '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3"]}',
  QuestionType.DRAG_AND_DROP,
  {},
  true
);
runTest(
  'Order within zone doesn\'t matter',
  '{"zone_1":["Item 2","Item 1"],"zone_2":["Item 3"]}',
  '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3"]}',
  QuestionType.DRAG_AND_DROP,
  {},
  true
);
runTest(
  'Wrong zone placement',
  '{"zone_1":["Item 1"],"zone_2":["Item 2","Item 3"]}',
  '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3"]}',
  QuestionType.DRAG_AND_DROP,
  {},
  false
);

// 6. Multiple Response
console.log('\n6️⃣  MULTIPLE RESPONSE');
runTest(
  'All correct selections',
  '["Option A","Option C","Option D"]',
  '["Option A","Option C","Option D"]',
  QuestionType.MULTIPLE_RESPONSE,
  { allowMultiple: true },
  true
);
runTest(
  'Order doesn\'t matter',
  '["Option D","Option A","Option C"]',
  '["Option A","Option C","Option D"]',
  QuestionType.MULTIPLE_RESPONSE,
  { allowMultiple: true },
  true
);
runTest(
  'Missing selection',
  '["Option A","Option C"]',
  '["Option A","Option C","Option D"]',
  QuestionType.MULTIPLE_RESPONSE,
  { allowMultiple: true },
  false
);

// 7. Either/Or
console.log('\n7️⃣  EITHER/OR');
runTest(
  'Correct binary choice',
  'A) True',
  'A) True',
  QuestionType.EITHER_OR,
  {},
  true
);
runTest(
  'Wrong binary choice',
  'B) False',
  'A) True',
  QuestionType.EITHER_OR,
  {},
  false
);

// Edge Cases
console.log('\n⚠️  EDGE CASES');
runTest(
  'Empty answer',
  '',
  'answer',
  QuestionType.SHORT_ANSWER,
  {},
  false
);
runTest(
  'Malformed JSON',
  '{bad json',
  '{"zone_1":["Item 1"]}',
  QuestionType.DRAG_AND_DROP,
  {},
  false
);

// Print Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY\n');
console.log(`Total Tests: ${totalTests}`);
console.log(`${GREEN}Passed: ${passedTests}${RESET}`);
console.log(`${RED}Failed: ${failedTests}${RESET}`);

const successRate = ((passedTests / totalTests) * 100).toFixed(1);
const color = failedTests === 0 ? GREEN : (failedTests <= 2 ? YELLOW : RED);

console.log(`\n${color}Success Rate: ${successRate}%${RESET}`);

if (failedTests === 0) {
  console.log(`\n${GREEN}🎉 All tests passed! The validation system is working correctly.${RESET}`);
} else {
  console.log(`\n${RED}⚠️  ${failedTests} test(s) failed. Review the output above for details.${RESET}`);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));