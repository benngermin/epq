#!/usr/bin/env tsx
/**
 * Emergency rollback script for the shared question sets migration
 * This script reverses the migration by restoring the old schema structure
 * WARNING: This will lose any data created after the migration!
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  courses, courseQuestionSets, questionSets, questions, questionVersions,
  users, userTestRuns, userAnswers, userCourseProgress, 
  chatbotFeedback, dailyActivitySummary
} from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface RollbackStats {
  coursesProcessed: number;
  questionSetsRestored: number;
  questionsProcessed: number;
  testRunsRestored: number;
  junctionEntriesRemoved: number;
  errors: string[];
}

async function rollbackMigration(databaseUrl: string): Promise<RollbackStats> {
  const connection = postgres(databaseUrl);
  const db = drizzle(connection);
  
  const stats: RollbackStats = {
    coursesProcessed: 0,
    questionSetsRestored: 0,
    questionsProcessed: 0,
    testRunsRestored: 0,
    junctionEntriesRemoved: 0,
    errors: []
  };
  
  console.log("🔙 Starting rollback of shared question sets migration...");
  console.log("⚠️  WARNING: This will restore the old schema and may cause data loss!");
  console.log("");
  
  // Ask for confirmation
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>((resolve) => {
    rl.question("Are you sure you want to proceed with rollback? Type 'ROLLBACK' to confirm: ", resolve);
  });
  
  rl.close();
  
  if (answer !== "ROLLBACK") {
    console.log("Rollback cancelled.");
    process.exit(0);
  }
  
  try {
    // Step 1: Re-add courseId and isAi columns to question_sets table
    console.log("📝 Step 1: Modifying question_sets table schema...");
    
    try {
      // Add courseId column back
      await db.execute(sql`
        ALTER TABLE question_sets 
        ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id)
      `);
      
      // Add isAi column back
      await db.execute(sql`
        ALTER TABLE question_sets 
        ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT true NOT NULL
      `);
      
      console.log("  ✓ Schema modifications completed");
    } catch (error) {
      stats.errors.push(`Schema modification error: ${error}`);
      console.log(`  ❌ Schema modification failed: ${error}`);
    }
    
    // Step 2: Restore courseId for each question set based on junction table
    console.log("\n📝 Step 2: Restoring courseId relationships...");
    
    // Get all question sets and their course mappings
    const questionSetMappings = await db.select({
      questionSetId: courseQuestionSets.questionSetId,
      courseId: courseQuestionSets.courseId,
      questionSetTitle: questionSets.title,
      courseIsAi: courses.isAi
    })
      .from(courseQuestionSets)
      .innerJoin(questionSets, eq(courseQuestionSets.questionSetId, questionSets.id))
      .innerJoin(courses, eq(courseQuestionSets.courseId, courses.id));
    
    // Group by question set to determine which course to assign
    const questionSetGroups = new Map<number, Array<typeof questionSetMappings[0]>>();
    
    for (const mapping of questionSetMappings) {
      if (!questionSetGroups.has(mapping.questionSetId)) {
        questionSetGroups.set(mapping.questionSetId, []);
      }
      questionSetGroups.get(mapping.questionSetId)!.push(mapping);
    }
    
    // For each question set group, we need to duplicate it back to individual course question sets
    for (const [questionSetId, mappings] of questionSetGroups) {
      if (mappings.length === 1) {
        // Simple case: only mapped to one course, restore direct relationship
        await db.execute(sql`
          UPDATE question_sets 
          SET course_id = ${mappings[0].courseId}, is_ai = ${mappings[0].courseIsAi}
          WHERE id = ${questionSetId}
        `);
        stats.questionSetsRestored++;
        
      } else {
        // Complex case: mapped to multiple courses, need to duplicate the question set
        const originalQS = await db.select().from(questionSets).where(eq(questionSets.id, questionSetId)).limit(1);
        
        if (originalQS.length === 0) {
          stats.errors.push(`Question set ${questionSetId} not found`);
          continue;
        }
        
        // Keep the original for the first mapping
        await db.execute(sql`
          UPDATE question_sets 
          SET course_id = ${mappings[0].courseId}, is_ai = ${mappings[0].courseIsAi}
          WHERE id = ${questionSetId}
        `);
        stats.questionSetsRestored++;
        
        // Create duplicates for additional mappings
        for (let i = 1; i < mappings.length; i++) {
          const mapping = mappings[i];
          
          // Create duplicate question set
          const [duplicateQS] = await db.insert(questionSets).values({
            title: originalQS[0].title,
            description: originalQS[0].description,
            questionCount: originalQS[0].questionCount,
            externalId: originalQS[0].externalId,
            courseId: mapping.courseId,
            isAi: mapping.courseIsAi
          }).returning();
          
          stats.questionSetsRestored++;
          
          // Duplicate all questions and versions
          const originalQuestions = await db.select()
            .from(questions)
            .where(eq(questions.questionSetId, questionSetId));
          
          for (const originalQuestion of originalQuestions) {
            const [duplicateQuestion] = await db.insert(questions).values({
              questionSetId: duplicateQS.id,
              originalQuestionNumber: originalQuestion.originalQuestionNumber,
              loid: originalQuestion.loid
            }).returning();
            
            stats.questionsProcessed++;
            
            // Duplicate question versions
            const originalVersions = await db.select()
              .from(questionVersions)
              .where(eq(questionVersions.questionId, originalQuestion.id));
            
            for (const originalVersion of originalVersions) {
              await db.insert(questionVersions).values({
                questionId: duplicateQuestion.id,
                versionNumber: originalVersion.versionNumber,
                topicFocus: originalVersion.topicFocus,
                questionText: originalVersion.questionText,
                questionType: originalVersion.questionType,
                answerChoices: originalVersion.answerChoices,
                correctAnswer: originalVersion.correctAnswer,
                acceptableAnswers: originalVersion.acceptableAnswers,
                caseSensitive: originalVersion.caseSensitive,
                allowMultiple: originalVersion.allowMultiple,
                matchingPairs: originalVersion.matchingPairs,
                correctOrder: originalVersion.correctOrder,
                blanks: originalVersion.blanks,
                dropZones: originalVersion.dropZones
              });
            }
            
            // Update user test runs to point to the new question set
            // This is complex because we need to figure out which test runs should point where
            // For now, we'll leave them pointing to the original
          }
        }
      }
    }
    
    console.log(`  ✓ Restored ${stats.questionSetsRestored} question sets`);
    
    // Step 3: Remove baseCourseNumber column from courses
    console.log("\n📝 Step 3: Removing baseCourseNumber column...");
    
    try {
      await db.execute(sql`
        ALTER TABLE courses 
        DROP COLUMN IF EXISTS base_course_number
      `);
      console.log("  ✓ baseCourseNumber column removed");
    } catch (error) {
      stats.errors.push(`Column removal error: ${error}`);
      console.log(`  ❌ Column removal failed: ${error}`);
    }
    
    // Step 4: Drop course_question_sets junction table
    console.log("\n📝 Step 4: Dropping junction table...");
    
    const junctionEntryCount = await db.select({ count: sql<number>`count(*)` })
      .from(courseQuestionSets);
    stats.junctionEntriesRemoved = Number(junctionEntryCount[0].count);
    
    try {
      await db.execute(sql`DROP TABLE IF EXISTS course_question_sets CASCADE`);
      console.log(`  ✓ Junction table dropped (removed ${stats.junctionEntriesRemoved} entries)`);
    } catch (error) {
      stats.errors.push(`Junction table drop error: ${error}`);
      console.log(`  ❌ Junction table drop failed: ${error}`);
    }
    
    // Step 5: Validate rollback
    console.log("\n📝 Step 5: Validating rollback...");
    
    const orphanedQuestionSets = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM question_sets 
      WHERE course_id IS NULL
    `);
    
    if (Number(orphanedQuestionSets[0].count) === 0) {
      console.log("  ✅ No orphaned question sets found");
    } else {
      console.log(`  ⚠️  ${orphanedQuestionSets[0].count} question sets have no course assignment`);
      stats.errors.push(`${orphanedQuestionSets[0].count} orphaned question sets`);
    }
    
  } catch (error) {
    console.error("❌ Rollback error:", error);
    stats.errors.push(`Fatal error: ${error}`);
  } finally {
    await connection.end();
  }
  
  return stats;
}

// Main execution
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable not set");
    process.exit(1);
  }
  
  const stats = await rollbackMigration(databaseUrl);
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 ROLLBACK SUMMARY");
  console.log("=".repeat(60));
  console.log(`Question sets restored: ${stats.questionSetsRestored}`);
  console.log(`Questions processed: ${stats.questionsProcessed}`);
  console.log(`Junction entries removed: ${stats.junctionEntriesRemoved}`);
  
  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  console.log("\n⚠️  IMPORTANT POST-ROLLBACK STEPS:");
  console.log("1. Restart the application to use the old schema");
  console.log("2. Verify all functionality works as expected");
  console.log("3. Check for any orphaned data that needs cleanup");
  
  // Save detailed report
  const fs = await import("fs/promises");
  const reportPath = path.join(process.cwd(), "rollback-report.json");
  await fs.writeFile(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

main().catch(console.error);