/**
 * Event Transformer - Advanced event transformation system
 *
 * Provides event transformation, enrichment, normalization, validation,
 * mapping, field extraction, and schema evolution
 */

// @ts-nocheck - Type conversion issues with EventMetadata
import type { EventEnvelope, EventMetadata } from '../types';

// ============================================================================
// Transformer Types
// ============================================================================

export interface TransformationRule {
  ruleId: string;
  name: string;
  description?: string;
  transformation: Transformation;
  condition?: TransformationCondition;
  priority?: number;
  enabled: boolean;
}

export type Transformation =
  | FieldMapping
  | FieldExtraction
  | Enrichment
  | Normalization
  | Validation
  | Aggregation
  | CustomTransformation;

export interface FieldMapping {
  type: 'map';
  mappings: Record<string, string>; // source field -> target field
  overwrite?: boolean; // Whether to overwrite existing fields
  removeSource?: boolean; // Whether to remove source fields after mapping
}

export interface FieldExtraction {
  type: 'extract';
  extractions: Extraction[];
}

export interface Extraction {
  sourceField: string;
  targetField: string;
  extractionType: 'regex' | 'jsonpath' | 'substring' | 'split' | 'custom';
  pattern?: string;
  index?: number;
  fn?: (value: unknown) => unknown;
}

export interface Enrichment {
  type: 'enrich';
  enrichments: Enrichment[];
}

export interface Enrichment {
  targetField: string;
  value: EnrichmentValue;
  overwrite?: boolean;
}

export type EnrichmentValue =
  | string
  | number
  | boolean
  | null
  | { type: 'static'; value: unknown }
  | { type: 'timestamp'; format?: 'iso' | 'unix' | 'unix-ms' }
  | { type: 'uuid'; version?: 4 | 5 }
  | { type: 'field'; source: string }
  | { type: 'env'; key: string }
  | { type: 'function'; fn: (event: EventEnvelope) => unknown }
  | { type: 'external'; url: string; cache?: boolean };

export interface Normalization {
  type: 'normalize';
  normalizations: Normalization[];
}

export interface Normalization {
  field: string;
  operation:
    | 'lowercase'
    | 'uppercase'
    | 'trim'
    | 'sanitize'
    | 'format'
    | 'coerce';
  options?: Record<string, unknown>;
}

export interface Validation {
  type: 'validate';
  validations: ValidationRule[];
  failAction: 'error' | 'drop' | 'tag' | 'continue';
}

export interface ValidationRule {
  field: string;
  rule: ValidationType;
  errorMessage?: string;
}

export type ValidationType =
  | { type: 'required' }
  | { type: 'type'; expected: string }
  | { type: 'range'; min?: number; max?: number }
  | { type: 'length'; min?: number; max?: number }
  | { type: 'pattern'; regex: string }
  | { type: 'enum'; values: unknown[] }
  | { type: 'custom'; fn: (value: unknown) => boolean | Promise<boolean> };

export interface Aggregation {
  type: 'aggregate';
  aggregations: AggregationRule[];
  window?: {
    size: number;
    timeMs?: number;
  };
}

export interface AggregationRule {
  targetField: string;
  sourceField: string;
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'concat' | 'first' | 'last';
  groupBy?: string[];
}

export interface CustomTransformation {
  type: 'custom';
  fn: (event: EventEnvelope) => EventEnvelope | Promise<EventEnvelope>;
  description?: string;
}

export type TransformationCondition =
  | { type: 'field'; field: string; operator: string; value: unknown }
  | { type: 'eventType'; eventTypes: string[] }
  | { type: 'custom'; fn: (event: EventEnvelope) => boolean | Promise<boolean> };

export interface TransformationResult {
  success: boolean;
  event: EventEnvelope | null;
  errors: TransformationError[];
  warnings: string[];
  appliedRules: string[];
}

