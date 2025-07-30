#!/usr/bin/env tsx
/**
 * Script to properly import all 21 question sets from Bubble with their questions
 * This will map to existing courses and import the question content
 */

import dotenv from 'dotenv';
import { db } from '../server/db';
import { courses, questionSets, questions, questionVersions } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

dotenv.config();

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;

if (!BUBBLE_API_KEY) {
  console.error('❌ BUBBLE_API_KEY not found in environment variables');
  process.exit(1);
}

// Course mapping from Bubble course names to our course external IDs
const COURSE_MAPPING: Record<string, string> = {
  'CPCU 500': '8433',
  'CPCU 520': '8434', 
  'CPCU 530': '8435',
  'CPCU 540': '8436',
  'CPCU 550': '8437',
  'CPCU 551': '8438',
  'CPCU 552': '8439',
  'CPCU 555': '8440',
  'CPCU 556': '8441',
  'AIC 300': '6128',
  'AIC 301': '8428',
  'AIC 302': '8429',
  'AIC 303': '8430',
  'AIC 304': '8431',
  'AIC 305': '8432',
  'AIC 330': '8442'
};

async function fetchAllQuestionSetsFromBubble() {
  console.log('🔍 Fetching all question sets from Bubble repository...');
  
  try {
    const response = await fetch('https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set?limit=100', {
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Bubble API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.response?.results?.length || 0} question sets`);
    
    return data.response?.results || [];
  } catch (error) {
    console.error('❌ Error fetching question sets:', error);
    throw error;
  }
}

async function findOrCreateCourse(courseName: string): Promise<number | null> {
  // Check if we have a mapping for this course
  const externalId = COURSE_MAPPING[courseName];
  
  if (!externalId) {
    console.log(`  ⚠️  No mapping found for course: ${courseName}`);
    return null;
  }

  // Find course by external ID
  const existingCourse = await db
    .select()
    .from(courses)
    .where(eq(courses.externalId, externalId))
    .limit(1);

  if (existingCourse.length > 0) {
    return existingCourse[0].id;
  }

  console.log(`  ⚠️  Course not found with external ID ${externalId} for ${courseName}`);
  return null;
}

async function importQuestionSet(bubbleQuestionSet: any, index: number) {
  try {
    // Extract course name from content
    const courseName = bubbleQuestionSet.content?.set_name;
    
    if (!courseName) {
      console.log(`  ⚠️  Skipping question set without course name in content`);
      return { success: false, error: 'No course name in content' };
    }

    console.log(`\n📋 Processing [${index + 1}/21]: ${bubbleQuestionSet.title} (${courseName})`);
    
    // Find the course
    const courseId = await findOrCreateCourse(courseName);
    
    if (!courseId) {
      return { success: false, error: 'Course not found' };
    }

    // Generate proper title with course prefix
    const questionSetTitle = `${courseName}: ${bubbleQuestionSet.title}`;
    
    // Check if question set already exists with this title
    const existingQS = await db
      .select()
      .from(questionSets)
      .where(and(
        eq(questionSets.courseId, courseId),
        eq(questionSets.title, questionSetTitle)
      ))
      .limit(1);
    
    let questionSetId: number;
    
    if (existingQS.length > 0) {
      console.log(`  ℹ️  Question set already exists, will update questions`);
      questionSetId = existingQS[0].id;
      
      // Delete existing questions to reimport
      const existingQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.questionSetId, questionSetId));
      
      if (existingQuestions.length > 0) {
        console.log(`  🗑️  Removing ${existingQuestions.length} existing questions`);
        // Delete question versions first
        for (const q of existingQuestions) {
          await db
            .delete(questionVersions)
            .where(eq(questionVersions.questionId, q.id));
        }
        // Then delete questions
        await db
          .delete(questions)
          .where(eq(questions.questionSetId, questionSetId));
      }
    } else {
      // Create new question set
      const newQuestionSet = await db
        .insert(questionSets)
        .values({
          courseId: courseId,
          title: questionSetTitle,
          description: null,
          questionCount: 0
        })
        .returning();
      
      questionSetId = newQuestionSet[0].id;
      console.log(`  ✓ Created question set: ${questionSetTitle}`);
    }

    // Import questions from content field
    let importedQuestions = 0;
    let questionsData: any[] = [];
    
    if (bubbleQuestionSet.content && bubbleQuestionSet.content.questions) {
      questionsData = bubbleQuestionSet.content.questions;
    } else if (!bubbleQuestionSet.content || !bubbleQuestionSet.content.questions) {
      questionsData = bubbleQuestionSet.questions || [];
    }
    
    if (questionsData.length > 0) {
      console.log(`  📝 Importing ${questionsData.length} questions...`);
      
      for (const q of questionsData) {
        try {
          // Create question
          const newQuestion = await db
            .insert(questions)
            .values({
              questionSetId: questionSetId,
              originalQuestionNumber: q.question_number || 0,
              currentVersionNumber: 1
            })
            .returning();

          // Create question version
          await db
            .insert(questionVersions)
            .values({
              questionId: newQuestion[0].id,
              versionNumber: 1,
              questionText: q.question_text || '',
              answerChoices: q.answer_choices || [],
              correctAnswer: q.correct_answer || '',
              explanation: q.explanation || null,
              courseMaterialId: null,
              loid: q.loid || null
            });

          importedQuestions++;
        } catch (qError) {
          console.error(`    ❌ Error importing question ${q.question_number}:`, qError);
        }
      }

      // Update question count
      await db
        .update(questionSets)
        .set({ questionCount: importedQuestions })
        .where(eq(questionSets.id, questionSetId));

      console.log(`  ✓ Successfully imported ${importedQuestions} questions`);
    } else {
      console.log(`  ⚠️  No questions found in content field or root level`);
    }

    return { success: true, questionSetId, questionsImported: importedQuestions };
  } catch (error) {
    console.error(`  ❌ Error importing question set:`, error);
    return { success: false, error: error.message };
  }
}

async function cleanupDuplicateCourses() {
  console.log('\n🧹 Cleaning up duplicate courses...');
  
  // Delete courses with Bubble IDs as external IDs
  const bubbleCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.title, 'Course 17508790'))
    .where(eq(courses.title, 'Course 17525740'));
  
  for (const course of bubbleCourses) {
    // Check if it has question sets
    const questionSets = await db
      .select()
      .from(questionSets)
      .where(eq(questionSets.courseId, course.id));
    
    if (questionSets.length === 0) {
      console.log(`  🗑️  Deleting empty course: ${course.title} (${course.externalId})`);
      await db
        .delete(courses)
        .where(eq(courses.id, course.id));
    }
  }
}

async function main() {
  console.log('🚀 Starting proper import of all 21 question sets from Bubble...\n');
  
  try {
    // Fetch all question sets
    const bubbleQuestionSets = await fetchAllQuestionSetsFromBubble();
    
    if (bubbleQuestionSets.length === 0) {
      console.log('⚠️  No question sets found to import');
      return;
    }

    console.log(`\n📊 Found ${bubbleQuestionSets.length} question sets to import`);
    
    // Group by course for summary
    const courseGroups = new Map<string, number>();
    bubbleQuestionSets.forEach((qs: any) => {
      const courseName = qs.content?.set_name || 'Unknown';
      courseGroups.set(courseName, (courseGroups.get(courseName) || 0) + 1);
    });

    console.log('\n📚 Question sets by course:');
    courseGroups.forEach((count, courseName) => {
      console.log(`  ${courseName}: ${count} question sets`);
    });

    // Import all question sets
    console.log('\n🔄 Starting import process...');
    const results = {
      successful: 0,
      failed: 0,
      totalQuestions: 0
    };

    for (let i = 0; i < bubbleQuestionSets.length; i++) {
      const result = await importQuestionSet(bubbleQuestionSets[i], i);
      if (result.success) {
        results.successful++;
        results.totalQuestions += result.questionsImported || 0;
      } else {
        results.failed++;
      }
    }

    // Cleanup duplicate courses
    await cleanupDuplicateCourses();

    // Summary
    console.log('\n🎉 Import completed!');
    console.log(`   ✓ Successfully processed: ${results.successful} question sets`);
    console.log(`   ✓ Total questions imported: ${results.totalQuestions}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    
    // Show final stats
    const finalStats = await db
      .select()
      .from(questionSets);
    
    console.log(`\n📊 Final database stats:`);
    console.log(`   Total question sets: ${finalStats.length}`);
    
  } catch (error) {
    console.error('\n❌ Import process failed:', error);
    process.exit(1);
  }
}

// Run the import
main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script error:', error);
    process.exit(1);
  });