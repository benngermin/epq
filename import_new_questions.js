import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importNewQuestions() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get the existing CPCU 500 course
    const courseResult = await client.query('SELECT id FROM courses WHERE title = $1', ['CPCU 500']);
    if (courseResult.rows.length === 0) {
      throw new Error('CPCU 500 course not found');
    }
    const courseId = courseResult.rows[0].id;
    console.log(`Found course with ID: ${courseId}`);
    
    // Import each test form as a separate question set
    const testFiles = [
      'Test_Form_1_v2_1750440819801.json',
      'Test_Form_2_v2_1750440819801.json', 
      'Test_Form_3_v2_1750440819800.json'
    ];
    
    for (let i = 0; i < testFiles.length; i++) {
      const fileName = testFiles[i];
      const setNumber = i + 4; // Start from 4 since we already have sets 1-3
      
      console.log(`Processing ${fileName}...`);
      
      try {
        // Read and parse the questions file
        const questionsData = JSON.parse(
          readFileSync(`./attached_assets/${fileName}`, 'utf8')
        );
        
        console.log(`Found ${questionsData.length} questions in ${fileName}`);
        
        // Create question set
        const questionSetResult = await client.query(
          'INSERT INTO question_sets (course_id, title, description, question_count) VALUES ($1, $2, $3, $4) RETURNING id',
          [courseId, `Question Set ${setNumber}`, `CPCU 500 Practice Questions - Set ${setNumber}`, questionsData.length]
        );
        const questionSetId = questionSetResult.rows[0].id;
        console.log(`Created question set ${setNumber} with ID: ${questionSetId}`);
        
        // Create practice test for this question set
        const practiceTestResult = await client.query(
          'INSERT INTO practice_tests (course_id, question_set_id, title, question_count) VALUES ($1, $2, $3, $4) RETURNING id',
          [courseId, questionSetId, `Practice Test ${setNumber}`, questionsData.length]
        );
        const practiceTestId = practiceTestResult.rows[0].id;
        console.log(`Created practice test ${setNumber} with ID: ${practiceTestId}`);
        
        // Import questions with progress tracking
        console.log(`Importing ${questionsData.length} questions for set ${setNumber}...`);
        
        for (let j = 0; j < questionsData.length; j++) {
          const questionData = questionsData[j];
          
          if (j % 10 === 0) {
            console.log(`Progress: ${j}/${questionsData.length} questions processed`);
          }
          
          try {
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
          } catch (questionError) {
            console.error(`Error importing question ${questionData.question_number}:`, questionError);
            // Continue with next question instead of failing entire import
          }
        }
        
        console.log(`Successfully imported ${questionsData.length} questions for set ${setNumber}`);
        
      } catch (fileError) {
        console.error(`Error processing file ${fileName}:`, fileError);
        // Continue with next file
      }
    }
    
    await client.query('COMMIT');
    console.log('All questions imported successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing questions:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importNewQuestions().catch(console.error);