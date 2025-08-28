import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq, inArray, and } from "drizzle-orm";
import * as schema from "../shared/schema";
import fs from "fs";
import path from "path";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function findQuestionMetadata() {
  try {
    // Read the CSV file
    const csvPath = path.join(process.cwd(), "attached_assets", "calculation_questions_tagged_v3_1756417268670.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n").slice(1); // Skip header
    
    const questionIds: number[] = [];
    const csvData: any[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Parse CSV line (handle commas in quoted strings)
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (matches && matches.length >= 3) {
        const id = parseInt(matches[0].replace(/"/g, ""));
        const questionId = parseInt(matches[1].replace(/"/g, ""));
        const versionNumber = parseInt(matches[2].replace(/"/g, ""));
        const topicFocus = matches[3]?.replace(/"/g, "") || "";
        
        questionIds.push(questionId);
        csvData.push({
          id,
          questionId,
          versionNumber,
          topicFocus
        });
      }
    }
    
    console.log(`Found ${questionIds.length} questions in CSV`);
    console.log("Question IDs:", questionIds);
    
    // Query the database for question information
    const results = await db
      .select({
        questionId: schema.questions.id,
        loid: schema.questions.loid,
        questionSetId: schema.questions.questionSetId,
        questionSetTitle: schema.questionSets.title,
        courseId: schema.courses.id,
        courseNumber: schema.courses.courseNumber,
        courseTitle: schema.courses.courseTitle,
        versionId: schema.questionVersions.id,
        versionNumber: schema.questionVersions.versionNumber,
        topicFocus: schema.questionVersions.topicFocus,
      })
      .from(schema.questions)
      .leftJoin(schema.questionSets, eq(schema.questions.questionSetId, schema.questionSets.id))
      .leftJoin(schema.courses, eq(schema.questionSets.courseId, schema.courses.id))
      .leftJoin(schema.questionVersions, eq(schema.questionVersions.questionId, schema.questions.id))
      .where(inArray(schema.questions.id, questionIds));
    
    console.log(`\nFound ${results.length} results in database\n`);
    
    // Create a map for easier lookup
    const questionMap = new Map();
    for (const result of results) {
      const key = `${result.questionId}-${result.versionNumber}`;
      questionMap.set(key, result);
    }
    
    // Generate report
    console.log("=".repeat(120));
    console.log("QUESTION METADATA REPORT");
    console.log("=".repeat(120));
    console.log();
    
    // Create output array for CSV export
    const outputData: any[] = [];
    
    for (const csvItem of csvData) {
      const key = `${csvItem.questionId}-${csvItem.versionNumber}`;
      const dbData = questionMap.get(key);
      
      console.log(`Question ID: ${csvItem.questionId} (Version ${csvItem.versionNumber})`);
      console.log(`Topic Focus: ${csvItem.topicFocus}`);
      
      if (dbData) {
        console.log(`  Course Number: ${dbData.courseNumber || "NOT FOUND"}`);
        console.log(`  Course Title: ${dbData.courseTitle || "NOT FOUND"}`);
        console.log(`  LOID: ${dbData.loid || "NOT FOUND"}`);
        console.log(`  Question Set: ${dbData.questionSetTitle || "NOT FOUND"}`);
        
        outputData.push({
          question_id: csvItem.questionId,
          version_number: csvItem.versionNumber,
          topic_focus: csvItem.topicFocus,
          course_number: dbData.courseNumber || "",
          course_title: dbData.courseTitle || "",
          loid: dbData.loid || "",
          question_set: dbData.questionSetTitle || ""
        });
      } else {
        console.log(`  ⚠️  NOT FOUND IN DATABASE`);
        
        outputData.push({
          question_id: csvItem.questionId,
          version_number: csvItem.versionNumber,
          topic_focus: csvItem.topicFocus,
          course_number: "NOT_FOUND",
          course_title: "NOT_FOUND",
          loid: "NOT_FOUND",
          question_set: "NOT_FOUND"
        });
      }
      console.log("-".repeat(80));
    }
    
    // Write results to a new CSV file
    const outputPath = path.join(process.cwd(), "question_metadata_results.csv");
    const headers = "question_id,version_number,topic_focus,course_number,course_title,loid,question_set";
    const csvRows = outputData.map(row => 
      `${row.question_id},${row.version_number},"${row.topic_focus}","${row.course_number}","${row.course_title}","${row.loid}","${row.question_set}"`
    );
    
    fs.writeFileSync(outputPath, [headers, ...csvRows].join("\n"));
    
    console.log("\n" + "=".repeat(120));
    console.log(`Results saved to: ${outputPath}`);
    console.log("=".repeat(120));
    
    // Summary statistics
    const foundCount = outputData.filter(d => d.course_number !== "NOT_FOUND").length;
    const notFoundCount = outputData.filter(d => d.course_number === "NOT_FOUND").length;
    
    console.log("\nSUMMARY:");
    console.log(`  Total questions in CSV: ${csvData.length}`);
    console.log(`  Found in database: ${foundCount}`);
    console.log(`  Not found in database: ${notFoundCount}`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

findQuestionMetadata();