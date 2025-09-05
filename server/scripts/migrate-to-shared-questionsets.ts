#!/usr/bin/env tsx
/**
 * Script to migrate from duplicate question sets to shared question sets using junction table
 * This script performs the actual data migration from the old schema to the new schema
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  courses, courseQuestionSets, questionSets, questions, questionVersions,
  users, userTestRuns, userAnswers, userCourseProgress, 
  chatbotFeedback, dailyActivitySummary
} from "../../shared/schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface MigrationStats {
  coursesProcessed: number;
  questionSetsOriginal: number;
  questionSetsDeduplicated: number;
  questionsProcessed: number;
  questionVersionsProcessed: number;
  mappingsCreated: number;
  testRunsUpdated: number;
  errors: string[];
}

async function migrateToSharedQuestionSets(
  oldDbUrl: string,
  newDbUrl: string
): Promise<MigrationStats> {
  const oldConnection = postgres(oldDbUrl);
  const oldDb = drizzle(oldConnection);
  
  const newConnection = postgres(newDbUrl);
  const newDb = drizzle(newConnection);
  
  const stats: MigrationStats = {
    coursesProcessed: 0,
    questionSetsOriginal: 0,
    questionSetsDeduplicated: 0,
    questionsProcessed: 0,
    questionVersionsProcessed: 0,
    mappingsCreated: 0,
    testRunsUpdated: 0,
    errors: []
  };
  
  console.log("🚀 Starting migration to shared question sets...\n");
  
  try {
    // Step 1: Migrate users
    console.log("📤 Migrating users...");
    const oldUsers = await oldDb.select().from(users);
    if (oldUsers.length > 0) {
      await newDb.insert(users).values(oldUsers).onConflictDoNothing();
    }
    console.log(`  ✓ Migrated ${oldUsers.length} users`);
    
    // Step 2: Migrate courses and populate baseCourseNumber
    console.log("\n📤 Migrating courses...");
    const oldCourses = await oldDb.select().from(courses);
    
    for (const course of oldCourses) {
      // Calculate base course number
      const baseCourseNumber = course.courseNumber
        .replace(/\s*\(AI\)\s*$/i, "")
        .replace(/\s*\(Non-AI\)\s*$/i, "")
        .replace(/\s*AI\s*$/i, "")
        .replace(/\s*Non-AI\s*$/i, "")
        .trim();
      
      await newDb.insert(courses).values({
        ...course,
        baseCourseNumber
      }).onConflictDoNothing();
      
      stats.coursesProcessed++;
    }
    console.log(`  ✓ Migrated ${stats.coursesProcessed} courses`);
    
    // Step 3: Deduplicate and migrate question sets
    console.log("\n📤 Deduplicating and migrating question sets...");
    
    // Get all question sets from old database
    const oldQuestionSets = await oldDb.select().from(questionSets);
    stats.questionSetsOriginal = oldQuestionSets.length;
    
    // Group courses by base course number in new database
    const newCourses = await newDb.select().from(courses);
    const courseGroups = new Map<string, typeof courses.$inferSelect[]>();
    
    for (const course of newCourses) {
      const key = course.baseCourseNumber || course.courseNumber;
      if (!courseGroups.has(key)) {
        courseGroups.set(key, []);
      }
      courseGroups.get(key)!.push(course);
    }
    
    // Track which old question set IDs map to new question set IDs
    const questionSetMapping = new Map<number, number>();
    
    // Process question sets, deduplicating where possible
    const processedQuestionSets = new Set<string>();
    
    for (const oldQS of oldQuestionSets) {
      // Create a deduplication key based on title and external ID
      const dedupeKey = `${oldQS.title}|${oldQS.externalId || ''}`;
      
      // Find the course this question set belongs to
      const originalCourse = oldCourses.find(c => c.id === oldQS.courseId);
      if (!originalCourse) {
        stats.errors.push(`Question set ${oldQS.id} has no associated course`);
        continue;
      }
      
      const baseCourseNumber = originalCourse.baseCourseNumber || 
        originalCourse.courseNumber
          .replace(/\s*\(AI\)\s*$/i, "")
          .replace(/\s*\(Non-AI\)\s*$/i, "")
          .replace(/\s*AI\s*$/i, "")
          .replace(/\s*Non-AI\s*$/i, "")
          .trim();
      
      // Check if we've already processed this question set for this course group
      const groupKey = `${baseCourseNumber}|${dedupeKey}`;
      
      let newQuestionSetId: number;
      
      if (!processedQuestionSets.has(groupKey)) {
        // Create new question set (without courseId)
        const [newQS] = await newDb.insert(questionSets).values({
          title: oldQS.title,
          description: oldQS.description,
          questionCount: oldQS.questionCount,
          externalId: oldQS.externalId
        }).returning();
        
        newQuestionSetId = newQS.id;
        processedQuestionSets.add(groupKey);
        stats.questionSetsDeduplicated++;
        
        // Migrate questions and versions for this question set
        const oldQuestions = await oldDb.select()
          .from(questions)
          .where(eq(questions.questionSetId, oldQS.id));
        
        for (const oldQuestion of oldQuestions) {
          const [newQuestion] = await newDb.insert(questions).values({
            questionSetId: newQuestionSetId,
            originalQuestionNumber: oldQuestion.originalQuestionNumber,
            loid: oldQuestion.loid
          }).returning();
          
          stats.questionsProcessed++;
          
          // Migrate question versions
          const oldVersions = await oldDb.select()
            .from(questionVersions)
            .where(eq(questionVersions.questionId, oldQuestion.id));
          
          for (const oldVersion of oldVersions) {
            await newDb.insert(questionVersions).values({
              ...oldVersion,
              questionId: newQuestion.id
            });
            stats.questionVersionsProcessed++;
          }
        }
      } else {
        // Find the already created question set
        const existingQS = await newDb.select()
          .from(questionSets)
          .where(and(
            eq(questionSets.title, oldQS.title),
            oldQS.externalId ? eq(questionSets.externalId, oldQS.externalId) : sql`true`
          ))
          .limit(1);
        
        if (existingQS.length === 0) {
          stats.errors.push(`Could not find deduplicated question set for ${oldQS.title}`);
          continue;
        }
        
        newQuestionSetId = existingQS[0].id;
      }
      
      // Map old question set ID to new question set ID
      questionSetMapping.set(oldQS.id, newQuestionSetId);
      
      // Create junction table mappings for all courses in this group
      const coursesInGroup = courseGroups.get(baseCourseNumber) || [];
      for (const course of coursesInGroup) {
        // Check if mapping already exists
        const existingMapping = await newDb.select()
          .from(courseQuestionSets)
          .where(and(
            eq(courseQuestionSets.courseId, course.id),
            eq(courseQuestionSets.questionSetId, newQuestionSetId)
          ))
          .limit(1);
        
        if (existingMapping.length === 0) {
          await newDb.insert(courseQuestionSets).values({
            courseId: course.id,
            questionSetId: newQuestionSetId,
            displayOrder: 0
          });
          stats.mappingsCreated++;
        }
      }
    }
    
    console.log(`  ✓ Original question sets: ${stats.questionSetsOriginal}`);
    console.log(`  ✓ Deduplicated question sets: ${stats.questionSetsDeduplicated}`);
    console.log(`  ✓ Reduction: ${stats.questionSetsOriginal - stats.questionSetsDeduplicated}`);
    console.log(`  ✓ Junction table mappings created: ${stats.mappingsCreated}`);
    
    // Step 4: Migrate user test runs with updated question set IDs
    console.log("\n📤 Migrating user test runs...");
    const oldTestRuns = await oldDb.select().from(userTestRuns);
    
    for (const testRun of oldTestRuns) {
      const newQuestionSetId = questionSetMapping.get(testRun.questionSetId);
      if (newQuestionSetId) {
        await newDb.insert(userTestRuns).values({
          ...testRun,
          questionSetId: newQuestionSetId
        }).onConflictDoNothing();
        stats.testRunsUpdated++;
      } else {
        stats.errors.push(`Could not map test run ${testRun.id} to new question set`);
      }
    }
    console.log(`  ✓ Migrated ${stats.testRunsUpdated} test runs`);
    
    // Step 5: Migrate user answers
    console.log("\n📤 Migrating user answers...");
    const oldAnswers = await oldDb.select().from(userAnswers);
    if (oldAnswers.length > 0) {
      // Need to map question version IDs - this is complex and might need adjustment
      await newDb.insert(userAnswers).values(oldAnswers).onConflictDoNothing();
    }
    console.log(`  ✓ Migrated ${oldAnswers.length} user answers`);
    
    // Step 6: Migrate other tables
    console.log("\n📤 Migrating remaining data...");
    
    // User course progress
    const oldProgress = await oldDb.select().from(userCourseProgress);
    if (oldProgress.length > 0) {
      await newDb.insert(userCourseProgress).values(oldProgress).onConflictDoNothing();
    }
    
    // Chatbot feedback
    const oldFeedback = await oldDb.select().from(chatbotFeedback);
    if (oldFeedback.length > 0) {
      await newDb.insert(chatbotFeedback).values(oldFeedback).onConflictDoNothing();
    }
    
    // Daily activity summary
    const oldActivity = await oldDb.select().from(dailyActivitySummary);
    if (oldActivity.length > 0) {
      await newDb.insert(dailyActivitySummary).values(oldActivity).onConflictDoNothing();
    }
    
    console.log("  ✓ All remaining data migrated");
    
  } catch (error) {
    console.error("❌ Migration error:", error);
    stats.errors.push(`Fatal error: ${error}`);
  } finally {
    await oldConnection.end();
    await newConnection.end();
  }
  
  return stats;
}

// Main execution
async function main() {
  const oldDbUrl = process.env.OLD_DATABASE_URL || process.env.DATABASE_URL;
  const newDbUrl = process.env.NEW_DATABASE_URL;
  
  if (!oldDbUrl || !newDbUrl) {
    console.error("❌ Missing required environment variables:");
    console.error("  OLD_DATABASE_URL or DATABASE_URL: Source database");
    console.error("  NEW_DATABASE_URL: Target database");
    process.exit(1);
  }
  
  console.log("🔧 Migration Configuration:");
  console.log(`  Source DB: ${oldDbUrl.substring(0, 30)}...`);
  console.log(`  Target DB: ${newDbUrl.substring(0, 30)}...`);
  console.log("");
  
  const stats = await migrateToSharedQuestionSets(oldDbUrl, newDbUrl);
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Courses processed: ${stats.coursesProcessed}`);
  console.log(`Question sets (original): ${stats.questionSetsOriginal}`);
  console.log(`Question sets (deduplicated): ${stats.questionSetsDeduplicated}`);
  console.log(`Questions processed: ${stats.questionsProcessed}`);
  console.log(`Question versions processed: ${stats.questionVersionsProcessed}`);
  console.log(`Junction mappings created: ${stats.mappingsCreated}`);
  console.log(`Test runs updated: ${stats.testRunsUpdated}`);
  
  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Save detailed report
  const fs = await import("fs/promises");
  const reportPath = path.join(process.cwd(), "migration-report.json");
  await fs.writeFile(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

main().catch(console.error);