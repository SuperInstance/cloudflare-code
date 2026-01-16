// @ts-nocheck
/**
 * Condition Evaluator - evaluates workflow conditions
 */

import type { Condition, ConditionOperator, ExecutionContext } from '../types';

export class ConditionEvaluator {
  /**
   * Evaluate a condition
   */
  public async evaluate(
    condition: Condition,
    context: ExecutionContext
  ): Promise<boolean> {
    const leftValue = this.resolveOperand(condition.leftOperand, context);
    const rightValue = condition.rightOperand
      ? this.resolveOperand(condition.rightOperand, context)
      : null;

    let result: boolean;

    switch (condition.operator) {
      case 'equals':
        result = this.equals(leftValue, rightValue);
        break;

      case 'not_equals':
        result = !this.equals(leftValue, rightValue);
        break;

      case 'greater_than':
        result = this.greaterThan(leftValue, rightValue);
        break;

      case 'less_than':
        result = this.lessThan(leftValue, rightValue);
        break;

      case 'greater_than_or_equal':
        result = this.greaterThan(leftValue, rightValue) || this.equals(leftValue, rightValue);
        break;

      case 'less_than_or_equal':
        result = this.lessThan(leftValue, rightValue) || this.equals(leftValue, rightValue);
        break;

      case 'contains':
        result = this.contains(leftValue, rightValue);
        break;

      case 'not_contains':
        result = !this.contains(leftValue, rightValue);
        break;

      case 'starts_with':
        result = this.startsWith(leftValue, rightValue);
        break;

      case 'ends_with':
        result = this.endsWith(leftValue, rightValue);
        break;

      case 'in':
        result = this.in(leftValue, rightValue);
        break;

      case 'not_in':
        result = !this.in(leftValue, rightValue);
        break;

      case 'is_null':
        result = leftValue === null || leftValue === undefined;
        break;

      case 'is_not_null':
        result = leftValue !== null && leftValue !== undefined;
        break;

      case 'matches_regex':
        result = this.matchesRegex(leftValue, rightValue);
        break;

      case 'is_empty':
        result = this.isEmpty(leftValue);
        break;

      case 'is_not_empty':
        result = !this.isEmpty(leftValue);
        break;

      default:
        throw new Error(`Unknown operator: ${condition.operator}`);
    }

    // Handle nested conditions with AND/OR
    if (condition.conditions && condition.conditions.length > 0) {
      const nestedResults = await Promise.all(
        condition.conditions.map(c => this.evaluate(c, context))
      );

      if (condition.logicOperator === 'AND') {
        result = result && nestedResults.every(r => r);
      } else if (condition.logicOperator === 'OR') {
        result = result || nestedResults.some(r => r);
      }
    }

    return result;
  }

  /**
   * Evaluate multiple conditions with logic operator
   */
  public async evaluateAll(
    conditions: Condition[],
    logicOperator: 'AND' | 'OR',
    context: ExecutionContext
  ): Promise<boolean> {
    const results = await Promise.all(
      conditions.map(c => this.evaluate(c, context))
    );

    if (logicOperator === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Resolve an operand to its actual value
   */
  private resolveOperand(operand: any, context: ExecutionContext): any {
    if (typeof operand === 'object' && operand !== null) {
      if (operand.type === 'variable') {
        return this.getVariableValue(operand.path, context);
      } else if (operand.type === 'function') {
        return this.executeFunction(operand, context);
      }
    }

    return operand;
  }

  /**
   * Get variable value from context
   */
  private getVariableValue(path: string, context: ExecutionContext): any {
    const parts = path.split('.');
    let value: any = context.variables;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Execute a function
   */
  private executeFunction(funcCall: any, context: ExecutionContext): any {
    const { name, arguments: args } = funcCall;

    switch (name) {
      case 'length':
        const arr = this.resolveOperand(args[0], context);
        return Array.isArray(arr) ? arr.length : 0;

      case 'upper':
        const str1 = this.resolveOperand(args[0], context);
        return typeof str1 === 'string' ? str1.toUpperCase() : str1;

      case 'lower':
        const str2 = this.resolveOperand(args[0], context);
        return typeof str2 === 'string' ? str2.toLowerCase() : str2;

      case 'trim':
        const str3 = this.resolveOperand(args[0], context);
        return typeof str3 === 'string' ? str3.trim() : str3;

      case 'split':
        const str4 = this.resolveOperand(args[0], context);
        const sep = this.resolveOperand(args[1], context);
        return typeof str4 === 'string' ? str4.split(sep) : [];

      case 'join':
        const arr = this.resolveOperand(args[0], context);
        const sep2 = this.resolveOperand(args[1], context);
        return Array.isArray(arr) ? arr.join(sep2) : '';

      case 'now':
        return new Date().toISOString();

      case 'timestamp':
        return Date.now();

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  // ========================================================================
  // Comparison Operators
  // ========================================================================

  private equals(left: any, right: any): boolean {
    if (Array.isArray(left) && Array.isArray(right)) {
      return (
        left.length === right.length &&
        left.every((val, idx) => val === right[idx])
      );
    }

    if (typeof left === 'object' && typeof right === 'object') {
      return JSON.stringify(left) === JSON.stringify(right);
    }

    return left === right;
  }

  private greaterThan(left: any, right: any): boolean {
    const leftNum = Number(left);
    const rightNum = Number(right);
    return leftNum > rightNum;
  }

  private lessThan(left: any, right: any): boolean {
    const leftNum = Number(left);
    const rightNum = Number(right);
    return leftNum < rightNum;
  }

  private contains(left: any, right: any): boolean {
    if (typeof left === 'string') {
      return left.includes(String(right));
    }

    if (Array.isArray(left)) {
      return left.includes(right);
    }

    return false;
  }

  private startsWith(left: any, right: any): boolean {
    if (typeof left === 'string' && typeof right === 'string') {
      return left.startsWith(right);
    }

    return false;
  }

  private endsWith(left: any, right: any): boolean {
    if (typeof left === 'string' && typeof right === 'string') {
      return left.endsWith(right);
    }

    return false;
  }

  private in(left: any, right: any): boolean {
    if (Array.isArray(right)) {
      return right.includes(left);
    }

    if (typeof right === 'string') {
      return right.includes(String(left));
    }

    return false;
  }

  private matchesRegex(left: any, right: any): boolean {
    if (typeof left !== 'string' || typeof right !== 'string') {
      return false;
    }

    try {
      const regex = new RegExp(right);
      return regex.test(left);
    } catch {
      return false;
    }
  }

  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }

    return false;
  }
}
