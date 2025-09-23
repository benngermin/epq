import { db } from './db';
import { courses, questionSets, courseQuestionSets, questions, questionVersions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';
import { normalizeQuestionText } from './utils/text-normalizer';
import { parseStaticExplanationCSV } from './utils/csvParser';

async function runComprehensiveTest() {
  console.log('\n========================================');
  console.log('COMPREHENSIVE UPLOAD FUNCTIONALITY TEST');
  console.log('========================================\n');
  
  const testResults: any[] = [];
  let allPassed = true;
  
  try {
    // Test 1: Text Normalization Function
    console.log('TEST 1: Text Normalization Function');
    console.log('-------------------------------------');
    
    const normalizationTests = [
      {
        input: "This is a test question?",
        expected: "this is a test question?",
        description: "Basic lowercase"
      },
      {
        input: "This  has   multiple    spaces",
        expected: "this has multiple spaces",
        description: "Multiple spaces collapsed"
      },
      {
        input: "Smart quotes: \u2018test\u2019 and \u201ctest\u201d",
        expected: "smart quotes: 'test' and \"test\"",
        description: "Smart quotes normalized"
      },
      {
        input: "<p>HTML &amp; entities</p>",
        expected: "html & entities",
        description: "HTML stripped and entities decoded"
      },
      {
        input: "**Bold** and *italic* text",
        expected: "bold and italic text",
        description: "Markdown formatting removed"
      },
      {
        input: "What is 2+2?",
        expected: "what is 2+2?",
        description: "Preserves mathematical symbols"
      },
      {
        input: "Line 1\nLine 2\n\nLine 3",
        expected: "line 1 line 2 line 3",
        description: "Newlines converted to spaces"
      }
    ];
    
    let normalizationPassed = true;
    for (const test of normalizationTests) {
      const result = normalizeQuestionText(test.input);
      const passed = result === test.expected;
      if (!passed) {
        normalizationPassed = false;
        console.log(`  ❌ FAILED: ${test.description}`);
        console.log(`     Input:    "${test.input}"`);
        console.log(`     Expected: "${test.expected}"`);
        console.log(`     Got:      "${result}"`);
      } else {
        console.log(`  ✅ PASSED: ${test.description}`);
      }
    }
    
    testResults.push({
      name: 'Text Normalization',
      passed: normalizationPassed
    });
    if (!normalizationPassed) allPassed = false;
    
    // Test 2: Database Operations
    console.log('\nTEST 2: Database Operations');
    console.log('----------------------------');
    
    const testCourse = "TEST_COURSE_" + Date.now();
    const testLOID = "TEST_LOID_" + Date.now();
    const testQuestionText = "What is the primary purpose of insurance?";
    
    // Create test data
    const [testCourseRecord] = await db.insert(courses)
      .values({
        courseNumber: testCourse,
        courseTitle: "Test Course for Upload Verification",
        isAi: false
      })
      .returning();
    
    const [testQuestionSet] = await db.insert(questionSets)
      .values({
        courseId: testCourseRecord.id,
        title: "Test Question Set",
        questionCount: 1
      })
      .returning();
    
    await db.insert(courseQuestionSets)
      .values({
        courseId: testCourseRecord.id,
        questionSetId: testQuestionSet.id,
        displayOrder: 1
      });
    
    const [testQuestion] = await db.insert(questions)
      .values({
        questionSetId: testQuestionSet.id,
        originalQuestionNumber: 1,
        loid: testLOID
      })
      .returning();
    
    const [testQuestionVersion] = await db.insert(questionVersions)
      .values({
        questionId: testQuestion.id,
        versionNumber: 1,
        topicFocus: "Test Topic",
        questionText: testQuestionText,
        questionType: "multiple-choice",
        answerChoices: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        isActive: true,
        isStaticAnswer: false,
        staticExplanation: null
      })
      .returning();
    
    console.log(`  ✅ Created test question with ID ${testQuestionVersion.id}, LOID ${testLOID}`);
    
    // Test 3: Finding by metadata
    console.log('\nTEST 3: Finding Questions by Metadata');
    console.log('--------------------------------------');
    
    const foundQuestions = await storage.findAllQuestionVersionsByDetails(
      testCourse,
      1,
      1,
      testLOID
    );
    
    const findByMetadataPassed = foundQuestions.length === 1 && foundQuestions[0].id === testQuestionVersion.id;
    if (findByMetadataPassed) {
      console.log(`  ✅ PASSED: Found exactly 1 question with correct ID`);
    } else {
      console.log(`  ❌ FAILED: Expected 1 question, found ${foundQuestions.length}`);
      allPassed = false;
    }
    
    testResults.push({
      name: 'Find by Metadata',
      passed: findByMetadataPassed
    });
    
    // Test 4: CSV Parsing
    console.log('\nTEST 4: CSV Parsing');
    console.log('-------------------');
    
    const testCSV = `Unique ID,Course,Question Set,Question Number,LOID,Question Text,Final Static Explanation
TEST1,${testCourse},1,1,${testLOID},"${testQuestionText}","This is a test explanation"`;
    
    let csvParsingPassed = false;
    try {
      const parsed = parseStaticExplanationCSV(testCSV);
      csvParsingPassed = parsed.length === 1 && 
        parsed[0].courseName === testCourse &&
        parsed[0].loid === testLOID;
      if (csvParsingPassed) {
        console.log('  ✅ PASSED: CSV parsed correctly');
      } else {
        console.log('  ❌ FAILED: CSV parsing incorrect');
        allPassed = false;
      }
    } catch (error: any) {
      console.log(`  ❌ FAILED: ${error.message}`);
      allPassed = false;
    }
    
    testResults.push({
      name: 'CSV Parsing',
      passed: csvParsingPassed
    });
    
    // Test 5: Text Matching Logic
    console.log('\nTEST 5: Text Matching Logic');
    console.log('---------------------------');
    
    const textMatchTests = [
      {
        dbText: "What is the primary purpose of insurance?",
        csvText: "What is the primary purpose of insurance?",
        shouldMatch: true,
        description: "Exact match"
      },
      {
        dbText: "What is the primary purpose of insurance?",
        csvText: "What is the PRIMARY purpose of insurance?",
        shouldMatch: true,
        description: "Case insensitive"
      },
      {
        dbText: "What is the primary purpose of insurance?",
        csvText: "What  is  the  primary  purpose  of  insurance?",
        shouldMatch: true,
        description: "Extra spaces"
      },
      {
        dbText: "What is the primary purpose of insurance?",
        csvText: "<p>What is the primary purpose of insurance?</p>",
        shouldMatch: true,
        description: "HTML tags"
      },
      {
        dbText: "What is the primary purpose of insurance?",
        csvText: "What is the primary purpose of insurance",
        shouldMatch: false,
        description: "Missing punctuation"
      },
      {
        dbText: "What is the primary purpose of insurance?",
        csvText: "What is the secondary purpose of insurance?",
        shouldMatch: false,
        description: "Different words"
      }
    ];
    
    let textMatchingPassed = true;
    for (const test of textMatchTests) {
      const normalizedDb = normalizeQuestionText(test.dbText);
      const normalizedCsv = normalizeQuestionText(test.csvText);
      const matches = normalizedDb === normalizedCsv;
      
      if (matches === test.shouldMatch) {
        console.log(`  ✅ PASSED: ${test.description}`);
      } else {
        console.log(`  ❌ FAILED: ${test.description}`);
        console.log(`     DB normalized:  "${normalizedDb}"`);
        console.log(`     CSV normalized: "${normalizedCsv}"`);
        console.log(`     Expected ${test.shouldMatch ? 'match' : 'no match'}, got ${matches ? 'match' : 'no match'}`);
        textMatchingPassed = false;
        allPassed = false;
      }
    }
    
    testResults.push({
      name: 'Text Matching',
      passed: textMatchingPassed
    });
    
    // Test 6: Update Functionality
    console.log('\nTEST 6: Database Update');
    console.log('------------------------');
    
    const testExplanation = "This is the test explanation that should be saved";
    const updateResult = await storage.updateQuestionVersionStaticExplanation(
      testQuestionVersion.id,
      testExplanation
    );
    
    const verifyUpdate = await storage.getQuestionVersion(testQuestionVersion.id);
    const updatePassed = verifyUpdate?.staticExplanation === testExplanation;
    
    if (updatePassed) {
      console.log('  ✅ PASSED: Explanation updated successfully');
    } else {
      console.log('  ❌ FAILED: Explanation not updated correctly');
      console.log(`     Expected: "${testExplanation}"`);
      console.log(`     Got: "${verifyUpdate?.staticExplanation}"`);
      allPassed = false;
    }
    
    testResults.push({
      name: 'Database Update',
      passed: updatePassed
    });
    
    // Test 7: Edge Cases
    console.log('\nTEST 7: Edge Cases');
    console.log('------------------');
    
    // Test with question that doesn't exist
    const nonExistentQuestions = await storage.findAllQuestionVersionsByDetails(
      "NON_EXISTENT_COURSE",
      1,
      1,
      "NON_EXISTENT_LOID"
    );
    
    const edgeCase1Passed = nonExistentQuestions.length === 0;
    if (edgeCase1Passed) {
      console.log('  ✅ PASSED: Non-existent question returns empty array');
    } else {
      console.log(`  ❌ FAILED: Non-existent question returned ${nonExistentQuestions.length} results`);
      allPassed = false;
    }
    
    // Test with empty/null text
    const emptyTextNormalized = normalizeQuestionText('');
    const nullTextNormalized = normalizeQuestionText(null);
    const edgeCase2Passed = emptyTextNormalized === '' && nullTextNormalized === '';
    
    if (edgeCase2Passed) {
      console.log('  ✅ PASSED: Empty/null text handled correctly');
    } else {
      console.log('  ❌ FAILED: Empty/null text not handled correctly');
      allPassed = false;
    }
    
    testResults.push({
      name: 'Edge Cases',
      passed: edgeCase1Passed && edgeCase2Passed
    });
    
    // Cleanup
    console.log('\nCLEANUP: Removing test data');
    console.log('----------------------------');
    
    await db.delete(questionVersions).where(eq(questionVersions.id, testQuestionVersion.id));
    await db.delete(questions).where(eq(questions.id, testQuestion.id));
    await db.delete(courseQuestionSets).where(eq(courseQuestionSets.courseId, testCourseRecord.id));
    await db.delete(questionSets).where(eq(questionSets.id, testQuestionSet.id));
    await db.delete(courses).where(eq(courses.id, testCourseRecord.id));
    
    console.log('  ✅ Test data cleaned up');
    
  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    allPassed = false;
  }
  
  // Summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  
  const passedCount = testResults.filter(t => t.passed).length;
  const failedCount = testResults.filter(t => !t.passed).length;
  
  testResults.forEach(test => {
    console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}`);
  });
  
  console.log('\n----------------------------------------');
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('----------------------------------------\n');
  
  if (allPassed) {
    console.log('✅✅✅ CONCLUSION: ALL TESTS PASSED ✅✅✅');
    console.log('The upload functionality is working correctly with text matching.');
  } else {
    console.log('❌❌❌ CONCLUSION: TESTS FAILED ❌❌❌');
    console.log('There are issues with the upload functionality that need to be fixed.');
  }
  
  console.log('\n========================================\n');
  
  process.exit(allPassed ? 0 : 1);
}

// Run the test
runComprehensiveTest().catch(error => {
  console.error('Failed to run test:', error);
  process.exit(1);
});