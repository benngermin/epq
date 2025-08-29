import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userTestRuns,
  userAnswers,
  questions,
  questionVersions,
  chatbotLogs,
  chatbotFeedback,
  courses,
  questionSets,
  dailyActivitySummary
} from '@shared/schema';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface UserEngagementMetrics {
  totalActiveUsers: number;
  dailyActiveUsers: { date: string; count: number }[];
  averageQuestionsPerUser: number;
  userDistribution: { category: string; count: number }[];
  sessionFrequency: { userId: number; userName: string; sessionCount: number }[];
  averageSessionDuration: number;
}

export interface QuestionPerformanceMetrics {
  totalQuestionsAnswered: number;
  completionRate: number;
  questionsPerSession: number;
  topFailedQuestions: {
    questionId: number;
    questionText: string;
    attempts: number;
    failureRate: number;
  }[];
  topPassedQuestions: {
    questionId: number;
    questionText: string;
    attempts: number;
    successRate: number;
  }[];
  accuracyByType: { type: string; accuracy: number; total: number }[];
  averageTimeByType: { type: string; averageTime: number }[];
}

export interface AIAssistantMetrics {
  totalMessages: number;
  uniqueUsers: number;
  averageMessagesPerConversation: number;
  peakUsageHours: { hour: number; count: number }[];
  topDiscussedQuestions: { questionId: number; count: number; questionText: string }[];
}

export interface FeedbackMetrics {
  totalFeedback: number;
  positiveRatio: number;
  negativeRatio: number;
  feedbackByType: { type: string; positive: number; negative: number }[];
  topIssues: { issue: string; count: number }[];
}

export interface LearningProgressMetrics {
  courseCompletionRates: { courseId: number; courseName: string; completionRate: number }[];
  averageScoreProgression: { date: string; averageScore: number }[];
  retryPatterns: { questionId: number; averageRetries: number; questionText: string }[];
  performanceByCourse: { courseId: number; courseName: string; averageScore: number }[];
  timeSpentPerCourse: { courseId: number; courseName: string; totalTime: number }[];
}

export class UsageMetricsAggregator {
  constructor(private dateRange: DateRange) {}

