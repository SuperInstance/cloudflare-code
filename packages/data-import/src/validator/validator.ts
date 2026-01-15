import { z } from 'zod';
import {
  ValidationRule,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationType,
  ImportRecord
} from '../types';
import { generateId } from '../utils';

export interface ValidationContext {
  record: ImportRecord;
  index: number;
  totalRecords: number;
  rules: ValidationRule[];
  customValidators?: Map<string, (value: any, context: ValidationContext) => boolean>;
}

export class DataValidator {
  private customValidators = new Map<string, (value: any, context: ValidationContext) => boolean>();
  private schemaCache = new Map<string, z.ZodSchema>();
  private scoringWeights = {
    completeness: 0.3,
    accuracy: 0.4,
    consistency: 0.3,
  };

  constructor(options?: {
    customValidators?: Map<string, (value: any, context: ValidationContext) => boolean>;
    scoringWeights?: Partial<typeof this.scoringWeights>;
  }) {
    if (options?.customValidators) {
      this.customValidators = options.customValidators;
    }
    if (options?.scoringWeights) {
      this.scoringWeights = { ...this.scoringWeights, ...options.scoringWeights };
    }
  }

  async validateRecords(
    records: any[],
    rules: ValidationRule[],
    schema?: any
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const startTime = performance.now();

    const zodSchema = schema ? this.createZodSchema(schema) : null;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const context: ValidationContext = {
        record: {
          id: generateId(),
          data: record,
          metadata: {},
          status: 'pending',
        },
        index: i,
        totalRecords: records.length,
        rules,
        customValidators: this.customValidators,
      };

      let result: ValidationResult;

      if (zodSchema) {
        result = await this.validateWithZodSchema(record, zodSchema);
      } else {
        result = await this.validateWithRules(record, context);
      }

      results.push(result);
    }

    const validationTime = performance.now() - startTime;
    const avgTime = validationTime / records.length;

    console.log(`Validation completed: ${records.length} records in ${validationTime.toFixed(2)}ms (${avgTime.toFixed(2)}ms per record)`);

