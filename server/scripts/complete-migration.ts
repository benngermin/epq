#!/usr/bin/env tsx
/**
 * Complete migration script - handles all question sets and creates proper junction mappings
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function completeMigration() {
  const oldConnection = postgres(process.env.OLD_DATABASE_URL!);
  const oldDb = drizzle(oldConnection);
  
  const newConnection = postgres(process.env.NEW_DATABASE_URL!);
  const newDb = drizzle(newConnection);
  
  try {
    console.log("🚀 Starting complete migration...\n");
    
    // Clear existing question sets and start over
    console.log("🧹 Clearing existing question sets...");
    await newDb.execute(sql`DELETE FROM course_question_sets`);
    await newDb.execute(sql`DELETE FROM question_versions`);
    await newDb.execute(sql`DELETE FROM questions`);
    await newDb.execute(sql`DELETE FROM question_sets`);
    
    // Get all question sets from old database, grouped by deduplication key
    const oldQuestionSets = await oldDb.execute(sql`
      SELECT qs.id, qs.course_id, qs.title, qs.description, qs.question_count, 
             qs.external_id, qs.is_ai, c.course_number, c.is_ai as course_is_ai
      FROM question_sets qs
      JOIN courses c ON qs.course_id = c.id
      ORDER BY qs.title, qs.external_id, c.course_number
    `);
    
    console.log(`📤 Processing ${oldQuestionSets.length} question sets...`);
    
    // Track processed question sets by deduplication key
    const processedQS = new Map<string, number>(); // dedupeKey -> newQuestionSetId
    const questionSetMapping = new Map<number, number>(); // oldId -> newId
    
    let processedCount = 0;
    
    for (const oldQS of oldQuestionSets) {
      // Create deduplication key
      const dedupeKey = `${oldQS.title}|${oldQS.external_id || 'NULL'}`;
      
      let newQuestionSetId: number;
      
      if (processedQS.has(dedupeKey)) {
        // Use existing deduplicated question set
        newQuestionSetId = processedQS.get(dedupeKey)!;
        console.log(`  🔄 Reusing "${oldQS.title}" for course ${oldQS.course_number}`);
      } else {
        // Create new question set
        const [newQS] = await newDb.execute(sql`
          INSERT INTO question_sets (title, description, question_count, external_id)
          VALUES (${oldQS.title}, ${oldQS.description}, ${oldQS.question_count}, ${oldQS.external_id})
          RETURNING id
        `);
        
        newQuestionSetId = newQS.id;
        processedQS.set(dedupeKey, newQuestionSetId);
        
        console.log(`  ✓ Created "${oldQS.title}" (ID: ${newQuestionSetId})`);
        
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
          
          // Migrate question versions with proper JSON casting
          const oldVersions = await oldDb.execute(sql`
            SELECT version_number, topic_focus, question_text, question_type,
                   answer_choices::text as answer_choices_text,
                   correct_answer,
                   acceptable_answers::text as acceptable_answers_text,
                   case_sensitive, allow_multiple,
                   matching_pairs::text as matching_pairs_text,
                   correct_order::text as correct_order_text,
                   blanks::text as blanks_text,
                   drop_zones::text as drop_zones_text
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
                ${newQuestion.id}, 
                ${oldVersion.version_number}, 
                ${oldVersion.topic_focus},
                ${oldVersion.question_text}, 
                ${oldVersion.question_type},
                ${oldVersion.answer_choices_text ? sql`${oldVersion.answer_choices_text}::json` : null},
                ${oldVersion.correct_answer},
                ${oldVersion.acceptable_answers_text ? sql`${oldVersion.acceptable_answers_text}::json` : null},
                ${oldVersion.case_sensitive},
                ${oldVersion.allow_multiple},
                ${oldVersion.matching_pairs_text ? sql`${oldVersion.matching_pairs_text}::json` : null},
                ${oldVersion.correct_order_text ? sql`${oldVersion.correct_order_text}::json` : null},
                ${oldVersion.blanks_text ? sql`${oldVersion.blanks_text}::json` : null},
                ${oldVersion.drop_zones_text ? sql`${oldVersion.drop_zones_text}::json` : null}
              )
            `);
          }
        }
        
        processedCount++;
      }
      
      // Map old question set ID to new
      questionSetMapping.set(oldQS.id, newQuestionSetId);
      
      // Create junction table mapping
      await newDb.execute(sql`
        INSERT INTO course_question_sets (course_id, question_set_id, display_order, created_at)
        VALUES (${oldQS.course_id}, ${newQuestionSetId}, 0, NOW())
        ON CONFLICT (course_id, question_set_id) DO NOTHING
      `);
    }
    
    console.log(`\n✓ Created ${processedCount} unique question sets from ${oldQuestionSets.length} originals`);
    
    // Migrate test runs with updated question set IDs
    console.log("\n📤 Migrating user test runs...");
    const oldTestRuns = await oldDb.execute(sql`
      SELECT id, user_id, question_set_id, started_at, completed_at, question_order
      FROM user_test_runs
    `);
    
    let testRunsUpdated = 0;
    for (const testRun of oldTestRuns) {
      const newQuestionSetId = questionSetMapping.get(testRun.question_set_id);
      if (newQuestionSetId) {
        await newDb.execute(sql`
          INSERT INTO user_test_runs (id, user_id, question_set_id, started_at, completed_at, question_order)
          VALUES (${testRun.id}, ${testRun.user_id}, ${newQuestionSetId}, ${testRun.started_at}, ${testRun.completed_at}, ${testRun.question_order})
          ON CONFLICT (id) DO NOTHING
        `);
        testRunsUpdated++;
      }
    }
    console.log(`  ✓ Migrated ${testRunsUpdated} test runs`);
    
    // Migrate user answers
    console.log("\n📤 Migrating user answers...");
    const oldAnswers = await oldDb.execute(sql`
      SELECT id, user_test_run_id, question_version_id, chosen_answer, is_correct, answered_at
      FROM user_answers
    `);
    
    let userAnswersUpdated = 0;
    for (const answer of oldAnswers) {
      await newDb.execute(sql`
        INSERT INTO user_answers (id, user_test_run_id, question_version_id, chosen_answer, is_correct, answered_at)
        VALUES (${answer.id}, ${answer.user_test_run_id}, ${answer.question_version_id}, ${answer.chosen_answer}, ${answer.is_correct}, ${answer.answered_at})
        ON CONFLICT (id) DO NOTHING
      `);
      userAnswersUpdated++;
    }
    console.log(`  ✓ Migrated ${userAnswersUpdated} user answers`);
    
    // Final status check
    const finalStats = await Promise.all([
      newDb.execute(sql`SELECT COUNT(*) as count FROM users`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM courses`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM question_sets`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM questions`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM question_versions`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM course_question_sets`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM user_test_runs`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM user_answers`)
    ]);
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 FINAL MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Users: ${finalStats[0][0].count}`);
    console.log(`Courses: ${finalStats[1][0].count}`);
    console.log(`Question Sets: ${finalStats[2][0].count} (reduced from 82)`);
    console.log(`Questions: ${finalStats[3][0].count}`);
    console.log(`Question Versions: ${finalStats[4][0].count}`);
    console.log(`Course-QuestionSet Mappings: ${finalStats[5][0].count}`);
    console.log(`Test Runs: ${finalStats[6][0].count}`);
    console.log(`User Answers: ${finalStats[7][0].count}`);
    
    const reduction = 82 - Number(finalStats[2][0].count);
    const reductionPercent = ((reduction / 82) * 100).toFixed(1);
    console.log(`\n🎉 SUCCESS! Eliminated ${reduction} duplicate question sets (${reductionPercent}% reduction)`);
    
  } finally {
    await oldConnection.end();
    await newConnection.end();
  }
}

completeMigration().catch(console.error);