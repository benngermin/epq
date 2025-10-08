import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"), // Make optional for SSO users
  cognitoSub: text("cognito_sub").unique(), // AWS Cognito subject ID
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  courseNumber: text("course_number").notNull(),
  courseTitle: text("course_title").notNull(),
  externalId: text("external_id").unique(), // Client's course ID
  bubbleUniqueId: text("bubble_unique_id").unique(), // Bubble's unique course ID
  isAi: boolean("is_ai").default(true).notNull(), // Keep the column we already added
  baseCourseNumber: text("base_course_number"), // Base course number without AI/Non-AI suffix
});

export const courseExternalMappings = pgTable("course_external_mappings", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").unique().notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  source: text("source"), // Optional: track where this mapping came from (e.g., "moodle_v2")
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for many-to-many relationship between courses and question sets
export const courseQuestionSets = pgTable("course_question_sets", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  questionSetId: integer("question_set_id").references(() => questionSets.id).notNull(),
  displayOrder: integer("display_order").default(0).notNull(), // For ordering question sets within a course
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint to prevent duplicate mappings
  uniqueCourseQuestionSet: {
    columns: [table.courseId, table.questionSetId],
    name: "unique_course_question_set",
  },
}));

export const questionSets = pgTable("question_sets", {
  id: serial("id").primaryKey(),
  // courseId removed - now using junction table
  title: text("title").notNull(),
  description: text("description"),
  questionCount: integer("question_count").default(0).notNull(),
  externalId: text("external_id").unique(), // Bubble question set ID
  // isAi removed - question sets are now shared between AI and Non-AI courses
});



export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  questionSetId: integer("question_set_id").references(() => questionSets.id).notNull(),
  originalQuestionNumber: integer("original_question_number").notNull(),
  loid: text("loid").notNull(),
  displayOrder: integer("display_order").default(0).notNull(), // For ordering questions within a set
  isArchived: boolean("is_archived").default(false).notNull(), // For soft delete functionality
  lastModified: timestamp("last_modified").defaultNow().notNull(), // Track when question was last edited
});

export const questionVersions = pgTable("question_versions", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  topicFocus: text("topic_focus").notNull(),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").default("multiple_choice").notNull(),
  answerChoices: json("answer_choices").$type<any>().notNull(),
  correctAnswer: text("correct_answer").notNull(),
  acceptableAnswers: json("acceptable_answers").$type<string[]>(),
  caseSensitive: boolean("case_sensitive").default(false),
  allowMultiple: boolean("allow_multiple").default(false),
  matchingPairs: json("matching_pairs").$type<Array<{left: string, right: string}>>(),
  correctOrder: json("correct_order").$type<number[]>(),
  blanks: json("blanks").$type<Array<{
    blank_id: number;
    answer_choices: string[];
    correct_answer: string;
  }>>(),
  dropZones: json("drop_zones").$type<Array<{
    zone_id: number;
    zone_label: string;
  }>>(),
  isActive: boolean("is_active").default(true).notNull(),
  isStaticAnswer: boolean("is_static_answer").default(false).notNull(),
  staticExplanation: text("static_explanation"),
  normalizedTextHash: text("normalized_text_hash"),
});

export const userTestRuns = pgTable("user_test_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  questionSetId: integer("question_set_id").references(() => questionSets.id).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  questionOrder: json("question_order").$type<number[]>().notNull(),
});

export const userAnswers = pgTable("user_answers", {
  id: serial("id").primaryKey(),
  userTestRunId: integer("user_test_run_id").references(() => userTestRuns.id).notNull(),
  questionVersionId: integer("question_version_id").references(() => questionVersions.id).notNull(),
  chosenAnswer: text("chosen_answer").notNull(), // Changed from varchar(1) to text to support all answer types
  isCorrect: boolean("is_correct").notNull(),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
});

export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").default("google/gemini-2.5-flash"),
  temperature: integer("temperature").default(70), // stored as integer (0-100)
  maxTokens: integer("max_tokens").default(150),
});

