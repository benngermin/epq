import { sql } from 'drizzle-orm';
import { db } from '../db';

// Create indexes for better query performance
export async function createDatabaseIndexes() {
  try {
    console.log('Creating database indexes for performance optimization...');
    
    // Indexes for user authentication queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    
    // Indexes for question queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_questions_question_set_id ON questions(question_set_id);
      CREATE INDEX IF NOT EXISTS idx_questions_original_number ON questions(question_set_id, original_question_number);
    `);
    
    // Indexes for question versions
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_question_versions_question_id ON question_versions(question_id);
    `);
    
    // Indexes for user test runs and answers
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_test_runs_user_id ON user_test_runs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_test_runs_question_set_id ON user_test_runs(question_set_id);
      CREATE INDEX IF NOT EXISTS idx_user_answers_test_run_id ON user_answers(user_test_run_id);
      CREATE INDEX IF NOT EXISTS idx_user_answers_question_version_id ON user_answers(user_test_run_id, question_version_id);
    `);
    

    
    // Indexes for question sets
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_question_sets_course_id ON question_sets(course_id);
    `);
    
    // Indexes for chatbot logs (for analytics)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_chatbot_logs_user_id ON chatbot_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_logs_created_at ON chatbot_logs(created_at DESC);
    `);
    
    // Indexes for course materials
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_course_materials_loid ON course_materials(loid);
    `);
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
    // Don't throw error - indexes are optional for functionality
  }
}