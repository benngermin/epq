#!/usr/bin/env tsx
/**
 * Simplified migration without ON CONFLICT constraints
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function simpleMigration() {
  const oldConnection = postgres(process.env.OLD_DATABASE_URL!);
  const oldDb = drizzle(oldConnection);
  
  const newConnection = postgres(process.env.NEW_DATABASE_URL!);
  const newDb = drizzle(newConnection);
  
  try {
    console.log("🚀 Starting simplified migration...\n");
    
    // Clear existing question-related data
    console.log("🧹 Clearing existing question data...");
    await newDb.execute(sql`TRUNCATE course_question_sets CASCADE`);
    await newDb.execute(sql`TRUNCATE question_sets CASCADE`);
    
    // Get all question sets from old database
    const oldQuestionSets = await oldDb.execute(sql`
      SELECT qs.id, qs.course_id, qs.title, qs.description, qs.question_count, 
             qs.external_id, qs.is_ai, c.course_number
      FROM question_sets qs
      JOIN courses c ON qs.course_id = c.id
      ORDER BY qs.title, qs.external_id
    `);
    
    console.log(`📤 Processing ${oldQuestionSets.length} question sets...`);
    
    // Track deduplicated question sets
    const processedQS = new Map<string, number>();
    const questionSetMapping = new Map<number, number>();
    let createdCount = 0;
    
    for (const oldQS of oldQuestionSets) {
      const dedupeKey = `${oldQS.title}|${oldQS.external_id || 'NULL'}`;
      
      let newQuestionSetId: number;
      
      if (processedQS.has(dedupeKey)) {
        newQuestionSetId = processedQS.get(dedupeKey)!;
        console.log(`  🔄 Reusing "${oldQS.title}"`);
      } else {
        // Create new question set
        const [newQS] = await newDb.execute(sql`
          INSERT INTO question_sets (title, description, question_count, external_id)
          VALUES (${oldQS.title}, ${oldQS.description}, ${oldQS.question_count}, ${oldQS.external_id})
          RETURNING id
        `);
        
        newQuestionSetId = newQS.id;
        processedQS.set(dedupeKey, newQuestionSetId);
        createdCount++;
        
        console.log(`  ✓ Created "${oldQS.title}" (${createdCount}/${processedQS.size})`);
        
        // Migrate questions for this question set
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
          
          // Migrate question versions
          const oldVersions = await oldDb.execute(sql`
            SELECT version_number, topic_focus, question_text, question_type,
                   answer_choices, correct_answer, acceptable_answers, case_sensitive, 
                   allow_multiple, matching_pairs, correct_order, blanks, drop_zones
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
          }
        }
      }
      
      // Track mapping
      questionSetMapping.set(oldQS.id, newQuestionSetId);
      
      // Create junction table entry
      await newDb.execute(sql`
        INSERT INTO course_question_sets (course_id, question_set_id, display_order, created_at)
        VALUES (${oldQS.course_id}, ${newQuestionSetId}, 0, NOW())
      `);
    }
    
    console.log(`\n✅ Created ${createdCount} deduplicated question sets from ${oldQuestionSets.length} originals`);
    
    // Quick final check
    const counts = await Promise.all([
      newDb.execute(sql`SELECT COUNT(*) as count FROM question_sets`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM questions`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM question_versions`),
      newDb.execute(sql`SELECT COUNT(*) as count FROM course_question_sets`)
    ]);
    
    console.log("\n📊 MIGRATION RESULTS:");
    console.log(`Question Sets: ${counts[0][0].count} (reduced from 82)`);
    console.log(`Questions: ${counts[1][0].count}`);
    console.log(`Question Versions: ${counts[2][0].count}`);
    console.log(`Course-QuestionSet Mappings: ${counts[3][0].count}`);
    
    const reduction = 82 - Number(counts[0][0].count);
    console.log(`\n🎉 SUCCESS! Eliminated ${reduction} duplicates (${((reduction/82)*100).toFixed(1)}% reduction)`);
    
  } finally {
    await oldConnection.end();
    await newConnection.end();
  }
}

simpleMigration().catch(console.error);