export const promptVersions = pgTable("prompt_versions", {
  id: serial("id").primaryKey(),
  versionName: text("version_name").notNull(),
  promptText: text("prompt_text").notNull(),
  modelName: text("model_name"),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courseMaterials = pgTable("course_materials", {
  id: serial("id").primaryKey(),
  assignment: text("assignment").notNull(),
  course: text("course").notNull(),
  loid: text("loid").notNull(),
  content: text("content").notNull(),
});

export const chatbotLogs = pgTable("chatbot_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  modelName: text("model_name").notNull(),
  systemMessage: text("system_message"),
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response").notNull(),
  temperature: integer("temperature").notNull(),
  maxTokens: integer("max_tokens").notNull(),
  responseTime: integer("response_time"), // in milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatbotFeedback = pgTable("chatbot_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  messageId: text("message_id").notNull(),
  feedbackType: text("feedback_type").notNull(), // 'positive' or 'negative'
  feedbackMessage: text("feedback_message"),
  questionVersionId: integer("question_version_id").references(() => questionVersions.id),
  conversation: jsonb("conversation").$type<Array<{id: string, content: string, role: "user" | "assistant"}>>(), // Store full conversation
  courseId: integer("course_id").references(() => courses.id),
  questionSetId: integer("question_set_id").references(() => questionSets.id),
  questionId: integer("question_id").references(() => questions.id),
  loid: text("loid"), // Learning Objective ID from course material
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track user progress through courses for better analytics
export const userCourseProgress = pgTable("user_course_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  questionSetsCompleted: integer("question_sets_completed").default(0).notNull(),
  questionsAnswered: integer("questions_answered").default(0).notNull(),
  correctAnswers: integer("correct_answers").default(0).notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
});

// Pre-aggregated daily stats for faster dashboard loading
export const dailyActivitySummary = pgTable("daily_activity_summary", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  activeUsers: integer("active_users").default(0).notNull(),
  newUsers: integer("new_users").default(0).notNull(),
  testRunsStarted: integer("test_runs_started").default(0).notNull(),
  testRunsCompleted: integer("test_runs_completed").default(0).notNull(),
  questionsAnswered: integer("questions_answered").default(0).notNull(),
  aiInteractions: integer("ai_interactions").default(0).notNull(),
});

// OpenRouter configuration for static explanation generation
export const openRouterConfig = pgTable("openrouter_config", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").default("anthropic/claude-3.5-sonnet").notNull(),
  systemMessage: text("system_message").default("You are an expert insurance instructor providing clear explanations for insurance exam questions.").notNull(),
  maxTokens: integer("max_tokens").default(32000).notNull(),
  reasoning: text("reasoning").default("medium").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  testRuns: many(userTestRuns),
  courseProgress: many(userCourseProgress),
}));

export const userCourseProgressRelations = relations(userCourseProgress, ({ one }) => ({
  user: one(users, {
    fields: [userCourseProgress.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [userCourseProgress.courseId],
    references: [courses.id],
  }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  courseQuestionSets: many(courseQuestionSets),
  courseProgress: many(userCourseProgress),
}));

export const questionSetsRelations = relations(questionSets, ({ many }) => ({
  courseQuestionSets: many(courseQuestionSets),
  questions: many(questions),
  testRuns: many(userTestRuns),
}));

// Relations for the junction table
export const courseQuestionSetsRelations = relations(courseQuestionSets, ({ one }) => ({
  course: one(courses, {
    fields: [courseQuestionSets.courseId],
    references: [courses.id],
  }),
  questionSet: one(questionSets, {
    fields: [courseQuestionSets.questionSetId],
    references: [questionSets.id],
  }),
}));



export const questionsRelations = relations(questions, ({ one, many }) => ({
  questionSet: one(questionSets, {
    fields: [questions.questionSetId],
    references: [questionSets.id],
  }),
  versions: many(questionVersions),
}));

export const questionVersionsRelations = relations(questionVersions, ({ one, many }) => ({
  question: one(questions, {
    fields: [questionVersions.questionId],
    references: [questions.id],
  }),
  answers: many(userAnswers),
}));

export const userTestRunsRelations = relations(userTestRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [userTestRuns.userId],
    references: [users.id],
  }),
  questionSet: one(questionSets, {
    fields: [userTestRuns.questionSetId],
    references: [questionSets.id],
  }),
  answers: many(userAnswers),
}));

