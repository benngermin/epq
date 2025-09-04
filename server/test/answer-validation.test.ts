/**
 * Answer Validation Test Suite
 * Comprehensive tests for all question types and edge cases
 */

import { validateAnswer, QuestionType } from '../utils/answer-validation';

// Test data based on the JSON schema provided
const testCases = {
  // Multiple Choice Tests
  multipleChoice: [
    {
      name: 'Simple multiple choice - correct',
      userAnswer: 'A',
      correctAnswer: 'A',
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: {},
      expected: true
    },
    {
      name: 'Multiple choice - incorrect',
      userAnswer: 'B',
      correctAnswer: 'A',
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: {},
      expected: false
    },
    {
      name: 'Multiple choice - case insensitive',
      userAnswer: 'a',
      correctAnswer: 'A',
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: {},
      expected: true
    },
    {
      name: 'Multiple choice - full answer text',
      userAnswer: 'A. Choice 1',
      correctAnswer: 'A. Choice 1',
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: {},
      expected: true
    }
  ],

  // Numerical Entry Tests
  numericalEntry: [
    {
      name: 'Numerical entry - exact match',
      userAnswer: '100',
      correctAnswer: '100',
      questionType: QuestionType.NUMERICAL_ENTRY,
      options: {},
      expected: true
    },
    {
      name: 'Numerical entry - decimal variation',
      userAnswer: '100.00',
      correctAnswer: '100',
      questionType: QuestionType.NUMERICAL_ENTRY,
      options: { acceptableAnswers: ['100', '100.0', '100.00'] },
      expected: true
    },
    {
      name: 'Numerical entry - wrong answer',
      userAnswer: '99',
      correctAnswer: '100',
      questionType: QuestionType.NUMERICAL_ENTRY,
      options: {},
      expected: false
    },
    {
      name: 'Numerical entry - floating point precision',
      userAnswer: '3.14159',
      correctAnswer: '3.14159',
      questionType: QuestionType.NUMERICAL_ENTRY,
      options: {},
      expected: true
    }
  ],

  // Short Answer Tests
  shortAnswer: [
    {
      name: 'Short answer - single blank exact match',
      userAnswer: 'answer',
      correctAnswer: 'answer',
      questionType: QuestionType.SHORT_ANSWER,
      options: { caseSensitive: false },
      expected: true
    },
    {
      name: 'Short answer - case sensitive',
      userAnswer: 'Answer',
      correctAnswer: 'answer',
      questionType: QuestionType.SHORT_ANSWER,
      options: { caseSensitive: true },
      expected: false
    },
    {
      name: 'Short answer - acceptable alternatives',
      userAnswer: 'alternate answer',
      correctAnswer: 'answer 1, answer 2',
      questionType: QuestionType.SHORT_ANSWER,
      options: { 
        caseSensitive: false,
        acceptableAnswers: ['answer 1, answer 2', 'alternate answer']
      },
      expected: true
    },
    {
      name: 'Short answer - multiple blanks as JSON',
      userAnswer: '{"1":"answer 1","2":"answer 2"}',
      correctAnswer: 'answer 1, answer 2',
      questionType: QuestionType.SHORT_ANSWER,
      options: { caseSensitive: false },
      expected: true
    }
  ],

  // Select From List Tests
  selectFromList: [
    {
      name: 'Select from list - single dropdown',
      userAnswer: 'choice 1',
      correctAnswer: 'choice 1',
      questionType: QuestionType.SELECT_FROM_LIST,
      options: {
        blanks: [{
          blank_id: 1,
          answer_choices: ['choice 1', 'choice 2', 'choice 3'],
          correct_answer: 'choice 1'
        }]
      },
      expected: true
    },
    {
      name: 'Select from list - multiple dropdowns JSON',
      userAnswer: '{"1":"choice 1","2":"choice 3"}',
      correctAnswer: '',
      questionType: QuestionType.SELECT_FROM_LIST,
      options: {
        blanks: [
          {
            blank_id: 1,
            answer_choices: ['choice 1', 'choice 2'],
            correct_answer: 'choice 1'
          },
          {
            blank_id: 2,
            answer_choices: ['choice 3', 'choice 4'],
            correct_answer: 'choice 3'
          }
        ]
      },
      expected: true
    },
    {
      name: 'Select from list - wrong selection',
      userAnswer: '{"1":"choice 2"}',
      correctAnswer: '',
      questionType: QuestionType.SELECT_FROM_LIST,
      options: {
        blanks: [{
          blank_id: 1,
          answer_choices: ['choice 1', 'choice 2'],
          correct_answer: 'choice 1'
        }]
      },
      expected: false
    }
  ],

  // Drag and Drop Tests
  dragAndDrop: [
    {
      name: 'Drag and drop - correct zone assignments',
      userAnswer: '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3","Item 4"]}',
      correctAnswer: '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3","Item 4"]}',
      questionType: QuestionType.DRAG_AND_DROP,
      options: {},
      expected: true
    },
    {
      name: 'Drag and drop - order within zone doesnt matter',
      userAnswer: '{"zone_1":["Item 2","Item 1"],"zone_2":["Item 4","Item 3"]}',
      correctAnswer: '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3","Item 4"]}',
      questionType: QuestionType.DRAG_AND_DROP,
      options: {},
      expected: true
    },
    {
      name: 'Drag and drop - wrong zone assignment',
      userAnswer: '{"zone_1":["Item 1","Item 3"],"zone_2":["Item 2","Item 4"]}',
      correctAnswer: '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3","Item 4"]}',
      questionType: QuestionType.DRAG_AND_DROP,
      options: {},
      expected: false
    },
    {
      name: 'Drag and drop - missing items',
      userAnswer: '{"zone_1":["Item 1"],"zone_2":["Item 3"]}',
      correctAnswer: '{"zone_1":["Item 1","Item 2"],"zone_2":["Item 3","Item 4"]}',
      questionType: QuestionType.DRAG_AND_DROP,
      options: {},
      expected: false
    },
    {
      name: 'Drag and drop - handle numeric zone keys',
      userAnswer: '{"1":["Item 1"],"2":["Item 2"]}',
      correctAnswer: '{"zone_1":["Item 1"],"zone_2":["Item 2"]}',
      questionType: QuestionType.DRAG_AND_DROP,
      options: {},
      expected: true
    }
  ],

  // Multiple Response Tests
  multipleResponse: [
    {
      name: 'Multiple response - all correct selections',
      userAnswer: '["Choice 1","Choice 2","Choice 3"]',
      correctAnswer: '["Choice 1","Choice 2","Choice 3"]',
      questionType: QuestionType.MULTIPLE_RESPONSE,
      options: { allowMultiple: true },
      expected: true
    },
    {
      name: 'Multiple response - order doesnt matter',
      userAnswer: '["Choice 3","Choice 1","Choice 2"]',
      correctAnswer: '["Choice 1","Choice 2","Choice 3"]',
      questionType: QuestionType.MULTIPLE_RESPONSE,
      options: { allowMultiple: true },
      expected: true
    },
    {
      name: 'Multiple response - missing one selection',
      userAnswer: '["Choice 1","Choice 2"]',
      correctAnswer: '["Choice 1","Choice 2","Choice 3"]',
      questionType: QuestionType.MULTIPLE_RESPONSE,
      options: { allowMultiple: true },
      expected: false
    },
    {
      name: 'Multiple response - extra selection',
      userAnswer: '["Choice 1","Choice 2","Choice 3","Choice 4"]',
      correctAnswer: '["Choice 1","Choice 2","Choice 3"]',
      questionType: QuestionType.MULTIPLE_RESPONSE,
      options: { allowMultiple: true },
      expected: false
    }
  ],

  // Either/Or Tests
  eitherOr: [
    {
      name: 'Either/Or - correct selection',
      userAnswer: 'A) Option A',
      correctAnswer: 'A) Option A',
      questionType: QuestionType.EITHER_OR,
      options: {},
      expected: true
    },
    {
      name: 'Either/Or - wrong selection',
      userAnswer: 'B) Option B',
      correctAnswer: 'A) Option A',
      questionType: QuestionType.EITHER_OR,
      options: {},
      expected: false
    },
    {
      name: 'Either/Or - case insensitive',
      userAnswer: 'a) option a',
      correctAnswer: 'A) Option A',
      questionType: QuestionType.EITHER_OR,
      options: {},
      expected: true
    }
  ],

  // Edge Cases
  edgeCases: [
    {
      name: 'Empty user answer',
      userAnswer: '',
      correctAnswer: 'answer',
      questionType: QuestionType.MULTIPLE_CHOICE,
      options: {},
      expected: false
    },
    {
      name: 'Whitespace only answer',
      userAnswer: '   ',
      correctAnswer: 'answer',
      questionType: QuestionType.SHORT_ANSWER,
      options: {},
      expected: false
    },
    {
      name: 'Malformed JSON in user answer',
      userAnswer: '{invalid json}',
      correctAnswer: '{"zone_1":["Item 1"]}',
      questionType: QuestionType.DRAG_AND_DROP,
      options: {},
      expected: false
    },
    {
      name: 'Null-like string answer',
      userAnswer: 'null',
      correctAnswer: 'null',
      questionType: QuestionType.SHORT_ANSWER,
      options: {},
      expected: true
    }
  ]
};

