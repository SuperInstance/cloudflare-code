/**
 * Flag Manager - Core feature flag management with CRUD operations
 * Provides flag versioning, validation, and real-time updates
 */

import type {
  Flag,
  FlagValueType,
  FlagRules,
  Rule,
  FlagState,
  FlagType,
  Condition,
  UserAttributes,
  EvaluationContext,
  EvaluationResult,
  FlagStorageEnv,
} from '../types/index.js';

// ============================================================================
// Flag Validation
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
}

export class FlagValidator {
  static validateFlag(flag: Partial<Flag>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!flag.key) {
      errors.push({ field: 'key', message: 'Flag key is required' });
    } else if (!/^[a-zA-Z0-9._-]+$/.test(flag.key)) {
      errors.push({
        field: 'key',
        message: 'Flag key must contain only alphanumeric characters, dots, dashes, and underscores',
      });
    }

    if (!flag.type) {
      errors.push({ field: 'type', message: 'Flag type is required' });
    } else if (!['boolean', 'string', 'number', 'json'].includes(flag.type)) {
      errors.push({
        field: 'type',
        message: 'Flag type must be boolean, string, number, or json',
      });
    }

    if (flag.defaultValue === undefined) {
      errors.push({
        field: 'defaultValue',
        message: 'Default value is required',
      });
    } else if (flag.type && !this.isValidValueForType(flag.defaultValue, flag.type)) {
      errors.push({
        field: 'defaultValue',
        message: `Default value must be of type ${flag.type}`,
      });
    }

    return errors;
  }

  static isValidValueForType(value: unknown, type: FlagType): boolean {
    switch (type) {
      case 'boolean':
        return typeof value === 'boolean';
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'json':
        return typeof value === 'object' && value !== null;
      default:
        return false;
    }
  }

  static validateRule(rule: Partial<Rule>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!rule.name) {
      errors.push({ field: 'name', message: 'Rule name is required' });
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push({
        field: 'conditions',
        message: 'Rule must have at least one condition',
      });
    } else {
      rule.conditions.forEach((condition, index) => {
        const conditionErrors = this.validateCondition(condition);
        conditionErrors.forEach((error) => {
          errors.push({
            field: `conditions[${index}]`,
            message: error.message,
          });
        });
      });
    }

    if (rule.rolloutPercentage !== undefined) {
      if (rule.rolloutPercentage < 0 || rule.rolloutPercentage > 100) {
        errors.push({
          field: 'rolloutPercentage',
          message: 'Rollout percentage must be between 0 and 100',
        });
      }
    }

    return errors;
  }

  static validateCondition(condition: Partial<Condition>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!condition.attribute) {
      errors.push({
        field: 'attribute',
        message: 'Condition attribute is required',
      });
    }

    if (!condition.operator) {
      errors.push({
        field: 'operator',
        message: 'Condition operator is required',
      });
    }

    return errors;
  }
}

// ============================================================================
// Flag Manager
// ============================================================================

export class FlagManager {
  private storage: DurableObjectStub;
  private cache: Map<string, Flag>;
  private rulesCache: Map<string, FlagRules>;
  private version: number;

  constructor(env: FlagStorageEnv) {
    this.storage = env.FLAGS_DURABLE_OBJECT.idFromName('flags');
    this.cache = new Map();
    this.rulesCache = new Map();
    this.version = 0;
  }

  // ========================================================================
  // Flag CRUD Operations
  // ========================================================================

