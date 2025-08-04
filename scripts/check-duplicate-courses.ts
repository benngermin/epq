import { db } from "../server/db";
import { courses, questionSets } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkDuplicateCourses() {
  console.log("🔍 Checking for duplicate courses in the database...\n");

  try {
    // Get all courses
    const allCourses = await db.select().from(courses).orderBy(courses.courseNumber);
    
    // Group courses by course number
    const courseGroups = new Map<string, typeof allCourses>();
    
    for (const course of allCourses) {
      const existing = courseGroups.get(course.courseNumber) || [];
      existing.push(course);
      courseGroups.set(course.courseNumber, existing);
    }
    
    // Find duplicates
    const duplicates: Array<{ courseNumber: string; courses: typeof allCourses }> = [];
    
    for (const [courseNumber, coursesInGroup] of courseGroups.entries()) {
      if (coursesInGroup.length > 1) {
        duplicates.push({ courseNumber, courses: coursesInGroup });
      }
    }
    
    if (duplicates.length === 0) {
      console.log("✅ No duplicate courses found!");
      return;
    }
    
    console.log(`⚠️  Found ${duplicates.length} course numbers with duplicates:\n`);
    
    for (const { courseNumber, courses: duplicateCourses } of duplicates) {
      console.log(`📚 Course: ${courseNumber}`);
      console.log(`   Found ${duplicateCourses.length} entries:`);
      
      for (const course of duplicateCourses) {
        // Get question set count for each course
        const questionSetCount = await db
          .select()
          .from(questionSets)
          .where(eq(questionSets.courseId, course.id));
          
        console.log(`   - ID: ${course.id}, External ID: ${course.externalId}, Question Sets: ${questionSetCount.length}`);
        console.log(`     Title: "${course.courseTitle}"`);
        if (course.bubbleUniqueId) {
          console.log(`     Bubble ID: ${course.bubbleUniqueId}`);
        }
      }
      console.log();
    }
    
    console.log("\n📊 Summary:");
    console.log(`   Total courses: ${allCourses.length}`);
    console.log(`   Unique course numbers: ${courseGroups.size}`);
    console.log(`   Duplicate course numbers: ${duplicates.length}`);
    
    console.log("\n💡 Recommendation:");
    console.log("   Consider consolidating duplicate courses by:");
    console.log("   1. Identifying which version has the most complete data");
    console.log("   2. Migrating question sets to the primary course");
    console.log("   3. Removing the duplicate entries");
    console.log("\n   Run 'npm run scripts:merge-duplicate-courses' to automatically merge duplicates");
    
  } catch (error) {
    console.error("❌ Error checking for duplicates:", error);
    process.exit(1);
  }
}

// Run the check
checkDuplicateCourses()
  .then(() => {
    console.log("\n✅ Duplicate check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });