// @ts-nocheck
/**
 * Feature Flag System
 * Comprehensive feature flag management with targeting and rollout strategies
 */

import {
  FeatureFlag,
  FeatureFlagType,
  FeatureRule,
  RuleCondition,
  RolloutStrategy,
  RolloutConfig,
  EnvironmentConfig,
} from '../types/index.js';
import { FeatureFlagStorage } from './feature-storage.js';

export interface FlagEvaluationContext {
  userId?: string;
  sessionId?: string;
  attributes?: Record<string, any>;
  environment?: 'development' | 'staging' | 'production';
  timestamp?: number;
}

export class FeatureFlagService {
  private storage: FeatureFlagStorage;
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheTTL: number;
  private evaluationCache: Map<string, { value: any; expiresAt: number }> = new Map();

  constructor(storage: FeatureFlagStorage, cacheTTL: number = 60000) {
    this.storage = storage;
    this.cacheTTL = cacheTTL;
  }

  /**
   * Create a new feature flag
   */
  async createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const id = this.generateFlagId(flag.name);
    const now = Date.now();

    const fullFlag: FeatureFlag = {
      ...flag,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.saveFlag(fullFlag);
    this.cache.set(id, fullFlag);

    return fullFlag;
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    flagId: string,
    updates: Partial<Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<FeatureFlag> {
    const flag = await this.storage.getFlag(flagId);
    if (!flag) {
      throw new Error(`Flag ${flagId} not found`);
    }

    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.storage.saveFlag(updatedFlag);
    this.cache.set(flagId, updatedFlag);

    // Clear evaluation cache
    this.clearEvaluationCache(flagId);

    return updatedFlag;
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagId: string): Promise<void> {
    await this.storage.deleteFlag(flagId);
    this.cache.delete(flagId);
    this.clearEvaluationCache(flagId);
  }

  /**
   * Get a feature flag
   */
  async getFlag(flagId: string): Promise<FeatureFlag | null> {
    // Check cache first
    if (this.cache.has(flagId)) {
      return this.cache.get(flagId)!;
    }

    const flag = await this.storage.getFlag(flagId);
    if (flag) {
      this.cache.set(flagId, flag);
    }

    return flag;
  }

  /**
   * List all feature flags
   */
  async listFlags(filters?: {
    enabled?: boolean;
    type?: FeatureFlagType;
    environment?: string;
  }): Promise<FeatureFlag[]> {
    return this.storage.listFlags(filters);
  }

  /**
   * Evaluate a feature flag
   */
  async evaluateFlag(
    flagId: string,
    context: FlagEvaluationContext
  ): Promise<{ value: any; variation?: string; reason: string }> {
    // Check evaluation cache
    const cacheKey = this.getEvaluationCacheKey(flagId, context);
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        value: cached.value.value,
        variation: cached.value.variation,
        reason: 'cached',
      };
    }

    const flag = await this.getFlag(flagId);
    if (!flag) {
      return { value: null, reason: 'flag_not_found' };
    }

    // Check environment
    if (context.environment) {
      const envEnabled = this.checkEnvironment(flag, context.environment);
      if (!envEnabled) {
        return { value: null, reason: 'environment_disabled' };
      }
    }

    // Check if flag is enabled
    if (!flag.enabled) {
      return { value: this.getDefaultValue(flag), reason: 'flag_disabled' };
    }

    // Evaluate rules in priority order
    const sortedRules = [...flag.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      const result = this.evaluateRule(rule, context);
      if (result.matched) {
        const value = rule.variation !== undefined ? rule.variation : this.getDefaultValue(flag);

        // Cache the result
        this.evaluationCache.set(cacheKey, {
          value: { value, variation: rule.variation },
          expiresAt: Date.now() + this.cacheTTL,
        });

        return { value, variation: rule.variation, reason: 'rule_match' };
      }
    }

