import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addQuestionContent() {
  const client = await pool.connect();
  
  try {
    const files = [
      { file: 'Test_Form_1_v2_1750438604838.json', setId: 2 },
      { file: 'Test_Form_2_v2_1750438604838.json', setId: 3 },
      { file: 'Test_Form_3_v2_1750438604837.json', setId: 4 }
    ];
    
    for (const { file, setId } of files) {
      console.log(`Processing content for ${file}...`);
      
      const questionsData = JSON.parse(
        readFileSync(`./attached_assets/${file}`, 'utf8')
      );
      
      for (const questionData of questionsData) {
        // Get the question ID
        const questionResult = await client.query(
          'SELECT id FROM questions WHERE question_set_id = $1 AND original_question_number = $2',
          [setId, questionData.question_number]
        );
        
        if (questionResult.rows.length > 0) {
          const questionId = questionResult.rows[0].id;
          const version = questionData.versions[0];
          
          // Insert question version with full content
          await client.query(
            'INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer) VALUES ($1, $2, $3, $4, $5, $6)',
            [
              questionId,
              version.version_number,
              version.topic_focus,
              version.question_text,
              JSON.stringify(version.answer_choices),
              version.correct_answer
            ]
          );
        }
      }
      
      console.log(`Completed content for ${file}`);
    }
    
    console.log('All question content added successfully!');
    
  } catch (error) {
    console.error('Error adding question content:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addQuestionContent().catch(console.error);