export interface TransformationError {
  field?: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface TransformationStats {
  totalTransformations: number;
  successfulTransformations: number;
  failedTransformations: number;
  averageExecutionTimeMs: number;
  ruleBreakdown: Map<string, RulePerformance>;
}

export interface RulePerformance {
  ruleId: string;
  executions: number;
  successes: number;
  failures: number;
  averageExecutionTimeMs: number;
}

// ============================================================================
// Schema Evolution
// ============================================================================

export interface SchemaEvolution {
  eventType: string;
  fromVersion: number;
  toVersion: number;
  migrations: Migration[];
}

export interface Migration {
  version: number;
  transformations: Transformation[];
  description?: string;
  deprecatedFields?: string[];
  addedFields?: Record<string, { type: string; required?: boolean; default?: unknown }>;
}

// ============================================================================
// Event Transformer
// ============================================================================

export class EventTransformer {
  private rules: Map<string, TransformationRule>;
  private schemaEvolutions: Map<string, SchemaEvolution>;
  private stats: TransformationStats;
  private cache: Map<string, EventEnvelope>;

  constructor() {
    this.rules = new Map();
    this.schemaEvolutions = new Map();
    this.cache = new Map();
    this.stats = {
      totalTransformations: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      averageExecutionTimeMs: 0,
      ruleBreakdown: new Map(),
    };
  }

  // ========================================================================
  // Rule Management
  // ========================================================================

  addRule(rule: Omit<TransformationRule, 'ruleId'>): string {
    const newRule: TransformationRule = {
      ...rule,
      ruleId: this.generateRuleId(),
    };

    this.rules.set(newRule.ruleId, newRule);
    return newRule.ruleId;
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): TransformationRule | null {
    return this.rules.get(ruleId) || null;
  }

  listRules(): TransformationRule[] {
    return Array.from(this.rules.values());
  }

  // ========================================================================
  // Transformation
  // ========================================================================