    // No rules matched, return default
    return {
      value: this.getDefaultValue(flag),
      reason: 'default_value',
    };
  }

  /**
   * Evaluate multiple flags at once
   */
  async evaluateFlags(
    flagIds: string[],
    context: FlagEvaluationContext
  ): Promise<Record<string, { value: any; variation?: string; reason: string }>> {
    const results: Record<string, any> = {};

    await Promise.all(
      flagIds.map(async (flagId) => {
        results[flagId] = await this.evaluateFlag(flagId, context);
      })
    );

    return results;
  }

  /**
   * Enable a feature flag
   */
  async enableFlag(flagId: string): Promise<FeatureFlag> {
    return this.updateFlag(flagId, { enabled: true });
  }

  /**
   * Disable a feature flag
   */
  async disableFlag(flagId: string): Promise<FeatureFlag> {
    return this.updateFlag(flagId, { enabled: false });
  }

  /**
   * Add a rule to a flag
   */
  async addRule(flagId: string, rule: Omit<FeatureRule, 'id'>): Promise<FeatureFlag> {
    const flag = await this.getFlag(flagId);
    if (!flag) {
      throw new Error(`Flag ${flagId} not found`);
    }

    const newRule: FeatureRule = {
      ...rule,
      id: this.generateRuleId(),
    };

    return this.updateFlag(flagId, {
      rules: [...flag.rules, newRule],
    });
  }

  /**
   * Update a rule
   */
  async updateRule(
    flagId: string,
    ruleId: string,
    updates: Partial<Omit<FeatureRule, 'id'>>: Promise<FeatureFlag> {
    const flag = await this.getFlag(flagId);
    if (!flag) {
      throw new Error(`Flag ${flagId} not found`);
    }

    const updatedRules = flag.rules.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    );

    return this.updateFlag(flagId, { rules: updatedRules });
  }

  /**
   * Delete a rule
   */
  async deleteRule(flagId: string, ruleId: string): Promise<FeatureFlag> {
    const flag = await this.getFlag(flagId);
    if (!flag) {
      throw new Error(`Flag ${flagId} not found`);
    }

    const filteredRules = flag.rules.filter(rule => rule.id !== ruleId);

    return this.updateFlag(flagId, { rules: filteredRules });
  }

  /**
   * Set rollout strategy
   */
  async setRollout(
    flagId: string,
    rollout: RolloutConfig
  ): Promise<FeatureFlag> {
    return this.updateFlag(flagId, { rolloutStrategy: rollout.type });
  }

  /**
   * Get flag usage statistics
   */
  async getFlagStats(flagId: string): Promise<{
    evaluations: number;
    trueCount: number;
    falseCount: number;
    variationCounts: Record<string, number>;
  }> {
    return this.storage.getFlagStats(flagId);
  }

  /**
   * Bulk evaluate flags for a user
   */
  async getAllFlagsForUser(
    context: FlagEvaluationContext
  ): Promise<Record<string, any>> {
    const flags = await this.listFlags({ enabled: true });
    const results: Record<string, any> = {};

    await Promise.all(
      flags.map(async (flag) => {
        const result = await this.evaluateFlag(flag.id, context);
        results[flag.name] = result.value;
      })
    );

    return results;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateFlagId(name: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `flag-${normalized}-${random}`;
  }

  private generateRuleId(): string {
    return `rule-${Math.random().toString(36).substring(2, 10)}`;
  }

  private getDefaultValue(flag: FeatureFlag): any {
    switch (flag.type) {
      case 'boolean':
        return false;
      case 'multivariate':
        return flag.rules[0]?.variation || null;
      case 'kill_switch':
        return true; // Default to enabled for kill switches
      case 'permission':
        return false;
      case 'experimentation':
        return null;
      default:
        return null;
    }
  }

  private checkEnvironment(flag: FeatureFlag, environment: string): boolean {
    switch (environment) {
      case 'development':
        return flag.environmentConfig.development;
      case 'staging':
        return flag.environmentConfig.staging;
      case 'production':
        return flag.environmentConfig.production;
      default:
        return false;
    }
  }

  private evaluateRule(
    rule: FeatureRule,
    context: FlagEvaluationContext
  ): { matched: boolean; value?: any } {
    return this.evaluateCondition(rule.condition, context);
  }

  private evaluateCondition(
    condition: RuleCondition,
    context: FlagEvaluationContext
  ): { matched: boolean; value?: any } {
    switch (condition.type) {
      case 'user':
        return this.evaluateUserCondition(condition, context);
      case 'segment':
        return this.evaluateSegmentCondition(condition, context);
      case 'percentage':
        return this.evaluatePercentageCondition(condition, context);
      case 'custom':
        return this.evaluateCustomCondition(condition, context);
      case 'composite':
        return this.evaluateCompositeCondition(condition, context);
      default:
        return { matched: false };
    }
  }

  private evaluateUserCondition(
    condition: RuleCondition,
    context: FlagEvaluationContext
  ): { matched: boolean } {
    if (!context.userId) {
      return { matched: false };
    }

    const userValue = context.userId;
    const conditionValue = condition.value;

    return { matched: this.compareValues(userValue, conditionValue, condition.operator) };
  }

  private evaluateSegmentCondition(
    condition: RuleCondition,
    context: FlagEvaluationContext
  ): { matched: boolean } {
    if (!context.attributes) {
      return { matched: false };
    }

    const userValue = context.attributes[condition.attribute || 'segment'];
    const conditionValue = condition.value;

    return { matched: this.compareValues(userValue, conditionValue, condition.operator) };
  }

  private evaluatePercentageCondition(
    condition: RuleCondition,
    context: FlagEvaluationContext
  ): { matched: boolean } {
    if (!context.userId) {
      return { matched: false };
    }

    // Hash userId to get consistent percentage
    const hash = this.hashString(context.userId);
    const percentage = (hash % 10000) / 100; // 0-100

    return { matched: percentage <= condition.value };
  }

  private evaluateCustomCondition(
    condition: RuleCondition,
    context: FlagEvaluationContext
  ): { matched: boolean } {
    // Custom conditions would be evaluated by user-provided functions
    // For now, return false
    return { matched: false };
  }

  private evaluateCompositeCondition(
    condition: RuleCondition,
    context: FlagEvaluationContext
  ): { matched: boolean } {
    if (!condition.conditions || condition.conditions.length === 0) {
      return { matched: false };
    }

    const results = condition.conditions.map(c => this.evaluateCondition(c, context));
    const logic = condition.logic || 'AND';

    if (logic === 'AND') {
      return { matched: results.every(r => r.matched) };
    } else {
      return { matched: results.some(r => r.matched) };
    }
  }

  private compareValues(
    userValue: any,
    conditionValue: any,
    operator: string
  ): boolean {
    switch (operator) {
      case 'eq':
        return userValue === conditionValue;
      case 'neq':
        return userValue !== conditionValue;
      case 'gt':
        return userValue > conditionValue;
      case 'lt':
        return userValue < conditionValue;
      case 'gte':
        return userValue >= conditionValue;
      case 'lte':
        return userValue <= conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(userValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(userValue);
      case 'contains':
        return typeof userValue === 'string' && userValue.includes(conditionValue);
      case 'matches':
        if (typeof conditionValue === 'string') {
          const regex = new RegExp(conditionValue);
          return regex.test(userValue);
        }
        return false;
      default:
        return false;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private getEvaluationCacheKey(flagId: string, context: FlagEvaluationContext): string {
    const contextStr = JSON.stringify({
      userId: context.userId,
      attributes: context.attributes,
      environment: context.environment,
    });
    return `${flagId}:${contextStr}`;
  }

  private clearEvaluationCache(flagId: string): void {
    const prefix = `${flagId}:`;
    for (const key of this.evaluationCache.keys()) {
      if (key.startsWith(prefix)) {
        this.evaluationCache.delete(key);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.evaluationCache.clear();
  }

  /**
   * Warm up cache with frequently used flags
   */
  async warmCache(flagIds: string[]): Promise<void> {
    await Promise.all(
      flagIds.map(async (flagId) => {
        await this.getFlag(flagId);
      })
    );
  }
}

// ============================================================================
// Feature Flag Middleware
// ============================================================================

export class FeatureFlagMiddleware {
  private flagService: FeatureFlagService;

  constructor(flagService: FeatureFlagService) {
    this.flagService = flagService;
  }

  /**
   * Create middleware for request handling
   */
  middleware(options: {
    flagIds?: string[];
    getUserId?: (request: Request) => string | undefined;
    getAttributes?: (request: Request) => Record<string, any> | undefined;
  }) {
    return async (request: Request, env: any): Promise<Response> => {
      const context: FlagEvaluationContext = {
        userId: options.getUserId?.(request),
        attributes: options.getAttributes?.(request),
        environment: env.ENVIRONMENT as any,
      };

      // Evaluate flags
      const flags = options.flagIds
        ? await this.flagService.evaluateFlags(options.flagIds, context)
        : await this.flagService.getAllFlagsForUser(context);

      // Add flags to request context
      (request as any).flags = flags;

      // Continue with request
      return env.fetch(request);
    };
  }
}

// ============================================================================
// Flag Evaluation Result Types
// ============================================================================

export interface FlagEvaluationResult {
  flagId: string;
  flagName: string;
  value: any;
  variation?: string;
  reason: string;
  timestamp: number;
}

export interface BulkEvaluationResult {
  results: FlagEvaluationResult[];
  timestamp: number;
}
