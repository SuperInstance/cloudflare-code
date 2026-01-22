import { Analytics, ImportJob, DataFormat } from '../types';
import { generateId } from '../utils';

export class ImportAnalytics {
  private metrics = {
    totalImports: 0,
    successfulImports: 0,
    failedImports: 0,
    totalRecordsProcessed: 0,
    totalRecordsFailed: 0,
    formatDistribution: {} as Record<DataFormat, number>,
    errorDistribution: {} as Record<string, number>,
    performanceMetrics: {
      averageValidationTime: 0,
      averageTransformationTime: 0,
      averageImportTime: 0,
      peakMemoryUsage: 0,
      totalProcessingTime: 0,
    },
    hourlyStats: {} as Record<string, {
      imports: number;
      records: number;
      successRate: number;
    }>,
    dailyStats: {} as Record<string, {
      imports: number;
      records: number;
      successRate: number;
      formats: Record<DataFormat, number>;
    }>,
  };

  private memorySnapshots: Array<{
    timestamp: Date;
    usage: number;
  }> = [];

  recordJobStart(job: ImportJob): void {
    this.metrics.totalImports++;

    if (!this.metrics.hourlyStats[this.formatDate(new Date(), 'hour')]) {
      this.metrics.hourlyStats[this.formatDate(new Date(), 'hour')] = {
        imports: 0,
        records: 0,
        successRate: 0,
      };
    }

    if (!this.metrics.dailyStats[this.formatDate(new Date(), 'day')]) {
      this.metrics.dailyStats[this.formatDate(new Date(), 'day')] = {
        imports: 0,
        records: 0,
        successRate: 0,
        formats: {} as Record<DataFormat, number>,
      };
    }

    this.metrics.hourlyStats[this.formatDate(new Date(), 'hour')].imports++;
    this.metrics.dailyStats[this.formatDate(new Date(), 'day')].imports++;

    this.takeMemorySnapshot();
  }

  recordJobCompletion(
    job: ImportJob,
    processingTime: number,
    validationTime: number,
    transformationTime: number
  ): void {
    const success = job.status === 'completed';

    if (success) {
      this.metrics.successfulImports++;
    } else {
      this.metrics.failedImports++;
    }

    if (job.metadata?.processedRecords) {
      this.metrics.totalRecordsProcessed += job.metadata.processedRecords;

      if (job.metadata.successfulRecords) {
        this.metrics.totalRecordsProcessed += job.metadata.successfulRecords;
      }

      if (job.metadata.failedRecords) {
        this.metrics.totalRecordsFailed += job.metadata.failedRecords;
      }
    }

    if (job.source.format) {
      this.metrics.formatDistribution[job.source.format] =
        (this.metrics.formatDistribution[job.source.format] || 0) + 1;
    }

    this.metrics.performanceMetrics.totalProcessingTime += processingTime;

    this.metrics.performanceMetrics.averageValidationTime =
      (this.metrics.performanceMetrics.averageValidationTime + validationTime) / 2;

    this.metrics.performanceMetrics.averageTransformationTime =
      (this.metrics.performanceMetrics.averageTransformationTime + transformationTime) / 2;

    this.metrics.performanceMetrics.averageImportTime =
      (this.metrics.performanceMetrics.averageImportTime + processingTime) / 2;

    const hourlyKey = this.formatDate(new Date(), 'hour');
    const hourlyStat = this.metrics.hourlyStats[hourlyKey];
    if (hourlyStat) {
      hourlyStat.records += job.metadata?.processedRecords || 0;
      hourlyStat.successRate = hourlyStat.imports > 0
        ? (hourlyStat.imports - this.getFailedImportsForPeriod(hourlyKey)) / hourlyStat.imports * 100
        : 0;
    }

    const dailyKey = this.formatDate(new Date(), 'day');
    const dailyStat = this.metrics.dailyStats[dailyKey];
    if (dailyStat) {
      dailyStat.records += job.metadata?.processedRecords || 0;
      dailyStat.successRate = dailyStat.imports > 0
        ? (dailyStat.imports - this.getFailedImportsForPeriod(dailyKey)) / dailyStat.imports * 100
        : 0;
      if (job.source.format) {
        dailyStat.formats[job.source.format] = (dailyStat.formats[job.source.format] || 0) + 1;
      }
    }

    this.takeMemorySnapshot();
  }

  recordError(error: string): void {
    const errorKey = this.normalizeErrorType(error);
    this.metrics.errorDistribution[errorKey] = (this.metrics.errorDistribution[errorKey] || 0) + 1;
  }

