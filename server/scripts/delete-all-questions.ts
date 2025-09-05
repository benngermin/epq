import { db } from '../db';
import { sql } from 'drizzle-orm';

async function deleteAllQuestions() {
  try {
    console.log('🗑️  Deleting all question versions and questions...');
    
    // Delete in correct order due to foreign key constraints
    // 1. First delete user answers (they reference question versions)
    const userAnswersResult = await db.execute(sql`DELETE FROM user_answers WHERE 1=1`);
    console.log(`✅ Deleted ${userAnswersResult.rowCount} user answers`);
    
    // 2. Then delete question versions
    const versionsResult = await db.execute(sql`DELETE FROM question_versions WHERE 1=1`);
    console.log(`✅ Deleted ${versionsResult.rowCount} question versions`);
    
    // 3. Finally delete questions
    const questionsResult = await db.execute(sql`DELETE FROM questions WHERE 1=1`);
    console.log(`✅ Deleted ${questionsResult.rowCount} questions`);
    
    console.log('🎉 All question data deleted successfully! Ready for fresh import.');
    
    // Show remaining counts to verify
    const remainingQuestions = await db.execute(sql`SELECT COUNT(*) as count FROM questions`);
    const remainingVersions = await db.execute(sql`SELECT COUNT(*) as count FROM question_versions`);
    const remainingAnswers = await db.execute(sql`SELECT COUNT(*) as count FROM user_answers`);
    
    console.log(`\n📊 Verification counts:`);
    console.log(`   Questions: ${remainingQuestions.rows[0].count}`);
    console.log(`   Question versions: ${remainingVersions.rows[0].count}`);
    console.log(`   User answers: ${remainingAnswers.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error deleting questions:', error);
    throw error;
  }
}

// Run the function immediately
deleteAllQuestions()
  .then(() => {
    console.log('✨ Fresh start complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });

export { deleteAllQuestions };