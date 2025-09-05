#!/usr/bin/env tsx
/**
 * Script to analyze the OLD database structure before migration
 * This works with the original schema to identify duplicate question sets
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, sql } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Define old schema structures (before migration)
const oldCourses = {
  id: 'id',
  courseNumber: 'course_number', 
  courseTitle: 'course_title',
  isAi: 'is_ai'
};

const oldQuestionSets = {
  id: 'id',
  courseId: 'course_id',
  title: 'title',
  description: 'description',
  questionCount: 'question_count',
  externalId: 'external_id',
  isAi: 'is_ai'
};

async function analyzeOldDatabase(databaseUrl: string) {
  const connection = postgres(databaseUrl);
  const db = drizzle(connection);
  
  console.log("🔍 Analyzing OLD database structure...\n");
  
  try {
    // Get all courses
    const courses = await db.execute(sql`
      SELECT id, course_number, course_title, is_ai 
      FROM courses 
      ORDER BY course_number, is_ai
    `);
    
    console.log(`Found ${courses.length} courses:`);
    courses.forEach(course => {
      console.log(`  - ${course.course_number}: ${course.course_title} (${course.is_ai ? 'AI' : 'Non-AI'})`);
    });
    
    // Get all question sets
    const questionSets = await db.execute(sql`
      SELECT qs.id, qs.course_id, qs.title, qs.description, qs.question_count, qs.external_id, qs.is_ai,
             c.course_number, c.course_title
      FROM question_sets qs
      JOIN courses c ON qs.course_id = c.id
      ORDER BY c.course_number, qs.title
    `);
    
    console.log(`\nFound ${questionSets.length} question sets:`);
    
    // Group question sets by course pairs (same base course number)
    const courseGroups = new Map();
    const potentialDuplicates = [];
    
    for (const qs of questionSets) {
      // Extract base course number by removing AI/Non-AI suffixes
      let baseCourseNumber = qs.course_number
        .replace(/\s*\(AI\)\s*$/i, "")
        .replace(/\s*\(Non-AI\)\s*$/i, "")
        .replace(/\s*AI\s*$/i, "")
        .replace(/\s*Non-AI\s*$/i, "")
        .trim();
      
      if (!courseGroups.has(baseCourseNumber)) {
        courseGroups.set(baseCourseNumber, { ai: [], nonAi: [] });
      }
      
      const group = courseGroups.get(baseCourseNumber);
      if (qs.is_ai) {
        group.ai.push(qs);
      } else {
        group.nonAi.push(qs);
      }
    }
    
    // Find potential duplicates
    console.log("\n📊 POTENTIAL DUPLICATE QUESTION SETS:");
    console.log("=" .repeat(60));
    
    let totalDuplicates = 0;
    
    for (const [baseCourseNumber, group] of courseGroups) {
      if (group.ai.length > 0 && group.nonAi.length > 0) {
        console.log(`\n🔄 Course Group: ${baseCourseNumber}`);
        
        // Look for matching question sets by title or external ID
        for (const aiQS of group.ai) {
          const matchingNonAi = group.nonAi.find(nonAiQS => 
            nonAiQS.title === aiQS.title || 
            (aiQS.external_id && nonAiQS.external_id && aiQS.external_id === nonAiQS.external_id)
          );
          
          if (matchingNonAi) {
            console.log(`  ✓ Duplicate found: "${aiQS.title}"`);
            console.log(`    - AI Version: Course ID ${aiQS.course_id}, QS ID ${aiQS.id} (${aiQS.question_count} questions)`);
            console.log(`    - Non-AI Version: Course ID ${matchingNonAi.course_id}, QS ID ${matchingNonAi.id} (${matchingNonAi.question_count} questions)`);
            
            potentialDuplicates.push({
              baseCourseNumber,
              aiQuestionSet: aiQS,
              nonAiQuestionSet: matchingNonAi
            });
            
            totalDuplicates++;
          }
        }
      }
    }
    
    // Get additional statistics
    const totalQuestions = await db.execute(sql`SELECT COUNT(*) as count FROM questions`);
    const totalVersions = await db.execute(sql`SELECT COUNT(*) as count FROM question_versions`);
    const totalUsers = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const totalTestRuns = await db.execute(sql`SELECT COUNT(*) as count FROM user_test_runs`);
    const totalAnswers = await db.execute(sql`SELECT COUNT(*) as count FROM user_answers`);
    
    console.log("\n" + "=".repeat(60));
    console.log("📈 DATABASE SUMMARY");
    console.log("=".repeat(60));
    console.log(`Courses: ${courses.length}`);
    console.log(`Question Sets: ${questionSets.length}`);
    console.log(`Questions: ${totalQuestions[0].count}`);
    console.log(`Question Versions: ${totalVersions[0].count}`);
    console.log(`Users: ${totalUsers[0].count}`);
    console.log(`Test Runs: ${totalTestRuns[0].count}`);
    console.log(`User Answers: ${totalAnswers[0].count}`);
    
    console.log("\n💾 MIGRATION IMPACT:");
    console.log(`Duplicate question sets found: ${totalDuplicates}`);
    console.log(`Question sets after deduplication: ${questionSets.length - totalDuplicates}`);
    console.log(`Reduction: ${totalDuplicates} (${((totalDuplicates / questionSets.length) * 100).toFixed(1)}%)`);
    
    console.log("\n🎯 READY FOR MIGRATION:");
    console.log(`✅ Old database analyzed successfully`);
    console.log(`✅ ${potentialDuplicates.length} duplicate pairs identified`);
    console.log(`✅ Migration will consolidate ${totalDuplicates} duplicate question sets`);
    
  } catch (error) {
    console.error("❌ Error during analysis:", error);
  } finally {
    await connection.end();
  }
}

// Main execution
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable not set");
    process.exit(1);
  }
  
  await analyzeOldDatabase(databaseUrl);
}

main().catch(console.error);