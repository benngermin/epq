import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { questionSets, practiceTests, questions, questionVersions } from './shared/schema.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function quickImport() {
  try {
    console.log('Starting quick import...');
    
    // Import just the first test form to get the app working
    const questionsData = JSON.parse(
      readFileSync('./attached_assets/Test_Form_1_v2_1750183130787.json', 'utf8')
    );
    
    console.log(`Processing ${questionsData.length} questions...`);
    
    // Create question set
    const [questionSet] = await db.insert(questionSets).values({
      courseId: 1,
      title: 'Question Set 1',
      description: 'CPCU 500 Practice Questions - Set 1',
      questionCount: questionsData.length
    }).returning();
    
    console.log(`Created question set with ID: ${questionSet.id}`);
    
    // Create practice test
    const [practiceTest] = await db.insert(practiceTests).values({
      courseId: 1,
      questionSetId: questionSet.id,
      title: 'Practice Test 1',
      questionCount: questionsData.length
    }).returning();
    
    console.log(`Created practice test with ID: ${practiceTest.id}`);
    
    // Import questions in smaller batches
    const batchSize = 10;
    for (let i = 0; i < questionsData.length; i += batchSize) {
      const batch = questionsData.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(questionsData.length/batchSize)}`);
      
      for (const questionData of batch) {
        // Insert question
        const [question] = await db.insert(questions).values({
          questionSetId: questionSet.id,
          originalQuestionNumber: questionData.question_number,
          loid: questionData.loid
        }).returning();
        
        // Insert question version
        const version = questionData.versions[0];
        await db.insert(questionVersions).values({
          questionId: question.id,
          versionNumber: version.version_number,
          topicFocus: version.topic_focus,
          questionText: version.question_text,
          answerChoices: version.answer_choices,
          correctAnswer: version.correct_answer
        });
      }
    }
    
    console.log('Import completed successfully!');
    
  } catch (error) {
    console.error('Error during import:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

quickImport().catch(console.error);