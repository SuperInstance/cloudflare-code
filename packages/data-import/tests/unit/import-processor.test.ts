import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImportProcessor, type ImportResult, type ProcessorOptions } from '../../src/processor';
import { ImportJob, DataSource, DataFormat, JobStatus, ConflictResolutionStrategy } from '../../src/types';

describe('ImportProcessor', () => {
  let processor: ImportProcessor;
  let testDir: string;
  let mockEmitter: any;

  beforeEach(() => {
    testDir = '/tmp/test-import';
    mockEmitter = {
      listeners: {},
      on: (event: string, listener: Function) => {
        mockEmitter.listeners[event] = mockEmitter.listeners[event] || [];
        mockEmitter.listeners[event].push(listener);
      },
      emit: (event: string, ...args: any[]) => {
        if (mockEmitter.listeners[event]) {
          mockEmitter.listeners[event].forEach((listener: Function) => listener(...args));
        }
      },
    };

    processor = new ImportProcessor({
      batchSize: 100,
      maxConcurrentJobs: 2,
      enableLogging: false,
    });

    vi.spyOn(processor, 'emit' as any).mockImplementation(mockEmitter.emit);
    vi.spyOn(processor, 'on' as any).mockImplementation(mockEmitter.on);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    processor.cleanup();
  });

  describe('Job Management', () => {
    it('should create and start a job', async () => {
      const job: ImportJob = {
        name: 'Test Import',
        source: {
          type: 'file',
          format: 'csv',
          path: '/path/to/test.csv',
        },
        config: {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobId = await processor.startJob(job);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const savedJob = processor.getJob(jobId);
      expect(savedJob).toBeDefined();
      expect(savedJob!.name).toBe('Test Import');
      expect(savedJob!.status).toBe('pending');
    });

    it('should reject duplicate job IDs', async () => {
      const job: ImportJob = {
        id: 'existing-job',
        name: 'Test Import',
        source: {
          type: 'file',
          format: 'csv',
          path: '/path/to/test.csv',
        },
        config: {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await processor.startJob(job);

      const duplicateJob = { ...job, name: 'Duplicate Import' };

      await expect(processor.startJob(duplicateJob)).rejects.toThrow(
        'Job with ID existing-job already exists'
      );
    });

    it('should cancel jobs', () => {
      const job: ImportJob = {
        name: 'Test Import',
        source: {
          type: 'file',
          format: 'csv',
          path: '/path/to/test.csv',
        },
        config: {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobId = processor.startJobSync(job);
      const cancelled = processor.cancelJob(jobId);

      expect(cancelled).toBe(true);

      const savedJob = processor.getJob(jobId);
      expect(savedJob!.status).toBe('cancelled');
    });

    it('should not cancel completed jobs', () => {
      const job: ImportJob = {
        name: 'Test Import',
        source: {
          type: 'file',
          format: 'csv',
          path: '/path/to/test.csv',
        },
        config: {},
        status: 'completed',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobId = processor.startJobSync(job);
      const cancelled = processor.cancelJob(jobId);

      expect(cancelled).toBe(false);
    });
  });

  describe('Conflict Resolution', () => {
    it('should handle different conflict resolution strategies', async () => {
      const testStrategies: ConflictResolutionStrategy[] = ['overwrite', 'skip', 'update', 'merge', 'error'];

      for (const strategy of testStrategies) {
        const job: ImportJob = {
          name: `Test ${strategy}`,
          source: {
            type: 'file',
            format: 'csv',
            path: '/path/to/test.csv',
          },
          config: {
            conflictResolution: strategy,
          },
          status: 'pending',
          progress: {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            percentage: 0,
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const jobId = await processor.startJob(job);
        expect(jobId).toBeDefined();
      }
    });
  });

  describe('Batch Processing', () => {
    it('should process records in batches', async () => {
      const job: ImportJob = {
        name: 'Batch Test',
        source: {
          type: 'file',
          format: 'csv',
          path: '/path/to/test.csv',
        },
        config: {
          batchSize: 50,
        },
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const processorOptions: ProcessorOptions = {
        batchSize: 50,
        maxConcurrentJobs: 1,
        enableLogging: false,
      };

      const testProcessor = new ImportProcessor(processorOptions);

      vi.spyOn(testProcessor, 'emit' as any).mockImplementation(mockEmitter.emit);
      vi.spyOn(testProcessor, 'on' as any).mockImplementation(mockEmitter.on);

      vi.spyOn(testProcessor, 'parseAndPrepareRecords').mockResolvedValue(
        Array.from({ length: 250 }, (_, i) => ({
          id: `record-${i}`,
          data: { id: i, name: `Record ${i}` },
          metadata: {},
          status: 'pending',
        }))
      );

      vi.spyOn(testProcessor, 'validateRecords').mockResolvedValue(
        Array(250).fill({ isValid: true, errors: [], warnings: [], score: 1 })
      );

      vi.spyOn(testProcessor, 'transformRecords').mockResolvedValue({
        transformedRecords: Array.from({ length: 250 }, (_, i) => ({
          id: `record-${i}`,
          data: { id: i, name: `Record ${i}` },
          metadata: {},
          status: 'pending',
        })),
        transformationMetrics: {
          totalRecords: 250,
          successful: 250,
          failed: 0,
          averageTime: 1,
          totalProcessingTime: 250,
        },
        errors: [],
      });

      vi.spyOn(testProcessor, 'batchImportRecords').mockResolvedValue({
        jobId: 'test-job',
        success: true,
        processedRecords: 250,
        successfulRecords: 250,
        failedRecords: 0,
        averageTimePerRecord: 10,
        totalProcessingTime: 2500,
        errors: [],
      });

      const jobId = await testProcessor.startJob(job);

      await new Promise(resolve => setTimeout(resolve, 100));

      const savedJob = testProcessor.getJob(jobId);
      expect(savedJob!.progress.total).toBe(250);
      expect(savedJob!.progress.processed).toBe(250);

      testProcessor.cleanup();
    });
  });

  describe('Concurrency Control', () => {
    it('should respect max concurrent jobs limit', async () => {
      const processorOptions: ProcessorOptions = {
        maxConcurrentJobs: 2,
        enableLogging: false,
      };

      const testProcessor = new ImportProcessor(processorOptions);

      vi.spyOn(testProcessor, 'emit' as any).mockImplementation(mockEmitter.emit);
      vi.spyOn(testProcessor, 'on' as any).mockImplementation(mockEmitter.on);

      const createJob = (id: number) => ({
        id: `job-${id}`,
        name: `Job ${id}`,
        source: {
          type: 'file',
          format: 'csv',
          path: `/path/to/test${id}.csv`,
        },
        config: {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const jobPromises = Array.from({ length: 5 }, (_, i) => testProcessor.startJob(createJob(i + 1)));

      await Promise.all(jobPromises);

      const activeJobs = testProcessor.getActiveJobs();
      expect(activeJobs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle job failures', async () => {
      const job: ImportJob = {
        name: 'Error Test',
        source: {
          type: 'file',
          format: 'csv',
          path: '/invalid/path.csv',
        },
        config: {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const processorOptions: ProcessorOptions = {
        batchSize: 100,
        maxConcurrentJobs: 1,
        enableLogging: false,
      };

      const testProcessor = new ImportProcessor(processorOptions);

      vi.spyOn(testProcessor, 'emit' as any).mockImplementation(mockEmitter.emit);
      vi.spyOn(testProcessor, 'on' as any).mockImplementation(mockEmitter.on);

      vi.spyOn(testProcessor, 'parseAndPrepareRecords').mockRejectedValue(new Error('File not found'));

      const jobId = await testProcessor.startJob(job);

      await new Promise(resolve => setTimeout(resolve, 100));

      const savedJob = testProcessor.getJob(jobId);
      expect(savedJob!.status).toBe('failed');
      expect(savedJob!.error).toContain('File not found');

      testProcessor.cleanup();
    });
  });

  describe('Statistics', () => {
    it('should provide system statistics', () => {
      const stats = processor.getStats();

      expect(stats).toMatchObject({
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        totalRecordsProcessed: 0,
        averageProcessingTime: 0,
      });
    });

    it('should update statistics after job completion', async () => {
      const job: ImportJob = {
        name: 'Stats Test',
        source: {
          type: 'file',
          format: 'csv',
          path: '/path/to/test.csv',
        },
        config: {},
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(processor, 'emit' as any).mockImplementation(mockEmitter.emit);
      vi.spyOn(processor, 'on' as any).mockImplementation(mockEmitter.on);

      await processor.startJob(job);

      let stats = processor.getStats();
      expect(stats.totalJobs).toBe(1);

      mockEmitter.emit('jobCompleted', {
        jobId: job.id,
        result: {
          jobId: job.id,
          success: true,
          processedRecords: 100,
          successfulRecords: 95,
          failedRecords: 5,
          averageTimePerRecord: 10,
          totalProcessingTime: 1000,
          errors: [],
        },
      });

      stats = processor.getStats();
      expect(stats.completedJobs).toBe(1);
      expect(stats.totalRecordsProcessed).toBe(100);
    });
  });
});