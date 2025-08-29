import * as puppeteer from 'puppeteer';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { execSync } from 'child_process';
import {
  UserEngagementMetrics,
  QuestionPerformanceMetrics,
  AIAssistantMetrics,
  FeedbackMetrics,
  LearningProgressMetrics
} from './usage-metrics-aggregator';

export class PDFReportBuilder {
  private chartWidth = 800;
  private chartHeight = 400;
  private chartRenderer: ChartJSNodeCanvas;

  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({
      width: this.chartWidth,
      height: this.chartHeight,
      backgroundColour: 'white'
    });
  }

  private findChromiumExecutable(): string | undefined {
    try {
      // Try to find chromium in the system
      const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (chromiumPath) {
        console.log('Found Chromium at:', chromiumPath);
        return chromiumPath;
      }
    } catch (error) {
      console.log('Could not find Chromium using which command');
    }
    
    // Return undefined to let Puppeteer use its default
    return undefined;
  }

  async generatePDFReport(
    userEngagement: UserEngagementMetrics,
    questionPerformance: QuestionPerformanceMetrics,
    aiAssistant: AIAssistantMetrics,
    feedback: FeedbackMetrics,
    learningProgress: LearningProgressMetrics,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<Buffer> {
    const executablePath = this.findChromiumExecutable();
    
    const browser = await puppeteer.launch({
      headless: true,
      ...(executablePath && { executablePath }),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      const htmlContent = await this.generateHTMLReport(
        userEngagement,
        questionPerformance,
        aiAssistant,
        feedback,
        learningProgress,
        dateRange
      );

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  private async generateHTMLReport(
    userEngagement: UserEngagementMetrics,
    questionPerformance: QuestionPerformanceMetrics,
    aiAssistant: AIAssistantMetrics,
    feedback: FeedbackMetrics,
    learningProgress: LearningProgressMetrics,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<string> {
    // Generate all charts
    const userActivityChart = await this.generateUserActivityChart(userEngagement);
    const questionSuccessChart = await this.generateQuestionSuccessChart(questionPerformance);
    const aiUsageChart = await this.generateAIUsageChart(aiAssistant);
    const feedbackChart = await this.generateFeedbackChart(feedback);
    const completionChart = await this.generateCompletionChart(learningProgress);
    const sessionDistributionChart = await this.generateSessionDistributionChart(userEngagement);

    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: white;
        }
        
        .page {
          page-break-after: always;
          padding: 40px;
          min-height: 100vh;
        }
        
        .page:last-child {
          page-break-after: avoid;
        }
        
        h1 {
          color: #667eea;
          font-size: 32px;
          margin-bottom: 20px;
          border-bottom: 3px solid #667eea;
          padding-bottom: 10px;
        }
        
        h2 {
          color: #4a5568;
          font-size: 24px;
          margin: 30px 0 20px 0;
        }
        
        h3 {
          color: #4a5568;
          font-size: 18px;
          margin: 20px 0 10px 0;
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px;
          margin: -40px -40px 30px -40px;
          text-align: center;
        }
        
        .header h1 {
          color: white;
          border: none;
          margin-bottom: 10px;
        }
        
        .date-range {
          font-size: 18px;
          opacity: 0.95;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 30px 0;
        }
        
        .metric-card {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
        }
        
        .metric-value {
          font-size: 36px;
          font-weight: bold;
          color: #667eea;
        }
        
        .metric-label {
          font-size: 14px;
          color: #718096;
          text-transform: uppercase;
          margin-top: 5px;
        }
        
        .chart-container {
          margin: 30px 0;
          text-align: center;
        }
        
        .chart-container img {
          max-width: 100%;
          height: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        
        th {
          background: #f7fafc;
          font-weight: 600;
          color: #4a5568;
        }
        
        tr:hover {
          background: #f7fafc;
        }
        
        .success-badge {
          background: #48bb78;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .failure-badge {
          background: #f56565;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .insight-box {
          background: #edf2f7;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 20px 0;
        }
        
        .insight-box h3 {
          color: #667eea;
          margin-top: 0;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #718096;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <!-- Page 1: Executive Dashboard -->
      <div class="page">
        <div class="header">
          <h1>Usage Report</h1>
          <div class="date-range">
            ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}
          </div>
        </div>
        
        <h2>Executive Summary</h2>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${userEngagement.totalActiveUsers.toLocaleString()}</div>
            <div class="metric-label">Active Users</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${questionPerformance.totalQuestionsAnswered.toLocaleString()}</div>
            <div class="metric-label">Questions Answered</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${questionPerformance.completionRate.toFixed(1)}%</div>
            <div class="metric-label">Completion Rate</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${aiAssistant.totalMessages.toLocaleString()}</div>
            <div class="metric-label">AI Assistant Messages</div>
          </div>
        </div>
        
        <h2>User Activity Trend</h2>
        <div class="chart-container">
          <img src="data:image/png;base64,${userActivityChart}" alt="User Activity Chart">
        </div>
        
        <div class="insight-box">
          <h3>Key Insights</h3>
          <ul>
            <li>Average of ${userEngagement.averageQuestionsPerUser.toFixed(1)} questions per user</li>
            <li>Average session duration: ${userEngagement.averageSessionDuration.toFixed(1)} minutes</li>
            <li>${feedback.positiveRatio.toFixed(1)}% positive feedback rate</li>
          </ul>
        </div>
      </div>
      
      <!-- Page 2: User Engagement Analysis -->
      <div class="page">
        <h1>User Engagement Analysis</h1>
        
        <h2>User Distribution</h2>
        <div class="metrics-grid">
          ${userEngagement.userDistribution.map(cat => `
            <div class="metric-card">
              <div class="metric-value">${cat.count}</div>
              <div class="metric-label">${cat.category}</div>
            </div>
          `).join('')}
        </div>
        
        <h2>Session Distribution</h2>
        <div class="chart-container">
          <img src="data:image/png;base64,${sessionDistributionChart}" alt="Session Distribution">
        </div>
        
        <h2>Top Active Users</h2>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            ${userEngagement.sessionFrequency.slice(0, 10).map(user => `
              <tr>
                <td>${user.userName}</td>
                <td>${user.sessionCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Page 3: Question Performance -->
      <div class="page">
        <h1>Question Performance</h1>
        
        <h2>Success Rate by Question Type</h2>
        <div class="chart-container">
          <img src="data:image/png;base64,${questionSuccessChart}" alt="Question Success Rate">
        </div>
        
        <h2>Top Failed Questions</h2>
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Attempts</th>
              <th>Failure Rate</th>
            </tr>
          </thead>
          <tbody>
            ${questionPerformance.topFailedQuestions.slice(0, 5).map(q => `
              <tr>
                <td>${q.questionText.substring(0, 100)}...</td>
                <td>${q.attempts}</td>
                <td><span class="failure-badge">${q.failureRate.toFixed(1)}%</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h2>Top Passed Questions</h2>
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Attempts</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            ${questionPerformance.topPassedQuestions.slice(0, 5).map(q => `
              <tr>
                <td>${q.questionText.substring(0, 100)}...</td>
                <td>${q.attempts}</td>
                <td><span class="success-badge">${q.successRate.toFixed(1)}%</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Page 4: AI Assistant Analytics -->
      <div class="page">
        <h1>AI Assistant Analytics</h1>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${aiAssistant.uniqueUsers}</div>
            <div class="metric-label">Unique Users</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${aiAssistant.averageMessagesPerConversation.toFixed(1)}</div>
            <div class="metric-label">Avg Messages per Conversation</div>
          </div>
        </div>
        
        <h2>Usage Over Time</h2>
        <div class="chart-container">
          <img src="data:image/png;base64,${aiUsageChart}" alt="AI Usage Pattern">
        </div>
        
        <h2>Most Discussed Questions</h2>
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Discussion Count</th>
            </tr>
          </thead>
          <tbody>
            ${aiAssistant.topDiscussedQuestions.slice(0, 5).map(q => `
              <tr>
                <td>${q.questionText.substring(0, 100)}...</td>
                <td>${q.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Page 5: Feedback & Learning Progress -->
      <div class="page">
        <h1>Feedback & Learning Progress</h1>
        
        <h2>Feedback Sentiment</h2>
        <div class="chart-container">
          <img src="data:image/png;base64,${feedbackChart}" alt="Feedback Sentiment">
        </div>
        
        <h2>Course Completion Rates</h2>
        <div class="chart-container">
          <img src="data:image/png;base64,${completionChart}" alt="Course Completion">
        </div>
        
        <h2>Performance by Course</h2>
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Average Score</th>
              <th>Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            ${learningProgress.performanceByCourse.slice(0, 10).map((course, idx) => {
              const completion = learningProgress.courseCompletionRates.find(c => c.courseId === course.courseId);
              return `
                <tr>
                  <td>${course.courseName}</td>
                  <td>${course.averageScore.toFixed(1)}%</td>
                  <td>${completion ? completion.completionRate.toFixed(1) : '0'}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()} | Exam Practice Questions Platform</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private async generateUserActivityChart(metrics: UserEngagementMetrics): Promise<string> {
    const chartConfig = {
      type: 'line' as const,
      data: {
        labels: metrics.dailyActiveUsers.map(d => d.date),
        datasets: [{
          label: 'Daily Active Users',
          data: metrics.dailyActiveUsers.map(d => d.count),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Daily Active Users Trend'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    const buffer = await this.chartRenderer.renderToBuffer(chartConfig);
    return buffer.toString('base64');
  }

  private async generateQuestionSuccessChart(metrics: QuestionPerformanceMetrics): Promise<string> {
    const chartConfig = {
      type: 'bar' as const,
      data: {
        labels: metrics.accuracyByType.map(t => t.type),
        datasets: [{
          label: 'Success Rate (%)',
          data: metrics.accuracyByType.map(t => t.accuracy),
          backgroundColor: [
            '#48bb78',
            '#667eea',
            '#ed8936',
            '#f56565',
            '#38b2ac',
            '#9f7aea'
          ]
        }]
      },
      options: {
        indexAxis: 'y' as const,
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Success Rate by Question Type'
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    };

    const buffer = await this.chartRenderer.renderToBuffer(chartConfig);
    return buffer.toString('base64');
  }

  private async generateAIUsageChart(metrics: AIAssistantMetrics): Promise<string> {
    const chartConfig = {
      type: 'bar' as const,
      data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Messages',
          data: Array.from({ length: 24 }, (_, hour) => {
            const data = metrics.peakUsageHours.find(h => h.hour === hour);
            return data ? data.count : 0;
          }),
          backgroundColor: '#667eea',
          borderColor: '#5a67d8',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'AI Assistant Usage by Hour'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    const buffer = await this.chartRenderer.renderToBuffer(chartConfig);
    return buffer.toString('base64');
  }

  private async generateFeedbackChart(metrics: FeedbackMetrics): Promise<string> {
    const chartConfig = {
      type: 'doughnut' as const,
      data: {
        labels: ['Positive', 'Negative'],
        datasets: [{
          data: [metrics.positiveRatio, metrics.negativeRatio],
          backgroundColor: ['#48bb78', '#f56565'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Feedback Sentiment Distribution'
          },
          legend: {
            position: 'bottom' as const
          }
        }
      }
    };

    const buffer = await this.chartRenderer.renderToBuffer(chartConfig);
    return buffer.toString('base64');
  }

  private async generateCompletionChart(metrics: LearningProgressMetrics): Promise<string> {
    const topCourses = metrics.courseCompletionRates.slice(0, 5);
    
    const chartConfig = {
      type: 'bar' as const,
      data: {
        labels: topCourses.map(c => c.courseName.substring(0, 30)),
        datasets: [{
          label: 'Completion Rate (%)',
          data: topCourses.map(c => c.completionRate),
          backgroundColor: '#667eea',
          borderColor: '#5a67d8',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Course Completion Rates'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    };

    const buffer = await this.chartRenderer.renderToBuffer(chartConfig);
    return buffer.toString('base64');
  }

  private async generateSessionDistributionChart(metrics: UserEngagementMetrics): Promise<string> {
    const chartConfig = {
      type: 'bar' as const,
      data: {
        labels: metrics.userDistribution.map(d => d.category.split('(')[0].trim()),
        datasets: [{
          label: 'Number of Users',
          data: metrics.userDistribution.map(d => d.count),
          backgroundColor: ['#667eea', '#48bb78', '#ed8936']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'User Distribution by Activity Level'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    const buffer = await this.chartRenderer.renderToBuffer(chartConfig);
    return buffer.toString('base64');
  }
}