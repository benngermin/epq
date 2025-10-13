CREATE TABLE "ai_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_name" text DEFAULT 'google/gemini-2.5-flash',
	"temperature" integer DEFAULT 70,
	"max_tokens" integer DEFAULT 150
);
--> statement-breakpoint
CREATE TABLE "chatbot_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"message_id" text NOT NULL,
	"feedback_type" text NOT NULL,
	"feedback_message" text,
	"question_version_id" integer,
	"conversation" jsonb,
	"course_id" integer,
	"question_set_id" integer,
	"question_id" integer,
	"loid" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"model_name" text NOT NULL,
	"system_message" text,
	"user_message" text NOT NULL,
	"ai_response" text NOT NULL,
	"temperature" integer NOT NULL,
	"max_tokens" integer NOT NULL,
	"response_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_external_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"course_id" integer NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_external_mappings_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "course_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment" text NOT NULL,
	"course" text NOT NULL,
	"loid" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_question_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"question_set_id" integer NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_number" text NOT NULL,
	"course_title" text NOT NULL,
	"external_id" text,
	"bubble_unique_id" text,
	"is_ai" boolean DEFAULT true NOT NULL,
	"base_course_number" text,
	CONSTRAINT "courses_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "courses_bubble_unique_id_unique" UNIQUE("bubble_unique_id")
);
--> statement-breakpoint
CREATE TABLE "daily_activity_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"test_runs_started" integer DEFAULT 0 NOT NULL,
	"test_runs_completed" integer DEFAULT 0 NOT NULL,
	"questions_answered" integer DEFAULT 0 NOT NULL,
	"ai_interactions" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openrouter_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_name" text DEFAULT 'anthropic/claude-3.5-sonnet' NOT NULL,
	"system_message" text DEFAULT 'You are an expert insurance instructor providing clear explanations for insurance exam questions.' NOT NULL,
	"user_message" text DEFAULT 'Question: {{QUESTION_TEXT}}

Correct Answer: {{CORRECT_ANSWER}}

Learning Content:
{{LEARNING_CONTENT}}

Please provide a clear explanation for this question.' NOT NULL,
	"max_tokens" integer DEFAULT 32000 NOT NULL,
	"reasoning" text DEFAULT 'medium' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_name" text NOT NULL,
	"prompt_text" text NOT NULL,
	"model_name" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_match_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer,
	"matched_at" timestamp DEFAULT now() NOT NULL,
	"match_confidence" integer,
	"match_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"question_count" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	CONSTRAINT "question_sets_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "question_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"topic_focus" text NOT NULL,
	"question_text" text NOT NULL,
	"question_type" text DEFAULT 'multiple_choice' NOT NULL,
	"answer_choices" json NOT NULL,
	"correct_answer" text NOT NULL,
	"acceptable_answers" json,
	"case_sensitive" boolean DEFAULT false,
	"allow_multiple" boolean DEFAULT false,
	"matching_pairs" json,
	"correct_order" json,
	"blanks" json,
	"drop_zones" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_static_answer" boolean DEFAULT false NOT NULL,
	"static_explanation" text,
	"normalized_text_hash" text
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_set_id" integer NOT NULL,
	"original_question_number" integer NOT NULL,
	"loid" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_modified" timestamp DEFAULT now() NOT NULL,
	"content_fingerprint" text,
	"last_matched_at" timestamp,
	"match_confidence" integer
);
--> statement-breakpoint
CREATE TABLE "user_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_test_run_id" integer NOT NULL,
	"question_version_id" integer NOT NULL,
	"chosen_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_course_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"question_sets_completed" integer DEFAULT 0 NOT NULL,
	"questions_answered" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_set_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"question_order" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"cognito_sub" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub")
);
--> statement-breakpoint
ALTER TABLE "chatbot_feedback" ADD CONSTRAINT "chatbot_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_feedback" ADD CONSTRAINT "chatbot_feedback_question_version_id_question_versions_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_feedback" ADD CONSTRAINT "chatbot_feedback_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_feedback" ADD CONSTRAINT "chatbot_feedback_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_feedback" ADD CONSTRAINT "chatbot_feedback_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_logs" ADD CONSTRAINT "chatbot_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_external_mappings" ADD CONSTRAINT "course_external_mappings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_question_sets" ADD CONSTRAINT "course_question_sets_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_question_sets" ADD CONSTRAINT "course_question_sets_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_match_history" ADD CONSTRAINT "question_match_history_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_user_test_run_id_user_test_runs_id_fk" FOREIGN KEY ("user_test_run_id") REFERENCES "public"."user_test_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_question_version_id_question_versions_id_fk" FOREIGN KEY ("question_version_id") REFERENCES "public"."question_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_test_runs" ADD CONSTRAINT "user_test_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_test_runs" ADD CONSTRAINT "user_test_runs_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE no action ON UPDATE no action;