  getAnalytics(timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year'): Analytics {
    const analytics: Analytics = {
      totalImports: this.metrics.totalImports,
      successfulImports: this.metrics.successfulImports,
      failedImports: this.metrics.failedImports,
      averageProcessingTime: this.metrics.performanceMetrics.totalProcessingTime / this.metrics.totalImports || 0,
      totalRecordsProcessed: this.metrics.totalRecordsProcessed,
      totalRecordsFailed: this.metrics.totalRecordsFailed,
      formatDistribution: this.metrics.formatDistribution,
      errorDistribution: this.metrics.errorDistribution,
      performanceMetrics: this.metrics.performanceMetrics,
    };

    if (timeRange) {
      analytics.performanceMetrics = this.getPeriodPerformanceMetrics(timeRange);
      analytics.formatDistribution = this.getPeriodFormatDistribution(timeRange);
      analytics.errorDistribution = this.getPeriodErrorDistribution(timeRange);
    }

    return analytics;
  }

  getPerformanceTrends(timeRange: 'hour' | 'day' | 'week' | 'month' | 'year'): {
    throughput: number;
    successRate: number;
    averageProcessingTime: number;
    errorRate: number;
  } {
    const analytics = this.getAnalytics(timeRange);
    const totalRecords = analytics.totalRecordsProcessed;
    const totalJobs = analytics.totalImports;
    const failedJobs = analytics.failedImports;
    const totalErrors = Object.values(analytics.errorDistribution).reduce((sum, count) => sum + count, 0);

    return {
      throughput: totalJobs > 0 ? totalRecords / totalJobs : 0,
      successRate: totalJobs > 0 ? (totalJobs - failedJobs) / totalJobs * 100 : 0,
      averageProcessingTime: analytics.averageProcessingTime,
      errorRate: totalJobs > 0 ? (totalErrors / totalRecords) * 100 : 0,
    };
  }

  getFormatInsights(): Array<{
    format: DataFormat;
    usageCount: number;
    successRate: number;
    averageProcessingTime: number;
    totalRecords: number;
  }> {
    const formatStats = Object.entries(this.metrics.formatDistribution).map(([format, usageCount]) => {
      const formatJobs = Object.values(this.metrics.dailyStats).filter(
        stat => stat.formats[format as DataFormat] > 0
      );

      const totalRecords = formatJobs.reduce((sum, job) => sum + job.records, 0);
      const formatImports = formatJobs.reduce((sum, job) => sum + job.imports, 0);
      const failedImports = formatJobs.reduce((sum, job) => sum + job.imports - (job.successRate / 100 * job.imports), 0);

      return {
        format: format as DataFormat,
        usageCount,
        successRate: formatImports > 0 ? (1 - failedImports / formatImports) * 100 : 0,
        averageProcessingTime: totalRecords > 0
          ? this.metrics.performanceMetrics.totalProcessingTime / totalRecords * usageCount
          : 0,
        totalRecords,
      };
    });

    return formatStats.sort((a, b) => b.usageCount - a.usageCount);
  }

