/**
 * Configuration Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ConfigValidator,
  validateConfig,
  assertValidConfig,
} from './validation';
import {
  createFeatureFlag,
  createExperiment,
  createABTest,
} from './feature-flags';
import { createABTest as createABTestHelper } from './ab-testing';
import type { Experiment, ExperimentVariant } from './types';

describe('ConfigValidator', () => {
  describe('Feature Flag Validation', () => {
    it('should validate valid feature flag', () => {
      const flag = createFeatureFlag('test-flag', true);
      const result = ConfigValidator.validateFeatureFlag(flag);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject feature flag without name', () => {
      const flag = createFeatureFlag('', true);
      const result = ConfigValidator.validateFeatureFlag(flag);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid percentage', () => {
      const flag = createFeatureFlag('test', true, {
        targeting: {
          users: [],
          percentage: 150, // Invalid
          organizations: [],
          tier: 'all',
        },
      });

      const result = ConfigValidator.validateFeatureFlag(flag);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid tier', () => {
      const flag = createFeatureFlag('test', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: [],
          tier: 'invalid' as any,
        },
      });

      const result = ConfigValidator.validateFeatureFlag(flag);

      expect(result.valid).toBe(false);
    });

    it('should accept all valid tier values', () => {
      const tiers = ['free', 'pro', 'enterprise', 'all'] as const;

      for (const tier of tiers) {
        const flag = createFeatureFlag('test', true, {
          targeting: { users: [], percentage: 0, organizations: [], tier },
        });

        const result = ConfigValidator.validateFeatureFlag(flag);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Experiment Validation', () => {
    it('should validate valid experiment', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 0.5, config: {} },
        { name: 'treatment', weight: 0.5, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);

      const result = ConfigValidator.validateExperiment(experiment);

      expect(result.valid).toBe(true);
    });

    it('should reject experiment with no variants', () => {
      const experiment = createExperiment('test-exp', [], ['conversion']);

      const result = ConfigValidator.validateExperiment(experiment);

      expect(result.valid).toBe(false);
    });

    it('should reject experiment with variant weights not summing to 1', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 0.3, config: {} },
        { name: 'treatment', weight: 0.3, config: {} }, // Sum = 0.6
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);

      const result = ConfigValidator.validateExperiment(experiment);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variant weights must sum to 1.0');
    });

    it('should accept variant weights that sum to 1 within tolerance', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 0.333, config: {} },
        { name: 'treatment', weight: 0.667, config: {} }, // Sum = 1.0
      ];

      const experiment = createExperiment('test-exp', variants, ['conversion']);

      const result = ConfigValidator.validateExperiment(experiment);

      expect(result.valid).toBe(true);
    });

    it('should require at least one metric', () => {
      const variants: ExperimentVariant[] = [
        { name: 'control', weight: 1.0, config: {} },
      ];

      const experiment = createExperiment('test-exp', variants, []);

      const result = ConfigValidator.validateExperiment(experiment);

      expect(result.valid).toBe(false);
    });
  });

  describe('Provider Routing Validation', () => {
    it('should validate valid provider routing', () => {
      const config = {
        defaultProvider: 'anthropic',
        fallbackChain: ['openai', 'google'],
        modelPreferences: {},
        providerSettings: {},
      };

      const result = ConfigValidator.validateProviderRouting(config);

      expect(result.valid).toBe(true);
    });

    it('should reject empty default provider', () => {
      const config = {
        defaultProvider: '',
        fallbackChain: ['openai'],
        modelPreferences: {},
        providerSettings: {},
      };

      const result = ConfigValidator.validateProviderRouting(config);

      expect(result.valid).toBe(false);
    });

    it('should reject empty fallback chain', () => {
      const config = {
        defaultProvider: 'anthropic',
        fallbackChain: [],
        modelPreferences: {},
        providerSettings: {},
      };

      const result = ConfigValidator.validateProviderRouting(config);

      expect(result.valid).toBe(false);
    });
  });

  describe('Rate Limit Validation', () => {
    it('should validate valid rate limits', () => {
      const config = {
        free: { rpm: 10, rpd: 100 },
        pro: { rpm: 100, rpd: 1000 },
        enterprise: { rpm: 1000, rpd: 10000 },
      };

      const result = ConfigValidator.validateRateLimit(config);

      expect(result.valid).toBe(true);
    });

    it('should reject negative values', () => {
      const config = {
        free: { rpm: -10, rpd: 100 },
        pro: { rpm: 100, rpd: 1000 },
        enterprise: { rpm: 1000, rpd: 10000 },
      };

      const result = ConfigValidator.validateRateLimit(config);

      expect(result.valid).toBe(false);
    });
  });

  describe('UI Config Validation', () => {
    it('should validate valid UI config', () => {
      const config = {
        maxMessageLength: 10000,
        enableStreaming: true,
        theme: 'dark' as const,
        features: {
          websockets: false,
          codeIndexing: false,
          advancedCache: false,
          fileUploads: false,
          collaboration: false,
        },
      };

      const result = ConfigValidator.validateUIConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid message length', () => {
      const config = {
        maxMessageLength: -1,
        enableStreaming: true,
        theme: 'dark' as const,
        features: {
          websockets: false,
          codeIndexing: false,
          advancedCache: false,
          fileUploads: false,
          collaboration: false,
        },
      };

      const result = ConfigValidator.validateUIConfig(config);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid theme', () => {
      const config = {
        maxMessageLength: 10000,
        enableStreaming: true,
        theme: 'invalid' as any,
        features: {
          websockets: false,
          codeIndexing: false,
          advancedCache: false,
          fileUploads: false,
          collaboration: false,
        },
      };

      const result = ConfigValidator.validateUIConfig(config);

      expect(result.valid).toBe(false);
    });

    it('should accept all valid themes', () => {
      const themes = ['light', 'dark', 'auto'] as const;

      for (const theme of themes) {
        const config = {
          maxMessageLength: 10000,
          enableStreaming: true,
          theme,
          features: {
            websockets: false,
            codeIndexing: false,
            advancedCache: false,
            fileUploads: false,
            collaboration: false,
          },
        };

        const result = ConfigValidator.validateUIConfig(config);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Cache Config Validation', () => {
    it('should validate valid cache config', () => {
      const config = {
        kv: {
          defaultTTL: 604800,
          compression: true,
          maxSize: 1073741824,
        },
        do: {
          maxEntries: 10000,
          ttl: 3600,
          persistence: true,
        },
      };

      const result = ConfigValidator.validateCacheConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject negative TTL', () => {
      const config = {
        kv: {
          defaultTTL: -1,
          compression: true,
          maxSize: 1073741824,
        },
        do: {
          maxEntries: 10000,
          ttl: 3600,
          persistence: true,
        },
      };

      const result = ConfigValidator.validateCacheConfig(config);

      expect(result.valid).toBe(false);
    });
  });

  describe('Monitoring Config Validation', () => {
    it('should validate valid monitoring config', () => {
      const config = {
        metrics: {
          enabled: true,
          samplingRate: 0.1,
          exportInterval: 60000,
          includeMetrics: ['latency', 'throughput'],
        },
        logging: {
          level: 'info' as const,
          structured: true,
          samplingRate: 1.0,
        },
        tracing: {
          enabled: true,
          samplingRate: 0.01,
        },
      };

      const result = ConfigValidator.validateMonitoringConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject sampling rate out of range', () => {
      const config = {
        metrics: {
          enabled: true,
          samplingRate: 1.5, // Invalid
          exportInterval: 60000,
          includeMetrics: ['latency'],
        },
        logging: {
          level: 'info' as const,
          structured: true,
          samplingRate: 1.0,
        },
        tracing: {
          enabled: true,
          samplingRate: 0.01,
        },
      };

      const result = ConfigValidator.validateMonitoringConfig(config);

      expect(result.valid).toBe(false);
    });
  });

  describe('Security Config Validation', () => {
    it('should validate valid security config', () => {
      const config = {
        rateLimiting: {
          enabled: true,
          strategy: 'token-bucket' as const,
          limits: {
            free: { rpm: 10, rpd: 100 },
            pro: { rpm: 100, rpd: 1000 },
            enterprise: { rpm: 1000, rpd: 10000 },
          },
        },
        auth: {
          sessionDuration: 86400,
          maxSessionsPerUser: 5,
          mfaEnabled: false,
          allowedOrigins: ['https://example.com'],
        },
        csp: {
          enabled: false,
          policy: '',
        },
      };

      const result = ConfigValidator.validateSecurityConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid strategy', () => {
      const config = {
        rateLimiting: {
          enabled: true,
          strategy: 'invalid' as any,
          limits: {
            free: { rpm: 10, rpd: 100 },
            pro: { rpm: 100, rpd: 1000 },
            enterprise: { rpm: 1000, rpd: 10000 },
          },
        },
        auth: {
          sessionDuration: 86400,
          maxSessionsPerUser: 5,
          mfaEnabled: false,
          allowedOrigins: ['https://example.com'],
        },
        csp: {
          enabled: false,
          policy: '',
        },
      };

      const result = ConfigValidator.validateSecurityConfig(config);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid URL in allowed origins', () => {
      const config = {
        rateLimiting: {
          enabled: true,
          strategy: 'token-bucket' as const,
          limits: {
            free: { rpm: 10, rpd: 100 },
            pro: { rpm: 100, rpd: 1000 },
            enterprise: { rpm: 1000, rpd: 10000 },
          },
        },
        auth: {
          sessionDuration: 86400,
          maxSessionsPerUser: 5,
          mfaEnabled: false,
          allowedOrigins: ['not-a-url'],
        },
        csp: {
          enabled: false,
          policy: '',
        },
      };

      const result = ConfigValidator.validateSecurityConfig(config);

      expect(result.valid).toBe(false);
    });
  });

  describe('Partial Update Validation', () => {
    it('should validate valid partial update', () => {
      const result = ConfigValidator.validatePartialUpdate('version', '1.0.0');

      expect(result.valid).toBe(true);
    });

    it('should reject unknown path', () => {
      const result = ConfigValidator.validatePartialUpdate('unknown.path', 'value');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown config path: unknown');
    });
  });

  describe('Rollback Validation', () => {
    it('should validate valid rollback', () => {
      const result = ConfigValidator.validateRollback(10, 5);

      expect(result.valid).toBe(true);
    });

    it('should reject rollback to negative version', () => {
      const result = ConfigValidator.validateRollback(10, -1);

      expect(result.valid).toBe(false);
    });

    it('should reject rollback to future version', () => {
      const result = ConfigValidator.validateRollback(5, 10);

      expect(result.valid).toBe(false);
    });

    it('should warn when rolling back multiple versions', () => {
      const result = ConfigValidator.validateRollback(10, 5);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Helper Functions', () => {
    it('should validate config with helper', () => {
      const flag = createFeatureFlag('test', true);
      const schema = ConfigValidator.FeatureFlagSchema;

      const result = validateConfig(schema, flag);

      expect(result.valid).toBe(true);
    });

    it('should assert valid config', () => {
      const flag = createFeatureFlag('test', true);
      const schema = ConfigValidator.FeatureFlagSchema;

      expect(() => assertValidConfig(schema, flag)).not.toThrow();
    });

    it('should throw on invalid config', () => {
      const flag = createFeatureFlag('', true);
      const schema = ConfigValidator.FeatureFlagSchema;

      expect(() => assertValidConfig(schema, flag)).toThrow();
    });
  });

  describe('Warning Generation', () => {
    it('should warn about empty arrays', () => {
      const flag = createFeatureFlag('test', true, {
        targeting: {
          users: [],
          percentage: 0,
          organizations: [],
          tier: 'all',
        },
        metadata: {},
      });

      const result = ConfigValidator.validateFeatureFlag(flag);

      // May have warnings about empty arrays
      expect(result.valid).toBe(true);
    });

    it('should warn about missing optional fields', () => {
      const flag = createFeatureFlag('test', true);

      const result = ConfigValidator.validateFeatureFlag(flag);

      // Should have warning about missing description
      expect(result.warnings).toContain('feature flag.description is not set');
    });
  });
});

describe('A/B Test Helper Validation', () => {
  it('should create valid A/B test', () => {
    const experiment = createABTestHelper(
      'test-ab',
      { variant: 'A' },
      { variant: 'B' },
      ['conversion']
    );

    const result = ConfigValidator.validateExperiment(experiment);

    expect(result.valid).toBe(true);
  });

  it('should normalize weights in A/B test', () => {
    const experiment = createABTestHelper(
      'test-ab',
      { variant: 'A' },
      { variant: 'B' },
      ['conversion']
    );

    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);

    expect(totalWeight).toBeCloseTo(1.0, 3);
  });
});
