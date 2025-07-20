import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { questionSets, questions } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function removeEmptyQuestionSets() {
  console.log('🗑️  Starting removal of empty question sets...\n');
  
  const sql_client = neon(DATABASE_URL);
  const db = drizzle(sql_client);
  
  try {
    // First, let's identify all empty question sets
    const emptyQuestionSets = await db.select({
      id: questionSets.id,
      title: questionSets.title,
      courseId: questionSets.courseId,
      questionCount: questionSets.questionCount
    })
    .from(questionSets)
    .where(eq(questionSets.questionCount, 0));
    
    console.log(`Found ${emptyQuestionSets.length} empty question sets:\n`);
    
    if (emptyQuestionSets.length === 0) {
      console.log('✅ No empty question sets found. Nothing to remove.');
      return;
    }
    
    // Show what will be deleted
    emptyQuestionSets.forEach(qs => {
      console.log(`  - ${qs.title} (ID: ${qs.id}, Course ID: ${qs.courseId})`);
    });
    
    console.log('\n🔄 Removing empty question sets...\n');
    
    // Delete each empty question set
    let deletedCount = 0;
    for (const qs of emptyQuestionSets) {
      try {
        // Double-check that it's really empty (no questions)
        const questionCount = await db.select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.questionSetId, qs.id));
        
        if (questionCount[0].count === 0) {
          await db.delete(questionSets)
            .where(eq(questionSets.id, qs.id));
          console.log(`  ✅ Deleted: ${qs.title}`);
          deletedCount++;
        } else {
          console.log(`  ⚠️  Skipped: ${qs.title} (actually has ${questionCount[0].count} questions)`);
        }
      } catch (error) {
        console.error(`  ❌ Error deleting ${qs.title}:`, error);
      }
    }
    
    console.log(`\n✅ Successfully removed ${deletedCount} empty question sets.`);
    
    // Show remaining question sets count
    const remainingCount = await db.select({ count: sql<number>`count(*)` })
      .from(questionSets);
    console.log(`\n📊 Total question sets remaining: ${remainingCount[0].count}`);
    
  } catch (error) {
    console.error('❌ Error removing empty question sets:', error);
    process.exit(1);
  }
}

// Run the removal
removeEmptyQuestionSets()
  .then(() => {
    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to complete cleanup:', error);
    process.exit(1);
  });