/**
 * Run all tests
 */
export function runAllTests(): { passed: number; failed: number; results: any[] } {
  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  console.log('\n========================================');
  console.log('ANSWER VALIDATION TEST SUITE');
  console.log('========================================\n');

  // Run tests for each category
  Object.entries(testCases).forEach(([category, tests]) => {
    console.log(`\n[${category.toUpperCase()}]\n`);
    
    tests.forEach(test => {
      const result = validateAnswer(
        test.userAnswer,
        test.correctAnswer,
        test.questionType,
        test.options
      );
      
      const testPassed = result === test.expected;
      const status = testPassed ? '✅ PASS' : '❌ FAIL';
      
      console.log(`${status} - ${test.name}`);
      
      if (!testPassed) {
        console.log(`  Expected: ${test.expected}, Got: ${result}`);
        console.log(`  User Answer: ${JSON.stringify(test.userAnswer)}`);
        console.log(`  Correct Answer: ${JSON.stringify(test.correctAnswer)}`);
      }
      
      results.push({
        category,
        name: test.name,
        passed: testPassed,
        expected: test.expected,
        actual: result
      });
      
      if (testPassed) {
        passed++;
      } else {
        failed++;
      }
    });
  });

  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('========================================\n');

  return { passed, failed, results };
}

// Export for command-line execution
if (require.main === module) {
  runAllTests();
}