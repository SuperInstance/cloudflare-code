/**
 * Time-Based Cache Warming Strategy
 *
 * Schedules cache warming based on time patterns, cron schedules,
 * and predictable traffic patterns.
 */

import type {
  TimeBasedSchedule,
  WarmingTask,
  WarmingResult,
  EdgeCacheEnv,
} from '../types';

export interface TimeBasedConfig {
  schedules: TimeBasedSchedule[];
  maxConcurrent: number;
  retryAttempts: number;
  backoffMultiplier: number;
  timezone: string;
}

export interface ScheduleExecution {
  scheduleId: string;
  executionTime: number;
  results: WarmingResult[];
  duration: number;
  success: boolean;
}

/**
 * Time-Based Cache Warmer
 *
 * Executes cache warming on predefined schedules to ensure
 * content is cached before predictable traffic spikes.
 */
export class TimeBasedWarmer {
  private kv: KVNamespace;
  private config: TimeBasedConfig;
  private activeSchedules: Map<string, TimeBasedSchedule>;
  private executionHistory: ScheduleExecution[];
  private running: boolean = false;
  private intervalId?: number;

  constructor(kv: KVNamespace, config: Partial<TimeBasedConfig> = {}) {
    this.kv = kv;
    this.config = {
      schedules: [],
      maxConcurrent: 5,
      retryAttempts: 3,
      backoffMultiplier: 2,
      timezone: 'UTC',
      ...config,
    };

    this.activeSchedules = new Map();
    this.executionHistory = [];

    // Initialize schedules
    for (const schedule of this.config.schedules) {
      this.activeSchedules.set(schedule.id, schedule);
    }
  }

