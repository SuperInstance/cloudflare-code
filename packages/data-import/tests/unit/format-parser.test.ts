import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FormatParser, type ParseResult } from '../../src/formats';
import { DataFormat } from '../../src/types';

describe('FormatParser', () => {
  let parser: FormatParser;
  let testDir: string;

  beforeEach(() => {
    parser = new FormatParser();
    testDir = join(__dirname, '../fixtures');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('CSV Parsing', () => {
    it('should parse CSV files with headers', async () => {
      // Create test CSV file
      const csvContent = 'name,age,email\nJohn,25,john@example.com\nJane,30,jane@example.com';
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.csv'), csvContent);

      const result = await parser.parse(join(testDir, 'test.csv'), 'csv');

      expect(result).toMatchObject<ParseResult>({
        data: [
          { name: 'John', age: 25, email: 'john@example.com' },
          { name: 'Jane', age: 30, email: 'jane@example.com' },
        ],
        metadata: {
          format: 'csv',
          totalRecords: 2,
          columns: ['name', 'age', 'email'],
        },
      });
    });

    it('should infer CSV format automatically', async () => {
      const csvContent = 'name,age,email\nJohn,25,john@example.com';
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'data.csv'), csvContent);

      const result = await parser.parse(join(testDir, 'data.csv'));

      expect(result.metadata.format).toBe('csv');
    });

    it('should handle different CSV delimiters', async () => {
      const csvContent = 'name;age;email\nJohn;25;john@example.com\nJane;30;jane@example.com';
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.csv'), csvContent);

      const result = await parser.parse(join(testDir, 'test.csv'), 'csv');

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ name: 'John', age: 25, email: 'john@example.com' });
    });
  });

  describe('JSON Parsing', () => {
    it('should parse JSON array files', async () => {
      const jsonData = [
        { id: 1, name: 'John', age: 25 },
        { id: 2, name: 'Jane', age: 30 },
      ];
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.json'), JSON.stringify(jsonData));

      const result = await parser.parse(join(testDir, 'test.json'), 'json');

      expect(result).toMatchObject<ParseResult>({
        data: jsonData,
        metadata: {
          format: 'json',
          totalRecords: 2,
          columns: ['id', 'name', 'age'],
        },
      });
    });

    it('should parse JSON object files', async () => {
      const jsonData = { id: 1, name: 'John', age: 25 };
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.json'), JSON.stringify(jsonData));

      const result = await parser.parse(join(testDir, 'test.json'), 'json');

      expect(result).toMatchObject<ParseResult>({
        data: [jsonData],
        metadata: {
          format: 'json',
          totalRecords: 1,
          columns: ['id', 'name', 'age'],
        },
      });
    });

    it('should infer JSON format automatically', async () => {
      const jsonData = [{ id: 1, name: 'John' }];
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'data.json'), JSON.stringify(jsonData));

      const result = await parser.parse(join(testDir, 'data.json'));

      expect(result.metadata.format).toBe('json');
    });
  });

  describe('Excel Parsing', () => {
    it('should parse Excel files', async () => {
      // Create a simple Excel-like content for testing
      const excelContent = `Name,Age,Email
John,25,john@example.com
Jane,30,jane@example.com
Bob,35,bob@example.com`;
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.xlsx'), excelContent);

      const result = await parser.parse(join(testDir, 'test.xlsx'), 'excel');

      expect(result).toMatchObject<ParseResult>({
        data: expect.arrayContaining([
          expect.objectContaining({ Name: 'John', Age: 25, Email: 'john@example.com' }),
          expect.objectContaining({ Name: 'Jane', Age: 30, Email: 'jane@example.com' }),
          expect.objectContaining({ Name: 'Bob', Age: 35, Email: 'bob@example.com' }),
        ]),
        metadata: {
          format: 'excel',
          totalRecords: 3,
          columns: ['Name', 'Age', 'Email'],
        },
      });
    });
  });

  describe('Format Detection', () => {
    it('should detect format based on file extension', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'data.csv'), 'name,age\nJohn,25');
      await fs.writeFile(join(testDir, 'data.json'), '{"name":"John"}');

      const csvResult = await parser.detectFormat(join(testDir, 'data.csv'));
      const jsonResult = await parser.detectFormat(join(testDir, 'data.json'));

      expect(csvResult).toBe('csv');
      expect(jsonResult).toBe('json');
    });

    it('should detect format based on content', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'unknown_file'), 'name,age,email\nJohn,25,john@example.com');

      const result = await parser.detectFormat(join(testDir, 'unknown_file'));

      expect(result).toBe('csv');
    });
  });

  describe('Schema Inference', () => {
    it('should infer schema from sample data', async () => {
      const data = [
        { id: 1, name: 'John', age: 25, active: true, tags: ['admin', 'user'] },
        { id: 2, name: 'Jane', age: 30, active: false, tags: ['user'] },
      ];
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.json'), JSON.stringify(data));

      const result = await parser.parse(join(testDir, 'test.json'), 'json');

      expect(result.metadata.schema).toBeDefined();
      expect(result.metadata.schema?.type).toBe('object');
      expect(result.metadata.schema?.properties?.id?.type).toBe('number');
      expect(result.metadata.schema?.properties?.name?.type).toBe('string');
      expect(result.metadata.schema?.properties?.age?.type).toBe('number');
      expect(result.metadata.schema?.properties?.active?.type).toBe('boolean');
    });

    it('should infer email format', async () => {
      const data = [
        { email: 'john@example.com' },
        { email: 'jane.doe@test.org' },
      ];
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'test.json'), JSON.stringify(data));

      const result = await parser.parse(join(testDir, 'test.json'), 'json');

      expect(result.metadata.schema?.properties?.email?.format).toBe('email');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid file format', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'invalid.xml'), '<invalid>data</invalid>');

      await expect(parser.parse(join(testDir, 'invalid.xml'))).rejects.toThrow();
    });

    it('should throw error for empty file', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'empty.csv'), '');

      await expect(parser.parse(join(testDir, 'empty.csv'))).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large files efficiently', async () => {
      // Create a large CSV file
      const csvLines = [];
      csvLines.push('id,name,email');
      for (let i = 0; i < 10000; i++) {
        csvLines.push(`${i},User${i},user${i}@example.com`);
      }
      const csvContent = csvLines.join('\n');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'large.csv'), csvContent);

      const startTime = performance.now();
      const result = await parser.parse(join(testDir, 'large.csv'), 'csv');
      const endTime = performance.now();

      expect(result.data).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});