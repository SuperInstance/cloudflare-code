/**
 * Purge Scheduler
 *
 * Scheduled cache invalidation with cron-like support.
 */

import cron from 'node-cron';
import type { PurgeType } from '../types/index.js';
import { InvalidationEngine } from './engine.js';

interface IScheduledPurge {
  id: string;
  name: string;
  type: PurgeType;
  targets: string[];
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
}

export class PurgeScheduler {
  private engine: InvalidationEngine;
  private tasks: Map<string, cron.ScheduledTask>;
  private schedules: Map<string, IScheduledPurge>;

  constructor(engine: InvalidationEngine) {
    this.engine = engine;
    this.tasks = new Map();
    this.schedules = new Map();
  }

  /**
   * Add scheduled purge
   */
  public addSchedule(config: {
    name: string;
    type: PurgeType;
    targets: string[];
    schedule: string;
    enabled?: boolean;
  }): string {
    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const schedule: IScheduledPurge = {
      id,
      name: config.name,
      type: config.type,
      targets: config.targets,
      schedule: config.schedule,
      enabled: config.enabled ?? true,
      runCount: 0
    };

    this.schedules.set(id, schedule);

    if (schedule.enabled) {
      this.startSchedule(id);
    }

    return id;
  }

  /**
   * Remove scheduled purge
   */
  public removeSchedule(id: string): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    this.stopSchedule(id);
    this.schedules.delete(id);

    return true;
  }

  /**
   * Enable schedule
   */
  public enableSchedule(id: string): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    schedule.enabled = true;
    this.startSchedule(id);

    return true;
  }

  /**
   * Disable schedule
   */
  public disableSchedule(id: string): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    schedule.enabled = false;
    this.stopSchedule(id);

    return true;
  }

  /**
   * Get schedule
   */
  public getSchedule(id: string): IScheduledPurge | null {
    return this.schedules.get(id) ?? null;
  }

  /**
   * Get all schedules
   */
  public getAllSchedules(): IScheduledPurge[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Update schedule
   */
  public updateSchedule(
    id: string,
    updates: Partial<Pick<IScheduledPurge, 'name' | 'targets' | 'schedule' | 'enabled'>>
  ): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    // Stop existing task
    this.stopSchedule(id);

    // Update schedule
    Object.assign(schedule, updates);

    // Restart if enabled
    if (schedule.enabled) {
      this.startSchedule(id);
    }

    return true;
  }

  /**
   * Run schedule manually
   */
  public async runSchedule(id: string): Promise<void> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    switch (schedule.type) {
      case 'url':
        await this.engine.purgeURLs(schedule.targets);
        break;
      case 'tag':
        await this.engine.purgeTags(schedule.targets);
        break;
      case 'wildcard':
        for (const target of schedule.targets) {
          await this.engine.purgeWildcard(target);
        }
        break;
    }

    schedule.lastRun = new Date();
    schedule.runCount++;
  }

  /**
   * Start schedule
   */
  private startSchedule(id: string): void {
    const schedule = this.schedules.get(id);
    if (!schedule || !schedule.enabled) return;

    // Validate cron expression
    if (!cron.validate(schedule.schedule)) {
      console.error(`Invalid cron expression for schedule ${id}: ${schedule.schedule}`);
      return;
    }

    // Create task
    const task = cron.schedule(schedule.schedule, async () => {
      await this.runSchedule(id);
    });

    this.tasks.set(id, task);
  }

  /**
   * Stop schedule
   */
  private stopSchedule(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }

    this.tasks.clear();
    this.schedules.clear();
  }
}

export default PurgeScheduler;