  /**
   * Start the time-based warmer
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Load schedules from KV
    await this.loadSchedules();

    // Check for due schedules every minute
    this.intervalId = setInterval(
      () => this.checkSchedules(),
      60000
    ) as unknown as number;

    console.log('Time-based warmer started');
  }

  /**
   * Stop the time-based warmer
   */
  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.running = false;
    console.log('Time-based warmer stopped');
  }

  /**
   * Add a new schedule
   */
  async addSchedule(schedule: TimeBasedSchedule): Promise<void> {
    this.activeSchedules.set(schedule.id, schedule);
    await this.persistSchedules();
  }

  /**
   * Remove a schedule
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    this.activeSchedules.delete(scheduleId);
    await this.persistSchedules();
  }

  /**
   * Update a schedule
   */
  async updateSchedule(schedule: TimeBasedSchedule): Promise<void> {
    if (!this.activeSchedules.has(schedule.id)) {
      throw new Error(`Schedule ${schedule.id} not found`);
    }
    this.activeSchedules.set(schedule.id, schedule);
    await this.persistSchedules();
  }

  /**
   * Get all schedules
   */
  getSchedules(): TimeBasedSchedule[] {
    return Array.from(this.activeSchedules.values());
  }

  /**
   * Get a specific schedule
   */
  getSchedule(scheduleId: string): TimeBasedSchedule | undefined {
    return this.activeSchedules.get(scheduleId);
  }

  /**
   * Check for due schedules and execute them
   */
  private async checkSchedules(): Promise<void> {
    const now = Date.now();
    const dueSchedules: TimeBasedSchedule[] = [];

    // Find schedules that are due
    for (const schedule of this.activeSchedules.values()) {
      if (!schedule.enabled) {
        continue;
      }

      if (now >= schedule.nextRun) {
        dueSchedules.push(schedule);
      }
    }

    // Execute due schedules
    for (const schedule of dueSchedules) {
      await this.executeSchedule(schedule);
    }
  }

  /**
   * Execute a schedule
   */
  private async executeSchedule(schedule: TimeBasedSchedule): Promise<void> {
    const startTime = Date.now();
    console.log(`Executing schedule: ${schedule.name}`);

    const results: WarmingResult[] = [];

    try {
      // Create tasks for all URLs in the schedule
      const tasks: WarmingTask[] = schedule.urls.map((url) => ({
        id: crypto.randomUUID(),
        type: 'time-based',
        url,
        method: 'GET',
        priority: 50, // Medium priority
        status: 'pending',
        attempts: 0,
      }));

      // Execute tasks
      for (const task of tasks) {
        const result = await this.executeTask(task);
        results.push(result);
      }

      // Update schedule
      schedule.lastRun = startTime;
      schedule.nextRun = this.calculateNextRun(schedule);

      // Record execution
      const execution: ScheduleExecution = {
        scheduleId: schedule.id,
        executionTime: startTime,
        results,
        duration: Date.now() - startTime,
        success: results.every((r) => r.success),
      };

      this.executionHistory.push(execution);

      // Keep only last 100 executions
      if (this.executionHistory.length > 100) {
        this.executionHistory.shift();
      }

      // Persist
      await this.persistSchedules();
      await this.persistExecutionHistory();

      console.log(`Schedule ${schedule.name} completed in ${execution.duration}ms`);
    } catch (error) {
      console.error(`Error executing schedule ${schedule.name}:`, error);
    }
  }

  /**
   * Execute a single warming task
   */
  private async executeTask(task: WarmingTask): Promise<WarmingResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.config.retryAttempts) {
      try {
        const cacheKey = `time-warm:${task.url}`;

        // Fetch content
        const response = await fetch(task.url, {
          method: task.method,
          headers: {
            'User-Agent': 'ClaudeFlare-Time-Based-Warmer/1.0',
            'X-Cache-Warm': 'true',
            'X-Schedule': task.type,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.arrayBuffer();
        const size = content.byteLength;

        // Cache the content
        const metadata = {
          cachedAt: Date.now(),
          url: task.url,
          method: task.method,
          statusCode: response.status,
          size,
          scheduleType: 'time-based',
        };

        await this.kv.put(cacheKey, content, {
          metadata,
          expirationTtl: 3600,
        });

        return {
          taskId: task.id,
          success: true,
          duration: Date.now() - startTime,
          cached: true,
          cacheKey,
          tier: 'warm',
          size,
          metadata,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        attempts++;

        if (attempts < this.config.retryAttempts) {
          const delay = Math.min(
            1000 * Math.pow(this.config.backoffMultiplier, attempts),
            30000
          );
          await this.sleep(delay);
        }
      }
    }

    return {
      taskId: task.id,
      success: false,
      duration: Date.now() - startTime,
      cached: false,
      cacheKey: '',
      tier: 'warm',
      size: 0,
      metadata: {},
    };
  }

  /**
   * Calculate next run time for a schedule
   */
  private calculateNextRun(schedule: TimeBasedSchedule): number {
    // Simple cron parser implementation
    // Supports: * * * * * (minute hour day month weekday)
    const cronParts = schedule.cron.split(' ');
    if (cronParts.length !== 5) {
      throw new Error(`Invalid cron expression: ${schedule.cron}`);
    }

    const [minute, hour, day, month, weekday] = cronParts;
    const now = new Date();
    const next = new Date(now);

    // For simplicity, just add 1 day if daily, or 1 hour if hourly
    if (minute !== '*' && hour !== '*') {
      // Specific time - run next day
      next.setDate(next.getDate() + 1);
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
    } else if (minute !== '*') {
      // Hourly at specific minute
      next.setHours(next.getHours() + 1);
      next.setMinutes(parseInt(minute), 0, 0);
    } else {
      // Every minute
      next.setMinutes(next.getMinutes() + 1);
    }

    return next.getTime();
  }

  /**
   * Persist schedules to KV
   */
  private async persistSchedules(): Promise<void> {
    const data = Array.from(this.activeSchedules.values());
    await this.kv.put('time-based:schedules', JSON.stringify(data), {
      expirationTtl: 86400 * 7, // 7 days
    });
  }

  /**
   * Load schedules from KV
   */
  private async loadSchedules(): Promise<void> {
    const data = await this.kv.get('time-based:schedules', 'json');
    if (data && Array.isArray(data)) {
      const schedules = data as TimeBasedSchedule[];
      this.activeSchedules.clear();
      for (const schedule of schedules) {
        this.activeSchedules.set(schedule.id, schedule);
      }
    }
  }

  /**
   * Persist execution history to KV
   */
  private async persistExecutionHistory(): Promise<void> {
    await this.kv.put('time-based:history', JSON.stringify(this.executionHistory), {
      expirationTtl: 86400 * 7, // 7 days
    });
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 50): ScheduleExecution[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    const successfulExecutions = this.executionHistory.filter((e) => e.success).length;
    const totalExecutions = this.executionHistory.length;

    return {
      totalSchedules: this.activeSchedules.size,
      enabledSchedules: Array.from(this.activeSchedules.values()).filter((s) => s.enabled).length,
      totalExecutions,
      successfulExecutions,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      isRunning: this.running,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a time-based warmer instance
 */
export function createTimeBasedWarmer(
  kv: KVNamespace,
  config?: Partial<TimeBasedConfig>
): TimeBasedWarmer {
  return new TimeBasedWarmer(kv, config);
}

/**
 * Helper to create a daily schedule
 */
export function createDailySchedule(
  id: string,
  name: string,
  hour: number,
  minute: number,
  urls: string[],
  timezone: string = 'UTC'
): TimeBasedSchedule {
  return {
    id,
    name,
    cron: `${minute} ${hour} * * *`,
    urls,
    enabled: true,
    timezone,
    lastRun: 0,
    nextRun: 0,
  };
}

/**
 * Helper to create an hourly schedule
 */
export function createHourlySchedule(
  id: string,
  name: string,
  minute: number,
  urls: string[],
  timezone: string = 'UTC'
): TimeBasedSchedule {
  return {
    id,
    name,
    cron: `${minute} * * * *`,
    urls,
    enabled: true,
    timezone,
    lastRun: 0,
    nextRun: 0,
  };
}
