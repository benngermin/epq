import { db } from "../db";
import { 
  questions, questionVersions, userAnswers, userTestRuns, 
  practiceTests, questionSets, courses 
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

// Batch fetch questions with their versions to reduce N+1 queries
export async function batchFetchQuestionsWithVersionsOptimized(questionSetId: number) {
  // Single query to get all questions with their versions using JOIN
  const result = await db
    .select({
      question: questions,
      version: questionVersions,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .where(eq(questions.questionSetId, questionSetId))
    .orderBy(questions.originalQuestionNumber);

  // Group versions by question
  const questionsMap = new Map<number, any>();
  
  for (const row of result) {
    const questionId = row.question.id;
    
    if (!questionsMap.has(questionId)) {
      questionsMap.set(questionId, {
        ...row.question,
        versions: []
      });
    }
    
    questionsMap.get(questionId).versions.push(row.version);
  }
  
  return Array.from(questionsMap.values());
}

// Batch fetch user progress for multiple test runs
export async function batchFetchUserProgress(userId: number, courseId: number) {
  // Get all practice tests and test runs in a single query
  const result = await db
    .select({
      practiceTest: practiceTests,
      testRun: userTestRuns,
      answerCount: sql<number>`count(distinct ${userAnswers.id})`,
    })
    .from(practiceTests)
    .leftJoin(
      userTestRuns,
      and(
        eq(userTestRuns.practiceTestId, practiceTests.id),
        eq(userTestRuns.userId, userId)
      )
    )
    .leftJoin(
      userAnswers,
      eq(userAnswers.userTestRunId, userTestRuns.id)
    )
    .where(eq(practiceTests.courseId, courseId))
    .groupBy(practiceTests.id, userTestRuns.id);

  return result;
}

// Optimized course data fetching with counts
export async function fetchCourseWithCounts(courseId: number) {
  const [courseData] = await db
    .select({
      course: courses,
      questionSetCount: sql<number>`count(distinct ${questionSets.id})`,
      practiceTestCount: sql<number>`count(distinct ${practiceTests.id})`,
    })
    .from(courses)
    .leftJoin(questionSets, eq(questionSets.courseId, courses.id))
    .leftJoin(practiceTests, eq(practiceTests.courseId, courses.id))
    .where(eq(courses.id, courseId))
    .groupBy(courses.id);

  return courseData;
}

// Batch fetch question counts for multiple question sets
export async function batchFetchQuestionCounts(questionSetIds: number[]) {
  if (questionSetIds.length === 0) return new Map<number, number>();

  const counts = await db
    .select({
      questionSetId: questions.questionSetId,
      count: sql<number>`count(*)`,
    })
    .from(questions)
    .where(inArray(questions.questionSetId, questionSetIds))
    .groupBy(questions.questionSetId);

  return new Map(counts.map(c => [c.questionSetId, c.count]));
}

// Prefetch related data for question set practice
export async function prefetchQuestionSetData(questionSetId: number) {
  // Execute all queries in parallel
  const [questionSet, questionsWithVersions, course, courseQuestionSets] = await Promise.all([
    db.select().from(questionSets).where(eq(questionSets.id, questionSetId)).then(r => r[0]),
    batchFetchQuestionsWithVersionsOptimized(questionSetId),
    db.select().from(courses)
      .innerJoin(questionSets, eq(questionSets.courseId, courses.id))
      .where(eq(questionSets.id, questionSetId))
      .then(r => r[0]?.courses),
    db.select().from(questionSets)
      .where(eq(questionSets.courseId, sql`(SELECT course_id FROM question_sets WHERE id = ${questionSetId})`))
      .orderBy(questionSets.title),
  ]);

  return {
    questionSet,
    questions: questionsWithVersions,
    course,
    courseQuestionSets,
  };
}