import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createDataImportSystem } from '../../src';
import { ImportJob, ValidationRule, TransformationRule } from '../../src/types';

describe('Full Import Flow Integration', () => {
  let system: any;
  let testDir: string;

  beforeEach(() => {
    testDir = join(__dirname, '../fixtures/integration');
    system = createDataImportSystem({
      processorOptions: {
        batchSize: 10,
        enableLogging: false,
      },
      schedulingOptions: {
        enableLogging: false,
      },
      enableAnalytics: true,
      enableRealtimeProgress: false,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    system.cleanup();
  });

  describe('Complete Import Pipeline', () => {
    it('should process a complete import pipeline with validation and transformation', async () => {
      // Create test CSV file
      const csvContent = `id,name,email,age,active
1,John Doe,john@example.com,25,true
2,Jane Smith,jane@example.com,30,false
3,Bob Johnson,bob@example.com,35,true
4,Alice Williams,alice@example.com,28,true`;

      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'users.csv'), csvContent);

      // Define validation rules
      const validationRules: ValidationRule[] = [
        { field: 'id', type: 'number', required: true },
        { field: 'name', type: 'string', required: true, options: { minLength: 2, maxLength: 50 } },
        { field: 'email', type: 'email', required: true },
        { field: 'age', type: 'number', required: true, options: { min: 18, max: 100 } },
        { field: 'active', type: 'boolean', required: false },
      ];

      // Define transformation rules
      const transformationRules: TransformationRule[] = [
        { target: 'user_id', source: 'id', type: 'mapping' },
        { target: 'full_name', type: 'enrichment', options: { type: 'concat', parts: ['$name'] } },
        { target: 'status', type: 'enrichment', options: { type: 'conditional', condition: '$active', true: 'active', false: 'inactive' } },
        { target: 'name', type: 'normalization', options: { type: 'trim' } },
        { target: 'email', type: 'normalization', options: { type: 'lowercase' } },
      ];

      // Configure import job
      const job: ImportJob = {
        name: 'Users Import with Validation and Transformation',
        source: {
          type: 'file',
          format: 'csv',
          path: join(testDir, 'users.csv'),
        },
        config: {
          validationRules,
          transformations: transformationRules,
          batchSize: 10,
          conflictResolution: 'skip',
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
        metadata: {
          sourceSchema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              age: { type: 'number' },
              active: { type: 'boolean' },
            },
            required: ['id', 'name', 'email', 'age'],
          },
          targetSchema: {
            type: 'object',
            properties: {
              user_id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              age: { type: 'number' },
              active: { type: 'boolean' },
              full_name: { type: 'string' },
              status: { type: 'string' },
            },
            required: ['user_id', 'name', 'email', 'age', 'full_name', 'status'],
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Start the job
      const jobId = await system.processor.startJob(job);
      expect(jobId).toBeDefined();

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check job status
      const completedJob = system.processor.getJob(jobId);
      expect(completedJob!.status).toBe('completed');
      expect(completedJob!.progress.successful).toBe(4);
      expect(completedJob!.progress.failed).toBe(0);

      // Check analytics
      const analytics = system.analytics.getAnalytics();
      expect(analytics.totalImports).toBe(1);
      expect(analytics.successfulImports).toBe(1);
      expect(analytics.totalRecordsProcessed).toBe(4);

      // Check system stats
      const stats = system.getSystemStats();
      expect(stats.processor.completedJobs).toBe(1);
      expect(stats.processor.totalRecordsProcessed).toBe(4);
    });

    it('should handle invalid data with proper error reporting', async () => {
      // Create CSV with some invalid data
      const csvContent = `id,name,email,age,active
1,John Doe,john@example.com,25,true
2,Jane Smith,jane@example.com,invalid-email,30,false
3,Bob Johnson,35,true
4,Alice Williams,alice@example.com,28,true`;

      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'invalid-users.csv'), csvContent);

      const validationRules: ValidationRule[] = [
        { field: 'id', type: 'number', required: true },
        { field: 'name', type: 'string', required: true },
        { field: 'email', type: 'email', required: true },
        { field: 'age', type: 'number', required: true },
      ];

      const job: ImportJob = {
        name: 'Invalid Data Import',
        source: {
          type: 'file',
          format: 'csv',
          path: join(testDir, 'invalid-users.csv'),
        },
        config: {
          validationRules,
          conflictResolution: 'skip',
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

      const jobId = await system.processor.startJob(job);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const completedJob = system.processor.getJob(jobId);
      expect(completedJob!.progress.successful).toBeLessThan(4);

      const report = system.analytics.getErrorAnalysis();
      expect(report.length).toBeGreaterThan(0);
    });

    it('should handle large file imports efficiently', async () => {
      // Create a large CSV file
      const lines = ['id,name,email'];
      for (let i = 1; i <= 10000; i++) {
        lines.push(`${i},User${i},user${i}@example.com`);
      }
      const csvContent = lines.join('\n');

      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'large-users.csv'), csvContent);

      const job: ImportJob = {
        name: 'Large File Import',
        source: {
          type: 'file',
          format: 'csv',
          path: join(testDir, 'large-users.csv'),
        },
        config: {
          batchSize: 500,
          conflictResolution: 'skip',
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

      const startTime = performance.now();
      const jobId = await system.processor.startJob(job);

      await new Promise(resolve => setTimeout(resolve, 10000));

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      const completedJob = system.processor.getJob(jobId);
      expect(completedJob!.progress.successful).toBe(10000);
      expect(processingTime).toBeLessThan(30000); // Should complete in under 30 seconds

      // Performance metrics
      const avgTimePerRecord = processingTime / 10000;
      expect(avgTimePerRecord).toBeLessThan(3); // Less than 3ms per record
    });

    it('should support multiple format imports', async () => {
      // Create test files in different formats
      await fs.mkdir(testDir, { recursive: true });

      // CSV
      const csvContent = `id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com`;
      await fs.writeFile(join(testDir, 'users.csv'), csvContent);

      // JSON
      const jsonData = [
        { id: 3, name: 'Bob', email: 'bob@example.com' },
        { id: 4, name: 'Alice', email: 'alice@example.com' },
      ];
      await fs.writeFile(join(testDir, 'users.json'), JSON.stringify(jsonData));

      // Process CSV
      const csvJob: ImportJob = {
        name: 'CSV Import',
        source: {
          type: 'file',
          format: 'csv',
          path: join(testDir, 'users.csv'),
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

      const csvJobId = await system.processor.startJob(csvJob);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process JSON
      const jsonJob: ImportJob = {
        name: 'JSON Import',
        source: {
          type: 'file',
          format: 'json',
          path: join(testDir, 'users.json'),
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

      const jsonJobId = await system.processor.startJob(jsonJob);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check results
      const csvResult = system.processor.getJob(csvJobId);
      const jsonResult = system.processor.getJob(jsonJobId);

      expect(csvResult!.progress.successful).toBe(2);
      expect(jsonResult!.progress.successful).toBe(2);

      // Check format distribution in analytics
      const analytics = system.analytics.getAnalytics();
      expect(analytics.formatDistribution.csv).toBe(2);
      expect(analytics.formatDistribution.json).toBe(2);
    });

    it('should support bulk operations', async () => {
      await fs.mkdir(testDir, { recursive: true });

      // Create multiple test files
      const csvContent = `id,name\n1,John\n2,Jane`;
      await fs.writeFile(join(testDir, 'bulk1.csv'), csvContent);
      await fs.writeFile(join(testDir, 'bulk2.csv'), csvContent);

      const bulkOperation = system.bulkImport([
        {
          path: join(testDir, 'bulk1.csv'),
          format: 'csv',
        },
        {
          path: join(testDir, 'bulk2.csv'),
          format: 'csv',
        },
      ]);

      const startTime = performance.now();
      const bulkResult = await bulkOperation.execute(
        system.processor,
        system.transformer,
        system.validator
      );
      const endTime = performance.now();

      expect(bulkResult.operationCount).toBe(2);
      expect(bulkResult.executedOperations).toBe(2);
      expect(bulkResult.successRate).toBe(100);
      expect(bulkResult.totalProcessingTime).toBeLessThan(5000);
    });
  });

  describe('Error Recovery and Retry', () => {
    it('should retry failed operations', async () => {
      const job: ImportJob = {
        name: 'Retry Test',
        source: {
          type: 'file',
          format: 'csv',
          path: '/nonexistent/path.csv',
        },
        config: {
          maxRetries: 2,
          conflictResolution: 'skip',
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

      const jobId = await system.processor.startJob(job);
      await new Promise(resolve => setTimeout(resolve, 5000));

      const completedJob = system.processor.getJob(jobId);
      expect(completedJob!.status).toBe('failed');
      expect(completedJob!.progress.failed).toBe(1);
    });
  });

  describe('System Health Monitoring', () => {
    it('should provide comprehensive system health metrics', () => {
      const health = system.analytics.getHealthMetrics();

      expect(health).toMatchObject({
        systemLoad: expect.any(Number),
        memoryUsage: expect.any(Number),
        errorRate: expect.any(Number),
        throughput: expect.any(Number),
        healthScore: expect.any(Number),
      });

      expect(health.healthScore).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBeLessThanOrEqual(100);
    });

    it('should track performance trends', () => {
      const trends = system.analytics.getPerformanceTrends('hour');

      expect(trends).toMatchObject({
        throughput: expect.any(Number),
        successRate: expect.any(Number),
        averageProcessingTime: expect.any(Number),
        errorRate: expect.any(Number),
      });
    });

    it('should provide format insights', () => {
      const insights = system.analytics.getFormatInsights();

      expect(Array.isArray(insights)).toBe(true);
      insights.forEach(insight => {
        expect(insight).toMatchObject({
          format: expect.any(String),
          usageCount: expect.any(Number),
          successRate: expect.any(Number),
          averageProcessingTime: expect.any(Number),
          totalRecords: expect.any(Number),
        });
      });
    });
  });
});