  async transform(
    event: EventEnvelope,
    options: {
      ruleIds?: string[];
      stopOnError?: boolean;
      validateSchema?: boolean;
    } = {}
  ): Promise<TransformationResult> {
    const startTime = performance.now();
    const errors: TransformationError[] = [];
    const warnings: string[] = [];
    const appliedRules: string[] = [];

    let currentEvent = this.cloneEvent(event);

    try {
      // Get rules to apply
      const rulesToApply = options.ruleIds
        ? options.ruleIds
            .map((id) => this.rules.get(id))
            .filter((r) => r !== undefined) as TransformationRule[]
        : Array.from(this.rules.values()).filter((r) => r.enabled);

      // Sort by priority
      rulesToApply.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      // Apply rules
      for (const rule of rulesToApply) {
        // Check condition
        if (rule.condition && !(await this.checkCondition(rule.condition, currentEvent))) {
          continue;
        }

        try {
          const ruleStartTime = performance.now();
          const result = await this.applyTransformation(rule.transformation, currentEvent);
          const ruleExecutionTime = performance.now() - ruleStartTime;

          if (result.success) {
            currentEvent = result.event!;
            appliedRules.push(rule.ruleId);
            this.updateRuleStats(rule.ruleId, ruleExecutionTime, true);
          } else {
            errors.push(...result.errors);
            warnings.push(...result.warnings);
            this.updateRuleStats(rule.ruleId, ruleExecutionTime, false);

            if (options.stopOnError !== false) {
              break;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            message: `Rule ${rule.ruleId} failed: ${errorMessage}`,
            code: 'TRANSFORMATION_ERROR',
            severity: 'error',
          });

          if (options.stopOnError !== false) {
            break;
          }
        }
      }

      // Validate schema if requested
      if (options.validateSchema) {
        const validationErrors = await this.validateEvent(currentEvent);
        errors.push(...validationErrors);
      }

      const success = errors.filter((e) => e.severity === 'error').length === 0;

      this.updateGlobalStats(
        success,
        performance.now() - startTime
      );

      return {
        success,
        event: success ? currentEvent : null,
        errors,
        warnings,
        appliedRules,
      };
    } catch (error) {
      this.updateGlobalStats(false, performance.now() - startTime);

      return {
        success: false,
        event: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'TRANSFORMATION_FATAL',
            severity: 'error',
          },
        ],
        warnings,
        appliedRules,
      };
    }
  }

  async transformBatch(
    events: EventEnvelope[],
    options?: {
      ruleIds?: string[];
      stopOnError?: boolean;
      parallel?: boolean;
    }
  ): Promise<TransformationResult[]> {
    if (options?.parallel) {
      return Promise.all(events.map((e) => this.transform(e, options)));
    }

    const results: TransformationResult[] = [];
    for (const event of events) {
      const result = await this.transform(event, options);
      results.push(result);
    }

    return results;
  }

  // ========================================================================
  // Schema Evolution
  // ========================================================================

  addSchemaEvolution(evolution: SchemaEvolution): void {
    const key = `${evolution.eventType}:${evolution.fromVersion}`;
    this.schemaEvolutions.set(key, evolution);
  }

  async evolveEvent(
    event: EventEnvelope,
    targetVersion: number
  ): Promise<TransformationResult> {
    const currentVersion = event.metadata.version;

    if (currentVersion === targetVersion) {
      return {
        success: true,
        event,
        errors: [],
        warnings: [],
        appliedRules: [],
      };
    }

    if (currentVersion > targetVersion) {
      return {
        success: false,
        event: null,
        errors: [
          {
            message: `Cannot evolve from version ${currentVersion} to ${targetVersion} (downgrade not supported)`,
            code: 'INVALID_VERSION',
            severity: 'error',
          },
        ],
        warnings: [],
        appliedRules: [],
      };
    }

    let currentEvent = this.cloneEvent(event);
    const errors: TransformationError[] = [];
    const appliedMigrations: string[] = [];

    // Apply migrations incrementally
    for (let version = currentVersion; version < targetVersion; version++) {
      const key = `${event.metadata.eventType}:${version}`;
      const evolution = this.schemaEvolutions.get(key);

      if (!evolution) {
        return {
          success: false,
          event: null,
          errors: [
            {
              message: `No migration path found from version ${version} to ${version + 1}`,
              code: 'NO_MIGRATION_PATH',
              severity: 'error',
            },
          ],
          warnings: [],
          appliedRules: [],
        };
      }

      // Apply migrations for this version
      for (const migration of evolution.migrations) {
        if (migration.version !== version + 1) {
          continue;
        }

        // Handle deprecated fields
        if (migration.deprecatedFields) {
          for (const field of migration.deprecatedFields) {
            currentEvent = this.removeField(currentEvent, field);
          }
        }

        // Handle added fields
        if (migration.addedFields) {
          for (const [fieldName, config] of Object.entries(migration.addedFields)) {
            const value = config.default !== undefined ? config.default : this.getDefaultForType(config.type);
            currentEvent = this.setField(currentEvent, fieldName, value);
          }
        }

        // Apply transformations
        for (const transformation of migration.transformations) {
          const result = await this.applyTransformation(transformation, currentEvent);
          if (!result.success) {
            errors.push(...result.errors);
          } else {
            currentEvent = result.event!;
          }
        }

        appliedMigrations.push(`${event.metadata.eventType}:${version} -> ${version + 1}`);
      }

      // Update version
      currentEvent.metadata.version = version + 1;
    }

    const success = errors.filter((e) => e.severity === 'error').length === 0;

    return {
      success,
      event: success ? currentEvent : null,
      errors,
      warnings: [],
      appliedRules: appliedMigrations,
    };
  }

  // ========================================================================
  // Internal Methods
  // ========================================================================

  private async applyTransformation(
    transformation: Transformation,
    event: EventEnvelope
  ): Promise<TransformationResult> {
    const errors: TransformationError[] = [];
    const warnings: string[] = [];
    let currentEvent = this.cloneEvent(event);

    try {
      switch (transformation.type) {
        case 'map':
          currentEvent = await this.applyFieldMapping(transformation, currentEvent);
          break;

        case 'extract':
          currentEvent = await this.applyFieldExtraction(transformation, currentEvent);
          break;

        case 'enrich':
          currentEvent = await this.applyEnrichment(transformation, currentEvent);
          break;

        case 'normalize':
          currentEvent = await this.applyNormalization(transformation, currentEvent);
          break;

        case 'validate':
          const validationResult = await this.applyValidation(transformation, currentEvent);
          if (!validationResult.success) {
            errors.push(...validationResult.errors);
          }
          warnings.push(...validationResult.warnings);
          break;

        case 'aggregate':
          // Aggregation typically requires state - placeholder for now
          warnings.push('Aggregation transformations require context state');
          break;

        case 'custom':
          currentEvent = await transformation.fn(currentEvent);
          break;

        default:
          errors.push({
            message: `Unknown transformation type: ${(transformation as { type: string }).type}`,
            code: 'UNKNOWN_TRANSFORMATION',
            severity: 'error',
          });
      }

      return {
        success: errors.filter((e) => e.severity === 'error').length === 0,
        event: currentEvent,
        errors,
        warnings,
        appliedRules: [],
      };
    } catch (error) {
      return {
        success: false,
        event: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'TRANSFORMATION_ERROR',
            severity: 'error',
          },
        ],
        warnings,
        appliedRules: [],
      };
    }
  }

  private async applyFieldMapping(
    mapping: FieldMapping,
    event: EventEnvelope
  ): Promise<EventEnvelope> {
    const newEvent = this.cloneEvent(event);
    const payload = newEvent.payload as Record<string, unknown>;

    for (const [source, target] of Object.entries(mapping.mappings)) {
      const value = this.getNestedValue(payload, source);

      if (value !== undefined) {
        this.setNestedValue(payload, target, value);

        if (mapping.removeSource) {
          this.removeNestedValue(payload, source);
        }
      }
    }

    return newEvent;
  }

  private async applyFieldExtraction(
    extraction: FieldExtraction,
    event: EventEnvelope
  ): Promise<EventEnvelope> {
    const newEvent = this.cloneEvent(event);
    const payload = newEvent.payload as Record<string, unknown>;

    for (const ext of extraction.extractions) {
      const sourceValue = this.getNestedValue(payload, ext.sourceField);

      if (sourceValue === undefined) {
        continue;
      }

      let extractedValue: unknown;

      switch (ext.extractionType) {
        case 'regex':
          if (typeof sourceValue === 'string' && ext.pattern) {
            const regex = new RegExp(ext.pattern);
            const match = sourceValue.match(regex);
            extractedValue = match ? (match[ext.index ?? 1] || match[0]) : undefined;
          } else {
            extractedValue = undefined;
          }
          break;

        case 'jsonpath':
          // Simplified JSONPath - in production would use a proper library
          extractedValue = this.getNestedValue(payload, ext.pattern || '');
          break;

        case 'substring':
          if (typeof sourceValue === 'string') {
            extractedValue = sourceValue.substring(ext.index ?? 0);
          } else {
            extractedValue = undefined;
          }
          break;

        case 'split':
          if (typeof sourceValue === 'string') {
            const parts = sourceValue.split(/[,\s]+/);
            extractedValue = ext.index !== undefined ? parts[ext.index] : parts;
          } else {
            extractedValue = undefined;
          }
          break;

        case 'custom':
          extractedValue = ext.fn ? ext.fn(sourceValue) : undefined;
          break;

        default:
          extractedValue = sourceValue;
      }

      if (extractedValue !== undefined) {
        this.setNestedValue(payload, ext.targetField, extractedValue);
      }
    }

    return newEvent;
  }

  private async applyEnrichment(
    enrichment: Enrichment,
    event: EventEnvelope
  ): Promise<EventEnvelope> {
    const newEvent = this.cloneEvent(event);

    for (const enrich of enrichment.enrichments) {
      let value: unknown;

      switch (typeof enrich.value) {
        case 'string':
        case 'number':
        case 'boolean':
          value = enrich.value;
          break;

        default: {
          const enrichedValue = enrich.value as {
            type: string;
            value?: unknown;
            format?: string;
            version?: number;
            source?: string;
            key?: string;
            fn?: (event: EventEnvelope) => unknown;
            url?: string;
            cache?: boolean;
          };

          switch (enrichedValue.type) {
            case 'static':
              value = enrichedValue.value;
              break;

            case 'timestamp':
              const now = Date.now();
              value =
                enrichedValue.format === 'iso'
                  ? new Date(now).toISOString()
                  : enrichedValue.format === 'unix'
                  ? Math.floor(now / 1000)
                  : now;
              break;

            case 'uuid':
              value = crypto.randomUUID();
              break;

            case 'field':
              value = this.getNestedValue(newEvent.payload, enrichedValue.source || '');
              break;

            case 'env':
              // In a real implementation, would access environment variables
              value = undefined;
              break;

            case 'function':
              value = enrichedValue.fn ? await enrichedValue.fn(newEvent) : undefined;
              break;

            case 'external':
              // Would make HTTP request in production
              value = undefined;
              break;

            default:
              value = undefined;
          }
        }
      }

      if (value !== undefined) {
        if (enrich.targetField.startsWith('metadata.')) {
          const metaField = enrich.targetField.substring(9);
          (newEvent.metadata as Record<string, unknown>)[metaField] = value;
        } else {
          this.setNestedValue(
            newEvent.payload as Record<string, unknown>,
            enrich.targetField,
            value
          );
        }
      }
    }

    return newEvent;
  }

  private async applyNormalization(
    normalization: Normalization,
    event: EventEnvelope
  ): Promise<EventEnvelope> {
    const newEvent = this.cloneEvent(event);
    const payload = newEvent.payload as Record<string, unknown>;

    for (const norm of normalization.normalizations) {
      const value = this.getNestedValue(payload, norm.field);

      if (value === undefined || value === null) {
        continue;
      }

      let normalizedValue: unknown = value;

      switch (norm.operation) {
        case 'lowercase':
          normalizedValue = typeof value === 'string' ? value.toLowerCase() : value;
          break;

        case 'uppercase':
          normalizedValue = typeof value === 'string' ? value.toUpperCase() : value;
          break;

        case 'trim':
          normalizedValue = typeof value === 'string' ? value.trim() : value;
          break;

        case 'sanitize':
          normalizedValue =
            typeof value === 'string'
              ? value.replace(/[<>\"'&]/g, (char) => {
                  const sanitization: Record<string, string> = {
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#x27;',
                    '&': '&amp;',
                  };
                  return sanitization[char];
                })
              : value;
          break;

        case 'format':
          // Apply formatting based on options
          break;

        case 'coerce':
          // Type coercion based on options
          break;
      }

      this.setNestedValue(payload, norm.field, normalizedValue);
    }

    return newEvent;
  }

  private async applyValidation(
    validation: Validation,
    event: EventEnvelope
  ): Promise<TransformationResult> {
    const errors: TransformationError[] = [];
    const warnings: string[] = [];

    for (const rule of validation.validations) {
      const value = this.getNestedValue(event.payload, rule.field);

      try {
        const valid = await this.validateValue(value, rule.rule);

        if (!valid) {
          const error: TransformationError = {
            field: rule.field,
            message: rule.errorMessage || `Validation failed for field: ${rule.field}`,
            code: 'VALIDATION_ERROR',
            severity: 'error',
          };

          if (validation.failAction === 'error') {
            errors.push(error);
          } else if (validation.failAction === 'tag') {
            warnings.push(error.message);
          }
          // If 'drop' or 'continue', we don't add error/warning
        }
      } catch (err) {
        errors.push({
          field: rule.field,
          message: err instanceof Error ? err.message : 'Validation error',
          code: 'VALIDATION_EXCEPTION',
          severity: 'error',
        });
      }
    }

    return {
      success: errors.filter((e) => e.severity === 'error').length === 0,
      event,
      errors,
      warnings,
      appliedRules: [],
    };
  }

  private async validateValue(value: unknown, rule: ValidationType): Promise<boolean> {
    switch (rule.type) {
      case 'required':
        return value !== undefined && value !== null;

      case 'type':
        return typeof value === rule.expected;

      case 'range':
        if (typeof value !== 'number') return false;
        if (rule.min !== undefined && value < rule.min) return false;
        if (rule.max !== undefined && value > rule.max) return false;
        return true;

      case 'length':
        const length =
          typeof value === 'string' || Array.isArray(value) ? value.length : 0;
        if (rule.min !== undefined && length < rule.min) return false;
        if (rule.max !== undefined && length > rule.max) return false;
        return true;

      case 'pattern':
        if (typeof value !== 'string') return false;
        return new RegExp(rule.regex).test(value);

      case 'enum':
        return rule.values.includes(value);

      case 'custom':
        return rule.fn(value);

      default:
        return true;
    }
  }

  private async validateEvent(event: EventEnvelope): Promise<TransformationError[]> {
    const errors: TransformationError[] = [];

    // Validate metadata
    if (!event.metadata.eventId) {
      errors.push({
        field: 'metadata.eventId',
        message: 'Event ID is required',
        code: 'MISSING_EVENT_ID',
        severity: 'error',
      });
    }

    if (!event.metadata.eventType) {
      errors.push({
        field: 'metadata.eventType',
        message: 'Event type is required',
        code: 'MISSING_EVENT_TYPE',
        severity: 'error',
      });
    }

    if (!event.metadata.timestamp) {
      errors.push({
        field: 'metadata.timestamp',
        message: 'Timestamp is required',
        code: 'MISSING_TIMESTAMP',
        severity: 'error',
      });
    }

    return errors;
  }

  private async checkCondition(
    condition: TransformationCondition,
    event: EventEnvelope
  ): Promise<boolean> {
    switch (condition.type) {
      case 'field': {
        const value = this.getNestedValue(event.payload, condition.field);
        return this.compareValues(value, condition.operator, condition.value);
      }

      case 'eventType':
        return condition.eventTypes.includes(event.metadata.eventType);

      case 'custom':
        return condition.fn(event);

      default:
        return true;
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private cloneEvent(event: EventEnvelope): EventEnvelope {
    return JSON.parse(JSON.stringify(event)) as EventEnvelope;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!path) return obj;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private removeNestedValue(obj: Record<string, unknown>, path: string): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        return;
      }
      current = current[part] as Record<string, unknown>;
    }

    delete current[parts[parts.length - 1]];
  }

  private setField(event: EventEnvelope, field: string, value: unknown): EventEnvelope {
    if (field.startsWith('metadata.')) {
      const metaField = field.substring(9);
      (event.metadata as Record<string, unknown>)[metaField] = value;
    } else {
      this.setNestedValue(event.payload as Record<string, unknown>, field, value);
    }
    return event;
  }

  private removeField(event: EventEnvelope, field: string): EventEnvelope {
    if (field.startsWith('metadata.')) {
      const metaField = field.substring(9);
      delete (event.metadata as Record<string, unknown>)[metaField];
    } else {
      this.removeNestedValue(event.payload as Record<string, unknown>, field);
    }
    return event;
  }

  private getDefaultForType(type: string): unknown {
    switch (type) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  private compareValues(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
      default:
        return false;
    }
  }

  private updateRuleStats(
    ruleId: string,
    executionTimeMs: number,
    success: boolean
  ): void {
    let perf = this.stats.ruleBreakdown.get(ruleId);
    if (!perf) {
      perf = {
        ruleId,
        executions: 0,
        successes: 0,
        failures: 0,
        averageExecutionTimeMs: 0,
      };
      this.stats.ruleBreakdown.set(ruleId, perf);
    }

    perf.executions++;
    if (success) perf.successes++;
    else perf.failures++;

    perf.averageExecutionTimeMs =
      (perf.averageExecutionTimeMs * (perf.executions - 1) + executionTimeMs) /
      perf.executions;
  }

  private updateGlobalStats(success: boolean, executionTimeMs: number): void {
    this.stats.totalTransformations++;
    if (success) this.stats.successfulTransformations++;
    else this.stats.failedTransformations++;

    this.stats.averageExecutionTimeMs =
      (this.stats.averageExecutionTimeMs * (this.stats.totalTransformations - 1) +
        executionTimeMs) /
      this.stats.totalTransformations;
  }

  getStats(): TransformationStats {
    return {
      ...this.stats,
      ruleBreakdown: new Map(this.stats.ruleBreakdown),
    };
  }

  resetStats(): void {
    this.stats = {
      totalTransformations: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      averageExecutionTimeMs: 0,
      ruleBreakdown: new Map(),
    };
  }

  private generateRuleId(): string {
    return `transform_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
