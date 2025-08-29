import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import * as archiver from 'archiver';
import {
  UserEngagementMetrics,
  QuestionPerformanceMetrics,
  AIAssistantMetrics,
  FeedbackMetrics,
  LearningProgressMetrics
} from './usage-metrics-aggregator';

export class CSVReportBuilder {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', `report-${Date.now()}`);
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async generateCSVReport(
    userEngagement: UserEngagementMetrics,
    questionPerformance: QuestionPerformanceMetrics,
    aiAssistant: AIAssistantMetrics,
    feedback: FeedbackMetrics,
    learningProgress: LearningProgressMetrics,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<Buffer> {
    try {
      // Generate individual CSV files
      await this.generateUserActivityCSV(userEngagement);
      await this.generateQuestionPerformanceCSV(questionPerformance);
      await this.generateAIAssistantUsageCSV(aiAssistant);
      await this.generateFeedbackSummaryCSV(feedback);
      await this.generateSessionDetailsCSV(userEngagement, questionPerformance);
      await this.generateSummaryCSV(
        userEngagement,
        questionPerformance,
        aiAssistant,
        feedback,
        learningProgress,
        dateRange
      );

      // Create ZIP archive
      const zipBuffer = await this.createZipArchive();

      // Cleanup temp files
      this.cleanup();

      return zipBuffer;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private async generateUserActivityCSV(metrics: UserEngagementMetrics): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'user_activity.csv'),
      header: [
        { id: 'date', title: 'Date' },
        { id: 'activeUsers', title: 'Active Users' },
        { id: 'questionsAnswered', title: 'Questions Answered' },
        { id: 'avgQuestionsPerUser', title: 'Avg Questions per User' }
      ]
    });

    const records = metrics.dailyActiveUsers.map(day => ({
      date: day.date,
      activeUsers: day.count,
      questionsAnswered: Math.round(day.count * metrics.averageQuestionsPerUser),
      avgQuestionsPerUser: metrics.averageQuestionsPerUser.toFixed(2)
    }));

    await csvWriter.writeRecords(records);

