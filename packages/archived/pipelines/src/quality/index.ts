// @ts-nocheck
/**
 * Data Quality Module
 * Data quality validation and anomaly detection
 */

export {
  DataQualityValidator,
  type ValidationResult,
  type QualityViolation,
  type QualityScore
} from './validator';

export {
  AnomalyDetectionEngine,
  DataProfiler,
  type AnomalyDetectionResult,
  type ProfileResult,
  type FieldProfile,
  type NumberStatistics,
  type StringStatistics,
  type SummaryStatistics
} from './anomaly';

import type { QualityConfig, QualityRule, AnomalyDetector } from '../types';

// ============================================================================
// Quality Manager
// ============================================================================

/**
 * Manages data quality operations
 */
export class QualityManager {
  private config: QualityConfig;
  private quarantine: QuarantineStore;

  constructor(config: QualityConfig) {
    this.config = config;
    this.quarantine = new QuarantineStore();
  }

  /**
   * Validate and process records
   */
  async process(records: unknown[]): Promise<QualityProcessResult> {
    const validator = new DataQualityValidator(this.config);
    const results = await validator.validateRecords(records);

    const valid: unknown[] = [];
    const invalid: unknown[] = [];
    const quarantined: unknown[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordResults = results.filter(r => r.ruleId.includes(`record-${i}`));

      const hasErrors = recordResults.some(r => r.severity === 'error');

      if (hasErrors) {
        const action = this.determineAction(recordResults);

        switch (action) {
          case 'drop':
            // Don't include in output
            break;

          case 'quarantine':
            await this.quarantine.add(record, recordResults);
            quarantined.push(record);
            break;

          default:
            invalid.push(record);
        }
      } else {
        valid.push(record);
      }
    }

    return {
      valid,
      invalid,
      quarantined,
      validationResults: results
    };
  }

  /**
   * Get quality metrics
   */
  getMetrics(results: any[]): QualityMetrics {
    const total = results.length;
    const errors = results.filter(r => r.severity === 'error').length;
    const warnings = results.filter(r => r.severity === 'warning').length;
    const valid = total - errors - warnings;

    return {
      totalRecords: total,
      validRecords: valid,
      errorRecords: errors,
      warningRecords: warnings,
      qualityScore: total > 0 ? (valid / total) * 100 : 0
    };
  }

  /**
   * Determine action based on validation results
   */
  private determineAction(results: any[]): string {
    for (const result of results) {
      if (result.severity === 'error') {
        return this.config.actions[0] || 'drop';
      }
    }
    return 'pass';
  }
}

/**
 * Quarantine store for invalid records
 */
class QuarantineStore {
  private store: Map<string, QuarantinedRecord[]> = new Map();

  /**
   * Add record to quarantine
   */
  async add(record: unknown, violations: any[]): Promise<void> {
    const quarantined: QuarantinedRecord = {
      record,
      violations,
      timestamp: new Date()
    };

    const key = this.generateKey(record);

    if (!this.store.has(key)) {
      this.store.set(key, []);
    }

    this.store.get(key)!.push(quarantined);
  }

  /**
   * Get quarantined records
   */
  get(key: string): QuarantinedRecord[] {
    return this.store.get(key) || [];
  }

  /**
   * Get all quarantined records
   */
  getAll(): Map<string, QuarantinedRecord[]> {
    return this.store;
  }

  /**
   * Release quarantined records
   */
  release(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all quarantined records
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Generate key for record
   */
  private generateKey(record: unknown): string {
    if (typeof record === 'object' && record !== null) {
      const obj = record as Record<string, unknown>;

      for (const field of ['id', '_id', 'uuid']) {
        if (typeof obj[field] === 'string') {
          return obj[field] as string;
        }
      }
    }

    return `quarantine-${Date.now()}-${Math.random()}`;
  }
}

/**
 * Quarantined record
 */
interface QuarantinedRecord {
  record: unknown;
  violations: any[];
  timestamp: Date;
}

/**
 * Quality process result
 */
export interface QualityProcessResult {
  valid: unknown[];
  invalid: unknown[];
  quarantined: unknown[];
  validationResults: any[];
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  warningRecords: number;
  qualityScore: number;
}

// ============================================================================
// Quality Rule Builders
// ============================================================================

/**
 * Builder for quality rules
 */
export class QualityRuleBuilder {
  private rule: Partial<QualityRule> = {
    severity: 'error'
  };

  /**
   * Set rule ID
   */
  id(id: string): QualityRuleBuilder {
    this.rule.id = id;
    return this;
  }

  /**
   * Set rule name
   */
  name(name: string): QualityRuleBuilder {
    this.rule.name = name;
    return this;
  }

