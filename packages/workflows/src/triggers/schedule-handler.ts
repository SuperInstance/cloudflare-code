// @ts-nocheck
/**
 * Schedule Handler - handles scheduled triggers using cron
 */

import { CronJob } from 'cron';
import type { Trigger, TriggerCallback, TriggerId, ScheduleTriggerConfig } from '../types';

export class ScheduleHandler {
  private schedules: Map<TriggerId, ScheduledTrigger>;
  private cronJobs: Map<TriggerId, CronJob>;

  constructor() {
    this.schedules = new Map();
    this.cronJobs = new Map();
  }

  /**
   * Register a schedule trigger
   */
  public async register(
    trigger: Trigger,
    callback: TriggerCallback
  ): Promise<void> {
    const config = trigger.config as ScheduleTriggerConfig;

    if (!trigger.enabled) {
      // Don't start cron job if trigger is disabled
      this.schedules.set(trigger.id, {
        trigger,
        config,
        callback
      });
      return;
    }

    let cronJob: CronJob | null = null;

    switch (config.scheduleType) {
      case 'cron':
        if (config.cron) {
          cronJob = new CronJob(
            config.cron,
            () => this.executeCallback(trigger.id, callback),
            null,
            true,
            config.timezone || 'UTC'
          );
        }
        break;

      case 'interval':
        if (config.interval) {
          const intervalMs = this.convertIntervalToMs(config.interval, config.intervalUnit || 'minutes');
          const cronPattern = this.intervalToCron(intervalMs);
          cronJob = new CronJob(
            cronPattern,
            () => this.executeCallback(trigger.id, callback),
            null,
            true,
            config.timezone || 'UTC'
          );
        }
        break;

      case 'once':
        if (config.runAt) {
          const runAtDate = new Date(config.runAt);
          const now = new Date();

          if (runAtDate > now) {
            const delay = runAtDate.getTime() - now.getTime();
            setTimeout(() => this.executeCallback(trigger.id, callback), delay);
          }
        }
        break;
    }

    if (cronJob) {
      this.cronJobs.set(trigger.id, cronJob);
    }

    this.schedules.set(trigger.id, {
      trigger,
      config,
      callback,
      cronJob
    });
  }

  /**
   * Unregister a schedule trigger
   */
  public async unregister(triggerId: TriggerId): Promise<void> {
    const scheduledTrigger = this.schedules.get(triggerId);

    if (scheduledTrigger?.cronJob) {
      scheduledTrigger.cronJob.stop();
      this.cronJobs.delete(triggerId);
    }

    this.schedules.delete(triggerId);
  }

  /**
   * Pause a schedule trigger
   */
  public async pause(triggerId: TriggerId): Promise<void> {
    const cronJob = this.cronJobs.get(triggerId);
    if (cronJob) {
      cronJob.stop();
    }
  }

  /**
   * Resume a schedule trigger
   */
  public async resume(triggerId: TriggerId): Promise<void> {
    const cronJob = this.cronJobs.get(triggerId);
    if (cronJob) {
      cronJob.start();
    }
  }

  /**
   * Execute the callback
   */
  private async executeCallback(
    triggerId: TriggerId,
    callback: TriggerCallback
  ): Promise<void> {
    const scheduledTrigger = this.schedules.get(triggerId);

    if (scheduledTrigger) {
      await callback(triggerId, {
        triggeredAt: new Date(),
        schedule: scheduledTrigger.config
      });
    }
  }

  /**
   * Convert interval to milliseconds
   */
  private convertIntervalToMs(
    interval: number,
    unit: string
  ): number {
    switch (unit) {
      case 'seconds':
        return interval * 1000;
      case 'minutes':
        return interval * 60 * 1000;
      case 'hours':
        return interval * 60 * 60 * 1000;
      case 'days':
        return interval * 24 * 60 * 60 * 1000;
      default:
        return interval * 60 * 1000; // Default to minutes
    }
  }

  /**
   * Convert interval to cron pattern
   */
  private intervalToCron(intervalMs: number): string {
    const seconds = Math.floor(intervalMs / 1000);

    if (seconds < 60) {
      return `*/${seconds} * * * * *`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `0 */${minutes} * * * *`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `0 0 */${hours} * * *`;
    }

    return `0 0 0 * * *`;
  }

  /**
   * Get schedule statistics
   */
  public getStats(): {
    totalSchedules: number;
    activeSchedules: number;
    schedulesByType: Record<string, number>;
  } {
    const schedulesByType: Record<string, number> = {
      cron: 0,
      interval: 0,
      once: 0
    };

    let activeSchedules = 0;

    for (const scheduledTrigger of this.schedules.values()) {
      schedulesByType[scheduledTrigger.config.scheduleType]++;
      if (this.cronJobs.has(scheduledTrigger.trigger.id)) {
        activeSchedules++;
      }
    }

    return {
      totalSchedules: this.schedules.size,
      activeSchedules,
      schedulesByType
    };
  }

  /**
   * Cleanup
   */
  public async cleanup(): Promise<void> {
    for (const cronJob of this.cronJobs.values()) {
      cronJob.stop();
    }

    this.schedules.clear();
    this.cronJobs.clear();
  }
}

interface ScheduledTrigger {
  trigger: Trigger;
  config: ScheduleTriggerConfig;
  callback: TriggerCallback;
  cronJob?: CronJob;
}
