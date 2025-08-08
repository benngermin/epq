import {
  users, courses, courseExternalMappings, questionSets, questions, questionVersions, 
  userTestRuns, userAnswers, aiSettings, promptVersions, courseMaterials, chatbotLogs,
  userCourseProgress, dailyActivitySummary,
  type User, type InsertUser, type Course, type InsertCourse,
  type QuestionSet, type InsertQuestionSet, 
  type Question, type InsertQuestion, type QuestionVersion, type InsertQuestionVersion, 
  type UserTestRun, type InsertUserTestRun, type UserAnswer, type InsertUserAnswer, 
  type AiSettings, type InsertAiSettings, type PromptVersion, type InsertPromptVersion,
  type CourseMaterial, type InsertCourseMaterial, type ChatbotLog, type InsertChatbotLog,
  type UserCourseProgress, type InsertUserCourseProgress,
  type DailyActivitySummary, type InsertDailyActivitySummary,
  type QuestionImport
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, not, inArray, isNull, gte, lte } from "drizzle-orm";
import session from "express-session";
import MemoryStore from "memorystore";
import ConnectPgSimple from "connect-pg-simple";
import { getDateAtMidnightEST, getTodayEST } from "./utils/logger";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByCognitoSub(cognitoSub: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Course methods
  getAllCourses(): Promise<Course[]>;
  getCoursesWithQuestionSets(): Promise<Course[]>;
  getCourse(id: number): Promise<Course | undefined>;
  getCourseByExternalId(externalId: string): Promise<Course | undefined>;
  getCourseByBubbleId(bubbleUniqueId: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: number): Promise<boolean>;
  
  // Question set methods
  getQuestionSetsByCourse(courseId: number): Promise<QuestionSet[]>;
  getQuestionSet(id: number): Promise<QuestionSet | undefined>;
  getQuestionSetByExternalId(externalId: string): Promise<QuestionSet | undefined>;
  createQuestionSet(questionSet: InsertQuestionSet): Promise<QuestionSet>;
  updateQuestionSet(id: number, questionSet: Partial<InsertQuestionSet>): Promise<QuestionSet | undefined>;
  deleteQuestionSet(id: number): Promise<boolean>;
  

  
  // Question methods
  getQuestionsByQuestionSet(questionSetId: number): Promise<Question[]>;
  getQuestion(id: number): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestionByOriginalNumber(questionSetId: number, originalNumber: number): Promise<Question | undefined>;
  
  // Question version methods
  getQuestionVersionsByQuestion(questionId: number): Promise<QuestionVersion[]>;
  getQuestionVersion(id: number): Promise<QuestionVersion | undefined>;
  createQuestionVersion(version: InsertQuestionVersion): Promise<QuestionVersion>;
  
  // Test run methods
  getUserTestRuns(userId: number): Promise<UserTestRun[]>;
  getUserTestRun(id: number): Promise<UserTestRun | undefined>;
  createUserTestRun(testRun: InsertUserTestRun): Promise<UserTestRun>;
  updateUserTestRun(id: number, testRun: Partial<InsertUserTestRun>): Promise<UserTestRun | undefined>;
  
  // User answer methods
  getUserAnswersByTestRun(testRunId: number): Promise<UserAnswer[]>;
  createUserAnswer(answer: InsertUserAnswer): Promise<UserAnswer>;
  getUserAnswer(testRunId: number, questionVersionId: number): Promise<UserAnswer | undefined>;
  getActiveUserTestRunForQuestionSet(userId: number, questionSetId: number): Promise<UserTestRun | undefined>;
  
  // AI settings methods
  getAiSettings(): Promise<AiSettings | undefined>;
  updateAiSettings(settings: Partial<InsertAiSettings>): Promise<AiSettings>;
  
  // Prompt version methods
  getAllPromptVersions(): Promise<PromptVersion[]>;
  getActivePromptVersion(): Promise<PromptVersion | undefined>;
  getPromptVersion(id: number): Promise<PromptVersion | undefined>;
  createPromptVersion(version: InsertPromptVersion): Promise<PromptVersion>;
  updatePromptVersion(id: number, version: Partial<InsertPromptVersion>): Promise<PromptVersion | undefined>;
  setActivePromptVersion(id: number): Promise<void>;
  
  // Bulk import methods
  importQuestions(questionSetId: number, questions: QuestionImport[]): Promise<void>;
  importCourseMaterials(materials: InsertCourseMaterial[]): Promise<void>;
  updateQuestionSetCount(questionSetId: number): Promise<void>;
  
  // Course material methods
  getCourseMaterialByLoid(loid: string): Promise<CourseMaterial | undefined>;
  
  // Chatbot log methods
  getChatbotLogs(): Promise<ChatbotLog[]>;
  createChatbotLog(log: InsertChatbotLog): Promise<ChatbotLog>;
  
  // Progress tracking
  getUserCourseProgress(userId: number, courseId: number): Promise<{ correctAnswers: number; totalAnswers: number }>;
  getUserTestProgress(userId: number, testId: number): Promise<{ status: string; score?: string; testRun?: UserTestRun }>;
  
  // Statistics methods for logs page
  getOverallStats(timeScale?: string): Promise<{
    totalUsers: number;
    totalCourses: number;
    totalQuestionSets: number;
    totalQuestions: number;
    totalTestRuns: number;
    totalAnswers: number;
    activeUsersToday: number;
    activeUsersThisWeek: number;
    activeUsersThisMonth: number;
    testRunsStartedToday: number;
    testRunsThisWeek: number;
    testRunsThisMonth: number;
    answersToday: number;
    answersThisWeek: number;
    answersThisMonth: number;
  }>;
  
  getUserStats(): Promise<Array<{
    userId: number;
    userName: string;
    userEmail: string;
    totalTestRuns: number;
    totalAnswers: number;
    correctAnswers: number;
    lastActive: Date | null;
    registeredAt: Date;
  }>>;
  
  getQuestionStats(): Promise<{
    byQuestionSet: Array<{
      questionSetId: number;
      questionSetTitle: string;
      courseTitle: string;
      isAi: boolean;
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
      successRate: number;
    }>;
    mostFailedQuestions: Array<{
      questionId: number;
      questionText: string;
      questionSetTitle: string;
      failureCount: number;
      totalAttempts: number;
      failureRate: number;
    }>;
  }>;
  
  getCourseStats(): Promise<Array<{
    courseId: number;
    courseNumber: string;
    courseTitle: string;
    totalQuestionSets: number;
    totalQuestions: number;
    totalAttempts: number;
    uniqueUsers: number;
    averageScore: number;
  }>>;
  
  getQuestionSetDetailedStats(questionSetId: number): Promise<{
    questionSetInfo: {
      id: number;
      title: string;
      courseTitle: string;
      courseNumber: string;
      totalQuestions: number;
      totalAttempts: number;
      successRate: number;
    };
    questions: Array<{
      questionId: number;
      questionNumber: number;
      questionText: string;
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
      successRate: number;
      averageTimeSpent: number;
    }>;
  }>;
  
  // User course progress operations
  updateUserCourseProgress(userId: number, courseId: number, updates: Partial<InsertUserCourseProgress>): Promise<void>;
  getUserProgressByCourse(userId: number, courseId: number): Promise<UserCourseProgress | null>;
  
  // Daily activity summary operations
  updateDailyActivitySummary(date: Date, updates: Partial<InsertDailyActivitySummary>): Promise<void>;
  getDailyActivitySummaries(startDate: Date, endDate: Date): Promise<DailyActivitySummary[]>;
  getDailyQuestionCount(date: Date): Promise<number>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    // Use PostgreSQL store for production-ready session persistence
    if (process.env.DATABASE_URL) {
      const PgSession = ConnectPgSimple(session);
      this.sessionStore = new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'session', // Use existing session table
        createTableIfMissing: false, // Table already exists
        pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
        errorLog: (error: any) => {
          // Only log non-duplicate key errors and non-connection errors
          if (!error.message?.includes('already exists') && 
              !error.message?.includes('session_pkey') &&
              !error.message?.includes('connect ETIMEDOUT') &&
              !error.message?.includes('ECONNREFUSED') &&
              !error.message?.includes('terminating connection due to administrator command')) {
            console.error('Session store error:', error);
          }
        }
      });
    } else {
      // Fallback to memory store if no database is available
      const MemoryStoreFactory = MemoryStore(session);
      this.sessionStore = new MemoryStoreFactory({
        checkPeriod: 86400000, // prune expired entries every 24h
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days TTL to match cookie maxAge
        max: 1000, // Limit to 1000 sessions to prevent memory issues
        dispose: (key: string, val: any) => {
          // Optional cleanup when session expires - only log in debug mode
          if (process.env.DEBUG_SESSIONS) {
            console.log(`Session ${key} expired and was disposed`);
          }
        }
      });
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByCognitoSub(cognitoSub: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.cognitoSub, cognitoSub));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(asc(courses.courseNumber));
  }

  async getCoursesWithQuestionSets(): Promise<Course[]> {
    // Get courses that have question sets with at least one question
    const coursesWithQuestionSets = await db
      .selectDistinct({ 
        id: courses.id,
        courseNumber: courses.courseNumber,
        courseTitle: courses.courseTitle,
        externalId: courses.externalId,
        bubbleUniqueId: courses.bubbleUniqueId,
        isAi: courses.isAi
      })
      .from(courses)
      .innerJoin(questionSets, eq(questionSets.courseId, courses.id))
      .where(sql`${questionSets.questionCount} > 0`)
      .orderBy(asc(courses.courseNumber));
    
    return coursesWithQuestionSets;
  }

  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getCourseByExternalId(externalId: string): Promise<Course | undefined> {
    // First check the courses table for direct external ID match
    const [course] = await db.select().from(courses).where(eq(courses.externalId, externalId));
    
    if (course) {
      return course;
    }
    
    // If not found, check the mapping table
    const [mapping] = await db.select()
      .from(courseExternalMappings)
      .where(eq(courseExternalMappings.externalId, externalId));
    
    if (mapping) {
      const [mappedCourse] = await db.select()
        .from(courses)
        .where(eq(courses.id, mapping.courseId));
      return mappedCourse || undefined;
    }
    
    return undefined;
  }

  async getCourseByBubbleId(bubbleUniqueId: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.bubbleUniqueId, bubbleUniqueId));
    return course || undefined;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: number, course: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updated] = await db.update(courses).set(course).where(eq(courses.id, id)).returning();
    return updated || undefined;
  }

  async deleteCourse(id: number): Promise<boolean> {
    const result = await db.delete(courses).where(eq(courses.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getQuestionSetsByCourse(courseId: number): Promise<QuestionSet[]> {
    return await db.select().from(questionSets).where(eq(questionSets.courseId, courseId));
  }

  async getQuestionSet(id: number): Promise<QuestionSet | undefined> {
    const [questionSet] = await db.select().from(questionSets).where(eq(questionSets.id, id));
    return questionSet || undefined;
  }

  async getQuestionSetByExternalId(externalId: string): Promise<QuestionSet | undefined> {
    const [questionSet] = await db.select().from(questionSets).where(eq(questionSets.externalId, externalId));
    return questionSet || undefined;
  }

  async createQuestionSet(questionSet: InsertQuestionSet): Promise<QuestionSet> {
    const [newQuestionSet] = await db.insert(questionSets).values(questionSet).returning();
    return newQuestionSet;
  }

  async updateQuestionSet(id: number, questionSet: Partial<InsertQuestionSet>): Promise<QuestionSet | undefined> {
    const [updated] = await db.update(questionSets).set(questionSet).where(eq(questionSets.id, id)).returning();
    return updated || undefined;
  }

  async deleteQuestionSet(id: number): Promise<boolean> {
    try {
      // Use transaction to ensure all deletions are atomic
      return await db.transaction(async (tx) => {
        // First, check if there are any test runs that reference this question set
        const referencingTestRuns = await tx.select().from(userTestRuns).where(eq(userTestRuns.questionSetId, id));
        
        // If there are test runs referencing this question set, we should not delete it
        if (referencingTestRuns.length > 0) {
          throw new Error('Cannot delete question set with existing test runs');
        }

        // Delete user answers for all question versions in this set
        await tx.execute(sql`
          DELETE FROM user_answers 
          WHERE question_version_id IN (
            SELECT qv.id 
            FROM question_versions qv 
            JOIN questions q ON qv.question_id = q.id 
            WHERE q.question_set_id = ${id}
          )
        `);

        // Delete all question versions for questions in this set
        await tx.execute(sql`
          DELETE FROM question_versions 
          WHERE question_id IN (
            SELECT id FROM questions WHERE question_set_id = ${id}
          )
        `);

        // Delete all questions in the set
        await tx.delete(questions).where(eq(questions.questionSetId, id));

        // Finally, delete the question set
        const result = await tx.delete(questionSets).where(eq(questionSets.id, id));
        return (result.rowCount || 0) > 0;
      });
    } catch (error) {
      console.error('Error in deleteQuestionSet:', error);
      throw error;
    }
  }



  async getQuestionsByQuestionSet(questionSetId: number): Promise<Question[]> {
    return await db.select().from(questions).where(eq(questions.questionSetId, questionSetId));
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getQuestionByOriginalNumber(questionSetId: number, originalNumber: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions)
      .where(and(eq(questions.questionSetId, questionSetId), eq(questions.originalQuestionNumber, originalNumber)));
    return question || undefined;
  }

  async getQuestionVersionsByQuestion(questionId: number): Promise<QuestionVersion[]> {
    return await db.select().from(questionVersions).where(eq(questionVersions.questionId, questionId));
  }

  async getQuestionVersion(id: number): Promise<QuestionVersion | undefined> {
    const [version] = await db.select().from(questionVersions).where(eq(questionVersions.id, id));
    return version || undefined;
  }

  async createQuestionVersion(version: InsertQuestionVersion): Promise<QuestionVersion> {
    const versionData = {
      ...version,
      answerChoices: version.answerChoices as string[]
    };
    const [newVersion] = await db.insert(questionVersions).values(versionData).returning();
    return newVersion;
  }

  async getUserTestRuns(userId: number): Promise<UserTestRun[]> {
    return await db.select().from(userTestRuns).where(eq(userTestRuns.userId, userId));
  }

  async getUserTestRun(id: number): Promise<UserTestRun | undefined> {
    const [testRun] = await db.select().from(userTestRuns).where(eq(userTestRuns.id, id));
    return testRun || undefined;
  }

  async createUserTestRun(testRun: InsertUserTestRun): Promise<UserTestRun> {
    const testRunData: any = {
      ...testRun,
      questionOrder: Array.isArray(testRun.questionOrder) ? testRun.questionOrder : JSON.parse(JSON.stringify(testRun.questionOrder))
    };
    const [newTestRun] = await db.insert(userTestRuns).values(testRunData).returning();
    return newTestRun;
  }

  async updateUserTestRun(id: number, testRun: Partial<InsertUserTestRun>): Promise<UserTestRun | undefined> {
    const updateData: any = { ...testRun };
    if (testRun.questionOrder) {
      updateData.questionOrder = testRun.questionOrder as number[];
    }
    const [updated] = await db.update(userTestRuns).set(updateData).where(eq(userTestRuns.id, id)).returning();
    return updated || undefined;
  }

  async getUserAnswersByTestRun(testRunId: number): Promise<UserAnswer[]> {
    return await db.select().from(userAnswers).where(eq(userAnswers.userTestRunId, testRunId));
  }

  async createUserAnswer(answer: InsertUserAnswer & { isCorrect: boolean }): Promise<UserAnswer> {
    const [newAnswer] = await db.insert(userAnswers).values(answer).returning();
    return newAnswer;
  }

  async getUserAnswer(testRunId: number, questionVersionId: number): Promise<UserAnswer | undefined> {
    const [answer] = await db.select().from(userAnswers)
      .where(and(
        eq(userAnswers.userTestRunId, testRunId),
        eq(userAnswers.questionVersionId, questionVersionId)
      ));
    return answer || undefined;
  }

  async getActiveUserTestRunForQuestionSet(userId: number, questionSetId: number): Promise<UserTestRun | undefined> {
    // Find the most recent uncompleted test run for this user and question set
    const [testRun] = await db.select()
      .from(userTestRuns)
      .where(and(
        eq(userTestRuns.userId, userId),
        eq(userTestRuns.questionSetId, questionSetId),
        isNull(userTestRuns.completedAt)
      ))
      .orderBy(desc(userTestRuns.startedAt))
      .limit(1);
    
    return testRun || undefined;
  }

  async getAiSettings(): Promise<AiSettings | undefined> {
    const [settings] = await db.select().from(aiSettings).limit(1);
    return settings || undefined;
  }

  async updateAiSettings(settings: Partial<InsertAiSettings>): Promise<AiSettings> {
    const existing = await this.getAiSettings();
    if (existing) {
      const [updated] = await db.update(aiSettings).set(settings).where(eq(aiSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(aiSettings).values(settings).returning();
      return created;
    }
  }

  async getAllPromptVersions(): Promise<PromptVersion[]> {
    const versions = await db.select().from(promptVersions).orderBy(desc(promptVersions.createdAt));
    return versions;
  }

  async getActivePromptVersion(): Promise<PromptVersion | undefined> {
    const [version] = await db.select().from(promptVersions).where(eq(promptVersions.isActive, true)).limit(1);
    return version || undefined;
  }

  async getPromptVersion(id: number): Promise<PromptVersion | undefined> {
    const [version] = await db.select().from(promptVersions).where(eq(promptVersions.id, id));
    return version || undefined;
  }

  async createPromptVersion(version: InsertPromptVersion): Promise<PromptVersion> {
    const [newVersion] = await db.insert(promptVersions).values(version).returning();
    return newVersion;
  }

  async updatePromptVersion(id: number, version: Partial<InsertPromptVersion>): Promise<PromptVersion | undefined> {
    const [updated] = await db.update(promptVersions).set(version).where(eq(promptVersions.id, id)).returning();
    return updated || undefined;
  }

  async setActivePromptVersion(id: number): Promise<void> {
    // Use transaction to ensure atomic update
    await db.transaction(async (tx) => {
      // First deactivate all versions
      await tx.update(promptVersions).set({ isActive: false });
      // Then activate the specified version
      await tx.update(promptVersions).set({ isActive: true }).where(eq(promptVersions.id, id));
    });
  }

  async importQuestions(questionSetId: number, questionsData: QuestionImport[]): Promise<void> {
    for (const questionData of questionsData) {
      // Check if question already exists
      let question = await this.getQuestionByOriginalNumber(questionSetId, questionData.question_number);
      
      if (!question) {
        question = await this.createQuestion({
          questionSetId,
          originalQuestionNumber: questionData.question_number,
          loid: questionData.loid,
        });
      }

      // Create question versions
      for (const versionData of questionData.versions) {
        await this.createQuestionVersion({
          questionId: question.id,
          versionNumber: versionData.version_number,
          topicFocus: versionData.topic_focus,
          questionText: versionData.question_text,
          questionType: versionData.question_type || questionData.type || "multiple_choice",
          answerChoices: versionData.answer_choices as any,
          correctAnswer: versionData.correct_answer,
          acceptableAnswers: versionData.acceptable_answers,
          caseSensitive: versionData.case_sensitive,
          allowMultiple: versionData.allow_multiple,
          matchingPairs: versionData.matching_pairs,
          correctOrder: versionData.correct_order,
        });
      }
    }
  }

  async getUserCourseProgress(userId: number, courseId: number): Promise<{ correctAnswers: number; totalAnswers: number }> {
    try {
      const result = await db.select({
        totalAnswers: sql<number>`COUNT(*)::int`,
        correctAnswers: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::int`
      })
      .from(userAnswers)
      .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
      .innerJoin(questionSets, eq(userTestRuns.questionSetId, questionSets.id))
      .where(and(
        eq(userTestRuns.userId, userId),
        eq(questionSets.courseId, courseId)
      ));

      const row = result[0];
      return {
        correctAnswers: row?.correctAnswers || 0,
        totalAnswers: row?.totalAnswers || 0,
      };
    } catch (error) {
      console.error("Error getting user course progress:", error);
      return { correctAnswers: 0, totalAnswers: 0 };
    }
  }

  async getUserTestProgress(userId: number, questionSetId: number): Promise<{ status: string; score?: string; testRun?: UserTestRun }> {
    const testRuns = await db.select().from(userTestRuns)
      .where(and(eq(userTestRuns.userId, userId), eq(userTestRuns.questionSetId, questionSetId)))
      .orderBy(desc(userTestRuns.startedAt));

    if (testRuns.length === 0) {
      return { status: "Not Started" };
    }

    const latestRun = testRuns[0];
    
    if (latestRun.completedAt) {
      const answers = await this.getUserAnswersByTestRun(latestRun.id);
      const correctCount = answers.filter(a => a.isCorrect).length;
      const totalCount = answers.length;
      
      return {
        status: "Completed",
        score: `${correctCount}/${totalCount}`,
        testRun: latestRun,
      };
    } else {
      const answers = await this.getUserAnswersByTestRun(latestRun.id);
      const totalQuestions = latestRun.questionOrder?.length || 85;
      return {
        status: "In Progress",
        score: `${answers.length}/${totalQuestions} questions`,
        testRun: latestRun,
      };
    }
  }

  async getQuestionSetAnalytics(): Promise<any[]> {
    try {
      // Get all question sets with their course info
      const questionSetsData = await db.select({
        questionSetId: questionSets.id,
        questionSetTitle: questionSets.title,
        courseId: questionSets.courseId,
        courseTitle: courses.courseTitle,
        courseNumber: courses.courseNumber,
      })
      .from(questionSets)
      .leftJoin(courses, eq(questionSets.courseId, courses.id));

      // Get test run statistics for each question set
      const analytics = await Promise.all(questionSetsData.map(async (qs) => {
        // Count total test runs (started sessions)
        const testRunStats = await db.select({
          totalRuns: sql<number>`COUNT(*)::int`,
          completedRuns: sql<number>`SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END)::int`,
          uniqueUsers: sql<number>`COUNT(DISTINCT user_id)::int`,
        })
        .from(userTestRuns)
        .where(eq(userTestRuns.questionSetId, qs.questionSetId));

        // Get answer statistics
        const answerStats = await db.select({
          totalAnswers: sql<number>`COUNT(*)::int`,
          correctAnswers: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::int`,
        })
        .from(userAnswers)
        .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
        .where(eq(userTestRuns.questionSetId, qs.questionSetId));

        const stats = testRunStats[0];
        const answers = answerStats[0];

        return {
          questionSetId: qs.questionSetId,
          questionSetTitle: qs.questionSetTitle,
          courseId: qs.courseId,
          courseTitle: qs.courseTitle,
          courseNumber: qs.courseNumber,
          totalSessionsStarted: stats?.totalRuns || 0,
          completedSessions: stats?.completedRuns || 0,
          uniqueUsers: stats?.uniqueUsers || 0,
          totalAnswers: answers?.totalAnswers || 0,
          correctAnswers: answers?.correctAnswers || 0,
          averageScore: answers?.totalAnswers > 0 
            ? Math.round((answers.correctAnswers / answers.totalAnswers) * 100) 
            : 0,
        };
      }));

      return analytics.sort((a, b) => b.totalSessionsStarted - a.totalSessionsStarted);
    } catch (error) {
      console.error("Error getting question set analytics:", error);
      return [];
    }
  }

  async updateQuestionSetCount(questionSetId: number): Promise<void> {
    const questions = await this.getQuestionsByQuestionSet(questionSetId);
    await this.updateQuestionSet(questionSetId, { questionCount: questions.length });
  }

  async importCourseMaterials(materials: InsertCourseMaterial[]): Promise<void> {
    // Clear existing course materials
    await db.delete(courseMaterials);
    
    // Insert new materials in batches
    const batchSize = 100;
    for (let i = 0; i < materials.length; i += batchSize) {
      const batch = materials.slice(i, i + batchSize);
      await db.insert(courseMaterials).values(batch);
    }
  }

  async getCourseMaterialByLoid(loid: string): Promise<CourseMaterial | undefined> {
    // First try exact match
    let result = await db.select()
      .from(courseMaterials)
      .where(eq(courseMaterials.loid, loid))
      .limit(1);
    
    // If no exact match, try without leading zeros
    if (!result[0] && loid) {
      const loidWithoutLeadingZeros = loid.replace(/^0+/, '');
      result = await db.select()
        .from(courseMaterials)
        .where(eq(courseMaterials.loid, loidWithoutLeadingZeros))
        .limit(1);
    }
    
    // If still no match, try matching with version suffix pattern (case-insensitive)
    if (!result[0] && loid) {
      result = await db.select()
        .from(courseMaterials)
        .where(sql`LOWER(${courseMaterials.loid}) LIKE LOWER(${loid}) || '.%'`)
        .limit(1);
    }
    
    // If still no match, try version suffix pattern without leading zeros
    if (!result[0] && loid) {
      const loidWithoutLeadingZeros = loid.replace(/^0+/, '');
      result = await db.select()
        .from(courseMaterials)
        .where(sql`LOWER(${courseMaterials.loid}) LIKE LOWER(${loidWithoutLeadingZeros}) || '.%'`)
        .limit(1);
    }
    
    return result[0];
  }

  async getChatbotLogs(): Promise<ChatbotLog[]> {
    return await db.select().from(chatbotLogs).orderBy(desc(chatbotLogs.createdAt));
  }

  async createChatbotLog(log: InsertChatbotLog): Promise<ChatbotLog> {
    const [newLog] = await db.insert(chatbotLogs).values(log).returning();
    return newLog;
  }

  async getOverallStats(timeScale?: string): Promise<{
    totalUsers: number;
    totalCourses: number;
    totalQuestionSets: number;
    totalQuestions: number;
    totalTestRuns: number;
    totalAnswers: number;
    activeUsersToday: number;
    activeUsersThisWeek: number;
    activeUsersThisMonth: number;
    testRunsStartedToday: number;
    testRunsThisWeek: number;
    testRunsThisMonth: number;
    answersToday: number;
    answersThisWeek: number;
    answersThisMonth: number;
  }> {
    const [userCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    const [courseCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(courses);
    const [questionSetCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(questionSets);
    const [questionCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(questions);
    const [testRunCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(userTestRuns);
    const [answerCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(userAnswers);

    // Active users calculations - Fixed to use proper timezone handling
    const now = new Date();
    const today = getTodayEST();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Active users today (users who have any activity today)
    const [activeToday] = await db.select({ count: sql<number>`COUNT(DISTINCT user_id)` })
      .from(userTestRuns)
      .where(sql`DATE(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date`);

    const [activeWeek] = await db.select({ count: sql<number>`COUNT(DISTINCT user_id)` })
      .from(userTestRuns)
      .where(sql`started_at >= ${weekAgo.toISOString()}`);

    const [activeMonth] = await db.select({ count: sql<number>`COUNT(DISTINCT user_id)` })
      .from(userTestRuns)
      .where(sql`started_at >= ${monthAgo.toISOString()}`);

    // Question sets started statistics
    const [testRunsToday] = await db.select({ count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})` })
      .from(userTestRuns)
      .where(sql`DATE(${userTestRuns.startedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date`);

    const [testRunsWeek] = await db.select({ count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})` })
      .from(userTestRuns)
      .where(sql`${userTestRuns.startedAt} >= ${weekAgo.toISOString()}`);

    const [testRunsMonth] = await db.select({ count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})` })
      .from(userTestRuns)
      .where(sql`${userTestRuns.startedAt} >= ${monthAgo.toISOString()}`);

    // Questions answered statistics
    const [answersToday] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userAnswers)
      .where(sql`DATE(${userAnswers.answeredAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date`);

    const [answersWeek] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userAnswers)
      .where(sql`${userAnswers.answeredAt} >= ${weekAgo.toISOString()}`);

    const [answersMonth] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userAnswers)
      .where(sql`${userAnswers.answeredAt} >= ${monthAgo.toISOString()}`);

    return {
      totalUsers: Number(userCount.count),
      totalCourses: Number(courseCount.count),
      totalQuestionSets: Number(questionSetCount.count),
      totalQuestions: Number(questionCount.count),
      totalTestRuns: Number(testRunCount.count),
      totalAnswers: Number(answerCount.count),
      activeUsersToday: Number(activeToday.count),
      activeUsersThisWeek: Number(activeWeek.count),
      activeUsersThisMonth: Number(activeMonth.count),
      testRunsStartedToday: Number(testRunsToday.count),
      testRunsThisWeek: Number(testRunsWeek.count),
      testRunsThisMonth: Number(testRunsMonth.count),
      answersToday: Number(answersToday.count),
      answersThisWeek: Number(answersWeek.count),
      answersThisMonth: Number(answersMonth.count)
    };
  }

  async getUserStats(): Promise<Array<{
    userId: number;
    userName: string;
    userEmail: string;
    totalTestRuns: number;
    totalAnswers: number;
    correctAnswers: number;
    lastActive: Date | null;
    registeredAt: Date;
  }>> {
    const userStatsQuery = await db.select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      registeredAt: users.createdAt,
      totalTestRuns: sql<number>`COUNT(DISTINCT ${userTestRuns.id})`,
      totalAnswers: sql<number>`COUNT(${userAnswers.id})`,
      correctAnswers: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`,
      lastActive: sql<Date | null>`MAX(${userTestRuns.startedAt})`
    })
    .from(users)
    .leftJoin(userTestRuns, eq(userTestRuns.userId, users.id))
    .leftJoin(userAnswers, eq(userAnswers.userTestRunId, userTestRuns.id))
    .groupBy(users.id, users.name, users.email, users.createdAt)
    .orderBy(desc(sql`MAX(${userTestRuns.startedAt})`));

    return userStatsQuery.map(stat => ({
      userId: stat.userId,
      userName: stat.userName,
      userEmail: stat.userEmail,
      totalTestRuns: Number(stat.totalTestRuns) || 0,
      totalAnswers: Number(stat.totalAnswers) || 0,
      correctAnswers: Number(stat.correctAnswers) || 0,
      lastActive: stat.lastActive,
      registeredAt: stat.registeredAt
    }));
  }

  async getQuestionSetDetailedStats(questionSetId: number, startDate?: Date, endDate?: Date): Promise<{
    questionSetInfo: {
      id: number;
      title: string;
      courseTitle: string;
      courseNumber: string;
      totalQuestions: number;
      totalAttempts: number;
      totalQuestionSetAttempts: number;
      successRate: number;
    };
    questions: Array<{
      questionId: number;
      questionNumber: number;
      questionText: string;
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
      successRate: number;
      averageTimeSpent: number;
    }>;
  }> {
    // Build date conditions
    const dateConditions = [];
    if (startDate || endDate) {
      dateConditions.push(
        ...(startDate ? [gte(userAnswers.answeredAt, startDate)] : []),
        ...(endDate ? [lte(userAnswers.answeredAt, endDate)] : [])
      );
    }
    // Get question set info
    const questionSetInfo = await db.select({
      id: questionSets.id,
      title: questionSets.title,
      courseTitle: courses.courseTitle,
      courseNumber: courses.courseNumber,
    })
    .from(questionSets)
    .innerJoin(courses, eq(courses.id, questionSets.courseId))
    .where(eq(questionSets.id, questionSetId))
    .limit(1);

    if (!questionSetInfo.length) {
      throw new Error("Question set not found");
    }

    // Get total attempts for the question set
    const totalAttemptsQuery = await db.select({
      totalAttempts: sql<number>`COUNT(DISTINCT ${userAnswers.id})`,
      correctAttempts: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(userAnswers, eq(userAnswers.questionVersionId, questionVersions.id))
    .where(
      dateConditions.length > 0 
        ? and(eq(questions.questionSetId, questionSetId), ...dateConditions)
        : eq(questions.questionSetId, questionSetId)
    );

    const totalStats = totalAttemptsQuery[0];
    const overallSuccessRate = totalStats?.totalAttempts > 0 
      ? (Number(totalStats.correctAttempts) / Number(totalStats.totalAttempts)) * 100 
      : 0;

    // Get detailed stats for each question
    const questionStats = await db.select({
      questionId: questions.id,
      questionNumber: questions.originalQuestionNumber,
      questionText: questionVersions.questionText,
      totalAttempts: sql<number>`COUNT(${userAnswers.id})`,
      correctAttempts: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`,
      incorrectAttempts: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END)`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(userAnswers, eq(userAnswers.questionVersionId, questionVersions.id))
    .where(
      dateConditions.length > 0 
        ? and(eq(questions.questionSetId, questionSetId), ...dateConditions)
        : eq(questions.questionSetId, questionSetId)
    )
    .groupBy(questions.id, questions.originalQuestionNumber, questionVersions.questionText)
    .orderBy(questions.originalQuestionNumber);

    // Count total questions
    const totalQuestions = await db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(questions)
    .where(eq(questions.questionSetId, questionSetId));

    // Count unique question set attempts (test runs)
    const questionSetAttemptsConditions = [eq(userTestRuns.questionSetId, questionSetId)];
    if (startDate || endDate) {
      if (startDate) questionSetAttemptsConditions.push(gte(userTestRuns.startedAt, startDate));
      if (endDate) questionSetAttemptsConditions.push(lte(userTestRuns.startedAt, endDate));
    }
    
    const questionSetAttempts = await db.select({
      count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})`,
    })
    .from(userTestRuns)
    .where(and(...questionSetAttemptsConditions));

    return {
      questionSetInfo: {
        ...questionSetInfo[0],
        totalQuestions: Number(totalQuestions[0]?.count) || 0,
        totalAttempts: Number(totalStats?.totalAttempts) || 0,
        totalQuestionSetAttempts: Number(questionSetAttempts[0]?.count) || 0,
        successRate: overallSuccessRate,
      },
      questions: questionStats.map(q => ({
        questionId: q.questionId,
        questionNumber: q.questionNumber,
        questionText: q.questionText.substring(0, 200) + (q.questionText.length > 200 ? '...' : ''),
        totalAttempts: Number(q.totalAttempts) || 0,
        correctAttempts: Number(q.correctAttempts) || 0,
        incorrectAttempts: Number(q.incorrectAttempts) || 0,
        successRate: q.totalAttempts > 0 
          ? (Number(q.correctAttempts) / Number(q.totalAttempts)) * 100 
          : 0,
        averageTimeSpent: 0, // Time tracking would require different approach
      })),
    };
  }

  async getQuestionStats(startDate?: Date, endDate?: Date): Promise<{
    byQuestionSet: Array<{
      questionSetId: number;
      questionSetTitle: string;
      courseTitle: string;
      isAi: boolean;
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
      successRate: number;
    }>;
    mostFailedQuestions: Array<{
      questionId: number;
      questionText: string;
      questionSetTitle: string;
      failureCount: number;
      totalAttempts: number;
      failureRate: number;
    }>;
  }> {
    // Build date conditions
    const dateConditions = [];
    if (startDate || endDate) {
      dateConditions.push(
        ...(startDate ? [gte(userAnswers.answeredAt, startDate)] : []),
        ...(endDate ? [lte(userAnswers.answeredAt, endDate)] : [])
      );
    }

    // Stats by question set
    const byQuestionSetQuery = await db.select({
      questionSetId: questionSets.id,
      questionSetTitle: questionSets.title,
      courseTitle: courses.courseTitle,
      isAi: questionSets.isAi,
      totalAttempts: sql<number>`COUNT(${userAnswers.id})`,
      correctAttempts: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`,
      incorrectAttempts: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END)`
    })
    .from(questionSets)
    .innerJoin(courses, eq(courses.id, questionSets.courseId))
    .innerJoin(questions, eq(questions.questionSetId, questionSets.id))
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(userAnswers, eq(userAnswers.questionVersionId, questionVersions.id))
    .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
    .groupBy(questionSets.id, questionSets.title, courses.courseTitle, questionSets.isAi)
    .having(sql`COUNT(${userAnswers.id}) > 0`)
    .orderBy(desc(sql`COUNT(${userAnswers.id})`));

    const byQuestionSet = byQuestionSetQuery.map(stat => ({
      questionSetId: stat.questionSetId,
      questionSetTitle: stat.questionSetTitle,
      courseTitle: stat.courseTitle,
      isAi: stat.isAi,
      totalAttempts: Number(stat.totalAttempts) || 0,
      correctAttempts: Number(stat.correctAttempts) || 0,
      incorrectAttempts: Number(stat.incorrectAttempts) || 0,
      successRate: stat.totalAttempts ? Number(stat.correctAttempts) / Number(stat.totalAttempts) * 100 : 0
    }));

    // Most failed questions
    const mostFailedQuery = await db.select({
      questionId: questions.id,
      questionText: questionVersions.questionText,
      questionSetTitle: questionSets.title,
      totalAttempts: sql<number>`COUNT(${userAnswers.id})`,
      failureCount: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END)`
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .innerJoin(questionSets, eq(questionSets.id, questions.questionSetId))
    .leftJoin(userAnswers, eq(userAnswers.questionVersionId, questionVersions.id))
    .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
    .groupBy(questions.id, questionVersions.questionText, questionSets.title)
    .having(sql`COUNT(${userAnswers.id}) > 0 AND SUM(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END) > 0`)
    .orderBy(desc(sql`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END)`))
    .limit(20);

    const mostFailedQuestions = mostFailedQuery.map(stat => ({
      questionId: stat.questionId,
      questionText: stat.questionText.substring(0, 100) + (stat.questionText.length > 100 ? '...' : ''),
      questionSetTitle: stat.questionSetTitle,
      failureCount: Number(stat.failureCount) || 0,
      totalAttempts: Number(stat.totalAttempts) || 0,
      failureRate: stat.totalAttempts ? Number(stat.failureCount) / Number(stat.totalAttempts) * 100 : 0
    }));

    return { byQuestionSet, mostFailedQuestions };
  }

  async getQuestionSetUsageByDate(groupBy: 'day' | 'week' | 'month' = 'day', timeRange: 'day' | 'week' | 'month' | 'all' = 'all'): Promise<Array<{
    date: string;
    count: number;
  }>> {
    // First get the actual date range of data
    const [dateRange] = await db.select({
      minDate: sql<Date>`MIN(${userTestRuns.startedAt})`,
      maxDate: sql<Date>`MAX(${userTestRuns.startedAt})`
    }).from(userTestRuns).where(sql`${userTestRuns.startedAt} IS NOT NULL`);
    
    if (!dateRange.minDate || !dateRange.maxDate) {
      return [];
    }

    let daysBack: number;
    const now = getTodayEST();
    const endDate = getTodayEST();
    const dataStartDate = new Date(dateRange.minDate);
    
    // First determine daysBack based on timeRange
    if (timeRange === 'all') {
      // Show data based on groupBy setting
      switch(groupBy) {
        case 'week':
          daysBack = Math.min(90, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
          break;
        case 'month':
          daysBack = Math.min(365, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
          break;
        default: // 'day'
          daysBack = Math.min(30, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } else {
      // Use timeRange to determine how far back to show data
      switch(timeRange) {
        case 'day':
          daysBack = 1;
          break;
        case 'week':
          daysBack = 7;
          break;
        case 'month':
          daysBack = 30;
          break;
        default:
          daysBack = 30;
      }
    }

    const startDate = getTodayEST();
    startDate.setDate(startDate.getDate() - daysBack);

    let query;
    if (groupBy === 'week') {
      // Generate series of weeks and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('week', ${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE_TRUNC('week', ${endDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            '1 week'::interval
          ) AS week_date
        ),
        week_data AS (
          SELECT 
            DATE_TRUNC('week', started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as week_date,
            COUNT(DISTINCT id) as count
          FROM user_test_runs
          WHERE started_at >= ${startDate.toISOString()}
            AND started_at IS NOT NULL
          GROUP BY DATE_TRUNC('week', started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
        )
        SELECT 
          TO_CHAR(date_series.week_date, 'YYYY-MM-DD') as date,
          COALESCE(week_data.count, 0) as count
        FROM date_series
        LEFT JOIN week_data ON date_series.week_date = week_data.week_date
        ORDER BY date_series.week_date
      `);
      query = result.rows as any[];
    } else if (groupBy === 'month') {
      // Generate series of months and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('month', ${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE_TRUNC('month', ${endDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            '1 month'::interval
          ) AS month_date
        ),
        month_data AS (
          SELECT 
            DATE_TRUNC('month', started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as month_date,
            COUNT(DISTINCT id) as count
          FROM user_test_runs
          WHERE started_at >= ${startDate.toISOString()}
            AND started_at IS NOT NULL
          GROUP BY DATE_TRUNC('month', started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
        )
        SELECT 
          TO_CHAR(date_series.month_date, 'YYYY-MM-DD') as date,
          COALESCE(month_data.count, 0) as count
        FROM date_series
        LEFT JOIN month_data ON date_series.month_date = month_data.month_date
        ORDER BY date_series.month_date
      `);
      query = result.rows as any[];
    } else {
      // Generate series of days and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE(${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE(${endDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            '1 day'::interval
          )::date AS day_date
        ),
        day_data AS (
          SELECT 
            DATE(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day_date,
            COUNT(DISTINCT id) as count
          FROM user_test_runs
          WHERE started_at >= ${startDate.toISOString()}
            AND started_at IS NOT NULL
          GROUP BY DATE(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
        )
        SELECT 
          TO_CHAR(date_series.day_date, 'YYYY-MM-DD') as date,
          COALESCE(day_data.count, 0) as count
        FROM date_series
        LEFT JOIN day_data ON date_series.day_date = day_data.day_date
        ORDER BY date_series.day_date
      `);
      query = result.rows as any[];
    }
    
    const result = query.map(row => ({
      date: String(row.date),
      count: Number(row.count || 0)
    }));
    
    console.log('[DEBUG] getQuestionSetUsageByDate result (last 3):', result.slice(-3));
    return result;
  }

  async getQuestionSetUsageByCourse(timeRange: 'day' | 'week' | 'month' | 'all' = 'all'): Promise<Array<{
    courseName: string;
    count: number;
  }>> {
    // Build the base query
    const baseQuery = db.select({
      courseName: courses.courseNumber,
      count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})`
    })
    .from(userTestRuns)
    .innerJoin(questionSets, eq(questionSets.id, userTestRuns.questionSetId))
    .innerJoin(courses, eq(courses.id, questionSets.courseId));

    // Add time filter if not 'all'
    let finalQuery;
    if (timeRange !== 'all') {
      const startDate = new Date();
      switch(timeRange) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }
      finalQuery = baseQuery.where(gte(userTestRuns.startedAt, startDate));
    } else {
      finalQuery = baseQuery;
    }

    const result = await finalQuery
      .groupBy(courses.courseNumber)
      .orderBy(desc(sql`COUNT(DISTINCT ${userTestRuns.id})`));

    return result.map(row => ({
      courseName: row.courseName,
      count: Number(row.count)
    }));
  }

  async getQuestionsAnsweredByDate(groupBy: 'day' | 'week' | 'month' = 'day', timeRange: 'day' | 'week' | 'month' | 'all' = 'all'): Promise<Array<{
    date: string;
    count: number;
  }>> {
    // First get the actual date range of data
    const [dateRange] = await db.select({
      minDate: sql<Date>`MIN(${userAnswers.answeredAt})`,
      maxDate: sql<Date>`MAX(${userAnswers.answeredAt})`
    }).from(userAnswers).where(sql`${userAnswers.answeredAt} IS NOT NULL`);
    
    if (!dateRange.minDate || !dateRange.maxDate) {
      return [];
    }

    let daysBack: number;
    const now = getTodayEST();
    const endDate = getTodayEST();
    const dataStartDate = new Date(dateRange.minDate);
    
    // First determine daysBack based on timeRange
    if (timeRange === 'all') {
      // Show data based on groupBy setting
      switch(groupBy) {
        case 'week':
          daysBack = Math.min(90, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
          break;
        case 'month':
          daysBack = Math.min(365, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
          break;
        default: // 'day'
          daysBack = Math.min(30, Math.ceil((now.getTime() - dataStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } else {
      // Use timeRange to determine how far back to show data
      switch(timeRange) {
        case 'day':
          daysBack = 1;
          break;
        case 'week':
          daysBack = 7;
          break;
        case 'month':
          daysBack = 30;
          break;
        default:
          daysBack = 30;
      }
    }

    const startDate = getTodayEST();
    startDate.setDate(startDate.getDate() - daysBack);

    let query;
    if (groupBy === 'week') {
      // Generate series of weeks and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('week', ${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE_TRUNC('week', ${endDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            '1 week'::interval
          ) AS week_date
        ),
        week_data AS (
          SELECT 
            DATE_TRUNC('week', answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as week_date,
            COUNT(id) as count
          FROM user_answers
          WHERE answered_at >= ${startDate.toISOString()}
            AND answered_at IS NOT NULL
          GROUP BY DATE_TRUNC('week', answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
        )
        SELECT 
          TO_CHAR(date_series.week_date, 'YYYY-MM-DD') as date,
          COALESCE(week_data.count, 0) as count
        FROM date_series
        LEFT JOIN week_data ON date_series.week_date = week_data.week_date
        ORDER BY date_series.week_date
      `);
      query = result.rows as any[];
    } else if (groupBy === 'month') {
      // Generate series of months and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('month', ${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE_TRUNC('month', ${endDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            '1 month'::interval
          ) AS month_date
        ),
        month_data AS (
          SELECT 
            DATE_TRUNC('month', answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as month_date,
            COUNT(id) as count
          FROM user_answers
          WHERE answered_at >= ${startDate.toISOString()}
            AND answered_at IS NOT NULL
          GROUP BY DATE_TRUNC('month', answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
        )
        SELECT 
          TO_CHAR(date_series.month_date, 'YYYY-MM-DD') as date,
          COALESCE(month_data.count, 0) as count
        FROM date_series
        LEFT JOIN month_data ON date_series.month_date = month_data.month_date
        ORDER BY date_series.month_date
      `);
      query = result.rows as any[];
    } else {
      // Generate series of days and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE(${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE(${endDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            '1 day'::interval
          )::date AS day_date
        ),
        day_data AS (
          SELECT 
            DATE(answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day_date,
            COUNT(id) as count
          FROM user_answers
          WHERE answered_at >= ${startDate.toISOString()}
            AND answered_at IS NOT NULL
          GROUP BY DATE(answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
        )
        SELECT 
          TO_CHAR(date_series.day_date, 'YYYY-MM-DD') as date,
          COALESCE(day_data.count, 0) as count
        FROM date_series
        LEFT JOIN day_data ON date_series.day_date = day_data.day_date
        ORDER BY date_series.day_date
      `);
      query = result.rows as any[];
    }
    
    const result = query.map(row => ({
      date: String(row.date),
      count: Number(row.count || 0)
    }));
    
    console.log('[DEBUG] getQuestionsAnsweredByDate result (last 3):', result.slice(-3));
    return result;
  }

  async getQuestionsAnsweredByCourse(timeRange: 'day' | 'week' | 'month' | 'all' = 'all'): Promise<Array<{
    courseName: string;
    count: number;
  }>> {
    // Build the base query
    const baseQuery = db.select({
      courseId: courses.id,
      courseName: courses.courseNumber,
      courseTitle: courses.courseTitle,
      count: sql<number>`COUNT(${userAnswers.id})`
    })
    .from(userAnswers)
    .innerJoin(userTestRuns, eq(userTestRuns.id, userAnswers.userTestRunId))
    .innerJoin(questionSets, eq(questionSets.id, userTestRuns.questionSetId))
    .innerJoin(courses, eq(courses.id, questionSets.courseId));

    // Add time filter if not 'all'
    let finalQuery;
    if (timeRange !== 'all') {
      const startDate = new Date();
      switch(timeRange) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }
      finalQuery = baseQuery.where(gte(userAnswers.answeredAt, startDate));
    } else {
      finalQuery = baseQuery;
    }

    const result = await finalQuery
      .groupBy(courses.id, courses.courseNumber, courses.courseTitle)
      .orderBy(desc(sql`COUNT(${userAnswers.id})`))
      .limit(10);

    return result.map(row => ({
      courseName: row.courseName,
      count: Number(row.count)
    }));
  }

  async getCourseStats(startDate?: Date, endDate?: Date): Promise<Array<{
    courseId: number;
    courseNumber: string;
    courseTitle: string;
    isAi: boolean;
    totalQuestionSets: number;
    totalQuestions: number;
    totalAttempts: number;
    uniqueUsers: number;
    averageScore: number;
  }>> {
    // Build date conditions
    const dateConditions = [];
    if (startDate || endDate) {
      dateConditions.push(
        ...(startDate ? [gte(userAnswers.answeredAt, startDate)] : []),
        ...(endDate ? [lte(userAnswers.answeredAt, endDate)] : [])
      );
    }

    const courseStatsQuery = await db.select({
      courseId: courses.id,
      courseNumber: courses.courseNumber,
      courseTitle: courses.courseTitle,
      isAi: courses.isAi,
      totalQuestionSets: sql<number>`COUNT(DISTINCT ${questionSets.id})`,
      totalQuestions: sql<number>`COUNT(DISTINCT ${questions.id})`,
      totalAttempts: sql<number>`COUNT(${userAnswers.id})`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${userTestRuns.userId})`,
      correctAnswers: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`
    })
    .from(courses)
    .leftJoin(questionSets, eq(questionSets.courseId, courses.id))
    .leftJoin(questions, eq(questions.questionSetId, questionSets.id))
    .leftJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(userAnswers, eq(userAnswers.questionVersionId, questionVersions.id))
    .leftJoin(userTestRuns, eq(userTestRuns.id, userAnswers.userTestRunId))
    .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
    .groupBy(courses.id, courses.courseNumber, courses.courseTitle, courses.isAi)
    .orderBy(desc(sql`COUNT(${userAnswers.id})`));

    return courseStatsQuery.map(stat => ({
      courseId: stat.courseId,
      courseNumber: stat.courseNumber,
      courseTitle: stat.courseTitle,
      isAi: stat.isAi,
      totalQuestionSets: Number(stat.totalQuestionSets) || 0,
      totalQuestions: Number(stat.totalQuestions) || 0,
      totalAttempts: Number(stat.totalAttempts) || 0,
      uniqueUsers: Number(stat.uniqueUsers) || 0,
      averageScore: stat.totalAttempts ? (Number(stat.correctAnswers) / Number(stat.totalAttempts) * 100) : 0
    }));
  }
  
  // User course progress operations
  async updateUserCourseProgress(userId: number, courseId: number, updates: Partial<InsertUserCourseProgress>): Promise<void> {
    const existing = await db.select()
      .from(userCourseProgress)
      .where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId)))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(userCourseProgress)
        .set({
          ...updates,
          lastActivity: new Date()
        })
        .where(eq(userCourseProgress.id, existing[0].id));
    } else {
      await db.insert(userCourseProgress).values({
        userId,
        courseId,
        ...updates
      });
    }
  }
  
  async getUserProgressByCourse(userId: number, courseId: number): Promise<UserCourseProgress | null> {
    const result = await db.select()
      .from(userCourseProgress)
      .where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId)))
      .limit(1);
    
    return result[0] || null;
  }
  
  // Daily activity summary operations
  async updateDailyActivitySummary(date: Date, updates: Partial<InsertDailyActivitySummary>): Promise<void> {
    const dateOnly = getDateAtMidnightEST(date);
    
    const existing = await db.select()
      .from(dailyActivitySummary)
      .where(eq(dailyActivitySummary.date, dateOnly))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(dailyActivitySummary)
        .set(updates)
        .where(eq(dailyActivitySummary.id, existing[0].id));
    } else {
      await db.insert(dailyActivitySummary).values({
        date: dateOnly,
        ...updates
      });
    }
  }
  
  async getDailyActivitySummaries(startDate: Date, endDate: Date): Promise<DailyActivitySummary[]> {
    return await db.select()
      .from(dailyActivitySummary)
      .where(and(
        sql`${dailyActivitySummary.date} >= ${startDate}`,
        sql`${dailyActivitySummary.date} <= ${endDate}`
      ))
      .orderBy(asc(dailyActivitySummary.date));
  }

  async getDailyQuestionCount(date: Date): Promise<number> {
    const dateOnly = getDateAtMidnightEST(date);
    const [summary] = await db.select()
      .from(dailyActivitySummary)
      .where(eq(dailyActivitySummary.date, dateOnly))
      .limit(1);
    
    return summary?.questionsAnswered || 0;
  }
}

export const storage = new DatabaseStorage();
