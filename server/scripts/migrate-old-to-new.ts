#!/usr/bin/env tsx
/**
 * Migration script from OLD schema to NEW schema
 * Migrates from duplicate question sets to shared question sets using junction table
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
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
  userAnswersUpdated: number;
  errors: string[];
}

async function migrateFromOldToNew(
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
    userAnswersUpdated: 0,
    errors: []
  };
  
  console.log("🚀 Starting migration from old to new database...\n");
  
  try {
    // Step 1: Migrate users
    console.log("📤 Migrating users...");
    const oldUsers = await oldDb.execute(sql`
      SELECT id, name, email, password, cognito_sub, is_admin, created_at 
      FROM users
    `);
    
    for (const user of oldUsers) {
      await newDb.execute(sql`
        INSERT INTO users (id, name, email, password, cognito_sub, is_admin, created_at)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password}, ${user.cognito_sub}, ${user.is_admin}, ${user.created_at})
        ON CONFLICT (id) DO NOTHING
      `);
    }
    console.log(`  ✓ Migrated ${oldUsers.length} users`);
    
    // Step 2: Migrate courses and calculate baseCourseNumber
    console.log("\n📤 Migrating courses...");
    const oldCourses = await oldDb.execute(sql`
      SELECT id, course_number, course_title, external_id, bubble_unique_id, is_ai 
      FROM courses
    `);
    
    for (const course of oldCourses) {
      // Calculate base course number by removing AI/Non-AI suffixes
      const baseCourseNumber = course.course_number
        .replace(/\s*\(AI\)\s*$/i, "")
        .replace(/\s*\(Non-AI\)\s*$/i, "")
        .replace(/\s*AI\s*$/i, "")
        .replace(/\s*Non-AI\s*$/i, "")
        .trim();
      
      await newDb.execute(sql`
        INSERT INTO courses (id, course_number, course_title, external_id, bubble_unique_id, is_ai, base_course_number)
        VALUES (${course.id}, ${course.course_number}, ${course.course_title}, ${course.external_id}, ${course.bubble_unique_id}, ${course.is_ai}, ${baseCourseNumber})
        ON CONFLICT (id) DO NOTHING
      `);
      stats.coursesProcessed++;
    }
    console.log(`  ✓ Migrated ${stats.coursesProcessed} courses`);
    
    // Step 3: Migrate and deduplicate question sets
    console.log("\n📤 Deduplicating and migrating question sets...");
    
    const oldQuestionSets = await oldDb.execute(sql`
      SELECT qs.id, qs.course_id, qs.title, qs.description, qs.question_count, qs.external_id, qs.is_ai,
             c.course_number, c.is_ai as course_is_ai
      FROM question_sets qs
      JOIN courses c ON qs.course_id = c.id
      ORDER BY qs.title, c.course_number
    `);
    
    stats.questionSetsOriginal = oldQuestionSets.length;
    
    // Track which old question set IDs map to new question set IDs
    const questionSetMapping = new Map<number, number>();
    const processedQuestionSets = new Set<string>();
    
    // Group courses by base course number
    const coursesByBase = new Map<string, any[]>();
    for (const course of oldCourses) {
      const baseCourseNumber = course.course_number
        .replace(/\s*\(AI\)\s*$/i, "")
        .replace(/\s*\(Non-AI\)\s*$/i, "")
        .replace(/\s*AI\s*$/i, "")
        .replace(/\s*Non-AI\s*$/i, "")
        .trim();
      
      if (!coursesByBase.has(baseCourseNumber)) {
        coursesByBase.set(baseCourseNumber, []);
      }
      coursesByBase.get(baseCourseNumber)!.push(course);
    }
    
    // Process question sets, deduplicating by title and external_id
    for (const oldQS of oldQuestionSets) {
      const dedupeKey = `${oldQS.title}|${oldQS.external_id || ''}`;
      
      let newQuestionSetId: number;
      
      if (!processedQuestionSets.has(dedupeKey)) {
        // Create new question set (without courseId)
        const [newQS] = await newDb.execute(sql`
          INSERT INTO question_sets (title, description, question_count, external_id)
          VALUES (${oldQS.title}, ${oldQS.description}, ${oldQS.question_count}, ${oldQS.external_id})
          RETURNING id
        `);
        
        newQuestionSetId = newQS.id;
        processedQuestionSets.add(dedupeKey);
        stats.questionSetsDeduplicated++;
        
        console.log(`  ✓ Created deduplicated question set: "${oldQS.title}" (ID: ${newQuestionSetId})`);
        
        // Migrate questions and versions for this question set
        const oldQuestions = await oldDb.execute(sql`
          SELECT id, original_question_number, loid
          FROM questions
          WHERE question_set_id = ${oldQS.id}
        `);
        
        for (const oldQuestion of oldQuestions) {
          const [newQuestion] = await newDb.execute(sql`
            INSERT INTO questions (question_set_id, original_question_number, loid)
            VALUES (${newQuestionSetId}, ${oldQuestion.original_question_number}, ${oldQuestion.loid})
            RETURNING id
          `);
          
          stats.questionsProcessed++;
          
          // Migrate question versions
          const oldVersions = await oldDb.execute(sql`
            SELECT version_number, topic_focus, question_text, question_type, answer_choices, 
                   correct_answer, acceptable_answers, case_sensitive, allow_multiple, 
                   matching_pairs, correct_order, blanks, drop_zones
            FROM question_versions
            WHERE question_id = ${oldQuestion.id}
          `);
          
          for (const oldVersion of oldVersions) {
            await newDb.execute(sql`
              INSERT INTO question_versions (
                question_id, version_number, topic_focus, question_text, question_type,
                answer_choices, correct_answer, acceptable_answers, case_sensitive, 
                allow_multiple, matching_pairs, correct_order, blanks, drop_zones
              )
              VALUES (
                ${newQuestion.id}, ${oldVersion.version_number}, ${oldVersion.topic_focus},
                ${oldVersion.question_text}, ${oldVersion.question_type}, ${oldVersion.answer_choices},
                ${oldVersion.correct_answer}, ${oldVersion.acceptable_answers}, ${oldVersion.case_sensitive},
                ${oldVersion.allow_multiple}, ${oldVersion.matching_pairs}, ${oldVersion.correct_order},
                ${oldVersion.blanks}, ${oldVersion.drop_zones}
              )
            `);
            stats.questionVersionsProcessed++;
          }
        }
      } else {
        // Find the already created question set
        const existingQS = await newDb.execute(sql`
          SELECT id FROM question_sets 
          WHERE title = ${oldQS.title} 
          AND (external_id = ${oldQS.external_id} OR (external_id IS NULL AND ${oldQS.external_id} IS NULL))
          LIMIT 1
        `);
        
        if (existingQS.length === 0) {
          stats.errors.push(`Could not find deduplicated question set for ${oldQS.title}`);
          continue;
        }
        
        newQuestionSetId = existingQS[0].id;
      }
      
      // Map old question set ID to new question set ID
      questionSetMapping.set(oldQS.id, newQuestionSetId);
      
      // Create junction table mapping for this course
      await newDb.execute(sql`
        INSERT INTO course_question_sets (course_id, question_set_id, display_order)
        VALUES (${oldQS.course_id}, ${newQuestionSetId}, 0)
        ON CONFLICT (course_id, question_set_id) DO NOTHING
      `);
      stats.mappingsCreated++;
    }
    
    console.log(`  ✓ Original question sets: ${stats.questionSetsOriginal}`);
    console.log(`  ✓ Deduplicated question sets: ${stats.questionSetsDeduplicated}`);
    console.log(`  ✓ Questions processed: ${stats.questionsProcessed}`);
    console.log(`  ✓ Question versions processed: ${stats.questionVersionsProcessed}`);
    console.log(`  ✓ Junction mappings created: ${stats.mappingsCreated}`);
    
    // Step 4: Migrate user test runs
    console.log("\n📤 Migrating user test runs...");
    const oldTestRuns = await oldDb.execute(sql`
      SELECT id, user_id, question_set_id, started_at, completed_at, question_order
      FROM user_test_runs
    `);
    
    for (const testRun of oldTestRuns) {
      const newQuestionSetId = questionSetMapping.get(testRun.question_set_id);
      if (newQuestionSetId) {
        await newDb.execute(sql`
          INSERT INTO user_test_runs (id, user_id, question_set_id, started_at, completed_at, question_order)
          VALUES (${testRun.id}, ${testRun.user_id}, ${newQuestionSetId}, ${testRun.started_at}, ${testRun.completed_at}, ${testRun.question_order})
          ON CONFLICT (id) DO NOTHING
        `);
        stats.testRunsUpdated++;
      }
    }
    console.log(`  ✓ Migrated ${stats.testRunsUpdated} test runs`);
    
    // Step 5: Migrate user answers
    console.log("\n📤 Migrating user answers...");
    const oldAnswers = await oldDb.execute(sql`
      SELECT id, user_test_run_id, question_version_id, chosen_answer, is_correct, answered_at
      FROM user_answers
    `);
    
    for (const answer of oldAnswers) {
      await newDb.execute(sql`
        INSERT INTO user_answers (id, user_test_run_id, question_version_id, chosen_answer, is_correct, answered_at)
        VALUES (${answer.id}, ${answer.user_test_run_id}, ${answer.question_version_id}, ${answer.chosen_answer}, ${answer.is_correct}, ${answer.answered_at})
        ON CONFLICT (id) DO NOTHING
      `);
      stats.userAnswersUpdated++;
    }
    console.log(`  ✓ Migrated ${stats.userAnswersUpdated} user answers`);
    
    // Step 6: Migrate other tables
    console.log("\n📤 Migrating remaining data...");
    
    // User course progress
    const oldProgress = await oldDb.execute(sql`
      SELECT id, user_id, course_id, question_sets_completed, questions_answered, correct_answers, last_activity
      FROM user_course_progress
    `);
    
    for (const progress of oldProgress) {
      await newDb.execute(sql`
        INSERT INTO user_course_progress (id, user_id, course_id, question_sets_completed, questions_answered, correct_answers, last_activity)
        VALUES (${progress.id}, ${progress.user_id}, ${progress.course_id}, ${progress.question_sets_completed}, ${progress.questions_answered}, ${progress.correct_answers}, ${progress.last_activity})
        ON CONFLICT (id) DO NOTHING
      `);
    }
    
    // Other tables (chatbot logs, feedback, etc.)
    const tables = [
      'ai_settings', 'prompt_versions', 'course_materials', 
      'chatbot_logs', 'chatbot_feedback', 'daily_activity_summary',
      'course_external_mappings'
    ];
    
    for (const tableName of tables) {
      try {
        const rows = await oldDb.execute(sql.raw(`SELECT * FROM ${tableName}`));
        if (rows.length > 0) {
          // Get column names
          const columns = Object.keys(rows[0]);
          const columnList = columns.join(', ');
          const placeholders = columns.map(() => '?').join(', ');
          
          for (const row of rows) {
            const values = columns.map(col => row[col]);
            await newDb.execute(sql.raw(`
              INSERT INTO ${tableName} (${columnList})
              VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})
              ON CONFLICT DO NOTHING
            `, values));
          }
        }
      } catch (error) {
        console.log(`    Skipping ${tableName}: ${error}`);
      }
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
  const oldDbUrl = process.env.OLD_DATABASE_URL;
  const newDbUrl = process.env.NEW_DATABASE_URL;
  
  if (!oldDbUrl || !newDbUrl) {
    console.error("❌ Missing required environment variables:");
    console.error("  OLD_DATABASE_URL: Source database");
    console.error("  NEW_DATABASE_URL: Target database");
    process.exit(1);
  }
  
  console.log("🔧 Migration Configuration:");
  console.log(`  Source DB: ${oldDbUrl.substring(0, 30)}...`);
  console.log(`  Target DB: ${newDbUrl.substring(0, 30)}...`);
  console.log("");
  
  const stats = await migrateFromOldToNew(oldDbUrl, newDbUrl);
  
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
  console.log(`User answers migrated: ${stats.userAnswersUpdated}`);
  console.log(`Reduction achieved: ${stats.questionSetsOriginal - stats.questionSetsDeduplicated} question sets (${((stats.questionSetsOriginal - stats.questionSetsDeduplicated) / stats.questionSetsOriginal * 100).toFixed(1)}%)`);
  
  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Save detailed report
  const fs = await import("fs/promises");
  const reportPath = path.join(process.cwd(), "migration-report.json");
  await fs.writeFile(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  console.log("\n🎉 MIGRATION COMPLETED!");
}

main().catch(console.error);