  /**
   * Create a new feature flag
   */
  async createFlag(
    flagData: Omit<Flag, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<Flag> {
    // Validate flag data
    const errors = FlagValidator.validateFlag(flagData);
    if (errors.length > 0) {
      throw new Error(
        `Invalid flag data: ${errors.map((e) => e.message).join(', ')}`
      );
    }

    // Check if flag already exists
    const existing = await this.getFlag(flagData.key);
    if (existing) {
      throw new Error(`Flag with key '${flagData.key}' already exists`);
    }

    const flag: Flag = {
      ...flagData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    // Store flag
    await this.storage.setFlag(flag);

    // Update cache
    this.cache.set(flag.key, flag);
    this.version++;

    return flag;
  }

  /**
   * Get a flag by key
   */
  async getFlag(key: string): Promise<Flag | undefined> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Fetch from storage
    const flag = await this.storage.getFlag(key);
    if (flag) {
      this.cache.set(key, flag);
    }

    return flag;
  }

  /**
   * Get flag by ID
   */
  async getFlagById(id: string): Promise<Flag | undefined> {
    // List all flags and find by ID
    const flags = await this.listFlags();
    return flags.find((f) => f.id === id);
  }

  /**
   * Update an existing flag
   */
  async updateFlag(
    key: string,
    updates: Partial<Omit<Flag, 'id' | 'key' | 'createdAt' | 'version'>>
  ): Promise<Flag> {
    const existing = await this.getFlag(key);
    if (!existing) {
      throw new Error(`Flag '${key}' not found`);
    }

    // Validate updates
    const errors = FlagValidator.validateFlag({
      ...existing,
      ...updates,
    });
    if (errors.length > 0) {
      throw new Error(
        `Invalid flag data: ${errors.map((e) => e.message).join(', ')}`
      );
    }

    const updated: Flag = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
      version: existing.version + 1,
    };

    // Store updated flag
    await this.storage.setFlag(updated);

    // Update cache
    this.cache.set(key, updated);
    this.version++;

    return updated;
  }

