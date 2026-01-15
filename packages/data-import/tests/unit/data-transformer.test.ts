import { describe, it, expect, beforeEach } from 'vitest';
import { DataTransformer, TransformationPipeline, type TransformationResult } from '../../src/transform';
import { TransformationRule, ImportRecord } from '../../src/types';

describe('DataTransformer', () => {
  let transformer: DataTransformer;

  beforeEach(() => {
    transformer = new DataTransformer();
  });

  describe('Basic Transformations', () => {
    it('should apply mapping transformations', async () => {
      const rules: TransformationRule[] = [
        { target: 'fullName', source: 'name', type: 'mapping' },
      ];

      const records = [
        { id: '1', data: { name: 'John Doe' }, status: 'pending' },
        { id: '2', data: { name: 'Jane Smith' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords).toHaveLength(2);
      expect(result.transformedRecords[0].data).toMatchObject({
        name: 'John Doe',
        fullName: 'John Doe',
      });
      expect(result.transformedRecords[1].data).toMatchObject({
        name: 'Jane Smith',
        fullName: 'Jane Smith',
      });
    });

    it('should apply conversion transformations', async () => {
      const rules: TransformationRule[] = [
        { target: 'age', source: 'ageInput', type: 'conversion', options: { type: 'number' } },
        { target: 'isActive', source: 'active', type: 'conversion', options: { type: 'boolean' } },
      ];

      const records = [
        { id: '1', data: { ageInput: '25', active: 'true' }, status: 'pending' },
        { id: '2', data: { ageInput: '30', active: '1' }, status: 'pending' },
        { id: '3', data: { ageInput: '35', active: 'false' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords).toHaveLength(3);
      expect(result.transformedRecords[0].data).toMatchObject({
        age: 25,
        isActive: true,
      });
      expect(result.transformedRecords[1].data).toMatchObject({
        age: 30,
        isActive: true,
      });
      expect(result.transformedRecords[2].data).toMatchObject({
        age: 35,
        isActive: false,
      });
    });

    it('should apply normalization transformations', async () => {
      const rules: TransformationRule[] = [
        { target: 'name', type: 'normalization', options: { type: 'uppercase' } },
        { target: 'email', type: 'normalization', options: { type: 'lowercase' } },
        { target: 'username', type: 'normalization', options: { type: 'slug' } },
      ];

      const records = [
        { id: '1', data: { name: '  john doe  ', email: 'JOHN@EXAMPLE.COM', username: 'John_Doe123' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data).toMatchObject({
        name: 'JOHN DOE',
        email: 'john@example.com',
        username: 'john-doe123',
      });
    });

    it('should apply enrichment transformations', async () => {
      const rules: TransformationRule[] = [
        { target: 'fullName', type: 'enrichment', options: { type: 'concat', parts: ['$firstName', ' ', '$lastName'] } },
        { target: 'recordId', type: 'enrichment', options: { type: 'sequence', start: 1, increment: 1 } },
      ];

      const records = [
        { id: '1', data: { firstName: 'John', lastName: 'Doe' }, status: 'pending' },
        { id: '2', data: { firstName: 'Jane', lastName: 'Smith' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules, {
        index: 0,
      });

      expect(result.transformedRecords[0].data).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        recordId: 1,
      });
    });
  });

  describe('Complex Transformations', () => {
    it('should apply conditional enrichment', async () => {
      const rules: TransformationRule[] = [
        {
          target: 'status',
          type: 'enrichment',
          options: {
            type: 'conditional',
            condition: 'eq 1',
            true: 'active',
            false: 'inactive',
          },
        },
      ];

      const records = [
        { id: '1', data: { priority: 1 }, status: 'pending' },
        { id: '2', data: { priority: 2 }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data.status).toBe('active');
      expect(result.transformedRecords[1].data.status).toBe('inactive');
    });

    it('should apply lookup enrichment', async () => {
      const rules: TransformationRule[] = [
        {
          target: 'role',
          type: 'enrichment',
          options: {
            type: 'lookup',
            map: { '1': 'admin', '2': 'user', '3': 'guest' },
          },
        },
      ];

      const records = [
        { id: '1', data: { userRole: '1' }, status: 'pending' },
        { id: '2', data: { userRole: '2' }, status: 'pending' },
        { id: '3', data: { userRole: '4' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data.role).toBe('admin');
      expect(result.transformedRecords[1].data.role).toBe('user');
      expect(result.transformedRecords[2].data.role).toBe('4'); // Falls back to original value
    });

    it('should apply replace transformation', async () => {
      const rules: TransformationRule[] = [
        {
          target: 'description',
          type: 'enrichment',
          options: {
            type: 'replace',
            search: 'old',
            replace: 'new',
          },
        },
      ];

      const records = [
        { id: '1', data: { description: 'This is old text with old words' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data.description).toBe('This is new text with new words');
    });

    it('should extract values using regex', async () => {
      const rules: TransformationRule[] = [
        {
          target: 'areaCode',
          type: 'enrichment',
          options: {
            type: 'extract',
            pattern: '\\((\\d{3})\\)',
            group: 1,
          },
        },
      ];

      const records = [
        { id: '1', data: { phone: '(555) 123-4567' }, status: 'pending' },
        { id: '2', data: { phone: '555-123-4567' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data.areaCode).toBe('555');
      expect(result.transformedRecords[1].data.areaCode).toBe(null);
    });
  });

  describe('Pipeline Processing', () => {
    it('should create and use transformation pipelines', async () => {
      const rules: TransformationRule[] = [
        { target: 'firstName', source: 'name', type: 'mapping' },
        { target: 'name', type: 'normalization', options: { type: 'uppercase' } },
      ];

      const pipeline = transformer.createTransformationPipeline(rules);
      const record: ImportRecord = {
        id: '1',
        data: { name: 'john doe' },
        status: 'pending',
      };

      const result = await pipeline.process(record);

      expect(result.data).toMatchObject({
        firstName: 'john doe',
        name: 'JOHN DOE',
      });
    });

    it('should manage pipeline rules', () => {
      const rules: TransformationRule[] = [
        { target: 'field1', source: 'source1', type: 'mapping' },
        { target: 'field2', source: 'source2', type: 'mapping' },
      ];

      const pipeline = transformer.createTransformationPipeline(rules);

      expect(pipeline.getRules()).toHaveLength(2);

      pipeline.removeRule('field1');
      expect(pipeline.getRules()).toHaveLength(1);

      pipeline.addRule({ target: 'field3', source: 'source3', type: 'mapping' });
      expect(pipeline.getRules()).toHaveLength(2);
    });
  });

  describe('Custom Transformers', () => {
    it('should use custom transformers', async () => {
      const customTransformer = (value: any, context: any) => {
        return value.toUpperCase().replace(/ /g, '_');
      };

      transformer.addCustomTransformer('customField', customTransformer);

      const rules: TransformationRule[] = [
        { target: 'customField', type: 'enrichment', options: { type: 'default', value: 'default_value' } },
      ];

      const records = [
        { id: '1', data: { customField: 'test value' }, status: 'pending' },
        { id: '2', data: { }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data.customField).toBe('TEST_VALUE');
      expect(result.transformedRecords[1].data.customField).toBe('default_value');
    });
  });

  describe('Error Handling', () => {
    it('should handle transformation errors gracefully', async () => {
      const rules: TransformationRule[] = [
        { target: 'result', type: 'enrichment', options: { type: 'invalid' } },
      ];

      const records = [
        { id: '1', data: { value: 'test' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Unknown transformation type');
    });

    it('should handle invalid conversion values', async () => {
      const rules: TransformationRule[] = [
        { target: 'number', type: 'conversion', options: { type: 'number' } },
      ];

      const records = [
        { id: '1', data: { value: 'not-a-number' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Cannot convert');
    });
  });

  describe('Performance', () => {
    it('should transform large datasets efficiently', async () => {
      const rules: TransformationRule[] = [
        { target: 'id', source: 'id', type: 'mapping' },
        { target: 'name', type: 'normalization', options: { type: 'uppercase' } },
        { target: 'email', type: 'normalization', options: { type: 'lowercase' } },
      ];

      const records = Array.from({ length: 10000 }, (_, i) => ({
        id: generateId(),
        data: {
          id: i,
          name: `user ${i}`,
          email: `USER${i}@EXAMPLE.COM`,
        },
        status: 'pending',
      }));

      const startTime = performance.now();
      const result = await transformer.transformRecords(records, rules);
      const endTime = performance.now();

      expect(result.transformedRecords).toHaveLength(10000);
      expect(result.transformationMetrics.successful).toBe(10000);
      expect(result.transformationMetrics.failed).toBe(0);
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should provide transformation metrics', async () => {
      const rules: TransformationRule[] = [
        { target: 'processed', type: 'enrichment', options: { type: 'timestamp' } },
      ];

      const records = [
        { id: '1', data: { value: 'test' }, status: 'pending' },
        { id: '2', data: { value: 'test' }, status: 'pending' },
      ];

      const result = await transformer.transformRecords(records, rules);
      const report = transformer.generateTransformationReport(result);

      expect(report.totalRecords).toBe(2);
      expect(report.successRate).toBe(100);
      expect(report.averageProcessingTime).toMatch(/\d+\.\d+ms/);
    });
  });

  describe('Nested Object Handling', () => {
    it('should handle nested field paths', async () => {
      const rules: TransformationRule[] = [
        { target: 'user.firstName', source: 'first', type: 'mapping' },
        { target: 'user.lastName', source: 'last', type: 'mapping' },
        { target: 'contact.email', type: 'normalization', options: { type: 'lowercase' } },
      ];

      const records = [
        {
          id: '1',
          data: {
            first: 'John',
            last: 'Doe',
            contact: { email: 'JOHN@EXAMPLE.COM' },
          },
          status: 'pending',
        },
      ];

      const result = await transformer.transformRecords(records, rules);

      expect(result.transformedRecords[0].data).toMatchObject({
        first: 'John',
        last: 'Doe',
        user: { firstName: 'John', lastName: 'Doe' },
        contact: { email: 'john@example.com' },
      });
    });
  });

  function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
});