import { FormatEngineImpl } from '../../src/formats/engine';
import { ExportOptions, ExportFormat, CompressionType, ExportRecord } from '../../src/types';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('FormatEngine', () => {
  let formatEngine: FormatEngineImpl;
  const testData: ExportRecord[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, active: true },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, active: false },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, active: true }
  ];

  beforeEach(() => {
    formatEngine = new FormatEngineImpl();
    jest.clearAllMocks();
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = formatEngine.getSupportedFormats();
      expect(formats).toEqual(['csv', 'json', 'parquet', 'excel']);
    });
  });

  describe('CSV Export', () => {
    it('should export data to CSV with headers', async () => {
      const options: ExportOptions = { format: 'csv', includeHeaders: true };
      const result = await formatEngine.export(testData, options);

      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(3);
      expect(result.path).toBeDefined();
      expect(result.size).toBeGreaterThan(0);

      const content = await fs.readFile(result.path, 'utf8');
      expect(content).toContain('id,name,email,age,active');
      expect(content).toContain('John Doe');
      expect(content).toContain('jane@example.com');
    });

    it('should export data to CSV without headers', async () => {
      const options: ExportOptions = { format: 'csv', includeHeaders: false };
      const result = await formatEngine.export(testData, options);

      const content = await fs.readFile(result.path, 'utf8');
      expect(content).not.toContain('id,name,email,age,active');
      expect(content).toContain('John Doe');
    });

    it('should handle custom delimiter', async () => {
      const options: ExportOptions = { format: 'csv', delimiter: ';', includeHeaders: true };
      const result = await formatEngine.export(testData, options);

      const content = await fs.readFile(result.path, 'utf8');
      expect(content).toContain(';');
      expect(content).toContain('John Doe;jane@example.com');
    });

    it('should handle empty data array', async () => {
      const options: ExportOptions = { format: 'csv', includeHeaders: true };
      const result = await formatEngine.export([], options);

      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(0);
      expect(result.size).toBe(0);

      const content = await fs.readFile(result.path, 'utf8');
      expect(content).toBe('');
    });
  });

  describe('JSON Export', () => {
    it('should export data to JSON with pretty printing', async () => {
      const options: ExportOptions = { format: 'json', prettyPrint: true };
      const result = await formatEngine.export(testData, options);

      expect(result.format).toBe('json');
      expect(result.recordCount).toBe(3);

      const content = await fs.readFile(result.path, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testData);
      expect(content).toContain('\n'); // Pretty printing adds newlines
    });

    it('should export data to JSON without pretty printing', async () => {
      const options: ExportOptions = { format: 'json', prettyPrint: false };
      const result = await formatEngine.export(testData, options);

      const content = await fs.readFile(result.path, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testData);
      expect(content).not.toContain('\n'); // No pretty printing
    });
  });

  describe('Validation', () => {
    it('should validate CSV format', async () => {
      const options: ExportOptions = { format: 'csv', includeHeaders: true };
      const isValid = await formatEngine.validate(testData, options);
      expect(isValid).toBe(true);
    });

    it('should validate JSON format', async () => {
      const options: ExportOptions = { format: 'json' };
      const isValid = await formatEngine.validate(testData, options);
      expect(isValid).toBe(true);
    });

    it('should handle invalid data format', async () => {
      const invalidData: any[] = [null, undefined, 'invalid'];
      const options: ExportOptions = { format: 'json' };
      const isValid = await formatEngine.validate(invalidData, options);
      expect(isValid).toBe(false);
    });
  });

  describe('Compression', () => {
    it('should handle gzip compression', async () => {
      const options: ExportOptions = { format: 'json', compression: 'gzip' };
      const result = await formatEngine.export(testData, options);

      expect(result.format).toBe('json');
      expect(result.metadata?.compression).toBe('gzip');
    });

    it('should handle brotli compression', async () => {
      const options: ExportOptions = { format: 'json', compression: 'brotli' };
      const result = await formatEngine.export(testData, options);

      expect(result.format).toBe('json');
      expect(result.metadata?.compression).toBe('brotli');
    });

    it('should handle no compression', async () => {
      const options: ExportOptions = { format: 'json', compression: 'none' };
      const result = await formatEngine.export(testData, options);

      expect(result.format).toBe('json');
      expect(result.metadata?.compression).toBe('none');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      const options: ExportOptions = { format: 'xml' as any };
      await expect(formatEngine.export(testData, options)).rejects.toThrow('Unsupported format: xml');
    });

    it('should emit events during export', async () => {
      const mockEmit = jest.fn();
      formatEngine.emit = mockEmit;

      const options: ExportOptions = { format: 'csv' };
      await formatEngine.export(testData, options);

      expect(mockEmit).toHaveBeenCalledWith('export-start', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('export-complete', expect.any(Object));
    });

    it('should emit error event on failure', async () => {
      const mockEmit = jest.fn();
      formatEngine.emit = mockEmit;

      // Force an error by using invalid format
      const options: ExportOptions = { format: 'xml' as any };
      await expect(formatEngine.export(testData, options)).rejects.toThrow();

      expect(mockEmit).toHaveBeenCalledWith('export-error', expect.any(Object));
    });
  });

  describe('Schema Inference', () => {
    it('should infer schema from data', () => {
      const schema = (formatEngine as any).inferSchema(testData);
      expect(schema).toHaveProperty('id');
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('email');
      expect(schema).toHaveProperty('age');
      expect(schema).toHaveProperty('active');
      expect(schema.id.type).toBe('int32');
      expect(schema.name.type).toBe('string');
      expect(schema.active.type).toBe('boolean');
    });

    it('should handle empty data array', () => {
      const schema = (formatEngine as any).inferSchema([]);
      expect(schema).toEqual({});
    });
  });

  describe('Cleanup', () => {
    it('should clean up temporary files', async () => {
      const mockUnlink = jest.fn().mockResolvedValue(undefined);
      (fs.unlink as jest.Mock).mockImplementation(mockUnlink);

      await formatEngine.cleanup();
      expect(mockUnlink).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeData = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 100),
        active: i % 2 === 0
      }));

      const options: ExportOptions = { format: 'json' };
      const startTime = Date.now();
      const result = await formatEngine.export(largeData, options);
      const endTime = Date.now();

      expect(result.recordCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});