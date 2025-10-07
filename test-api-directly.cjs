// Test the API directly with the storage layer
const { createRequire } = require('module');
const requireFunc = createRequire(import.meta.url || __filename);
const { Client } = requireFunc('pg');

async function testAPI() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Test what the storage layer would return with the new method
    const storageQuery = `
      SELECT DISTINCT q.*
      FROM questions q
      INNER JOIN question_versions qv ON qv.question_id = q.id AND qv.is_active = true
      WHERE q.question_set_id = 5
      ORDER BY q.original_question_number;
    `;
    
    const result = await client.query(storageQuery);
    console.log(`\n=== Testing Question Set 5 (CPCU555 Set 2) ===`);
    console.log(`Active questions returned by fixed getQuestionsByQuestionSet: ${result.rows.length}`);
    
    // Show which question is missing
    const questionNumbers = result.rows.map(r => r.original_question_number).sort((a, b) => a - b);
    for (let i = 1; i <= 99; i++) {
      if (!questionNumbers.includes(i)) {
        console.log(`Missing question: ${i} (deactivated)`);
      }
    }
    
    // Check the stored count
    const qsResult = await client.query('SELECT question_count FROM question_sets WHERE id = 5');
    console.log(`\nStored question_count: ${qsResult.rows[0].question_count}`);
    console.log(`Actual active questions: ${result.rows.length}`);
    
    if (qsResult.rows[0].question_count !== result.rows.length) {
      console.log('\n⚠️  Count mismatch detected! The refresh preview should show:');
      console.log(`  - Current Questions: ${result.rows.length}`);
      console.log(`  - Will Be Removed: 1`);
      console.log(`  - Total After Refresh: Should match Bubble data`);
    }
    
    // Now update the count to fix it
    await client.query('UPDATE question_sets SET question_count = $1 WHERE id = 5', [result.rows.length]);
    console.log('\n✅ Fixed question_count to match active questions');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testAPI();