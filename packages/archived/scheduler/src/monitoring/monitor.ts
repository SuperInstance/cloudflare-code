/**
 * Job Monitor
 * Tracks job execution, status updates, metrics, logs, notifications, history, and analytics
 */

import {
  Job,
  JobStatus,
  JobResult,
  JobNotification,
  Logger,
  ExecutionHistoryEntry,
  SchedulingMetrics
} from '../types';

/**
 * Configuration for job monitor
 */
export interface JobMonitorConfig {
  retentionDays?: number;
  maxHistorySize?: number;
  enableNotifications?: boolean;
  notificationRecipients?: string[];
  logger?: Logger;
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  jobId: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Job metrics
 */
export interface JobMetrics {
  jobId: string;
  jobName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastExecution?: Date;
  lastStatus?: JobStatus;
  successRate: number;
  failureRate: number;
}

/**
 * Job monitor class
 */
export class JobMonitor {
  private config: JobMonitorConfig;
  private logger: Logger;
  private jobHistory: Map<string, ExecutionHistoryEntry[]>;
  private jobLogs: Map<string, LogEntry[]>;
  private jobMetrics: Map<string, JobMetrics>;
  private activeJobs: Map<string, Job>;
  private notifications: JobNotification[];
  private statusChangeCallbacks: Map<string, Set<(status: JobStatus) => void>>;
  private completionCallbacks: Map<string, Set<(result: JobResult) => void>>;
  private failureCallbacks: Map<string, Set<(error: Error) => void>>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: JobMonitorConfig = {}) {
    this.config = {
      retentionDays: config.retentionDays || 7,
      maxHistorySize: config.maxHistorySize || 1000,
      enableNotifications: config.enableNotifications ?? true,
      notificationRecipients: config.notificationRecipients || []
    };

    this.logger = config.logger || this.createDefaultLogger();

    this.jobHistory = new Map();
    this.jobLogs = new Map();
    this.jobMetrics = new Map();
    this.activeJobs = new Map();
    this.notifications = [];

    this.statusChangeCallbacks = new Map();
    this.completionCallbacks = new Map();
    this.failureCallbacks = new Map();

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Track a job
   */
  trackJob(job: Job): void {
    this.activeJobs.set(job.id, job);
    this.addLog(job.id, 'info', `Job tracking started: ${job.name}`);

    // Initialize metrics if not exists
    if (!this.jobMetrics.has(job.definitionId)) {
      this.jobMetrics.set(job.definitionId, {
        jobId: job.definitionId,
        jobName: job.name,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        successRate: 0,
        failureRate: 0
      });
    }

    this.logger.debug(`Tracking job: ${job.id}`);
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId: string, status: JobStatus, metadata?: Record<string, any>): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      this.logger.warn(`Cannot update status for unknown job: ${jobId}`);
      return;
    }

    const oldStatus = job.status;
    job.status = status;
    job.updatedAt = new Date();

    this.addLog(jobId, 'info', `Status changed: ${oldStatus} -> ${status}`, metadata);

