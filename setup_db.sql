-- Create all tables for the question bank application

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_sets (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  question_count INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_tests (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) NOT NULL,
  question_set_id INTEGER REFERENCES question_sets(id),
  title TEXT NOT NULL,
  question_count INTEGER DEFAULT 85 NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question_set_id INTEGER REFERENCES question_sets(id) NOT NULL,
  original_question_number INTEGER NOT NULL,
  loid TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_versions (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) NOT NULL,
  version_number INTEGER NOT NULL,
  topic_focus TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_choices JSON NOT NULL,
  correct_answer VARCHAR(1) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_test_runs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  practice_test_id INTEGER REFERENCES practice_tests(id) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  question_order JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS user_answers (
  id SERIAL PRIMARY KEY,
  user_test_run_id INTEGER REFERENCES user_test_runs(id) NOT NULL,
  question_version_id INTEGER REFERENCES question_versions(id) NOT NULL,
  chosen_answer VARCHAR(1) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_settings (
  id SERIAL PRIMARY KEY,
  model_name TEXT DEFAULT 'anthropic/claude-sonnet-4',
  temperature INTEGER DEFAULT 70,
  max_tokens INTEGER DEFAULT 150
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id SERIAL PRIMARY KEY,
  version_name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  model_name TEXT,
  is_active BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert initial data
INSERT INTO courses (title, description) VALUES 
('CPCU 500', 'Foundations of Risk Management and Insurance')
ON CONFLICT DO NOTHING;

INSERT INTO ai_settings (model_name, temperature, max_tokens) VALUES 
('anthropic/claude-sonnet-4', 70, 150)
ON CONFLICT DO NOTHING;

INSERT INTO prompt_versions (version_name, prompt_text, is_active) VALUES 
('Default V1', 'You are an AI assistant helping students study for insurance certification exams. Provide clear, educational explanations.', true)
ON CONFLICT DO NOTHING;