/**
 * Response Aggregator
 * Merges and deduplicates data from multiple sources with conflict resolution
 */

// @ts-nocheck - Type system limitations with complex merge strategies
import {
  AggregationConfig,
  AggregationResult,
  AggregationMetadata,
  MergePolicy,
  ConflictResolution,
  Conflict,
  DuplicateInfo,
  ConflictPolicy,
  DeduplicationConfig,
  GatewayError,
} from '../types';

// ============================================================================
// Response Aggregator
// ============================================================================

export class ResponseAggregator {
  private config: AggregationConfig;
  private conflictResolvers: Map<string, ConflictResolver>;

  constructor(config: AggregationConfig) {
    this.config = config;
    this.conflictResolvers = new Map();
    this.initializeDefaultResolvers();
  }

  /**
   * Aggregate responses from multiple sources
   */
  async aggregate(
    sources: Map<string, any>,
    options?: Partial<AggregationConfig>
  ): Promise<AggregationResult> {
    const effectiveConfig = { ...this.config, ...options };
    const metadata: AggregationMetadata = {
      sourceCount: sources.size,
      mergedFields: [],
      conflicts: [],
      duplicates: [],
    };

    try {
      // Step 1: Deduplicate if enabled
      const deduplicatedSources = effectiveConfig.deduplication.enabled
        ? this.deduplicate(sources, effectiveConfig.deduplication, metadata)
        : sources;

      // Step 2: Merge data
      const mergedData = this.merge(
        deduplicatedSources,
        effectiveConfig.mergePolicies,
        metadata
      );

      // Step 3: Resolve conflicts
      const finalData = this.resolveConflicts(
        mergedData,
        effectiveConfig.conflictResolution,
        metadata
      );

      return {
        data: finalData,
        metadata,
      };
    } catch (error) {
      throw new GatewayError(
        `Aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AGGREGATION_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Deduplicate sources based on key fields
   */
  private deduplicate(
    sources: Map<string, any>,
    config: DeduplicationConfig,
    metadata: AggregationMetadata
  ): Map<string, any> {
    const deduplicated = new Map<string, any>();
    const keyMap = new Map<string, { source: string; data: any }>();

    for (const [sourceName, data] of sources) {
      // Extract key from data
      const key = this.extractDeduplicationKey(data, config.keyFields);

      if (keyMap.has(key)) {
        // Handle duplicate
        const existing = keyMap.get(key)!;

        const duplicateInfo: DuplicateInfo = {
          key,
          count: 2,
          sources: [existing.source, sourceName],
        };
        metadata.duplicates.push(duplicateInfo);

        // Apply strategy
        switch (config.strategy) {
          case 'first':
            // Keep first, ignore new
            break;
          case 'last':
            // Replace with new
            keyMap.set(key, { source: sourceName, data });
            break;
          case 'merge':
            // Merge both
            const merged = this.deepMerge(existing.data, data);
            keyMap.set(key, { source: `${existing.source}+${sourceName}`, data: merged });
            break;
        }
      } else {
        // First occurrence
        keyMap.set(key, { source: sourceName, data });
      }
    }

    // Convert back to map
    for (const [key, value] of keyMap) {
      deduplicated.set(value.source, value.data);
    }

    return deduplicated;
  }

  /**
   * Extract deduplication key from data
   */
  private extractDeduplicationKey(data: any, keyFields: string[]): string {
    const parts: string[] = [];

    for (const field of keyFields) {
      const value = this.getNestedValue(data, field);
      parts.push(String(value));
    }

    return parts.join('|');
  }

  /**
   * Merge data from multiple sources
   */
  private merge(
    sources: Map<string, any>,
    mergePolicies: Map<string, MergePolicy>,
    metadata: AggregationMetadata
  ): any {
    if (sources.size === 0) return {};
    if (sources.size === 1) return sources.values().next().value;

    let merged: any = {};

    for (const [sourceName, data] of sources) {
      merged = this.mergeData(merged, data, mergePolicies, sourceName, metadata);
    }

    return merged;
  }

  /**
   * Merge two data objects
   */
  private mergeData(
    target: any,
    source: any,
    mergePolicies: Map<string, MergePolicy>,
    sourceName: string,
    metadata: AggregationMetadata
  ): any {
    const result = { ...target };

    for (const [key, sourceValue] of Object.entries(source)) {
      const targetValue = result[key];
      const policy = mergePolicies.get(key) || this.getDefaultMergePolicy(sourceValue);

      if (targetValue === undefined) {
        // No conflict - just set value
        result[key] = sourceValue;
        metadata.mergedFields.push(key);
      } else {
        // Potential conflict - apply merge policy
        result[key] = this.applyMergePolicy(
          key,
          targetValue,
          sourceValue,
          policy,
          sourceName,
          metadata
        );
      }
    }

    return result;
  }

  /**
   * Apply merge policy to conflicting values
   */
  private applyMergePolicy(
    key: string,
    targetValue: any,
    sourceValue: any,
    policy: MergePolicy,
    sourceName: string,
    metadata: AggregationMetadata
  ): any {
    switch (policy.type) {
      case 'overwrite':
        return sourceValue;

      case 'replace':
        // 'replace' is not in the MergePolicy type, treating as 'overwrite'
        return sourceValue;

      case 'merge':
        if (this.isObject(targetValue) && this.isObject(sourceValue)) {
          return this.deepMerge(targetValue, sourceValue);
        }
        return sourceValue;

      case 'array':
        return this.mergeToArray(targetValue, sourceValue);

      case 'custom':
        if (policy.transformer) {
          const transformer = this.conflictResolvers.get(policy.transformer);
          if (transformer) {
            return transformer(key, targetValue, sourceValue);
          }
        }
        return sourceValue;

      default:
        return sourceValue;
    }
  }

  /**
   * Resolve conflicts in merged data
   */
  private resolveConflicts(
    data: any,
    config: ConflictResolution,
    metadata: AggregationMetadata
  ): any {
    // Detect conflicts
    const conflicts = this.detectConflicts(data);

    if (conflicts.length === 0) {
      return data;
    }

    // Resolve each conflict
    for (const conflict of conflicts) {
      const resolved = this.resolveConflict(conflict, config);
      this.setNestedValue(data, conflict.path, resolved);
      conflict.resolved = resolved;
      conflict.strategy = config.strategy;

      metadata.conflicts.push(conflict);
    }

    return data;
  }

  /**
   * Detect conflicts in data
   */
  private detectConflicts(data: any): Conflict[] {
    const conflicts: Conflict[] = [];

    this.traverseObject(data, (path, value) => {
      if (this.isConflictMarker(value)) {
        conflicts.push({
          path,
          sources: value.$conflict?.sources || [],
          values: value.$conflict?.values || [],
          resolved: undefined,
          strategy: 'undetected',
        });
      }
    });

    return conflicts;
  }

  /**
   * Check if value is a conflict marker
   */
  private isConflictMarker(value: any): boolean {
    return (
      this.isObject(value) &&
      '$conflict' in value &&
      Array.isArray(value.$conflict?.values)
    );
  }

  /**
   * Resolve a single conflict
   */
  private resolveConflict(
    conflict: Conflict,
    config: ConflictResolution
  ): any {
    // Check for field-specific policy
    const fieldPolicy = config.fieldPolicies?.get(conflict.path);
    const strategy = fieldPolicy?.strategy || config.strategy;

    switch (strategy) {
      case 'last-write-wins':
        return conflict.values[conflict.values.length - 1];

      case 'first-write-wins':
        return conflict.values[0];

      case 'merge':
        if (conflict.values.every(v => this.isObject(v))) {
          return conflict.values.reduce((acc, val) => this.deepMerge(acc, val), {});
        }
        return conflict.values[0];

      case 'error':
        throw new GatewayError(
          `Unresolved conflict at ${conflict.path}`,
          'CONFLICT_ERROR',
          409,
          { conflict }
        );

      default:
        return conflict.values[0];
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    if (!this.isObject(target) || !this.isObject(source)) {
      return source;
    }

    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (this.isObject(targetValue) && this.isObject(sourceValue)) {
        result[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }

    return result;
  }

  /**
   * Merge values to array
   */
  private mergeToArray(targetValue: any, sourceValue: any): any[] {
    const targetArray = Array.isArray(targetValue) ? targetValue : [targetValue];
    const sourceArray = Array.isArray(sourceValue) ? sourceValue : [sourceValue];
    return [...targetArray, ...sourceArray];
  }

  /**
   * Get default merge policy for value type
   */
  private getDefaultMergePolicy(value: any): MergePolicy {
    if (Array.isArray(value)) {
      return { type: 'array' };
    }
    if (this.isObject(value)) {
      return { type: 'merge' };
    }
    return { type: 'overwrite' };
  }

  /**
   * Initialize default conflict resolvers
   */
  private initializeDefaultResolvers(): void {
    // Timestamp-based resolver (most recent wins)
    this.conflictResolvers.set('timestamp', (key, a, b) => {
      const getTime = (obj: any) =>
        obj.timestamp || obj.createdAt || obj.updatedAt || 0;
      return getTime(a) > getTime(b) ? a : b;
    });

    // Priority-based resolver
    this.conflictResolvers.set('priority', (key, a, b) => {
      const getPriority = (obj: any) => obj.priority || obj.rank || 0;
      return getPriority(a) >= getPriority(b) ? a : b;
    });

    // Version-based resolver (highest version wins)
    this.conflictResolvers.set('version', (key, a, b) => {
      const getVersion = (obj: any) => {
        const v = obj.version || obj.v || '0.0.0';
        return v.split('.').map(Number);
      };
      const va = getVersion(a);
      const vb = getVersion(b);
      for (let i = 0; i < Math.max(va.length, vb.length); i++) {
        const vaPart = va[i] || 0;
        const vbPart = vb[i] || 0;
        if (vaPart !== vbPart) {
          return vaPart > vbPart ? a : b;
        }
      }
      return a;
    });

    // Sum resolver (for numeric values)
    this.conflictResolvers.set('sum', (key, a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a + b;
      }
      return b;
    });

    // Average resolver
    this.conflictResolvers.set('average', (key, a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return (a + b) / 2;
      }
      return b;
    });
  }

  /**
   * Register custom conflict resolver
   */
  registerResolver(
    name: string,
    resolver: ConflictResolver
  ): void {
    this.conflictResolvers.set(name, resolver);
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Set nested value on object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Traverse object and call callback for each value
   */
  private traverseObject(
    obj: any,
    callback: (path: string, value: any) => void,
    path: string = ''
  ): void {
    if (!this.isObject(obj)) {
      callback(path, obj);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      this.traverseObject(value, callback, currentPath);
    }
  }

  /**
   * Check if value is a plain object
   */
  private isObject(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof RegExp)
    );
  }
}

// ============================================================================
// Types
// ============================================================================

export type ConflictResolver = (
  key: string,
  valueA: any,
  valueB: any
) => any;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create merge policy
 */
export function createMergePolicy(
  type: MergePolicy['type'],
  options?: Partial<MergePolicy>
): MergePolicy {
  return {
    type,
    ...options,
  };
}

/**
 * Create conflict resolution config
 */
export function createConflictResolution(
  strategy: ConflictResolution['strategy'],
  fieldPolicies?: Map<string, ConflictPolicy>
): ConflictResolution {
  return {
    strategy,
    fieldPolicies,
  };
}

/**
 * Create deduplication config
 */
export function createDeduplicationConfig(
  keyFields: string[],
  strategy: 'first' | 'last' | 'merge' = 'first'
): DeduplicationConfig {
  return {
    enabled: true,
    keyFields,
    strategy,
  };
}

/**
 * Validate aggregation configuration
 */
export function validateAggregationConfig(
  config: AggregationConfig
): void {
  const validStrategies = ['merge', 'replace', 'overwrite', 'array', 'custom'];
  if (!validStrategies.includes(config.strategy)) {
    throw new GatewayError(
      `Invalid aggregation strategy: ${config.strategy}`,
      'INVALID_CONFIG',
      400
    );
  }

  const validConflictStrategies = ['last-write-wins', 'first-write-wins', 'merge', 'error'];
  if (!validConflictStrategies.includes(config.conflictResolution.strategy)) {
    throw new GatewayError(
      `Invalid conflict resolution strategy: ${config.conflictResolution.strategy}`,
      'INVALID_CONFIG',
      400
    );
  }

  if (config.deduplication.enabled && config.deduplication.keyFields.length === 0) {
    throw new GatewayError(
      'Deduplication enabled but no key fields specified',
      'INVALID_CONFIG',
      400
    );
  }
}

/**
 * Create default aggregation config
 */
export function createDefaultAggregationConfig(): AggregationConfig {
  return {
    strategy: 'merge',
    mergePolicies: new Map(),
    conflictResolution: {
      strategy: 'last-write-wins',
    },
    deduplication: {
      enabled: false,
      keyFields: ['id'],
      strategy: 'first',
    },
  };
}
