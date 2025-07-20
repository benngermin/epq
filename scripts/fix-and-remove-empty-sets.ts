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

async function fixAndRemoveEmptyQuestionSets() {
  console.log('🔧 Fixing question counts and removing empty question sets...\n');
  
  const sql_client = neon(DATABASE_URL);
  const db = drizzle(sql_client);
  
  try {
    // First, get all question sets
    const allQuestionSets = await db.select().from(questionSets);
    
    console.log(`📊 Found ${allQuestionSets.length} total question sets\n`);
    console.log('🔄 Updating question counts...\n');
    
    let emptyCount = 0;
    let updatedCount = 0;
    const toDelete = [];
    
    // Check each question set
    for (const qs of allQuestionSets) {
      // Count actual questions
      const result = await db.select({ count: sql<number>`count(*)::int` })
        .from(questions)
        .where(eq(questions.questionSetId, qs.id));
      
      const actualCount = result[0].count;
      
      if (actualCount === 0) {
        console.log(`  ❌ ${qs.title} (ID: ${qs.id}) - EMPTY, will be deleted`);
        toDelete.push(qs);
        emptyCount++;
      } else if (actualCount !== qs.questionCount) {
        // Update the count
        await db.update(questionSets)
          .set({ questionCount: actualCount })
          .where(eq(questionSets.id, qs.id));
        console.log(`  ✅ ${qs.title} - Updated count from ${qs.questionCount} to ${actualCount}`);
        updatedCount++;
      }
    }
    
    console.log(`\n📈 Updated ${updatedCount} question set counts`);
    console.log(`🗑️  Found ${emptyCount} truly empty question sets\n`);
    
    if (toDelete.length > 0) {
      console.log('Deleting empty question sets...\n');
      
      for (const qs of toDelete) {
        await db.delete(questionSets)
          .where(eq(questionSets.id, qs.id));
        console.log(`  🗑️  Deleted: ${qs.title} (ID: ${qs.id})`);
      }
    }
    
    // Final statistics
    const remaining = await db.select({ count: sql<number>`count(*)::int` })
      .from(questionSets);
    
    const withQuestions = await db.select({ count: sql<number>`count(*)::int` })
      .from(questionSets)
      .where(sql`${questionSets.questionCount} > 0`);
    
    console.log('\n✅ Cleanup complete!');
    console.log(`\n📊 Final statistics:`);
    console.log(`  - Total question sets: ${remaining[0].count}`);
    console.log(`  - Question sets with questions: ${withQuestions[0].count}`);
    console.log(`  - Empty question sets removed: ${emptyCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixAndRemoveEmptyQuestionSets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });