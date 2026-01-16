// @ts-nocheck
/**
 * Condition Builder - fluent API for building conditions
 */

import type { Condition, ConditionOperator } from '../types';

export class ConditionBuilder {
  private condition: Condition;

  constructor() {
    this.condition = {
      id: `condition-${Date.now()}`,
      operator: 'equals',
      leftOperand: '',
      rightOperand: ''
    };
  }

  /**
   * Set the condition operator
   */
  public operator(operator: ConditionOperator): ConditionBuilder {
    this.condition.operator = operator;
    return this;
  }

  /**
   * Set the left operand
   */
  public left(value: any): ConditionBuilder {
    this.condition.leftOperand = value;
    return this;
  }

  /**
   * Set the right operand
   */
  public right(value: any): ConditionBuilder {
    this.condition.rightOperand = value;
    return this;
  }

  /**
   * Set both operands
   */
  public operands(left: any, right: any): ConditionBuilder {
    this.condition.leftOperand = left;
    this.condition.rightOperand = right;
    return this;
  }

  /**
   * Add nested conditions with AND logic
   */
  public and(...conditions: Condition[]): ConditionBuilder {
    this.condition.logicOperator = 'AND';
    this.condition.conditions = conditions;
    return this;
  }

  /**
   * Add nested conditions with OR logic
   */
  public or(...conditions: Condition[]): ConditionBuilder {
    this.condition.logicOperator = 'OR';
    this.condition.conditions = conditions;
    return this;
  }

  /**
   * Build the condition
   */
  public build(): Condition {
    return { ...this.condition };
  }

  // ========================================================================
  // Convenience Methods
  // ========================================================================

  /**
   * Create an equals condition
   */
  public static equals(left: any, right: any): Condition {
    return new ConditionBuilder()
      .operator('equals')
      .operands(left, right)
      .build();
  }

  /**
   * Create a not equals condition
   */
  public static notEquals(left: any, right: any): Condition {
    return new ConditionBuilder()
      .operator('not_equals')
      .operands(left, right)
      .build();
  }

  /**
   * Create a greater than condition
   */
  public static greaterThan(left: any, right: any): Condition {
    return new ConditionBuilder()
      .operator('greater_than')
      .operands(left, right)
      .build();
  }

  /**
   * Create a less than condition
   */
  public static lessThan(left: any, right: any): Condition {
    return new ConditionBuilder()
      .operator('less_than')
      .operands(left, right)
      .build();
  }

  /**
   * Create a contains condition
   */
  public static contains(left: any, right: any): Condition {
    return new ConditionBuilder()
      .operator('contains')
      .operands(left, right)
      .build();
  }

  /**
   * Create an AND condition
   */
  public static and(...conditions: Condition[]): Condition {
    return new ConditionBuilder().and(...conditions).build();
  }

  /**
   * Create an OR condition
   */
  public static or(...conditions: Condition[]): Condition {
    return new ConditionBuilder().or(...conditions).build();
  }
}

/**
 * Helper functions for creating conditions
 */
export const Conditions = {
  equals: (left: any, right: any) => ConditionBuilder.equals(left, right),
  notEquals: (left: any, right: any) => ConditionBuilder.notEquals(left, right),
  greaterThan: (left: any, right: any) => ConditionBuilder.greaterThan(left, right),
  lessThan: (left: any, right: any) => ConditionBuilder.lessThan(left, right),
  greaterThanOrEqual: (left: any, right: any) =>
    new ConditionBuilder().operator('greater_than_or_equal').operands(left, right).build(),
  lessThanOrEqual: (left: any, right: any) =>
    new ConditionBuilder().operator('less_than_or_equal').operands(left, right).build(),
  contains: (left: any, right: any) => ConditionBuilder.contains(left, right),
  notContains: (left: any, right: any) =>
    new ConditionBuilder().operator('not_contains').operands(left, right).build(),
  startsWith: (left: any, right: any) =>
    new ConditionBuilder().operator('starts_with').operands(left, right).build(),
  endsWith: (left: any, right: any) =>
    new ConditionBuilder().operator('ends_with').operands(left, right).build(),
  in: (left: any, right: any) =>
    new ConditionBuilder().operator('in').operands(left, right).build(),
  notIn: (left: any, right: any) =>
    new ConditionBuilder().operator('not_in').operands(left, right).build(),
  isNull: (value: any) =>
    new ConditionBuilder().operator('is_null').left(value).build(),
  isNotNull: (value: any) =>
    new ConditionBuilder().operator('is_not_null').left(value).build(),
  isEmpty: (value: any) =>
    new ConditionBuilder().operator('is_empty').left(value).build(),
  isNotEmpty: (value: any) =>
    new ConditionBuilder().operator('is_not_empty').left(value).build(),
  and: (...conditions: Condition[]) => ConditionBuilder.and(...conditions),
  or: (...conditions: Condition[]) => ConditionBuilder.or(...conditions)
};
