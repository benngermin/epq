import { UsageMetricsAggregator, DateRange } from './usage-metrics-aggregator';
import { CSVReportBuilder } from './csv-report-builder';

export type ReportFormat = 'csv';

export interface ReportGenerationOptions {
  startDate: Date;
  endDate: Date;
  format: ReportFormat;
}

export interface ReportPreview {
  userCount: number;
  questionCount: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// Simple in-memory cache for generated reports
interface CachedReport {
  buffer: Buffer;
  generatedAt: Date;
  key: string;
}

class ReportCache {
  private cache: Map<string, CachedReport> = new Map();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  generateKey(options: ReportGenerationOptions): string {
    return `${options.startDate.toISOString()}_${options.endDate.toISOString()}_${options.format}`;
  }

  get(options: ReportGenerationOptions): Buffer | null {
    const key = this.generateKey(options);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.generatedAt.getTime();
    if (age > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.buffer;
  }

  set(options: ReportGenerationOptions, buffer: Buffer): void {
    const key = this.generateKey(options);
    this.cache.set(key, {
      buffer,
      generatedAt: new Date(),
      key
    });
    
    // Clean up old entries
    this.cleanup();
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, value] of entries) {
      const age = now - value.generatedAt.getTime();
      if (age > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}

export class UsageReportGenerator {
  private reportCache = new ReportCache();
  
  async generateReport(options: ReportGenerationOptions): Promise<Buffer> {
    // Validate date range
    this.validateDateRange(options.startDate, options.endDate);
    
    // Check cache first
    const cached = this.reportCache.get(options);
    if (cached) {
      console.log('Returning cached report');
      return cached;
    }
    
    console.log(`Generating ${options.format.toUpperCase()} report for ${options.startDate.toISOString()} to ${options.endDate.toISOString()}`);
    
    const dateRange: DateRange = {
      startDate: options.startDate,
      endDate: options.endDate
    };
    
    // Fetch all metrics in parallel
    const metricsAggregator = new UsageMetricsAggregator(dateRange);
    
    const [
      userEngagement,
      questionPerformance,
      aiAssistant,
      feedback,
      learningProgress
    ] = await Promise.all([
      metricsAggregator.getUserEngagementMetrics(),
      metricsAggregator.getQuestionPerformanceMetrics(),
      metricsAggregator.getAIAssistantMetrics(),
      metricsAggregator.getFeedbackMetrics(),
      metricsAggregator.getLearningProgressMetrics()
    ]);
    
    // Generate CSV report (only format now supported)
    const csvBuilder = new CSVReportBuilder();
    const reportBuffer = await csvBuilder.generateCSVReport(
      userEngagement,
      questionPerformance,
      aiAssistant,
      feedback,
      learningProgress,
      dateRange
    );
    
    // Cache the report
    this.reportCache.set(options, reportBuffer);
    
    return reportBuffer;
  }
  
  async getReportPreview(startDate: Date, endDate: Date): Promise<ReportPreview> {
    this.validateDateRange(startDate, endDate);
    
    const dateRange: DateRange = { startDate, endDate };
    const metricsAggregator = new UsageMetricsAggregator(dateRange);
    
    const counts = await metricsAggregator.getPreviewCounts();
    
    return {
      userCount: counts.userCount,
      questionCount: counts.questionCount,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    };
  }
  
  private validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const rangeMs = endDate.getTime() - startDate.getTime();
    
    if (rangeMs > oneYearMs) {
      throw new Error('Date range cannot exceed 1 year');
    }
    
    if (endDate > new Date()) {
      throw new Error('End date cannot be in the future');
    }
  }
}