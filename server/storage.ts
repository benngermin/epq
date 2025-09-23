import {
  users, courses, courseExternalMappings, courseQuestionSets, questionSets, questions, questionVersions, 
  userTestRuns, userAnswers, aiSettings, promptVersions, courseMaterials, chatbotLogs,
  chatbotFeedback, userCourseProgress, dailyActivitySummary,
  type User, type InsertUser, type Course, type InsertCourse,
  type QuestionSet, type InsertQuestionSet, 
  type CourseQuestionSet, type InsertCourseQuestionSet,
  type Question, type InsertQuestion, type QuestionVersion, type InsertQuestionVersion, 
  type UserTestRun, type InsertUserTestRun, type UserAnswer, type InsertUserAnswer, 
  type AiSettings, type InsertAiSettings, type PromptVersion, type InsertPromptVersion,
  type CourseMaterial, type InsertCourseMaterial, type ChatbotLog, type InsertChatbotLog,
  type ChatbotFeedback, type InsertChatbotFeedback,
  type UserCourseProgress, type InsertUserCourseProgress,
  type DailyActivitySummary, type InsertDailyActivitySummary,
  type QuestionImport
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, not, inArray, isNull, isNotNull, gte, lte, lt } from "drizzle-orm";
import session from "express-session";
import MemoryStore from "memorystore";
import ConnectPgSimple from "connect-pg-simple";
import { getDateAtMidnightEST, getTodayEST } from "./utils/logger";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailCI(email: string): Promise<User | undefined>;
  getUserByCognitoSub(cognitoSub: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  upsertUserByEmail(user: { email: string; name?: string; cognitoSub?: string }): Promise<User>;
  
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
  
  // Junction table methods for many-to-many relationship
  createCourseQuestionSetMapping(courseId: number, questionSetId: number, displayOrder?: number): Promise<CourseQuestionSet>;
  removeCourseQuestionSetMapping(courseId: number, questionSetId: number): Promise<boolean>;
  getCoursesForQuestionSet(questionSetId: number): Promise<Course[]>;
  getCoursesByBaseCourseNumber(baseCourseNumber: string): Promise<Course[]>;
  getQuestionSetDisplayOrder(courseId: number, questionSetId: number): Promise<number | undefined>;
  

  
  // Question methods
  getQuestionsByQuestionSet(questionSetId: number): Promise<Question[]>;
  getQuestion(id: number): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestionByOriginalNumber(questionSetId: number, originalNumber: number): Promise<Question | undefined>;
  
  // Question version methods
  getQuestionVersionsByQuestion(questionId: number): Promise<QuestionVersion[]>;
  getQuestionVersion(id: number): Promise<QuestionVersion | undefined>;
  createQuestionVersion(version: InsertQuestionVersion): Promise<QuestionVersion>;
  
  // Static explanation update methods
  findQuestionVersionByDetails(courseName: string, questionSetNumber: number, questionNumber: number, loid: string): Promise<QuestionVersion | undefined>;
  findAllQuestionVersionsByDetails(courseName: string, questionSetNumber: number, questionNumber: number, loid: string): Promise<QuestionVersion[]>;
  updateQuestionVersionStaticExplanation(questionVersionId: number, staticExplanation: string): Promise<QuestionVersion | undefined>;
  batchFindQuestionVersions(criteria: Array<{courseName: string, questionSetNumber: number, questionNumber: number, loid: string}>): Promise<Array<{criteria: any, version: QuestionVersion | undefined}>>;
  
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
  updateQuestionsForRefresh(questionSetId: number, questions: QuestionImport[]): Promise<void>;
  importCourseMaterials(materials: InsertCourseMaterial[]): Promise<{ imported: number; updated: number; skipped: number }>;
  updateQuestionSetCount(questionSetId: number): Promise<void>;
  
  // Course material methods
  getCourseMaterialByLoid(loid: string): Promise<CourseMaterial | undefined>;
  
  // Chatbot log methods
  getChatbotLogs(): Promise<ChatbotLog[]>;
  createChatbotLog(log: InsertChatbotLog): Promise<ChatbotLog>;
  
  // Chatbot feedback methods
  createChatbotFeedback(feedback: InsertChatbotFeedback): Promise<ChatbotFeedback>;
  getChatbotFeedback(): Promise<Array<{
    id: number;
    userId: number | null;
    userName: string;
    userEmail: string;
    messageId: string;
    feedbackType: string;
    feedbackMessage: string | null;
    assistantMessage: string | null;
    createdAt: Date;
  }>>;
  
  // Progress tracking
  getUserCourseProgress(userId: number, courseId: number): Promise<{ correctAnswers: number; totalAnswers: number }>;
  getUserTestProgress(userId: number, testId: number): Promise<{ status: string; score?: string; testRun?: UserTestRun }>;
  
  // Statistics methods for logs page
  getEngagementMetrics(period: 'today' | '7days' | '28days'): Promise<{
    activeUsers: { count: number; rate: number; total: number };
    sessionsPerUser: { average: number; median: number };
    questionsPerUser: { average: number; perSession: number };
    completionRate: number;
    firstAttemptAccuracy: number;
    questionSetsPerUser: number;
    retentionRate: number;
  }>;
  getEngagementMetricsByDateRange(startDate: Date, endDate: Date): Promise<{
    activeUsers: { count: number; rate: number; total: number };
    sessionsPerUser: { average: number; median: number };
    questionsPerUser: { average: number; perSession: number };
    completionRate: number;
    firstAttemptAccuracy: number;
    questionSetsPerUser: number;
    retentionRate: number;
  }>;
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
  
  // Custom usage summary
  getUsageSummary(startDate: Date, endDate: Date): Promise<{
    totalRegisteredUsers: number;
    totalQuestionSetsStarted: number;
    totalUniqueUserSessions: number;
    mostCommonCourse: { courseNumber: string; courseTitle: string; count: number } | null;
    totalQuestionsAnswered: number;
  }>;
  
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
        tableName: 'session',
        createTableIfMissing: true, // Create table if it doesn't exist to prevent session errors
        pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
        ttl: 7 * 24 * 60 * 60, // 7 days TTL to match cookie maxAge
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
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Error fetching user by id:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  }

  async getUserByEmailCI(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users)
        .where(sql`lower(${users.email}) = lower(${email})`);
      return user || undefined;
    } catch (error) {
      console.error('Error fetching user by email (case-insensitive):', error);
      throw error;
    }
  }

  async getUserByCognitoSub(cognitoSub: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.cognitoSub, cognitoSub));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
      return updated || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async upsertUserByEmail(user: { email: string; name?: string; cognitoSub?: string }): Promise<User> {
    try {
      const normalizedEmail = user.email.trim().toLowerCase();
      
      // Use PostgreSQL's ON CONFLICT to handle race conditions atomically
      // This will insert if the email doesn't exist, or update if it does
      const query = sql`
        INSERT INTO users (email, name, cognito_sub)
        VALUES (${normalizedEmail}, ${user.name || 'User'}, ${user.cognitoSub || null})
        ON CONFLICT (email) 
        DO UPDATE SET
          cognito_sub = COALESCE(EXCLUDED.cognito_sub, users.cognito_sub),
          name = CASE 
            WHEN EXCLUDED.cognito_sub IS NOT NULL AND users.cognito_sub IS NULL 
            THEN EXCLUDED.name 
            ELSE users.name 
          END
        RETURNING *
      `;
      
      const result = await db.execute(query);
      const upsertedUser = result.rows[0] as User;
      
      if (!upsertedUser) {
        throw new Error('Failed to upsert user');
      }
      
      return upsertedUser;
    } catch (error) {
      // Check if it's a Cognito sub conflict (different error)
      if (error instanceof Error && error.message.includes('cognito_sub')) {
        // If there's a conflict on cognito_sub, try to find and return the existing user
        const existingUser = await this.getUserByCognitoSub(user.cognitoSub!);
        if (existingUser) {
          return existingUser;
        }
      }
      
      console.error('Error upserting user by email:', error);
      throw error;
    }
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
    // Debug logging for AIC 300 issue
    if (process.env.NODE_ENV === 'development' && (externalId === '6128' || externalId === '8426')) {
      console.log(`\nDEBUG: Looking up AIC 300 external ID: ${externalId}`);
    }
    
    // First check the courses table for direct external ID match
    const [course] = await db.select().from(courses).where(eq(courses.externalId, externalId));
    
    if (course) {
      if (process.env.NODE_ENV === 'development' && course.courseNumber === 'AIC 300') {
        console.log(`  ✓ Found AIC 300 in courses table: ID=${course.id}, AI=${course.isAi}`);
      }
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
      
      if (mappedCourse && process.env.NODE_ENV === 'development' && mappedCourse.courseNumber === 'AIC 300') {
        console.log(`  ✓ Found AIC 300 via mapping: ID=${mappedCourse.id}, AI=${mappedCourse.isAi}`);
      }
      
      return mappedCourse || undefined;
    }
    
    if (process.env.NODE_ENV === 'development' && (externalId === '6128' || externalId === '8426')) {
      console.log(`  ✗ AIC 300 NOT FOUND for external ID: ${externalId}`);
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
    try {
      // Use transaction to ensure all deletions are atomic
      return await db.transaction(async (tx) => {
        // First, get all question sets for this course
        const courseSets = await tx.select().from(questionSets).where(eq(questionSets.courseId, id));
        
        // For each question set, we need to delete all related data
        for (const questionSet of courseSets) {
          // Check if there are any test runs that reference this question set
          const referencingTestRuns = await tx.select().from(userTestRuns).where(eq(userTestRuns.questionSetId, questionSet.id));
          
          // If there are test runs, we need to delete user answers first
          if (referencingTestRuns.length > 0) {
            // Delete user answers for all test runs
            for (const testRun of referencingTestRuns) {
              await tx.delete(userAnswers).where(eq(userAnswers.userTestRunId, testRun.id));
            }
            
            // Delete the test runs
            await tx.delete(userTestRuns).where(eq(userTestRuns.questionSetId, questionSet.id));
          }

          // Delete all question versions for questions in this set
          await tx.execute(sql`
            DELETE FROM question_versions 
            WHERE question_id IN (
              SELECT id FROM questions WHERE question_set_id = ${questionSet.id}
            )
          `);

          // Delete all questions in the set
          await tx.delete(questions).where(eq(questions.questionSetId, questionSet.id));
          
          // Delete chatbot feedback related to this question set
          await tx.delete(chatbotFeedback).where(eq(chatbotFeedback.questionSetId, questionSet.id));
        }
        
        // Delete all question sets for this course
        await tx.delete(questionSets).where(eq(questionSets.courseId, id));
        
        // Delete course external mappings
        await tx.delete(courseExternalMappings).where(eq(courseExternalMappings.courseId, id));
        
        // Delete user course progress
        await tx.delete(userCourseProgress).where(eq(userCourseProgress.courseId, id));
        
        // Delete chatbot feedback related to this course
        await tx.delete(chatbotFeedback).where(eq(chatbotFeedback.courseId, id));
        
        // Finally, delete the course itself
        const result = await tx.delete(courses).where(eq(courses.id, id));
        return (result.rowCount || 0) > 0;
      });
    } catch (error) {
      console.error('Error in deleteCourse:', error);
      throw error;
    }
  }

  async getQuestionSetsByCourse(courseId: number): Promise<QuestionSet[]> {
    // Now using junction table to get question sets for a course
    const results = await db.select({
      questionSet: questionSets,
    })
      .from(courseQuestionSets)
      .innerJoin(questionSets, eq(courseQuestionSets.questionSetId, questionSets.id))
      .where(eq(courseQuestionSets.courseId, courseId))
      .orderBy(asc(courseQuestionSets.displayOrder), asc(questionSets.id));
    
    // Extract question sets from the results
    const qSets = results.map(r => r.questionSet);
    
    // Debug logging for AIC 300 issue
    if (process.env.NODE_ENV === 'development') {
      const course = await this.getCourse(courseId);
      if (course?.courseNumber === 'AIC 300') {
        console.log(`DEBUG: Getting question sets for AIC 300 (course ID: ${courseId})`);
        console.log(`  Found ${qSets.length} question sets:`, qSets.map((qs: QuestionSet) => ({
          id: qs.id,
          title: qs.title,
          questionCount: qs.questionCount
        })));
      }
    }
    
    return qSets;
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

  // Junction table methods for many-to-many relationship
  async createCourseQuestionSetMapping(courseId: number, questionSetId: number, displayOrder: number = 0): Promise<CourseQuestionSet> {
    // Check if mapping already exists
    const existing = await db.select()
      .from(courseQuestionSets)
      .where(and(
        eq(courseQuestionSets.courseId, courseId),
        eq(courseQuestionSets.questionSetId, questionSetId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];  // Return existing mapping instead of creating duplicate
    }
    
    // Create new mapping only if it doesn't exist
    const [mapping] = await db.insert(courseQuestionSets).values({
      courseId,
      questionSetId,
      displayOrder,
    }).returning();
    return mapping;
  }

  async removeCourseQuestionSetMapping(courseId: number, questionSetId: number): Promise<boolean> {
    const result = await db.delete(courseQuestionSets)
      .where(and(
        eq(courseQuestionSets.courseId, courseId),
        eq(courseQuestionSets.questionSetId, questionSetId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async getCoursesForQuestionSet(questionSetId: number): Promise<Course[]> {
    const results = await db.select({
      course: courses,
    })
      .from(courseQuestionSets)
      .innerJoin(courses, eq(courseQuestionSets.courseId, courses.id))
      .where(eq(courseQuestionSets.questionSetId, questionSetId))
      .orderBy(asc(courses.courseNumber));
    
    return results.map(r => r.course);
  }

  async getCoursesByBaseCourseNumber(baseCourseNumber: string): Promise<Course[]> {
    return await db.select()
      .from(courses)
      .where(eq(courses.baseCourseNumber, baseCourseNumber))
      .orderBy(asc(courses.isAi));
  }

  async getQuestionSetDisplayOrder(courseId: number, questionSetId: number): Promise<number | undefined> {
    const [result] = await db.select({
      displayOrder: courseQuestionSets.displayOrder
    })
      .from(courseQuestionSets)
      .where(and(
        eq(courseQuestionSets.courseId, courseId),
        eq(courseQuestionSets.questionSetId, questionSetId)
      ))
      .limit(1);
    
    return result?.displayOrder;
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

  async findQuestionVersionByDetails(courseName: string, questionSetNumber: number, questionNumber: number, loid: string): Promise<QuestionVersion | undefined> {
    const results = await db.select({
      questionVersion: questionVersions,
      questionVersionId: questionVersions.id
    })
      .from(questionVersions)
      .innerJoin(questions, eq(questions.id, questionVersions.questionId))
      .innerJoin(questionSets, eq(questionSets.id, questions.questionSetId))
      .innerJoin(courseQuestionSets, eq(courseQuestionSets.questionSetId, questionSets.id))
      .innerJoin(courses, eq(courses.id, courseQuestionSets.courseId))
      .where(and(
        eq(courses.courseNumber, courseName), // Match on course number, not title
        // Removed displayOrder condition - matching only on course, question number, and LOID
        eq(questions.originalQuestionNumber, questionNumber),
        eq(questions.loid, loid),
        eq(questionVersions.isActive, true)
      ));
    
    // Deduplicate by question version ID (when there are duplicate courses)
    // Return the first unique question version
    const uniqueVersions = new Map<number, typeof results[0]['questionVersion']>();
    results.forEach(r => {
      if (!uniqueVersions.has(r.questionVersionId)) {
        uniqueVersions.set(r.questionVersionId, r.questionVersion);
      }
    });
    
    return uniqueVersions.values().next().value || undefined;
  }

  async updateQuestionVersionStaticExplanation(questionVersionId: number, staticExplanation: string): Promise<QuestionVersion | undefined> {
    const [updated] = await db.update(questionVersions)
      .set({
        staticExplanation,
        isStaticAnswer: true
      })
      .where(eq(questionVersions.id, questionVersionId))
      .returning();
    
    return updated || undefined;
  }

  // Find ALL question versions that match the given criteria
  async findAllQuestionVersionsByDetails(courseName: string, questionSetNumber: number, questionNumber: number, loid: string): Promise<QuestionVersion[]> {
    try {
      console.log(`   Storage function called with: courseName="${courseName}", setNum=${questionSetNumber}, qNum=${questionNumber}, loid="${loid}"`);
      
      // Build where conditions
      const whereConditions = [
        eq(courses.courseNumber, courseName), // Match on course number, not title
        eq(questions.originalQuestionNumber, questionNumber),
        eq(questions.loid, loid),
        eq(questionVersions.isActive, true)
      ];
      
      // Add questionSetNumber filter if provided (not 0)
      if (questionSetNumber > 0) {
        whereConditions.push(eq(courseQuestionSets.displayOrder, questionSetNumber));
      }
      
      const results = await db.select({
        questionVersion: questionVersions
      })
        .from(questionVersions)
        .innerJoin(questions, eq(questions.id, questionVersions.questionId))
        .innerJoin(questionSets, eq(questionSets.id, questions.questionSetId))
        .innerJoin(courseQuestionSets, eq(courseQuestionSets.questionSetId, questionSets.id))
        .innerJoin(courses, eq(courses.id, courseQuestionSets.courseId))
        .where(and(...whereConditions));
      
      console.log(`   Storage query returned ${results.length} raw results before deduplication`);
      
      // Deduplicate by question version ID (when there are duplicate courses)
      const uniqueVersions = new Map<number, typeof results[0]['questionVersion']>();
      results.forEach(r => {
        uniqueVersions.set(r.questionVersion.id, r.questionVersion);
      });
      
      console.log(`   After deduplication: ${uniqueVersions.size} unique question versions`);
      
      return Array.from(uniqueVersions.values());
    } catch (error: any) {
      console.error(`   Storage function error: ${error.message}`);
      console.error(`   Full error:`, error);
      throw error;
    }
  }

  async batchFindQuestionVersions(criteria: Array<{courseName: string, questionSetNumber: number, questionNumber: number, loid: string}>): Promise<Array<{criteria: any, version: QuestionVersion | undefined}>> {
    const results = await Promise.all(
      criteria.map(async (c) => {
        const version = await this.findQuestionVersionByDetails(c.courseName, c.questionSetNumber, c.questionNumber, c.loid);
        return { criteria: c, version };
      })
    );
    
    return results;
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
    try {
      const [newAnswer] = await db.insert(userAnswers).values(answer).returning();
      return newAnswer;
    } catch (error) {
      console.error('Error creating user answer:', error);
      throw error;
    }
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
    // Use transaction to ensure atomic operation
    await db.transaction(async (tx) => {
      try {
        for (const questionData of questionsData) {
          // Check if question already exists within transaction
          const existingQuestions = await tx.select()
            .from(questions)
            .where(and(
              eq(questions.questionSetId, questionSetId),
              eq(questions.originalQuestionNumber, questionData.question_number)
            ))
            .limit(1);
          
          let question = existingQuestions[0];
          
          if (!question) {
            const [newQuestion] = await tx.insert(questions).values({
              questionSetId,
              originalQuestionNumber: questionData.question_number,
              loid: questionData.loid,
            }).returning();
            question = newQuestion;
          }

          // Create question versions
          for (const versionData of questionData.versions) {
            await tx.insert(questionVersions).values({
              questionId: question.id,
              versionNumber: versionData.version_number,
              topicFocus: versionData.topic_focus,
              questionText: versionData.question_text,
              questionType: versionData.question_type || questionData.type || "multiple_choice",
              answerChoices: versionData.answer_choices as any,
              correctAnswer: typeof versionData.correct_answer === 'object'
                ? JSON.stringify(versionData.correct_answer)
                : versionData.correct_answer,
              acceptableAnswers: versionData.acceptable_answers,
              caseSensitive: versionData.case_sensitive,
              allowMultiple: versionData.allow_multiple,
              matchingPairs: versionData.matching_pairs,
              correctOrder: versionData.correct_order,
              blanks: versionData.blanks as any,
              dropZones: versionData.drop_zones as any,
            });
          }
        }
      } catch (error) {
        console.error('Error importing questions:', error);
        throw error; // This will rollback the transaction
      }
    });
  }

  async updateQuestionsForRefresh(questionSetId: number, questionsData: QuestionImport[]): Promise<void> {
    // NEW VERSIONING LOGIC: Create new versions when content changes instead of overwriting
    // This preserves version history and maintains analytics data integrity
    await db.transaction(async (tx) => {
      try {
        // Get all existing questions for this question set
        const existingQuestions = await tx.select()
          .from(questions)
          .where(eq(questions.questionSetId, questionSetId));
        
        // Create a map for easy lookup
        const existingQuestionsMap = new Map(
          existingQuestions.map(q => [q.originalQuestionNumber, q])
        );

        for (const questionData of questionsData) {
          let question = existingQuestionsMap.get(questionData.question_number);
          
          if (!question) {
            // This is a new question in the refresh - add it
            const [newQuestion] = await tx.insert(questions).values({
              questionSetId,
              originalQuestionNumber: questionData.question_number,
              loid: questionData.loid,
            }).returning();
            question = newQuestion;
          } else {
            // Update existing question's LOID if changed
            if (question.loid !== questionData.loid) {
              await tx.update(questions)
                .set({ loid: questionData.loid })
                .where(eq(questions.id, question.id));
            }
          }

          // Process versions with NEW logic - preserve history
          for (const versionData of questionData.versions) {
            // Get current active version to compare against
            const currentActiveVersion = await tx.select()
              .from(questionVersions)
              .where(and(
                eq(questionVersions.questionId, question.id),
                eq(questionVersions.isActive, true)
              ))
              .limit(1);

            const newVersionPayload = {
              topicFocus: versionData.topic_focus,
              questionText: versionData.question_text,
              questionType: versionData.question_type || questionData.type || "multiple_choice",
              answerChoices: versionData.answer_choices as any,
              correctAnswer: typeof versionData.correct_answer === 'object'
                ? JSON.stringify(versionData.correct_answer)
                : versionData.correct_answer,
              acceptableAnswers: versionData.acceptable_answers,
              caseSensitive: versionData.case_sensitive,
              allowMultiple: versionData.allow_multiple,
              matchingPairs: versionData.matching_pairs,
              correctOrder: versionData.correct_order,
              blanks: versionData.blanks as any,
              dropZones: versionData.drop_zones as any,
            };

            if (currentActiveVersion.length === 0) {
              // No active version exists - this is the first version (fresh start scenario)
              await tx.insert(questionVersions).values({
                questionId: question.id,
                versionNumber: 1,
                isActive: true,
                ...newVersionPayload
              });
            } else {
              // Compare content with current active version
              const currentVersion = currentActiveVersion[0];
              const contentChanged = (
                currentVersion.topicFocus !== newVersionPayload.topicFocus ||
                currentVersion.questionText !== newVersionPayload.questionText ||
                currentVersion.questionType !== newVersionPayload.questionType ||
                JSON.stringify(currentVersion.answerChoices) !== JSON.stringify(newVersionPayload.answerChoices) ||
                currentVersion.correctAnswer !== newVersionPayload.correctAnswer ||
                JSON.stringify(currentVersion.acceptableAnswers) !== JSON.stringify(newVersionPayload.acceptableAnswers) ||
                currentVersion.caseSensitive !== newVersionPayload.caseSensitive ||
                currentVersion.allowMultiple !== newVersionPayload.allowMultiple ||
                JSON.stringify(currentVersion.matchingPairs) !== JSON.stringify(newVersionPayload.matchingPairs) ||
                JSON.stringify(currentVersion.correctOrder) !== JSON.stringify(newVersionPayload.correctOrder) ||
                JSON.stringify(currentVersion.blanks) !== JSON.stringify(newVersionPayload.blanks) ||
                JSON.stringify(currentVersion.dropZones) !== JSON.stringify(newVersionPayload.dropZones)
              );

              if (contentChanged) {
                // Content has changed - create new version
                // First, get the highest version number for this question
                const maxVersionResult = await tx.select({
                  maxVersion: sql<number>`COALESCE(MAX(${questionVersions.versionNumber}), 0)`
                })
                .from(questionVersions)
                .where(eq(questionVersions.questionId, question.id));

                const newVersionNumber = (maxVersionResult[0]?.maxVersion || 0) + 1;

                // Deactivate current active version
                await tx.update(questionVersions)
                  .set({ isActive: false })
                  .where(eq(questionVersions.id, currentVersion.id));

                // Create new active version
                await tx.insert(questionVersions).values({
                  questionId: question.id,
                  versionNumber: newVersionNumber,
                  isActive: true,
                  ...newVersionPayload
                });

                if (process.env.NODE_ENV === 'development') {
                  console.log(`Created new version ${newVersionNumber} for question ${question.originalQuestionNumber} due to content changes`);
                }
              }
              // If content hasn't changed, do nothing - keep current active version
            }
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating questions for refresh:', error);
        }
        throw error; // This will rollback the transaction
      }
    });
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
      .innerJoin(courseQuestionSets, eq(questionSets.id, courseQuestionSets.questionSetId))
      .where(and(
        eq(userTestRuns.userId, userId),
        eq(courseQuestionSets.courseId, courseId)
      ));

      const row = result[0];
      return {
        correctAnswers: row?.correctAnswers || 0,
        totalAnswers: row?.totalAnswers || 0,
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error getting user course progress:", error);
      }
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

  async importCourseMaterials(materials: InsertCourseMaterial[]): Promise<{ imported: number; updated: number; skipped: number }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    // Use transaction to ensure atomic operation
    await db.transaction(async (tx) => {
      try {
        // Process materials one by one for upsert logic
        for (const material of materials) {
          // Check if material with this loid already exists
          const existing = await tx.select()
            .from(courseMaterials)
            .where(eq(courseMaterials.loid, material.loid))
            .limit(1);
          
          if (existing.length > 0) {
            // Update existing material only if content has changed
            const existingMaterial = existing[0];
            if (existingMaterial.content !== material.content ||
                existingMaterial.assignment !== material.assignment ||
                existingMaterial.course !== material.course) {
              await tx.update(courseMaterials)
                .set({
                  assignment: material.assignment,
                  course: material.course,
                  content: material.content
                })
                .where(eq(courseMaterials.loid, material.loid));
              updated++;
            } else {
              // Material is identical, skip
              skipped++;
            }
          } else {
            // Insert new material
            await tx.insert(courseMaterials).values(material);
            imported++;
          }
        }
      } catch (error) {
        console.error('Error importing course materials:', error);
        throw error; // This will rollback the transaction
      }
    });
    
    return { imported, updated, skipped };
  }

  async getCourseMaterialByLoid(loid: string): Promise<CourseMaterial | undefined> {
    // First try exact match
    let result = await db.select()
      .from(courseMaterials)
      .where(eq(courseMaterials.loid, loid))
      .limit(1);
    
    // If no exact match, try without leading zeros from input
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
    
    // NEW STRATEGY: Normalize database LOIDs by removing leading zeros AND version suffixes
    // This handles cases where question has "7198" but database has "07198.v3"
    if (!result[0] && loid) {
      // Normalize the input LOID (remove leading zeros)
      const normalizedInputLoid = loid.replace(/^0+/, '') || '0'; // Keep '0' if all zeros
      
      // Query using SQL to normalize database LOIDs
      // Remove leading zeros: REGEXP_REPLACE(loid, '^0+', '', 'g')
      // Remove version suffix: REGEXP_REPLACE(..., '\.[^.]+$', '', 'g')
      result = await db.select()
        .from(courseMaterials)
        .where(sql`
          REGEXP_REPLACE(
            REGEXP_REPLACE(${courseMaterials.loid}, '^0+', '', 'g'),
            '\.[^.]+$', '', 'g'
          ) = ${normalizedInputLoid}
        `)
        .limit(1);
      
      // Log for debugging when this strategy is used
      if (result[0]) {
        console.log(`LOID match found using normalization: Question LOID "${loid}" matched with Course Material LOID "${result[0].loid}"`);
      }
    }
    
    // Final fallback: Try with leading zeros added to input and normalized database LOIDs
    // This handles edge cases where input might be missing leading zeros
    if (!result[0] && loid) {
      // Pad the input with a leading zero if it doesn't have one
      const paddedLoid = loid.match(/^0/) ? loid : '0' + loid;
      const normalizedPaddedLoid = paddedLoid.replace(/^0+/, '') || '0';
      
      result = await db.select()
        .from(courseMaterials)
        .where(sql`
          REGEXP_REPLACE(
            REGEXP_REPLACE(${courseMaterials.loid}, '^0+', '', 'g'),
            '\.[^.]+$', '', 'g'
          ) = ${normalizedPaddedLoid}
        `)
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

  async createChatbotFeedback(feedback: InsertChatbotFeedback & { 
    userName?: string; 
    userEmail?: string; 
    questionText?: string; 
    courseName?: string;
    courseNumber?: string;
    questionSetTitle?: string;
    questionNumber?: number;
    questionSetNumber?: number;
    baseUrl?: string;
  }): Promise<ChatbotFeedback> {
    const [newFeedback] = await db.insert(chatbotFeedback).values(feedback).returning();
    
    // Extract assistant message from conversation if available (used by both Notion and Slack)
    let assistantMessage = null;
    if (feedback.conversation && Array.isArray(feedback.conversation)) {
      const message = feedback.conversation.find((msg: any) => msg.id === feedback.messageId && msg.role === 'assistant');
      if (message) {
        assistantMessage = message.content;
      }
    }
    
    // Prepare feedback data for external services
    const feedbackData = {
      feedbackId: newFeedback.id,
      userName: feedback.userName || 'Anonymous User',
      userEmail: feedback.userEmail || 'N/A',
      feedbackType: feedback.feedbackType as 'positive' | 'negative',
      feedbackMessage: feedback.feedbackMessage || null,
      assistantMessage,
      questionText: feedback.questionText || undefined,
      courseName: feedback.courseName || undefined,
      courseNumber: feedback.courseNumber || undefined,
      questionSetTitle: feedback.questionSetTitle || undefined,
      loid: newFeedback.loid || undefined,
      questionNumber: feedback.questionNumber || undefined,
      questionSetNumber: feedback.questionSetNumber || undefined,
      createdAt: newFeedback.createdAt,
      conversation: feedback.conversation as Array<{id: string, content: string, role: "user" | "assistant"}> | null,
      baseUrl: feedback.baseUrl || 'https://527b9a23-074e-4c21-9784-9dcc9ff1004c-00-4cn4oqxqndqq.janeway.replit.dev',
    };
    
    // Sync to Notion asynchronously - don't wait for it
    if (process.env.NOTION_INTEGRATION_SECRET && process.env.NOTION_PAGE_URL) {
      const { createFeedbackInNotion } = await import('./notion');
      
      // Fire and forget - don't block the main flow
      createFeedbackInNotion(feedbackData).catch(error => {
        console.error('Failed to sync feedback to Notion:', error);
      });
    }
    
    // Send to Slack asynchronously - don't wait for it
    if (process.env.SLACK_WEBHOOK_URL) {
      const { sendFeedbackToSlack } = await import('./slack');
      
      // Fire and forget - don't block the main flow
      sendFeedbackToSlack(feedbackData).catch(error => {
        console.error('Failed to send feedback to Slack:', error);
      });
    }
    
    return newFeedback;
  }

  async getChatbotFeedback(): Promise<Array<{
    id: number;
    userId: number | null;
    userName: string;
    userEmail: string;
    messageId: string;
    feedbackType: string;
    feedbackMessage: string | null;
    assistantMessage: string | null;
    conversation: Array<{id: string, content: string, role: "user" | "assistant"}> | null;
    courseName: string | null;
    questionSetTitle: string | null;
    questionText: string | null;
    loid: string | null;
    createdAt: Date;
  }>> {
    const result = await db.select({
      id: chatbotFeedback.id,
      userId: chatbotFeedback.userId,
      userName: users.name,
      userEmail: users.email,
      messageId: chatbotFeedback.messageId,
      feedbackType: chatbotFeedback.feedbackType,
      feedbackMessage: chatbotFeedback.feedbackMessage,
      conversation: chatbotFeedback.conversation,
      courseId: chatbotFeedback.courseId,
      questionSetId: chatbotFeedback.questionSetId,
      questionId: chatbotFeedback.questionId,
      questionVersionId: chatbotFeedback.questionVersionId,
      loid: chatbotFeedback.loid,
      createdAt: chatbotFeedback.createdAt,
      courseName: courses.courseTitle,
      questionSetTitle: questionSets.title,
      questionText: questionVersions.questionText,
    })
    .from(chatbotFeedback)
    .leftJoin(users, eq(chatbotFeedback.userId, users.id))
    .leftJoin(courses, eq(chatbotFeedback.courseId, courses.id))
    .leftJoin(questionSets, eq(chatbotFeedback.questionSetId, questionSets.id))
    .leftJoin(questionVersions, eq(chatbotFeedback.questionVersionId, questionVersions.id))
    .orderBy(desc(chatbotFeedback.createdAt));

    // Map the result to handle null users and extract assistant message from conversation
    return result.map(item => {
      let assistantMessage = null;
      
      // Try to find the assistant message from the conversation
      if (item.conversation && Array.isArray(item.conversation)) {
        const message = item.conversation.find((msg: any) => msg.id === item.messageId && msg.role === 'assistant');
        if (message) {
          assistantMessage = message.content;
        }
      }
      
      return {
        ...item,
        userName: item.userName || 'Anonymous User',
        userEmail: item.userEmail || 'N/A',
        courseName: item.courseName || null,
        questionSetTitle: item.questionSetTitle || null,
        questionText: item.questionText || null,
        loid: item.loid || null,
        assistantMessage,
        conversation: item.conversation as Array<{id: string, content: string, role: "user" | "assistant"}> | null,
      };
    });
  }

  async getChatbotFeedbackById(feedbackId: number): Promise<{
    id: number;
    userId: number | null;
    userName: string;
    userEmail: string;
    messageId: string;
    feedbackType: string;
    feedbackMessage: string | null;
    conversation: Array<{id: string, content: string, role: "user" | "assistant"}> | null;
    createdAt: Date;
  } | null> {
    const result = await db.select({
      id: chatbotFeedback.id,
      userId: chatbotFeedback.userId,
      userName: users.name,
      userEmail: users.email,
      messageId: chatbotFeedback.messageId,
      feedbackType: chatbotFeedback.feedbackType,
      feedbackMessage: chatbotFeedback.feedbackMessage,
      conversation: chatbotFeedback.conversation,
      createdAt: chatbotFeedback.createdAt,
    })
    .from(chatbotFeedback)
    .leftJoin(users, eq(chatbotFeedback.userId, users.id))
    .where(eq(chatbotFeedback.id, feedbackId))
    .limit(1);

    if (result.length === 0) return null;
    
    const item = result[0];
    return {
      ...item,
      userName: item.userName || 'Anonymous User',
      userEmail: item.userEmail || 'N/A',
      conversation: item.conversation as Array<{id: string, content: string, role: "user" | "assistant"}> | null,
    };
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
    // Use current date/time to ensure we include all of today's data
    const endDate = new Date();
    const dataStartDate = new Date(dateRange.minDate);
    
    console.log('[getQuestionSetUsageByDate] Current time:', new Date().toISOString());
    console.log('[getQuestionSetUsageByDate] Today EST:', now.toISOString());
    console.log('[getQuestionSetUsageByDate] EndDate for query:', endDate.toISOString());
    
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
            DATE_TRUNC('week', NOW() AT TIME ZONE 'America/New_York'),
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
        ORDER BY date_series.week_date ASC
      `);
      query = result.rows as any[];
    } else if (groupBy === 'month') {
      // Generate series of months and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('month', ${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE_TRUNC('month', NOW() AT TIME ZONE 'America/New_York'),
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
        ORDER BY date_series.month_date ASC
      `);
      query = result.rows as any[];
    } else {
      // Generate series of days and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE(${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE(NOW() AT TIME ZONE 'America/New_York'),
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
        ORDER BY date_series.day_date ASC
      `);
      query = result.rows as any[];
      console.log('[getQuestionSetUsageByDate] First 3 dates returned:', query.slice(0, 3).map(r => r.date));
    }
    
    const finalResult = query.map(row => ({
      date: String(row.date),
      count: Number(row.count || 0)
    }));
    console.log('[getQuestionSetUsageByDate] Last date in result:', finalResult[finalResult.length - 1]?.date);
    return finalResult;
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
    // Use current date/time to ensure we include all of today's data
    const endDate = new Date();
    const dataStartDate = new Date(dateRange.minDate);
    
    console.log('[getQuestionsAnsweredByDate] Current time:', new Date().toISOString());
    console.log('[getQuestionsAnsweredByDate] Today EST:', now.toISOString());
    console.log('[getQuestionsAnsweredByDate] EndDate for query:', endDate.toISOString());
    
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
            DATE_TRUNC('week', NOW() AT TIME ZONE 'America/New_York'),
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
        ORDER BY date_series.week_date ASC
      `);
      query = result.rows as any[];
    } else if (groupBy === 'month') {
      // Generate series of months and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('month', ${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE_TRUNC('month', NOW() AT TIME ZONE 'America/New_York'),
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
        ORDER BY date_series.month_date ASC
      `);
      query = result.rows as any[];
    } else {
      // Generate series of days and left join with actual data
      const result = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            DATE(${startDate.toISOString()}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'),
            DATE(NOW() AT TIME ZONE 'America/New_York'),
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
        ORDER BY date_series.day_date ASC
      `);
      query = result.rows as any[];
      console.log('[getQuestionsAnsweredByDate] First 3 dates returned:', query.slice(0, 3).map(r => r.date));
    }
    
    const finalResult = query.map(row => ({
      date: String(row.date),
      count: Number(row.count || 0)
    }));
    console.log('[getQuestionsAnsweredByDate] Last date in result:', finalResult[finalResult.length - 1]?.date);
    return finalResult;
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

  // New engagement metrics methods
  async getEngagementMetrics(period: 'today' | '7days' | '28days'): Promise<{
    activeUsers: { count: number; rate: number; total: number };
    sessionsPerUser: { average: number; median: number };
    questionsPerUser: { average: number; perSession: number };
    completionRate: number;
    firstAttemptAccuracy: number;
    questionSetsPerUser: number;
    retentionRate: number;
  }> {
    const now = new Date();
    const todayStart = getDateAtMidnightEST(now);
    const endDate = now;
    let startDate: Date;
    
    // Set date range based on period
    switch(period) {
      case 'today':
        startDate = todayStart;
        break;
      case '7days':
        startDate = new Date(todayStart);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '28days':
        startDate = new Date(todayStart);
        startDate.setDate(startDate.getDate() - 27);
        break;
    }

    // 1. Active Users (DAU/WAU/MAU) with active rate
    const activeUsersQuery = await db.select({
      userId: userTestRuns.userId,
      sessionCount: sql<number>`COUNT(DISTINCT ${userTestRuns.id})::integer`.as('session_count'),
      totalQuestions: sql<number>`COUNT(DISTINCT ${userAnswers.id})::integer`.as('total_questions')
    })
    .from(userTestRuns)
    .leftJoin(userAnswers, eq(userAnswers.userTestRunId, userTestRuns.id))
    .where(and(
      gte(userTestRuns.startedAt, startDate),
      lte(userTestRuns.startedAt, endDate)
    ))
    .groupBy(userTestRuns.userId);

    // Get total users with access (all registered users)
    const [totalUsersResult] = await db.select({ 
      count: sql<number>`COUNT(*)`.as('count') 
    }).from(users);
    const totalUsers = Number(totalUsersResult?.count || 0);

    const activeUserCount = activeUsersQuery.length;
    const activeRate = totalUsers > 0 ? (activeUserCount / totalUsers) * 100 : 0;

    // 2. Sessions per Active User & Median Session Length
    const sessionCounts = activeUsersQuery.map(u => {
      const count = Number(u.sessionCount) || 0;
      return isNaN(count) || !isFinite(count) ? 0 : count;
    });
    const totalSessionCount = sessionCounts.reduce((a, b) => a + b, 0);
    const avgSessionsPerUser = activeUserCount > 0 && isFinite(totalSessionCount)
      ? totalSessionCount / activeUserCount 
      : 0;

    // Get session durations for median calculation
    // We calculate based on the last answer time if no completedAt is set
    const sessionDurations = await db.select({
      startedAt: userTestRuns.startedAt,
      completedAt: userTestRuns.completedAt,
      lastAnswerTime: sql<Date>`MAX(${userAnswers.answeredAt})`.as('last_answer_time'),
      firstAnswerTime: sql<Date>`MIN(${userAnswers.answeredAt})`.as('first_answer_time')
    })
    .from(userTestRuns)
    .leftJoin(userAnswers, eq(userAnswers.userTestRunId, userTestRuns.id))
    .where(and(
      gte(userTestRuns.startedAt, startDate),
      lte(userTestRuns.startedAt, endDate)
    ))
    .groupBy(userTestRuns.id, userTestRuns.startedAt, userTestRuns.completedAt);

    const durations = sessionDurations
      .map(s => {
        // Use completedAt if available, otherwise use last answer time
        const endTime = s.completedAt || s.lastAnswerTime;
        const startTime = s.startedAt;
        if (!endTime || !startTime) return 0;
        
        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
        const durationSec = durationMs / 1000;
        
        return isNaN(durationSec) || !isFinite(durationSec) || durationSec < 0 ? 0 : durationSec;
      })
      .filter(d => d > 0 && d < 7200) // Filter out invalid durations (> 2 hours)
      .sort((a, b) => a - b);
    
    const medianSessionLength = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 0;

    // 3. Questions per Active User
    const totalQuestionsAnswered = activeUsersQuery.reduce((sum, u) => {
      const questions = Number(u.totalQuestions) || 0;
      return sum + (isNaN(questions) || !isFinite(questions) ? 0 : questions);
    }, 0);
    const avgQuestionsPerUser = activeUserCount > 0 && isFinite(totalQuestionsAnswered)
      ? totalQuestionsAnswered / activeUserCount 
      : 0;
    
    const questionsPerSession = totalSessionCount > 0 && isFinite(totalQuestionsAnswered)
      ? totalQuestionsAnswered / totalSessionCount 
      : 0;

    // 4. Set Completion Rate (within 7 days)
    // Consider a set "completed" if all questions were answered or explicitly marked complete
    const setsWithProgress = await db.execute(sql`
      WITH set_stats AS (
        SELECT 
          utr.id,
          utr.question_set_id,
          utr.started_at,
          utr.completed_at,
          qs.question_count as total_questions,
          COUNT(DISTINCT ua.question_version_id) as answered_questions,
          MAX(ua.answered_at) as last_answer_time
        FROM user_test_runs utr
        INNER JOIN question_sets qs ON utr.question_set_id = qs.id
        LEFT JOIN user_answers ua ON ua.user_test_run_id = utr.id
        WHERE utr.started_at >= ${startDate}
          AND utr.started_at <= ${endDate}
        GROUP BY utr.id, utr.question_set_id, utr.started_at, utr.completed_at, qs.question_count
      )
      SELECT * FROM set_stats
    `);

    const setsStarted = setsWithProgress.rows.filter((s: any) => Number(s.answered_questions) > 0);
    
    const setsCompleted = setsStarted.filter((s: any) => {
      // Consider completed if:
      // 1. Has completedAt timestamp within 7 days
      // 2. OR answered most questions (>= 80%) within 7 days
      
      const isMarkedComplete = s.completed_at && 
        (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60 * 24) <= 7;
      
      const answeredMost = Number(s.answered_questions) >= Number(s.total_questions) * 0.8;
      const lastAnswerWithin7Days = s.last_answer_time && 
        (new Date(s.last_answer_time).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60 * 24) <= 7;
      
      return isMarkedComplete || (answeredMost && lastAnswerWithin7Days);
    });

    const completionRate = setsStarted.length > 0 
      ? (setsCompleted.length / setsStarted.length) * 100 
      : 0;

    // 5. First-Attempt Accuracy
    const firstAttempts = await db.select({
      questionVersionId: userAnswers.questionVersionId,
      isCorrect: userAnswers.isCorrect,
      userId: userTestRuns.userId,
      answeredAt: userAnswers.answeredAt
    })
    .from(userAnswers)
    .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
    .where(and(
      gte(userAnswers.answeredAt, startDate),
      lte(userAnswers.answeredAt, endDate)
    ))
    .orderBy(asc(userAnswers.answeredAt));

    // Group by user and question to find first attempts
    const firstAttemptMap = new Map<string, boolean>();
    firstAttempts.forEach(attempt => {
      const key = `${attempt.userId}-${attempt.questionVersionId}`;
      if (!firstAttemptMap.has(key)) {
        firstAttemptMap.set(key, attempt.isCorrect);
      }
    });

    const firstAttemptValues = Array.from(firstAttemptMap.values());
    const correctFirstAttempts = firstAttemptValues.filter(v => v).length;
    const firstAttemptAccuracy = firstAttemptValues.length > 0
      ? (correctFirstAttempts / firstAttemptValues.length) * 100
      : 0;

    // 6. Question Sets per Active User
    // Calculate the average number of unique question sets accessed by active users
    const userQuestionSets = await db.select({
      userId: userTestRuns.userId,
      uniqueQuestionSets: sql<number>`COUNT(DISTINCT ${userTestRuns.questionSetId})`.as('unique_question_sets')
    })
    .from(userTestRuns)
    .where(and(
      gte(userTestRuns.startedAt, startDate),
      lte(userTestRuns.startedAt, endDate)
    ))
    .groupBy(userTestRuns.userId);

    const totalUniqueQuestionSets = userQuestionSets.reduce((sum, u) => {
      const sets = Number(u.uniqueQuestionSets) || 0;
      return sum + (isNaN(sets) || !isFinite(sets) ? 0 : sets);
    }, 0);

    const questionSetsPerUser = activeUserCount > 0 && isFinite(totalUniqueQuestionSets)
      ? totalUniqueQuestionSets / activeUserCount
      : 0;

    // 7. 7-Day Retention Rate
    let retentionRate = 0;
    if (period === '7days' || period === '28days') {
      // Users active in current week
      const currentWeekStart = new Date(todayStart);
      currentWeekStart.setDate(currentWeekStart.getDate() - 6);
      
      const currentWeekUsers = await db.selectDistinct({ userId: userTestRuns.userId })
        .from(userTestRuns)
        .where(and(
          gte(userTestRuns.startedAt, currentWeekStart),
          lte(userTestRuns.startedAt, endDate)
        ));

      // Users active in previous week
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(currentWeekStart);
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

      const prevWeekUsers = await db.selectDistinct({ userId: userTestRuns.userId })
        .from(userTestRuns)
        .where(and(
          gte(userTestRuns.startedAt, prevWeekStart),
          lte(userTestRuns.startedAt, prevWeekEnd)
        ));

      const currentWeekUserIds = new Set(currentWeekUsers.map(u => u.userId));
      const prevWeekUserIds = prevWeekUsers.map(u => u.userId);
      const retainedUsers = prevWeekUserIds.filter(id => currentWeekUserIds.has(id));
      
      retentionRate = prevWeekUserIds.length > 0
        ? (retainedUsers.length / prevWeekUserIds.length) * 100
        : 0;
    }

    // Ensure all values are valid numbers
    const sanitizeNumber = (value: number): number => {
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        return 0;
      }
      // Prevent extremely large numbers
      if (Math.abs(value) > 1e10) {
        return 0;
      }
      // Round to 2 decimal places for cleaner display
      return Math.round(value * 100) / 100;
    };

    // Log metrics for debugging
    console.log(`[Engagement Metrics] Period: ${period}`);
    console.log(`[Engagement Metrics] Active Users: ${activeUserCount}/${totalUsers} (${activeRate.toFixed(1)}%)`);
    console.log(`[Engagement Metrics] Session Durations: ${durations.length} valid sessions, median: ${medianSessionLength}s`);
    console.log(`[Engagement Metrics] Completion Rate: ${setsCompleted.length}/${setsStarted.length} (${completionRate.toFixed(1)}%)`);
    console.log(`[Engagement Metrics] First Attempt Accuracy: ${correctFirstAttempts}/${firstAttemptValues.length} (${firstAttemptAccuracy.toFixed(1)}%)`);
    console.log(`[Engagement Metrics] Question Sets Per User: ${questionSetsPerUser.toFixed(1)} sets/user`);

    return {
      activeUsers: {
        count: sanitizeNumber(activeUserCount),
        rate: sanitizeNumber(activeRate),
        total: sanitizeNumber(totalUsers)
      },
      sessionsPerUser: {
        average: sanitizeNumber(avgSessionsPerUser),
        median: sanitizeNumber(medianSessionLength)
      },
      questionsPerUser: {
        average: sanitizeNumber(avgQuestionsPerUser),
        perSession: sanitizeNumber(questionsPerSession)
      },
      completionRate: sanitizeNumber(completionRate),
      firstAttemptAccuracy: sanitizeNumber(firstAttemptAccuracy),
      questionSetsPerUser: sanitizeNumber(questionSetsPerUser),
      retentionRate: sanitizeNumber(retentionRate)
    };
  }

  async getEngagementMetricsByDateRange(startDate: Date, endDate: Date): Promise<{
    activeUsers: { count: number; rate: number; total: number };
    sessionsPerUser: { average: number; median: number };
    questionsPerUser: { average: number; perSession: number };
    completionRate: number;
    firstAttemptAccuracy: number;
    questionSetsPerUser: number;
    retentionRate: number;
  }> {
    // Ensure dates are at the correct time boundaries
    const startDateClean = new Date(startDate);
    startDateClean.setHours(0, 0, 0, 0);
    
    const endDateClean = new Date(endDate);
    endDateClean.setHours(23, 59, 59, 999);

    // 1. Active Users (DAU/WAU/MAU) with active rate
    const activeUsersQuery = await db.select({
      userId: userTestRuns.userId,
      sessionCount: sql<number>`COUNT(DISTINCT ${userTestRuns.id})::integer`.as('session_count'),
      totalQuestions: sql<number>`COUNT(DISTINCT ${userAnswers.id})::integer`.as('total_questions')
    })
    .from(userTestRuns)
    .leftJoin(userAnswers, eq(userAnswers.userTestRunId, userTestRuns.id))
    .where(and(
      gte(userTestRuns.startedAt, startDateClean),
      lte(userTestRuns.startedAt, endDateClean)
    ))
    .groupBy(userTestRuns.userId);

    // Get total users with access (all registered users)
    const [totalUsersResult] = await db.select({ 
      count: sql<number>`COUNT(*)`.as('count') 
    }).from(users);
    const totalUsers = Number(totalUsersResult?.count || 0);

    const activeUserCount = activeUsersQuery.length;
    const activeRate = totalUsers > 0 ? (activeUserCount / totalUsers) * 100 : 0;

    // 2. Sessions per Active User & Median Session Length
    const sessionCounts = activeUsersQuery.map(u => {
      const count = Number(u.sessionCount) || 0;
      return isNaN(count) || !isFinite(count) ? 0 : count;
    });
    const totalSessionCount = sessionCounts.reduce((a, b) => a + b, 0);
    const avgSessionsPerUser = activeUserCount > 0 && isFinite(totalSessionCount)
      ? totalSessionCount / activeUserCount 
      : 0;

    // Get session durations for median calculation
    const sessionDurations = await db.select({
      startedAt: userTestRuns.startedAt,
      completedAt: userTestRuns.completedAt,
      lastAnswerTime: sql<Date>`MAX(${userAnswers.answeredAt})`.as('last_answer_time'),
      firstAnswerTime: sql<Date>`MIN(${userAnswers.answeredAt})`.as('first_answer_time')
    })
    .from(userTestRuns)
    .leftJoin(userAnswers, eq(userAnswers.userTestRunId, userTestRuns.id))
    .where(and(
      gte(userTestRuns.startedAt, startDateClean),
      lte(userTestRuns.startedAt, endDateClean)
    ))
    .groupBy(userTestRuns.id, userTestRuns.startedAt, userTestRuns.completedAt);

    const durations = sessionDurations
      .map(s => {
        const endTime = s.completedAt || s.lastAnswerTime;
        const startTime = s.startedAt;
        if (!endTime || !startTime) return 0;
        
        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
        const durationSec = durationMs / 1000;
        
        return isNaN(durationSec) || !isFinite(durationSec) || durationSec < 0 ? 0 : durationSec;
      })
      .filter(d => d > 0 && d < 7200) // Filter out invalid durations (> 2 hours)
      .sort((a, b) => a - b);
    
    const medianSessionLength = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 0;

    // 3. Questions per Active User
    const totalQuestionsAnswered = activeUsersQuery.reduce((sum, u) => {
      const questions = Number(u.totalQuestions) || 0;
      return sum + (isNaN(questions) || !isFinite(questions) ? 0 : questions);
    }, 0);
    const avgQuestionsPerUser = activeUserCount > 0 && isFinite(totalQuestionsAnswered)
      ? totalQuestionsAnswered / activeUserCount 
      : 0;
    
    const questionsPerSession = totalSessionCount > 0 && isFinite(totalQuestionsAnswered)
      ? totalQuestionsAnswered / totalSessionCount 
      : 0;

    // 4. Set Completion Rate
    const setsWithProgress = await db.execute(sql`
      WITH set_stats AS (
        SELECT 
          utr.id,
          utr.question_set_id,
          utr.started_at,
          utr.completed_at,
          qs.question_count as total_questions,
          COUNT(DISTINCT ua.question_version_id) as answered_questions,
          MAX(ua.answered_at) as last_answer_time
        FROM user_test_runs utr
        INNER JOIN question_sets qs ON utr.question_set_id = qs.id
        LEFT JOIN user_answers ua ON ua.user_test_run_id = utr.id
        WHERE utr.started_at >= ${startDateClean}
          AND utr.started_at <= ${endDateClean}
        GROUP BY utr.id, utr.question_set_id, utr.started_at, utr.completed_at, qs.question_count
      )
      SELECT * FROM set_stats
    `);

    const setsStarted = setsWithProgress.rows.filter((s: any) => Number(s.answered_questions) > 0);
    
    const setsCompleted = setsStarted.filter((s: any) => {
      const isMarkedComplete = s.completed_at && 
        (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60 * 24) <= 7;
      
      const answeredMost = Number(s.answered_questions) >= Number(s.total_questions) * 0.8;
      const lastAnswerWithin7Days = s.last_answer_time && 
        (new Date(s.last_answer_time).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60 * 24) <= 7;
      
      return isMarkedComplete || (answeredMost && lastAnswerWithin7Days);
    });

    const completionRate = setsStarted.length > 0 
      ? (setsCompleted.length / setsStarted.length) * 100 
      : 0;

    // 5. First-Attempt Accuracy
    const firstAttempts = await db.select({
      questionVersionId: userAnswers.questionVersionId,
      isCorrect: userAnswers.isCorrect,
      userId: userTestRuns.userId,
      answeredAt: userAnswers.answeredAt
    })
    .from(userAnswers)
    .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
    .where(and(
      gte(userAnswers.answeredAt, startDateClean),
      lte(userAnswers.answeredAt, endDateClean)
    ))
    .orderBy(asc(userAnswers.answeredAt));

    // Group by user and question to find first attempts
    const firstAttemptMap = new Map<string, boolean>();
    firstAttempts.forEach(attempt => {
      const key = `${attempt.userId}-${attempt.questionVersionId}`;
      if (!firstAttemptMap.has(key)) {
        firstAttemptMap.set(key, attempt.isCorrect);
      }
    });

    const firstAttemptValues = Array.from(firstAttemptMap.values());
    const correctFirstAttempts = firstAttemptValues.filter(v => v).length;
    const firstAttemptAccuracy = firstAttemptValues.length > 0
      ? (correctFirstAttempts / firstAttemptValues.length) * 100
      : 0;

    // 6. Question Sets per Active User
    const userQuestionSets = await db.select({
      userId: userTestRuns.userId,
      uniqueQuestionSets: sql<number>`COUNT(DISTINCT ${userTestRuns.questionSetId})`.as('unique_question_sets')
    })
    .from(userTestRuns)
    .where(and(
      gte(userTestRuns.startedAt, startDateClean),
      lte(userTestRuns.startedAt, endDateClean)
    ))
    .groupBy(userTestRuns.userId);

    const totalUniqueQuestionSets = userQuestionSets.reduce((sum, u) => {
      const sets = Number(u.uniqueQuestionSets) || 0;
      return sum + (isNaN(sets) || !isFinite(sets) ? 0 : sets);
    }, 0);

    const questionSetsPerUser = activeUserCount > 0 && isFinite(totalUniqueQuestionSets)
      ? totalUniqueQuestionSets / activeUserCount
      : 0;

    // 7. 7-Day Retention Rate (if date range is at least 7 days)
    let retentionRate = 0;
    const daysDiff = (endDateClean.getTime() - startDateClean.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff >= 7) {
      // Calculate midpoint to split the range
      const midDate = new Date(startDateClean);
      midDate.setDate(midDate.getDate() + Math.floor(daysDiff / 2));
      
      // Users active in second half
      const secondHalfUsers = await db.selectDistinct({ userId: userTestRuns.userId })
        .from(userTestRuns)
        .where(and(
          gte(userTestRuns.startedAt, midDate),
          lte(userTestRuns.startedAt, endDateClean)
        ));

      // Users active in first half
      const firstHalfUsers = await db.selectDistinct({ userId: userTestRuns.userId })
        .from(userTestRuns)
        .where(and(
          gte(userTestRuns.startedAt, startDateClean),
          lt(userTestRuns.startedAt, midDate)
        ));

      const secondHalfUserIds = new Set(secondHalfUsers.map(u => u.userId));
      const firstHalfUserIds = firstHalfUsers.map(u => u.userId);
      const retainedUsers = firstHalfUserIds.filter(id => secondHalfUserIds.has(id));
      
      retentionRate = firstHalfUserIds.length > 0
        ? (retainedUsers.length / firstHalfUserIds.length) * 100
        : 0;
    }

    // Ensure all values are valid numbers
    const sanitizeNumber = (value: number): number => {
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        return 0;
      }
      if (Math.abs(value) > 1e10) {
        return 0;
      }
      return Math.round(value * 100) / 100;
    };

    // Log metrics for debugging
    console.log(`[Engagement Metrics] Date Range: ${startDateClean.toISOString()} to ${endDateClean.toISOString()}`);
    console.log(`[Engagement Metrics] Active Users: ${activeUserCount}/${totalUsers} (${activeRate.toFixed(1)}%)`);
    console.log(`[Engagement Metrics] Session Durations: ${durations.length} valid sessions, median: ${medianSessionLength}s`);
    console.log(`[Engagement Metrics] Completion Rate: ${setsCompleted.length}/${setsStarted.length} (${completionRate.toFixed(1)}%)`);
    console.log(`[Engagement Metrics] First Attempt Accuracy: ${correctFirstAttempts}/${firstAttemptValues.length} (${firstAttemptAccuracy.toFixed(1)}%)`);
    console.log(`[Engagement Metrics] Question Sets Per User: ${questionSetsPerUser.toFixed(1)} sets/user`);

    return {
      activeUsers: {
        count: sanitizeNumber(activeUserCount),
        rate: sanitizeNumber(activeRate),
        total: sanitizeNumber(totalUsers)
      },
      sessionsPerUser: {
        average: sanitizeNumber(avgSessionsPerUser),
        median: sanitizeNumber(medianSessionLength)
      },
      questionsPerUser: {
        average: sanitizeNumber(avgQuestionsPerUser),
        perSession: sanitizeNumber(questionsPerSession)
      },
      completionRate: sanitizeNumber(completionRate),
      firstAttemptAccuracy: sanitizeNumber(firstAttemptAccuracy),
      questionSetsPerUser: sanitizeNumber(questionSetsPerUser),
      retentionRate: sanitizeNumber(retentionRate)
    };
  }

  async getUsageSummary(startDate: Date, endDate: Date): Promise<{
    totalRegisteredUsers: number;
    totalQuestionSetsStarted: number;
    totalUniqueUserSessions: number;
    mostCommonCourse: { courseNumber: string; courseTitle: string; count: number } | null;
    totalQuestionsAnswered: number;
  }> {
    // Ensure dates are at the correct time boundaries
    const startDateClean = new Date(startDate);
    const endDateClean = new Date(endDate);
    
    // 1. Total registered users in the date range
    const registeredUsersQuery = await db.select({
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(users)
    .where(and(
      gte(users.createdAt, startDateClean),
      lte(users.createdAt, endDateClean)
    ));
    const totalRegisteredUsers = Number(registeredUsersQuery[0]?.count || 0);
    
    // 2. Total question sets started (test runs) in the date range
    const questionSetsStartedQuery = await db.select({
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(userTestRuns)
    .where(and(
      gte(userTestRuns.startedAt, startDateClean),
      lte(userTestRuns.startedAt, endDateClean)
    ));
    const totalQuestionSetsStarted = Number(questionSetsStartedQuery[0]?.count || 0);
    
    // 3. Total unique user sessions (unique users who had test runs in the date range)
    const uniqueUserSessionsQuery = await db.select({
      count: sql<number>`COUNT(DISTINCT ${userTestRuns.userId})`.as('count')
    })
    .from(userTestRuns)
    .where(and(
      gte(userTestRuns.startedAt, startDateClean),
      lte(userTestRuns.startedAt, endDateClean)
    ));
    const totalUniqueUserSessions = Number(uniqueUserSessionsQuery[0]?.count || 0);
    
    // 4. Most common course (by question set usage)
    const mostCommonCourseQuery = await db.select({
      courseNumber: courses.courseNumber,
      courseTitle: courses.courseTitle,
      count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})`.as('count')
    })
    .from(userTestRuns)
    .innerJoin(questionSets, eq(questionSets.id, userTestRuns.questionSetId))
    .innerJoin(courses, eq(courses.id, questionSets.courseId))
    .where(and(
      gte(userTestRuns.startedAt, startDateClean),
      lte(userTestRuns.startedAt, endDateClean)
    ))
    .groupBy(courses.id, courses.courseNumber, courses.courseTitle)
    .orderBy(desc(sql`COUNT(DISTINCT ${userTestRuns.id})`))
    .limit(1);
    
    const mostCommonCourse = mostCommonCourseQuery[0] 
      ? {
          courseNumber: mostCommonCourseQuery[0].courseNumber,
          courseTitle: mostCommonCourseQuery[0].courseTitle,
          count: Number(mostCommonCourseQuery[0].count)
        }
      : null;
    
    // 5. Total questions answered in the date range
    const questionsAnsweredQuery = await db.select({
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(userAnswers)
    .where(and(
      gte(userAnswers.answeredAt, startDateClean),
      lte(userAnswers.answeredAt, endDateClean)
    ));
    const totalQuestionsAnswered = Number(questionsAnsweredQuery[0]?.count || 0);
    
    console.log(`[Usage Summary] Date Range: ${startDateClean.toISOString()} to ${endDateClean.toISOString()}`);
    console.log(`[Usage Summary] Registered Users: ${totalRegisteredUsers}`);
    console.log(`[Usage Summary] Question Sets Started: ${totalQuestionSetsStarted}`);
    console.log(`[Usage Summary] Unique User Sessions: ${totalUniqueUserSessions}`);
    console.log(`[Usage Summary] Most Common Course: ${mostCommonCourse ? mostCommonCourse.courseNumber : 'None'}`);
    console.log(`[Usage Summary] Questions Answered: ${totalQuestionsAnswered}`);
    
    return {
      totalRegisteredUsers,
      totalQuestionSetsStarted,
      totalUniqueUserSessions,
      mostCommonCourse,
      totalQuestionsAnswered
    };
  }
}

export const storage = new DatabaseStorage();
