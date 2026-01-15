import {
  TransformationRule,
  ImportRecord,
  ValidationResult
} from '../types';
import { generateId, deepClone } from '../utils';

export interface TransformationContext {
  record: ImportRecord;
  index: number;
  totalRecords: number;
  sourceSchema: any;
  targetSchema: any;
  customTransformers?: Map<string, (value: any, context: TransformationContext) => any>;
}

export interface TransformationResult {
  transformedRecords: ImportRecord[];
  transformationMetrics: {
    totalRecords: number;
    successful: number;
    failed: number;
    averageTime: number;
    totalProcessingTime: number;
  };
  errors: Array<{
    recordId: string;
    field: string;
    error: string;
  }>;
}

export class DataTransformer {
  private customTransformers = new Map<string, (value: any, context: TransformationContext) => any>();
  private transformationCache = new Map<string, any>();

  constructor(options?: {
    customTransformers?: Map<string, (value: any, context: TransformationContext) => any>;
  }) {
    if (options?.customTransformers) {
      this.customTransformers = options.customTransformers;
    }
  }

  async transformRecords(
    records: ImportRecord[],
    rules: TransformationRule[],
    context?: Partial<TransformationContext>
  ): Promise<TransformationResult> {
    const startTime = performance.now();
    const transformedRecords: ImportRecord[] = [];
    const errors: Array<{ recordId: string; field: string; error: string }> = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const transformationContext: TransformationContext = {
        record,
        index: i,
        totalRecords: records.length,
        sourceSchema: context?.sourceSchema || {},
        targetSchema: context?.targetSchema || {},
        customTransformers: this.customTransformers,
        ...context,
      };

      try {
        const transformed = await this.transformRecord(record, rules, transformationContext);
        transformedRecords.push(transformed);
        successful++;
      } catch (error) {
        errors.push({
          recordId: record.id,
          field: 'all',
          error: error instanceof Error ? error.message : 'Unknown transformation error',
        });
        failed++;
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      transformedRecords,
      transformationMetrics: {
        totalRecords: records.length,
        successful,
        failed,
        averageTime: processingTime / records.length,
        totalProcessingTime: processingTime,
      },
      errors,
    };
  }

  async transformRecord(
    record: ImportRecord,
    rules: TransformationRule[],
    context?: Partial<TransformationContext>
  ): Promise<ImportRecord> {
    const transformationContext: TransformationContext = {
      record,
      index: context?.index || 0,
      totalRecords: context?.totalRecords || 1,
      sourceSchema: context?.sourceSchema || {},
      targetSchema: context?.targetSchema || {},
      customTransformers: this.customTransformers,
      ...context,
    };

    const transformedData = deepClone(record.data);
    const transformedRecord = deepClone(record);

    for (const rule of rules) {
      const result = await this.applyTransformation(transformedData, rule, transformationContext);

      if (result.error) {
        throw new Error(`Transformation error for field ${rule.target}: ${result.error}`);
      }

      if (result.success) {
        this.setNestedValue(transformedData, rule.target, result.value);
      }
    }

    transformedRecord.data = transformedData;
    transformedRecord.transformations = {
      appliedRules: rules,
      timestamp: new Date(),
    };

    return transformedRecord;
  }