    return results;
  }

  async validateRecord(
    record: any,
    rules: ValidationRule[],
    schema?: any,
    context?: Partial<ValidationContext>
  ): Promise<ValidationResult> {
    const fullContext: ValidationContext = {
      record: {
        id: generateId(),
        data: record,
        metadata: {},
        status: 'pending',
      },
      index: context?.index || 0,
      totalRecords: context?.totalRecords || 1,
      rules,
      customValidators: this.customValidators,
      ...context,
    };

    let result: ValidationResult;

    if (schema) {
      const zodSchema = this.createZodSchema(schema);
      result = await this.validateWithZodSchema(record, zodSchema);
    } else {
      result = await this.validateWithRules(record, fullContext);
    }

    return result;
  }

  private async validateWithZodSchema(
    record: any,
    schema: z.ZodSchema
  ): Promise<ValidationResult> {
    try {
      const result = schema.safeParse(record);
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!result.success) {
        for (const error of result.error.errors) {
          errors.push({
            field: error.path.join('.'),
            code: 'zod_validation',
            message: error.message,
            severity: 'error',
            value: this.getValueByPath(record, error.path),
          });
        }
      }

      const score = this.calculateScore(record, errors, warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        score,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: '',
          code: 'validation_error',
          message: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
        }],
        warnings: [],
        score: 0,
      };
    }
  }

  private async validateWithRules(
    record: any,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const rule of context.rules) {
      const value = this.getValueByPath(record, rule.field.split('.'));
      const validation = await this.validateField(value, rule, context);

      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
      }
      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
      }
    }

    const score = this.calculateScore(record, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  private async validateField(
    value: any,
    rule: ValidationRule,
    context: ValidationContext
  ): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (rule.required && (value === null || value === undefined || value === '')) {
      errors.push({
        field: rule.field,
        code: 'required_field',
        message: rule.message || `Field ${rule.field} is required`,
        severity: 'error',
      });
      return { errors, warnings };
    }

    if (value === null || value === undefined || value === '') {
      return { errors, warnings };
    }

    let validationPassed = false;
    let validationMessage = '';

    switch (rule.type) {
      case 'string':
        const stringResult = this.validateString(value, rule);
        validationPassed = stringResult.valid;
        validationMessage = stringResult.message;
        break;

      case 'number':
        const numberResult = this.validateNumber(value, rule);
        validationPassed = numberResult.valid;
        validationMessage = numberResult.message;
        break;

      case 'email':
        validationPassed = this.validateEmail(value);
        validationMessage = 'Invalid email format';
        break;

      case 'date':
        validationPassed = this.validateDate(value, rule);
        validationMessage = 'Invalid date format';
        break;

      case 'url':
        validationPassed = this.validateUrl(value);
        validationMessage = 'Invalid URL format';
        break;

      case 'regex':
        if (rule.options?.pattern) {
          const regex = new RegExp(rule.options.pattern);
          validationPassed = regex.test(String(value));
          validationMessage = `Value does not match pattern: ${rule.options.pattern}`;
        }
        break;

      case 'array':
        validationPassed = Array.isArray(value);
        validationMessage = 'Value must be an array';
        break;

      case 'object':
        validationPassed = typeof value === 'object' && !Array.isArray(value);
        validationMessage = 'Value must be an object';
        break;

      case 'custom':
        if (this.customValidators.has(rule.field)) {
          try {
            validationPassed = this.customValidators.get(rule.field)!(value, context);
            validationMessage = 'Custom validation failed';
          } catch (error) {
            errors.push({
              field: rule.field,
              code: 'custom_validator_error',
              message: `Custom validator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              severity: 'error',
            });
            return { errors, warnings };
          }
        }
        break;
    }

    if (!validationPassed) {
      errors.push({
        field: rule.field,
        code: rule.type,
        message: rule.message || validationMessage,
        severity: 'error',
        value,
      });
    }

    return { errors, warnings };
  }

  private validateString(value: any, rule: ValidationRule): { valid: boolean; message: string } {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }

    if (rule.options?.minLength && value.length < rule.options.minLength) {
      return {
        valid: false,
        message: `String must be at least ${rule.options.minLength} characters long`
      };
    }

    if (rule.options?.maxLength && value.length > rule.options.maxLength) {
      return {
        valid: false,
        message: `String must be at most ${rule.options.maxLength} characters long`
      };
    }

    return { valid: true, message: '' };
  }

  private validateNumber(value: any, rule: ValidationRule): { valid: boolean; message: string } {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return { valid: false, message: 'Value must be a valid number' };
    }

    if (rule.options?.min !== undefined && numValue < rule.options.min) {
      return { valid: false, message: `Number must be at least ${rule.options.min}` };
    }

    if (rule.options?.max !== undefined && numValue > rule.options.max) {
      return { valid: false, message: `Number must be at most ${rule.options.max}` };
    }

    if (rule.options?.step) {
      const remainder = numValue % rule.options.step;
      if (Math.abs(remainder) > 0.00001 && Math.abs(remainder - rule.options.step) > 0.00001) {
        return {
          valid: false,
          message: `Number must be a multiple of ${rule.options.step}`
        };
      }
    }

    return { valid: true, message: '' };
  }

  private validateEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private validateDate(value: any, rule: ValidationRule): boolean {
    if (rule.options?.format) {
      const formatPatterns: Record<string, RegExp> = {
        'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
        'DD/MM/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
        'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
        'ISO': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/,
      };

      const pattern = formatPatterns[rule.options.format];
      if (pattern && !pattern.test(String(value))) {
        return false;
      }
    }

    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private validateUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private createZodSchema(schema: any): z.ZodSchema {
    const cacheKey = JSON.stringify(schema);
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    let zodSchema: z.ZodType;

    switch (schema.type) {
      case 'object':
        const shape: Record<string, z.ZodType> = {};
        for (const [key, prop] of Object.entries(schema.properties as any)) {
          shape[key] = this.createZodSchema(prop);
        }
        zodSchema = z.object(shape);

        if (schema.required) {
          zodSchema = zodSchema.refine(
            (data) => schema.required.every((req: string) => req in data),
            { message: 'Missing required fields' }
          );
        }
        break;

      case 'array':
        zodSchema = z.array(this.createZodSchema(schema.items));
        break;

      case 'string':
        let stringSchema = z.string();
        if (schema.format === 'email') {
          stringSchema = stringSchema.email();
        } else if (schema.format === 'uri') {
          stringSchema = stringSchema.url();
        } else if (schema.format === 'date-time') {
          stringSchema = stringSchema.datetime();
        }
        if (schema.minLength) {
          stringSchema = stringSchema.min(schema.minLength);
        }
        if (schema.maxLength) {
          stringSchema = stringSchema.max(schema.maxLength);
        }
        zodSchema = stringSchema;
        break;

      case 'number':
        zodSchema = z.number();
        if (schema.minimum !== undefined) {
          zodSchema = zodSchema.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
          zodSchema = zodSchema.max(schema.maximum);
        }
        break;

      case 'integer':
        zodSchema = z.number().int();
        break;

      case 'boolean':
        zodSchema = z.boolean();
        break;

      default:
        zodSchema = z.any();
    }

    this.schemaCache.set(cacheKey, zodSchema);
    return zodSchema;
  }

  private getValueByPath(obj: any, path: string[]): any {
    return path.reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj);
  }

  private calculateScore(
    record: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    const totalFields = Object.keys(record).length;
    const nonNullFields = Object.values(record).filter(v =>
      v !== null && v !== undefined && v !== ''
    ).length;

    const completenessScore = this.scoringWeights.completeness * (nonNullFields / totalFields);

    const errorScore = errors.length === 0 ? 1 : Math.max(0, 1 - (errors.length / totalFields));
    const accuracyScore = this.scoringWeights.accuracy * errorScore;

    const warningScore = warnings.length === 0 ? 1 : Math.max(0, 1 - (warnings.length / totalFields));
    const consistencyScore = this.scoringWeights.consistency * warningScore;

    const totalScore = completenessScore + accuracyScore + consistencyScore;
    return Math.round(totalScore * 100) / 100;
  }

  addCustomValidator(
    field: string,
    validator: (value: any, context: ValidationContext) => boolean
  ): void {
    this.customValidators.set(field, validator);
  }

  removeCustomValidator(field: string): void {
    this.customValidators.delete(field);
  }

  clearSchemaCache(): void {
    this.schemaCache.clear();
  }

  generateValidationReport(results: ValidationResult[]): {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    averageScore: number;
    errorDistribution: Record<string, number>;
    commonErrors: Array<{ code: string; message: string; count: number }>;
  } {
    const totalRecords = results.length;
    const validRecords = results.filter(r => r.isValid).length;
    const invalidRecords = totalRecords - validRecords;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalRecords;

    const errorDistribution: Record<string, number> = {};
    results.forEach(result => {
      result.errors.forEach(error => {
        errorDistribution[error.code] = (errorDistribution[error.code] || 0) + 1;
      });
    });

    const errorCounts = Object.entries(errorDistribution).map(([code, count]) => ({
      code,
      count,
    }));
    errorCounts.sort((a, b) => b.count - a.count);

    return {
      totalRecords,
      validRecords,
      invalidRecords,
      averageScore: Math.round(averageScore * 100) / 100,
      errorDistribution,
      commonErrors: errorCounts.slice(0, 10).map(({ code, count }) => {
        const sampleError = results.find(r =>
          r.errors.some(e => e.code === code)
        )?.errors.find(e => e.code === code);

        return {
          code,
          message: sampleError?.message || 'Unknown error',
          count,
        };
      }),
    };
  }
}