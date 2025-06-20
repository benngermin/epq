import { readFileSync } from 'fs';
import { db } from './server/db.js';
import * as schema from './shared/schema.js';

async function batchImportQuestions() {
  try {
    console.log('Starting batch import of questions...');
    
    // Get the CPCU 500 course
    const courses = await db.select().from(schema.courses).where(schema.eq(schema.courses.title, 'CPCU 500'));
    if (courses.length === 0) {
      throw new Error('CPCU 500 course not found');
    }
    const courseId = courses[0].id;
    console.log(`Found course with ID: ${courseId}`);
    
    // Import each test form
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
        // Read questions data
        const questionsData = JSON.parse(
          readFileSync(`./attached_assets/${fileName}`, 'utf8')
        );
        
        console.log(`Found ${questionsData.length} questions in ${fileName}`);
        
        // Create question set
        const [questionSet] = await db.insert(schema.questionSets).values({
          courseId: courseId,
          title: `Question Set ${setNumber}`,
          description: `CPCU 500 Practice Questions - Set ${setNumber}`,
          questionCount: questionsData.length
        }).returning();
        
        console.log(`Created question set ${setNumber} with ID: ${questionSet.id}`);
        
        // Create practice test
        const [practiceTest] = await db.insert(schema.practiceTests).values({
          courseId: courseId,
          questionSetId: questionSet.id,
          title: `Practice Test ${setNumber}`,
          questionCount: questionsData.length
        }).returning();
        
        console.log(`Created practice test ${setNumber} with ID: ${practiceTest.id}`);
        
        // Batch import questions
        console.log(`Importing ${questionsData.length} questions...`);
        
        const batchSize = 5;
        let importedCount = 0;
        
        for (let j = 0; j < questionsData.length; j += batchSize) {
          const batch = questionsData.slice(j, j + batchSize);
          
          try {
            // Process batch
            for (const questionData of batch) {
              // Insert question
              const [question] = await db.insert(schema.questions).values({
                questionSetId: questionSet.id,
                originalQuestionNumber: questionData.question_number,
                loid: questionData.loid
              }).returning();
              
              // Insert question versions
              for (const version of questionData.versions) {
                await db.insert(schema.questionVersions).values({
                  questionId: question.id,
                  versionNumber: version.version_number,
                  topicFocus: version.topic_focus,
                  questionText: version.question_text,
                  answerChoices: version.answer_choices,
                  correctAnswer: version.correct_answer
                });
              }
              
              importedCount++;
            }
            
            if (j % 20 === 0) {
              console.log(`Progress: ${Math.min(j + batchSize, questionsData.length)}/${questionsData.length} questions processed`);
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 50));
            
          } catch (batchError) {
            console.error(`Error in batch ${j}-${j + batchSize}:`, batchError);
          }
        }
        
        console.log(`Successfully imported ${importedCount} questions for set ${setNumber}`);
        
      } catch (fileError) {
        console.error(`Error processing file ${fileName}:`, fileError);
      }
    }
    
    console.log('Batch import completed successfully!');
    
  } catch (error) {
    console.error('Error during batch import:', error);
    throw error;
  }
}

// Run the import
batchImportQuestions().catch(console.error);