import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataValidator, type ValidationContext } from '../../src/validator';
import { ValidationRule, ValidationType, ImportRecord } from '../../src/types';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('Basic Validation', () => {
    it('should validate required fields', async () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
        { field: 'email', type: 'email', required: true },
      ];

      const records = [
        { name: 'John', email: 'john@example.com' },
        { name: '', email: 'jane@example.com' },
        { name: 'Bob', email: '' },
        { name: '', email: '' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate string fields with length constraints', async () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true, options: { minLength: 3, maxLength: 50 } },
      ];

      const records = [
        { name: 'Jo' },
        { name: 'John' },
        { name: 'A'.repeat(50) },
        { name: 'A'.repeat(51) },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(false);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate numeric fields with range constraints', async () => {
      const rules: ValidationRule[] = [
        { field: 'age', type: 'number', required: true, options: { min: 18, max: 65 } },
      ];

      const records = [
        { age: 17 },
        { age: 18 },
        { age: 30 },
        { age: 65 },
        { age: 66 },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(false);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(true);
      expect(results[4].isValid).toBe(false);
    });

    it('should validate email format', async () => {
      const rules: ValidationRule[] = [
        { field: 'email', type: 'email', required: true },
      ];

      const records = [
        { email: 'john@example.com' },
        { email: 'jane.doe@test.org' },
        { email: 'invalid-email' },
        { email: 'another@invalid' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate date format', async () => {
      const rules: ValidationRule[] = [
        { field: 'birthDate', type: 'date', required: true, options: { format: 'YYYY-MM-DD' } },
      ];

      const records = [
        { birthDate: '1990-01-01' },
        { birthDate: '2023-12-31' },
        { birthDate: '01/01/1990' },
        { birthDate: 'invalid-date' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate URL format', async () => {
      const rules: ValidationRule[] = [
        { field: 'website', type: 'url', required: true },
      ];

      const records = [
        { website: 'https://example.com' },
        { website: 'http://test.org/path' },
        { website: 'invalid-url' },
        { website: 'not-a-url' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate regex patterns', async () => {
      const rules: ValidationRule[] = [
        { field: 'phone', type: 'regex', required: true, options: { pattern: '^\\+?[0-9]{10,15}$' } },
      ];

      const records = [
        { phone: '+1234567890' },
        { phone: '1234567890' },
        { phone: '123' },
        { phone: 'abc123456' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate array type', async () => {
      const rules: ValidationRule[] = [
        { field: 'tags', type: 'array', required: true },
      ];

      const records = [
        { tags: ['admin', 'user'] },
        { tags: [] },
        { tags: 'not-an-array' },
        { tags: null },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });

    it('should validate object type', async () => {
      const rules: ValidationRule[] = [
        { field: 'metadata', type: 'object', required: true },
      ];

      const records = [
        { metadata: { created: '2023-01-01', modified: '2023-12-31' } },
        { metadata: {} },
        { metadata: 'not-an-object' },
        { metadata: null },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    it('should validate against JSON schema', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string', format: 'email' },
        },
        required: ['name', 'email'],
      };

      const records = [
        { name: 'John', age: 25, email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
        { name: 'Bob', age: 30, email: 'bob@example.com' },
        { name: 'Alice', age: 'not-a-number', email: 'alice@example.com' },
      ];

      const results = await validator.validateRecords(records, [], schema);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false);
    });

    it('should handle complex nested schemas', async () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              profile: {
                type: 'object',
                properties: {
                  age: { type: 'number' },
                  interests: { type: 'array', items: { type: 'string' } },
                },
                required: ['age'],
              },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      };

      const records = [
        {
          user: {
            name: 'John',
            profile: { age: 25, interests: ['music', 'sports'] },
          },
        },
        {
          user: {
            name: 'Jane',
            profile: { interests: ['reading'] },
          },
        },
      ];

      const results = await validator.validateRecords(records, [], schema);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
    });
  });

  describe('Custom Validators', () => {
    it('should use custom validators', async () => {
      const customValidator = (value: any, context: ValidationContext) => {
        return value.startsWith('valid-');
      };

      validator.addCustomValidator('customField', customValidator);

      const rules: ValidationRule[] = [
        { field: 'customField', type: 'custom', required: true },
      ];

      const records = [
        { customField: 'valid-value' },
        { customField: 'invalid-value' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
    });
  });

  describe('Validation Scoring', () => {
    it('should calculate quality scores', async () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: true },
        { field: 'email', type: 'email', required: true },
      ];

      const records = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: '' },
        { name: '', email: 'jane@example.com' },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].score).toBeGreaterThan(results[2].score);
      expect(results[0].score).toBe(1);
      expect(results[1].score).toBeGreaterThan(0);
      expect(results[1].score).toBeLessThan(1);
    });
  });

  describe('Validation Reports', () => {
    it('should generate validation reports', async () => {
      const rules: ValidationRule[] = [
        { field: 'email', type: 'email', required: true },
        { field: 'age', type: 'number', required: true },
      ];

      const records = [
        { email: 'john@example.com', age: 25 },
        { email: 'invalid-email', age: 30 },
        { email: 'jane@example.com', age: 'not-a-number' },
        { email: '', age: 35 },
      ];

      const results = await validator.validateRecords(records, rules);
      const report = validator.generateValidationReport(results);

      expect(report.totalRecords).toBe(4);
      expect(report.validRecords).toBe(1);
      expect(report.invalidRecords).toBe(3);
      expect(report.errorDistribution).toBeDefined();
      expect(report.commonErrors).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should validate large datasets efficiently', async () => {
      const rules: ValidationRule[] = [
        { field: 'id', type: 'number', required: true },
        { field: 'name', type: 'string', required: true },
        { field: 'email', type: 'email', required: true },
      ];

      const records = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@example.com`,
      }));

      const startTime = performance.now();
      const results = await validator.validateRecords(records, rules);
      const endTime = performance.now();

      expect(results).toHaveLength(10000);
      expect(results.every(r => r.isValid)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should achieve sub-50ms validation time per record', async () => {
      const rules: ValidationRule[] = [
        { field: 'email', type: 'email', required: true },
      ];

      const records = Array.from({ length: 1000 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const startTime = performance.now();
      await validator.validateRecords(records, rules);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerRecord = totalTime / records.length;

      expect(totalTime).toBeLessThan(50000); // Total time under 50 seconds
      expect(avgTimePerRecord).toBeLessThan(50); // Less than 50ms per record
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid validation rules gracefully', async () => {
      const rules: ValidationRule[] = [
        { field: 'invalidField', type: 'invalidType' as any, required: true },
      ];

      const records = [{ name: 'John' }];

      await expect(validator.validateRecords(records, rules)).rejects.toThrow();
    });

    it('should handle null and undefined values', async () => {
      const rules: ValidationRule[] = [
        { field: 'name', type: 'string', required: false },
        { field: 'age', type: 'number', required: false },
      ];

      const records = [
        { name: 'John', age: 25 },
        { name: null, age: undefined },
        { name: undefined, age: null },
      ];

      const results = await validator.validateRecords(records, rules);

      expect(results.every(r => r.isValid)).toBe(true);
    });
  });
});