import {
  users, courses, questionSets, practiceTests, questions, questionVersions, 
  userTestRuns, userAnswers, aiSettings,
  type User, type InsertUser, type Course, type InsertCourse,
  type QuestionSet, type InsertQuestionSet, type PracticeTest, type InsertPracticeTest, 
  type Question, type InsertQuestion, type QuestionVersion, type InsertQuestionVersion, 
  type UserTestRun, type InsertUserTestRun, type UserAnswer, type InsertUserAnswer, 
  type AiSettings, type InsertAiSettings, type QuestionImport
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Course methods
  getAllCourses(): Promise<Course[]>;
  getCourse(id: number): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: number): Promise<boolean>;
  
  // Question set methods
  getQuestionSetsByCourse(courseId: number): Promise<QuestionSet[]>;
  getQuestionSet(id: number): Promise<QuestionSet | undefined>;
  createQuestionSet(questionSet: InsertQuestionSet): Promise<QuestionSet>;
  updateQuestionSet(id: number, questionSet: Partial<InsertQuestionSet>): Promise<QuestionSet | undefined>;
  deleteQuestionSet(id: number): Promise<boolean>;
  
  // Practice test methods
  getPracticeTestsByCourse(courseId: number): Promise<PracticeTest[]>;
  getPracticeTest(id: number): Promise<PracticeTest | undefined>;
  createPracticeTest(test: InsertPracticeTest): Promise<PracticeTest>;
  
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
  
  // AI settings methods
  getAiSettings(): Promise<AiSettings | undefined>;
  updateAiSettings(settings: Partial<InsertAiSettings>): Promise<AiSettings>;
  
  // Bulk import methods
  importQuestions(questionSetId: number, questions: QuestionImport[]): Promise<void>;
  
  // Progress tracking
  getUserCourseProgress(userId: number, courseId: number): Promise<{ correctAnswers: number; totalAnswers: number }>;
  getUserTestProgress(userId: number, testId: number): Promise<{ status: string; score?: string; testRun?: UserTestRun }>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(asc(courses.title));
  }

  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
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
    return result.rowCount! > 0;
  }

  async getQuestionSetsByCourse(courseId: number): Promise<QuestionSet[]> {
    return await db.select().from(questionSets).where(eq(questionSets.courseId, courseId));
  }

  async getQuestionSet(id: number): Promise<QuestionSet | undefined> {
    const [questionSet] = await db.select().from(questionSets).where(eq(questionSets.id, id));
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
    const result = await db.delete(questionSets).where(eq(questionSets.id, id));
    return result.rowCount! > 0;
  }

  async getPracticeTestsByCourse(courseId: number): Promise<PracticeTest[]> {
    return await db.select().from(practiceTests).where(eq(practiceTests.courseId, courseId));
  }

  async getPracticeTest(id: number): Promise<PracticeTest | undefined> {
    const [test] = await db.select().from(practiceTests).where(eq(practiceTests.id, id));
    return test || undefined;
  }

  async createPracticeTest(test: InsertPracticeTest): Promise<PracticeTest> {
    const [newTest] = await db.insert(practiceTests).values(test).returning();
    return newTest;
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
    const [newVersion] = await db.insert(questionVersions).values(version).returning();
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
    const [newTestRun] = await db.insert(userTestRuns).values(testRun).returning();
    return newTestRun;
  }

  async updateUserTestRun(id: number, testRun: Partial<InsertUserTestRun>): Promise<UserTestRun | undefined> {
    const [updated] = await db.update(userTestRuns).set(testRun).where(eq(userTestRuns.id, id)).returning();
    return updated || undefined;
  }

  async getUserAnswersByTestRun(testRunId: number): Promise<UserAnswer[]> {
    return await db.select().from(userAnswers).where(eq(userAnswers.userTestRunId, testRunId));
  }

  async createUserAnswer(answer: InsertUserAnswer): Promise<UserAnswer> {
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

  async importQuestions(questionSetId: number, questionsData: QuestionImport[]): Promise<void> {
    for (const questionData of questionsData) {
      // Check if question already exists
      let question = await this.getQuestionByOriginalNumber(questionSetId, questionData.originalQuestionNumber);
      
      if (!question) {
        question = await this.createQuestion({
          questionSetId,
          originalQuestionNumber: questionData.originalQuestionNumber,
          loid: questionData.LOID,
        });
      }

      // Create question versions
      for (const versionData of questionData.versions) {
        await this.createQuestionVersion({
          questionId: question.id,
          versionNumber: versionData.versionNumber,
          topicFocus: versionData.topicFocus,
          questionText: versionData.questionText,
          answerChoices: Array.isArray(versionData.answerChoices) ? versionData.answerChoices : Object.values(versionData.answerChoices) as string[],
          correctAnswer: versionData.correctAnswer,
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
      .innerJoin(practiceTests, eq(userTestRuns.practiceTestId, practiceTests.id))
      .where(and(
        eq(userTestRuns.userId, userId),
        eq(practiceTests.courseId, courseId)
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

  async getUserTestProgress(userId: number, testId: number): Promise<{ status: string; score?: string; testRun?: UserTestRun }> {
    const testRuns = await db.select().from(userTestRuns)
      .where(and(eq(userTestRuns.userId, userId), eq(userTestRuns.practiceTestId, testId)))
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
      return {
        status: "In Progress",
        score: `${answers.length}/85 questions`,
        testRun: latestRun,
      };
    }
  }
}

export const storage = new DatabaseStorage();
