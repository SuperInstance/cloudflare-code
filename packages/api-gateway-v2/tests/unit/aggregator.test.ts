/**
 * Unit tests for Response Aggregator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResponseAggregator,
  ConflictResolver,
  createMergePolicy,
  createConflictResolution,
  createDeduplicationConfig,
  validateAggregationConfig,
  createDefaultAggregationConfig,
} from '../../src/aggregation/aggregator';
import { AggregationConfig, MergePolicy } from '../../src/types';

describe('ResponseAggregator', () => {
  let aggregator: ResponseAggregator;
  let config: AggregationConfig;

  beforeEach(() => {
    config = createDefaultAggregationConfig();
    aggregator = new ResponseAggregator(config);
  });

  describe('initialization', () => {
    it('should create aggregator instance', () => {
      expect(aggregator).toBeInstanceOf(ResponseAggregator);
    });
  });

  describe('aggregation', () => {
    it('should aggregate empty sources', async () => {
      const sources = new Map();
      const result = await aggregator.aggregate(sources);

      expect(result.data).toEqual({});
      expect(result.metadata.sourceCount).toBe(0);
    });

    it('should aggregate single source', async () => {
      const sources = new Map([
        ['service1', { id: 1, name: 'test' }],
      ]);
      const result = await aggregator.aggregate(sources);

      expect(result.data).toEqual({ id: 1, name: 'test' });
      expect(result.metadata.sourceCount).toBe(1);
    });

    it('should merge data from multiple sources', async () => {
      const sources = new Map([
        ['service1', { id: 1, name: 'test' }],
        ['service2', { age: 25 }],
      ]);
      const result = await aggregator.aggregate(sources);

      expect(result.data).toHaveProperty('id', 1);
      expect(result.data).toHaveProperty('name', 'test');
      expect(result.data).toHaveProperty('age', 25);
    });

    it('should handle conflicting values', async () => {
      const sources = new Map([
        ['service1', { id: 1, value: 'a' }],
        ['service2', { id: 1, value: 'b' }],
      ]);

      const result = await aggregator.aggregate(sources);

      // Should resolve conflict using configured strategy
      expect(result.data.value).toBeDefined();
    });
  });

  describe('deduplication', () => {
    it('should deduplicate by key fields', async () => {
      const configWithDedup: AggregationConfig = {
        ...config,
        deduplication: {
          enabled: true,
          keyFields: ['id'],
          strategy: 'first',
        },
      };

      const dedupAggregator = new ResponseAggregator(configWithDedup);

      const sources = new Map([
        ['service1', { id: 1, name: 'first' }],
        ['service2', { id: 1, name: 'second' }],
      ]);

      const result = await dedupAggregator.aggregate(sources);

      expect(result.metadata.duplicates).toHaveLength(1);
      expect(result.metadata.duplicates[0].key).toBe('1');
    });
  });

  describe('custom resolvers', () => {
    it('should register custom resolver', () => {
      const resolver: ConflictResolver = (key, a, b) => {
        return typeof a === 'number' && typeof b === 'number' ? a + b : b;
      };

      aggregator.registerResolver('sum', resolver);

      // Should not throw
      expect(() => aggregator.registerResolver('sum', resolver)).not.toThrow();
    });
  });
});

describe('createMergePolicy', () => {
  it('should create overwrite policy', () => {
    const policy = createMergePolicy('overwrite');

    expect(policy.type).toBe('overwrite');
  });

  it('should create merge policy with priority', () => {
    const policy = createMergePolicy('merge', { priority: 10 });

    expect(policy.type).toBe('merge');
    expect(policy.priority).toBe(10);
  });

  it('should create custom policy with transformer', () => {
    const policy = createMergePolicy('custom', {
      transformer: 'timestamp',
    });

    expect(policy.type).toBe('custom');
    expect(policy.transformer).toBe('timestamp');
  });
});

describe('createConflictResolution', () => {
  it('should create with default strategy', () => {
    const config = createConflictResolution('last-write-wins');

    expect(config.strategy).toBe('last-write-wins');
  });

  it('should create with field policies', () => {
    const fieldPolicies = new Map([
      ['field1', { strategy: 'first-write-wins' as const }],
    ]);

    const config = createConflictResolution('merge', fieldPolicies);

    expect(config.strategy).toBe('merge');
    expect(config.fieldPolicies).toBe(fieldPolicies);
  });
});

describe('createDeduplicationConfig', () => {
  it('should create with default strategy', () => {
    const config = createDeduplicationConfig(['id']);

    expect(config.enabled).toBe(true);
    expect(config.keyFields).toEqual(['id']);
    expect(config.strategy).toBe('first');
  });

  it('should create with custom strategy', () => {
    const config = createDeduplicationConfig(['id', 'email'], 'last');

    expect(config.strategy).toBe('last');
  });
});

describe('validateAggregationConfig', () => {
  it('should validate valid config', () => {
    const config: AggregationConfig = createDefaultAggregationConfig();

    expect(() => validateAggregationConfig(config)).not.toThrow();
  });

  it('should reject invalid strategy', () => {
    const config = {
      strategy: 'invalid',
      mergePolicies: new Map(),
      conflictResolution: { strategy: 'last-write-wins' as const },
      deduplication: {
        enabled: false,
        keyFields: ['id'],
        strategy: 'first' as const,
      },
    } as any;

    expect(() => validateAggregationConfig(config)).toThrow();
  });

  it('should reject deduplication without key fields', () => {
    const config = {
      strategy: 'merge' as const,
      mergePolicies: new Map(),
      conflictResolution: { strategy: 'last-write-wins' as const },
      deduplication: {
        enabled: true,
        keyFields: [],
        strategy: 'first' as const,
      },
    } as any;

    expect(() => validateAggregationConfig(config)).toThrow();
  });
});
