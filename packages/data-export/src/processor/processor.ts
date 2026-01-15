import { EventEmitter } from 'eventemitter3';
import {
  ExportRecord,
  ProcessorOptions,
  Filter,
  Transformation,
  Schema,
  Aggregation,
  ExportRecord
} from '../types';

export interface ProcessingStats {
  totalRecords: number;
  filteredRecords: number;
  transformedRecords: number;
  validationErrors: number;
  processingTime: number;
  memoryUsage: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
  rule: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value: any;
  suggestion?: string;
}

export class DataProcessor extends EventEmitter {
  private stats: ProcessingStats = {
    totalRecords: 0,
    filteredRecords: 0,
    transformedRecords: 0,
    validationErrors: 0,
    processingTime: 0,
    memoryUsage: 0
  };

  async process(data: ExportRecord[], options: ProcessorOptions): Promise<ExportRecord[]> {
    const startTime = Date.now();
    let processedData = [...data];

    this.emit('processing-start', { recordCount: data.length });

    try {
      // Step 1: Filter data
      if (options.filters && options.filters.length > 0) {
        processedData = await this.filter(processedData, options.filters);
        this.stats.filteredRecords = processedData.length;
      }

      // Step 2: Apply transformations
      if (options.transformations && options.transformations.length > 0) {
        processedData = await this.transform(processedData, options.transformations);
        this.stats.transformedRecords = processedData.length;
      }

      // Step 3: Validate schema
      if (options.schema) {
        const validation = await this.validate(processedData, options.schema);
        if (!validation.isValid) {
          this.stats.validationErrors = validation.errors.length;
          this.emit('validation-errors', validation.errors);
        }
      }

      // Step 4: Column selection
      if (options.columns && options.columns.length > 0) {
        processedData = this.selectColumns(processedData, options.columns);
      }

      // Step 5: Apply aggregation
      if (options.aggregation) {
        processedData = this.applyAggregation(processedData, options.aggregation);
      }

      this.stats.processingTime = Date.now() - startTime;
      this.stats.totalRecords = data.length;
      this.stats.memoryUsage = process.memoryUsage().heapUsed;

      this.emit('processing-complete', {
        stats: this.stats,
        processedCount: processedData.length
      });

      return processedData;

    } catch (error) {
      this.emit('processing-error', error);
      throw error;
    }
  }

  async validate(data: ExportRecord[], schema: Schema): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (let recordIndex = 0; recordIndex < data.length; recordIndex++) {
      const record = data[recordIndex];

      for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const value = record[fieldName];
        const fieldErrors = this.validateField(fieldName, value, fieldSchema, recordIndex);
        errors.push(...fieldErrors);

        const fieldWarnings = this.validateFieldWarnings(fieldName, value, fieldSchema, recordIndex);
        warnings.push(...fieldWarnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateField(fieldName: string, value: any, fieldSchema: any, recordIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required field validation
    if (fieldSchema.required && (value === undefined || value === null)) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' is required`,
        value,
        rule: 'required'
      });
    }

    // Skip validation if field is not required and value is null/undefined
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    const expectedType = fieldSchema.type;
    const actualType = this.getValueType(value);