    // Trigger callbacks
    const callbacks = this.statusChangeCallbacks.get(jobId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(status);
        } catch (error) {
          this.logger.error(`Status callback error for job ${jobId}:`, error);
        }
      }
    }

    // Create notification for important status changes
    if (this.config.enableNotifications) {
      this.createNotification(jobId, status as any);
    }

    // Update metrics if job completed
    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      this.recordCompletion(job, status);
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Record job completion
   */
  private recordCompletion(job: Job, status: JobStatus): void {
    const metrics = this.jobMetrics.get(job.definitionId);
    if (!metrics) {
      return;
    }

    metrics.totalExecutions++;
    metrics.lastExecution = new Date();
    metrics.lastStatus = status;

    if (status === JobStatus.COMPLETED && job.executionTime) {
      metrics.successfulExecutions++;
      metrics.averageExecutionTime =
        (metrics.averageExecutionTime * (metrics.successfulExecutions - 1) + job.executionTime) /
        metrics.successfulExecutions;
      metrics.minExecutionTime = Math.min(metrics.minExecutionTime, job.executionTime);
      metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, job.executionTime);
    } else if (status === JobStatus.FAILED) {
      metrics.failedExecutions++;
    }

    metrics.successRate = metrics.totalExecutions > 0
      ? metrics.successfulExecutions / metrics.totalExecutions
      : 0;
    metrics.failureRate = metrics.totalExecutions > 0
      ? metrics.failedExecutions / metrics.totalExecutions
      : 0;

    // Add to history
    this.addToHistory(job, status);
  }

  /**
   * Add execution to history
   */
  private addToHistory(job: Job, status: JobStatus): void {
    const entry: ExecutionHistoryEntry = {
      jobId: job.id,
      jobName: job.name,
      executionTime: job.startedAt || new Date(),
      scheduledTime: job.scheduledTime,
      completedAt: job.completedAt || new Date(),
      status,
      duration: job.executionTime || 0,
      attemptNumber: job.attemptNumber,
      node: '',
      result: job.result
    };

    let history = this.jobHistory.get(job.definitionId);
    if (!history) {
      history = [];
      this.jobHistory.set(job.definitionId, history);
    }

    history.push(entry);

    // Trim history if too large
    if (history.length > this.config.maxHistorySize!) {
      history.shift();
    }
  }

  /**
   * Add log entry
   */
  addLog(jobId: string, level: LogEntry['level'], message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      jobId,
      message,
      metadata
    };

    let logs = this.jobLogs.get(jobId);
    if (!logs) {
      logs = [];
      this.jobLogs.set(jobId, logs);
    }

    logs.push(entry);

    // Trim logs if too large
    if (logs.length > 1000) {
      logs.shift();
    }

    // Also log to console
    switch (level) {
      case 'debug':
        this.logger.debug(`[Job ${jobId}] ${message}`, metadata);
        break;
      case 'info':
        this.logger.info(`[Job ${jobId}] ${message}`, metadata);
        break;
      case 'warn':
        this.logger.warn(`[Job ${jobId}] ${message}`, metadata);
        break;
      case 'error':
        this.logger.error(`[Job ${jobId}] ${message}`, metadata);
        break;
    }
  }

  /**
   * Create notification
   */
  private createNotification(jobId: string, type: JobNotification['type']): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return;
    }

    const notification: JobNotification = {
      jobId,
      jobName: job.name,
      type,
      timestamp: new Date(),
      message: this.getNotificationMessage(type, job),
      metadata: job.metadata,
      recipients: this.config.notificationRecipients
    };

    this.notifications.push(notification);

    // Trim notifications
    if (this.notifications.length > 1000) {
      this.notifications.shift();
    }

    this.logger.info(`Notification created: ${type} for job ${jobId}`);
  }

  /**
   * Get notification message
   */
  private getNotificationMessage(type: JobNotification['type'], job: Job): string {
    switch (type) {
      case 'started':
        return `Job ${job.name} (${job.id}) has started execution`;
      case 'completed':
        return `Job ${job.name} (${job.id}) completed successfully`;
      case 'failed':
        return `Job ${job.name} (${job.id}) failed: ${job.error?.message || 'Unknown error'}`;
      case 'timeout':
        return `Job ${job.name} (${job.id}) timed out after ${job.executionTime}ms`;
      case 'retrying':
        return `Job ${job.name} (${job.id}) is being retried (attempt ${job.attemptNumber})`;
      default:
        return `Job ${job.name} (${job.id}) status: ${type}`;
    }
  }

  /**
   * Get job logs
   */
  getJobLogs(jobId: string, level?: LogEntry['level']): LogEntry[] {
    const logs = this.jobLogs.get(jobId) || [];

    if (level) {
      return logs.filter((log) => log.level === level);
    }

    return [...logs];
  }

  /**
   * Get job history
   */
  getJobHistory(jobDefinitionId: string): ExecutionHistoryEntry[] {
    return this.jobHistory.get(jobDefinitionId) || [];
  }

  /**
   * Get job metrics
   */
  getJobMetrics(jobDefinitionId: string): JobMetrics | undefined {
    return this.jobMetrics.get(jobDefinitionId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): JobMetrics[] {
    return Array.from(this.jobMetrics.values());
  }

  /**
   * Get notifications
   */
  getNotifications(count?: number): JobNotification[] {
    if (count) {
      return this.notifications.slice(-count);
    }
    return [...this.notifications];
  }

  /**
   * Get scheduling metrics
   */
  getSchedulingMetrics(): SchedulingMetrics {
    let totalJobs = 0;
    let pendingJobs = 0;
    let runningJobs = 0;
    let completedJobs = 0;
    let failedJobs = 0;
    let cancelledJobs = 0;
    let totalExecutionTime = 0;
    let successfulExecutions = 0;

    for (const metrics of this.jobMetrics.values()) {
      totalJobs += metrics.totalExecutions;
      successfulExecutions += metrics.successfulExecutions;
      totalExecutionTime += metrics.averageExecutionTime * metrics.totalExecutions;
    }

    for (const job of this.activeJobs.values()) {
      switch (job.status) {
        case JobStatus.PENDING:
          pendingJobs++;
          break;
        case JobStatus.QUEUED:
          pendingJobs++;
          break;
        case JobStatus.RUNNING:
          runningJobs++;
          break;
        case JobStatus.COMPLETED:
          completedJobs++;
          break;
        case JobStatus.FAILED:
          failedJobs++;
          break;
        case JobStatus.CANCELLED:
          cancelledJobs++;
          break;
      }
    }

    const averageExecutionTime = totalJobs > 0 ? totalExecutionTime / totalJobs : 0;
    const successRate = totalJobs > 0 ? successfulExecutions / totalJobs : 0;
    const queueDepth = pendingJobs;

    // Calculate throughput (jobs per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentCompletions = this.getRecentCompletions(oneMinuteAgo);
    const throughput = recentCompletions.length;

    return {
      totalJobs,
      pendingJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      cancelledJobs,
      averageExecutionTime,
      successRate,
      throughput,
      queueDepth,
      nodeUtilization: runningJobs / Math.max(1, this.activeJobs.size)
    };
  }

  /**
   * Get recent completions
   */
  private getRecentCompletions(since: number): ExecutionHistoryEntry[] {
    const recent: ExecutionHistoryEntry[] = [];

    for (const history of this.jobHistory.values()) {
      for (const entry of history) {
        if (entry.completedAt.getTime() >= since) {
          recent.push(entry);
        }
      }
    }

    return recent;
  }

  /**
   * Register status change callback
   */
  onStatusChange(jobId: string, callback: (status: JobStatus) => void): void {
    if (!this.statusChangeCallbacks.has(jobId)) {
      this.statusChangeCallbacks.set(jobId, new Set());
    }

    this.statusChangeCallbacks.get(jobId)!.add(callback);
  }

  /**
   * Register completion callback
   */
  onComplete(jobId: string, callback: (result: JobResult) => void): void {
    if (!this.completionCallbacks.has(jobId)) {
      this.completionCallbacks.set(jobId, new Set());
    }

    this.completionCallbacks.get(jobId)!.add(callback);
  }

  /**
   * Register failure callback
   */
  onFailure(jobId: string, callback: (error: Error) => void): void {
    if (!this.failureCallbacks.has(jobId)) {
      this.failureCallbacks.set(jobId, new Set());
    }

    this.failureCallbacks.get(jobId)!.add(callback);
  }

  /**
   * Remove callbacks
   */
  removeCallbacks(jobId: string): void {
    this.statusChangeCallbacks.delete(jobId);
    this.completionCallbacks.delete(jobId);
    this.failureCallbacks.delete(jobId);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every hour
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 3600000);
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const cutoff = Date.now() - (this.config.retentionDays! * 24 * 60 * 60 * 1000);

    // Cleanup old history entries
    for (const [jobId, history] of this.jobHistory) {
      const filtered = history.filter(
        (entry) => entry.completedAt.getTime() >= cutoff
      );

      if (filtered.length < history.length) {
        this.jobHistory.set(jobId, filtered);
        this.logger.debug(`Cleaned up ${history.length - filtered.length} old history entries for job ${jobId}`);
      }
    }

    // Cleanup old logs
    for (const [jobId, logs] of this.jobLogs) {
      const filtered = logs.filter(
        (log) => log.timestamp.getTime() >= cutoff
      );

      if (filtered.length < logs.length) {
        this.jobLogs.set(jobId, filtered);
        this.logger.debug(`Cleaned up ${logs.length - filtered.length} old logs for job ${jobId}`);
      }
    }

    // Cleanup old notifications
    const beforeLength = this.notifications.length;
    this.notifications = this.notifications.filter(
      (notif) => notif.timestamp.getTime() >= cutoff
    );

    if (this.notifications.length < beforeLength) {
      this.logger.debug(`Cleaned up ${beforeLength - this.notifications.length} old notifications`);
    }
  }

  /**
   * Stop the monitor
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.logger.info('Job monitor stopped');
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[JobMonitor] DEBUG: ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[JobMonitor] INFO: ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[JobMonitor] WARN: ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[JobMonitor] ERROR: ${message}`, ...args);
      }
    };
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): Job[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get statistics summary
   */
  getStatisticsSummary(): {
    totalJobsTracked: number;
    totalExecutions: number;
    totalNotifications: number;
    totalLogEntries: number;
    activeJobsCount: number;
  } {
    let totalExecutions = 0;
    let totalLogEntries = 0;

    for (const metrics of this.jobMetrics.values()) {
      totalExecutions += metrics.totalExecutions;
    }

    for (const logs of this.jobLogs.values()) {
      totalLogEntries += logs.length;
    }

    return {
      totalJobsTracked: this.jobMetrics.size,
      totalExecutions,
      totalNotifications: this.notifications.length,
      totalLogEntries,
      activeJobsCount: this.activeJobs.size
    };
  }
}
