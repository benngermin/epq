const { Pool } = require('pg');
const { readFileSync } = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateQuestionTypeTest() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Read the question data
    const questionsData = JSON.parse(
      readFileSync('./question_type_test_data.json', 'utf8')
    );
    
    console.log(`Updating ${questionsData.length} questions in Question Type Test...`);
    
    for (const questionData of questionsData) {
      // Find the existing question
      const questionResult = await client.query(
        'SELECT id FROM questions WHERE question_set_id = 79 AND original_question_number = $1',
        [questionData.question_number]
      );
      
      if (questionResult.rows.length === 0) {
        console.log(`Question ${questionData.question_number} not found, skipping...`);
        continue;
      }
      
      const questionId = questionResult.rows[0].id;
      
      // Update the question version
      for (const version of questionData.versions) {
        await client.query(
          `UPDATE question_versions 
           SET topic_focus = $1,
               question_text = $2,
               question_type = $3,
               answer_choices = $4,
               correct_answer = $5,
               acceptable_answers = $6,
               case_sensitive = $7,
               allow_multiple = $8,
               correct_order = $9
           WHERE question_id = $10 AND version_number = $11`,
          [
            version.topic_focus,
            version.question_text,
            version.question_type,
            JSON.stringify(version.answer_choices),
            version.correct_answer,
            version.acceptable_answers ? JSON.stringify(version.acceptable_answers) : null,
            version.case_sensitive || false,
            version.allow_multiple || false,
            version.correct_order ? JSON.stringify(version.correct_order) : null,
            questionId,
            version.version_number
          ]
        );
      }
      
      console.log(`Updated question ${questionData.question_number} (${questionData.type})`);
    }
    
    await client.query('COMMIT');
    console.log('Successfully updated Question Type Test questions!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating questions:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateQuestionTypeTest().catch(console.error).finally(() => process.exit(0));