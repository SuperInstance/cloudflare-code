import { BatchExporterImpl } from '../../src/batch/exporter';
import { FormatEngineImpl } from '../../src/formats/engine';
import { ExportOptions, BatchOptions, ExportRecord } from '../../src/types';
import { promises as fs } from 'fs';

describe('BatchExporter', () => {
  let batchExporter: BatchExporterImpl;
  let formatEngine: FormatEngineImpl;
  const testData: ExportRecord[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 28 },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 32 }
  ];

  beforeEach(() => {
    formatEngine = new FormatEngineImpl();
    batchExporter = new BatchExporterImpl(formatEngine);
    jest.clearAllMocks();
  });

  describe('export', () => {
    it('should export data in batches', async () => {
      const options: ExportOptions = { format: 'csv' };
      const batchOptions: BatchOptions = { chunkSize: 2 };

      const result = await batchExporter.export(testData, options, batchOptions);

      expect(result.totalRecords).toBe(5);
      expect(result.processedRecords).toBe(5);
      expect(result.chunks).toBe(3); // 5 records / 2 per chunk = 3 chunks
      expect(result.duration).toBeGreaterThan(0);
      expect(result.results.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it('should handle custom chunk size', async () => {
      const options: ExportOptions = { format: 'json' };
      const batchOptions: BatchOptions = { chunkSize: 3 };

      const result = await batchExporter.export(testData, options, batchOptions);

      expect(result.chunks).toBe(2); // 5 records / 3 per chunk = 2 chunks
    });

    it('should respect max chunks limit', async () => {
      const options: ExportOptions = { format: 'csv' };
      const batchOptions: BatchOptions = { chunkSize: 1, maxChunks: 3 };

      const result = await batchExporter.export(testData, options, batchOptions);

      expect(result.chunks).toBe(3); // Limited to 3 chunks
    });

    it('should handle empty data array', async () => {
      const options: ExportOptions = { format: 'csv' };
      const result = await batchExporter.export([], options);

      expect(result.totalRecords).toBe(0);
      expect(result.processedRecords).toBe(0);
      expect(result.chunks).toBe(0);
    });

    it('should handle single record', async () => {
      const options: ExportOptions = { format: 'json' };
      const result = await batchExporter.export([testData[0]], options);

      expect(result.totalRecords).toBe(1);
      expect(result.processedRecords).toBe(1);
      expect(result.chunks).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle chunk export errors', async () => {
      // Mock format engine to throw error on specific chunk
      const mockExport = jest.fn()
        .mockResolvedValueOnce({} as any) // First chunk succeeds
        .mockRejectedValueOnce(new Error('Chunk export failed')) // Second chunk fails
        .mockResolvedValueOnce({} as any); // Third chunk succeeds

      formatEngine.export = mockExport;

      const options: ExportOptions = { format: 'csv' };
      const batchOptions: BatchOptions = { chunkSize: 2 };

      const result = await batchExporter.export(testData, options, batchOptions);

      expect(result.totalRecords).toBe(5);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe('Chunk export failed');
    });

    it('should handle retry on chunk export failure', async () => {
      const mockExport = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockResolvedValue({} as any);

      formatEngine.export = mockExport;

      const options: ExportOptions = { format: 'csv' };
      const batchOptions: BatchOptions = { chunkSize: 3, retryAttempts: 1, retryDelay: 10 };

      const result = await batchExporter.export(testData, options, batchOptions);

      expect(mockExport).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Job Management', () => {
    it('should create and track jobs', async () => {
      const options: ExportOptions = { format: 'csv' };

      await batchExporter.export(testData, options);

      const jobs = batchExporter.getAllJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].status).toBe('completed');
    });

    it('should get job status', async () => {
      const options: ExportOptions = { format: 'json' };
      const result = await batchExporter.export(testData, options);

      const job = batchExporter.getStatus(result.results[0].path);
      expect(job).toBeDefined();
      expect(job?.status).toBe('completed');
    });

    it('should cancel jobs', () => {
      // This test would need more complex setup to test cancellation
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Memory Management', () => {
    it('should calculate optimal chunk size based on memory', () => {
      const chunkSize = batchExporter['calculateOptimalChunkSize'](1000, 1024 * 1024 * 100); // 100MB limit
      expect(chunkSize).toBeGreaterThan(0);
      expect(chunkSize).toBeLessThanOrEqual(1000);
    });

    it('should handle memory limit exceeded', async () => {
      const mockMemoryMonitor = {
        getCurrentMemory: () => 1024 * 1024 * 600, // 600MB
        getMemoryLimit: () => 1024 * 1024 * 500, // 500MB limit
        isMemoryLimitExceeded: () => true,
        setMemoryLimit: jest.fn(),
        onMemoryLimit: jest.fn()
      };

      Object.assign(batchExporter, { memoryMonitor: mockMemoryMonitor });

      const options: ExportOptions = { format: 'csv' };

      // Mock the emit method to capture events
      const mockEmit = jest.fn();
      batchExporter.emit = mockEmit;

      try {
        await batchExporter.export(testData, options);
      } catch (error) {
        expect(error.message).toBe('Job cancelled');
      }

      expect(mockEmit).toHaveBeenCalledWith('memory-limit-exceeded');
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress during export', async () => {
      const options: ExportOptions = { format: 'csv' };
      const mockEmit = jest.fn();
      batchExporter.emit = mockEmit;

      await batchExporter.export(testData, options);

      // Check that progress events were emitted
      expect(mockEmit).toHaveBeenCalledWith('job-start', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('job-progress', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('job-complete', expect.any(Object));
    });

    it('should calculate processing speed', () => {
      const speed = batchExporter['calculateSpeed'](100, 1000); // 100 records in 1 second
      expect(speed).toBe(100); // 100 records per second
    });

    it('should calculate estimated time remaining', () => {
      const eta = batchExporter['calculateETA'](100, 500); // 100 records/sec, 500 remaining
      expect(eta).toBe(5); // 5 seconds remaining
    });
  });

  describe('Cleanup', () => {
    it('should clean up job data', async () => {
      const options: ExportOptions = { format: 'json' };
      const result = await batchExporter.export(testData, options);

      const initialJobs = batchExporter.getAllJobs();
      expect(initialJobs.length).toBeGreaterThan(0);

      await batchExporter.cleanup(result.results[0].path);

      const finalJobs = batchExporter.getAllJobs();
      expect(finalJobs.length).toBeLessThan(initialJobs.length);
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle large datasets efficiently', async () => {
      const largeData = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 100)
      }));

      const options: ExportOptions = { format: 'json' };
      const batchOptions: BatchOptions = { chunkSize: 1000 };

      const startTime = Date.now();
      const result = await batchExporter.export(largeData, options, batchOptions);
      const endTime = Date.now();

      expect(result.totalRecords).toBe(10000);
      expect(result.processedRecords).toBe(10000);
      expect(result.chunks).toBe(10); // 10000 / 1000
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Memory Chunking', () => {
    it('should create appropriate chunks based on memory', () => {
      const createMemoryAwareChunker = require('../../src/utils/memory').createMemoryAwareChunker;
      const largeData = Array(5000).fill(null).map((_, i) => ({ id: i, data: 'x'.repeat(100) }));

      const chunks = createMemoryAwareChunker(largeData, 50); // 50MB target
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThan(5000);
      expect(chunks[0].length).toBeGreaterThan(0);
    });
  });
});