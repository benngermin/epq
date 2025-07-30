import fs from 'fs';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './shared/schema';
import { questionSets, questions, questionVersions } from './shared/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function importQuestionSet2() {
  try {
    // Read the JSON file
    const jsonData = fs.readFileSync(
      './attached_assets/Pasted--set-name-Claims-in-an-Evolving-World-bubble-course-unique-id-1750879028142x913672297-1753884544087_1753884544088.txt',
      'utf-8'
    );
    
    const data = JSON.parse(jsonData);
    
    console.log('Importing question set:', data.set_name);
    console.log('Total questions:', data.questions.length);
    
    // First, create the question set for AIC 300 (course_id = 16)
    const [newQuestionSet] = await db.insert(questionSets).values({
      courseId: 16, // AIC 300
      title: 'Question Set 2',
      description: data.set_name,
      questionCount: data.questions.length,
      externalId: data.bubble_course_unique_id
    }).returning();
    
    console.log('Created question set with ID:', newQuestionSet.id);
    
    // Import each question
    for (const q of data.questions) {
      // Insert the question
      const [newQuestion] = await db.insert(questions).values({
        questionSetId: newQuestionSet.id,
        originalQuestionNumber: q.question_number,
        loid: q.loid
      }).returning();
      
      // Insert the question version
      await db.insert(questionVersions).values({
        questionId: newQuestion.id,
        versionNumber: data.version || 1,
        topicFocus: data.set_name,
        questionText: q.question_text,
        answerChoices: q.answer_choices,
        correctAnswer: q.correct_answer,
        questionType: 'multiple choice'
      });
      
      console.log(`Imported question ${q.question_number}`);
    }
    
    console.log('✅ Successfully imported all questions!');
    
  } catch (error) {
    console.error('Error importing question set:', error);
    throw error;
  }
}

// Run the import
importQuestionSet2().then(() => {
  console.log('Import completed');
  process.exit(0);
}).catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});