  getErrorAnalysis(): Array<{
    errorType: string;
    frequency: number;
    percentage: number;
    affectedJobs: number;
  }> {
    const totalErrors = Object.values(this.metrics.errorDistribution).reduce((sum, count) => sum + count, 0);

    return Object.entries(this.metrics.errorDistribution)
      .map(([errorType, frequency]) => ({
        errorType,
        frequency,
        percentage: totalErrors > 0 ? (frequency / totalErrors) * 100 : 0,
        affectedJobs: Math.ceil(frequency / 10),
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  getHealthMetrics(): {
    systemLoad: number;
    memoryUsage: number;
    errorRate: number;
    throughput: number;
    healthScore: number;
  } {
    const recentMemorySnapshots = this.memorySnapshots.slice(-10);
    const averageMemoryUsage = recentMemorySnapshots.length > 0
      ? recentMemorySnapshots.reduce((sum, snapshot) => sum + snapshot.usage, 0) / recentMemorySnapshots.length
      : 0;

    const totalJobs = this.metrics.totalImports;
    const failedJobs = this.metrics.failedImports;
    const successRate = totalJobs > 0 ? (1 - failedJobs / totalJobs) * 100 : 0;

    const errorRate = this.metrics.totalRecordsProcessed > 0
      ? (this.metrics.totalRecordsFailed / this.metrics.totalRecordsProcessed) * 100
      : 0;

    const throughput = totalJobs > 0
      ? this.metrics.totalRecordsProcessed / totalJobs
      : 0;

    const healthScore = Math.round((
      (successRate / 100) * 0.3 +
      (1 - Math.min(errorRate / 100, 1)) * 0.3 +
      (1 - Math.min(averageMemoryUsage / (1024 * 1024 * 1024), 1)) * 0.2 +
      Math.min(throughput / 1000, 1) * 0.2
    ) * 100);

    return {
      systemLoad: Math.round((totalJobs / this.getCapacity()) * 100),
      memoryUsage: Math.round(averageMemoryUsage / (1024 * 1024 * 1024) * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      throughput: Math.round(throughput),
      healthScore: Math.max(0, Math.min(100, healthScore)),
    };
  }

  exportMetrics(timeRange: 'hour' | 'day' | 'week' | 'month' | 'year'): string {
    const analytics = this.getAnalytics(timeRange);
    const trends = this.getPerformanceTrends(timeRange);
    const insights = this.getFormatInsights();
    const errors = this.getErrorAnalysis();
    const health = this.getHealthMetrics();

    return JSON.stringify({
      analytics,
      trends,
      insights,
      errors,
      health,
      exportTime: new Date().toISOString(),
      timeRange,
    }, null, 2);
  }

  clearMetrics(): void {
    this.metrics = {
      totalImports: 0,
      successfulImports: 0,
      failedImports: 0,
      totalRecordsProcessed: 0,
      totalRecordsFailed: 0,
      formatDistribution: {} as Record<DataFormat, number>,
      errorDistribution: {} as Record<string, number>,
      performanceMetrics: {
        averageValidationTime: 0,
        averageTransformationTime: 0,
        averageImportTime: 0,
        peakMemoryUsage: 0,
        totalProcessingTime: 0,
      },
      hourlyStats: {} as Record<string, {
        imports: number;
        records: number;
        successRate: number;
      }>,
      dailyStats: {} as Record<string, {
        imports: number;
        records: number;
        successRate: number;
        formats: Record<DataFormat, number>;
      }>,
    };

    this.memorySnapshots = [];
  }

  private takeMemorySnapshot(): void {
    const usedMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    this.memorySnapshots.push({
      timestamp: new Date(),
      usage: usedMemory,
    });

    if (usedMemory > this.metrics.performanceMetrics.peakMemoryUsage) {
      this.metrics.performanceMetrics.peakMemoryUsage = usedMemory;
    }

    this.memorySnapshots = this.memorySnapshots.slice(-100);
  }

  private formatDate(date: Date, granularity: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    switch (granularity) {
      case 'hour':
        return `${year}-${month}-${day}-${hour}`;
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return this.formatDate(weekStart, 'day');
      case 'month':
        return `${year}-${month}`;
      case 'year':
        return String(year);
      default:
        return this.formatDate(date, 'day');
    }
  }

  private normalizeErrorType(error: string): string {
    const commonPatterns = [
      /validation error/i,
      /parse error/i,
      /format error/i,
      /timeout error/i,
      /memory error/i,
      /network error/i,
      /file not found/i,
      /permission denied/i,
      /invalid data/i,
      /unknown error/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(error)) {
        return pattern.source;
      }
    }

    return 'unknown error';
  }

  private getFailedImportsForPeriod(period: string): number {
    return Object.entries(this.metrics.dailyStats).reduce((sum, [key, stat]) => {
      if (key.startsWith(period)) {
        return sum + stat.imports - (stat.successRate / 100 * stat.imports);
      }
      return sum;
    }, 0);
  }

  private getPeriodPerformanceMetrics(timeRange: 'hour' | 'day' | 'week' | 'month' | 'year') {
    const period = this.formatDate(new Date(), timeRange);
    const periodJobs = Object.entries(this.metrics.dailyStats).filter(
      ([key]) => key.startsWith(period)
    );

    const totalJobs = periodJobs.reduce((sum, [, stat]) => sum + stat.imports, 0);
    const totalProcessingTime = periodJobs.reduce((sum, [, stat]) => sum + stat.records * 1000, 0);

    return {
      averageValidationTime: 0,
      averageTransformationTime: 0,
      averageImportTime: totalJobs > 0 ? totalProcessingTime / totalJobs : 0,
      peakMemoryUsage: this.metrics.performanceMetrics.peakMemoryUsage,
      totalProcessingTime,
    };
  }

  private getPeriodFormatDistribution(timeRange: 'hour' | 'day' | 'week' | 'month' | 'year') {
    const period = this.formatDate(new Date(), timeRange);
    const distribution: Record<DataFormat, number> = {} as Record<DataFormat, number>;

    Object.entries(this.metrics.dailyStats).forEach(([key, stat]) => {
      if (key.startsWith(period)) {
        Object.entries(stat.formats).forEach(([format, count]) => {
          distribution[format as DataFormat] = (distribution[format as DataFormat] || 0) + count;
        });
      }
    });

    return distribution;
  }

  private getPeriodErrorDistribution(timeRange: 'hour' | 'day' | 'week' | 'month' | 'year') {
    const period = this.formatDate(new Date(), timeRange);
    const distribution: Record<string, number> = {};

    Object.entries(this.metrics.errorDistribution).forEach(([errorType, count]) => {
      if (this.getRecentErrors().some(error => error.includes(errorType))) {
        distribution[errorType] = count;
      }
    });

    return distribution;
  }

  private getRecentErrors(): string[] {
    return Object.keys(this.metrics.errorDistribution).slice(-10);
  }

  private getCapacity(): number {
    return 1000;
  }
}