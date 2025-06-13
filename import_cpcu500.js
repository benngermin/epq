import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importCPCU500() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create CPCU 500 course
    const courseResult = await client.query(
      'INSERT INTO courses (title, description) VALUES ($1, $2) RETURNING id',
      ['CPCU 500', 'Commercial Property and Casualty Underwriting and Risk Management']
    );
    const courseId = courseResult.rows[0].id;
    console.log(`Created course with ID: ${courseId}`);
    
    // Create a practice test for the course
    const testResult = await client.query(
      'INSERT INTO practice_tests (course_id, title, question_count) VALUES ($1, $2, $3) RETURNING id',
      [courseId, 'CPCU 500 Practice Exam', 85]
    );
    const testId = testResult.rows[0].id;
    console.log(`Created practice test with ID: ${testId}`);
    
    // Read and parse the questions file
    const questionsData = JSON.parse(
      readFileSync('./attached_assets/Pasted--originalQuestionNumber-1-LOID-11597-versions-versionNumber-1-topicFocus--1749827737152_1749827737153.txt', 'utf8')
    );
    
    console.log(`Processing ${questionsData.length} questions...`);
    
    for (const questionData of questionsData) {
      // Insert question
      const questionResult = await client.query(
        'INSERT INTO questions (course_id, original_question_number, loid) VALUES ($1, $2, $3) RETURNING id',
        [courseId, questionData.originalQuestionNumber, questionData.LOID]
      );
      const questionId = questionResult.rows[0].id;
      
      // Insert all versions of this question
      for (const version of questionData.versions) {
        await client.query(
          'INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            questionId,
            version.versionNumber,
            version.topicFocus,
            version.questionText,
            JSON.stringify(version.answerChoices),
            version.correctAnswer
          ]
        );
      }
      
      console.log(`Imported question ${questionData.originalQuestionNumber} with ${questionData.versions.length} versions`);
    }
    
    await client.query('COMMIT');
    console.log('Successfully imported CPCU 500 course and all questions!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing data:', error);
    throw error;
  } finally {
    client.release();
  }
}

importCPCU500().catch(console.error).finally(() => process.exit(0));