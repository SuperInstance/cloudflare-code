/**
 * Targeting Engine - Advanced user segmentation and targeting
 * Supports custom rules, device targeting, geographic targeting, and attribute-based segmentation
 */

import type {
  Segment,
  Condition,
  UserAttributes,
  RuleOperator,
  FlagStorageEnv,
  TargetingRule,
} from '../types/index.js';

// ============================================================================
// Segment Management
// ============================================================================

export interface SegmentConfig {
  name: string;
  description?: string;
  conditions: Condition[];
  逻辑: 'AND' | 'OR';
  userIds?: string[];
}

export class TargetingEngine {
  private storage: DurableObjectStub;
  private segmentCache: Map<string, Segment>;
  private evaluationCache: Map<string, boolean>;

  constructor(env: FlagStorageEnv) {
    this.storage = env.FLAGS_DURABLE_OBJECT.idFromName('targeting');
    this.segmentCache = new Map();
    this.evaluationCache = new Map();
  }

  // ========================================================================
  // Segment Operations
  // ========================================================================

  /**
   * Create a new segment
   */
  async createSegment(config: SegmentConfig): Promise<Segment> {
    const segmentId = this.generateSegmentId();

    const segment: Segment = {
      id: segmentId,
      name: config.name,
      description: config.description || '',
      conditions: config.conditions,
      逻辑: config.逻辑,
      userIds: config.userIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.setSegment(segment);
    this.segmentCache.set(segmentId, segment);

    return segment;
  }

  /**
   * Get segment by ID
   */
  async getSegment(segmentId: string): Promise<Segment | undefined> {
    // Check cache first
    if (this.segmentCache.has(segmentId)) {
      return this.segmentCache.get(segmentId);
    }

    const segment = await this.storage.getSegment(segmentId);
    if (segment) {
      this.segmentCache.set(segmentId, segment);
    }

    return segment;
  }

  /**
   * Update a segment
   */
  async updateSegment(
    segmentId: string,
    updates: Partial<Omit<Segment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Segment> {
    const existing = await this.getSegment(segmentId);
    if (!existing) {
      throw new Error(`Segment '${segmentId}' not found`);
    }

    const updated: Segment = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.storage.setSegment(updated);
    this.segmentCache.set(segmentId, updated);

    return updated;
  }

  /**
   * Delete a segment
   */
  async deleteSegment(segmentId: string): Promise<boolean> {
    this.segmentCache.delete(segmentId);
    return this.storage.deleteSegment(segmentId);
  }

  /**
   * List all segments
   */
  async listSegments(filter?: {
    name?: string;
    userId?: string;
  }): Promise<Segment[]> {
    let segments = await this.storage.listSegments();

    if (filter?.name) {
      const nameLower = filter.name.toLowerCase();
      segments = segments.filter((s) =>
        s.name.toLowerCase().includes(nameLower)
      );
    }

    if (filter?.userId) {
      segments = segments.filter((s) =>
        s.userIds?.includes(filter.userId!)
      );
    }

    return segments;
  }

  /**
   * Add users to a segment
   */
  async addUsersToSegment(
    segmentId: string,
    userIds: string[]
  ): Promise<Segment> {
    const segment = await this.getSegment(segmentId);
    if (!segment) {
      throw new Error(`Segment '${segmentId}' not found`);
    }

    const existingUserIds = segment.userIds || [];
    const newUserIds = [...new Set([...existingUserIds, ...userIds])];

    return this.updateSegment(segmentId, { userIds: newUserIds });
  }

  /**
   * Remove users from a segment
   */
  async removeUsersFromSegment(
    segmentId: string,
    userIds: string[]
  ): Promise<Segment> {
    const segment = await this.getSegment(segmentId);
    if (!segment) {
      throw new Error(`Segment '${segmentId}' not found`);
    }

    const existingUserIds = segment.userIds || [];
    const newUserIds = existingUserIds.filter((id) => !userIds.includes(id));

    return this.updateSegment(segmentId, { userIds: newUserIds });
  }

  /**
   * Get segment size
   */
  async getSegmentSize(segmentId: string): Promise<number> {
    const segment = await this.getSegment(segmentId);
    if (!segment) {
      throw new Error(`Segment '${segmentId}' not found`);
    }

    return segment.userIds?.length || 0;
  }

  // ========================================================================
  // User Evaluation
  // ========================================================================

  /**
   * Check if user matches segment
   */
  async matchesSegment(
    segmentId: string,
    userId: string,
    attributes: UserAttributes
  ): Promise<boolean> {
    const segment = await this.getSegment(segmentId);
    if (!segment) {
      return false;
    }

    // Check explicit user list first
    if (segment.userIds && segment.userIds.length > 0) {
      if (segment.userIds.includes(userId)) {
        return true;
      }
      // If segment has explicit user list, only those users match
      if (segment.conditions.length === 0) {
        return false;
      }
    }

    // Check conditions
    if (segment.conditions.length === 0) {
      return false;
    }

    return this.matchesConditions(
      segment.conditions,
      segment.逻辑,
      attributes
    );
  }

  /**
   * Check if user matches multiple segments
   */
  async matchesSegments(
    segmentIds: string[],
    userId: string,
    attributes: UserAttributes
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const segmentId of segmentIds) {
      const matches = await this.matchesSegment(segmentId, userId, attributes);
      results.set(segmentId, matches);
    }

    return results;
  }

  /**
   * Get all segments a user belongs to
   */
  async getUserSegments(
    userId: string,
    attributes: UserAttributes
  ): Promise<Segment[]> {
    const segments = await this.listSegments();
    const userSegments: Segment[] = [];

    for (const segment of segments) {
      const matches = await this.matchesSegment(segment.id, userId, attributes);
      if (matches) {
        userSegments.push(segment);
      }
    }

    return userSegments;
  }

  // ========================================================================
  // Condition Evaluation
  // ========================================================================

  /**
   * Evaluate if attributes match conditions
   */
  matchesConditions(
    conditions: Condition[],
    逻辑: 'AND' | 'OR',
    attributes: UserAttributes
  ): boolean {
    if (conditions.length === 0) {
      return true;
    }

    const results = conditions.map((condition) =>
      this.matchesCondition(condition, attributes)
    );

    return 逻辑 === 'AND' ? results.every((r) => r) : results.some((r) => r);
  }

  /**
   * Evaluate a single condition
   */
  matchesCondition(condition: Condition, attributes: UserAttributes): boolean {
    const value = this.getAttributeValue(attributes, condition.attribute);

    return this.evaluateCondition(
      value,
      condition.operator,
      condition.value
    );
  }

  /**
   * Get attribute value from user attributes using dot notation
   */
  getAttributeValue(attributes: UserAttributes, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = attributes;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else if (part.startsWith('[') && part.endsWith(']')) {
        // Handle array access like customAttributes[0]
        const index = parseInt(part.slice(1, -1), 10);
        if (
          value &&
          typeof value === 'object' &&
          Array.isArray(value) &&
          !isNaN(index)
        ) {
          value = value[index];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate condition with operator
   */
  evaluateCondition(
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
        return (
          typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.toLowerCase().includes(expected.toLowerCase())
        );

      case 'not_contains':
        return (
          typeof actual === 'string' &&
          typeof expected === 'string' &&
          !actual.toLowerCase().includes(expected.toLowerCase())
        );

      case 'starts_with':
        return (
          typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.toLowerCase().startsWith(expected.toLowerCase())
        );

      case 'ends_with':
        return (
          typeof actual === 'string' &&
          typeof expected === 'string' &&
          actual.toLowerCase().endsWith(expected.toLowerCase())
        );

      case 'greater_than':
        return (
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual > expected
        );

      case 'less_than':
        return (
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual < expected
        );

      case 'greater_than_or_equal':
        return (
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual >= expected
        );

      case 'less_than_or_equal':
        return (
          typeof actual === 'number' &&
          typeof expected === 'number' &&
          actual <= expected
        );

      case 'in':
        return Array.isArray(expected) && expected.includes(actual);

      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);

      case 'is_one_of':
        return Array.isArray(expected) && expected.includes(actual);

      case 'is_not_one_of':
        return Array.isArray(expected) && !expected.includes(actual);

      case 'regex':
        try {
          const regex = new RegExp(expected as string, 'i');
          return typeof actual === 'string' && regex.test(actual);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  // ========================================================================
  // Predefined Segments
  // ========================================================================

  /**
   * Create segment for beta testers
   */
  async createBetaTestersSegment(userIds: string[]): Promise<Segment> {
    return this.createSegment({
      name: 'Beta Testers',
      description: 'Users who are beta testers',
      conditions: [],
      逻辑: 'AND',
      userIds,
    });
  }

  /**
   * Create segment for specific country
   */
  async createCountrySegment(country: string): Promise<Segment> {
    return this.createSegment({
      name: `Users in ${country}`,
      description: `Users located in ${country}`,
      conditions: [
        {
          attribute: 'country',
          operator: 'equals',
          value: country,
        },
      ],
      逻辑: 'AND',
    });
  }

  /**
   * Create segment for device type
   */
  async createDeviceTypeSegment(deviceType: string): Promise<Segment> {
    return this.createSegment({
      name: `${deviceType} Users`,
      description: `Users using ${deviceType} devices`,
      conditions: [
        {
          attribute: 'deviceType',
          operator: 'equals',
          value: deviceType,
        },
      ],
      逻辑: 'AND',
    });
  }

  /**
   * Create segment for power users
   */
  async createPowerUsersSegment(minDaysActive: number): Promise<Segment> {
    return this.createSegment({
      name: 'Power Users',
      description: `Users active for at least ${minDaysActive} days`,
      conditions: [
        {
          attribute: 'customAttributes.daysActive',
          operator: 'greater_than_or_equal',
          value: minDaysActive,
        },
      ],
      逻辑: 'AND',
    });
  }

  /**
   * Create segment for enterprise customers
   */
  async createEnterpriseSegment(): Promise<Segment> {
    return this.createSegment({
      name: 'Enterprise Customers',
      description: 'Enterprise tier customers',
      conditions: [
        {
          attribute: 'customAttributes.tier',
          operator: 'equals',
          value: 'enterprise',
        },
      ],
      逻辑: 'AND',
    });
  }

  // ========================================================================
  // Targeting Rules
  // ========================================================================

  /**
   * Create targeting rule for flag
   */
  async createTargetingRule(rule: TargetingRule): Promise<string> {
    const ruleId = this.generateRuleId();

    // Store targeting rule (would use storage in production)
    // For now, return the ID
    return ruleId;
  }

  /**
   * Evaluate targeting rules
   */
  async evaluateTargetingRules(
    rules: TargetingRule[],
    userId: string,
    attributes: UserAttributes
  ): Promise<TargetingRule | null> {
    // Sort rules by priority (if available)
    const sortedRules = [...rules].sort((a, b) => {
      // Higher priority first
      const priorityA = (a as any).priority || 0;
      const priorityB = (b as any).priority || 0;
      return priorityB - priorityA;
    });

    // Find first matching rule
    for (const rule of sortedRules) {
      if (!rule.enabled) {
        continue;
      }

      let matches = false;

      if (rule.segmentId) {
        matches = await this.matchesSegment(rule.segmentId, userId, attributes);
      } else if (rule.conditions) {
        matches = this.matchesConditions(
          rule.conditions,
          'AND',
          attributes
        );
      }

      if (matches) {
        return rule;
      }
    }

    return null;
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear segment cache
   */
  clearSegmentCache(): void {
    this.segmentCache.clear();
  }

  /**
   * Clear evaluation cache
   */
  clearEvaluationCache(): void {
    this.evaluationCache.clear();
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.clearSegmentCache();
    this.clearEvaluationCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    segmentCacheSize: number;
    evaluationCacheSize: number;
  } {
    return {
      segmentCacheSize: this.segmentCache.size,
      evaluationCacheSize: this.evaluationCache.size,
    };
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private generateSegmentId(): string {
    return `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Segment Builder
// ============================================================================

export class SegmentBuilder {
  private conditions: Condition[] = [];
  private 逻辑: 'AND' | 'OR' = 'AND';
  private userIds: string[] = [];
  private name: string = '';
  private description: string = '';

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  setLogic(逻辑: 'AND' | 'OR'): this {
    this.逻辑 = 逻辑;
    return this;
  }

  addCondition(
    attribute: string,
    operator: RuleOperator,
    value: unknown
  ): this {
    this.conditions.push({ attribute, operator, value });
    return this;
  }

  addUser(userId: string): this {
    this.userIds.push(userId);
    return this;
  }

  addUsers(userIds: string[]): this {
    this.userIds.push(...userIds);
    return this;
  }

  build(): SegmentConfig {
    return {
      name: this.name,
      description: this.description,
      conditions: this.conditions,
      逻辑: this.逻辑,
      userIds: this.userIds.length > 0 ? this.userIds : undefined,
    };
  }
}

// ============================================================================
// Attribute Providers
// ============================================================================

export interface AttributeProvider {
  getAttributes(userId: string): Promise<UserAttributes>;
}

/**
 * IP-based geographic attribute provider
 */
export class GeoAttributeProvider implements AttributeProvider {
  private ipGeoService: (ip: string) => Promise<{ country: string; region: string }>;

  constructor(
    ipGeoService: (ip: string) => Promise<{ country: string; region: string }>
  ) {
    this.ipGeoService = ipGeoService;
  }

  async getAttributes(userId: string): Promise<UserAttributes> {
    // In production, you would look up the user's IP and resolve it
    // For now, return empty attributes
    return {
      userId,
      country: 'US',
      region: 'CA',
    };
  }
}

/**
 * User agent-based device attribute provider
 */
export class DeviceAttributeProvider implements AttributeProvider {
  async getAttributes(userId: string): Promise<UserAttributes> {
    // In production, you would parse user agent strings
    // For now, return default attributes
    return {
      userId,
      deviceType: 'desktop',
      os: 'Windows',
      browser: 'Chrome',
    };
  }
}

/**
 * Composite attribute provider that combines multiple providers
 */
export class CompositeAttributeProvider implements AttributeProvider {
  private providers: AttributeProvider[];

  constructor(providers: AttributeProvider[]) {
    this.providers = providers;
  }

  async getAttributes(userId: string): Promise<UserAttributes> {
    const baseAttributes: UserAttributes = { userId };

    for (const provider of this.providers) {
      const attributes = await provider.getAttributes(userId);
      Object.assign(baseAttributes, attributes);
    }

    return baseAttributes;
  }
}
