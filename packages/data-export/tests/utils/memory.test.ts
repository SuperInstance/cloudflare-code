import { MemoryMonitorImpl, createMemoryAwareChunker, calculateChunkSize, estimateRecordSize } from '../../src/utils/memory';

describe('Memory Utils', () => {
  describe('MemoryMonitorImpl', () => {
    let monitor: MemoryMonitorImpl;

    beforeEach(() => {
      monitor = new MemoryMonitorImpl(1024 * 1024 * 100); // 100MB limit
      jest.clearAllMocks();
    });

    it('should create memory monitor with default limit', () => {
      const defaultMonitor = new MemoryMonitorImpl();
      expect(defaultMonitor.getMemoryLimit()).toBe(1024 * 1024 * 500); // 500MB default
    });

    it('should get and set memory limit', () => {
      expect(monitor.getMemoryLimit()).toBe(1024 * 1024 * 100);

      monitor.setMemoryLimit(1024 * 1024 * 200);
      expect(monitor.getMemoryLimit()).toBe(1024 * 1024 * 200);
    });

    it('should check memory limit', () => {
      // Mock memory usage to be below limit
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 80 * 1024 * 1024
      });

      expect(monitor.isMemoryLimitExceeded()).toBe(false);

      // Mock memory usage to be above limit
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 150 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        rss: 180 * 1024 * 1024
      });

      expect(monitor.isMemoryLimitExceeded()).toBe(true);
    });

    it('should call callback when memory limit exceeded', () => {
      const callback = jest.fn();
      monitor.onMemoryLimit(callback);

      // Mock memory usage to be above limit
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 150 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        rss: 180 * 1024 * 1024
      });

      monitor.checkMemory();
      expect(callback).toHaveBeenCalled();
    });

    it('should not call callback when memory limit not exceeded', () => {
      const callback = jest.fn();
      monitor.onMemoryLimit(callback);

      // Mock memory usage to be below limit
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 80 * 1024 * 1024
      });

      monitor.checkMemory();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('estimateRecordSize', () => {
    it('should estimate size for empty array', () => {
      const size = estimateRecordSize([]);
      expect(size).toBe(0);
    });

    it('should estimate size for simple records', () => {
      const records = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 }
      ];

      const size = estimateRecordSize(records);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should estimate size for complex records', () => {
      const records = [
        {
          id: 1,
          name: 'John Doe',
          details: {
            age: 30,
            hobbies: ['reading', 'swimming'],
            address: {
              street: '123 Main St',
              city: 'New York'
            }
          },
          tags: ['user', 'admin']
        }
      ];

      const size = estimateRecordSize(records);
      expect(size).toBeGreaterThan(0);
    });

    it('should handle large datasets', () => {
      const largeData = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        data: 'x'.repeat(100) // 100 bytes per record
      }));

      const size = estimateRecordSize(largeData);
      expect(size).toBeGreaterThan(100000); // Should be at least 100KB
    });
  });

  describe('calculateChunkSize', () => {
    it('should calculate chunk size with default parameters', () => {
      const chunkSize = calculateChunkSize(1000);
      expect(chunkSize).toBeGreaterThan(0);
      expect(chunkSize).toBeLessThanOrEqual(1000);
    });

    it('should calculate chunk size with custom memory limit', () => {
      const chunkSize1 = calculateChunkSize(1000, 50); // 50MB
      const chunkSize2 = calculateChunkSize(1000, 200); // 200MB

      expect(chunkSize2).toBeGreaterThan(chunkSize1);
    });

    it('should handle zero records', () => {
      const chunkSize = calculateChunkSize(0);
      expect(chunkSize).toBe(0);
    });

    it('should handle large number of records', () => {
      const chunkSize = calculateChunkSize(1000000, 100); // 1M records, 100MB limit
      expect(chunkSize).toBeGreaterThan(0);
      expect(chunkSize).toBeLessThanOrEqual(1000000);
    });

    it('should respect safety factor', () => {
      const chunkSize1 = calculateChunkSize(1000, 100, 0.5); // 50% safety
      const chunkSize2 = calculateChunkSize(1000, 100, 0.8); // 80% safety

      expect(chunkSize1).toBeGreaterThan(chunkSize2);
    });
  });

  describe('createMemoryAwareChunker', () => {
    it('should create chunks for empty array', () => {
      const chunks = createMemoryAwareChunker([]);
      expect(chunks).toEqual([]);
    });

    it('should create single chunk for small dataset', () => {
      const data = Array(10).fill(null).map((_, i) => ({ id: i }));
      const chunks = createMemoryAwareChunker(data, 100); // 100MB target

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toHaveLength(10);
    });

    it('should create multiple chunks for large dataset', () => {
      const data = Array(1000).fill(null).map((_, i) => ({ id: i, data: 'x'.repeat(100) }));
      const chunks = createMemoryAwareChunker(data, 10); // 10MB target

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.length).toBeLessThanOrEqual(1000);
      expect(chunks[0]).toHaveLength(100); // Approximately
    });

    it('should create balanced chunks', () => {
      const data = Array(100).fill(null).map((_, i) => ({ id: i }));
      const chunks = createMemoryAwareChunker(data, 50); // 50MB target

      // All chunks should be approximately the same size
      const chunkSizes = chunks.map(chunk => chunk.length);
      const avgSize = chunkSizes.reduce((sum, size) => sum + size, 0) / chunkSizes.length;
      const maxSize = Math.max(...chunkSizes);
      const minSize = Math.min(...chunkSizes);

      expect(maxSize - minSize).toBeLessThanOrEqual(2); // Max difference of 2 records
    });

    it('should handle memory limit of 0', () => {
      const data = Array(100).fill(null).map((_, i) => ({ id: i }));
      const chunks = createMemoryAwareChunker(data, 0);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThanOrEqual(100);
    });

    it('should preserve all records in chunks', () => {
      const data = Array(1000).fill(null).map((_, i) => ({ id: i }));
      const chunks = createMemoryAwareChunker(data, 10);

      const totalRecords = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalRecords).toBe(1000);
    });
  });

  describe('integration tests', () => {
    it('should work together for memory-efficient processing', () => {
      // Create a large dataset
      const largeData = Array(50000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        data: 'x'.repeat(200) // 200 bytes per record
      }));

      // Estimate record size
      const estimatedSize = estimateRecordSize(largeData.slice(0, 100)); // Sample of 100 records
      const sizePerRecord = estimatedSize / 100;

      // Calculate chunk size for 100MB memory limit
      const targetMemoryMB = 100;
      const targetMemoryBytes = targetMemoryMB * 1024 * 1024;
      const safetyFactor = 0.7;
      const maxRecordsPerChunk = Math.floor(targetMemoryBytes * safetyFactor / sizePerRecord);
      const chunkSize = Math.min(maxRecordsPerChunk, Math.ceil(largeData.length / 5)); // At least 5 chunks

      // Create chunks
      const chunks = createMemoryAwareChunker(largeData, targetMemoryMB);

      // Verify chunks are reasonable
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThanOrEqual(largeData.length);

      // Verify total records preserved
      const totalRecords = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalRecords).toBe(largeData.length);

      // Verify chunks are not too large
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(chunkSize * 2); // Allow some flexibility
      });
    });

    it('should handle extreme memory constraints', () => {
      const data = Array(10000).fill(null).map((_, i) => ({ id: i, largeData: 'x'.repeat(10000) }));

      // Very small memory limit
      const chunks = createMemoryAwareChunker(data, 1); // 1MB limit

      expect(chunks.length).toBeGreaterThan(10); // Should create many small chunks
      expect(chunks[0].length).toBeLessThan(100); // Small chunks
    });
  });
});