#!/usr/bin/env tsx
/**
 * Server-side script to import all question sets from Bubble repository
 * Run with: tsx server/scripts/import-all-bubble-data.ts
 */

import { db } from '../db.js';
import { DatabaseStorage } from '../storage.js';
import { courses, questionSets, questions, questionVersions } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;

if (!BUBBLE_API_KEY) {
  console.error('❌ BUBBLE_API_KEY not found in environment variables');
  process.exit(1);
}

const storage = new DatabaseStorage();

// Cache for course mappings
const courseCache = new Map<string, any>();

async function fetchCoursesFromBubble() {
  console.log('📚 Fetching courses from Bubble repository...');
  
  try {
    const url = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/course";
    const headers = {
      "Authorization": `Bearer ${BUBBLE_API_KEY}`,
      "Content-Type": "application/json"
    };

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch courses: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const courses = data.response?.results || [];
    
    console.log(`✅ Found ${courses.length} courses`);
    
    // Build course cache
    courses.forEach((course: any) => {
      courseCache.set(course._id, {
        courseNumber: course["course number"] || course.course_number,
        courseTitle: course["course title"] || course.course_title || course.title
      });
    });
    
    return courses;
  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    throw error;
  }
}

async function fetchAllQuestionSetsFromBubble() {
  console.log('🔍 Fetching all question sets from Bubble repository...');
  
  try {
    // First fetch question sets from the assessment_question_set endpoint
    const assessmentUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/assessment_question_set";
    const headers = {
      "Authorization": `Bearer ${BUBBLE_API_KEY}`,
      "Content-Type": "application/json"
    };

    const assessmentResponse = await fetch(assessmentUrl, { headers });
    
    if (!assessmentResponse.ok) {
      console.log('⚠️  Assessment endpoint failed, trying question_set endpoint...');
      // Try the question_set endpoint as fallback
      const questionSetUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set";
      const questionSetResponse = await fetch(questionSetUrl, { headers });
      
      if (!questionSetResponse.ok) {
        throw new Error(`Bubble API error: ${questionSetResponse.status} ${questionSetResponse.statusText}`);
      }
      
      const data = await questionSetResponse.json();
      console.log(`✅ Found ${data.response?.results?.length || 0} question sets in Bubble`);
      return data.response?.results || [];
    }

    const data = await assessmentResponse.json();
    console.log(`✅ Found ${data.response?.results?.length || 0} assessment question sets in Bubble`);
    
    // Log the first question set to understand the structure
    if (data.response?.results?.[0]) {
      console.log('\n📋 Sample assessment question set structure:');
      console.log(JSON.stringify(data.response.results[0], null, 2).substring(0, 500) + '...');
    }
    
    return data.response?.results || [];
  } catch (error) {
    console.error('❌ Error fetching from Bubble:', error);
    throw error;
  }
}