  async getUserEngagementMetrics(): Promise<UserEngagementMetrics> {
    // Total active users
    const activeUsersResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${userTestRuns.userId})` })
      .from(userAnswers)
      .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      );

    const totalActiveUsers = Number(activeUsersResult[0]?.count || 0);

    // Daily active users
    const dailyActiveUsersResult = await db
      .select({
        date: sql<string>`DATE(${userAnswers.answeredAt})`,
        count: sql<number>`COUNT(DISTINCT ${userTestRuns.userId})`
      })
      .from(userAnswers)
      .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(sql`DATE(${userAnswers.answeredAt})`)
      .orderBy(sql`DATE(${userAnswers.answeredAt})`);

    // Average questions per user
    const questionsPerUserResult = await db
      .select({
        userId: userTestRuns.userId,
        questionCount: sql<number>`COUNT(*)`
      })
      .from(userAnswers)
      .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(userTestRuns.userId);

    const totalQuestions = questionsPerUserResult.reduce((sum, u) => sum + Number(u.questionCount), 0);
    const averageQuestionsPerUser = totalActiveUsers > 0 ? totalQuestions / totalActiveUsers : 0;

    // User distribution (power users vs casual)
    const userDistribution = [
      { category: 'Power Users (>100 questions)', count: 0 },
      { category: 'Regular Users (20-100 questions)', count: 0 },
      { category: 'Casual Users (<20 questions)', count: 0 }
    ];

    questionsPerUserResult.forEach(user => {
      const count = Number(user.questionCount);
      if (count > 100) userDistribution[0].count++;
      else if (count >= 20) userDistribution[1].count++;
      else userDistribution[2].count++;
    });

    // Session frequency
    const sessionFrequencyResult = await db
      .select({
        userId: userTestRuns.userId,
        userName: users.name,
        sessionCount: sql<number>`COUNT(DISTINCT ${userTestRuns.id})`
      })
      .from(userTestRuns)
      .leftJoin(users, eq(userTestRuns.userId, users.id))
      .where(
        and(
          gte(userTestRuns.startedAt, this.dateRange.startDate),
          lte(userTestRuns.startedAt, this.dateRange.endDate)
        )
      )
      .groupBy(userTestRuns.userId, users.name)
      .orderBy(desc(sql`COUNT(DISTINCT ${userTestRuns.id})`))
      .limit(10);

    // Average session duration
    const sessionDurationResult = await db
      .select({
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${userTestRuns.completedAt} - ${userTestRuns.startedAt})))`
      })
      .from(userTestRuns)
      .where(
        and(
          gte(userTestRuns.startedAt, this.dateRange.startDate),
          lte(userTestRuns.startedAt, this.dateRange.endDate),
          sql`${userTestRuns.completedAt} IS NOT NULL`
        )
      );

    const averageSessionDuration = Number(sessionDurationResult[0]?.avgDuration || 0) / 60; // Convert to minutes

    return {
      totalActiveUsers,
      dailyActiveUsers: dailyActiveUsersResult.map(r => ({
        date: r.date || '',
        count: Number(r.count)
      })),
      averageQuestionsPerUser,
      userDistribution,
      sessionFrequency: sessionFrequencyResult.map(r => ({
        userId: r.userId,
        userName: r.userName || 'Unknown',
        sessionCount: Number(r.sessionCount)
      })),
      averageSessionDuration
    };
  }

  async getQuestionPerformanceMetrics(): Promise<QuestionPerformanceMetrics> {
    // Total questions answered
    const totalQuestionsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userAnswers)
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      );

    const totalQuestionsAnswered = Number(totalQuestionsResult[0]?.count || 0);

    // Completion rate
    const startedSetsResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${userTestRuns.id})` })
      .from(userTestRuns)
      .where(
        and(
          gte(userTestRuns.startedAt, this.dateRange.startDate),
          lte(userTestRuns.startedAt, this.dateRange.endDate)
        )
      );

    const completedSetsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userTestRuns)
      .where(
        and(
          gte(userTestRuns.startedAt, this.dateRange.startDate),
          lte(userTestRuns.startedAt, this.dateRange.endDate),
          sql`${userTestRuns.completedAt} IS NOT NULL`
        )
      );

    const startedCount = Number(startedSetsResult[0]?.count || 0);
    const completedCount = Number(completedSetsResult[0]?.count || 0);
    const completionRate = startedCount > 0 ? (completedCount / startedCount) * 100 : 0;

    // Questions per session
    const questionsPerSessionResult = await db
      .select({
        avgQuestions: sql<number>`AVG(question_count)`
      })
      .from(
        db
          .select({
            testRunId: userAnswers.userTestRunId,
            questionCount: sql<number>`COUNT(*)`
          })
          .from(userAnswers)
          .where(
            and(
              gte(userAnswers.answeredAt, this.dateRange.startDate),
              lte(userAnswers.answeredAt, this.dateRange.endDate)
            )
          )
          .groupBy(userAnswers.userTestRunId)
          .as('session_questions')
      );

    const questionsPerSession = Number(questionsPerSessionResult[0]?.avgQuestions || 0);

    // Top failed questions
    const topFailedQuestionsResult = await db
      .select({
        questionId: questions.id,
        attempts: sql<number>`COUNT(*)`,
        failureRate: sql<number>`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END)`
      })
      .from(userAnswers)
      .innerJoin(questionVersions, eq(userAnswers.questionVersionId, questionVersions.id))
      .innerJoin(questions, eq(questionVersions.questionId, questions.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(questions.id)
      .having(sql`COUNT(*) >= 5`) // Only consider questions with at least 5 attempts
      .orderBy(desc(sql`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 0 ELSE 1 END)`))
      .limit(10);

    // Get question text for failed questions
    const failedQuestionIds = topFailedQuestionsResult.map(q => q.questionId);
    const failedQuestionTexts = failedQuestionIds.length > 0 ? await db
      .select({
        questionId: questions.id,
        questionText: questionVersions.questionText
      })
      .from(questions)
      .leftJoin(questionVersions, and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.versionNumber, 1)
      ))
      .where(sql`${questions.id} IN (${sql.join(failedQuestionIds, sql`, `)})`) : [];

    const failedQuestionsMap = new Map(failedQuestionTexts.map(q => [q.questionId, q.questionText || '']));

    const topFailedQuestions = topFailedQuestionsResult.map(q => ({
      questionId: q.questionId,
      questionText: failedQuestionsMap.get(q.questionId) || 'Question text not found',
      attempts: Number(q.attempts),
      failureRate: Number(q.failureRate) * 100
    }));

    // Top passed questions
    const topPassedQuestionsResult = await db
      .select({
        questionId: questions.id,
        attempts: sql<number>`COUNT(*)`,
        successRate: sql<number>`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`
      })
      .from(userAnswers)
      .innerJoin(questionVersions, eq(userAnswers.questionVersionId, questionVersions.id))
      .innerJoin(questions, eq(questionVersions.questionId, questions.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(questions.id)
      .having(sql`COUNT(*) >= 5`)
      .orderBy(desc(sql`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`))
      .limit(10);

    // Get question text for passed questions
    const passedQuestionIds = topPassedQuestionsResult.map(q => q.questionId);
    const passedQuestionTexts = passedQuestionIds.length > 0 ? await db
      .select({
        questionId: questions.id,
        questionText: questionVersions.questionText
      })
      .from(questions)
      .leftJoin(questionVersions, and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.versionNumber, 1)
      ))
      .where(sql`${questions.id} IN (${sql.join(passedQuestionIds, sql`, `)})`) : [];

    const passedQuestionsMap = new Map(passedQuestionTexts.map(q => [q.questionId, q.questionText || '']));

    const topPassedQuestions = topPassedQuestionsResult.map(q => ({
      questionId: q.questionId,
      questionText: passedQuestionsMap.get(q.questionId) || 'Question text not found',
      attempts: Number(q.attempts),
      successRate: Number(q.successRate) * 100
    }));

    // Accuracy by question type
    const accuracyByTypeResult = await db
      .select({
        type: questionVersions.questionType,
        accuracy: sql<number>`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`
      })
      .from(userAnswers)
      .leftJoin(questionVersions, eq(userAnswers.questionVersionId, questionVersions.id))
      .leftJoin(questions, eq(questionVersions.questionId, questions.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(questionVersions.questionType);

    const accuracyByType = accuracyByTypeResult.map(r => ({
      type: r.type || 'Unknown',
      accuracy: Number(r.accuracy) * 100,
      total: Number(r.total)
    }));

    // Average time by question type - timeSpent column doesn't exist, so we'll return empty array
    const averageTimeByTypeResult: any[] = [];

    const averageTimeByType = averageTimeByTypeResult.map(r => ({
      type: r.type || 'Unknown',
      averageTime: Number(r.averageTime) / 1000 // Convert to seconds
    }));

    return {
      totalQuestionsAnswered,
      completionRate,
      questionsPerSession,
      topFailedQuestions,
      topPassedQuestions,
      accuracyByType,
      averageTimeByType
    };
  }

  async getAIAssistantMetrics(): Promise<AIAssistantMetrics> {
    // Total messages
    const totalMessagesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatbotLogs)
      .where(
        and(
          gte(chatbotLogs.createdAt, this.dateRange.startDate),
          lte(chatbotLogs.createdAt, this.dateRange.endDate)
        )
      );

    const totalMessages = Number(totalMessagesResult[0]?.count || 0);

    // Unique users
    const uniqueUsersResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${chatbotLogs.userId})` })
      .from(chatbotLogs)
      .where(
        and(
          gte(chatbotLogs.createdAt, this.dateRange.startDate),
          lte(chatbotLogs.createdAt, this.dateRange.endDate)
        )
      );

    const uniqueUsers = Number(uniqueUsersResult[0]?.count || 0);

    // Average messages per conversation
    const conversationMessagesResult = await db
      .select({
        conversationId: chatbotLogs.userId,
        messageCount: sql<number>`COUNT(*)`
      })
      .from(chatbotLogs)
      .where(
        and(
          gte(chatbotLogs.createdAt, this.dateRange.startDate),
          lte(chatbotLogs.createdAt, this.dateRange.endDate)
        )
      )
      .groupBy(chatbotLogs.userId);

    const totalConversations = conversationMessagesResult.length;
    const totalConversationMessages = conversationMessagesResult.reduce((sum, c) => sum + Number(c.messageCount), 0);
    const averageMessagesPerConversation = totalConversations > 0 ? totalConversationMessages / totalConversations : 0;

    // Peak usage hours
    const peakUsageHoursResult = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${chatbotLogs.createdAt})`,
        count: sql<number>`COUNT(*)`
      })
      .from(chatbotLogs)
      .where(
        and(
          gte(chatbotLogs.createdAt, this.dateRange.startDate),
          lte(chatbotLogs.createdAt, this.dateRange.endDate)
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${chatbotLogs.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${chatbotLogs.createdAt})`);

    const peakUsageHours = peakUsageHoursResult.map(r => ({
      hour: Number(r.hour),
      count: Number(r.count)
    }));

    // Top discussed questions
    const topDiscussedQuestionsResult = await db
      .select({
        questionId: chatbotFeedback.questionId,
        count: sql<number>`COUNT(*)`
      })
      .from(chatbotFeedback)
      .where(
        and(
          gte(chatbotFeedback.createdAt, this.dateRange.startDate),
          lte(chatbotFeedback.createdAt, this.dateRange.endDate),
          sql`${chatbotFeedback.questionId} IS NOT NULL`
        )
      )
      .groupBy(chatbotFeedback.questionId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // Get question text for discussed questions
    const discussedQuestionIds = topDiscussedQuestionsResult.map(q => q.questionId).filter(id => id !== null) as number[];
    const discussedQuestionTexts = discussedQuestionIds.length > 0 ? await db
      .select({
        questionId: questions.id,
        questionText: questionVersions.questionText
      })
      .from(questions)
      .leftJoin(questionVersions, and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.versionNumber, 1)
      ))
      .where(sql`${questions.id} IN (${sql.join(discussedQuestionIds, sql`, `)})`) : [];

    const discussedQuestionsMap = new Map(discussedQuestionTexts.map(q => [q.questionId, q.questionText || '']));

    const topDiscussedQuestions = topDiscussedQuestionsResult.map(q => ({
      questionId: q.questionId || 0,
      count: Number(q.count),
      questionText: discussedQuestionsMap.get(q.questionId || 0) || 'Question text not found'
    }));

    return {
      totalMessages,
      uniqueUsers,
      averageMessagesPerConversation,
      peakUsageHours,
      topDiscussedQuestions
    };
  }

  async getFeedbackMetrics(): Promise<FeedbackMetrics> {
    // Total feedback
    const totalFeedbackResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatbotFeedback)
      .where(
        and(
          gte(chatbotFeedback.createdAt, this.dateRange.startDate),
          lte(chatbotFeedback.createdAt, this.dateRange.endDate)
        )
      );

    const totalFeedback = Number(totalFeedbackResult[0]?.count || 0);

    // Positive vs negative ratio
    const sentimentRatioResult = await db
      .select({
        feedbackType: chatbotFeedback.feedbackType,
        count: sql<number>`COUNT(*)`
      })
      .from(chatbotFeedback)
      .where(
        and(
          gte(chatbotFeedback.createdAt, this.dateRange.startDate),
          lte(chatbotFeedback.createdAt, this.dateRange.endDate)
        )
      )
      .groupBy(chatbotFeedback.feedbackType);

    const positiveCount = sentimentRatioResult.find(r => r.feedbackType === 'positive')?.count || 0;
    const negativeCount = sentimentRatioResult.find(r => r.feedbackType === 'negative')?.count || 0;

    const positiveRatio = totalFeedback > 0 ? (Number(positiveCount) / totalFeedback) * 100 : 0;
    const negativeRatio = totalFeedback > 0 ? (Number(negativeCount) / totalFeedback) * 100 : 0;

    // Feedback by question type
    const feedbackByTypeResult = await db
      .select({
        type: questionVersions.questionType,
        feedbackType: chatbotFeedback.feedbackType,
        count: sql<number>`COUNT(*)`
      })
      .from(chatbotFeedback)
      .leftJoin(questions, eq(chatbotFeedback.questionId, questions.id))
      .leftJoin(questionVersions, and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.versionNumber, 1)
      ))
      .where(
        and(
          gte(chatbotFeedback.createdAt, this.dateRange.startDate),
          lte(chatbotFeedback.createdAt, this.dateRange.endDate)
        )
      )
      .groupBy(questionVersions.questionType, chatbotFeedback.feedbackType);

    const feedbackByTypeMap = new Map<string, { positive: number; negative: number }>();
    feedbackByTypeResult.forEach(r => {
      const type = r.type || 'Unknown';
      if (!feedbackByTypeMap.has(type)) {
        feedbackByTypeMap.set(type, { positive: 0, negative: 0 });
      }
      const entry = feedbackByTypeMap.get(type)!;
      if (r.feedbackType === 'positive') {
        entry.positive = Number(r.count);
      } else if (r.feedbackType === 'negative') {
        entry.negative = Number(r.count);
      }
    });

    const feedbackByType = Array.from(feedbackByTypeMap.entries()).map(([type, counts]) => ({
      type,
      positive: counts.positive,
      negative: counts.negative
    }));

    // Top issues from negative feedback
    const topIssuesResult = await db
      .select({
        feedbackText: chatbotFeedback.feedbackMessage,
        count: sql<number>`COUNT(*)`
      })
      .from(chatbotFeedback)
      .where(
        and(
          gte(chatbotFeedback.createdAt, this.dateRange.startDate),
          lte(chatbotFeedback.createdAt, this.dateRange.endDate),
          eq(chatbotFeedback.feedbackType, 'negative'),
          sql`${chatbotFeedback.feedbackMessage} IS NOT NULL`
        )
      )
      .groupBy(chatbotFeedback.feedbackMessage)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    const topIssues = topIssuesResult.map(r => ({
      issue: r.feedbackText || 'No feedback text',
      count: Number(r.count)
    }));

    return {
      totalFeedback,
      positiveRatio,
      negativeRatio,
      feedbackByType,
      topIssues
    };
  }

  async getLearningProgressMetrics(): Promise<LearningProgressMetrics> {
    // Course completion rates
    const courseCompletionResult = await db
      .select({
        courseId: courses.id,
        courseName: courses.courseTitle,
        totalSets: sql<number>`COUNT(DISTINCT ${questionSets.id})`,
        completedSets: sql<number>`COUNT(DISTINCT CASE WHEN ${userTestRuns.completedAt} IS NOT NULL THEN ${userTestRuns.questionSetId} END)`
      })
      .from(courses)
      .leftJoin(questionSets, eq(courses.id, questionSets.courseId))
      .leftJoin(userTestRuns, eq(questionSets.id, userTestRuns.questionSetId))
      .where(
        and(
          gte(userTestRuns.startedAt, this.dateRange.startDate),
          lte(userTestRuns.startedAt, this.dateRange.endDate)
        )
      )
      .groupBy(courses.id, courses.courseTitle);

    const courseCompletionRates = courseCompletionResult.map(r => ({
      courseId: r.courseId,
      courseName: r.courseName,
      completionRate: Number(r.totalSets) > 0 ? (Number(r.completedSets) / Number(r.totalSets)) * 100 : 0
    }));

    // Average score progression
    const scoreProgressionResult = await db
      .select({
        date: sql<string>`DATE(${userAnswers.answeredAt})`,
        averageScore: sql<number>`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`
      })
      .from(userAnswers)
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(sql`DATE(${userAnswers.answeredAt})`)
      .orderBy(sql`DATE(${userAnswers.answeredAt})`);

    const averageScoreProgression = scoreProgressionResult.map(r => ({
      date: r.date || '',
      averageScore: Number(r.averageScore) * 100
    }));

    // Retry patterns
    const retryPatternsResult = await db
      .select({
        questionId: questions.id,
        userId: userTestRuns.userId,
        attempts: sql<number>`COUNT(*)`
      })
      .from(userAnswers)
      .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
      .innerJoin(questionVersions, eq(userAnswers.questionVersionId, questionVersions.id))
      .innerJoin(questions, eq(questionVersions.questionId, questions.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(questions.id, userTestRuns.userId)
      .having(sql`COUNT(*) > 1`);

    const retryAggregation = new Map<number, { totalRetries: number; userCount: number }>();
    retryPatternsResult.forEach(r => {
      const existing = retryAggregation.get(r.questionId) || { totalRetries: 0, userCount: 0 };
      existing.totalRetries += Number(r.attempts) - 1; // Subtract 1 for the initial attempt
      existing.userCount += 1;
      retryAggregation.set(r.questionId, existing);
    });

    const retryQuestionIds = Array.from(retryAggregation.keys());
    const retryQuestionTexts = retryQuestionIds.length > 0 ? await db
      .select({
        questionId: questions.id,
        questionText: questionVersions.questionText
      })
      .from(questions)
      .leftJoin(questionVersions, and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.versionNumber, 1)
      ))
      .where(sql`${questions.id} IN (${sql.join(retryQuestionIds, sql`, `)})`) : [];

    const retryQuestionsMap = new Map(retryQuestionTexts.map(q => [q.questionId, q.questionText || '']));

    const retryPatterns = Array.from(retryAggregation.entries())
      .map(([questionId, data]) => ({
        questionId,
        averageRetries: data.totalRetries / data.userCount,
        questionText: retryQuestionsMap.get(questionId) || 'Question text not found'
      }))
      .sort((a, b) => b.averageRetries - a.averageRetries)
      .slice(0, 10);

    // Performance by course
    const performanceByCourseResult = await db
      .select({
        courseId: courses.id,
        courseName: courses.courseTitle,
        averageScore: sql<number>`AVG(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)`
      })
      .from(courses)
      .leftJoin(questionSets, eq(courses.id, questionSets.courseId))
      .leftJoin(questions, eq(questionSets.id, questions.questionSetId))
      .leftJoin(questionVersions, eq(questions.id, questionVersions.questionId))
      .leftJoin(userAnswers, eq(questionVersions.id, userAnswers.questionVersionId))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      )
      .groupBy(courses.id, courses.courseTitle);

    const performanceByCourse = performanceByCourseResult.map(r => ({
      courseId: r.courseId,
      courseName: r.courseName,
      averageScore: Number(r.averageScore) * 100
    }));

    // Time spent per course - timeSpent column doesn't exist, return empty array
    const timeSpentPerCourseResult: any[] = [];

    const timeSpentPerCourse = timeSpentPerCourseResult.map(r => ({
      courseId: r.courseId,
      courseName: r.courseName,
      totalTime: Number(r.totalTime) / 3600000 // Convert to hours
    }));

    return {
      courseCompletionRates,
      averageScoreProgression,
      retryPatterns,
      performanceByCourse,
      timeSpentPerCourse
    };
  }

  async getPreviewCounts(): Promise<{ userCount: number; questionCount: number }> {
    const userCountResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${userTestRuns.userId})` })
      .from(userAnswers)
      .innerJoin(userTestRuns, eq(userAnswers.userTestRunId, userTestRuns.id))
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      );

    const questionCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userAnswers)
      .where(
        and(
          gte(userAnswers.answeredAt, this.dateRange.startDate),
          lte(userAnswers.answeredAt, this.dateRange.endDate)
        )
      );

    return {
      userCount: Number(userCountResult[0]?.count || 0),
      questionCount: Number(questionCountResult[0]?.count || 0)
    };
  }
}