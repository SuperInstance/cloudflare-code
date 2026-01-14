/**
 * Scheduling Analytics
 * Provides metrics, statistics, performance trends, resource utilization, and optimization suggestions
 */

import {
  Job,
  JobStatus,
  JobResult,
  SchedulingMetrics,
  ExecutionStats,
  PerformanceMetrics,
  CapacityPlanning,
  OptimizationSuggestion,
  Logger
} from '../types';
import { JobMonitor } from '../monitoring/monitor';

/**
 * Configuration for analytics
 */
export interface AnalyticsConfig {
  retentionDays?: number;
  aggregationInterval?: number;
  enablePredictions?: boolean;
  logger?: Logger;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Job performance data
 */
export interface JobPerformanceData {
  jobId: string;
  jobName: string;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p50ExecutionTime: number;
  p90ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  successRate: number;
  failureRate: number;
  timeoutRate: number;
  retryRate: number;
  throughput: number;
  lastExecution: Date;
  totalExecutions: number;
}

/**
 * Resource utilization data
 */
export interface ResourceUtilizationData {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkUsage: number;
  activeJobs: number;
  queuedJobs: number;
}

/**
 * Analytics class
 */
export class SchedulingAnalytics {
  private config: AnalyticsConfig;
  private logger: Logger;
  private jobMonitor: JobMonitor;
  private executionHistory: Map<string, JobResult[]>;
  private timeSeriesData: Map<string, TimeSeriesPoint[]>;
  private performanceData: Map<string, JobPerformanceData>;
  private resourceUtilizationHistory: ResourceUtilizationData[];
  private aggregationTimer?: NodeJS.Timeout;

  constructor(jobMonitor: JobMonitor, config: AnalyticsConfig = {}) {
    this.config = {
      retentionDays: config.retentionDays || 30,
      aggregationInterval: config.aggregationInterval || 300000, // 5 minutes
      enablePredictions: config.enablePredictions ?? true
    };

    this.logger = config.logger || this.createDefaultLogger();

    this.jobMonitor = jobMonitor;
    this.executionHistory = new Map();
    this.timeSeriesData = new Map();
    this.performanceData = new Map();
    this.resourceUtilizationHistory = [];

    // Start aggregation timer
    this.startAggregation();
  }

  /**
   * Record job execution
   */
  recordExecution(job: Job, result: JobResult): void {
    let history = this.executionHistory.get(job.definitionId);
    if (!history) {
      history = [];
      this.executionHistory.set(job.definitionId, history);
    }

    history.push(result);

    // Trim history
    const maxSize = 10000;
    if (history.length > maxSize) {
      history.splice(0, history.length - maxSize);
    }

    // Update time series data
    this.updateTimeSeriesData(job.definitionId, result);

    // Update performance data
    this.updatePerformanceData(job.definitionId);

    this.logger.debug(`Execution recorded for job: ${job.definitionId}`);
  }

  /**
   * Update time series data
   */
  private updateTimeSeriesData(jobId: string, result: JobResult): void {
    let series = this.timeSeriesData.get(jobId);
    if (!series) {
      series = [];
      this.timeSeriesData.set(jobId, series);
    }

    const point: TimeSeriesPoint = {
      timestamp: result.completedAt,
      value: result.executionTime,
      metadata: {
        success: result.success,
        attemptNumber: result.attemptNumber
      }
    };

    series.push(point);

    // Trim series
    const maxSize = 1000;
    if (series.length > maxSize) {
      series.splice(0, series.length - maxSize);
    }
  }

