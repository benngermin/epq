import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importNewVersions() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get the CPCU 500 course
    const courseResult = await client.query('SELECT id FROM courses WHERE title = $1', ['CPCU 500']);
    if (courseResult.rows.length === 0) {
      throw new Error('CPCU 500 course not found');
    }
    const courseId = courseResult.rows[0].id;
    
    // Create new question sets for the updated files
    const testFiles = [
      { file: 'Test_Form_1_v2_1750440819801.json', setName: 'Question Set 4 (Updated)' },
      { file: 'Test_Form_2_v2_1750440819801.json', setName: 'Question Set 5 (Updated)' },
      { file: 'Test_Form_3_v2_1750440819800.json', setName: 'Question Set 6 (Updated)' }
    ];
    
    for (let i = 0; i < testFiles.length; i++) {
      const { file, setName } = testFiles[i];
      const setNumber = i + 4;
      
      console.log(`Processing ${file}...`);
      
      try {
        const questionsData = JSON.parse(
          readFileSync(`./attached_assets/${file}`, 'utf8')
        );
        
        console.log(`Found ${questionsData.length} questions in ${file}`);
        
        // Create new question set
        const questionSetResult = await client.query(
          'INSERT INTO question_sets (course_id, title, description, question_count) VALUES ($1, $2, $3, $4) RETURNING id',
          [courseId, setName, `CPCU 500 Practice Questions - ${setName}`, questionsData.length]
        );
        const questionSetId = questionSetResult.rows[0].id;
        console.log(`Created question set with ID: ${questionSetId}`);
        
        // Create practice test
        const practiceTestResult = await client.query(
          'INSERT INTO practice_tests (course_id, question_set_id, title, question_count) VALUES ($1, $2, $3, $4) RETURNING id',
          [courseId, questionSetId, `Practice Test ${setNumber}`, questionsData.length]
        );
        console.log(`Created practice test with ID: ${practiceTestResult.rows[0].id}`);
        
        // Import questions in smaller batches
        console.log(`Importing ${questionsData.length} questions...`);
        let imported = 0;
        
        for (let j = 0; j < questionsData.length; j++) {
          const questionData = questionsData[j];
          
          try {
            // Insert question
            const questionResult = await client.query(
              'INSERT INTO questions (question_set_id, original_question_number, loid) VALUES ($1, $2, $3) RETURNING id',
              [questionSetId, questionData.question_number, questionData.loid]
            );
            const questionId = questionResult.rows[0].id;
            
            // Insert question versions
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
            
            imported++;
            
            if (j % 10 === 0) {
              console.log(`Progress: ${j + 1}/${questionsData.length} questions`);
            }
            
          } catch (questionError) {
            console.error(`Error importing question ${questionData.question_number}:`, questionError.message);
          }
        }
        
        console.log(`Successfully imported ${imported} questions for ${setName}`);
        
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError.message);
      }
    }
    
    await client.query('COMMIT');
    console.log('Import completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

importNewVersions().catch(console.error);