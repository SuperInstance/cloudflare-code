import { describe, it, expect } from 'vitest';
import {
  PolicyEngine,
  PolicyValidator,
  SOC2_POLICIES,
  EvaluationContext
} from '../src/policies';
import { ComplianceStandard, ComplianceStatus } from '../src/types';

describe('PolicyEngine', () => {
  it('should load and evaluate policies', async () => {
    const engine = new PolicyEngine();

    // Load SOC 2 policies
    engine.loadPolicies(SOC2_POLICIES);

    const stats = engine.getStatistics();
    expect(stats.totalPolicies).toBeGreaterThan(0);
    expect(stats.totalRules).toBeGreaterThan(0);
  });

  it('should evaluate policy against context', async () => {
    const engine = new PolicyEngine();
    engine.loadPolicies(SOC2_POLICIES);

    const context: EvaluationContext = {
      target: {
        authentication: {
          mfaEnabled: true,
          mfaCoverage: '100%'
        },
        passwordPolicy: {
          minLength: 12,
          requireComplexity: true
        }
      },
      timestamp: new Date(),
      evaluator: 'test'
    };

    const result = await engine.evaluatePolicy('soc2-cc-6.1', context);

    expect(result).toBeDefined();
    expect(result.policyId).toBe('soc2-cc-6.1');
    expect(result.status).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should cache evaluation results', async () => {
    const engine = new PolicyEngine({
      enableCaching: true,
      cacheTimeout: 10000
    });

    engine.loadPolicies(SOC2_POLICIES);

    const context: EvaluationContext = {
      target: { test: true },
      timestamp: new Date(),
      evaluator: 'test'
    };

    const result1 = await engine.evaluatePolicy('soc2-cc-6.1', context);
    const result2 = await engine.evaluatePolicy('soc2-cc-6.1', context);

    expect(result1).toEqual(result2);
  });

  it('should clear cache', () => {
    const engine = new PolicyEngine();
    engine.clearCache();
    // Should not throw
    expect(true).toBe(true);
  });
});

describe('PolicyValidator', () => {
  it('should validate valid policy', () => {
    const validator = new PolicyValidator();
    const policy = SOC2_POLICIES[0];

    const result = validator.validatePolicy(policy);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', () => {
    const validator = new PolicyValidator();
    const invalidPolicy = {
      id: 'test-policy'
    } as any;

    const result = validator.validatePolicy(invalidPolicy);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate rule conditions', () => {
    const validator = new PolicyValidator();
    const policy = SOC2_POLICIES[0];

    const result = validator.validatePolicy(policy);

    // Check that rules with conditions are validated
    const ruleErrors = result.errors.filter(e => e.field.includes('rules'));
    expect(ruleErrors.length).toBe(0);
  });

  it('should validate policy update', () => {
    const validator = new PolicyValidator();
    const oldPolicy = SOC2_POLICIES[0];
    const newPolicy = {
      ...oldPolicy,
      version: '1.1.0',
      lastReviewed: new Date()
    };

    const result = validator.validatePolicyUpdate(oldPolicy, newPolicy);

    expect(result.valid).toBe(true);
  });

  it('should reject version downgrade', () => {
    const validator = new PolicyValidator();
    const oldPolicy = SOC2_POLICIES[0];
    const newPolicy = {
      ...oldPolicy,
      version: '0.9.0'
    };

    const result = validator.validatePolicyUpdate(oldPolicy, newPolicy);

    expect(result.valid).toBe(false);
    const versionErrors = result.errors.filter(e => e.field === 'version');
    expect(versionErrors.length).toBeGreaterThan(0);
  });
});

describe('Policy Definitions', () => {
  it('should have SOC 2 policies', () => {
    expect(SOC2_POLICIES.length).toBeGreaterThan(0);
  });

  it('should have policies with required structure', () => {
    SOC2_POLICIES.forEach(policy => {
      expect(policy.id).toBeDefined();
      expect(policy.name).toBeDefined();
      expect(policy.standard).toBe(ComplianceStandard.SOC2);
      expect(policy.rules).toBeDefined();
      expect(policy.controls).toBeDefined();
    });
  });

  it('should have rules with severity levels', () => {
    SOC2_POLICIES.forEach(policy => {
      policy.rules.forEach(rule => {
        expect(rule.severity).toBeDefined();
        expect(['critical', 'high', 'medium', 'low', 'info']).toContain(rule.severity);
      });
    });
  });
});
