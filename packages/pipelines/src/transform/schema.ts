// @ts-nocheck
/**
 * Schema Evolution and Validation
 * Handles schema evolution, migration, and compatibility
 */

import type { DataSchema, JsonObject } from '../types';

// ============================================================================
// Schema Registry
// ============================================================================

export class SchemaRegistry {
  private schemas: Map<string, SchemaEntry> = new Map();
  private versions: Map<string, Map<string, DataSchema>> = new Map();

  /**
   * Register a schema
   */
  register(schema: DataSchema): void {
    const id = this.generateSchemaId(schema);

    const entry: SchemaEntry = {
      id,
      schema,
      version: schema.version || '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.schemas.set(id, entry);

    // Add to version map
    if (!this.versions.has(id)) {
      this.versions.set(id, new Map());
    }

    this.versions.get(id)!.set(entry.version, schema);
  }

  /**
   * Get schema by ID
   */
  get(id: string, version?: string): DataSchema | undefined {
    if (version) {
      const versions = this.versions.get(id);
      return versions?.get(version);
    }

    const entry = this.schemas.get(id);
    return entry?.schema;
  }

  /**
   * Get all versions of a schema
   */
  getAllVersions(id: string): DataSchema[] {
    const versions = this.versions.get(id);
    return versions ? Array.from(versions.values()) : [];
  }

  /**
   * Get latest schema version
   */
  getLatest(id: string): DataSchema | undefined {
    const versions = this.getAllVersions(id);
    if (versions.length === 0) {
      return undefined;
    }

    // Sort by version and return latest
    return versions.sort((a, b) => {
      const aVer = a.version || '0.0.0';
      const bVer = b.version || '0.0.0';
      return bVer.localeCompare(aVer, undefined, { numeric: true });
    })[0];
  }

  /**
   * Check schema compatibility
   */
  isCompatible(from: string, to: string, compatibility: CompatibilityMode = 'backward'): boolean {
    const fromSchema = this.get(from);
    const toSchema = this.get(to);

    if (!fromSchema || !toSchema) {
      return false;
    }

    return this.checkCompatibility(fromSchema, toSchema, compatibility);
  }

  /**
   * Generate schema migration
   */
  generateMigration(from: string, to: string): SchemaMigration {
    const fromSchema = this.get(from);
    const toSchema = this.get(to);

    if (!fromSchema || !toSchema) {
      throw new Error('Schema not found');
    }

    const changes = this.diffSchemas(fromSchema, toSchema);

    return {
      from,
      to,
      changes,
      migrationSteps: this.generateMigrationSteps(changes)
    };
  }

  /**
   * Generate schema ID
   */
  private generateSchemaId(schema: DataSchema): string {
    // In a real implementation, this would hash the schema definition
    return `schema-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check schema compatibility
   */
  private checkCompatibility(
    from: DataSchema,
    to: DataSchema,
    mode: CompatibilityMode
  ): boolean {
    const fromDef = from.definition as JsonObject;
    const toDef = to.definition as JsonObject;

    switch (mode) {
      case 'backward':
        return this.isBackwardCompatible(fromDef, toDef);

      case 'forward':
        return this.isBackwardCompatible(toDef, fromDef);

      case 'full':
        return (
          this.isBackwardCompatible(fromDef, toDef) &&
          this.isBackwardCompatible(toDef, fromDef)
        );

      case 'none':
        return true;

      default:
        return false;
    }
  }

  /**
   * Check backward compatibility
   */
  private isBackwardCompatible(from: JsonObject, to: JsonObject): boolean {
    // For JSON Schema, backward compatibility means:
    // - No required fields are removed
    // - No field types are changed in incompatible ways
    // - Optional fields can be added

    if (!from.properties || !to.properties) {
      return true;
    }

    const fromRequired = new Set(from.required || []);
    const toRequired = new Set(to.required || []);

    // Check that all required fields still exist
    for (const field of fromRequired) {
      if (!to.properties[field]) {
        return false;
      }
    }

    // Check field type compatibility
    for (const [field, fromDef] of Object.entries(from.properties)) {
      const toDef = to.properties[field];

      if (!toDef) {
        // Field was removed - only OK if it wasn't required
        if (fromRequired.has(field)) {
          return false;
        }
        continue;
      }

      // Check types
      if (typeof fromDef === 'object' && typeof toDef === 'object') {
        const fromType = (fromDef as JsonObject).type;
        const toType = (toDef as JsonObject).type;

        if (fromType !== toType) {
          // Type changes are generally not backward compatible
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Diff two schemas
   */
  private diffSchemas(from: DataSchema, to: DataSchema): SchemaChange[] {
    const changes: SchemaChange[] = [];

    const fromDef = from.definition as JsonObject;
    const toDef = to.definition as JsonObject;

    const fromProps = fromDef.properties || {};
    const toProps = toDef.properties || {};

    // Check for added fields
    for (const [name, def] of Object.entries(toProps)) {
      if (!fromProps[name]) {
        changes.push({
          type: 'field-added',
          field: name,
          definition: def
        });
      }
    }

    // Check for removed fields
    for (const [name, def] of Object.entries(fromProps)) {
      if (!toProps[name]) {
        changes.push({
          type: 'field-removed',
          field: name,
          definition: def
        });
      }
    }

    // Check for modified fields
    for (const [name, fromDef] of Object.entries(fromProps)) {
      const toDef = toProps[name];

      if (toDef && JSON.stringify(fromDef) !== JSON.stringify(toDef)) {
        changes.push({
          type: 'field-modified',
          field: name,
          fromDefinition: fromDef,
          toDefinition: toDef
        });
      }
    }

    return changes;
  }

  /**
   * Generate migration steps from schema changes
   */
  private generateMigrationSteps(changes: SchemaChange[]): MigrationStep[] {
    const steps: MigrationStep[] = [];

    for (const change of changes) {
      switch (change.type) {
        case 'field-added':
          steps.push({
            type: 'add-field',
            field: change.field,
            defaultValue: null
          });
          break;

        case 'field-removed':
          steps.push({
            type: 'remove-field',
            field: change.field
          });
          break;

        case 'field-modified':
          steps.push({
            type: 'transform-field',
            field: change.field,
            transform: 'coerce'
          });
          break;
      }
    }

    return steps;
  }
}

// ============================================================================
// Schema Migrator
// ============================================================================

export class SchemaMigrator {
  private registry: SchemaRegistry;

  constructor(registry: SchemaRegistry) {
    this.registry = registry;
  }

  /**
   * Migrate data from one schema version to another
   */
  migrate(data: unknown, from: string, to: string): unknown {
    const migration = this.registry.generateMigration(from, to);

    let result = data;

    for (const step of migration.migrationSteps) {
      result = this.applyMigrationStep(result, step);
    }

    return result;
  }

  /**
   * Migrate array of records
   */
  migrateArray(data: unknown[], from: string, to: string): unknown[] {
    return data.map(record => this.migrate(record, from, to));
  }

  /**
   * Apply migration step to data
   */
  private applyMigrationStep(data: unknown, step: MigrationStep): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const obj = { ...data } as Record<string, unknown>;

    switch (step.type) {
      case 'add-field':
        if (step.defaultValue !== undefined) {
          obj[step.field] = step.defaultValue;
        }
        break;

      case 'remove-field':
        delete obj[step.field];
        break;

      case 'rename-field':
        if (step.oldField in obj) {
          obj[step.newField] = obj[step.oldField];
          delete obj[step.oldField];
        }
        break;

      case 'transform-field':
        if (step.field in obj) {
          obj[step.field] = this.transformValue(obj[step.field], step);
        }
        break;
    }

    return obj;
  }

  /**
   * Transform value based on step configuration
   */
  private transformValue(value: unknown, step: MigrationStep): unknown {
    if (step.transform === 'coerce') {
      // Attempt to coerce value to new type
      if (step.toType === 'string') {
        return String(value);
      } else if (step.toType === 'number') {
        return Number(value);
      } else if (step.toType === 'boolean') {
        return Boolean(value);
      }
    }

    return value;
  }
}

// ============================================================================
// Schema Validator
// ============================================================================

export class SchemaValidator {
  private registry: SchemaRegistry;

  constructor(registry: SchemaRegistry) {
    this.registry = registry;
  }

  /**
   * Validate data against schema
   */
  validate(data: unknown, schemaId: string, version?: string): ValidationResult {
    const schema = this.registry.get(schemaId, version);

    if (!schema) {
      return {
        valid: false,
        errors: [`Schema not found: ${schemaId}${version ? `@${version}` : ''}`]
      };
    }

    return this.validateAgainstSchema(data, schema);
  }

  /**
   * Validate array of records
   */
  validateArray(data: unknown[], schemaId: string, version?: string): ValidationResult {
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const result = this.validate(data[i], schemaId, version);

      if (!result.valid) {
        errors.push(`Record ${i}: ${result.errors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate data against schema definition
   */
  private validateAgainstSchema(data: unknown, schema: DataSchema): ValidationResult {
    const errors: string[] = [];

    if (schema.type === 'json-schema') {
      return this.validateJSONSchema(data, schema.definition as JsonObject);
    }

    // For other schema types, return valid (placeholder)
    return { valid: true, errors: [] };
  }

  /**
   * Validate against JSON Schema
   */
  private validateJSONSchema(data: unknown, schema: JsonObject): ValidationResult {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        errors: ['Data must be an object']
      };
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    const required = schema.required || [];
    for (const field of required) {
      if (!(field in obj)) {
        errors.push(`Required field missing: ${field}`);
      }
    }

    // Check field types
    const properties = schema.properties || {};
    for (const [field, def] of Object.entries(properties)) {
      if (field in obj) {
        const value = obj[field];
        const fieldDef = def as JsonObject;
        const expectedType = fieldDef.type;

        if (!this.checkType(value, expectedType as string)) {
          errors.push(`Field ${field} has invalid type: expected ${expectedType}`);
        }

        // Check enum values
        if (fieldDef.enum && Array.isArray(fieldDef.enum)) {
          if (!fieldDef.enum.includes(value)) {
            errors.push(`Field ${field} has invalid value: must be one of ${fieldDef.enum.join(', ')}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if value matches type
   */
  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        return typeof value === 'number';

      case 'integer':
        return Number.isInteger(value);

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

// ============================================================================
// Types
// ============================================================================

type CompatibilityMode = 'backward' | 'forward' | 'full' | 'none';

interface SchemaEntry {
  id: string;
  schema: DataSchema;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchemaMigration {
  from: string;
  to: string;
  changes: SchemaChange[];
  migrationSteps: MigrationStep[];
}

export interface SchemaChange {
  type: 'field-added' | 'field-removed' | 'field-modified' | 'type-changed';
  field?: string;
  definition?: unknown;
  fromDefinition?: unknown;
  toDefinition?: unknown;
}

export interface MigrationStep {
  type: 'add-field' | 'remove-field' | 'rename-field' | 'transform-field';
  field?: string;
  oldField?: string;
  newField?: string;
  defaultValue?: unknown;
  transform?: 'coerce' | 'cast' | 'parse';
  toType?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new schema registry
 */
export function createSchemaRegistry(): SchemaRegistry {
  return new SchemaRegistry();
}

/**
 * Create a schema migrator
 */
export function createSchemaMigrator(registry: SchemaRegistry): SchemaMigrator {
  return new SchemaMigrator(registry);
}

/**
 * Create a schema validator
 */
export function createSchemaValidator(registry: SchemaRegistry): SchemaValidator {
  return new SchemaValidator(registry);
}
