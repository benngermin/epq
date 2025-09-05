#!/usr/bin/env tsx
/**
 * Fix JSON type casting issues in migration
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function fixJsonMigration() {
  const oldConnection = postgres(process.env.OLD_DATABASE_URL!);
  const oldDb = drizzle(oldConnection);
  
  const newConnection = postgres(process.env.NEW_DATABASE_URL!);
  const newDb = drizzle(newConnection);
  
  try {
    console.log("🔧 Fixing JSON migration for question versions...");
    
    // Get all question sets that need their questions/versions migrated
    const questionSets = await newDb.execute(sql`SELECT id, external_id FROM question_sets`);
    
    for (const qs of questionSets) {
      console.log(`\n📤 Processing question set ID ${qs.id}...`);
      
      // Find matching old question set
      const oldQS = await oldDb.execute(sql`
        SELECT id FROM question_sets 
        WHERE external_id = ${qs.external_id} OR title = (
          SELECT title FROM question_sets WHERE id = ${qs.id}
        )
        LIMIT 1
      `);
      
      if (oldQS.length === 0) continue;
      
      const oldQuestionSetId = oldQS[0].id;
      
      // Get all questions from old question set
      const oldQuestions = await oldDb.execute(sql`
        SELECT id, original_question_number, loid
        FROM questions 
        WHERE question_set_id = ${oldQuestionSetId}
      `);
      
      for (const oldQuestion of oldQuestions) {
        // Insert question
        const [newQuestion] = await newDb.execute(sql`
          INSERT INTO questions (question_set_id, original_question_number, loid)
          VALUES (${qs.id}, ${oldQuestion.original_question_number}, ${oldQuestion.loid})
          ON CONFLICT DO NOTHING
          RETURNING id
        `);
        
        if (!newQuestion) continue;
        
        // Get question versions with proper JSON handling
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
              ${oldVersion.answer_choices_text}::json,
              ${oldVersion.correct_answer},
              ${oldVersion.acceptable_answers_text}::json,
              ${oldVersion.case_sensitive},
              ${oldVersion.allow_multiple},
              ${oldVersion.matching_pairs_text}::json,
              ${oldVersion.correct_order_text}::json,
              ${oldVersion.blanks_text}::json,
              ${oldVersion.drop_zones_text}::json
            )
            ON CONFLICT DO NOTHING
          `);
        }
      }
      
      console.log(`  ✓ Processed ${oldQuestions.length} questions`);
    }
    
    console.log("\n✅ JSON migration fix completed!");
    
  } finally {
    await oldConnection.end();
    await newConnection.end();
  }
}

fixJsonMigration().catch(console.error);