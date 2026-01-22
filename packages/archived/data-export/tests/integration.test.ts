import { DataExportSystem } from '../src/index';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('DataExport System Integration', () => {
  let exportSystem: DataExportSystem;
  const testData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, department: 'Engineering' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, department: 'Marketing' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, department: 'Engineering' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 28, department: 'Sales' },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 32, department: 'Marketing' }
  ];

  beforeEach(() => {
    exportSystem = new DataExportSystem({
      memoryLimit: 1024 * 1024 * 50, // 50MB
      maxConcurrent: 2
    });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await exportSystem.shutdown();
  });

  describe('Basic Export', () => {
    it('should export data to CSV', async () => {
      const result = await exportSystem.export(testData, 'csv');

      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(5);
      expect(result.path).toBeDefined();
      expect(result.size).toBeGreaterThan(0);

      const content = await fs.readFile(result.path, 'utf8');
      expect(content).toContain('id,name,email,age,department');
      expect(content).toContain('John Doe');
    });

    it('should export data to JSON with pretty printing', async () => {
      const result = await exportSystem.export(testData, 'json', {
        prettyPrint: true
      });

      expect(result.format).toBe('json');
      expect(result.recordCount).toBe(5);

      const content = await fs.readFile(result.path, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testData);
      expect(content).toContain('\n'); // Pretty printing
    });

    it('should export data with custom delimiter', async () => {
      const result = await exportSystem.export(testData, 'csv', {
        delimiter: ';',
        includeHeaders: true
      });

      const content = await fs.readFile(result.path, 'utf8');
      expect(content).toContain(';');
      expect(content).toContain('John Doe;jane@example.com');
    });
  });

  describe('Batch Export', () => {
    it('should export data in batches', async () => {
      const result = await exportSystem.batchExport(testData, 'csv', {
        chunkSize: 2,
        memoryLimit: 1024 * 1024 * 10
      });

      expect(result.totalRecords).toBe(5);
      expect(result.processedRecords).toBe(5);
      expect(result.chunks).toBe(3); // 5 records / 2 per chunk
      expect(result.results.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it('should handle batch export with compression', async () => {
      const result = await exportSystem.batchExport(testData, 'json', {
        chunkSize: 3,
        memoryLimit: 1024 * 1024 * 10
      }, {
        compression: 'gzip'
      });

      expect(result.totalRecords).toBe(5);
      expect(result.processedRecords).toBe(5);
      expect(result.results.length).toBe(2);
      expect(result.results[0].metadata?.compression).toBe('gzip');
    });

    it('should handle batch export with retry', async () => {
      const result = await exportSystem.batchExport(testData, 'csv', {
        chunkSize: 2,
        retryAttempts: 1,
        retryDelay: 10
      });

      expect(result.totalRecords).toBe(5);
      expect(result.errors.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Data Processing', () => {
    it('should filter and transform data before export', async () => {
      const processedData = await exportSystem.process(testData, {
        filters: [
          { field: 'department', operator: 'eq', value: 'Engineering' },
          { field: 'age', operator: 'gte', value: 30 }
        ],
        transformations: [
          { field: 'name', type: 'format', options: { format: 'uppercase' } }
        ],
        columns: ['id', 'name', 'department']
      });

      expect(processedData.length).toBe(2); // Only Engineering and age >= 30
      expect(processedData[0].name).toBe('JOHN DOE');
      expect(processedData[0]).not.toHaveProperty('age');
      expect(processedData[0]).not.toHaveProperty('email');
    });

    it('should aggregate data', async () => {
      const processedData = await exportSystem.process(testData, {
        aggregation: {
          type: 'avg',
          field: 'age'
        }
      });

      expect(processedData.length).toBe(1);
      expect(processedData[0]).toHaveProperty('age_avg');
      expect(typeof processedData[0].age_avg).toBe('number');
    });

    it('should group data', async () => {
      const processedData = await exportSystem.process(testData, {
        aggregation: {
          type: 'group',
          field: 'salary',
          groupBy: ['department']
        }
      });

      expect(processedData.length).toBeGreaterThan(1);
      expect(processedData[0]).toHaveProperty('department');
    });

    it('should validate data schema', async () => {
      const schema = {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true, format: 'email' },
        age: { type: 'number', required: false, min: 18 }
      };

      const validResult = await exportSystem.process(testData, { schema });
      expect(validResult.length).toBe(5);

      const invalidData = [
        { id: 1, name: 'John', email: 'invalid-email' }, // Invalid email
        { id: '2', name: 'Jane', email: 'jane@example.com' } // Invalid type
      ];

      const invalidResult = await exportSystem.process(invalidData, { schema });
      expect(invalidResult.length).toBe(2);
    });
  });

  describe('Scheduling', () => {
    it('should create a scheduled export', () => {
      const scheduleId = exportSystem.schedule(
        'Test Scheduled Export',
        {
          frequency: 'daily',
          time: '14:30'
        },
        testData
      );

      expect(scheduleId).toMatch(/^schedule-/);
    });

    it('should create a scheduled export with data function', () => {
      const mockDataFunction = jest.fn().mockResolvedValue(testData);
      const scheduleId = exportSystem.schedule(
        'Function Data Export',
        {
          frequency: 'hourly'
        },
        mockDataFunction
      );

      expect(scheduleId).toMatch(/^schedule-/);
      expect(mockDataFunction).not.toHaveBeenCalled(); // Should not be called on schedule creation
    });

    it('should create a one-time scheduled export', () => {
      const scheduleId = exportSystem.schedule(
        'One-time Export',
        {
          frequency: 'once'
        },
        testData
      );

      expect(scheduleId).toMatch(/^schedule-/);
    });

    it('should start and stop scheduler', () => {
      exportSystem.schedule(
        'Test Export',
        {
          frequency: 'hourly'
        },
        testData
      );

      exportSystem.startScheduler();
      expect(exportSystem.getStats().schedulerStats.totalSchedules).toBe(1);

      exportSystem.stopScheduler();
      expect(exportSystem.getStats().schedulerStats.totalSchedules).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid export format', async () => {
      await expect(exportSystem.export(testData, 'invalid' as any))
        .rejects.toThrow('Unsupported format: invalid');
    });

    it('should handle processing errors', async () => {
      await expect(exportSystem.process(null as any, {}))
        .rejects.toThrow();
    });

    it('should handle invalid schedule configuration', () => {
      expect(() => exportSystem.schedule(
        'Invalid Schedule',
        {} as any,
        testData
      )).toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeData = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 100),
        department: ['Engineering', 'Marketing', 'Sales'][Math.floor(Math.random() * 3)]
      }));

      const startTime = Date.now();
      const result = await exportSystem.batchExport(largeData, 'json', {
        chunkSize: 1000,
        memoryLimit: 1024 * 1024 * 100
      });
      const endTime = Date.now();

      expect(result.totalRecords).toBe(10000);
      expect(result.processedRecords).toBe(10000);
      expect(result.chunks).toBe(10);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should process and export large filtered dataset', async () => {
      const largeData = Array(50000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 80) + 20, // Age 20-100
        salary: Math.floor(Math.random() * 100000) + 30000, // Salary 30k-130k
        department: ['Engineering', 'Marketing', 'Sales', 'HR'][Math.floor(Math.random() * 4)]
      }));

      const startTime = Date.now();
      const processedData = await exportSystem.process(largeData, {
        filters: [
          { field: 'age', operator: 'gte', value: 30 },
          { field: 'salary', operator: 'gt', value: 50000 }
        ],
        transformations: [
          { field: 'name', type: 'format', options: { format: 'uppercase' } }
        ],
        columns: ['id', 'name', 'age', 'salary']
      });

      const exportResult = await exportSystem.export(processedData, 'csv');
      const endTime = Date.now();

      expect(processedData.length).toBeGreaterThan(0);
      expect(processedData.length).toBeLessThan(50000);
      expect(exportResult.recordCount).toBe(processedData.length);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Memory Management', () => {
    it('should respect memory limits', () => {
      const memoryLimit = 1024 * 1024 * 25; // 25MB
      const exportSystem = new DataExportSystem({ memoryLimit });

      expect(exportSystem['batchExporter']['memoryMonitor'].getMemoryLimit()).toBe(memoryLimit);
    });

    it('should update memory limits dynamically', () => {
      exportSystem.updateMemoryLimit(1024 * 1024 * 75); // 75MB

      const stats = exportSystem.getStats();
      expect(stats.schedulerStats.memoryUsage).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple scheduled exports', () => {
      const scheduleIds = [
        exportSystem.schedule('Export 1', { frequency: 'hourly' }, testData),
        exportSystem.schedule('Export 2', { frequency: 'daily' }, testData),
        exportSystem.schedule('Export 3', { frequency: 'weekly' }, testData)
      ];

      expect(scheduleIds).toHaveLength(3);
      expect(scheduleIds.every(id => id.match(/^schedule-/))).toBe(true);

      const stats = exportSystem.getStats();
      expect(stats.schedulerStats.totalSchedules).toBe(3);
    });

    it('should respect max concurrent jobs', () => {
      exportSystem.updateMaxConcurrent(1);

      const stats = exportSystem.getStats();
      expect(stats.schedulerStats.maxConcurrent).toBe(1);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should clean up resources on shutdown', async () => {
      exportSystem.schedule('Test Export', { frequency: 'hourly' }, testData);
      exportSystem.startScheduler();

      await exportSystem.shutdown();

      const stats = exportSystem.getStats();
      expect(stats.schedulerStats.totalSchedules).toBe(0);
    });

    it('should handle multiple exports before cleanup', async () => {
      const results = await Promise.all([
        exportSystem.export(testData, 'json'),
        exportSystem.export(testData, 'csv'),
        exportSystem.batchExport(testData, 'json', { chunkSize: 2 })
      ]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.recordCount === 5)).toBe(true);

      await exportSystem.shutdown();
    });
  });

  describe('System Statistics', () => {
    it('should provide comprehensive system stats', () => {
      const stats = exportSystem.getStats();

      expect(stats.formatEngine).toContain('csv');
      expect(stats.formatEngine).toContain('json');
      expect(stats.formatEngine).toContain('parquet');
      expect(stats.formatEngine).toContain('excel');
      expect(stats.schedulerStats).toHaveProperty('totalSchedules');
      expect(stats.schedulerStats).toHaveProperty('activeSchedules');
      expect(stats.processorStats).toHaveProperty('totalRecords');
      expect(stats.processorStats).toHaveProperty('processingTime');
    });

    it('should update stats after operations', async () => {
      await exportSystem.process(testData, {});

      const stats = exportSystem.getStats();
      expect(stats.processorStats.totalRecords).toBe(5);
      expect(stats.processorStats.processingTime).toBeGreaterThan(0);
    });
  });
});