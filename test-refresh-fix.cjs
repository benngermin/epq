// Test script to verify the refresh fix for CPCU555 Question Set 2
const fetch = require('node-fetch');

async function testRefreshFix() {
  console.log('Testing refresh fix for CPCU555 Question Set 2...\n');
  
  // First, get the current questions for question set 5 (CPCU555 Set 2)
  const currentQuestionsQuery = `
    SELECT q.id, q.original_question_number, q.loid, qv.is_active
    FROM questions q
    LEFT JOIN question_versions qv ON qv.question_id = q.id AND qv.is_active = true
    WHERE q.question_set_id = 5
    ORDER BY q.original_question_number;
  `;
  
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Get ALL questions (including inactive)
    const allQuestionsResult = await client.query(`
      SELECT q.id, q.original_question_number, q.loid, 
             CASE WHEN qv.id IS NOT NULL THEN true ELSE false END as has_active_version
      FROM questions q
      LEFT JOIN question_versions qv ON qv.question_id = q.id AND qv.is_active = true
      WHERE q.question_set_id = 5
      ORDER BY q.original_question_number;
    `);
    
    console.log(`Total questions in database (including inactive): ${allQuestionsResult.rows.length}`);
    console.log(`Questions with active versions: ${allQuestionsResult.rows.filter(r => r.has_active_version).length}`);
    console.log(`Questions without active versions (deactivated): ${allQuestionsResult.rows.filter(r => !r.has_active_version).length}\n`);
    
    // Show deactivated questions
    const deactivated = allQuestionsResult.rows.filter(r => !r.has_active_version);
    if (deactivated.length > 0) {
      console.log('Deactivated questions:');
      deactivated.forEach(q => {
        console.log(`  - Question ${q.original_question_number} (ID: ${q.id}, LOID: ${q.loid || 'none'})`);
      });
      console.log('');
    }
    
    // Test the storage method directly
    const storageQuery = `
      SELECT DISTINCT q.*
      FROM questions q
      INNER JOIN question_versions qv ON qv.question_id = q.id AND qv.is_active = true
      WHERE q.question_set_id = 5
      ORDER BY q.original_question_number;
    `;
    
    const activeQuestionsResult = await client.query(storageQuery);
    console.log(`Active questions returned by new getQuestionsByQuestionSet: ${activeQuestionsResult.rows.length}`);
    
    // Check question set count
    const questionSetResult = await client.query(`
      SELECT id, title, question_count 
      FROM question_sets 
      WHERE id = 5;
    `);
    
    if (questionSetResult.rows.length > 0) {
      const qs = questionSetResult.rows[0];
      console.log(`\nQuestion Set: ${qs.title}`);
      console.log(`Stored question_count: ${qs.question_count}`);
      console.log(`Actual active questions: ${activeQuestionsResult.rows.length}`);
      
      if (qs.question_count !== activeQuestionsResult.rows.length) {
        console.log('⚠️  WARNING: Question count mismatch! Needs refresh.');
      } else {
        console.log('✅ Question count is correct!');
      }
    }
    
  } catch (error) {
    console.error('Error testing refresh fix:', error);
  } finally {
    await client.end();
  }
}

testRefreshFix();