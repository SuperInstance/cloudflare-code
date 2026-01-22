// @ts-nocheck
import { EventEmitter } from 'eventemitter3';
import * as cron from 'node-cron';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ScheduledExport,
  SchedulerOptions,
  ExportRecord,
  ExportJob,
  ExportResult,
  ExportOptions,
  FormatEngine,
  BatchExporter
} from '../types';
import { FormatEngineImpl } from '../formats/engine';
import { BatchExporterImpl } from '../batch/exporter';
import { addSeconds, addMinutes, addHours, addDays, addWeeks, addMonths, isAfter } from 'date-fns';

export interface ScheduleEvent {
  type: 'scheduled' | 'completed' | 'failed' | 'paused' | 'resumed';
  scheduleId: string;
  timestamp: Date;
  data?: any;
}

export class Scheduler extends EventEmitter {
  private schedules: Map<string, ScheduledExport> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private formatEngine: FormatEngine;
  private batchExporter: BatchExporter;
  private isRunning: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;
  private maxConcurrent: number = 5;
  private runningJobs: Map<string, Promise<ExportJob>> = new Map();

  constructor(
    formatEngine?: FormatEngine,
    batchExporter?: BatchExporter,
    maxConcurrent: number = 5
  ) {
    super();
    this.formatEngine = formatEngine || new FormatEngineImpl();
    this.batchExporter = batchExporter || new BatchExporterImpl(this.formatEngine);
    this.maxConcurrent = maxConcurrent;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.batchExporter.on('job-complete', (job: ExportJob) => {
      this.handleJobCompletion(job);
    });

    this.batchExporter.on('job-error', (job: ExportJob) => {
      this.handleJobError(job);
    });
  }

  schedule(config: ScheduledExport): string {
    const scheduleId = this.generateScheduleId();
    const normalizedConfig = this.normalizeScheduleConfig(config);

    const scheduledExport: ScheduledExport = {
      ...normalizedConfig,
      id: scheduleId,
      nextRun: this.calculateNextRun(normalizedConfig.config),
      history: []
    };

    this.schedules.set(scheduleId, scheduledExport);

    try {
      const cronExpression = this.buildCronExpression(normalizedConfig.config);
      const job = cron.schedule(cronExpression, async () => {
        await this.executeScheduledExport(scheduleId);
      }, {
        scheduled: false
      });

      this.cronJobs.set(scheduleId, job);
      job.start();

      this.emit('schedule-created', { scheduleId, config: normalizedConfig });
      this.logEvent('scheduled', scheduleId, { action: 'created' });

      return scheduleId;
    } catch (error) {
      this.schedules.delete(scheduleId);
      throw error;
    }
  }

  unschedule(id: string): boolean {
    const cronJob = this.cronJobs.get(id);
    const schedule = this.schedules.get(id);

    if (!cronJob || !schedule) {
      return false;
    }

    try {
      cronJob.stop();
      this.cronJobs.delete(id);
      this.schedules.delete(id);
      this.runningJobs.delete(id);

      this.emit('schedule-removed', { scheduleId: id });
      this.logEvent('scheduled', id, { action: 'removed' });

      return true;
    } catch (error) {
      this.emit('schedule-error', { scheduleId: id, error });
      return false;
    }
  }

  getSchedule(id: string): ScheduledExport | null {
    return this.schedules.get(id) || null;
  }

  listSchedules(): ScheduledExport[] {
    return Array.from(this.schedules.values());
  }

  pause(id: string): boolean {
    const cronJob = this.cronJobs.get(id);
    const schedule = this.schedules.get(id);

    if (!cronJob || !schedule) {
      return false;
    }

    try {
      cronJob.stop();
      schedule.status = 'paused';
      this.schedules.set(id, schedule);

      this.emit('schedule-paused', { scheduleId: id });
      this.logEvent('scheduled', id, { action: 'paused' });

      return true;
    } catch (error) {
      this.emit('schedule-error', { scheduleId: id, error });
      return false;
    }
  }

  resume(id: string): boolean {
    const cronJob = this.cronJobs.get(id);
    const schedule = this.schedules.get(id);

    if (!cronJob || !schedule) {
      return false;
    }

    try {
      cronJob.start();
      schedule.status = 'active';
      this.schedules.set(id, schedule);

      this.emit('schedule-resumed', { scheduleId: id });
      this.logEvent('scheduled', id, { action: 'resumed' });

      return true;
    } catch (error) {
      this.emit('schedule-error', { scheduleId: id, error });
      return false;
    }
  }

