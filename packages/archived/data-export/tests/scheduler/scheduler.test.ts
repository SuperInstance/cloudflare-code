import { SchedulerImpl } from '../../src/scheduler/scheduler';
import { FormatEngineImpl } from '../../src/formats/engine';
import { BatchExporterImpl } from '../../src/batch/exporter';
import { ScheduledExport, SchedulerOptions, ExportRecord } from '../../src/types';

describe('Scheduler', () => {
  let scheduler: SchedulerImpl;
  let formatEngine: FormatEngineImpl;
  let batchExporter: BatchExporterImpl;
  const testData: ExportRecord[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
  ];

  beforeEach(() => {
    formatEngine = new FormatEngineImpl();
    batchExporter = new BatchExporterImpl(formatEngine);
    scheduler = new SchedulerImpl(formatEngine, batchExporter);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    scheduler.stop();
  });

  describe('schedule', () => {
    it('should create a new schedule with hourly frequency', () => {
      const config: ScheduledExport = {
        name: 'Hourly Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      expect(scheduleId).toBeDefined();
      expect(scheduleId).toMatch(/^schedule-/);
    });

    it('should create a new schedule with cron expression', () => {
      const config: ScheduledExport = {
        name: 'Custom Export',
        config: {
          cronExpression: '0 */6 * * *' // Every 6 hours
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      expect(scheduleId).toBeDefined();
      expect(scheduleId).toMatch(/^schedule-/);
    });

    it('should create a new schedule with daily frequency and time', () => {
      const config: ScheduledExport = {
        name: 'Daily Export',
        config: {
          frequency: 'daily',
          schedule: {
            frequency: 'daily',
            time: '14:30'
          }
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      expect(scheduleId).toBeDefined();
    });

    it('should create a new schedule with weekly frequency', () => {
      const config: ScheduledExport = {
        name: 'Weekly Export',
        config: {
          frequency: 'weekly',
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 1,
            time: '09:00'
          }
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      expect(scheduleId).toBeDefined();
    });

    it('should create a new schedule with monthly frequency', () => {
      const config: ScheduledExport = {
        name: 'Monthly Export',
        config: {
          frequency: 'monthly',
          schedule: {
            frequency: 'monthly',
            dayOfMonth: 1,
            time: '00:00'
          }
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      expect(scheduleId).toBeDefined();
    });

    it('should handle data function', () => {
      const mockDataFunction = jest.fn().mockResolvedValue(testData);
      const config: ScheduledExport = {
        name: 'Function Data Export',
        config: {
          frequency: 'daily'
        },
        data: mockDataFunction
      };

      const scheduleId = scheduler.schedule(config);

      expect(scheduleId).toBeDefined();
      expect(mockDataFunction).not.toHaveBeenCalled(); // Should not be called on schedule creation
    });

    it('should emit schedule-created event', () => {
      const mockEmit = jest.fn();
      scheduler.emit = mockEmit;

      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      scheduler.schedule(config);

      expect(mockEmit).toHaveBeenCalledWith('schedule-created', expect.any(Object));
    });
  });

  describe('unschedule', () => {
    it('should remove existing schedule', () => {
      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);
      const result = scheduler.unschedule(scheduleId);

      expect(result).toBe(true);
      expect(scheduler.getSchedule(scheduleId)).toBeNull();
    });

    it('should return false for non-existent schedule', () => {
      const result = scheduler.unschedule('non-existent');
      expect(result).toBe(false);
    });

    it('should emit schedule-removed event', () => {
      const mockEmit = jest.fn();
      scheduler.emit = mockEmit;

      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);
      scheduler.unschedule(scheduleId);

      expect(mockEmit).toHaveBeenCalledWith('schedule-removed', { scheduleId });
    });
  });

  describe('listSchedules', () => {
    it('should return empty array when no schedules exist', () => {
      const schedules = scheduler.listSchedules();
      expect(schedules).toEqual([]);
    });

    it('should return all schedules', () => {
      const config1: ScheduledExport = {
        name: 'Export 1',
        config: { frequency: 'hourly' },
        data: testData
      };

      const config2: ScheduledExport = {
        name: 'Export 2',
        config: { frequency: 'daily' },
        data: testData
      };

      scheduler.schedule(config1);
      scheduler.schedule(config2);

      const schedules = scheduler.listSchedules();
      expect(schedules).toHaveLength(2);
      expect(schedules[0].name).toBe('Export 1');
      expect(schedules[1].name).toBe('Export 2');
    });
  });

  describe('pause and resume', () => {
    it('should pause a schedule', () => {
      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);
      const result = scheduler.pause(scheduleId);

      expect(result).toBe(true);

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.status).toBe('paused');
    });

    it('should resume a paused schedule', () => {
      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);
      scheduler.pause(scheduleId);
      const result = scheduler.resume(scheduleId);

      expect(result).toBe(true);

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.status).toBe('active');
    });

    it('should return false for non-existent schedule when pausing', () => {
      const result = scheduler.pause('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for non-existent schedule when resuming', () => {
      const result = scheduler.resume('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('schedule execution', () => {
    beforeEach(() => {
      // Mock the batch exporter
      const mockExport = jest.fn().mockResolvedValue({
        format: 'csv' as any,
        size: 1024,
        recordCount: 2,
        path: '/tmp/test.csv',
        metadata: {}
      });

      batchExporter.export = mockExport;

      // Mock the schedule creation
      const mockSchedule = jest.fn().mockImplementation(() => {
        return Promise.resolve();
      });

      // Mock the cron job
      const mockCronJob = {
        start: jest.fn(),
        stop: jest.fn()
      };

      require('node-cron').schedule.mockReturnValue(mockCronJob);
    });

    it('should execute scheduled export', async () => {
      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'once'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      // Advance timers to trigger the scheduled execution
      jest.advanceTimersByTime(1000);

      // The schedule should be executed
      await new Promise(resolve => setImmediate(resolve));

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.history.length).toBeGreaterThan(0);
      expect(schedule?.history[0].status).toBe('completed');
    });

    it('should handle export errors', async () => {
      const mockExport = jest.fn().mockRejectedValue(new Error('Export failed'));
      batchExporter.export = mockExport;

      const config: ScheduledExport = {
        name: 'Failing Export',
        config: {
          frequency: 'once'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);

      // Advance timers to trigger the scheduled execution
      jest.advanceTimersByTime(1000);

      await new Promise(resolve => setImmediate(resolve));

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.history.length).toBeGreaterThan(0);
      expect(schedule?.history[0].status).toBe('failed');
      expect(schedule?.history[0].error).toBe('Export failed');
    });

    it('should handle data function errors', async () => {
      const mockDataFunction = jest.fn().mockRejectedValue(new Error('Data fetch failed'));
      const config: ScheduledExport = {
        name: 'Failing Data Export',
        config: {
          frequency: 'once'
        },
        data: mockDataFunction
      };

      const scheduleId = scheduler.schedule(config);

      // Advance timers to trigger the scheduled execution
      jest.advanceTimersByTime(1000);

      await new Promise(resolve => setImmediate(resolve));

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.history.length).toBeGreaterThan(0);
      expect(schedule?.history[0].status).toBe('failed');
      expect(schedule?.history[0].error).toBe('Data fetch failed');
    });
  });

  describe('schedule management', () => {
    it('should get schedule by ID', () => {
      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      const scheduleId = scheduler.schedule(config);
      const schedule = scheduler.getSchedule(scheduleId);

      expect(schedule).toBeDefined();
      expect(schedule?.name).toBe('Test Export');
      expect(schedule?.config.frequency).toBe('hourly');
    });

    it('should return null for non-existent schedule', () => {
      const schedule = scheduler.getSchedule('non-existent');
      expect(schedule).toBeNull();
    });
  });

  describe('cron expression building', () => {
    it('should build cron expression for hourly frequency', () => {
      const config: SchedulerOptions = {
        frequency: 'hourly'
      };

      const cronExpression = (scheduler as any).buildCronExpression(config);
      expect(cronExpression).toBe('0 * * * *');
    });

    it('should build cron expression for daily frequency with time', () => {
      const config: SchedulerOptions = {
        frequency: 'daily',
        schedule: {
          time: '14:30'
        }
      };

      const cronExpression = (scheduler as any).buildCronExpression(config);
      expect(cronExpression).toBe('30 14 * * *');
    });

    it('should build cron expression for weekly frequency', () => {
      const config: SchedulerOptions = {
        frequency: 'weekly',
        schedule: {
          dayOfWeek: 1,
          time: '09:00'
        }
      };

      const cronExpression = (scheduler as any).buildCronExpression(config);
      expect(cronExpression).toBe('0 9 * * 1');
    });

    it('should build cron expression for monthly frequency', () => {
      const config: SchedulerOptions = {
        frequency: 'monthly',
        schedule: {
          dayOfMonth: 1,
          time: '00:00'
        }
      };

      const cronExpression = (scheduler as any).buildCronExpression(config);
      expect(cronExpression).toBe('0 0 1 * *');
    });
  });

  describe('next run calculation', () => {
    it('should calculate next run for hourly frequency', () => {
      const config: SchedulerOptions = {
        frequency: 'hourly'
      };

      const nextRun = (scheduler as any).calculateNextRun(config);
      expect(nextRun).toBeInstanceOf(Date);

      const expectedTime = new Date();
      expectedTime.setHours(expectedTime.getHours() + 1);
      expectedTime.setMinutes(0, 0, 0);

      expect(nextRun!.getTime()).toBeCloseTo(expectedTime.getTime(), -1000);
    });

    it('should calculate next run for daily frequency', () => {
      const config: SchedulerOptions = {
        frequency: 'daily',
        schedule: {
          time: '14:30'
        }
      };

      const nextRun = (scheduler as any).calculateNextRun(config);
      expect(nextRun).toBeInstanceOf(Date);

      const now = new Date();
      const expectedTime = new Date(now);
      expectedTime.setHours(14, 30, 0, 0);

      if (expectedTime <= now) {
        expectedTime.setDate(expectedTime.getDate() + 1);
      }

      expect(nextRun!.getTime()).toBeCloseTo(expectedTime.getTime(), -1000);
    });
  });

  describe('scheduler lifecycle', () => {
    it('should start and stop scheduler', () => {
      scheduler.start();
      expect(scheduler.getStats().totalSchedules).toBe(0);

      scheduler.stop();
      expect(scheduler.getStats().totalSchedules).toBe(0);
    });

    it('should get scheduler stats', () => {
      const config: ScheduledExport = {
        name: 'Test Export',
        config: {
          frequency: 'hourly'
        },
        data: testData
      };

      scheduler.schedule(config);

      const stats = scheduler.getStats();
      expect(stats.totalSchedules).toBe(1);
      expect(stats.activeSchedules).toBe(1);
      expect(stats.pausedSchedules).toBe(0);
      expect(stats.runningJobs).toBe(0);
    });

    it('should handle max concurrent jobs', () => {
      scheduler.updateMaxConcurrent(2);

      const stats = scheduler.getStats();
      expect(stats.runningJobs).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid cron expressions', () => {
      const config: ScheduledExport = {
        name: 'Invalid Export',
        config: {
          cronExpression: 'invalid-cron'
        },
        data: testData
      };

      expect(() => scheduler.schedule(config)).toThrow();
    });

    it('should handle missing frequency', () => {
      const config: ScheduledExport = {
        name: 'Missing Frequency Export',
        config: {},
        data: testData
      };

      expect(() => scheduler.schedule(config)).toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up old exports', async () => {
      // Mock cleanup
      const cleanupOldExports = jest.spyOn(scheduler as any, 'cleanupOldExports');

      scheduler.start();

      // Simulate time passing
      jest.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours

      expect(cleanupOldExports).toHaveBeenCalled();
    });
  });
});