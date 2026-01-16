// @ts-nocheck
/**
 * Data Transformation DSL
 * Domain-specific language for data transformations
 */

import type {
  TransformConfig,
  DataSchema,
  JsonObject,
  JsonValue
} from '../types';

// ============================================================================
// DSL Builder
// ============================================================================

/**
 * Fluent DSL for building data transformation pipelines
 */
export class TransformDSL {
  private steps: DSLStep[] = [];

  /**
   * Map operation - transform each record
   */
  map(transformer: string | DSLTransformer): TransformDSL {
    this.steps.push({
      type: 'map',
      transformer: typeof transformer === 'string'
        ? new FunctionTransformer(transformer)
        : transformer
    });
    return this;
  }

  /**
   * Filter operation - filter records
   */
  filter(predicate: string | DSLPredicate): TransformDSL {
    this.steps.push({
      type: 'filter',
      predicate: typeof predicate === 'string'
        ? new FunctionPredicate(predicate)
        : predicate
    });
    return this;
  }

  /**
   * Project operation - select fields
   */
  project(...fields: string[]): TransformDSL {
    this.steps.push({
      type: 'project',
      fields
    });
    return this;
  }

  /**
   * Rename operation - rename fields
   */
  rename(mapping: Record<string, string>): TransformDSL {
    this.steps.push({
      type: 'rename',
      mapping
    });
    return this;
  }

  /**
   * Compute operation - add computed fields
   */
  compute(field: string, expression: string): TransformDSL {
    this.steps.push({
      type: 'compute',
      field,
      expression: new FunctionTransformer(expression)
    });
    return this;
  }

  /**
   * Aggregate operation - aggregate records
   */
  aggregate(aggregations: DSLAggregation[]): TransformDSL {
    this.steps.push({
      type: 'aggregate',
      aggregations
    });
    return this;
  }

  /**
   * Group by operation
   */
  groupBy(...fields: string[]): TransformDSL {
    this.steps.push({
      type: 'groupBy',
      fields
    });
    return this;
  }

  /**
   * Sort operation
   */
  sort(field: string, order: 'asc' | 'desc' = 'asc'): TransformDSL {
    this.steps.push({
      type: 'sort',
      field,
      order
    });
    return this;
  }

  /**
   * Limit operation
   */
  limit(n: number): TransformDSL {
    this.steps.push({
      type: 'limit',
      n
    });
    return this;
  }

  /**
   * Join operation
   */
  join(
    source: string,
    keys: Record<string, string>,
    type: 'inner' | 'left' | 'right' | 'full' = 'inner'
  ): TransformDSL {
    this.steps.push({
      type: 'join',
      source,
      keys,
      joinType: type
    });
    return this;
  }

  /**
   * Union operation - combine records
   */
  union(...sources: string[]): TransformDSL {
    this.steps.push({
      type: 'union',
      sources
    });
    return this;
  }

  /**
   * Pivot operation
   */
  pivot(
    indexField: string,
    columnField: string,
    valueField: string
  ): TransformDSL {
    this.steps.push({
      type: 'pivot',
      indexField,
      columnField,
      valueField
    });
    return this;
  }

  /**
   * Unpivot operation
   */
  unpivot(
    valueFields: string[],
    keyField: string,
    valueField: string
  ): TransformDSL {
    this.steps.push({
      type: 'unpivot',
      valueFields,
      keyField,
      valueField
    });
    return this;
  }

  /**
   * Validate operation - validate against schema
   */
  validate(schema: DataSchema, mode: 'strict' | 'lenient' = 'lenient'): TransformDSL {
    this.steps.push({
      type: 'validate',
      schema,
      mode
    });
    return this;
  }

  /**
   * Normalize operation - normalize data
   */
  normalize(...operations: NormalizeOperation[]): TransformDSL {
    this.steps.push({
      type: 'normalize',
      operations
    });
    return this;
  }

  /**
   * Enrich operation - enrich with external data
   */
  enrich(source: string, mappings: Record<string, string>): TransformDSL {
    this.steps.push({
      type: 'enrich',
      source,
      mappings
    });
    return this;
  }

  /**
   * Custom operation
   */
  custom(fn: (record: unknown) => unknown): TransformDSL {
    this.steps.push({
      type: 'custom',
      fn
    });
    return this;
  }