export const userAnswersRelations = relations(userAnswers, ({ one }) => ({
  testRun: one(userTestRuns, {
    fields: [userAnswers.userTestRunId],
    references: [userTestRuns.id],
  }),
  questionVersion: one(questionVersions, {
    fields: [userAnswers.questionVersionId],
    references: [questionVersions.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  password: true,
  cognitoSub: true,
}).extend({
  password: z.string().optional(), // Make password optional for SSO users
});

export const insertCourseSchema = createInsertSchema(courses).extend({
  externalId: z.string().optional(),
  baseCourseNumber: z.string().optional(),
});
export const insertQuestionSetSchema = createInsertSchema(questionSets).omit({
  // Removed fields that no longer exist
});
export const insertCourseQuestionSetSchema = createInsertSchema(courseQuestionSets);

export const insertQuestionSchema = createInsertSchema(questions);
export const insertQuestionVersionSchema = createInsertSchema(questionVersions);
export const insertUserTestRunSchema = createInsertSchema(userTestRuns);
export const insertUserAnswerSchema = createInsertSchema(userAnswers).omit({
  isCorrect: true,
});
export const insertAiSettingsSchema = createInsertSchema(aiSettings);
export const insertPromptVersionSchema = createInsertSchema(promptVersions);
export const insertCourseMaterialSchema = createInsertSchema(courseMaterials);
export const insertChatbotLogSchema = createInsertSchema(chatbotLogs);
export const insertChatbotFeedbackSchema = createInsertSchema(chatbotFeedback);
export const insertUserCourseProgressSchema = createInsertSchema(userCourseProgress);
export const insertDailyActivitySummarySchema = createInsertSchema(dailyActivitySummary);
export const insertOpenRouterConfigSchema = createInsertSchema(openRouterConfig);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type QuestionSet = typeof questionSets.$inferSelect;
export type InsertQuestionSet = z.infer<typeof insertQuestionSetSchema>;
export type CourseQuestionSet = typeof courseQuestionSets.$inferSelect;
export type InsertCourseQuestionSet = z.infer<typeof insertCourseQuestionSetSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type QuestionVersion = typeof questionVersions.$inferSelect;
export type InsertQuestionVersion = z.infer<typeof insertQuestionVersionSchema>;
export type UserTestRun = typeof userTestRuns.$inferSelect;
export type InsertUserTestRun = z.infer<typeof insertUserTestRunSchema>;
export type UserAnswer = typeof userAnswers.$inferSelect;
export type InsertUserAnswer = z.infer<typeof insertUserAnswerSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type InsertPromptVersion = z.infer<typeof insertPromptVersionSchema>;
export type CourseMaterial = typeof courseMaterials.$inferSelect;
export type InsertCourseMaterial = z.infer<typeof insertCourseMaterialSchema>;
export type ChatbotLog = typeof chatbotLogs.$inferSelect;
export type InsertChatbotLog = z.infer<typeof insertChatbotLogSchema>;
export type ChatbotFeedback = typeof chatbotFeedback.$inferSelect;
export type InsertChatbotFeedback = z.infer<typeof insertChatbotFeedbackSchema>;
export type UserCourseProgress = typeof userCourseProgress.$inferSelect;
export type InsertUserCourseProgress = z.infer<typeof insertUserCourseProgressSchema>;
export type DailyActivitySummary = typeof dailyActivitySummary.$inferSelect;
export type InsertDailyActivitySummary = z.infer<typeof insertDailyActivitySummarySchema>;
export type OpenRouterConfig = typeof openRouterConfig.$inferSelect;
export type InsertOpenRouterConfig = z.infer<typeof insertOpenRouterConfigSchema>;

// Question import schema - matches the attached JSON format
export const questionImportSchema = z.object({
  question_number: z.number(),
  type: z.string(),
  loid: z.string(),
  versions: z.array(z.object({
    version_number: z.number(),
    topic_focus: z.string(),
    question_text: z.string(),
    question_type: z.string().optional(), // For new question types
    answer_choices: z.union([
      z.array(z.string()), // For multiple choice, true/false, pick_from_list, ordering
      z.array(z.object({ left: z.string(), right: z.string() })), // For matching
    ]).default([]),
    correct_answer: z.string(),
    acceptable_answers: z.array(z.string()).optional(), // For fill_in_blank, numerical_entry, short_answer
    case_sensitive: z.boolean().optional().default(false), // For fill_in_blank, short_answer
    allow_multiple: z.boolean().optional().default(false), // For pick_from_list, multiple_response
    matching_pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(), // For matching
    correct_order: z.array(z.number()).optional(), // For ordering, drag_and_drop
    blanks: z.array(z.object({
      blank_id: z.number(),
      answer_choices: z.array(z.string()),
      correct_answer: z.string(),
    })).optional(),
    drop_zones: z.array(z.object({
      zone_id: z.number(),
      zone_label: z.string(),
    })).optional(),
    isStaticAnswer: z.boolean().optional().default(false), // For static answer questions
    staticExplanation: z.string().optional(), // Static explanation for static answer questions
  })),
});

export type QuestionImport = z.infer<typeof questionImportSchema>;
