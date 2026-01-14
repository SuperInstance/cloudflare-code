/**
 * Data Transformation Module
 * Data transformation DSL with schema evolution support
 */

export {
  TransformDSL,
  TransformPipeline,
  transform,
  executeTransform
} from './dsl';

export type {
  DSLTransformer,
  DSLPredicate
} from './dsl';

export {
  SchemaRegistry,
  SchemaMigrator,
  SchemaValidator,
  createSchemaRegistry,
  createSchemaMigrator,
  createSchemaValidator
} from './schema';

export type {
  SchemaMigration,
  SchemaChange,
  MigrationStep,
  ValidationResult
} from './schema';

import type { TransformConfig } from '../types';

// ============================================================================
// Transform Engine
// ============================================================================

/**
 * Main transformation engine
 */
export class TransformEngine {
  /**
   * Apply transformation to data
   */
  static async apply(
    data: unknown[],
    transforms: TransformConfig[]
  ): Promise<unknown[]> {
    let result = data;

    for (const transform of transforms) {
      result = await this.applyTransform(result, transform);
    }

    return result;
  }

  /**
   * Apply single transformation
   */
  private static async applyTransform(
    data: unknown[],
    transform: TransformConfig
  ): Promise<unknown[]> {
    switch (transform.type) {
      case 'map':
        return this.applyMap(data, transform.config as any);

      case 'filter':
        return this.applyFilter(data, transform.config as any);

      case 'aggregate':
        return this.applyAggregate(data, transform.config as any);

      case 'normalize':
        return this.applyNormalize(data, transform.config as any);

      case 'enrich':
        return this.applyEnrich(data, transform.config as any);

      default:
        return data;
    }
  }

  /**
   * Apply map transformation
   */
  private static async applyMap(
    data: unknown[],
    config: any
  ): Promise<unknown[]> {
    const fn = new Function('record', `
      "use strict";
      try {
        ${config.script}
      } catch (error) {
        console.error("Map transform error:", error);
        return record;
      }
    `);

    return data.map(record => fn(record));
  }

  /**
   * Apply filter transformation
   */
  private static async applyFilter(
    data: unknown[],
    config: any
  ): Promise<unknown[]> {
    const fn = new Function('record', `
      "use strict";
      try {
        return ${config.condition};
      } catch (error) {
        console.error("Filter transform error:", error);
        return false;
      }
    `);

    return data.filter(record => fn(record));
  }

  /**
   * Apply aggregate transformation
   */
  private static async applyAggregate(
    data: unknown[],
    config: any
  ): Promise<unknown[]> {
    const result: Record<string, unknown> = {};

    for (const agg of config.aggregations) {
      const values = this.extractField(data, agg.field);

      switch (agg.operation) {
        case 'count':
          result[agg.alias || `${agg.field}_count`] = values.length;
          break;

        case 'sum':
          result[agg.alias || `${agg.field}_sum`] =
            (values as number[]).reduce((sum, val) => sum + val, 0);
          break;

        case 'avg':
          result[agg.alias || `${agg.field}_avg`] =
            (values as number[]).reduce((sum, val) => sum + val, 0) / values.length;
          break;

        case 'min':
          result[agg.alias || `${agg.field}_min`] = Math.min(...(values as number[]));
          break;

        case 'max':
          result[agg.alias || `${agg.field}_max`] = Math.max(...(values as number[]));
          break;
      }
    }

    return [result];
  }

