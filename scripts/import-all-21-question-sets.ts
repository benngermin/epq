#!/usr/bin/env tsx
/**
 * Script to import all 21 question sets from Bubble repository
 * This will fetch ALL available question sets and import them with proper course categorization
 */

import dotenv from 'dotenv';
import { db } from '../server/db';
import { courses, questionSets, questions, questionVersions } from '../shared/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;

if (!BUBBLE_API_KEY) {
  console.error('❌ BUBBLE_API_KEY not found in environment variables');
  process.exit(1);
}

// Map to store course mappings (Bubble ID -> Local DB ID)
const courseMap = new Map<string, number>();

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

async function ensureCourseExists(bubbleCourseId: string, courseName?: string): Promise<number> {
  // Check if we already mapped this course
  if (courseMap.has(bubbleCourseId)) {
    return courseMap.get(bubbleCourseId)!;
  }

  // Check if course exists by external ID
  const existingCourse = await db
    .select()
    .from(courses)
    .where(eq(courses.externalId, bubbleCourseId))
    .limit(1);

  if (existingCourse.length > 0) {
    courseMap.set(bubbleCourseId, existingCourse[0].id);
    return existingCourse[0].id;
  }

  // Create new course
  const courseTitle = courseName || `Course ${bubbleCourseId.substring(0, 8)}`;
  console.log(`  📚 Creating new course: ${courseTitle}`);
  
  const newCourse = await db
    .insert(courses)
    .values({
      title: courseTitle,
      description: `Imported from Bubble repository`,
      externalId: bubbleCourseId
    })
    .returning();

  courseMap.set(bubbleCourseId, newCourse[0].id);
  return newCourse[0].id;
}

async function importQuestionSet(bubbleQuestionSet: any) {
  try {
    console.log(`\n📋 Processing: ${bubbleQuestionSet.title || bubbleQuestionSet._id}`);
    
    if (!bubbleQuestionSet.course) {
      console.log(`  ⚠️  Skipping question set without course`);
      return { success: false, error: 'No course ID' };
    }

    // Extract course name from content if available
    let courseName = bubbleQuestionSet.content?.set_name;
    
    // Ensure course exists
    const courseId = await ensureCourseExists(bubbleQuestionSet.course, courseName);
    
    // Check if question set already exists
    const existingQS = await db
      .select()
      .from(questionSets)
      .where(eq(questionSets.courseId, courseId))
      .where(eq(questionSets.title, bubbleQuestionSet.title || `Question Set ${bubbleQuestionSet._id}`));
    
    if (existingQS.length > 0) {
      console.log(`  ⚠️  Question set already exists: ${bubbleQuestionSet.title}`);
      return { success: false, error: 'Already exists' };
    }

    // Create question set
    const newQuestionSet = await db
      .insert(questionSets)
      .values({
        courseId: courseId,
        title: bubbleQuestionSet.title || `Question Set ${bubbleQuestionSet._id}`,
        description: null,
        questionCount: 0
      })
      .returning();

    console.log(`  ✓ Created question set: ${newQuestionSet[0].title}`);

    // Import questions from content field
    let importedQuestions = 0;
    if (bubbleQuestionSet.content && bubbleQuestionSet.content.questions) {
      const questionsData = bubbleQuestionSet.content.questions;
      
      for (const q of questionsData) {
        try {
          // Create question
          const newQuestion = await db
            .insert(questions)
            .values({
              questionSetId: newQuestionSet[0].id,
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
              courseMaterialId: null
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
        .where(eq(questionSets.id, newQuestionSet[0].id));

      console.log(`  ✓ Imported ${importedQuestions} questions`);
    }

    return { success: true, questionSetId: newQuestionSet[0].id, questionsImported: importedQuestions };
  } catch (error) {
    console.error(`  ❌ Error importing question set:`, error);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting import of all 21 question sets from Bubble...\n');
  
  try {
    // Fetch all question sets
    const bubbleQuestionSets = await fetchAllQuestionSetsFromBubble();
    
    if (bubbleQuestionSets.length === 0) {
      console.log('⚠️  No question sets found to import');
      return;
    }

    console.log(`\n📊 Found ${bubbleQuestionSets.length} question sets to import`);
    
    // Group by course for summary
    const courseGroups = new Map<string, any[]>();
    bubbleQuestionSets.forEach((qs: any) => {
      const courseId = qs.course || 'unknown';
      if (!courseGroups.has(courseId)) {
        courseGroups.set(courseId, []);
      }
      courseGroups.get(courseId)!.push(qs);
    });

    console.log('\n📚 Question sets by course:');
    courseGroups.forEach((questionSets, courseId) => {
      const courseName = questionSets[0]?.content?.set_name || `Course ${courseId.substring(0, 8)}`;
      console.log(`  ${courseName}: ${questionSets.length} question sets`);
    });

    // Import all question sets
    console.log('\n🔄 Starting import process...');
    const results = {
      successful: 0,
      failed: 0,
      alreadyExists: 0,
      totalQuestions: 0
    };

    for (const qs of bubbleQuestionSets) {
      const result = await importQuestionSet(qs);
      if (result.success) {
        results.successful++;
        results.totalQuestions += result.questionsImported || 0;
      } else if (result.error === 'Already exists') {
        results.alreadyExists++;
      } else {
        results.failed++;
      }
    }

    // Summary
    console.log('\n🎉 Import completed!');
    console.log(`   ✓ Successfully imported: ${results.successful} question sets`);
    console.log(`   ✓ Total questions imported: ${results.totalQuestions}`);
    console.log(`   ⚠️  Already existed: ${results.alreadyExists}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    
    // Show final course count
    const finalCourses = await db.select().from(courses);
    console.log(`\n📚 Total courses in database: ${finalCourses.length}`);
    
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