  /**
   * Update performance data
   */
  private updatePerformanceData(jobId: string): void {
    const history = this.executionHistory.get(jobId);
    if (!history || history.length === 0) {
      return;
    }

    const executionTimes = history
      .filter((r) => r.success)
      .map((r) => r.executionTime)
      .sort((a, b) => a - b);

    const successful = history.filter((r) => r.success).length;
    const failed = history.filter((r) => !r.success).length;
    const total = history.length;

    const percentiles = this.calculatePercentiles(executionTimes);

    const data: JobPerformanceData = {
      jobId,
      jobName: '', // Will be filled by caller
      avgExecutionTime: this.average(executionTimes),
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      p50ExecutionTime: percentiles.p50,
      p90ExecutionTime: percentiles.p90,
      p95ExecutionTime: percentiles.p95,
      p99ExecutionTime: percentiles.p99,
      successRate: successful / total,
      failureRate: failed / total,
      timeoutRate: 0, // TODO: Track timeouts
      retryRate: 0, // TODO: Track retries
      throughput: this.calculateThroughput(history),
      lastExecution: history[history.length - 1].completedAt,
      totalExecutions: total
    };

    this.performanceData.set(jobId, data);
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentiles(values: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const p50Index = Math.floor(values.length * 0.5);
    const p90Index = Math.floor(values.length * 0.9);
    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);

    return {
      p50: values[p50Index],
      p90: values[p90Index],
      p95: values[p95Index],
      p99: values[p99Index]
    };
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate throughput (executions per minute)
   */
  private calculateThroughput(history: JobResult[]): number {
    if (history.length < 2) {
      return 0;
    }

    const first = history[0].completedAt.getTime();
    const last = history[history.length - 1].completedAt.getTime();
    const durationMinutes = (last - first) / 60000;

    if (durationMinutes <= 0) {
      return 0;
    }

    return history.length / durationMinutes;
  }

  /**
   * Get scheduling metrics
   */
  getSchedulingMetrics(): SchedulingMetrics {
    return this.jobMonitor.getSchedulingMetrics();
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(jobId?: string): ExecutionStats {
    const allMetrics = this.jobMonitor.getAllMetrics();

    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let retriedExecutions = 0;
    let timeoutExecutions = 0;
    let cancelledExecutions = 0;
    const allExecutionTimes: number[] = [];
    const executionsByHour = new Map<number, number>();
    const executionsByDay = new Map<string, number>();

    for (const metrics of allMetrics) {
      if (jobId && metrics.jobId !== jobId) {
        continue;
      }

      totalExecutions += metrics.totalExecutions;
      successfulExecutions += metrics.successfulExecutions;
      failedExecutions += metrics.failedExecutions;

      if (metrics.minExecutionTime !== Infinity) {
        allExecutionTimes.push(metrics.minExecutionTime);
      }
      allExecutionTimes.push(metrics.maxExecutionTime);
    }

    const avgExecutionTime = allExecutionTimes.length > 0
      ? this.average(allExecutionTimes)
      : 0;

    const minExecutionTime = allExecutionTimes.length > 0
      ? Math.min(...allExecutionTimes)
      : 0;

    const maxExecutionTime = allExecutionTimes.length > 0
      ? Math.max(...allExecutionTimes)
      : 0;

    const sortedTimes = [...allExecutionTimes].sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(sortedTimes);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      retriedExecutions,
      timeoutExecutions,
      cancelledExecutions,
      averageExecutionTime: avgExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      percentileExecutionTime: percentiles,
      executionsByHour,
      executionsByDay
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const schedulingMetrics = this.getSchedulingMetrics();
    const executionStats = this.getExecutionStats();

    const recentExecutions = this.getRecentExecutions(100);
    const avgLatency = this.average(
      recentExecutions.map((r) => {
        const scheduledTime = r.startedAt.getTime() - r.completedAt.getTime() + r.executionTime;
        return scheduledTime;
      })
    );

    return {
      schedulingAccuracy: 99.9, // TODO: Calculate actual accuracy
      schedulingLatency: avgLatency * 0.1,
      executionLatency: avgLatency,
      queueWaitTime: 0, // TODO: Track queue wait time
      resourceUtilization: schedulingMetrics.nodeUtilization * 100,
      throughput: schedulingMetrics.throughput,
      errorRate: executionStats.failedExecutions / Math.max(1, executionStats.totalExecutions),
      retryRate: executionStats.retriedExecutions / Math.max(1, executionStats.totalExecutions)
    };
  }

  /**
   * Get capacity planning data
   */
  getCapacityPlanning(): CapacityPlanning {
    const metrics = this.getSchedulingMetrics();
    const perfMetrics = this.getPerformanceMetrics();

    const currentCapacity = this.config.maxConcurrentExecutions || 100;
    const projectedCapacity = currentCapacity;
    const utilization = metrics.nodeUtilization;

    // Simple projection: assume linear growth
    const growthRate = this.calculateGrowthRate();
    const projectedUtilization = Math.min(1, utilization * (1 + growthRate));

    const recommendations: string[] = [];
    const scalingEvents: CapacityPlanning['scalingEvents'] = [];

    if (utilization > 0.9) {
      recommendations.push('High utilization detected. Consider scaling up.');
      scalingEvents.push({
        timestamp: new Date(),
        type: 'scale-up',
        reason: 'High utilization',
        fromNodes: currentCapacity,
        toNodes: Math.ceil(currentCapacity * 1.5)
      });
    } else if (utilization < 0.3) {
      recommendations.push('Low utilization detected. Consider scaling down to reduce costs.');
      scalingEvents.push({
        timestamp: new Date(),
        type: 'scale-down',
        reason: 'Low utilization',
        fromNodes: currentCapacity,
        toNodes: Math.ceil(currentCapacity * 0.7)
      });
    }

    if (perfMetrics.errorRate > 0.05) {
      recommendations.push('High error rate detected. Review job configurations and dependencies.');
    }

    if (perfMetrics.schedulingAccuracy < 99) {
      recommendations.push('Scheduling accuracy below target. Consider optimizing scheduler configuration.');
    }

    return {
      currentCapacity,
      projectedCapacity,
      utilization,
      projectedUtilization,
      recommendations,
      scalingEvents
    };
  }

  /**
   * Calculate growth rate
   */
  private calculateGrowthRate(): number {
    const recentExecutions = this.getRecentExecutions(1000);

    if (recentExecutions.length < 2) {
      return 0;
    }

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;

    const lastHour = recentExecutions.filter(
      (e) => e.completedAt.getTime() >= oneHourAgo
    ).length;

    const previousHour = recentExecutions.filter(
      (e) => e.completedAt.getTime() >= twoHoursAgo && e.completedAt.getTime() < oneHourAgo
    ).length;

    if (previousHour === 0) {
      return 0;
    }

    return (lastHour - previousHour) / previousHour;
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const metrics = this.getSchedulingMetrics();
    const perfMetrics = this.getPerformanceMetrics();
    const perfData = Array.from(this.performanceData.values());

    // Check for slow jobs
    const slowJobs = perfData.filter((j) => j.avgExecutionTime > 60000); // > 1 minute
    for (const job of slowJobs) {
      suggestions.push({
        type: 'execution',
        priority: job.avgExecutionTime > 300000 ? 'high' : 'medium',
        title: `Job ${job.jobName} has slow execution time`,
        description: `Average execution time is ${Math.round(job.avgExecutionTime / 1000)}s`,
        impact: 'Improving this job could increase overall throughput',
        effort: 'Medium',
        action: 'Review job logic for optimization opportunities, consider parallelization'
      });
    }

    // Check for high failure rates
    const failingJobs = perfData.filter((j) => j.failureRate > 0.1);
    for (const job of failingJobs) {
      suggestions.push({
        type: 'execution',
        priority: job.failureRate > 0.3 ? 'high' : 'medium',
        title: `Job ${job.jobName} has high failure rate`,
        description: `Failure rate is ${(job.failureRate * 100).toFixed(1)}%`,
        impact: 'Reducing failures will improve reliability and reduce retries',
        effort: 'Low',
        action: 'Review error logs and fix common failure causes'
      });
    }

    // Check scheduling accuracy
    if (perfMetrics.schedulingAccuracy < 99) {
      suggestions.push({
        type: 'scheduling',
        priority: 'medium',
        title: 'Scheduling accuracy below target',
        description: `Current accuracy: ${perfMetrics.schedulingAccuracy.toFixed(1)}%`,
        impact: 'Improving accuracy will ensure jobs run at expected times',
        effort: 'Medium',
        action: 'Review scheduler configuration and resource allocation'
      });
    }

    // Check resource utilization
    if (perfMetrics.resourceUtilization > 90) {
      suggestions.push({
        type: 'resource',
        priority: 'high',
        title: 'High resource utilization',
        description: `Resource utilization at ${perfMetrics.resourceUtilization.toFixed(1)}%`,
        impact: 'Adding resources will improve throughput and reduce delays',
        effort: 'Low',
        action: 'Scale up cluster or optimize resource allocation'
      });
    } else if (perfMetrics.resourceUtilization < 30) {
      suggestions.push({
        type: 'resource',
        priority: 'low',
        title: 'Low resource utilization',
        description: `Resource utilization at ${perfMetrics.resourceUtilization.toFixed(1)}%`,
        impact: 'Scaling down could reduce costs',
        effort: 'Low',
        action: 'Consider reducing cluster size to save costs'
      });
    }

    // Check error rate
    if (perfMetrics.errorRate > 0.05) {
      suggestions.push({
        type: 'execution',
        priority: 'high',
        title: 'High error rate detected',
        description: `Error rate is ${(perfMetrics.errorRate * 100).toFixed(1)}%`,
        impact: 'Reducing errors will improve reliability and reduce retries',
        effort: 'Medium',
        action: 'Review error logs and fix common failure causes'
      });
    }

    // Check retry rate
    if (perfMetrics.retryRate > 0.1) {
      suggestions.push({
        type: 'execution',
        priority: 'medium',
        title: 'High retry rate detected',
        description: `Retry rate is ${(perfMetrics.retryRate * 100).toFixed(1)}%`,
        impact: 'Reducing retries will improve efficiency and reduce costs',
        effort: 'Medium',
        action: 'Review retry policies and fix root causes of failures'
      });
    }

    return suggestions;
  }

  /**
   * Get recent executions
   */
  private getRecentExecutions(count: number): JobResult[] {
    const allResults: JobResult[] = [];

    for (const history of this.executionHistory.values()) {
      allResults.push(...history);
    }

    return allResults
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, count);
  }

  /**
   * Get job performance data
   */
  getJobPerformanceData(jobId: string): JobPerformanceData | undefined {
    return this.performanceData.get(jobId);
  }

  /**
   * Get all performance data
   */
  getAllPerformanceData(): JobPerformanceData[] {
    return Array.from(this.performanceData.values());
  }

  /**
   * Get time series data
   */
  getTimeSeriesData(jobId: string): TimeSeriesPoint[] {
    return this.timeSeriesData.get(jobId) || [];
  }

  /**
   * Record resource utilization
   */
  recordResourceUtilization(data: ResourceUtilizationData): void {
    this.resourceUtilizationHistory.push(data);

    // Trim history
    const maxSize = 10000;
    if (this.resourceUtilizationHistory.length > maxSize) {
      this.resourceUtilizationHistory.splice(
        0,
        this.resourceUtilizationHistory.length - maxSize
      );
    }
  }

  /**
   * Get resource utilization history
   */
  getResourceUtilizationHistory(
    hours: number = 24
  ): ResourceUtilizationData[] {
    const cutoff = Date.now() - hours * 3600000;

    return this.resourceUtilizationHistory.filter(
      (d) => d.timestamp.getTime() >= cutoff
    );
  }

  /**
   * Start aggregation timer
   */
  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.aggregateData();
    }, this.config.aggregationInterval!);
  }

  /**
   * Aggregate data
   */
  private aggregateData(): void {
    this.logger.debug('Aggregating analytics data');

    // Update all performance data
    for (const jobId of this.executionHistory.keys()) {
      this.updatePerformanceData(jobId);
    }

    // Cleanup old data
    this.cleanupOldData();
  }

  /**
   * Cleanup old data
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - (this.config.retentionDays! * 24 * 60 * 60 * 1000);

    // Cleanup execution history
    for (const [jobId, history] of this.executionHistory) {
      const filtered = history.filter((r) => r.completedAt.getTime() >= cutoff);
      this.executionHistory.set(jobId, filtered);
    }

    // Cleanup time series data
    for (const [jobId, series] of this.timeSeriesData) {
      const filtered = series.filter((p) => p.timestamp.getTime() >= cutoff);
      this.timeSeriesData.set(jobId, filtered);
    }

    // Cleanup resource utilization history
    this.resourceUtilizationHistory = this.resourceUtilizationHistory.filter(
      (d) => d.timestamp.getTime() >= cutoff
    );
  }

  /**
   * Stop analytics
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }

    this.logger.info('Analytics stopped');
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[SchedulingAnalytics] DEBUG: ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[SchedulingAnalytics] INFO: ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[SchedulingAnalytics] WARN: ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[SchedulingAnalytics] ERROR: ${message}`, ...args);
      }
    };
  }

  /**
   * Generate report
   */
  generateReport(): {
    summary: any;
    metrics: SchedulingMetrics;
    performance: PerformanceMetrics;
    capacity: CapacityPlanning;
    suggestions: OptimizationSuggestion[];
  } {
    return {
      summary: this.getStatistics(),
      metrics: this.getSchedulingMetrics(),
      performance: this.getPerformanceMetrics(),
      capacity: this.getCapacityPlanning(),
      suggestions: this.getOptimizationSuggestions()
    };
  }

  /**
   * Get statistics
   */
  private getStatistics(): {
    totalJobs: number;
    totalExecutions: number;
    totalDataPoints: number;
    dataRetention: number;
  } {
    let totalExecutions = 0;
    let totalDataPoints = 0;

    for (const history of this.executionHistory.values()) {
      totalExecutions += history.length;
    }

    for (const series of this.timeSeriesData.values()) {
      totalDataPoints += series.length;
    }

    return {
      totalJobs: this.executionHistory.size,
      totalExecutions,
      totalDataPoints,
      dataRetention: this.config.retentionDays!
    };
  }
}