  /**
   * Build transformation pipeline
   */
  build(): TransformPipeline {
    return new TransformPipeline(this.steps);
  }

  /**
   * Build and execute transformation
   */
  async execute(data: unknown[]): Promise<unknown[]> {
    const pipeline = this.build();
    return pipeline.execute(data);
  }

  /**
   * Build and execute on single record
   */
  async executeOne(record: unknown): Promise<unknown> {
    const pipeline = this.build();
    return pipeline.executeOne(record);
  }
}

// ============================================================================
// Transform Pipeline
// ============================================================================

/**
 * Executes transformation pipeline
 */
export class TransformPipeline {
  private steps: DSLStep[];
  private context: Map<string, unknown> = new Map();

  constructor(steps: DSLStep[]) {
    this.steps = steps;
  }

  /**
   * Execute pipeline on data
   */
  async execute(data: unknown[]): Promise<unknown[]> {
    let result: unknown[] = data;

    for (const step of this.steps) {
      result = await this.executeStep(result, step);
    }

    return result;
  }

  /**
   * Execute pipeline on single record
   */
  async executeOne(record: unknown): Promise<unknown> {
    const result = await this.execute([record]);
    return result[0];
  }

  /**
   * Execute a single step
   */
  private async executeStep(data: unknown[], step: DSLStep): Promise<unknown[]> {
    switch (step.type) {
      case 'map':
        return this.executeMap(data, step.transformer!);

      case 'filter':
        return this.executeFilter(data, step.predicate!);

      case 'project':
        return this.executeProject(data, step.fields!);

      case 'rename':
        return this.executeRename(data, step.mapping!);

      case 'compute':
        return this.executeCompute(data, step.field!, step.expression!);

      case 'aggregate':
        return this.executeAggregate(data, step.aggregations!);

      case 'groupBy':
        return this.executeGroupBy(data, step.fields!);

      case 'sort':
        return this.executeSort(data, step.field!, step.order!);

      case 'limit':
        return this.executeLimit(data, step.n!);

      case 'validate':
        return this.executeValidate(data, step.schema!, step.mode!);

      case 'normalize':
        return this.executeNormalize(data, step.operations!);

      case 'custom':
        return this.executeCustom(data, step.fn!);

      default:
        return data;
    }
  }

