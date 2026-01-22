/**
 * Unit tests for alerting engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AlertingEngine,
  ConditionEvaluator,
  AlertRuleBuilder,
  type AlertRule,
  type AlertCondition,
  type AlertSeverity,
} from '../../src/alerting/engine';

describe('AlertingEngine', () => {
  let engine: AlertingEngine;

  beforeEach(() => {
    engine = new AlertingEngine();
  });

  afterEach(() => {
    engine.shutdown();
  });

  describe('Rule Management', () => {
    it('should add an alert rule', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Test Rule',
        description: 'A test alert rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      const rules = engine.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual(rule);
    });

    it('should remove an alert rule', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Test Rule',
        description: 'A test alert rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      expect(engine.getRules()).toHaveLength(1);
      
      const removed = engine.removeRule('rule-1');
      expect(removed).toBe(true);
      expect(engine.getRules()).toHaveLength(0);
    });

    it('should get rule by ID', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Test Rule',
        description: 'A test alert rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      const retrieved = engine.getRule('rule-1');
      expect(retrieved).toEqual(rule);
    });
  });

  describe('Condition Evaluation', () => {
    it('should trigger alert when threshold exceeded', async () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Value Rule',
        description: 'Alert when value exceeds threshold',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      await engine.evaluateMetric('test_metric', 150);
      
      const alerts = engine.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].value).toBe(150);
    });

    it('should not trigger alert when threshold not met', async () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Value Rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      await engine.evaluateMetric('test_metric', 50);
      
      const alerts = engine.getActiveAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should resolve alert when condition no longer met', async () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Value Rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      await engine.evaluateMetric('test_metric', 150);
      expect(engine.getActiveAlerts()).toHaveLength(1);
      
      await engine.evaluateMetric('test_metric', 50);
      expect(engine.getActiveAlerts()).toHaveLength(0);
    });

    it('should not trigger disabled rules', async () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Disabled Rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: false,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      await engine.evaluateMetric('test_metric', 150);
      
      const alerts = engine.getActiveAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Alert History', () => {
    it('should track alert history', async () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Test Rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      await engine.evaluateMetric('test_metric', 150);
      await engine.evaluateMetric('test_metric', 50);
      
      const history = engine.getAlertHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].ruleId).toBe('rule-1');
    });

    it('should limit alert history', async () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Test Rule',
        condition: {
          type: 'threshold',
          metric: 'test_metric',
          threshold: 100,
          operator: 'gt',
        },
        actions: [],
        enabled: true,
        severity: 'warning',
      };

      engine.addRule(rule);
      
      for (let i = 0; i < 10; i++) {
        await engine.evaluateMetric('test_metric', 150 + i);
        await engine.evaluateMetric('test_metric', 50);
      }
      
      const history = engine.getAlertHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });
});

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
  });

  describe('Threshold Conditions', () => {
    it('should evaluate gt operator', () => {
      const condition: AlertCondition = {
        type: 'threshold',
        threshold: 100,
        operator: 'gt',
      };
      
      expect(evaluator.evaluate(condition, 150)).toBe(true);
      expect(evaluator.evaluate(condition, 100)).toBe(false);
      expect(evaluator.evaluate(condition, 50)).toBe(false);
    });

    it('should evaluate gte operator', () => {
      const condition: AlertCondition = {
        type: 'threshold',
        threshold: 100,
        operator: 'gte',
      };
      
      expect(evaluator.evaluate(condition, 150)).toBe(true);
      expect(evaluator.evaluate(condition, 100)).toBe(true);
      expect(evaluator.evaluate(condition, 50)).toBe(false);
    });

    it('should evaluate lt operator', () => {
      const condition: AlertCondition = {
        type: 'threshold',
        threshold: 100,
        operator: 'lt',
      };
      
      expect(evaluator.evaluate(condition, 50)).toBe(true);
      expect(evaluator.evaluate(condition, 100)).toBe(false);
      expect(evaluator.evaluate(condition, 150)).toBe(false);
    });

    it('should evaluate lte operator', () => {
      const condition: AlertCondition = {
        type: 'threshold',
        threshold: 100,
        operator: 'lte',
      };
      
      expect(evaluator.evaluate(condition, 50)).toBe(true);
      expect(evaluator.evaluate(condition, 100)).toBe(true);
      expect(evaluator.evaluate(condition, 150)).toBe(false);
    });

    it('should evaluate eq operator', () => {
      const condition: AlertCondition = {
        type: 'threshold',
        threshold: 100,
        operator: 'eq',
      };
      
      expect(evaluator.evaluate(condition, 100)).toBe(true);
      expect(evaluator.evaluate(condition, 50)).toBe(false);
      expect(evaluator.evaluate(condition, 150)).toBe(false);
    });

    it('should evaluate neq operator', () => {
      const condition: AlertCondition = {
        type: 'threshold',
        threshold: 100,
        operator: 'neq',
      };
      
      expect(evaluator.evaluate(condition, 100)).toBe(false);
      expect(evaluator.evaluate(condition, 50)).toBe(true);
      expect(evaluator.evaluate(condition, 150)).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies in normal distribution', () => {
      const condition: AlertCondition = {
        type: 'anomaly',
        threshold: 2,
      };
      
      // Generate normal distribution data
      const history: number[] = [];
      for (let i = 0; i < 100; i++) {
        history.push(50 + Math.random() * 10);
      }
      
      // Normal value should not be anomaly
      expect(evaluator.evaluate(condition, 52, history)).toBe(false);
      
      // Extreme value should be anomaly
      expect(evaluator.evaluate(condition, 100, history)).toBe(true);
      expect(evaluator.evaluate(condition, 0, history)).toBe(true);
    });

    it('should require minimum history for anomaly detection', () => {
      const condition: AlertCondition = {
        type: 'anomaly',
        threshold: 2,
      };
      
      const history = [1, 2, 3];
      
      // Should not detect anomaly with insufficient history
      expect(evaluator.evaluate(condition, 100, history)).toBe(false);
    });
  });
});

describe('AlertRuleBuilder', () => {
  it('should build a complete alert rule', () => {
    const rule = new AlertRuleBuilder()
      .setId('rule-1')
      .setName('Test Rule')
      .setDescription('A test rule')
      .setCondition({
        type: 'threshold',
        metric: 'test_metric',
        threshold: 100,
        operator: 'gt',
      })
      .setSeverity('warning')
      .setCooldown(60000)
      .setEnabled(true)
      .build();
    
    expect(rule.id).toBe('rule-1');
    expect(rule.name).toBe('Test Rule');
    expect(rule.description).toBe('A test rule');
    expect(rule.severity).toBe('warning');
    expect(rule.cooldown).toBe(60000);
    expect(rule.enabled).toBe(true);
  });

  it('should throw error for incomplete rule', () => {
    expect(() => {
      new AlertRuleBuilder()
        .setId('rule-1')
        .build();
    }).toThrow();
  });
});