  /**
   * Set rule type
   */
  type(type: QualityRule['type']): QualityRuleBuilder {
    this.rule.type = type;
    return this;
  }

  /**
   * Set field to validate
   */
  field(field: string): QualityRuleBuilder {
    if (!this.rule.config) {
      this.rule.config = {};
    }
    this.rule.config.field = field;
    return this;
  }

  /**
   * Set threshold
   */
  threshold(threshold: number): QualityRuleBuilder {
    if (!this.rule.config) {
      this.rule.config = {};
    }
    this.rule.config.threshold = threshold;
    return this;
  }

  /**
   * Set severity
   */
  severity(severity: 'error' | 'warning' | 'info'): QualityRuleBuilder {
    this.rule.severity = severity;
    return this;
  }

  /**
   * Add custom configuration
   */
  custom(custom: Record<string, unknown>): QualityRuleBuilder {
    if (!this.rule.config) {
      this.rule.config = {};
    }
    this.rule.config.custom = custom;
    return this;
  }

  /**
   * Build rule
   */
  build(): QualityRule {
    if (!this.rule.id) {
      throw new Error('Rule ID is required');
    }

    if (!this.rule.name) {
      this.rule.name = this.rule.id;
    }

    if (!this.rule.type) {
      throw new Error('Rule type is required');
    }

    return this.rule as QualityRule;
  }
}

/**
 * Create a new quality rule builder
 */
export function qualityRule(): QualityRuleBuilder {
  return new QualityRuleBuilder();
}

/**
 * Create predefined quality rules
 */
export class PredefinedRules {
  /**
   * Schema validation rule
   */
  static schemaValidation(schema: any): QualityRule {
    return qualityRule()
      .id('schema-validation')
      .name('Schema Validation')
      .type('schema-validation')
      .custom({ schema })
      .build();
  }

  /**
   * Required field rule
   */
  static requiredField(field: string): QualityRule {
    return qualityRule()
      .id(`required-${field}`)
      .name(`Required Field: ${field}`)
      .type('completeness')
      .field(field)
      .severity('error')
      .build();
  }

  /**
   * Non-null rule
   */
  static nonNull(field: string): QualityRule {
    return qualityRule()
      .id(`not-null-${field}`)
      .name(`Not Null: ${field}`)
      .type('completeness')
      .field(field)
      .severity('error')
      .build();
  }

  /**
   * Range validation rule
   */
  static range(field: string, min: number, max: number): QualityRule {
    return qualityRule()
      .id(`range-${field}`)
      .name(`Range Validation: ${field}`)
      .type('accuracy')
      .field(field)
      .custom({ min, max })
      .build();
  }

  /**
   * Positive number rule
   */
  static positive(field: string): QualityRule {
    return qualityRule()
      .id(`positive-${field}`)
      .name(`Positive Number: ${field}`)
      .type('accuracy')
      .field(field)
      .custom({ min: 0 })
      .build();
  }

  /**
   * Email format rule
   */
  static email(field: string): QualityRule {
    return qualityRule()
      .id(`email-${field}`)
      .name(`Email Format: ${field}`)
      .type('accuracy')
      .field(field)
      .custom({
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
      })
      .build();
  }

  /**
   * Unique field rule
   */
  static unique(field: string): QualityRule {
    return qualityRule()
      .id(`unique-${field}`)
      .name(`Unique Field: ${field}`)
      .type('uniqueness')
      .field(field)
      .severity('error')
      .build();
  }

  /**
   * Timeliness rule (max age)
   */
  static timeliness(field: string, maxAge: number): QualityRule {
    return qualityRule()
      .id(`timeliness-${field}`)
      .name(`Timeliness: ${field}`)
      .type('timeliness')
      .field(field)
      .custom({ maxAge })
      .build();
  }

  /**
   * Future date rule
   */
  static noFutureDates(field: string): QualityRule {
    return qualityRule()
      .id(`no-future-${field}`)
      .name(`No Future Dates: ${field}`)
      .type('timeliness')
      .field(field)
      .custom({ allowFuture: false })
      .build();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create quality configuration
 */
export function createQualityConfig(rules: QualityRule[], actions: string[] = ['drop']): QualityConfig {
  return {
    enabled: true,
    rules,
    actions: actions as any
  };
}

/**
 * Validate data quality
 */
export async function validateQuality(
  data: unknown[],
  config: QualityConfig
): Promise<QualityProcessResult> {
  const manager = new QualityManager(config);
  return manager.process(data);
}

/**
 * Profile data
 */
export function profileData(data: unknown[]): ProfileResult {
  const profiler = new DataProfiler();
  return profiler.profile(data);
}