  private async executeScheduledExport(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || schedule.status !== 'active') {
      return;
    }

    if (this.runningJobs.size >= this.maxConcurrent) {
      this.emit('schedule-queue-full', { scheduleId, queueSize: this.runningJobs.size });
      return;
    }

    try {
      const exportJob = this.createExportJob(schedule);
      const jobPromise = this.runExportJob(schedule, exportJob);
      this.runningJobs.set(scheduleId, jobPromise);

      await jobPromise;
    } catch (error) {
      this.emit('schedule-execution-error', { scheduleId, error });
      this.logEvent('scheduled', scheduleId, { action: 'execution_error', error });
    } finally {
      this.runningJobs.delete(scheduleId);
    }
  }

  private createExportJob(schedule: ScheduledExport): ExportJob {
    const now = new Date();
    const jobId = `scheduled-${schedule.id}-${now.getTime()}`;

    return {
      id: jobId,
      name: schedule.name,
      data: [], // Will be populated when executed
      options: {
        format: 'json', // Default format, will be overridden
        includeHeaders: true
      },
      status: 'pending',
      progress: 0,
      startTime: now
    };
  }

  private async runExportJob(schedule: ScheduledExport, job: ExportJob): Promise<ExportJob> {
    try {
      job.status = 'processing';
      this.emit('schedule-job-start', { scheduleId: schedule.id, job });

      let data: ExportRecord[];

      if (typeof schedule.data === 'function') {
        data = await schedule.data();
      } else {
        data = schedule.data;
      }

      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      // Apply the export options from the schedule if available
      if (schedule.config?.cronExpression) {
        // For scheduled exports, use appropriate defaults
        job.options.format = this.inferBestFormat(schedule);
      }

      const batchResult = await this.batchExporter.export(data, job.options);

      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 100;

      // Update schedule history
      schedule.lastRun = new Date();
      schedule.nextRun = this.calculateNextRun(schedule.config);
      schedule.history.push(job);
      this.schedules.set(schedule.id, schedule);

      this.emit('schedule-job-complete', { scheduleId: schedule.id, job, batchResult });
      this.logEvent('completed', schedule.id, {
        recordCount: data.length,
        duration: job.endTime.getTime() - job.startTime!.getTime()
      });

      return job;

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : String(error);

      // Update schedule history
      schedule.lastRun = new Date();
      schedule.history.push(job);
      this.schedules.set(schedule.id, schedule);

      this.emit('schedule-job-failed', { scheduleId: schedule.id, job, error });
      this.logEvent('failed', schedule.id, { error: job.error });

      throw error;
    }
  }

  private inferBestFormat(schedule: ScheduledExport): any {
    // Simple heuristic to determine best export format
    const now = new Date();
    const dayOfWeek = now.getDay();

    // CSV for daily exports
    if (schedule.config?.frequency === 'daily') {
      return 'csv';
    }

    // JSON for weekly exports
    if (schedule.config?.frequency === 'weekly') {
      return 'json';
    }

    // Excel for monthly exports
    if (schedule.config?.frequency === 'monthly') {
      return 'excel';
    }

    // Default to CSV
    return 'csv';
  }

  private handleJobCompletion(job: ExportJob): void {
    // Handle any post-completion tasks for scheduled exports
    this.emit('scheduled-job-complete', job);
  }

  private handleJobError(job: ExportJob): void {
    // Handle any error recovery for scheduled exports
    this.emit('scheduled-job-error', job);
  }

  private normalizeScheduleConfig(config: ScheduledExport): ScheduledExport {
    const normalized = { ...config };

    if (!normalized.config) {
      normalized.config = {};
    }

    // Set defaults
    normalized.config.timezone = normalized.config.timezone || 'UTC';
    normalized.config.maxConcurrent = normalized.config.maxConcurrent || this.maxConcurrent;
    normalized.config.cleanupInterval = normalized.config.cleanupInterval || 24 * 60 * 60 * 1000; // 24 hours

    return normalized;
  }

  private calculateNextRun(config: SchedulerOptions): Date | null {
    if (!config?.frequency) {
      return null;
    }

    const now = new Date();

    switch (config.frequency) {
      case 'once':
        // One-time exports run immediately
        return now;

      case 'hourly':
        return addHours(now, 1);

      case 'daily':
        if (config.schedule?.time) {
          const [hours, minutes] = config.schedule.time.split(':').map(Number);
          const nextRun = new Date(now);
          nextRun.setHours(hours, minutes || 0, 0, 0);

          if (isAfter(nextRun, now)) {
            return nextRun;
          }
          return addDays(nextRun, 1);
        }
        return addDays(now, 1);

      case 'weekly':
        if (config.schedule?.dayOfWeek !== undefined) {
          const nextRun = new Date(now);
          nextRun.setDate(now.getDate() + (config.schedule.dayOfWeek - now.getDay() + 7) % 7);

          if (config.schedule?.time) {
            const [hours, minutes] = config.schedule.time.split(':').map(Number);
            nextRun.setHours(hours, minutes || 0, 0, 0);
          }

          if (isAfter(nextRun, now)) {
            return nextRun;
          }
          return addWeeks(nextRun, 1);
        }
        return addWeeks(now, 1);

      case 'monthly':
        if (config.schedule?.dayOfMonth !== undefined) {
          const nextRun = new Date(now);
          nextRun.setDate(config.schedule.dayOfMonth);

          if (config.schedule?.time) {
            const [hours, minutes] = config.schedule.time.split(':').map(Number);
            nextRun.setHours(hours, minutes || 0, 0, 0);
          }

          if (isAfter(nextRun, now)) {
            return nextRun;
          }
          return addMonths(nextRun, 1);
        }
        return addMonths(now, 1);

      default:
        return null;
    }
  }

  private buildCronExpression(config: SchedulerOptions): string {
    if (config.cronExpression) {
      return config.cronExpression;
    }

    switch (config.frequency) {
      case 'hourly':
        return '0 * * * *';

      case 'daily':
        if (config.schedule?.time) {
          const [hours, minutes] = config.schedule.time.split(':');
          return `${minutes || '0'} ${hours} * * *`;
        }
        return '0 0 * * *';

      case 'weekly':
        if (config.schedule?.dayOfWeek !== undefined && config.schedule?.time) {
          const [hours, minutes] = config.schedule.time.split(':');
          return `${minutes || '0'} ${hours} * * ${config.schedule.dayOfWeek}`;
        }
        return '0 0 * * 0';

      case 'monthly':
        if (config.schedule?.dayOfMonth !== undefined && config.schedule?.time) {
          const [hours, minutes] = config.schedule.time.split(':');
          return `${minutes || '0'} ${hours} ${config.schedule.dayOfMonth} * *`;
        }
        return '0 0 1 * *';

      default:
        return '0 * * * *'; // Default to hourly
    }
  }

  private generateScheduleId(): string {
    return `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private logEvent(type: 'scheduled' | 'completed' | 'failed' | 'paused' | 'resumed', scheduleId: string, data: any): void {
    const event: ScheduleEvent = {
      type,
      scheduleId,
      timestamp: new Date(),
      data
    };

    this.emit('schedule-event', event);
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start cleanup interval
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldExports();
    }, cleanupInterval);

    this.emit('scheduler-started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop all cron jobs
    for (const [scheduleId, cronJob] of this.cronJobs) {
      cronJob.stop();
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.emit('scheduler-stopped');
  }

  private async cleanupOldExports(): Promise<void> {
    const retentionDays = 30; // Keep exports for 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let cleanedCount = 0;

    for (const [scheduleId, schedule] of this.schedules) {
      // Remove old history entries
      schedule.history = schedule.history.filter(job =>
        job.startTime && job.startTime > cutoffDate
      );

      // Update schedule
      this.schedules.set(scheduleId, schedule);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      this.emit('cleanup-completed', { cleanedCount, cutoffDate });
    }
  }

  updateMaxConcurrent(newLimit: number): void {
    this.maxConcurrent = newLimit;
    this.emit('max-concurrent-updated', { newLimit });
  }

  getStats(): {
    totalSchedules: number;
    activeSchedules: number;
    pausedSchedules: number;
    runningJobs: number;
    memoryUsage: number;
  } {
    const activeSchedules = Array.from(this.schedules.values()).filter(s => s.status === 'active').length;
    const pausedSchedules = Array.from(this.schedules.values()).filter(s => s.status === 'paused').length;

    return {
      totalSchedules: this.schedules.size,
      activeSchedules,
      pausedSchedules,
      runningJobs: this.runningJobs.size,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.batchExporter.cleanup('all');
    this.emit('scheduler-shutdown');
  }
}