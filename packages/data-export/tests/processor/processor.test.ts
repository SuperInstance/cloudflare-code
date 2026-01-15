import { DataProcessorImpl } from '../../src/processor/processor';
import { ExportRecord, Filter, Transformation, Schema, Aggregation } from '../../src/types';

describe('DataProcessor', () => {
  let processor: DataProcessorImpl;
  const testData: ExportRecord[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, active: true, salary: 50000, department: 'Engineering' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, active: false, salary: 60000, department: 'Marketing' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, active: true, salary: 70000, department: 'Engineering' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 28, active: true, salary: 55000, department: 'Sales' },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 32, active: false, salary: 65000, department: 'Marketing' }
  ];

  beforeEach(() => {
    processor = new DataProcessorImpl();
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should process data without any options', async () => {
      const result = await processor.process(testData);

      expect(result).toEqual(testData);
      expect(result.length).toBe(5);
    });

    it('should apply filters', async () => {
      const filters: Filter[] = [
        { field: 'active', operator: 'eq', value: true },
        { field: 'age', operator: 'gte', value: 25 }
      ];

      const result = await processor.process(testData, { filters });

      expect(result.length).toBe(3); // Only active and age >= 25
      expect(result.every(record => record.active === true && record.age >= 25)).toBe(true);
    });

    it('should apply transformations', async () => {
      const transformations: Transformation[] = [
        { field: 'name', type: 'rename', options: { newName: 'fullName' } },
        { field: 'email', type: 'format', options: { format: 'lowercase' } }
      ];

      const result = await processor.process(testData, { transformations });

      expect(result[0]).toHaveProperty('fullName');
      expect(result[0]).not.toHaveProperty('name');
      expect(result[0].email).toBe('john@example.com');
    });

    it('should apply column selection', async () => {
      const columns = ['id', 'name', 'email'];

      const result = await processor.process(testData, { columns });

      expect(Object.keys(result[0])).toEqual(['id', 'name', 'email']);
      expect(result[0]).not.toHaveProperty('age');
      expect(result[0]).not.toHaveProperty('active');
    });

    it('should apply aggregation', async () => {
      const aggregation: Aggregation = {
        type: 'avg',
        field: 'salary'
      };

      const result = await processor.process(testData, { aggregation });

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('salary_avg');
      expect(typeof result[0].salary_avg).toBe('number');
      expect(result[0].salary_avg).toBeCloseTo(60000); // Average salary
    });

    it('should apply grouping', async () => {
      const aggregation: Aggregation = {
        type: 'group',
        field: 'salary',
        groupBy: ['department']
      };

      const result = await processor.process(testData, { aggregation });

      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toHaveProperty('department');
    });

    it('should combine multiple processing steps', async () => {
      const options = {
        filters: [{ field: 'active', operator: 'eq', value: true }],
        transformations: [
          { field: 'name', type: 'format', options: { format: 'uppercase' } }
        ],
        columns: ['id', 'name', 'age'],
        aggregation: {
          type: 'avg',
          field: 'salary'
        }
      };

      const result = await processor.process(testData, options);

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('name');
      expect(result[0].name).toBe('JOHN DOE'); // Uppercase transformation applied
      expect(result[0]).toHaveProperty('salary_avg');
    });
  });

  describe('filter', () => {
    it('should filter with equals operator', async () => {
      const filters: Filter[] = [
        { field: 'active', operator: 'eq', value: true }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(3);
      expect(result.every(record => record.active === true)).toBe(true);
    });

    it('should filter with not equals operator', async () => {
      const filters: Filter[] = [
        { field: 'department', operator: 'ne', value: 'Engineering' }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(3);
      expect(result.every(record => record.department !== 'Engineering')).toBe(true);
    });

    it('should filter with greater than operator', async () => {
      const filters: Filter[] = [
        { field: 'age', operator: 'gt', value: 30 }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(1);
      expect(result[0].age).toBe(35);
    });

    it('should filter with greater than or equals operator', async () => {
      const filters: Filter[] = [
        { field: 'age', operator: 'gte', value: 30 }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(3);
      expect(result.every(record => record.age >= 30)).toBe(true);
    });

    it('should filter with less than operator', async () => {
      const filters: Filter[] = [
        { field: 'age', operator: 'lt', value: 30 }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(2);
      expect(result.every(record => record.age < 30)).toBe(true);
    });

    it('should filter with contains operator', async () => {
      const filters: Filter[] = [
        { field: 'email', operator: 'contains', value: '@example.com' }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(5);
      expect(result.every(record => record.email.includes('@example.com'))).toBe(true);
    });

    it('should filter with multiple filters (AND logic)', async () => {
      const filters: Filter[] = [
        { field: 'active', operator: 'eq', value: true },
        { field: 'age', operator: 'gte', value: 30 }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(2);
      expect(result.every(record => record.active === true && record.age >= 30)).toBe(true);
    });

    it('should handle non-existent fields', async () => {
      const filters: Filter[] = [
        { field: 'nonexistent', operator: 'eq', value: 'value' }
      ];

      const result = await processor.filter(testData, filters);

      expect(result.length).toBe(0);
    });
  });

  describe('transform', () => {
    it('should rename field', async () => {
      const transformations: Transformation[] = [
        { field: 'name', type: 'rename', options: { newName: 'fullName' } }
      ];

      const result = await processor.transform(testData, transformations);

      expect(result[0]).toHaveProperty('fullName');
      expect(result[0]).not.toHaveProperty('name');
      expect(result[0].fullName).toBe('John Doe');
    });

    it('should format field to uppercase', async () => {
      const transformations: Transformation[] = [
        { field: 'name', type: 'format', options: { format: 'uppercase' } }
      ];

      const result = await processor.transform(testData, transformations);

      expect(result[0].name).toBe('JOHN DOE');
    });

    it('should calculate field value', async () => {
      const transformations: Transformation[] = [
        { field: 'age', type: 'calculate', options: { expression: '{value} * 2' } }
      ];

      const result = await processor.transform(testData, transformations);

      expect(result[0].age).toBe(60); // 30 * 2
    });

    it('should map values', async () => {
      const transformations: Transformation[] = [
        {
          field: 'department',
          type: 'map',
          options: {
            mapping: {
              'Engineering': 'ENG',
              'Marketing': 'MKT',
              'Sales': 'SLS'
            }
          }
        }
      ];

      const result = await processor.transform(testData, transformations);

      expect(result[0].department).toBe('ENG');
      expect(result[1].department).toBe('MKT');
      expect(result[3].department).toBe('SLS');
    });

    it('should filter array values', async () => {
      const testWithArray = [
        { ...testData[0], tags: ['admin', 'user', 'vip'] },
        { ...testData[1], tags: ['user', 'guest'] }
      ];

      const transformations: Transformation[] = [
        {
          field: 'tags',
          type: 'filter',
          options: {
            exclude: ['guest']
          }
        }
      ];

      const result = await processor.transform(testWithArray, transformations);

      expect(result[0].tags).toEqual(['admin', 'user', 'vip']);
      expect(result[1].tags).toEqual(['user']);
    });

    it('should split string values', async () => {
      const testWithSplit = [
        { ...testData[0], fullName: 'John Doe Smith' }
      ];

      const transformations: Transformation[] = [
        {
          field: 'fullName',
          type: 'split',
          options: {
            delimiter: ' '
          }
        }
      ];

      const result = await processor.transform(testWithSplit, transformations);

      expect(result[0].fullName).toEqual(['John', 'Doe', 'Smith']);
    });
  });

  describe('validate', () => {
    it('should validate valid data', async () => {
      const schema: Schema = {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true, format: 'email' },
        age: { type: 'number', required: false, min: 18, max: 100 },
        active: { type: 'boolean', required: false }
      };

      const result = await processor.validate(testData, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect required field errors', async () => {
      const schema: Schema = {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true }
      };

      const invalidData = [
        { id: 1, name: 'John Doe' }, // Missing email
        { id: 2, email: 'jane@example.com' }, // Missing name
        { name: 'Bob Johnson', email: 'bob@example.com' } // Missing id
      ];

      const result = await processor.validate(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should detect type errors', async () => {
      const schema: Schema = {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true },
        age: { type: 'number', required: true }
      };

      const invalidData = [
        { id: '1', name: 'John Doe', age: 30 }, // id is string
        { id: 2, name: 'Jane Smith', age: '25' } // age is string
      ];

      const result = await processor.validate(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    it('should detect format errors', async () => {
      const schema: Schema = {
        email: { type: 'string', required: true, format: 'email' }
      };

      const invalidData = [
        { email: 'invalid-email' },
        { email: 'jane@example' },
        { email: 'test@domain' }
      ];

      const result = await processor.validate(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should detect range errors', async () => {
      const schema: Schema = {
        age: { type: 'number', min: 18, max: 100 }
      };

      const invalidData = [
        { age: 17 }, // Too young
        { age: 101 } // Too old
      ];

      const result = await processor.validate(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    it('should generate warnings for potential issues', async () => {
      const schema: Schema = {
        age: { type: 'number' }
      };

      const dataWithWarnings = [
        { age: '' }, // Empty string in number field
        { age: 'not-a-number' } // Invalid number string
      ];

      const result = await processor.validate(dataWithWarnings, schema);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('selectColumns', () => {
    it('should select specified columns', async () => {
      const columns = ['id', 'name', 'email'];

      const result = processor['selectColumns'](testData, columns);

      expect(Object.keys(result[0])).toEqual(['id', 'name', 'email']);
      expect(result[0]).not.toHaveProperty('age');
      expect(result[0]).not.toHaveProperty('active');
    });

    it('should handle non-existent columns', async () => {
      const columns = ['id', 'nonexistent', 'name'];

      const result = processor['selectColumns'](testData, columns);

      expect(Object.keys(result[0])).toEqual(['id', 'name']);
      expect(result[0]).not.toHaveProperty('nonexistent');
    });
  });

  describe('aggregation', () => {
    it('should calculate sum', async () => {
      const aggregation: Aggregation = {
        type: 'sum',
        field: 'salary'
      };

      const result = processor['applyAggregation'](testData, aggregation);

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('salary');
      expect(result[0].salary).toBe(300000); // Sum of all salaries
    });

    it('should calculate average', async () => {
      const aggregation: Aggregation = {
        type: 'avg',
        field: 'salary'
      };

      const result = processor['applyAggregation'](testData, aggregation);

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('salary_avg');
      expect(result[0].salary_avg).toBeCloseTo(60000); // Average salary
    });

    it('should count records', async () => {
      const aggregation: Aggregation = {
        type: 'count',
        field: 'id'
      };

      const result = processor['applyAggregation'](testData, aggregation);

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('count');
      expect(result[0].count).toBe(5);
    });

    it('should find minimum value', async () => {
      const aggregation: Aggregation = {
        type: 'min',
        field: 'age'
      };

      const result = processor['applyAggregation'](testData, aggregation);

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('min');
      expect(result[0].min).toBe(25);
    });

    it('should find maximum value', async () => {
      const aggregation: Aggregation = {
        type: 'max',
        field: 'age'
      };

      const result = processor['applyAggregation'](testData, aggregation);

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('max');
      expect(result[0].max).toBe(35);
    });

    it('should group by field', async () => {
      const aggregation: Aggregation = {
        type: 'group',
        field: 'salary',
        groupBy: ['department']
      };

      const result = processor['applyAggregation'](testData, aggregation);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toHaveProperty('department');
      expect(result[0]).toHaveProperty('salary_sum');
    });
  });

  describe('quick methods', () => {
    it('should provide quick filter method', async () => {
      const result = DataProcessorImpl.quickFilter(testData, 'active', 'eq', true);

      expect(result.length).toBe(3);
      expect(result.every(record => record.active === true)).toBe(true);
    });

    it('should provide quick transform method', async () => {
      const result = DataProcessorImpl.quickTransform(testData, 'name', 'format', { format: 'uppercase' });

      expect(result[0].name).toBe('JOHN DOE');
    });

    it('should provide quick validate method', async () => {
      const schema: Schema = {
        id: { type: 'number', required: true },
        name: { type: 'string', required: true }
      };

      const result = DataProcessorImpl.quickValidate(testData, schema);

      expect(result.isValid).toBe(true);
    });

    it('should provide create options method', () => {
      const options = DataProcessorImpl.createOptions(
        [{ field: 'active', operator: 'eq', value: true }],
        [{ field: 'name', type: 'uppercase', options: {} }],
        { id: { type: 'number' } },
        ['id', 'name'],
        { type: 'count', field: 'id' }
      );

      expect(options.filters).toHaveLength(1);
      expect(options.transformations).toHaveLength(1);
      expect(options.schema).toHaveProperty('id');
      expect(options.columns).toEqual(['id', 'name']);
      expect(options.aggregation).toHaveProperty('type', 'count');
    });
  });

  describe('stats', () => {
    it('should track processing stats', async () => {
      const options = {
        filters: [{ field: 'active', operator: 'eq', value: true }],
        transformations: [{ field: 'name', type: 'format', options: { format: 'uppercase' } }]
      };

      await processor.process(testData, options);

      const stats = processor.getStats();

      expect(stats.totalRecords).toBe(5);
      expect(stats.filteredRecords).toBe(3);
      expect(stats.transformedRecords).toBe(3);
      expect(stats.processingTime).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should reset stats', async () => {
      await processor.process(testData, {});

      processor.resetStats();

      const stats = processor.getStats();

      expect(stats.totalRecords).toBe(0);
      expect(stats.filteredRecords).toBe(0);
      expect(stats.transformedRecords).toBe(0);
      expect(stats.processingTime).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit processing events', async () => {
      const mockEmit = jest.fn();
      processor.emit = mockEmit;

      await processor.process(testData, {});

      expect(mockEmit).toHaveBeenCalledWith('processing-start', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('processing-complete', expect.any(Object));
    });

    it('should emit validation errors', async () => {
      const mockEmit = jest.fn();
      processor.emit = mockEmit;

      const invalidSchema: Schema = {
        id: { type: 'string', required: true }
      };

      await processor.process(testData, { schema: invalidSchema });

      expect(mockEmit).toHaveBeenCalledWith('validation-errors', expect.any(Array));
    });

    it('should emit error events', async () => {
      const mockEmit = jest.fn();
      processor.emit = mockEmit;

      await expect(processor.process(null as any, {})).rejects.toThrow();
      expect(mockEmit).toHaveBeenCalledWith('processing-error', expect.any(Error));
    });
  });

  describe('edge cases', () => {
    it('should handle empty data array', async () => {
      const result = await processor.process([], {});

      expect(result).toEqual([]);
    });

    it('should handle null and undefined values', async () => {
      const dataWithNulls = [
        { id: 1, name: 'John', age: null },
        { id: 2, name: null, age: 25 },
        { id: 3, name: 'Bob', age: undefined }
      ];

      const result = await processor.process(dataWithNulls, {});

      expect(result).toEqual(dataWithNulls);
    });

    it('should handle nested objects', async () => {
      const nestedData = [
        { id: 1, user: { name: 'John', profile: { age: 30 } } },
        { id: 2, user: { name: 'Jane', profile: { age: 25 } } }
      ];

      const filters: Filter[] = [
        { field: 'user.profile.age', operator: 'gt', value: 25 }
      ];

      const result = await processor.filter(nestedData, filters);

      expect(result.length).toBe(1);
      expect(result[0].user.profile.age).toBe(30);
    });

    it('should handle very large datasets', async () => {
      const largeData = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `User ${i}`,
        age: Math.floor(Math.random() * 100),
        active: i % 2 === 0
      }));

      const startTime = Date.now();
      const result = await processor.process(largeData, {});
      const endTime = Date.now();

      expect(result.length).toBe(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});