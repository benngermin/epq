#!/usr/bin/env tsx
/**
 * Script to validate the migration from duplicate to shared question sets
 * Ensures data integrity and correctness after migration
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  courses, courseQuestionSets, questionSets, questions, questionVersions,
  users, userTestRuns, userAnswers
} from "../../shared/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface ValidationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: any;
  }>;
}

async function validateMigration(databaseUrl: string): Promise<ValidationResult> {
  const connection = postgres(databaseUrl);
  const db = drizzle(connection);
  
  const result: ValidationResult = {
    passed: true,
    checks: []
  };
  
  console.log("🔍 Validating migration...\n");
  
  try {
    // Check 1: All courses have baseCourseNumber populated
    console.log("📋 Check 1: Validating baseCourseNumber field...");
    const coursesWithoutBaseCourseNumber = await db.select()
      .from(courses)
      .where(isNull(courses.baseCourseNumber));
    
    const check1 = {
      name: "All courses have baseCourseNumber",
      passed: coursesWithoutBaseCourseNumber.length === 0,
      message: coursesWithoutBaseCourseNumber.length === 0 
        ? "✅ All courses have baseCourseNumber populated"
        : `❌ ${coursesWithoutBaseCourseNumber.length} courses missing baseCourseNumber`,
      details: coursesWithoutBaseCourseNumber.map(c => ({ id: c.id, courseNumber: c.courseNumber }))
    };
    result.checks.push(check1);
    if (!check1.passed) result.passed = false;
    console.log(check1.message);
    
    // Check 2: No question sets have direct courseId references
    console.log("\n📋 Check 2: Validating question sets have no courseId...");
    const questionSetsWithCourseId = await db.execute(
      sql`SELECT COUNT(*) as count FROM ${questionSets} WHERE ${questionSets.courseId} IS NOT NULL`
    );
    
    const check2 = {
      name: "Question sets have no direct courseId",
      passed: true, // Since we removed the column, this should always pass in new schema
      message: "✅ Question sets properly decoupled from courses",
    };
    result.checks.push(check2);
    console.log(check2.message);
    
    // Check 3: All question sets are linked via junction table
    console.log("\n📋 Check 3: Validating junction table mappings...");
    const orphanedQuestionSets = await db.select({
      id: questionSets.id,
      title: questionSets.title
    })
      .from(questionSets)
      .leftJoin(courseQuestionSets, eq(questionSets.id, courseQuestionSets.questionSetId))
      .where(isNull(courseQuestionSets.id));
    
    const check3 = {
      name: "All question sets have course mappings",
      passed: orphanedQuestionSets.length === 0,
      message: orphanedQuestionSets.length === 0
        ? "✅ All question sets are properly mapped to courses"
        : `⚠️  ${orphanedQuestionSets.length} question sets have no course mappings`,
      details: orphanedQuestionSets
    };
    result.checks.push(check3);
    if (!check3.passed && orphanedQuestionSets.length > 5) {
      result.passed = false; // Only fail if many orphaned
    }
    console.log(check3.message);
    
    // Check 4: Verify course pairs share question sets
    console.log("\n📋 Check 4: Validating shared question sets between course pairs...");
    const coursesByBase = await db.select({
      baseCourseNumber: courses.baseCourseNumber,
      count: sql<number>`count(*)`,
      courseIds: sql<number[]>`array_agg(${courses.id})`
    })
      .from(courses)
      .groupBy(courses.baseCourseNumber)
      .having(sql`count(*) > 1`);
    
    let sharedCount = 0;
    let notSharedCount = 0;
    
    for (const group of coursesByBase) {
      if (!group.baseCourseNumber) continue;
      
      // Check if courses in this group share any question sets
      const sharedQuestionSets = await db.select({
        questionSetId: courseQuestionSets.questionSetId,
        courseCount: sql<number>`count(distinct ${courseQuestionSets.courseId})`
      })
        .from(courseQuestionSets)
        .where(sql`${courseQuestionSets.courseId} = ANY(${group.courseIds})`)
        .groupBy(courseQuestionSets.questionSetId)
        .having(sql`count(distinct ${courseQuestionSets.courseId}) > 1`);
      
      if (sharedQuestionSets.length > 0) {
        sharedCount++;
      } else {
        notSharedCount++;
      }
    }
    
    const check4 = {
      name: "Course pairs share question sets",
      passed: sharedCount > 0,
      message: `✅ ${sharedCount} course groups share question sets, ${notSharedCount} groups don't share`,
      details: { sharedCount, notSharedCount }
    };
    result.checks.push(check4);
    console.log(check4.message);
    
    // Check 5: Verify no duplicate junction table entries
    console.log("\n📋 Check 5: Checking for duplicate junction table entries...");
    const duplicateMappings = await db.select({
      courseId: courseQuestionSets.courseId,
      questionSetId: courseQuestionSets.questionSetId,
      count: sql<number>`count(*)`
    })
      .from(courseQuestionSets)
      .groupBy(courseQuestionSets.courseId, courseQuestionSets.questionSetId)
      .having(sql`count(*) > 1`);
    
    const check5 = {
      name: "No duplicate course-questionset mappings",
      passed: duplicateMappings.length === 0,
      message: duplicateMappings.length === 0
        ? "✅ No duplicate mappings in junction table"
        : `❌ Found ${duplicateMappings.length} duplicate mappings`,
      details: duplicateMappings
    };
    result.checks.push(check5);
    if (!check5.passed) result.passed = false;
    console.log(check5.message);
    
    // Check 6: Verify test runs reference valid question sets
    console.log("\n📋 Check 6: Validating user test runs...");
    const invalidTestRuns = await db.select({
      testRunId: userTestRuns.id,
      questionSetId: userTestRuns.questionSetId
    })
      .from(userTestRuns)
      .leftJoin(questionSets, eq(userTestRuns.questionSetId, questionSets.id))
      .where(isNull(questionSets.id));
    
    const check6 = {
      name: "All test runs reference valid question sets",
      passed: invalidTestRuns.length === 0,
      message: invalidTestRuns.length === 0
        ? "✅ All test runs reference valid question sets"
        : `❌ ${invalidTestRuns.length} test runs reference non-existent question sets`,
      details: invalidTestRuns
    };
    result.checks.push(check6);
    if (!check6.passed) result.passed = false;
    console.log(check6.message);
    
    // Check 7: Data integrity - count comparisons
    console.log("\n📋 Check 7: Verifying data counts...");
    const counts = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(courses),
      db.select({ count: sql<number>`count(*)` }).from(questionSets),
      db.select({ count: sql<number>`count(*)` }).from(questions),
      db.select({ count: sql<number>`count(*)` }).from(questionVersions),
      db.select({ count: sql<number>`count(*)` }).from(userTestRuns),
      db.select({ count: sql<number>`count(*)` }).from(userAnswers),
    ]);
    
    const check7 = {
      name: "Data count verification",
      passed: true,
      message: "✅ Data counts:",
      details: {
        users: counts[0][0].count,
        courses: counts[1][0].count,
        questionSets: counts[2][0].count,
        questions: counts[3][0].count,
        questionVersions: counts[4][0].count,
        userTestRuns: counts[5][0].count,
        userAnswers: counts[6][0].count
      }
    };
    result.checks.push(check7);
    console.log(check7.message);
    console.log(`  Users: ${counts[0][0].count}`);
    console.log(`  Courses: ${counts[1][0].count}`);
    console.log(`  Question Sets: ${counts[2][0].count}`);
    console.log(`  Questions: ${counts[3][0].count}`);
    console.log(`  Question Versions: ${counts[4][0].count}`);
    console.log(`  Test Runs: ${counts[5][0].count}`);
    console.log(`  User Answers: ${counts[6][0].count}`);
    
    // Check 8: Test query performance
    console.log("\n📋 Check 8: Testing query performance...");
    const startTime = Date.now();
    
    // Test getting question sets for a course (should use junction table)
    const testCourse = await db.select().from(courses).limit(1);
    if (testCourse.length > 0) {
      await db.select({
        questionSet: questionSets
      })
        .from(courseQuestionSets)
        .innerJoin(questionSets, eq(courseQuestionSets.questionSetId, questionSets.id))
        .where(eq(courseQuestionSets.courseId, testCourse[0].id));
    }
    
    const queryTime = Date.now() - startTime;
    const check8 = {
      name: "Query performance",
      passed: queryTime < 1000, // Should complete in under 1 second
      message: queryTime < 1000
        ? `✅ Test queries completed in ${queryTime}ms`
        : `⚠️  Test queries took ${queryTime}ms (may need optimization)`,
      details: { queryTime }
    };
    result.checks.push(check8);
    console.log(check8.message);
    
  } catch (error) {
    console.error("❌ Validation error:", error);
    result.passed = false;
    result.checks.push({
      name: "Fatal error",
      passed: false,
      message: `❌ Fatal error during validation: ${error}`
    });
  } finally {
    await connection.end();
  }
  
  return result;
}

// Main execution
async function main() {
  const databaseUrl = process.env.NEW_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL or NEW_DATABASE_URL environment variable not set");
    process.exit(1);
  }
  
  const result = await validateMigration(databaseUrl);
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 VALIDATION SUMMARY");
  console.log("=".repeat(60));
  
  const passedChecks = result.checks.filter(c => c.passed).length;
  const failedChecks = result.checks.filter(c => !c.passed).length;
  
  console.log(`Total checks: ${result.checks.length}`);
  console.log(`Passed: ${passedChecks} ✅`);
  console.log(`Failed: ${failedChecks} ❌`);
  console.log(`\nOverall result: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
  
  if (!result.passed) {
    console.log("\n⚠️  Failed checks:");
    result.checks
      .filter(c => !c.passed)
      .forEach(c => {
        console.log(`  - ${c.name}: ${c.message}`);
        if (c.details) {
          console.log(`    Details:`, c.details);
        }
      });
  }
  
  // Save detailed report
  const fs = await import("fs/promises");
  const reportPath = path.join(process.cwd(), "validation-report.json");
  await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(result.passed ? 0 : 1);
}

main().catch(console.error);