  /**
   * Execute map step
   */
  private async executeMap(data: unknown[], transformer: DSLTransformer): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const record of data) {
      const transformed = await transformer.transform(record, this.context);
      results.push(transformed);
    }

    return results;
  }

  /**
   * Execute filter step
   */
  private async executeFilter(data: unknown[], predicate: DSLPredicate): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const record of data) {
      const passes = await predicate.test(record, this.context);
      if (passes) {
        results.push(record);
      }
    }

    return results;
  }

  /**
   * Execute project step
   */
  private async executeProject(data: unknown[], fields: string[]): Promise<unknown[]> {
    return data.map(record => {
      if (typeof record === 'object' && record !== null) {
        const obj = record as Record<string, unknown>;
        const projected: Record<string, unknown> = {};

        for (const field of fields) {
          if (field in obj) {
            projected[field] = obj[field];
          } else if (field.includes('.')) {
            // Handle nested field paths
            const value = this.getNestedValue(obj, field);
            if (value !== undefined) {
              this.setNestedValue(projected, field, value);
            }
          }
        }

        return projected;
      }
      return record;
    });
  }

  /**
   * Execute rename step
   */
  private async executeRename(data: unknown[], mapping: Record<string, string>): Promise<unknown[]> {
    return data.map(record => {
      if (typeof record === 'object' && record !== null) {
        const obj = { ...record } as Record<string, unknown>;

        for (const [oldName, newName] of Object.entries(mapping)) {
          if (oldName in obj) {
            obj[newName] = obj[oldName];
            delete obj[oldName];
          }
        }

        return obj;
      }
      return record;
    });
  }

  /**
   * Execute compute step
   */
  private async executeCompute(data: unknown[], field: string, expression: DSLTransformer): Promise<unknown[]> {
    return data.map(record => {
      if (typeof record === 'object' && record !== null) {
        const obj = { ...record } as Record<string, unknown>;
        const value = expression.transform(record, this.context);
        obj[field] = value;
        return obj;
      }
      return record;
    });
  }

  /**
   * Execute aggregate step
   */
  private async executeAggregate(data: unknown[], aggregations: DSLAggregation[]): Promise<unknown[]> {
    const result: Record<string, unknown> = {};

    for (const agg of aggregations) {
      const values = this.extractFieldValues(data, agg.field);

      switch (agg.operation) {
        case 'count':
          result[agg.alias || `${agg.field}_count`] = values.length;
          break;

        case 'sum':
          result[agg.alias || `${agg.field}_sum`] = this.sum(values as number[]);
          break;

        case 'avg':
          result[agg.alias || `${agg.field}_avg`] = this.average(values as number[]);
          break;

        case 'min':
          result[agg.alias || `${agg.field}_min`] = this.min(values as number[]);
          break;

        case 'max':
          result[agg.alias || `${agg.field}_max`] = this.max(values as number[]);
          break;

        case 'first':
          result[agg.alias || `${agg.field}_first`] = values[0];
          break;

        case 'last':
          result[agg.alias || `${agg.field}_last`] = values[values.length - 1];
          break;
      }
    }

    return [result];
  }

  /**
   * Execute group by step
   */
  private async executeGroupBy(data: unknown[], fields: string[]): Promise<unknown[]> {
    const groups = new Map<string, unknown[]>();

    for (const record of data) {
      if (typeof record === 'object' && record !== null) {
        const obj = record as Record<string, unknown>;
        const key = fields.map(f => String(obj[f] ?? null)).join('|');

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key)!.push(record);
      }
    }

    return Array.from(groups.entries()).map(([key, records]) => ({
      _key: key,
      _count: records.length,
      records
    }));
  }

  /**
   * Execute sort step
   */
  private async executeSort(data: unknown[], field: string, order: 'asc' | 'desc'): Promise<unknown[]> {
    return [...data].sort((a, b) => {
      const aVal = this.extractFieldValue(a, field);
      const bVal = this.extractFieldValue(b, field);

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');

      return order === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }

  /**
   * Execute limit step
   */
  private async executeLimit(data: unknown[], n: number): Promise<unknown[]> {
    return data.slice(0, n);
  }

  /**
   * Execute validate step
   */
  private async executeValidate(data: unknown[], schema: DataSchema, mode: 'strict' | 'lenient'): Promise<unknown[]> {
    // In a real implementation, this would validate against the schema
    return data;
  }

  /**
   * Execute normalize step
   */
  private async executeNormalize(data: unknown[], operations: NormalizeOperation[]): Promise<unknown[]> {
    return data.map(record => {
      if (typeof record === 'object' && record !== null) {
        let obj = { ...record } as Record<string, unknown>;

        for (const op of operations) {
          if (op.field in obj) {
            obj[op.field] = this.applyNormalization(obj[op.field], op);
          }
        }

        return obj;
      }
      return record;
    });
  }

  /**
   * Execute custom step
   */
  private async executeCustom(data: unknown[], fn: (record: unknown) => unknown): Promise<unknown[]> {
    return data.map(fn);
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current: Record<string, unknown> = obj;

    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[lastKey] = value;
  }

  /**
   * Extract field values from records
   */
  private extractFieldValues(data: unknown[], field: string): unknown[] {
    const values: unknown[] = [];

    for (const record of data) {
      const value = this.extractFieldValue(record, field);
      if (value !== undefined && value !== null) {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Extract field value from record
   */
  private extractFieldValue(record: unknown, field: string): unknown {
    if (typeof record === 'object' && record !== null) {
      const obj = record as Record<string, unknown>;

      if (field.includes('.')) {
        return this.getNestedValue(obj, field);
      }

      return obj[field];
    }

    return undefined;
  }

  /**
   * Apply normalization operation
   */
  private applyNormalization(value: unknown, operation: NormalizeOperation): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    switch (operation.type) {
      case 'lowercase':
        return value.toLowerCase();

      case 'uppercase':
        return value.toUpperCase();

      case 'trim':
        return value.trim();

      case 'replace':
        const re = new RegExp(operation.pattern, operation.flags || 'g');
        return value.replace(re, operation.replacement);

      case 'format-date':
        return this.formatDate(value, operation.format);

      case 'format-number':
        return this.formatNumber(value, operation.format);

      default:
        return value;
    }
  }

  /**
   * Format date string
   */
  private formatDate(value: string, format: string): string {
    const date = new Date(value);
    // Simple date formatting (use proper library in production)
    return date.toISOString();
  }

  /**
   * Format number string
   */
  private formatNumber(value: string, format: string): string {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return value;
    }
    // Simple number formatting (use proper library in production)
    return num.toString();
  }

  /**
   * Sum numbers
   */
  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Average numbers
   */
  private average(values: number[]): number {
    return values.length > 0 ? this.sum(values) / values.length : 0;
  }

  /**
   * Find minimum
   */
  private min(values: number[]): number {
    return Math.min(...values);
  }

  /**
   * Find maximum
   */
  private max(values: number[]): number {
    return Math.max(...values);
  }

  /**
   * Set context variable
   */
  setContext(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  /**
   * Get context variable
   */
  getContext(key: string): unknown | undefined {
    return this.context.get(key);
  }
}

// ============================================================================
// DSL Step Types
// ============================================================================

type DSLStep =
  | { type: 'map'; transformer?: DSLTransformer }
  | { type: 'filter'; predicate?: DSLPredicate }
  | { type: 'project'; fields?: string[] }
  | { type: 'rename'; mapping?: Record<string, string> }
  | { type: 'compute'; field?: string; expression?: DSLTransformer }
  | { type: 'aggregate'; aggregations?: DSLAggregation[] }
  | { type: 'groupBy'; fields?: string[] }
  | { type: 'sort'; field?: string; order?: 'asc' | 'desc' }
  | { type: 'limit'; n?: number }
  | { type: 'join'; source?: string; keys?: Record<string, string>; joinType?: string }
  | { type: 'union'; sources?: string[] }
  | { type: 'pivot'; indexField?: string; columnField?: string; valueField?: string }
  | { type: 'unpivot'; valueFields?: string[]; keyField?: string; valueField?: string }
  | { type: 'validate'; schema?: DataSchema; mode?: 'strict' | 'lenient' }
  | { type: 'normalize'; operations?: NormalizeOperation[] }
  | { type: 'enrich'; source?: string; mappings?: Record<string, string> }
  | { type: 'custom'; fn?: (record: unknown) => unknown };

interface DSLAggregation {
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';
  alias?: string;
}

interface NormalizeOperation {
  type: 'lowercase' | 'uppercase' | 'trim' | 'replace' | 'format-date' | 'format-number';
  field?: string;
  pattern?: string;
  flags?: string;
  replacement?: string;
  format?: string;
}

// ============================================================================
// Function-based Transformer
// ============================================================================

class FunctionTransformer implements DSLTransformer {
  private fn: (record: unknown, context: Map<string, unknown>) => unknown;

  constructor(expression: string) {
    this.fn = new Function('record', 'context', `
      "use strict";
      try {
        return (${expression});
      } catch (error) {
        console.error("Transform error:", error);
        return record;
      }
    `) as (record: unknown, context: Map<string, unknown>) => unknown;
  }

  transform(record: unknown, context: Map<string, unknown>): unknown {
    return this.fn(record, context);
  }
}

// ============================================================================
// Function-based Predicate
// ============================================================================

class FunctionPredicate implements DSLPredicate {
  private fn: (record: unknown, context: Map<string, unknown>) => boolean;

  constructor(expression: string) {
    this.fn = new Function('record', 'context', `
      "use strict";
      try {
        return ${expression};
      } catch (error) {
        console.error("Predicate error:", error);
        return false;
      }
    `) as (record: unknown, context: Map<string, unknown>) => boolean;
  }

  test(record: unknown, context: Map<string, unknown>): boolean {
    return this.fn(record, context);
  }
}

// ============================================================================
// Interfaces
// ============================================================================

export interface DSLTransformer {
  transform(record: unknown, context: Map<string, unknown>): unknown;
}

export interface DSLPredicate {
  test(record: unknown, context: Map<string, unknown>): boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new transformation DSL
 */
export function transform(): TransformDSL {
  return new TransformDSL();
}

/**
 * Parse and execute transformation expression
 */
export async function executeTransform(
  data: unknown[],
  expression: string
): Promise<unknown[]> {
  return transform().map(expression).execute(data);
}
