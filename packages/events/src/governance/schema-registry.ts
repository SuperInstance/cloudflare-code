/**
 * Event Schema Registry implementation
 */

import type {
  EventSchemaDefinition,
  ValidationResult,
  EvolutionStrategy,
  GovernancePolicy,
  EventCatalog,
  EventExample,
} from '../types';
import { z } from 'zod';
import { validateEvent } from '../utils/validation';

// ============================================================================
// Schema Registry State
// ============================================================================

interface SchemaRegistryState {
  schemas: Record<string, EventSchemaDefinition>;
  catalogs: Record<string, EventCatalog>;
  policies: Record<string, GovernancePolicy>;
  validationCache: Record<string, ValidationResult>;
}

// ============================================================================
// Schema Registry Durable Object
// ============================================================================

export interface SchemaRegistryEnv {
  R2_BUCKET: R2Bucket;
}

export class SchemaRegistryDurableObject implements DurableObject {
  private state: SchemaRegistryState;

  constructor(
    private durableObjectState: DurableObjectState,
    private env: SchemaRegistryEnv
  ) {
    this.state = {
      schemas: {},
      catalogs: {},
      policies: {},
      validationCache: {},
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const saved = await this.durableObjectState.storage.get<SchemaRegistryState>('state');

    if (saved) {
      this.state = saved;
    }
  }

  private async save(): Promise<void> {
    await this.durableObjectState.storage.put('state', this.state);
  }

  // ============================================================================
  // Schema Management
  // ============================================================================

  async registerSchema(schema: Omit<EventSchemaDefinition, 'schemaId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const schemaId = `${schema.eventType}_v${schema.version}`;

    const schemaDefinition: EventSchemaDefinition = {
      ...schema,
      schemaId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.state.schemas[schemaId] = schemaDefinition;

    // Create or update catalog entry
    if (!this.state.catalogs[schema.eventType]) {
      this.state.catalogs[schema.eventType] = {
        eventType: schema.eventType,
        name: schema.eventType,
        description: '',
        owner: 'system',
        schemaId,
        currentVersion: schema.version,
        producers: [],
        consumers: [],
        tags: [],
        examples: [],
        governance: {},
      };
    } else {
      this.state.catalogs[schema.eventType].currentVersion = Math.max(
        this.state.catalogs[schema.eventType].currentVersion,
        schema.version
      );
      this.state.catalogs[schema.eventType].schemaId = schemaId;
    }

    await this.save();
    return schemaId;
  }

  async getSchema(eventType: string, version?: number): Promise<EventSchemaDefinition | null> {
    if (version) {
      const schemaId = `${eventType}_v${version}`;
      return this.state.schemas[schemaId] ?? null;
    }

    // Get latest version
    const catalog = this.state.catalogs[eventType];
    if (!catalog) {
      return null;
    }

    return this.state.schemas[catalog.schemaId] ?? null;
  }

  async listSchemas(eventType?: string): Promise<EventSchemaDefinition[]> {
    const schemas = Object.values(this.state.schemas);

    if (eventType) {
      return schemas.filter((s) => s.eventType === eventType);
    }

    return schemas;
  }

  async deleteSchema(eventType: string, version: number): Promise<void> {
    const schemaId = `${eventType}_v${version}`;
    delete this.state.schemas[schemaId];
    await this.save();
  }

  // ============================================================================
  // Schema Evolution
  // ============================================================================

  async evolveSchema(
    eventType: string,
    newSchema: unknown,
    strategy: EvolutionStrategy
  ): Promise<number> {
    const catalog = this.state.catalogs[eventType];
    if (!catalog) {
      throw new Error(`Event type not found: ${eventType}`);
    }

    const currentSchema = this.state.schemas[catalog.schemaId];
    if (!currentSchema) {
      throw new Error(`Current schema not found for: ${eventType}`);
    }

    const newVersion = currentSchema.version + 1;

    // Validate compatibility
    const compatibilityCheck = this.checkCompatibility(
      currentSchema.schema,
      newSchema,
      strategy
    );

    if (!compatibilityCheck.compatible) {
      throw new Error(
        `Schema evolution violates ${strategy} compatibility: ${compatibilityCheck.reason}`
      );
    }

    // Register new schema
    await this.registerSchema({
      eventType,
      version: newVersion,
      schema: newSchema,
      compatibility: currentSchema.compatibility,
      deprecated: false,
    });

    return newVersion;
  }

  private checkCompatibility(
    oldSchema: unknown,
    newSchema: unknown,
    strategy: EvolutionStrategy
  ): { compatible: boolean; reason?: string } {
    // Simplified compatibility check
    // In production, use a proper schema diffing library

    const oldFields = new Set(Object.keys(oldSchema as Record<string, unknown>));
    const newFields = new Set(Object.keys(newSchema as Record<string, unknown>));

    switch (strategy) {
      case 'backward-compatible':
        // Consumers using new schema can read old data
        // Cannot remove fields
        for (const field of oldFields) {
          if (!newFields.has(field)) {
            return {
              compatible: false,
              reason: `Field '${field}' was removed`,
            };
          }
        }
        return { compatible: true };

      case 'forward-compatible':
        // Consumers using old schema can read new data
        // New fields must have defaults
        for (const field of newFields) {
          if (!oldFields.has(field)) {
            // Check if field has default (simplified)
            return { compatible: true };
          }
        }
        return { compatible: true };

      case 'full-compatible':
        // Both backward and forward compatible
        return this.checkCompatibility(oldSchema, newSchema, 'backward-compatible') &&
          this.checkCompatibility(oldSchema, newSchema, 'forward-compatible')
          ? { compatible: true }
          : { compatible: false, reason: 'Not fully compatible' };

      case 'breaking-change':
        // Allow any changes
        return { compatible: true };

      default:
        return { compatible: false, reason: 'Unknown strategy' };
    }
  }

  // ============================================================================
  // Event Validation
  // ============================================================================

  async validateEvent(
    eventType: string,
    version: number,
    payload: unknown
  ): Promise<ValidationResult> {
    const cacheKey = `${eventType}_v${version}_${JSON.stringify(payload)}`;

    if (this.state.validationCache[cacheKey]) {
      return this.state.validationCache[cacheKey];
    }

    const schema = await this.getSchema(eventType, version);
    if (!schema) {
      return {
        valid: false,
        errors: [
          {
            field: 'schema',
            message: `Schema not found for ${eventType} v${version}`,
            code: 'schema_not_found',
            severity: 'error',
          },
        ],
        warnings: [],
        timestamp: Date.now(),
      };
    }

    // Create Zod schema from JSON schema (simplified)
    const zodSchema = this.createZodSchema(schema.schema);

    const result = validateEvent(
      {
        metadata: {
          eventId: 'validation',
          eventType,
          timestamp: Date.now(),
          version,
          source: 'validation',
        },
        payload,
      },
      zodSchema
    );

    // Cache result
    this.state.validationCache[cacheKey] = result;
    await this.save();

    return result;
  }

  private createZodSchema(jsonSchema: unknown): z.ZodTypeAny {
    // Simplified conversion from JSON Schema to Zod
    // In production, use a proper converter library

    if (typeof jsonSchema === 'object' && jsonSchema !== null) {
      const schema = jsonSchema as Record<string, unknown>;

      if (schema.type === 'string') {
        return z.string();
      }
      if (schema.type === 'number') {
        return z.number();
      }
      if (schema.type === 'boolean') {
        return z.boolean();
      }
      if (schema.type === 'array') {
        return z.array(z.any());
      }
      if (schema.type === 'object') {
        return z.object({});
      }
    }

    return z.any();
  }

  // ============================================================================
  // Event Catalog
  // ============================================================================

  async createCatalog(catalog: Omit<EventCatalog, 'eventType'>): Promise<void> {
    const eventType = catalog.name;

    this.state.catalogs[eventType] = {
      ...catalog,
      eventType,
    };

    await this.save();
  }

  async getCatalog(eventType: string): Promise<EventCatalog | null> {
    return this.state.catalogs[eventType] ?? null;
  }

  async listCatalogs(): Promise<EventCatalog[]> {
    return Object.values(this.state.catalogs);
  }

  async updateCatalog(
    eventType: string,
    updates: Partial<Omit<EventCatalog, 'eventType'>>
  ): Promise<void> {
    const catalog = this.state.catalogs[eventType];
    if (!catalog) {
      throw new Error(`Catalog not found: ${eventType}`);
    }

    this.state.catalogs[eventType] = {
      ...catalog,
      ...updates,
    };

    await this.save();
  }

  async deleteCatalog(eventType: string): Promise<void> {
    delete this.state.catalogs[eventType];
    await this.save();
  }

  // ============================================================================
  // Event Examples
  // ============================================================================

  async addExample(eventType: string, example: EventExample): Promise<void> {
    const catalog = this.state.catalogs[eventType];
    if (!catalog) {
      throw new Error(`Catalog not found: ${eventType}`);
    }

    catalog.examples.push(example);
    await this.save();
  }

  async getExamples(eventType: string): Promise<EventExample[]> {
    const catalog = this.state.catalogs[eventType];
    return catalog?.examples ?? [];
  }

  async deleteExample(eventType: string, exampleName: string): Promise<void> {
    const catalog = this.state.catalogs[eventType];
    if (!catalog) {
      return;
    }

    catalog.examples = catalog.examples.filter((e) => e.name !== exampleName);
    await this.save();
  }

  // ============================================================================
  // Governance Policies
  // ============================================================================

  async createPolicy(policy: Omit<GovernancePolicy, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const governancePolicy: GovernancePolicy = {
      ...policy,
      policyId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.state.policies[policyId] = governancePolicy;
    await this.save();

    return policyId;
  }

  async getPolicy(policyId: string): Promise<GovernancePolicy | null> {
    return this.state.policies[policyId] ?? null;
  }

  async listPolicies(eventType?: string): Promise<GovernancePolicy[]> {
    const policies = Object.values(this.state.policies);

    if (eventType) {
      return policies.filter((p) => {
        // Filter policies that apply to this event type
        // This is simplified - implement proper filtering based on your needs
        return true;
      });
    }

    return policies;
  }

  async updatePolicy(
    policyId: string,
    updates: Partial<Omit<GovernancePolicy, 'policyId' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const policy = this.state.policies[policyId];
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    this.state.policies[policyId] = {
      ...policy,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.save();
  }

  async deletePolicy(policyId: string): Promise<void> {
    delete this.state.policies[policyId];
    await this.save();
  }

  async applyPolicies(eventType: string, payload: unknown): Promise<{
    allowed: boolean;
    reasons: string[];
    transformedPayload?: unknown;
  }> {
    const policies = await this.listPolicies(eventType);

    let allowed = true;
    const reasons: string[] = [];
    let transformedPayload = payload;

    // Sort policies by priority
    const sortedPolicies = policies.sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      if (!policy.enabled) {
        continue;
      }

      const result = this.evaluatePolicy(policy, eventType, transformedPayload);

      if (!result.matched) {
        continue;
      }

      for (const action of policy.actions) {
        switch (action.type) {
          case 'allow':
            // No action needed
            break;

          case 'deny':
            allowed = false;
            reasons.push(`Policy '${policy.name}' denied the event`);
            break;

          case 'transform':
            if (action.parameters) {
              transformedPayload = this.applyTransformation(
                transformedPayload,
                action.parameters
              );
            }
            break;

          case 'alert':
            // Trigger alert (implement based on your needs)
            console.warn(`Policy '${policy.name}' triggered alert for event ${eventType}`);
            break;
        }
      }
    }

    return {
      allowed,
      reasons,
      transformedPayload,
    };
  }

  private evaluatePolicy(
    policy: GovernancePolicy,
    eventType: string,
    payload: unknown
  ): { matched: boolean } {
    // Check if policy conditions match
    for (const condition of policy.conditions) {
      const fieldValue = this.getFieldValue(payload, condition.field);

      let matched = false;

      switch (condition.operator) {
        case 'equals':
          matched = fieldValue === condition.value;
          break;

        case 'contains':
          matched =
            typeof fieldValue === 'string' &&
            fieldValue.includes(condition.value as string);
          break;

        case 'matches':
          matched =
            typeof fieldValue === 'string' &&
            new RegExp(condition.value as string).test(fieldValue);
          break;

        case 'in':
          matched = Array.isArray(condition.value) && condition.value.includes(fieldValue);
          break;

        case 'gt':
          matched = typeof fieldValue === 'number' && fieldValue > (condition.value as number);
          break;

        case 'lt':
          matched = typeof fieldValue === 'number' && fieldValue < (condition.value as number);
          break;

        case 'exists':
          matched = fieldValue !== undefined && fieldValue !== null;
          break;
      }

      if (condition.negated) {
        matched = !matched;
      }

      if (!matched) {
        return { matched: false };
      }
    }

    return { matched: true };
  }

  private getFieldValue(payload: unknown, field: string): unknown {
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }

    const parts = field.split('.');
    let current: unknown = payload;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private applyTransformation(payload: unknown, parameters: Record<string, unknown>): unknown {
    // Apply transformation based on parameters
    // This is a simplified implementation

    if (parameters.addField) {
      const { name, value } = parameters.addField as { name: string; value: unknown };
      if (typeof payload === 'object' && payload !== null) {
        return {
          ...payload,
          [name]: value,
        };
      }
    }

    if (parameters.removeField) {
      const fieldName = parameters.removeField as string;
      if (typeof payload === 'object' && payload !== null) {
        const { [fieldName]: removed, ...rest } = payload as Record<string, unknown>;
        return rest;
      }
    }

    if (parameters.renameField) {
      const { oldName, newName } = parameters.renameField as {
        oldName: string;
        newName: string;
      };
      if (typeof payload === 'object' && payload !== null) {
        const { [oldName]: value, ...rest } = payload as Record<string, unknown>;
        return {
          ...rest,
          [newName]: value,
        };
      }
    }

    return payload;
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    // Clear old validation cache entries
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    for (const [key, result] of Object.entries(this.state.validationCache)) {
      if (now - result.timestamp > hourMs) {
        delete this.state.validationCache[key];
      }
    }

    await this.save();
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStats(): Promise<{
    schemaCount: number;
    catalogCount: number;
    policyCount: number;
    cacheSize: number;
  }> {
    return {
      schemaCount: Object.keys(this.state.schemas).length,
      catalogCount: Object.keys(this.state.catalogs).length,
      policyCount: Object.keys(this.state.policies).length,
      cacheSize: Object.keys(this.state.validationCache).length,
    };
  }
}

// ============================================================================
// Schema Registry Client
// ============================================================================

export class SchemaRegistryClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): SchemaRegistryDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async registerSchema(schema: Omit<EventSchemaDefinition, 'schemaId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.getStub().registerSchema(schema);
  }

  async getSchema(eventType: string, version?: number): Promise<EventSchemaDefinition | null> {
    return this.getStub().getSchema(eventType, version);
  }

  async validateEvent(eventType: string, version: number, payload: unknown): Promise<ValidationResult> {
    return this.getStub().validateEvent(eventType, version, payload);
  }

  async evolveSchema(eventType: string, newSchema: unknown, strategy: EvolutionStrategy): Promise<number> {
    return this.getStub().evolveSchema(eventType, newSchema, strategy);
  }

  async getCatalog(eventType: string): Promise<EventCatalog | null> {
    return this.getStub().getCatalog(eventType);
  }

  async listCatalogs(): Promise<EventCatalog[]> {
    return this.getStub().listCatalogs();
  }

  async createPolicy(policy: Omit<GovernancePolicy, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.getStub().createPolicy(policy);
  }

  async applyPolicies(eventType: string, payload: unknown): Promise<{
    allowed: boolean;
    reasons: string[];
    transformedPayload?: unknown;
  }> {
    return this.getStub().applyPolicies(eventType, payload);
  }
}

// ============================================================================
// Schema Registry Factory
// ============================================================================

export class SchemaRegistryFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): SchemaRegistryClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new SchemaRegistryClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): SchemaRegistryClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new SchemaRegistryClient(this.namespace, durableObjectId);
  }
}
