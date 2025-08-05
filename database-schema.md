# Database Schema - Insurance Exam Prep Platform

## Overview
PostgreSQL database with 16 tables tracking users, courses, questions, test runs, AI interactions, and analytics.

## Tables

### 1. `users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing user ID |
| name | text | NOT NULL | User's full name |
| email | text | NOT NULL, UNIQUE | User's email address |
| password | text | | Hashed password (optional for SSO) |
| cognito_sub | text | UNIQUE | AWS Cognito subject ID |
| is_admin | boolean | DEFAULT false, NOT NULL | Admin privilege flag |
| created_at | timestamp | DEFAULT NOW(), NOT NULL | Account creation time |

### 2. `courses`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing course ID |
| course_number | text | NOT NULL | Course identifier (e.g., "101") |
| course_title | text | NOT NULL | Full course name |
| external_id | text | UNIQUE | Client's course ID |
| bubble_unique_id | text | UNIQUE | Bubble platform course ID |
| is_ai | boolean | DEFAULT true, NOT NULL | AI-enabled course flag |

### 3. `question_sets`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing set ID |
| course_id | integer | FOREIGN KEY → courses.id, NOT NULL | Associated course |
| title | text | NOT NULL | Question set name |
| description | text | | Optional description |
| question_count | integer | DEFAULT 0, NOT NULL | Number of questions |
| external_id | text | UNIQUE | Bubble question set ID |

### 4. `questions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing question ID |
| question_set_id | integer | FOREIGN KEY → question_sets.id, NOT NULL | Parent question set |
| original_question_number | integer | NOT NULL | Original position in set |
| loid | text | NOT NULL | Learning object identifier |

### 5. `question_versions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing version ID |
| question_id | integer | FOREIGN KEY → questions.id, NOT NULL | Parent question |
| version_number | integer | NOT NULL | Version sequence number |
| topic_focus | text | NOT NULL | Question topic/focus area |
| question_text | text | NOT NULL | The actual question |
| question_type | text | DEFAULT 'multiple_choice', NOT NULL | Question format |
| answer_choices | json | NOT NULL | Array of answer options |
| correct_answer | text | NOT NULL | Correct answer(s) |
| acceptable_answers | json | | Array of acceptable answers |
| case_sensitive | boolean | DEFAULT false | Case sensitivity flag |
| allow_multiple | boolean | DEFAULT false | Multiple answer flag |
| matching_pairs | json | | For matching questions |
| correct_order | json | | For ordering questions |

### 6. `user_test_runs`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing run ID |
| user_id | integer | FOREIGN KEY → users.id, NOT NULL | Test taker |
| question_set_id | integer | FOREIGN KEY → question_sets.id, NOT NULL | Question set used |
| started_at | timestamp | DEFAULT NOW(), NOT NULL | Test start time |
| completed_at | timestamp | | Test completion time |
| question_order | json | NOT NULL | Array of question IDs in order |

### 7. `user_answers`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing answer ID |
| user_test_run_id | integer | FOREIGN KEY → user_test_runs.id, NOT NULL | Parent test run |
| question_version_id | integer | FOREIGN KEY → question_versions.id, NOT NULL | Question version answered |
| chosen_answer | text | NOT NULL | User's answer |
| is_correct | boolean | NOT NULL | Correctness flag |
| answered_at | timestamp | DEFAULT NOW(), NOT NULL | Answer timestamp |

### 8. `chatbot_logs`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing log ID |
| user_id | integer | FOREIGN KEY → users.id | User (nullable) |
| model_name | text | NOT NULL | AI model used |
| system_message | text | | System prompt |
| user_message | text | NOT NULL | User's message |
| ai_response | text | NOT NULL | AI's response |
| temperature | integer | NOT NULL | Temperature setting (0-100) |
| max_tokens | integer | NOT NULL | Max tokens setting |
| response_time | integer | | Response time in ms |
| created_at | timestamp | DEFAULT NOW(), NOT NULL | Interaction timestamp |

### 9. `user_course_progress`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY | Auto-incrementing ID |
| user_id | integer | FOREIGN KEY → users.id, NOT NULL | User |
| course_id | integer | FOREIGN KEY → courses.id, NOT NULL | Course |
| question_sets_completed | integer | NOT NULL | Completed sets count |
| questions_answered | integer | NOT NULL | Total questions answered |
| correct_answers | integer | NOT NULL | Correct answer count |
| last_activity | timestamp | NOT NULL | Last activity timestamp |

### 10. `daily_activity_summary`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY | Auto-incrementing ID |
| date | timestamp | NOT NULL | Date of summary |
| active_users | integer | NOT NULL | Count of active users |
| new_users | integer | NOT NULL | New registrations |
| test_runs_started | integer | NOT NULL | Tests started |
| test_runs_completed | integer | NOT NULL | Tests completed |
| questions_answered | integer | NOT NULL | Total questions answered |
| ai_interactions | integer | NOT NULL | AI chatbot uses |

### 11. `practice_tests`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PRIMARY KEY | Auto-incrementing ID |
| course_id | integer | FOREIGN KEY → courses.id, NOT NULL | Associated course |
| question_set_id | integer | FOREIGN KEY → question_sets.id | Associated question set |
| title | text | NOT NULL | Test title |
| question_count | integer | NOT NULL | Number of questions |

### 12. `ai_settings`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing ID |
| model_name | text | DEFAULT 'google/gemini-2.5-flash' | AI model |
| temperature | integer | DEFAULT 70 | Temperature (0-100) |
| max_tokens | integer | DEFAULT 150 | Max response tokens |

### 13. `prompt_versions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing ID |
| version_name | text | NOT NULL | Version identifier |
| prompt_text | text | NOT NULL | Prompt content |
| model_name | text | | Associated model |
| is_active | boolean | DEFAULT false, NOT NULL | Active flag |
| created_at | timestamp | DEFAULT NOW(), NOT NULL | Creation timestamp |

### 14. `course_materials`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing ID |
| assignment | text | NOT NULL | Assignment identifier |
| course | text | NOT NULL | Course identifier |
| loid | text | NOT NULL | Learning object ID |
| content | text | NOT NULL | Material content |

### 15. `course_external_mappings`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PRIMARY KEY | Auto-incrementing ID |
| external_id | text | UNIQUE, NOT NULL | External system ID |
| course_id | integer | FOREIGN KEY → courses.id, NOT NULL | Internal course ID |
| source | text | | Source system name |
| created_at | timestamp | DEFAULT NOW(), NOT NULL | Mapping creation time |

### 16. `session`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| sid | varchar | PRIMARY KEY | Session ID |
| sess | json | NOT NULL | Session data |
| expire | timestamp | NOT NULL | Expiration timestamp |

## Key Relationships
- Users → Test Runs → Answers
- Courses → Question Sets → Questions → Question Versions
- Users → Chatbot Logs
- Users → Course Progress

## Question Types Supported
- `multiple_choice` - Standard multiple choice
- `true_false` - True/False questions
- `fill_in_blank` - Fill in the blank
- `numerical_entry` - Numeric answers
- `short_answer` - Short text answers
- `pick_from_list` - Select from dropdown
- `matching` - Match pairs
- `ordering` - Put items in order
- `multiple_response` - Select multiple correct answers
- `drag_and_drop` - Drag and drop ordering

## Analytics Tables
- `chatbot_logs` - All AI interactions
- `daily_activity_summary` - Aggregated daily metrics
- `user_course_progress` - Per-user course progress
- `user_test_runs` + `user_answers` - Detailed test performance