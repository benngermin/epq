#!/usr/bin/env tsx
/**
 * Script to analyze duplicate question sets between AI and Non-AI course pairs
 * This identifies courses with the same base course number and finds duplicate question sets
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { courses, questionSets, questions, questionVersions } from "../../shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface CourseGroup {
  baseCourseNumber: string;
  aiCourse?: typeof courses.$inferSelect;
  nonAiCourse?: typeof courses.$inferSelect;
  duplicateQuestionSets: Array<{
    aiQuestionSet: typeof questionSets.$inferSelect;
    nonAiQuestionSet: typeof questionSets.$inferSelect;
    questionCount: number;
    isIdentical: boolean;
  }>;
}

async function analyzeDatabase(databaseUrl: string) {
  const connection = postgres(databaseUrl);
  const db = drizzle(connection);
  
  console.log("🔍 Analyzing database for duplicate question sets...\n");
  
  try {
    // Step 1: Get all courses
    const allCourses = await db.select().from(courses);
    console.log(`Found ${allCourses.length} total courses`);
    
    // Step 2: Group courses by base course number
    const courseGroups = new Map<string, CourseGroup>();
    
    for (const course of allCourses) {
      // Extract base course number by removing "AI" or "Non-AI" suffix
      let baseCourseNumber = course.courseNumber;
      
      // Remove AI/Non-AI suffixes
      baseCourseNumber = baseCourseNumber
        .replace(/\s*\(AI\)\s*$/i, "")
        .replace(/\s*\(Non-AI\)\s*$/i, "")
        .replace(/\s*AI\s*$/i, "")
        .replace(/\s*Non-AI\s*$/i, "")
        .trim();
      
      if (!courseGroups.has(baseCourseNumber)) {
        courseGroups.set(baseCourseNumber, {
          baseCourseNumber,
          duplicateQuestionSets: []
        });
      }
      
      const group = courseGroups.get(baseCourseNumber)!;
      
      if (course.isAi) {
        group.aiCourse = course;
      } else {
        group.nonAiCourse = course;
      }
    }
    
    // Step 3: For each course group with both AI and Non-AI versions, find duplicate question sets
    let totalDuplicates = 0;
    let totalIdentical = 0;
    
    for (const [baseCourseNumber, group] of courseGroups) {
      if (!group.aiCourse || !group.nonAiCourse) {
        continue; // Skip if we don't have both versions
      }
      
      console.log(`\n📚 Analyzing course pair: ${baseCourseNumber}`);
      console.log(`  AI Course: ${group.aiCourse.courseTitle} (ID: ${group.aiCourse.id})`);
      console.log(`  Non-AI Course: ${group.nonAiCourse.courseTitle} (ID: ${group.nonAiCourse.id})`);
      
      // Get question sets for both courses
      const aiQuestionSets = await db.select()
        .from(questionSets)
        .where(eq(questionSets.courseId, group.aiCourse.id));
      
      const nonAiQuestionSets = await db.select()
        .from(questionSets)
        .where(eq(questionSets.courseId, group.nonAiCourse.id));
      
      console.log(`  AI Question Sets: ${aiQuestionSets.length}`);
      console.log(`  Non-AI Question Sets: ${nonAiQuestionSets.length}`);
      
      // Compare question sets by title to find duplicates
      for (const aiQS of aiQuestionSets) {
        const matchingNonAiQS = nonAiQuestionSets.find(
          qs => qs.title === aiQS.title || 
               (qs.externalId && qs.externalId === aiQS.externalId)
        );
        
        if (matchingNonAiQS) {
          // Compare question content to verify they're truly identical
          const aiQuestions = await db.select({
            question: questions,
            versions: sql<any>`array_agg(json_build_object(
              'version_number', ${questionVersions.versionNumber},
              'topic_focus', ${questionVersions.topicFocus},
              'question_text', ${questionVersions.questionText},
              'question_type', ${questionVersions.questionType},
              'correct_answer', ${questionVersions.correctAnswer}
            ) ORDER BY ${questionVersions.versionNumber})`
          })
            .from(questions)
            .leftJoin(questionVersions, eq(questions.id, questionVersions.questionId))
            .where(eq(questions.questionSetId, aiQS.id))
            .groupBy(questions.id);
          
          const nonAiQuestions = await db.select({
            question: questions,
            versions: sql<any>`array_agg(json_build_object(
              'version_number', ${questionVersions.versionNumber},
              'topic_focus', ${questionVersions.topicFocus},
              'question_text', ${questionVersions.questionText},
              'question_type', ${questionVersions.questionType},
              'correct_answer', ${questionVersions.correctAnswer}
            ) ORDER BY ${questionVersions.versionNumber})`
          })
            .from(questions)
            .leftJoin(questionVersions, eq(questions.id, questionVersions.questionId))
            .where(eq(questions.questionSetId, matchingNonAiQS.id))
            .groupBy(questions.id);
          
          // Simple content comparison (could be more sophisticated)
          const isIdentical = JSON.stringify(aiQuestions) === JSON.stringify(nonAiQuestions);
          
          group.duplicateQuestionSets.push({
            aiQuestionSet: aiQS,
            nonAiQuestionSet: matchingNonAiQS,
            questionCount: aiQuestions.length,
            isIdentical
          });
          
          totalDuplicates++;
          if (isIdentical) totalIdentical++;
          
          console.log(`  ✓ Found duplicate: "${aiQS.title}"`);
          console.log(`    - AI QS ID: ${aiQS.id}, Non-AI QS ID: ${matchingNonAiQS.id}`);
          console.log(`    - Questions: ${aiQuestions.length}`);
          console.log(`    - Content identical: ${isIdentical ? "✅ Yes" : "⚠️  No"}`);
        }
      }
    }
    
    // Step 4: Generate summary report
    console.log("\n" + "=".repeat(60));
    console.log("📊 ANALYSIS SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total courses analyzed: ${allCourses.length}`);
    console.log(`Course pairs (AI + Non-AI): ${Array.from(courseGroups.values()).filter(g => g.aiCourse && g.nonAiCourse).length}`);
    console.log(`Total duplicate question sets found: ${totalDuplicates}`);
    console.log(`Identical content duplicates: ${totalIdentical}`);
    console.log(`Non-identical duplicates (need review): ${totalDuplicates - totalIdentical}`);
    
    // Calculate potential space savings
    let totalQuestionSetsBeforeDedupe = await db.select({ count: sql<number>`count(*)` })
      .from(questionSets);
    console.log(`\n💾 Deduplication Impact:`);
    console.log(`  Current question sets: ${totalQuestionSetsBeforeDedupe[0].count}`);
    console.log(`  After deduplication: ${totalQuestionSetsBeforeDedupe[0].count - totalDuplicates}`);
    console.log(`  Reduction: ${totalDuplicates} (${((totalDuplicates / Number(totalQuestionSetsBeforeDedupe[0].count)) * 100).toFixed(1)}%)`);
    
    // Step 5: Generate detailed CSV report
    const csvLines = ["Base Course Number,AI Course,Non-AI Course,Duplicate Question Sets,Identical Content"];
    
    for (const [baseCourseNumber, group] of courseGroups) {
      if (group.aiCourse && group.nonAiCourse && group.duplicateQuestionSets.length > 0) {
        const identicalCount = group.duplicateQuestionSets.filter(d => d.isIdentical).length;
        csvLines.push(`"${baseCourseNumber}","${group.aiCourse.courseTitle}","${group.nonAiCourse.courseTitle}",${group.duplicateQuestionSets.length},${identicalCount}`);
      }
    }
    
    // Save report to file
    const reportPath = path.join(process.cwd(), "duplicate-analysis-report.csv");
    const fs = await import("fs/promises");
    await fs.writeFile(reportPath, csvLines.join("\n"));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
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
  
  await analyzeDatabase(databaseUrl);
}

main().catch(console.error);