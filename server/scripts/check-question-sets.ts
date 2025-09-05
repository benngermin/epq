import { db } from '../db';
import { questionSets } from '../../shared/schema';

async function checkQuestionSets() {
  try {
    console.log('📋 Checking available question sets...');
    
    const sets = await db.select({
      id: questionSets.id,
      title: questionSets.title,
      externalId: questionSets.externalId,
      questionCount: questionSets.questionCount
    })
    .from(questionSets)
    .limit(10);
    
    console.log(`\n📊 Found ${sets.length} question sets:`);
    sets.forEach(set => {
      console.log(`  [${set.id}] ${set.title} (${set.questionCount} questions)`);
      console.log(`      External ID: ${set.externalId}`);
    });
    
    if (sets.length > 0) {
      console.log(`\n💡 Use question set ID ${sets[0].id} for testing`);
      return sets[0];
    } else {
      console.log('\n❌ No question sets found');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error checking question sets:', error);
    throw error;
  }
}

checkQuestionSets()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });