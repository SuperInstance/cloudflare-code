// @ts-nocheck
/**
 * Data Quality Validator
 * Validates data quality based on configured rules
 */

import type {
  QualityConfig,
  QualityRule,
  QualityAction,
  DataSchema,
  JsonObject
} from '../types';

export interface ValidationResult {
  valid: boolean;
  ruleId: string;
  ruleName: string;
  violations: QualityViolation[];
  severity: 'error' | 'warning' | 'info';
  timestamp: Date;
}

export interface QualityViolation {
  field?: string;
  message: string;
  value?: unknown;
  expected?: unknown;
  record?: unknown;
}

export class DataQualityValidator {
  private rules: Map<string, QualityRule> = new Map();
  private config: QualityConfig;

  constructor(config: QualityConfig) {
    this.config = config;
    this.initializeRules();
  }

  /**
   * Validate single record
   */
  async validateRecord(record: unknown): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const rule of this.config.rules) {
      const result = await this.applyRule(record, rule);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate multiple records
   */
  async validateRecords(records: unknown[]): Promise<ValidationResult[]> {
    const allResults: ValidationResult[] = [];

    for (const record of records) {
      const results = await this.validateRecord(record);
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Validate field in records
   */
  async validateField(records: unknown[], field: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Find applicable rules for the field
    const applicableRules = this.config.rules.filter(
      rule => !rule.config.field || rule.config.field === field
    );

    for (const record of records) {
      for (const rule of applicableRules) {
        const result = await this.applyRule(record, rule);
        if (result.violations.length > 0) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Get overall quality score
   */
  getQualityScore(results: ValidationResult[]): QualityScore {
    const total = results.length;
    const errors = results.filter(r => r.severity === 'error').length;
    const warnings = results.filter(r => r.severity === 'warning').length;

    const valid = total - errors - warnings;

    return {
      total,
      valid,
      errors,
      warnings,
      score: total > 0 ? (valid / total) * 100 : 0,
      passRate: total > 0 ? (valid / total) * 100 : 0
    };
  }

  /**
   * Initialize rules
   */
  private initializeRules(): void {
    for (const rule of this.config.rules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Apply rule to record
   */
  private async applyRule(record: unknown, rule: QualityRule): Promise<ValidationResult> {
    const violations: QualityViolation[] = [];

    switch (rule.type) {
      case 'schema-validation':
        this.validateSchema(record, rule, violations);
        break;

      case 'completeness':
        this.validateCompleteness(record, rule, violations);
        break;

      case 'uniqueness':
        // Uniqueness validation requires multiple records
        break;

      case 'accuracy':
        this.validateAccuracy(record, rule, violations);
        break;

      case 'timeliness':
        this.validateTimeliness(record, rule, violations);
        break;

      case 'consistency':
        this.validateConsistency(record, rule, violations);
        break;

      case 'custom':
        await this.validateCustom(record, rule, violations);
        break;
    }

    return {
      valid: violations.length === 0,
      ruleId: rule.id,
      ruleName: rule.name,
      violations,
      severity: violations.length > 0 ? rule.severity : 'info',
      timestamp: new Date()
    };
  }

  /**
   * Validate schema
   */
  private validateSchema(record: unknown, rule: QualityRule, violations: QualityViolation[]): void {
    const schema = rule.config.custom?.schema as DataSchema;

    if (!schema) {
      return;
    }

    if (typeof record !== 'object' || record === null) {
      violations.push({
        message: 'Record must be an object',
        value: record
      });
      return;
    }

    const obj = record as Record<string, unknown>;
    const schemaDef = schema.definition as JsonObject;

    // Check required fields
    const required = schemaDef.required || [];
    for (const field of required) {
      if (!(field in obj)) {
        violations.push({
          field,
          message: `Required field is missing`,
          expected: 'present',
          value: 'undefined'
        });
      }
    }

    // Check field types
    const properties = schemaDef.properties || {};
    for (const [field, def] of Object.entries(properties)) {
      if (field in obj) {
        const value = obj[field];
        const fieldDef = def as JsonObject;
        const expectedType = fieldDef.type as string;

        if (!this.checkType(value, expectedType)) {
          violations.push({
            field,
            message: `Field has invalid type`,
            expected: expectedType,
            value: typeof value
          });
        }
      }
    }
  }

  /**
   * Validate completeness
   */
  private validateCompleteness(record: unknown, rule: QualityRule, violations: QualityViolation[]): void {
    if (typeof record !== 'object' || record === null) {
      return;
    }

    const obj = record as Record<string, unknown>;
    const field = rule.config.field;

    if (!field) {
      return;
    }

    const value = obj[field];
    const threshold = rule.config.threshold || 0;

    // Check for null/undefined/empty
    if (value === null || value === undefined) {
      violations.push({
        field,
        message: 'Field is null or undefined',
        value
      });
      return;
    }

    // Check for empty strings
    if (typeof value === 'string' && value.trim().length === 0) {
      violations.push({
        field,
        message: 'Field is empty',
        value
      });
    }

    // Check for minimum length (strings/arrays)
    if (typeof value === 'string' || Array.isArray(value)) {
      if (value.length < threshold) {
        violations.push({
          field,
          message: `Field length is below threshold (${threshold})`,
          value,
          expected: `length >= ${threshold}`
        });
      }
    }
  }

  /**
   * Validate accuracy
   */
  private validateAccuracy(record: unknown, rule: QualityRule, violations: QualityViolation[]): void {
    if (typeof record !== 'object' || record === null) {
      return;
    }

    const obj = record as Record<string, unknown>;
    const field = rule.config.field;

    if (!field) {
      return;
    }

    const value = obj[field];

    // Check numeric ranges
    if (rule.config.custom?.min !== undefined) {
      const min = rule.config.custom.min as number;
      if (typeof value === 'number' && value < min) {
        violations.push({
          field,
          message: `Value is below minimum (${min})`,
          value,
          expected: `>= ${min}`
        });
      }
    }

    if (rule.config.custom?.max !== undefined) {
      const max = rule.config.custom.max as number;
      if (typeof value === 'number' && value > max) {
        violations.push({
          field,
          message: `Value is above maximum (${max})`,
          value,
          expected: `<= ${max}`
        });
      }
    }

    // Check allowed values
    if (rule.config.custom?.allowedValues) {
      const allowed = rule.config.custom.allowedValues as unknown[];
      if (!allowed.includes(value)) {
        violations.push({
          field,
          message: `Value is not in allowed list`,
          value,
          expected: `one of ${allowed.join(', ')}`
        });
      }
    }

    // Check pattern match
    if (rule.config.custom?.pattern && typeof value === 'string') {
      const pattern = new RegExp(rule.config.custom.pattern as string);
      if (!pattern.test(value)) {
        violations.push({
          field,
          message: `Value does not match pattern`,
          value,
          expected: `pattern: ${rule.config.custom.pattern}`
        });
      }
    }
  }

  /**
   * Validate timeliness
   */
  private validateTimeliness(record: unknown, rule: QualityRule, violations: QualityViolation[]): void {
    if (typeof record !== 'object' || record === null) {
      return;
    }

    const obj = record as Record<string, unknown>;
    const field = rule.config.field;

    if (!field) {
      return;
    }

    const value = obj[field];

    // Check if value is a date
    const date = value instanceof Date ? value : new Date(value as string | number);

    if (isNaN(date.getTime())) {
      violations.push({
        field,
        message: 'Invalid date value',
        value
      });
      return;
    }

    // Check if date is too old
    if (rule.config.custom?.maxAge) {
      const maxAge = rule.config.custom.maxAge as number; // milliseconds
      const now = new Date();
      const age = now.getTime() - date.getTime();

      if (age > maxAge) {
        violations.push({
          field,
          message: `Date is too old (${Math.round(age / 1000 / 60)} minutes)`,
          value: date,
          expected: `age <= ${Math.round(maxAge / 1000 / 60)} minutes`
        });
      }
    }

    // Check if date is in the future
    if (rule.config.custom?.allowFuture === false) {
      const now = new Date();
      if (date > now) {
        violations.push({
          field,
          message: 'Date is in the future',
          value: date,
          expected: 'past or present'
        });
      }
    }
  }

  /**
   * Validate consistency
   */
  private validateConsistency(record: unknown, rule: QualityRule, violations: QualityViolation[]): void {
    if (typeof record !== 'object' || record === null) {
      return;
    }

    const obj = record as Record<string, unknown>;

    // Check conditional consistency
    if (rule.config.custom?.condition) {
      const condition = rule.config.custom.condition as {
        if: { field: string; value: unknown };
        then: { field: string; required: boolean };
      };

      const ifValue = obj[condition.if.field];

      if (ifValue === condition.if.value) {
        const thenValue = obj[condition.then.field];

        if (condition.then.required && (thenValue === null || thenValue === undefined)) {
          violations.push({
            field: condition.then.field,
            message: `Field is required when ${condition.if.field} = ${condition.if.value}`,
            value: thenValue,
            expected: 'present'
          });
        }
      }
    }

    // Check cross-field consistency
    if (rule.config.custom?.crossField) {
      const crossField = rule.config.custom.crossField as {
        field1: string;
        field2: string;
        operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
      };

      const value1 = obj[crossField.field1];
      const value2 = obj[crossField.field2];

      let consistent = false;

      switch (crossField.operator) {
        case 'eq':
          consistent = value1 === value2;
          break;
        case 'gt':
          consistent = typeof value1 === 'number' && typeof value2 === 'number' && value1 > value2;
          break;
        case 'lt':
          consistent = typeof value1 === 'number' && typeof value2 === 'number' && value1 < value2;
          break;
        case 'gte':
          consistent = typeof value1 === 'number' && typeof value2 === 'number' && value1 >= value2;
          break;
        case 'lte':
          consistent = typeof value1 === 'number' && typeof value2 === 'number' && value1 <= value2;
          break;
      }

      if (!consistent) {
        violations.push({
          message: `Fields ${crossField.field1} and ${crossField.field2} are inconsistent`,
          value: { [crossField.field1]: value1, [crossField.field2]: value2 },
          expected: `${crossField.field1} ${crossField.operator} ${crossField.field2}`
        });
      }
    }
  }

  /**
   * Validate custom rule
   */
  private async validateCustom(record: unknown, rule: QualityRule, violations: QualityViolation[]): void {
    if (rule.config.custom?.validator) {
      const validatorFn = rule.config.custom.validator as (record: unknown) => QualityViolation[];

      try {
        const customViolations = validatorFn(record);
        violations.push(...customViolations);
      } catch (error) {
        violations.push({
          message: `Custom validator error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
  }

  /**
   * Check if value matches type
   */
  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';

      case 'number':
      case 'integer':
        return typeof value === 'number';

      case 'boolean':
        return typeof value === 'boolean';

      case 'array':
        return Array.isArray(value);

      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);

      case 'null':
        return value === null;

      default:
        return true;
    }
  }
}

/**
 * Quality score
 */
export interface QualityScore {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  score: number;
  passRate: number;
}