    if (actualType !== expectedType) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' should be type '${expectedType}', but got '${actualType}'`,
        value,
        rule: 'type'
      });
    }

    // Format validation
    if (fieldSchema.format && !this.validateFormat(value, fieldSchema.format)) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' does not match format '${fieldSchema.format}'`,
        value,
        rule: 'format'
      });
    }

    // Pattern validation
    if (fieldSchema.pattern && typeof value === 'string' && !new RegExp(fieldSchema.pattern).test(value)) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' does not match pattern '${fieldSchema.pattern}'`,
        value,
        rule: 'pattern'
      });
    }

    // Numeric validations
    if (expectedType === 'number') {
      if (fieldSchema.min !== undefined && value < fieldSchema.min) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' should be >= ${fieldSchema.min}`,
          value,
          rule: 'min'
        });
      }

      if (fieldSchema.max !== undefined && value > fieldSchema.max) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' should be <= ${fieldSchema.max}`,
          value,
          rule: 'max'
        });
      }
    }

    return errors;
  }

  private validateFieldWarnings(fieldName: string, value: any, fieldSchema: any, recordIndex: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for empty strings in numeric fields
    if (fieldSchema.type === 'number' && typeof value === 'string' && value.trim() === '') {
      warnings.push({
        field: fieldName,
        message: `Field '${fieldName}' is empty but expected a number`,
        value,
        suggestion: 'Use 0 or remove the field'
      });
    }

    // Check for potential date parsing issues
    if (fieldSchema.type === 'date' && typeof value === 'string') {
      if (!isNaN(Date.parse(value))) {
        // Date is valid
      } else {
        warnings.push({
          field: fieldName,
          message: `Field '${fieldName}' might not be a valid date`,
          value,
          suggestion: 'Use ISO 8601 format (YYYY-MM-DD)'
        });
      }
    }

    return warnings;
  }

  private getValueType(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return 'array';
    }

    if (typeof value === 'object') {
      return 'object';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }

    return typeof value;
  }

  private validateFormat(value: any, format: string): boolean {
    switch (format) {
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        return typeof value === 'string' && /^https?:\/\/.+\..+/.test(value);
      case 'phone':
        return typeof value === 'string' && /^[\d\s\-\+\(\)]+$/.test(value);
      case 'uuid':
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      case 'iso8601':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  async filter(data: ExportRecord[], filters: Filter[]): Promise<ExportRecord[]> {
    return data.filter(record => {
      return filters.every(filter => this.applyFilter(record, filter));
    });
  }

  private applyFilter(record: ExportRecord, filter: Filter): boolean {
    const value = record[filter.field];
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'eq':
        return value === filterValue;

      case 'ne':
        return value !== filterValue;

      case 'gt':
        return this.compareNumbers(value, filterValue) > 0;

      case 'gte':
        return this.compareNumbers(value, filterValue) >= 0;

      case 'lt':
        return this.compareNumbers(value, filterValue) < 0;

      case 'lte':
        return this.compareNumbers(value, filterValue) <= 0;

      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);

      case 'nin':
        return Array.isArray(filterValue) && !filterValue.includes(value);

      case 'contains':
        return typeof value === 'string' && typeof filterValue === 'string' && value.includes(filterValue);

      case 'startsWith':
        return typeof value === 'string' && typeof filterValue === 'string' && value.startsWith(filterValue);

      case 'endsWith':
        return typeof value === 'string' && typeof filterValue === 'string' && value.endsWith(filterValue);

      default:
        return true;
    }
  }

  private compareNumbers(a: any, b: any): number {
    const numA = Number(a);
    const numB = Number(b);

    if (isNaN(numA) || isNaN(numB)) {
      return 0;
    }

    return numA - numB;
  }

  async transform(data: ExportRecord[], transformations: Transformation[]): Promise<ExportRecord[]> {
    return data.map(record => {
      const transformedRecord = { ...record };

      for (const transformation of transformations) {
        this.applyTransformation(transformedRecord, transformation);
      }

      return transformedRecord;
    });
  }

  private applyTransformation(record: ExportRecord, transformation: Transformation): void {
    const { field, type, options } = transformation;
    const value = record[field];

    switch (type) {
      case 'rename':
        if (options.newName && value !== undefined) {
          delete record[field];
          record[options.newName] = value;
        }
        break;

      case 'format':
        if (typeof value === 'string' && options.format) {
          record[field] = this.formatValue(value, options.format);
        }
        break;

      case 'calculate':
        if (options.expression && typeof options.expression === 'string') {
          try {
            record[field] = this.evaluateExpression(value, options.expression);
          } catch (error) {
            // Keep original value if calculation fails
          }
        }
        break;

      case 'map':
        if (options.mapping && typeof options.mapping === 'object') {
          record[field] = options.mapping[value] || value;
        }
        break;

      case 'filter':
        if (options.exclude && Array.isArray(options.exclude)) {
          record[field] = Array.isArray(value) ? value.filter((item: any) => !options.exclude!.includes(item)) : value;
        }
        break;

      case 'split':
        if (typeof value === 'string' && options.delimiter) {
          record[field] = value.split(options.delimiter);
        }
        break;
    }
  }

  private formatValue(value: string, format: string): string {
    switch (format) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case 'trim':
        return value.trim();
      case 'escape':
        return value.replace(/["\\]/g, '\\$&');
      default:
        return value;
    }
  }

  private evaluateExpression(value: any, expression: string): any {
    // Simple expression evaluator - in production, use a proper expression parser
    try {
      // Replace placeholders in expression
      const expr = expression.replace(/\{value\}/g, value);

      // For simple arithmetic operations
      if (/^[\d\s\+\-\*\/]+$/.test(expr)) {
        // eslint-disable-next-line no-eval
        return eval(expr);
      }

      // For string operations
      if (expr.includes('length')) {
        return String(value).length;
      }

      // For date operations
      if (expr.includes('date')) {
        const date = new Date(value);
        return date.toISOString();
      }

      return value;
    } catch (error) {
      return value;
    }
  }

  private selectColumns(data: ExportRecord[], columns: string[]): ExportRecord[] {
    return data.map(record => {
      const selected: ExportRecord = {};

      for (const column of columns) {
        if (column in record) {
          selected[column] = record[column];
        }
      }

      return selected;
    });
  }

  private applyAggregation(data: ExportRecord[], aggregation: Aggregation): ExportRecord[] {
    if (!aggregation.field || !aggregation.type) {
      return data;
    }

    if (aggregation.type === 'group' && aggregation.groupBy) {
      return this.groupBy(data, aggregation);
    }

    const aggregated = this.calculateAggregation(data, aggregation);
    return [aggregated];
  }

  private groupBy(data: ExportRecord[], aggregation: Aggregation): ExportRecord[] {
    if (!aggregation.groupBy || !Array.isArray(aggregation.groupBy)) {
      return data;
    }

    const groups = new Map<string, ExportRecord[]>();

    for (const record of data) {
      const groupKey = aggregation.groupBy.map(field => String(record[field] || '')).join('|');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey)!.push(record);
    }

    const result: ExportRecord[] = [];

    for (const [groupKey, groupData] of groups) {
      const groupKeys = groupKey.split('|');
      const aggregated: ExportRecord = {};

      // Add group by fields
      aggregation.groupBy!.forEach((field, index) => {
        aggregated[field] = groupKeys[index];
      });

      // Add aggregation
      if (aggregation.field) {
        const groupAggregation = this.calculateAggregation(groupData, aggregation);
        aggregated[`${aggregation.field}_${aggregation.type}`] = groupAggregation[aggregation.type];
      }

      result.push(aggregated);
    }

    return result;
  }

  private calculateAggregation(data: ExportRecord[], aggregation: Aggregation): ExportRecord {
    const values = data.map(record => record[aggregation.field]).filter(v => v !== undefined && v !== null);

    if (values.length === 0) {
      return {};
    }

    switch (aggregation.type) {
      case 'sum':
        return {
          [aggregation.type]: values.reduce((sum, val) => sum + Number(val), 0)
        };

      case 'avg':
        return {
          [aggregation.type]: values.reduce((sum, val) => sum + Number(val), 0) / values.length
        };

      case 'count':
        return {
          [aggregation.type]: values.length
        };

      case 'min':
        return {
          [aggregation.type]: Math.min(...values.map(v => Number(v)))
        };

      case 'max':
        return {
          [aggregation.type]: Math.max(...values.map(v => Number(v)))
        };

      default:
        return {};
    }
  }

  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalRecords: 0,
      filteredRecords: 0,
      transformedRecords: 0,
      validationErrors: 0,
      processingTime: 0,
      memoryUsage: 0
    };
  }

  // Utility methods for common processing patterns

  static createOptions(
    filters?: Filter[],
    transformations?: Transformation[],
    schema?: Schema,
    columns?: string[],
    aggregation?: Aggregation
  ): ProcessorOptions {
    return {
      filters,
      transformations,
      schema,
      columns,
      aggregation
    };
  }

  static quickFilter(
    data: ExportRecord[],
    field: string,
    operator: Filter['operator'],
    value: any
  ): ExportRecord[] {
    const processor = new DataProcessor();
    return processor.filter(data, [{ field, operator, value }]);
  }

  static quickTransform(
    data: ExportRecord[],
    field: string,
    type: Transformation['type'],
    options: any
  ): ExportRecord[] {
    const processor = new DataProcessor();
    return processor.transform(data, [{ field, type, options }]);
  }

  static quickValidate(
    data: ExportRecord[],
    schema: Schema
  ): ValidationResult {
    const processor = new DataProcessor();
    return processor.validate(data, schema);
  }
}