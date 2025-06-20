import { readFileSync } from 'fs';

// Read one of the test files to test the import via admin panel
const fileName = 'Test_Form_1_v2_1750440819801.json';
console.log(`Reading ${fileName}...`);

try {
  const questionsData = JSON.parse(
    readFileSync(`./attached_assets/${fileName}`, 'utf8')
  );
  
  console.log(`Found ${questionsData.length} questions`);
  console.log('First question preview:', JSON.stringify(questionsData[0], null, 2));
  
  // Create a smaller sample for testing
  const sampleQuestions = questionsData.slice(0, 5);
  console.log(`\nSample of 5 questions for testing:`);
  console.log(JSON.stringify(sampleQuestions, null, 2));
  
} catch (error) {
  console.error('Error reading file:', error);
}