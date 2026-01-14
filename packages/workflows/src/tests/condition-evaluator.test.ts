/**
 * Tests for Enhanced Condition Evaluator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedConditionEvaluator } from '../conditions/enhanced-evaluator';
import type { Condition, ConditionOperator } from '../types';

describe('EnhancedConditionEvaluator', () => {
  let evaluator: EnhancedConditionEvaluator;

  beforeEach(() => {
    evaluator = new EnhancedConditionEvaluator();
  });

  describe('Basic Condition Evaluation', () => {
    it('should evaluate equals condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: 'testValue',
        rightOperand: 'testValue'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate not equals condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'not_equals' as ConditionOperator,
        leftOperand: 'testValue',
        rightOperand: 'otherValue'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate greater than condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'greater_than' as ConditionOperator,
        leftOperand: 10,
        rightOperand: 5
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate less than condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'less_than' as ConditionOperator,
        leftOperand: 5,
        rightOperand: 10
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate contains condition for arrays', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'contains' as ConditionOperator,
        leftOperand: [1, 2, 3, 4, 5],
        rightOperand: 3
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate contains condition for strings', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'contains' as ConditionOperator,
        leftOperand: 'Hello World',
        rightOperand: 'World'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate in condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'in' as ConditionOperator,
        leftOperand: 'apple',
        rightOperand: ['apple', 'banana', 'orange']
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate is null condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'is_null' as ConditionOperator,
        leftOperand: null
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate is not null condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'is_not_null' as ConditionOperator,
        leftOperand: 'value'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate matches regex condition', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'matches_regex' as ConditionOperator,
        leftOperand: 'test@example.com',
        rightOperand: '^[a-z]+@[a-z]+\\.[a-z]+$'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate is empty condition for arrays', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'is_empty' as ConditionOperator,
        leftOperand: []
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate is empty condition for strings', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'is_empty' as ConditionOperator,
        leftOperand: ''
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });
  });

  describe('Variable References', () => {
    it('should resolve variable references', async () => {
      const context = evaluator.getContext();
      context.variables.set('testVar', 'testValue');

      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: { type: 'variable', path: 'testVar' },
        rightOperand: 'testValue'
      };

      const result = await evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should use default value for undefined variables', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'variable',
          path: 'undefinedVar',
          defaultValue: 'defaultValue'
        },
        rightOperand: 'defaultValue'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should resolve nested variable paths', async () => {
      const context = evaluator.getContext();
      context.variables.set('user', { name: 'John', age: 30 });

      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: { type: 'variable', path: 'user.name' },
        rightOperand: 'John'
      };

      const result = await evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('Function Calls', () => {
    it('should execute built-in functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'toUpperCase',
          arguments: ['hello']
        },
        rightOperand: 'HELLO'
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should execute math functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'max',
          arguments: [1, 5, 3]
        },
        rightOperand: 5
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should execute string functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'length',
          arguments: ['hello']
        },
        rightOperand: 5
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should execute array functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'includes',
          arguments: [[1, 2, 3], 2]
        },
        rightOperand: true
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should execute date functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'greater_than' as ConditionOperator,
        leftOperand: { type: 'function', name: 'timestamp', arguments: [] },
        rightOperand: 0
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should execute type checking functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'isArray',
          arguments: [[1, 2, 3]]
        },
        rightOperand: true
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should throw error for unknown functions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'unknownFunction',
          arguments: []
        },
        rightOperand: 'value'
      };

      await expect(evaluator.evaluate(condition)).rejects.toThrow();
    });
  });

  describe('Complex Conditions', () => {
    it('should evaluate AND conditions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: 5,
        rightOperand: 5,
        logicOperator: 'AND',
        conditions: [
          {
            id: 'cond-2',
            operator: 'equals' as ConditionOperator,
            leftOperand: 10,
            rightOperand: 10
          }
        ]
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate OR conditions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: 5,
        rightOperand: 10,
        logicOperator: 'OR',
        conditions: [
          {
            id: 'cond-2',
            operator: 'equals' as ConditionOperator,
            leftOperand: 10,
            rightOperand: 10
          }
        ]
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });

    it('should evaluate nested complex conditions', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: 5,
        rightOperand: 5,
        logicOperator: 'AND',
        conditions: [
          {
            id: 'cond-2',
            operator: 'equals' as ConditionOperator,
            leftOperand: 10,
            rightOperand: 10,
            logicOperator: 'OR',
            conditions: [
              {
                id: 'cond-3',
                operator: 'equals' as ConditionOperator,
                leftOperand: 20,
                rightOperand: 20
              }
            ]
          }
        ]
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(true);
    });
  });

  describe('Expression Evaluation', () => {
    it('should evaluate literal expressions', async () => {
      const result = await evaluator.evaluateStringExpression('42');

      expect(result.value).toBe(42);
      expect(result.type).toBe('number');
    });

    it('should evaluate boolean literals', async () => {
      const result = await evaluator.evaluateStringExpression('true');

      expect(result.value).toBe(true);
      expect(result.type).toBe('boolean');
    });

    it('should evaluate string literals', async () => {
      const result = await evaluator.evaluateStringExpression('"hello"');

      expect(result.value).toBe('hello');
      expect(result.type).toBe('string');
    });

    it('should evaluate binary operators', async () => {
      const result = await evaluator.evaluateStringExpression('5 + 3');

      expect(result.value).toBe(8);
    });

    it('should evaluate comparison operators', async () => {
      const result = await evaluator.evaluateStringExpression('5 > 3');

      expect(result.value).toBe(true);
    });

    it('should evaluate logical operators', async () => {
      const result = await evaluator.evaluateStringExpression('true && false');

      expect(result.value).toBe(false);
    });

    it('should evaluate unary operators', async () => {
      const result = await evaluator.evaluateStringExpression('!true');

      expect(result.value).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should cache evaluation results', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: 'testValue',
        rightOperand: 'testValue'
      };

      await evaluator.evaluate(condition);
      const result2 = await evaluator.evaluate(condition);

      expect(result2).toBe(true);
    });

    it('should clear cache', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: 'testValue',
        rightOperand: 'testValue'
      };

      await evaluator.evaluate(condition);
      evaluator.clearCache();

      // Should re-evaluate
      const result2 = await evaluator.evaluate(condition);
      expect(result2).toBe(true);
    });
  });

  describe('Rules', () => {
    it('should register and evaluate rules', async () => {
      const rule = {
        id: 'rule-1',
        name: 'Test Rule',
        conditions: [
          {
            id: 'cond-1',
            operator: 'equals' as ConditionOperator,
            leftOperand: 5,
            rightOperand: 5
          },
          {
            id: 'cond-2',
            operator: 'equals' as ConditionOperator,
            leftOperand: 10,
            rightOperand: 10
          }
        ],
        actions: [
          {
            type: 'set_variable',
            target: 'result',
            value: 'matched'
          }
        ],
        priority: 1,
        enabled: true
      };

      evaluator.registerRule(rule);

      const matched = await evaluator.evaluateRules(['rule-1']);

      expect(matched).toHaveLength(1);
      expect(matched[0].id).toBe('rule-1');
    });

    it('should skip disabled rules', async () => {
      const rule = {
        id: 'rule-1',
        name: 'Test Rule',
        conditions: [
          {
            id: 'cond-1',
            operator: 'equals' as ConditionOperator,
            leftOperand: 5,
            rightOperand: 5
          }
        ],
        actions: [],
        priority: 1,
        enabled: false
      };

      evaluator.registerRule(rule);

      const matched = await evaluator.evaluateRules(['rule-1']);

      expect(matched).toHaveLength(0);
    });
  });

  describe('Decision Trees', () => {
    it('should register and evaluate decision trees', async () => {
      const tree = {
        id: 'tree-1',
        name: 'Test Tree',
        root: {
          id: 'node-1',
          condition: {
            id: 'cond-1',
            operator: 'equals' as ConditionOperator,
            leftOperand: 5,
            rightOperand: 5
          },
          thenNode: {
            id: 'node-2',
            value: 'thenBranch'
          },
          elseNode: {
            id: 'node-3',
            value: 'elseBranch'
          }
        },
        variables: []
      };

      evaluator.registerDecisionTree(tree);

      const result = await evaluator.evaluateDecisionTree('tree-1');

      expect(result).toBe('thenBranch');
    });

    it('should navigate to else branch when condition false', async () => {
      const tree = {
        id: 'tree-1',
        name: 'Test Tree',
        root: {
          id: 'node-1',
          condition: {
            id: 'cond-1',
            operator: 'equals' as ConditionOperator,
            leftOperand: 5,
            rightOperand: 10
          },
          thenNode: {
            id: 'node-2',
            value: 'thenBranch'
          },
          elseNode: {
            id: 'node-3',
            value: 'elseBranch'
          }
        },
        variables: []
      };

      evaluator.registerDecisionTree(tree);

      const result = await evaluator.evaluateDecisionTree('tree-1');

      expect(result).toBe('elseBranch');
    });
  });

  describe('Custom Functions', () => {
    it('should register and execute custom functions', async () => {
      const context = evaluator.getContext();
      context.functions.set('customAdd', (a: number, b: number) => a + b);

      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: {
          type: 'function',
          name: 'customAdd',
          arguments: [5, 3]
        },
        rightOperand: 8
      };

      const result = await evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle division by zero gracefully', async () => {
      const result = await evaluator.evaluateStringExpression('5 / 0');

      expect(result.value).toBe(Infinity);
    });

    it('should handle invalid regex patterns', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'matches_regex' as ConditionOperator,
        leftOperand: 'test',
        rightOperand: '[invalid('
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(false);
    });

    it('should handle undefined variables without default', async () => {
      const condition: Condition = {
        id: 'cond-1',
        operator: 'equals' as ConditionOperator,
        leftOperand: { type: 'variable', path: 'undefinedVar' },
        rightOperand: null
      };

      const result = await evaluator.evaluate(condition);

      expect(result).toBe(false); // undefined != null
    });
  });
});