  /**
   * Apply normalize transformation
   */
  private static async applyNormalize(
    data: unknown[],
    config: any
  ): Promise<unknown[]> {
    return data.map(record => {
      if (typeof record === 'object' && record !== null) {
        const obj = { ...record } as Record<string, unknown>;

        for (const op of config.operations) {
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
   * Apply normalization operation
   */
  private static applyNormalization(value: unknown, op: any): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    switch (op.operation) {
      case 'lowercase':
        return value.toLowerCase();

      case 'uppercase':
        return value.toUpperCase();

      case 'trim':
        return value.trim();

      default:
        return value;
    }
  }

  /**
   * Apply enrich transformation
   */
  private static async applyEnrich(
    data: unknown[],
    config: any
  ): Promise<unknown[]> {
    // In a real implementation, this would fetch enrichment data
    return data;
  }

  /**
   * Extract field values from records
   */
  private static extractField(data: unknown[], field: string): unknown[] {
    const values: unknown[] = [];

    for (const record of data) {
      if (typeof record === 'object' && record !== null) {
        const obj = record as Record<string, unknown>;
        if (field in obj) {
          values.push(obj[field]);
        }
      }
    }

    return values;
  }
}

// ============================================================================
// Common Transformations
// ============================================================================

/**
 * Common transformation utilities
 */
export class CommonTransforms {
  /**
   * Convert fields to lowercase
   */
  static lowercase(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          for (const field of fields) {
            if (typeof obj[field] === 'string') {
              obj[field] = (obj[field] as string).toLowerCase();
            }
          }
          return obj;
        }
        return record;
      });
  }

  /**
   * Convert fields to uppercase
   */
  static uppercase(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          for (const field of fields) {
            if (typeof obj[field] === 'string') {
              obj[field] = (obj[field] as string).toUpperCase();
            }
          }
          return obj;
        }
        return record;
      });
  }

  /**
   * Trim whitespace from fields
   */
  static trim(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          for (const field of fields) {
            if (typeof obj[field] === 'string') {
              obj[field] = (obj[field] as string).trim();
            }
          }
          return obj;
        }
        return record;
      });
  }

  /**
   * Remove null/undefined values
   */
  static compact(data: unknown[]): unknown[] {
    return data.map(record => {
      if (typeof record === 'object' && record !== null) {
        const obj: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(record)) {
          if (value !== null && value !== undefined) {
            obj[key] = value;
          }
        }

        return obj;
      }
      return record;
    });
  }

  /**
   * Remove specified fields
   */
  static omit(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          for (const field of fields) {
            delete obj[field];
          }
          return obj;
        }
        return record;
      });
  }

  /**
   * Select only specified fields
   */
  static pick(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj: Record<string, unknown> = {};
          for (const field of fields) {
            if (field in record) {
              obj[field] = (record as Record<string, unknown>)[field];
            }
          }
          return obj;
        }
        return record;
      });
  }

  /**
   * Rename fields
   */
  static rename(mapping: Record<string, string>): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
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
   * Add timestamp field
   */
  static addTimestamp(field: string = 'timestamp'): (data: unknown[]) => unknown[] {
    const timestamp = new Date().toISOString();

    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          obj[field] = timestamp;
          return obj;
        }
        return record;
      });
  }

  /**
   * Parse JSON strings in fields
   */
  static parseJson(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          for (const field of fields) {
            if (typeof obj[field] === 'string') {
              try {
                obj[field] = JSON.parse(obj[field] as string);
              } catch {
                // Keep original value if parsing fails
              }
            }
          }
          return obj;
        }
        return record;
      });
  }

  /**
   * Stringify fields to JSON
   */
  static stringifyJson(...fields: string[]): (data: unknown[]) => unknown[] {
    return (data) =>
      data.map(record => {
        if (typeof record === 'object' && record !== null) {
          const obj = { ...record } as Record<string, unknown>;
          for (const field of fields) {
            if (field in obj && typeof obj[field] === 'object') {
              obj[field] = JSON.stringify(obj[field]);
            }
          }
          return obj;
        }
        return record;
      });
  }
}

// ============================================================================
// Pipeline Compose
// ============================================================================

/**
 * Compose multiple transformations into a pipeline
 */
export function compose(...transforms: Array<(data: unknown[]) => unknown[]>): (data: unknown[]) => unknown[] {
  return (data) =>
    transforms.reduce((result, transform) => transform(result), data);
}

/**
 * Create a transformation pipeline
 */
export function pipeline(...transforms: Array<(data: unknown[]) => unknown[]>): (data: unknown[]) => Promise<unknown[]> {
  return async (data) => {
    let result = data;

    for (const transform of transforms) {
      result = transform(result);
    }

    return result;
  };
}