    // Also create a power users CSV
    const powerUsersWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'power_users.csv'),
      header: [
        { id: 'userId', title: 'User ID' },
        { id: 'userName', title: 'User Name' },
        { id: 'sessionCount', title: 'Sessions' }
      ]
    });

    await powerUsersWriter.writeRecords(metrics.sessionFrequency);
  }

  private async generateQuestionPerformanceCSV(metrics: QuestionPerformanceMetrics): Promise<void> {
    // Failed questions CSV
    const failedQuestionsWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'failed_questions.csv'),
      header: [
        { id: 'questionId', title: 'Question ID' },
        { id: 'questionText', title: 'Question Text' },
        { id: 'attempts', title: 'Total Attempts' },
        { id: 'failureRate', title: 'Failure Rate (%)' }
      ]
    });

    const failedRecords = metrics.topFailedQuestions.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText.substring(0, 200), // Truncate long questions
      attempts: q.attempts,
      failureRate: q.failureRate.toFixed(2)
    }));

    await failedQuestionsWriter.writeRecords(failedRecords);

    // Passed questions CSV
    const passedQuestionsWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'passed_questions.csv'),
      header: [
        { id: 'questionId', title: 'Question ID' },
        { id: 'questionText', title: 'Question Text' },
        { id: 'attempts', title: 'Total Attempts' },
        { id: 'successRate', title: 'Success Rate (%)' }
      ]
    });

    const passedRecords = metrics.topPassedQuestions.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText.substring(0, 200),
      attempts: q.attempts,
      successRate: q.successRate.toFixed(2)
    }));

    await passedQuestionsWriter.writeRecords(passedRecords);

    // Accuracy by type CSV
    const accuracyByTypeWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'accuracy_by_type.csv'),
      header: [
        { id: 'questionType', title: 'Question Type' },
        { id: 'accuracy', title: 'Accuracy (%)' },
        { id: 'totalQuestions', title: 'Total Questions' },
        { id: 'avgTime', title: 'Avg Time (seconds)' }
      ]
    });

    const accuracyRecords = metrics.accuracyByType.map(type => {
      const timeData = metrics.averageTimeByType.find(t => t.type === type.type);
      return {
        questionType: type.type,
        accuracy: type.accuracy.toFixed(2),
        totalQuestions: type.total,
        avgTime: timeData ? timeData.averageTime.toFixed(1) : 'N/A'
      };
    });

    await accuracyByTypeWriter.writeRecords(accuracyRecords);
  }

  private async generateAIAssistantUsageCSV(metrics: AIAssistantMetrics): Promise<void> {
    // Hourly usage CSV
    const hourlyUsageWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'ai_assistant_hourly_usage.csv'),
      header: [
        { id: 'hour', title: 'Hour of Day' },
        { id: 'messages', title: 'Messages Sent' }
      ]
    });

    const hourlyRecords = Array.from({ length: 24 }, (_, hour) => {
      const data = metrics.peakUsageHours.find(h => h.hour === hour);
      return {
        hour: `${hour}:00`,
        messages: data ? data.count : 0
      };
    });

    await hourlyUsageWriter.writeRecords(hourlyRecords);

    // Top discussed questions CSV
    const topQuestionsWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'ai_assistant_top_questions.csv'),
      header: [
        { id: 'questionId', title: 'Question ID' },
        { id: 'questionText', title: 'Question Text' },
        { id: 'discussionCount', title: 'Times Discussed' }
      ]
    });

    const topQuestionsRecords = metrics.topDiscussedQuestions.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText.substring(0, 200),
      discussionCount: q.count
    }));

    await topQuestionsWriter.writeRecords(topQuestionsRecords);
  }

  private async generateFeedbackSummaryCSV(metrics: FeedbackMetrics): Promise<void> {
    // Feedback by type CSV
    const feedbackByTypeWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'feedback_by_type.csv'),
      header: [
        { id: 'questionType', title: 'Question Type' },
        { id: 'positiveFeedback', title: 'Positive Feedback' },
        { id: 'negativeFeedback', title: 'Negative Feedback' },
        { id: 'positiveRatio', title: 'Positive Ratio (%)' }
      ]
    });

    const feedbackRecords = metrics.feedbackByType.map(type => ({
      questionType: type.type,
      positiveFeedback: type.positive,
      negativeFeedback: type.negative,
      positiveRatio: type.positive + type.negative > 0
        ? ((type.positive / (type.positive + type.negative)) * 100).toFixed(2)
        : 'N/A'
    }));

    await feedbackByTypeWriter.writeRecords(feedbackRecords);

    // Top issues CSV
    const topIssuesWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'top_issues.csv'),
      header: [
        { id: 'issue', title: 'Issue Description' },
        { id: 'count', title: 'Occurrences' }
      ]
    });

    const issuesRecords = metrics.topIssues.map(issue => ({
      issue: issue.issue.substring(0, 500),
      count: issue.count
    }));

    await topIssuesWriter.writeRecords(issuesRecords);
  }

  private async generateSessionDetailsCSV(
    userMetrics: UserEngagementMetrics,
    questionMetrics: QuestionPerformanceMetrics
  ): Promise<void> {
    const sessionDetailsWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'session_details.csv'),
      header: [
        { id: 'metric', title: 'Metric' },
        { id: 'value', title: 'Value' }
      ]
    });

    const records = [
      { metric: 'Total Active Users', value: userMetrics.totalActiveUsers },
      { metric: 'Average Questions per User', value: userMetrics.averageQuestionsPerUser.toFixed(2) },
      { metric: 'Average Session Duration (minutes)', value: userMetrics.averageSessionDuration.toFixed(2) },
      { metric: 'Total Questions Answered', value: questionMetrics.totalQuestionsAnswered },
      { metric: 'Completion Rate (%)', value: questionMetrics.completionRate.toFixed(2) },
      { metric: 'Questions per Session', value: questionMetrics.questionsPerSession.toFixed(2) }
    ];

    await sessionDetailsWriter.writeRecords(records);
  }

  private async generateSummaryCSV(
    userEngagement: UserEngagementMetrics,
    questionPerformance: QuestionPerformanceMetrics,
    aiAssistant: AIAssistantMetrics,
    feedback: FeedbackMetrics,
    learningProgress: LearningProgressMetrics,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<void> {
    const summaryWriter = createObjectCsvWriter({
      path: path.join(this.tempDir, 'report_summary.csv'),
      header: [
        { id: 'category', title: 'Category' },
        { id: 'metric', title: 'Metric' },
        { id: 'value', title: 'Value' }
      ]
    });

    const records = [
      // Report Info
      { category: 'Report Info', metric: 'Start Date', value: dateRange.startDate.toISOString().split('T')[0] },
      { category: 'Report Info', metric: 'End Date', value: dateRange.endDate.toISOString().split('T')[0] },
      
      // User Engagement
      { category: 'User Engagement', metric: 'Total Active Users', value: userEngagement.totalActiveUsers },
      { category: 'User Engagement', metric: 'Avg Questions per User', value: userEngagement.averageQuestionsPerUser.toFixed(2) },
      { category: 'User Engagement', metric: 'Avg Session Duration (min)', value: userEngagement.averageSessionDuration.toFixed(2) },
      
      // Question Performance
      { category: 'Question Performance', metric: 'Total Questions Answered', value: questionPerformance.totalQuestionsAnswered },
      { category: 'Question Performance', metric: 'Completion Rate (%)', value: questionPerformance.completionRate.toFixed(2) },
      { category: 'Question Performance', metric: 'Questions per Session', value: questionPerformance.questionsPerSession.toFixed(2) },
      
      // AI Assistant
      { category: 'AI Assistant', metric: 'Total Messages', value: aiAssistant.totalMessages },
      { category: 'AI Assistant', metric: 'Unique Users', value: aiAssistant.uniqueUsers },
      { category: 'AI Assistant', metric: 'Avg Messages per Conversation', value: aiAssistant.averageMessagesPerConversation.toFixed(2) },
      
      // Feedback
      { category: 'Feedback', metric: 'Total Feedback', value: feedback.totalFeedback },
      { category: 'Feedback', metric: 'Positive Ratio (%)', value: feedback.positiveRatio.toFixed(2) },
      { category: 'Feedback', metric: 'Negative Ratio (%)', value: feedback.negativeRatio.toFixed(2) },
      
      // Learning Progress
      { category: 'Learning Progress', metric: 'Courses Tracked', value: learningProgress.courseCompletionRates.length },
      { category: 'Learning Progress', metric: 'Avg Completion Rate (%)', 
        value: learningProgress.courseCompletionRates.length > 0 
          ? (learningProgress.courseCompletionRates.reduce((sum, c) => sum + c.completionRate, 0) / learningProgress.courseCompletionRates.length).toFixed(2)
          : '0' }
    ];

    await summaryWriter.writeRecords(records);
  }

  private async createZipArchive(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add all CSV files to the archive
      archive.directory(this.tempDir, false);
      archive.finalize();
    });
  }

  private cleanup(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
}