  /**
   * Delete a flag
   */
  async deleteFlag(key: string): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag) {
      return false;
    }

    // Delete flag and its rules
    await this.storage.deleteFlag(key);

    // Remove from cache
    this.cache.delete(key);
    this.rulesCache.delete(key);
    this.version++;

    return true;
  }

  /**
   * List all flags with optional filtering
   */
  async listFlags(filter?: {
    state?: FlagState;
    tags?: string[];
    type?: FlagType;
    limit?: number;
    offset?: number;
  }): Promise<Flag[]> {
    const flags = await this.storage.listFlags(filter);
    let result = flags;

    if (filter) {
      if (filter.state) {
        result = result.filter((f) => f.state === filter.state);
      }
      if (filter.type) {
        result = result.filter((f) => f.type === filter.type);
      }
      if (filter.tags && filter.tags.length > 0) {
        result = result.filter((f) =>
          filter.tags!.some((tag) => f.tags.includes(tag))
        );
      }
    }

    // Apply pagination
    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Archive a flag (soft delete)
   */
  async archiveFlag(key: string): Promise<Flag> {
    return this.updateFlag(key, { state: 'archived' });
  }

  /**
   * Restore an archived flag
   */
  async restoreFlag(key: string): Promise<Flag> {
    return this.updateFlag(key, { state: 'active' });
  }

  /**
   * Get flag count
   */
  async getFlagCount(): Promise<number> {
    return this.storage.getFlagCount();
  }

  // ========================================================================
  // Rules Management
  // ========================================================================

  /**
   * Set rules for a flag
   */
  async setRules(flagKey: string, rules: Rule[]): Promise<FlagRules> {
    const flag = await this.getFlag(flagKey);
    if (!flag) {
      throw new Error(`Flag '${flagKey}' not found`);
    }

    // Validate all rules
    rules.forEach((rule, index) => {
      const errors = FlagValidator.validateRule(rule);
      if (errors.length > 0) {
        throw new Error(
          `Invalid rule at index ${index}: ${errors.map((e) => e.message).join(', ')}`
        );
      }
    });

    const flagRules: FlagRules = {
      flagId: flagKey,
      rules,
      updatedAt: new Date(),
      version: 1,
    };

    await this.storage.setRules(flagRules);
    this.rulesCache.set(flagKey, flagRules);

    return flagRules;
  }

  /**
   * Get rules for a flag
   */
  async getRules(flagKey: string): Promise<FlagRules | undefined> {
    // Check cache first
    if (this.rulesCache.has(flagKey)) {
      return this.rulesCache.get(flagKey);
    }

    const rules = await this.storage.getRules(flagKey);
    if (rules) {
      this.rulesCache.set(flagKey, rules);
    }

    return rules;
  }

  /**
   * Add a rule to a flag
   */
  async addRule(flagKey: string, rule: Rule): Promise<FlagRules> {
    const errors = FlagValidator.validateRule(rule);
    if (errors.length > 0) {
      throw new Error(
        `Invalid rule: ${errors.map((e) => e.message).join(', ')}`
      );
    }

    const existingRules = await this.getRules(flagKey);
    const rules = existingRules ? [...existingRules.rules, rule] : [rule];

    return this.setRules(flagKey, rules);
  }

  /**
   * Update a specific rule
   */
  async updateRule(
    flagKey: string,
    ruleId: string,
    updates: Partial<Rule>
  ): Promise<FlagRules> {
    const existingRules = await this.getRules(flagKey);
    if (!existingRules) {
      throw new Error(`No rules found for flag '${flagKey}'`);
    }

    const ruleIndex = existingRules.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Rule '${ruleId}' not found`);
    }

    const updated: Rule = {
      ...existingRules.rules[ruleIndex],
      ...updates,
    };

    existingRules.rules[ruleIndex] = updated;
    return this.setRules(flagKey, existingRules.rules);
  }

  /**
   * Delete a rule
   */
  async deleteRule(flagKey: string, ruleId: string): Promise<FlagRules> {
    const existingRules = await this.getRules(flagKey);
    if (!existingRules) {
      throw new Error(`No rules found for flag '${flagKey}'`);
    }

    const filtered = existingRules.rules.filter((r) => r.id !== ruleId);
    return this.setRules(flagKey, filtered);
  }

  /**
   * Clear all rules for a flag
   */
  async clearRules(flagKey: string): Promise<void> {
    await this.storage.deleteRules(flagKey);
    this.rulesCache.delete(flagKey);
  }

  // ========================================================================
  // Flag Evaluation
  // ========================================================================

  /**
   * Evaluate a flag for a given context
   */
  async evaluateFlag(
    flagKey: string,
    context: EvaluationContext
  ): Promise<EvaluationResult<FlagValueType>> {
    const startTime = performance.now();

    const flag = await this.getFlag(flagKey);
    if (!flag) {
      throw new Error(`Flag '${flagKey}' not found`);
    }

    let value = flag.defaultValue;
    let reason: EvaluationResult['reason'] = 'default';
    let variant: string | undefined;

    // Check rules if flag is active
    if (flag.state === 'active') {
      const rules = await this.getRules(flagKey);
      if (rules && rules.rules.length > 0) {
        // Sort rules by priority (higher priority first)
        const sortedRules = [...rules.rules].sort(
          (a, b) => b.priority - a.priority
        );

        // Find first matching rule
        for (const rule of sortedRules) {
          if (!rule.enabled) {
            continue;
          }

          if (this.matchesRule(rule, context.attributes)) {
            // Check rollout percentage
            if (rule.rolloutPercentage !== undefined) {
              const hash = this.hashUserId(context.userId);
              const scaledHash = hash % 100;
              if (scaledHash < rule.rolloutPercentage) {
                if (rule.variant) {
                  variant = rule.variant;
                  value = this.getVariantValue(flag, rule.variant);
                } else {
                  value = true as FlagValueType;
                }
                reason = 'rule_match';
                break;
              }
            } else {
              if (rule.variant) {
                variant = rule.variant;
                value = this.getVariantValue(flag, rule.variant);
              } else {
                value = true as FlagValueType;
              }
              reason = 'rule_match';
              break;
            }
          }
        }
      }
    }

    const evaluationTime = performance.now() - startTime;

    return {
      value,
      variant,
      reason,
      timestamp: new Date(),
      evaluationTime,
    };
  }

  /**
   * Batch evaluate multiple flags
   */
  async batchEvaluateFlags(
    flagKeys: string[],
    context: EvaluationContext
  ): Promise<Record<string, EvaluationResult<FlagValueType>>> {
    const results: Record<string, EvaluationResult<FlagValueType>> = {};

    // Evaluate flags in parallel for better performance
    const evaluations = flagKeys.map(async (key) => {
      try {
        const result = await this.evaluateFlag(key, context);
        return { key, result, error: null };
      } catch (error) {
        return {
          key,
          result: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const settled = await Promise.all(evaluations);
    for (const evaluation of settled) {
      if (evaluation.error) {
        results[evaluation.key] = {
          value: false,
          reason: 'error',
          timestamp: new Date(),
          evaluationTime: 0,
        };
      } else {
        results[evaluation.key] = evaluation.result!;
      }
    }

    return results;
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.rulesCache.clear();
    this.version++;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    flagCacheSize: number;
    rulesCacheSize: number;
    version: number;
  } {
    return {
      flagCacheSize: this.cache.size,
      rulesCacheSize: this.rulesCache.size,
      version: this.version,
    };
  }

  /**
   * Warm up cache with commonly used flags
   */
  async warmupCache(flagKeys: string[]): Promise<void> {
    await Promise.all(
      flagKeys.map(async (key) => {
        await this.getFlag(key);
        await this.getRules(key);
      })
    );
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private matchesRule(rule: Rule, attributes: UserAttributes): boolean {
    if (rule.conditions.length === 0) {
      return true;
    }

    const results = rule.conditions.map((condition) =>
      this.matchesCondition(condition, attributes)
    );

    return rule.逻辑 === 'AND'
      ? results.every((r) => r)
      : results.some((r) => r);
  }

  private matchesCondition(
    condition: Condition,
    attributes: UserAttributes
  ): boolean {
    const value = this.getAttributeValue(attributes, condition.attribute);
    return this.evaluateCondition(value, condition.operator, condition.value);
  }

  private getAttributeValue(
    attributes: UserAttributes,
    path: string
  ): unknown {
    const parts = path.split('.');
    let value: unknown = attributes;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(
    actual: unknown,
    operator: RuleOperator,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.includes(expected);
      case 'not_contains':
        return typeof actual === 'string' &&
          typeof expected === 'string' &&
          !actual.includes(expected);
      case 'starts_with':
        return typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.startsWith(expected);
      case 'ends_with':
        return typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.endsWith(expected);
      case 'greater_than':
        return typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual > expected;
      case 'less_than':
        return typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual < expected;
      case 'greater_than_or_equal':
        return typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual >= expected;
      case 'less_than_or_equal':
        return typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'is_one_of':
        return Array.isArray(expected) && expected.includes(actual);
      case 'is_not_one_of':
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }

  private getVariantValue(
    flag: Flag,
    variant: string
  ): FlagValueType {
    // For boolean flags, variant typically represents a boolean value
    if (flag.type === 'boolean') {
      return variant === 'true' || variant === 'enabled';
    }

    // For string flags, return the variant as-is
    if (flag.type === 'string') {
      return variant;
    }

    // For number flags, try to parse
    if (flag.type === 'number') {
      const num = parseFloat(variant);
      return isNaN(num) ? flag.defaultValue : num;
    }

    // For json flags, try to parse
    if (flag.type === 'json') {
      try {
        return JSON.parse(variant) as FlagValueType;
      } catch {
        return flag.defaultValue;
      }
    }

    return flag.defaultValue;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// Flag Evaluation Result Types
// ============================================================================

type EvaluationReason =
  | 'default'
  | 'rule_match'
  | 'segment_match'
  | 'variant_assignment'
  | 'forced'
  | 'error';
