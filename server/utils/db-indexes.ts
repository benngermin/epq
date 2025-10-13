import { sql } from 'drizzle-orm';

// Create indexes for better query performance
// Accept DB as parameter instead of importing it
export async function createDatabaseIndexes(db: any) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating database indexes for performance optimization...');
    }
    
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
    
    // Enforce a single active version per question (ONE TRUE VALUE)
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_active_question_version
      ON question_versions(question_id)
      WHERE is_active = TRUE;
    `);
    
    // Indexes for user test runs and answers
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_test_runs_user_id ON user_test_runs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_test_runs_question_set_id ON user_test_runs(question_set_id);
      CREATE INDEX IF NOT EXISTS idx_user_answers_test_run_id ON user_answers(user_test_run_id);
      CREATE INDEX IF NOT EXISTS idx_user_answers_question_version_id ON user_answers(user_test_run_id, question_version_id);
    `);
    

    // Indexes for junction table (replaces old question_sets.course_id)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_course_question_sets_course_id ON course_question_sets(course_id);
      CREATE INDEX IF NOT EXISTS idx_course_question_sets_question_set_id ON course_question_sets(question_set_id);
      CREATE INDEX IF NOT EXISTS idx_course_question_sets_display_order ON course_question_sets(course_id, display_order);
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
    
    // Fix user sequence to prevent duplicate key errors
    // This ensures the sequence is always higher than the maximum existing user ID
    await db.execute(sql`
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);
    `);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Database indexes created successfully');
      console.log('User sequence updated to prevent duplicate key errors');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error creating database indexes:', error);
    }
    // Don't throw error - indexes are optional for functionality
  }
}