  private async applyTransformation(
    data: any,
    rule: TransformationRule,
    context: TransformationContext
  ): Promise<{ success: boolean; value?: any; error?: string }> {
    try {
      let value: any;

      switch (rule.type) {
        case 'mapping':
          value = await this.applyMapping(data, rule, context);
          break;
        case 'conversion':
          value = await this.applyConversion(data, rule, context);
          break;
        case 'normalization':
          value = await this.applyNormalization(data, rule, context);
          break;
        case 'enrichment':
          value = await this.applyEnrichment(data, rule, context);
          break;
        default:
          return { success: false, error: `Unknown transformation type: ${rule.type}` };
      }

      return { success: true, value };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async applyMapping(
    data: any,
    rule: TransformationRule,
    context: TransformationContext
  ): Promise<any> {
    if (!rule.source) {
      throw new Error('Mapping transformation requires a source field');
    }

    const sourceValue = this.getNestedValue(data, rule.source);
    return sourceValue;
  }

  private async applyConversion(
    data: any,
    rule: TransformationRule,
    context: TransformationContext
  ): Promise<any> {
    const sourceValue = this.getNestedValue(data, rule.source || rule.target);
    const conversionType = rule.options?.type;

    if (sourceValue === null || sourceValue === undefined) {
      return sourceValue;
    }

    switch (conversionType) {
      case 'string':
        return String(sourceValue);

      case 'number':
        const numValue = Number(sourceValue);
        if (isNaN(numValue)) {
          throw new Error(`Cannot convert "${sourceValue}" to number`);
        }
        return numValue;

      case 'integer':
        const intValue = Math.floor(Number(sourceValue));
        if (isNaN(intValue)) {
          throw new Error(`Cannot convert "${sourceValue}" to integer`);
        }
        return intValue;

      case 'boolean':
        if (typeof sourceValue === 'string') {
          const lowerValue = sourceValue.toLowerCase();
          if (lowerValue === 'true' || lowerValue === '1') return true;
          if (lowerValue === 'false' || lowerValue === '0') return false;
        }
        return Boolean(sourceValue);

      case 'date':
        if (rule.options?.format) {
          return this.parseDate(sourceValue, rule.options.format);
        }
        return new Date(sourceValue);

      case 'array':
        if (Array.isArray(sourceValue)) {
          return sourceValue;
        }
        if (typeof sourceValue === 'string') {
          const delimiter = rule.options?.delimiter || ',';
          return sourceValue.split(delimiter).map(item => item.trim());
        }
        return [sourceValue];

      case 'object':
        if (typeof sourceValue === 'string') {
          try {
            return JSON.parse(sourceValue);
          } catch {
            return { value: sourceValue };
          }
        }
        return sourceValue;

      default:
        return sourceValue;
    }
  }

  private async applyNormalization(
    data: any,
    rule: TransformationRule,
    context: TransformationContext
  ): Promise<any> {
    const sourceValue = this.getNestedValue(data, rule.source || rule.target);

    if (sourceValue === null || sourceValue === undefined) {
      return sourceValue;
    }

    const normalizationType = rule.options?.type;

    switch (normalizationType) {
      case 'uppercase':
        return String(sourceValue).toUpperCase();

      case 'lowercase':
        return String(sourceValue).toLowerCase();

      case 'trim':
        return String(sourceValue).trim();

      case 'strip':
        return String(sourceValue).replace(/\s+/g, '');

      case 'capitalize':
        return String(sourceValue).charAt(0).toUpperCase() +
               String(sourceValue).slice(1).toLowerCase();

      case 'slug':
        return String(sourceValue)
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

      case 'truncate':
        const maxLength = rule.options?.maxLength || 100;
        const str = String(sourceValue);
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;

      case 'format':
        return this.formatValue(sourceValue, rule.options?.format);

      case 'round':
        const precision = rule.options?.precision || 0;
        return Math.round(Number(sourceValue) * Math.pow(10, precision)) / Math.pow(10, precision);

      case 'pad':
        const padLength = rule.options?.length || 2;
        const padChar = rule.options?.character || '0';
        const num = String(sourceValue);
        return num.padStart(padLength, padChar);

      default:
        return sourceValue;
    }
  }

  private async applyEnrichment(
    data: any,
    rule: TransformationRule,
    context: TransformationContext
  ): Promise<any> {
    const enrichmentType = rule.options?.type;
    const sourceValue = this.getNestedValue(data, rule.source || rule.target);

    switch (enrichmentType) {
      case 'concat':
        const parts = rule.options?.parts || [];
        return parts.map(part => {
          if (typeof part === 'string' && part.startsWith('$')) {
            return this.getNestedValue(data, part.slice(1));
          }
          return part;
        }).join(rule.options?.separator || '');

      case 'replace':
        const searchValue = rule.options?.search;
        const replaceValue = rule.options?.replace;
        const str = String(sourceValue);
        return str.replace(new RegExp(searchValue, 'g'), replaceValue);

      case 'extract':
        const regex = new RegExp(rule.options?.pattern);
        const match = String(sourceValue).match(regex);
        return match ? (rule.options?.group ? match[rule.options.group] : match[0]) : null;

      case 'lookup':
        const lookupMap = rule.options?.map || {};
        return lookupMap[String(sourceValue)] || sourceValue;

      case 'default':
        const defaultValue = rule.options?.value;
        return sourceValue !== null && sourceValue !== undefined ? sourceValue : defaultValue;

      case 'conditional':
        const condition = rule.options?.condition;
        const trueValue = rule.options?.true;
        const falseValue = rule.options?.false;
        return this.evaluateCondition(sourceValue, condition) ? trueValue : falseValue;

      case 'sequence':
        const start = rule.options?.start || 1;
        const increment = rule.options?.increment || 1;
        return start + (context.index * increment);

      case 'uuid':
        if (!rule.source || sourceValue === null || sourceValue === undefined) {
          return generateId();
        }
        return sourceValue;

      case 'timestamp':
        return new Date().toISOString();

      default:
        return sourceValue;
    }
  }

  private parseDate(value: any, format: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${value}`);
    }
    return date;
  }

  private formatValue(value: any, format: string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    return String(value);
  }

  private evaluateCondition(value: any, condition: any): boolean {
    if (typeof condition === 'function') {
      return condition(value);
    }
    if (typeof condition === 'string') {
      const [operator, ...operands] = condition.split(' ');
      switch (operator) {
        case 'eq':
          return value === operands[0];
        case 'ne':
          return value !== operands[0];
        case 'gt':
          return Number(value) > Number(operands[0]);
        case 'gte':
          return Number(value) >= Number(operands[0]);
        case 'lt':
          return Number(value) < Number(operands[0]);
        case 'lte':
          return Number(value) <= Number(operands[0]);
        case 'in':
          return operands.includes(String(value));
        case 'not_in':
          return !operands.includes(String(value));
        case 'contains':
          return String(value).includes(operands[0]);
        case 'not_contains':
          return !String(value).includes(operands[0]);
        case 'starts_with':
          return String(value).startsWith(operands[0]);
        case 'ends_with':
          return String(value).endsWith(operands[0]);
        case 'regex':
          return new RegExp(operands[0]).test(String(value));
        default:
          return true;
      }
    }
    return Boolean(value);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (current[key] === undefined) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  addCustomTransformer(
    field: string,
    transformer: (value: any, context: TransformationContext) => any
  ): void {
    this.customTransformers.set(field, transformer);
  }

  removeCustomTransformer(field: string): void {
    this.customTransformers.delete(field);
  }

  clearTransformationCache(): void {
    this.transformationCache.clear();
  }

  generateTransformationReport(result: TransformationResult): {
    summary: string;
    totalRecords: number;
    successRate: number;
    averageProcessingTime: string;
    errorRate: number;
    errorDetails: Array<{ field: string; error: string; count: number }>;
  } {
    const { totalRecords, successful, failed, averageTime, totalProcessingTime } = result.transformationMetrics;
    const successRate = totalRecords > 0 ? (successful / totalRecords) * 100 : 0;
    const errorRate = totalRecords > 0 ? (failed / totalRecords) * 100 : 0;

    const errorCount = result.errors.reduce((acc, error) => {
      const key = `${error.field}:${error.error}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorDetails = Object.entries(errorCount)
      .map(([key, count]) => {
        const [field, error] = key.split(':');
        return { field, error, count };
      })
      .sort((a, b) => b.count - a.count);

    return {
      summary: `Transformed ${successful}/${totalRecords} records successfully in ${totalProcessingTime.toFixed(2)}ms`,
      totalRecords,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: `${averageTime.toFixed(2)}ms`,
      errorRate: Math.round(errorRate * 100) / 100,
      errorDetails,
    };
  }

  createTransformationPipeline(rules: TransformationRule[]): TransformationPipeline {
    return new TransformationPipeline(rules, this.customTransformers);
  }
}

export class TransformationPipeline {
  private rules: TransformationRule[];
  private customTransformers: Map<string, (value: any, context: TransformationContext) => any>;

  constructor(
    rules: TransformationRule[],
    customTransformers?: Map<string, (value: any, context: TransformationContext) => any>
  ) {
    this.rules = rules;
    this.customTransformers = customTransformers || new Map();
  }

  async process(record: ImportRecord, context?: Partial<TransformationContext>): Promise<ImportRecord> {
    const transformationContext: TransformationContext = {
      record,
      index: context?.index || 0,
      totalRecords: context?.totalRecords || 1,
      sourceSchema: context?.sourceSchema || {},
      targetSchema: context?.targetSchema || {},
      customTransformers: this.customTransformers,
      ...context,
    };

    const transformedData = deepClone(record.data);
    const transformedRecord = deepClone(record);

    for (const rule of this.rules) {
      const result = await this.applyTransformation(transformedData, rule, transformationContext);

      if (result.error) {
        throw new Error(`Pipeline transformation error: ${result.error}`);
      }

      if (result.success) {
        this.setNestedValue(transformedData, rule.target, result.value);
      }
    }

    transformedRecord.data = transformedData;
    transformedRecord.transformations = {
      appliedRules: this.rules,
      timestamp: new Date(),
    };

    return transformedRecord;
  }

  private async applyTransformation(
    data: any,
    rule: TransformationRule,
    context: TransformationContext
  ): Promise<{ success: boolean; value?: any; error?: string }> {
    const transformer = new DataTransformer({ customTransformers: this.customTransformers });
    return transformer.applyTransformation(data, rule, context);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (current[key] === undefined) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  addRule(rule: TransformationRule): void {
    this.rules.push(rule);
  }

  removeRule(target: string): void {
    this.rules = this.rules.filter(rule => rule.target !== target);
  }

  getRules(): TransformationRule[] {
    return [...this.rules];
  }
}