async function importQuestionSets(bubbleQuestionSets: any[]) {
  const importResults = {
    imported: 0,
    failed: 0,
    errors: [] as string[]
  };

  console.log(`\n📥 Starting import of ${bubbleQuestionSets.length} question sets...`);

  for (const bubbleQuestionSet of bubbleQuestionSets) {
    try {
      console.log(`\n📋 Processing: ${bubbleQuestionSet.title || bubbleQuestionSet._id}`);
      
      // Extract course information - based on the screenshot, course is a direct field
      const courseBubbleId = bubbleQuestionSet.course;
      
      if (!courseBubbleId) {
        console.log(`⚠️  Skipping question set without course: ${bubbleQuestionSet.title}`);
        importResults.errors.push(`No course for: ${bubbleQuestionSet.title}`);
        importResults.failed++;
        continue;
      }

      // Get course info from cache
      const courseInfo = courseCache.get(courseBubbleId);
      const courseNumber = courseInfo?.courseNumber || courseBubbleId;
      const courseTitle = courseInfo?.courseTitle || courseNumber;

      // Find or create course
      let course = await storage.getCourseByExternalId(courseNumber);
      if (!course) {
        console.log(`  📚 Creating new course: ${courseNumber}`);
        course = await storage.createCourse({
          courseTitle: courseTitle,
          courseNumber: courseNumber,
          externalId: courseNumber
        });
      } else {
        console.log(`  ✓ Found existing course: ${course.courseTitle}`);
      }

      // Check if question set already exists
      const existingQuestionSets = await db
        .select()
        .from(questionSets)
        .where(eq(questionSets.courseId, course.id));
        
      const questionSetTitle = bubbleQuestionSet.title || `Question Set ${bubbleQuestionSet._id}`;
      const existingQS = existingQuestionSets.find(qs => qs.title === questionSetTitle);
      
      if (existingQS) {
        console.log(`  ⚠️  Question set already exists: ${questionSetTitle}`);
        importResults.errors.push(`Already exists: ${questionSetTitle}`);
        importResults.failed++;
        continue;
      }

      // Create question set
      const questionSet = await storage.createQuestionSet({
        courseId: course.id,
        title: questionSetTitle,
        description: bubbleQuestionSet.description || null,
      });
      console.log(`  ✓ Created question set: ${questionSet.title}`);

      // Import questions if they exist in content field
      let questionsData = null;
      
      // Try to parse questions from content field
      if (bubbleQuestionSet.content) {
        try {
          // The content field might be a JSON string containing questions
          if (typeof bubbleQuestionSet.content === 'string') {
            const parsedContent = JSON.parse(bubbleQuestionSet.content);
            if (parsedContent.questions) {
              questionsData = parsedContent.questions;
            } else if (Array.isArray(parsedContent)) {
              questionsData = parsedContent;
            }
          } else if (bubbleQuestionSet.content.questions) {
            questionsData = bubbleQuestionSet.content.questions;
          }
        } catch (e) {
          console.log(`  ⚠️  Could not parse content field for questions`);
        }
      }
      
      // Fallback to questions field if it exists
      if (!questionsData && bubbleQuestionSet.questions && Array.isArray(bubbleQuestionSet.questions)) {
        questionsData = bubbleQuestionSet.questions;
      }
      
      if (questionsData && Array.isArray(questionsData) && questionsData.length > 0) {
        console.log(`  📝 Importing ${questionsData.length} questions...`);
        
        const questionImports = questionsData.map((q: any, index: number) => ({
          question_number: q.question_number || q.number || (index + 1),
          type: q.type || "multiple_choice",
          loid: q.loid || "unknown",
          versions: [{
            version_number: 1,
            topic_focus: q.topic_focus || bubbleQuestionSet.title || "General",
            question_text: q.question_text || q.text || "",
            question_type: q.question_type || q.type || "multiple_choice",
            answer_choices: q.answer_choices || q.choices || [],
            correct_answer: q.correct_answer || q.answer || "",
            acceptable_answers: q.acceptable_answers,
            case_sensitive: q.case_sensitive || false,
            allow_multiple: q.allow_multiple || false,
            matching_pairs: q.matching_pairs,
            correct_order: q.correct_order
          }]
        }));

        await storage.importQuestions(questionSet.id, questionImports);
        
        // Update question count
        await storage.updateQuestionSetCount(questionSet.id);
        console.log(`  ✓ Imported ${questionsData.length} questions`);
      } else {
        console.log(`  ℹ️  No questions found in this question set`);
      }

      importResults.imported++;
      console.log(`  ✅ Successfully imported: ${questionSetTitle}`);
      
    } catch (error) {
      importResults.failed++;
      const errorMsg = `Failed to import ${bubbleQuestionSet.title}: ${error instanceof Error ? error.message : String(error)}`;
      importResults.errors.push(errorMsg);
      console.error(`  ❌ ${errorMsg}`);
    }
  }

  return importResults;
}

async function main() {
  console.log('🚀 Bubble Data Import Script\n');
  console.log('============================================\n');
  
  try {
    // Step 1: Fetch all courses from Bubble
    await fetchCoursesFromBubble();
    
    // Step 2: Fetch all question sets from Bubble
    const bubbleQuestionSets = await fetchAllQuestionSetsFromBubble();
    
    if (bubbleQuestionSets.length === 0) {
      console.log('⚠️  No question sets found in Bubble repository');
      return;
    }

    // Show summary of what will be imported
    console.log('\n📊 Question Sets to Import:');
    console.log('============================================');
    bubbleQuestionSets.forEach((qs: any) => {
      const courseNum = qs.learning_object?.course?.course_number || 'Unknown';
      const questionCount = qs.questions?.length || 0;
      console.log(`  • ${qs.title || 'Untitled'}`);
      console.log(`    Course: ${courseNum} | Questions: ${questionCount}`);
    });
    console.log('============================================');

    // Step 2: Import all question sets
    const results = await importQuestionSets(bubbleQuestionSets);
    
    // Step 3: Show final results
    console.log('\n\n🎉 Import Process Complete!');
    console.log('============================================');
    console.log(`✅ Successfully imported: ${results.imported}`);
    console.log(`❌ Failed to import: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }
    
    console.log('\n✨ All done! The imported question sets are now available in the application.');
    
  } catch (error) {
    console.error('\n❌ Import process failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.$client.end();
  }
}

// Run the import
main().catch(console.error);