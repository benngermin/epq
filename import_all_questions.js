import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function importAllQuestions() {
  try {
    console.log('Starting complete question import...');
    
    // Clear existing questions first to avoid duplicates
    await db.delete(schema.questionVersions);
    await db.delete(schema.questions);
    
    const files = [
      { file: 'Test_Form_1_v2_1750438604838.json', setId: 2 },
      { file: 'Test_Form_2_v2_1750438604838.json', setId: 3 },
      { file: 'Test_Form_3_v2_1750438604837.json', setId: 4 }
    ];
    
    for (const { file, setId } of files) {
      console.log(`Processing ${file} for question set ${setId}...`);
      
      const questionsData = JSON.parse(
        readFileSync(`./attached_assets/${file}`, 'utf8')
      );
      
      console.log(`Found ${questionsData.length} questions in ${file}`);
      
      for (const questionData of questionsData) {
        // Insert question
        const [question] = await db.insert(schema.questions).values({
          questionSetId: setId,
          originalQuestionNumber: questionData.question_number,
          loid: questionData.loid
        }).returning();
        
        // Insert question version
        const version = questionData.versions[0];
        await db.insert(schema.questionVersions).values({
          questionId: question.id,
          versionNumber: version.version_number,
          topicFocus: version.topic_focus,
          questionText: version.question_text,
          answerChoices: version.answer_choices,
          correctAnswer: version.correct_answer
        });
      }
      
      // Update question count
      await db.update(schema.questionSets)
        .set({ questionCount: questionsData.length })
        .where({ id: setId });
      
      console.log(`Completed ${file}: ${questionsData.length} questions imported`);
    }
    
    console.log('All questions imported successfully!');
    
  } catch (error) {
    console.error('Error during import:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

importAllQuestions().catch(console.error);