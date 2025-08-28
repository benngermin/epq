import fs from "fs";
import path from "path";

// Parse the CSV data
function parseCSV() {
  const csvPath = path.join(process.cwd(), "attached_assets", "calculation_questions_tagged_v3_1756417268670.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  
  // Split by lines and skip header
  const lines = csvContent.split("\n").slice(1);
  const questions: any[] = [];
  
  // Process each line
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Extract the first few fields using a simple approach
    // Since the question text contains newlines and commas, we'll parse carefully
    const parts = line.split(",");
    if (parts.length >= 4) {
      const id = parseInt(parts[0]);
      const questionId = parseInt(parts[1]);
      const versionNumber = parseInt(parts[2]);
      const topicFocus = parts[3].replace(/"/g, "");
      
      if (!isNaN(questionId)) {
        questions.push({
          id,
          questionId,
          versionNumber,
          topicFocus
        });
      }
    }
  }
  
  return questions;
}

// Database results from our SQL query
const dbResults = [
  { question_id: 29204, loid: "11451", question_set_title: "Question Set 1", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29221, loid: "11457", question_set_title: "Question Set 1", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29272, loid: "11451", question_set_title: "Question Set 2", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29274, loid: "11451", question_set_title: "Question Set 2", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29289, loid: "11457", question_set_title: "Question Set 2", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29290, loid: "11457", question_set_title: "Question Set 2", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29343, loid: "11452", question_set_title: "Question Set 3", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 29358, loid: "11457", question_set_title: "Question Set 3", course_number: "CPCU 540", course_title: "Contributing to Insurer Financial Performance" },
  { question_id: 30214, loid: "03464", question_set_title: "Question Set 1", course_number: "CPCU 555", course_title: "Advancing Personal Insurance Products" },
  { question_id: 30415, loid: "02533", question_set_title: "Question Set 2", course_number: "AIC 330", course_title: "Leading a Successful Claims Team" }
];

// Create a lookup map for database results
const dbMap = new Map();
for (const result of dbResults) {
  dbMap.set(result.question_id, result);
}

// Parse CSV and generate report
const csvQuestions = parseCSV();

console.log("=" .repeat(120));
console.log("QUESTION METADATA REPORT");
console.log("Course Number, LOID, and Question Set Information");
console.log("=" .repeat(120));
console.log();

// Prepare output data
const outputData: any[] = [];

for (const csvItem of csvQuestions) {
  const dbData = dbMap.get(csvItem.questionId);
  
  const row = {
    csv_id: csvItem.id,
    question_id: csvItem.questionId,
    version_number: csvItem.versionNumber,
    topic_focus: csvItem.topicFocus,
    course_number: dbData?.course_number || "NOT_FOUND",
    course_title: dbData?.course_title || "NOT_FOUND",
    loid: dbData?.loid || "NOT_FOUND",
    question_set: dbData?.question_set_title || "NOT_FOUND"
  };
  
  outputData.push(row);
  
  // Print to console
  console.log(`CSV Row ID: ${row.csv_id}`);
  console.log(`Question ID: ${row.question_id} (Version ${row.version_number})`);
  console.log(`Topic Focus: ${row.topic_focus}`);
  console.log(`Course Number: ${row.course_number}`);
  console.log(`Course Title: ${row.course_title}`);
  console.log(`LOID: ${row.loid}`);
  console.log(`Question Set: ${row.question_set}`);
  console.log("-".repeat(80));
}

// Write to CSV file
const outputPath = path.join(process.cwd(), "question_metadata_results.csv");
const headers = "csv_id,question_id,version_number,topic_focus,course_number,course_title,loid,question_set";
const csvRows = outputData.map(row => 
  `${row.csv_id},${row.question_id},${row.version_number},"${row.topic_focus}","${row.course_number}","${row.course_title}","${row.loid}","${row.question_set}"`
);

fs.writeFileSync(outputPath, [headers, ...csvRows].join("\n"));

console.log("\n" + "=".repeat(120));
console.log(`✅ Results saved to: ${outputPath}`);
console.log("=".repeat(120));

// Summary
const foundCount = outputData.filter(d => d.course_number !== "NOT_FOUND").length;
const notFoundCount = outputData.filter(d => d.course_number === "NOT_FOUND").length;

console.log("\nSUMMARY:");
console.log(`  Total questions in CSV: ${csvQuestions.length}`);
console.log(`  Found in database: ${foundCount}`);
console.log(`  Not found in database: ${notFoundCount}`);

// Group by course
const byCourse = new Map();
for (const item of outputData) {
  if (item.course_number !== "NOT_FOUND") {
    const key = `${item.course_number} - ${item.course_title}`;
    if (!byCourse.has(key)) {
      byCourse.set(key, []);
    }
    byCourse.get(key).push(item);
  }
}

console.log("\nQUESTIONS BY COURSE:");
for (const [course, items] of byCourse) {
  console.log(`  ${course}: ${items.length} questions`);
  const loids = new Set(items.map((i: any) => i.loid));
  console.log(`    LOIDs: ${Array.from(loids).join(", ")}`);
  const sets = new Set(items.map((i: any) => i.question_set));
  console.log(`    Question Sets: ${Array.from(sets).join(", ")}`);
}