import { pgTable, text, serial, integer, boolean, timestamp, json, varchar } from "drizzle-orm/pg-core";
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
  title: text("title").notNull(),
  description: text("description").notNull(),
});

export const questionSets = pgTable("question_sets", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  questionCount: integer("question_count").default(0).notNull(),
});

export const practiceTests = pgTable("practice_tests", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  questionSetId: integer("question_set_id").references(() => questionSets.id),
  title: text("title").notNull(),
  questionCount: integer("question_count").default(85).notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  questionSetId: integer("question_set_id").references(() => questionSets.id).notNull(),
  originalQuestionNumber: integer("original_question_number").notNull(),
  loid: text("loid").notNull(),
});

export const questionVersions = pgTable("question_versions", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  topicFocus: text("topic_focus").notNull(),
  questionText: text("question_text").notNull(),
  answerChoices: json("answer_choices").$type<string[]>().notNull(),
  correctAnswer: varchar("correct_answer", { length: 1 }).notNull(),
});

export const userTestRuns = pgTable("user_test_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  practiceTestId: integer("practice_test_id").references(() => practiceTests.id).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  questionOrder: json("question_order").$type<number[]>().notNull(),
});

export const userAnswers = pgTable("user_answers", {
  id: serial("id").primaryKey(),
  userTestRunId: integer("user_test_run_id").references(() => userTestRuns.id).notNull(),
  questionVersionId: integer("question_version_id").references(() => questionVersions.id).notNull(),
  chosenAnswer: varchar("chosen_answer", { length: 1 }).notNull(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  testRuns: many(userTestRuns),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  practiceTests: many(practiceTests),
  questionSets: many(questionSets),
}));

export const questionSetsRelations = relations(questionSets, ({ one, many }) => ({
  course: one(courses, {
    fields: [questionSets.courseId],
    references: [courses.id],
  }),
  questions: many(questions),
  practiceTests: many(practiceTests),
}));

export const practiceTestsRelations = relations(practiceTests, ({ one, many }) => ({
  course: one(courses, {
    fields: [practiceTests.courseId],
    references: [courses.id],
  }),
  questionSet: one(questionSets, {
    fields: [practiceTests.questionSetId],
    references: [questionSets.id],
  }),
  testRuns: many(userTestRuns),
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
  practiceTest: one(practiceTests, {
    fields: [userTestRuns.practiceTestId],
    references: [practiceTests.id],
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

export const insertCourseSchema = createInsertSchema(courses);
export const insertQuestionSetSchema = createInsertSchema(questionSets);
export const insertPracticeTestSchema = createInsertSchema(practiceTests);
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type QuestionSet = typeof questionSets.$inferSelect;
export type InsertQuestionSet = z.infer<typeof insertQuestionSetSchema>;
export type PracticeTest = typeof practiceTests.$inferSelect;
export type InsertPracticeTest = z.infer<typeof insertPracticeTestSchema>;
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

// Question import schema - matches the attached JSON format
export const questionImportSchema = z.object({
  question_number: z.number(),
  type: z.string(),
  loid: z.string(),
  versions: z.array(z.object({
    version_number: z.number(),
    topic_focus: z.string(),
    question_text: z.string(),
    answer_choices: z.array(z.string()),
    correct_answer: z.string(),
  })),
});

export type QuestionImport = z.infer<typeof questionImportSchema>;
