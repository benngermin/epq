import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importAdditionalQuestions() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Import Test Form 2 questions for Question Set 3
    console.log('Importing Test Form 2 questions for Question Set 3...');
    const form2Data = JSON.parse(
      readFileSync('./attached_assets/Test_Form_2_v2_1750183130787.json', 'utf8')
    );
    
    await importQuestionsToSet(client, form2Data, 3);
    
    // Import Test Form 3 questions for Question Set 4
    console.log('Importing Test Form 3 questions for Question Set 4...');
    const form3Data = JSON.parse(
      readFileSync('./attached_assets/Test_Form_3_v2_1750183130787.json', 'utf8')
    );
    
    await importQuestionsToSet(client, form3Data, 4);
    
    await client.query('COMMIT');
    console.log('Successfully imported additional questions!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing questions:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function importQuestionsToSet(client, questionsData, questionSetId) {
  // First, clear existing placeholder questions for this set
  const existingQuestions = await client.query(
    'SELECT id FROM questions WHERE question_set_id = $1',
    [questionSetId]
  );
  
  if (existingQuestions.rows.length > 0) {
    const questionIds = existingQuestions.rows.map(row => row.id);
    
    // Delete question versions
    await client.query(
      'DELETE FROM question_versions WHERE question_id = ANY($1)',
      [questionIds]
    );
    
    // Delete questions
    await client.query(
      'DELETE FROM questions WHERE question_set_id = $1',
      [questionSetId]
    );
  }
  
  console.log(`Processing ${questionsData.length} questions for question set ${questionSetId}...`);
  
  for (const questionData of questionsData) {
    // Insert question
    const questionResult = await client.query(
      'INSERT INTO questions (question_set_id, original_question_number, loid) VALUES ($1, $2, $3) RETURNING id',
      [questionSetId, questionData.question_number, questionData.loid]
    );
    const questionId = questionResult.rows[0].id;
    
    // Insert all versions of this question
    for (const version of questionData.versions) {
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
  
  console.log(`Imported ${questionsData.length} questions to question set ${questionSetId}`);
}

// Run the import
importAdditionalQuestions().catch(console.error);