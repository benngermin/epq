#!/usr/bin/env tsx
/**
 * Test script to verify the position-based refresh functionality
 * This script tests refreshing CPCU 540 Question Set 2 to ensure:
 * 1. Questions maintain exact order from Bubble
 * 2. display_order equals original_question_number
 * 3. Static explanations are preserved
 */

import { config } from 'dotenv';
import { db } from './db';
import { questions, questionVersions } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { storage } from './storage';

// Load environment variables
config();

const QUESTION_SET_ID = 22; // CPCU 540 Question Set 2
const BUBBLE_BASE_URL = process.env.BUBBLE_BASE_URL || 'https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj';

async function testRefresh() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                    TESTING POSITION-BASED REFRESH                     ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Get the question set details
    const questionSet = await storage.getQuestionSet(QUESTION_SET_ID);
    if (!questionSet) {
      console.error('❌ Question set not found');
      return;
    }

    console.log(`📚 Testing Question Set: ${questionSet.title}`);
    console.log(`   External ID: ${questionSet.externalId}`);
    
    // Step 2: Check current state
    console.log('\n📊 BEFORE REFRESH:');
    const beforeQuestions = await db.select({
      id: questions.id,
      originalQuestionNumber: questions.originalQuestionNumber,
      displayOrder: questions.displayOrder,
      loid: questions.loid,
      hasStaticExplanation: sql<boolean>`${questionVersions.staticExplanation} IS NOT NULL`
    })
    .from(questions)
    .leftJoin(questionVersions, and(
      eq(questionVersions.questionId, questions.id),
      eq(questionVersions.isActive, true)
    ))
    .where(eq(questions.questionSetId, QUESTION_SET_ID))
    .orderBy(questions.displayOrder);

    console.log(`   Total questions: ${beforeQuestions.length}`);
    
    // Check for order mismatches
    const orderMismatches = beforeQuestions.filter(q => q.displayOrder !== q.originalQuestionNumber);
    if (orderMismatches.length > 0) {
      console.log(`   ⚠️ Order mismatches found: ${orderMismatches.length} questions`);
      console.log('   Examples:');
      orderMismatches.slice(0, 3).forEach(q => {
        console.log(`     - Question ${q.id}: display_order=${q.displayOrder}, original_question_number=${q.originalQuestionNumber}`);
      });
    } else {
      console.log('   ✅ All questions have correct ordering');
    }

    // Count static explanations
    const withStaticExplanations = beforeQuestions.filter(q => q.hasStaticExplanation).length;
    console.log(`   Static explanations: ${withStaticExplanations} questions`);

    // Step 3: Fetch from Bubble
    console.log('\n🔄 FETCHING FROM BUBBLE:');
    const bubbleApiKey = process.env.BUBBLE_API_KEY;
    if (!bubbleApiKey) {
      console.error('❌ Bubble API key not configured');
      return;
    }

    const url = `${BUBBLE_BASE_URL}/question_set/${questionSet.externalId}`;
    const headers = {
      "Authorization": `Bearer ${bubbleApiKey}`,
      "Content-Type": "application/json"
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`❌ Failed to fetch from Bubble: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const bubbleQuestionSet = data.response;

    // Parse questions from content
    let parsedQuestions: any[] = [];
    if (bubbleQuestionSet.content) {
      try {
        const contentJson = JSON.parse(bubbleQuestionSet.content);
        if (contentJson.questions && Array.isArray(contentJson.questions)) {
          parsedQuestions = contentJson.questions;
        }
      } catch (parseError) {
        console.error('❌ Error parsing question content:', parseError);
        return;
      }
    }

    console.log(`   Fetched ${parsedQuestions.length} questions from Bubble`);
    
    // Check question_number field
    const numbersValid = parsedQuestions.every((q, i) => {
      const expectedNumber = i + 1;
      return q.question_number === expectedNumber;
    });
    
    if (numbersValid) {
      console.log('   ✅ All question_number fields are valid and sequential');
    } else {
      console.log('   ⚠️ Some question_number fields may need correction');
    }

    // Step 4: Perform the refresh
    console.log('\n🚀 RUNNING POSITION-BASED REFRESH:');
    console.log('   (Check console output below for detailed refresh logs)\n');
    console.log('─'.repeat(70));

    // Prepare question imports
    const questionImports = parsedQuestions.map((q: any, index: number) => {
      const questionNumber = q.question_number || (index + 1);
      
      return {
        question_number: questionNumber,
        type: q.question_type || "multiple_choice",
        loid: q.loid || `generated_${questionSet.externalId}_${questionNumber}`,
        versions: [{
          version_number: 1,
          topic_focus: bubbleQuestionSet.title || "General",
          question_text: q.question_text || "",
          question_type: q.question_type || "multiple_choice",
          answer_choices: q.answer_choices || [],
          correct_answer: q.correct_answer || "",
          acceptable_answers: q.acceptable_answers,
          case_sensitive: q.case_sensitive || false,
          allow_multiple: q.allow_multiple || false,
          matching_pairs: q.matching_pairs || null,
          correct_order: q.correct_order || null,
          blanks: q.blanks || null,
          drop_zones: q.drop_zones || null
        }]
      };
    });

    // Run the refresh
    await storage.updateQuestionsForRefresh(QUESTION_SET_ID, questionImports);
    
    console.log('─'.repeat(70));

    // Step 5: Verify results
    console.log('\n✅ AFTER REFRESH:');
    const afterQuestions = await db.select({
      id: questions.id,
      originalQuestionNumber: questions.originalQuestionNumber,
      displayOrder: questions.displayOrder,
      loid: questions.loid,
      hasStaticExplanation: sql<boolean>`${questionVersions.staticExplanation} IS NOT NULL`
    })
    .from(questions)
    .leftJoin(questionVersions, and(
      eq(questionVersions.questionId, questions.id),
      eq(questionVersions.isActive, true)
    ))
    .where(eq(questions.questionSetId, QUESTION_SET_ID))
    .orderBy(questions.displayOrder);

    console.log(`   Total questions: ${afterQuestions.length}`);
    
    // Check for order correctness
    const afterOrderMismatches = afterQuestions.filter(q => q.displayOrder !== q.originalQuestionNumber);
    if (afterOrderMismatches.length > 0) {
      console.log(`   ❌ FAILED: Still have ${afterOrderMismatches.length} order mismatches`);
      afterOrderMismatches.slice(0, 3).forEach(q => {
        console.log(`     - Question ${q.id}: display_order=${q.displayOrder}, original_question_number=${q.originalQuestionNumber}`);
      });
    } else {
      console.log('   ✅ SUCCESS: All questions have display_order = original_question_number');
    }

    // Check static explanations preserved
    const afterWithStaticExplanations = afterQuestions.filter(q => q.hasStaticExplanation).length;
    console.log(`   Static explanations preserved: ${afterWithStaticExplanations} questions`);
    if (afterWithStaticExplanations >= withStaticExplanations) {
      console.log('   ✅ All static explanations preserved');
    } else {
      console.log(`   ⚠️ Some static explanations may have been lost (was ${withStaticExplanations}, now ${afterWithStaticExplanations})`);
    }

    // Display sample of corrected ordering
    console.log('\n📋 SAMPLE OF CORRECTED ORDERING:');
    console.log('   First 5 questions:');
    afterQuestions.slice(0, 5).forEach(q => {
      console.log(`     Position ${q.displayOrder}: Question ID ${q.id} (LOID: ${q.loid || 'none'})`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('                         TEST COMPLETED                                ');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }

  process.exit(0);
}

// Run the test
testRefresh();