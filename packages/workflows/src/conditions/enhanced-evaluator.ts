// @ts-nocheck
/**
 * Enhanced Condition Evaluator
 * Provides expression evaluation, conditional branching, loop handling, and rule engine
 */

import type {
  Condition,
  ConditionOperator,
  Operand,
  VariableReference,
  FunctionCall,
  NodeId
} from '../types';

export interface EvaluationContext {
  variables: Map<string, any>;
  nodeResults: Map<NodeId, any>;
  functions: Map<string, Function>;
  metadata?: Record<string, any>;
}

export interface EvaluationResult {
  value: any;
  type: 'boolean' | 'number' | 'string' | 'object' | 'array' | 'null';
  error?: string;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  conditions: Condition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

export interface RuleAction {
  type: 'set_variable' | 'execute_node' | 'skip_node' | 'notify' | 'custom';
  target: string;
  value?: any;
}

export interface DecisionTree {
  id: string;
  name: string;
  root: DecisionNode;
  variables: string[];
}

export interface DecisionNode {
  id: string;
  condition?: Condition;
  thenNode?: DecisionNode;
  elseNode?: DecisionNode;
  value?: any;
  actions?: RuleAction[];
}

export interface Expression {
  type: 'literal' | 'variable' | 'function' | 'binary' | 'unary' | 'conditional';
  value?: any;
  operator?: string;
  left?: Expression;
  right?: Expression;
  operands?: Expression[];
}

export class EnhancedConditionEvaluator {
  private context: EvaluationContext;
  private rules: Map<string, Rule>;
  private decisionTrees: Map<string, DecisionTree>;
  private cache: Map<string, EvaluationResult>;

  constructor(context?: EvaluationContext) {
    this.context = context || {
      variables: new Map(),
      nodeResults: new Map(),
      functions: new Map()
    };
    this.rules = new Map();
    this.decisionTrees = new Map();
    this.cache = new Map();

    this.initializeBuiltInFunctions();
  }

  /**
   * Initialize built-in functions
   */
  private initializeBuiltInFunctions(): void {
    // Math functions
    this.context.functions.set('abs', Math.abs);
    this.context.functions.set('ceil', Math.ceil);
    this.context.functions.set('floor', Math.floor);
    this.context.functions.set('round', Math.round);
    this.context.functions.set('max', Math.max);
    this.context.functions.set('min', Math.min);
    this.context.functions.set('random', Math.random);
    this.context.functions.set('sqrt', Math.sqrt);
    this.context.functions.set('pow', Math.pow);

    // String functions
    this.context.functions.set('toUpperCase', (str: string) => str.toUpperCase());
    this.context.functions.set('toLowerCase', (str: string) => str.toLowerCase());
    this.context.functions.set('trim', (str: string) => str.trim());
    this.context.functions.set('substring', (str: string, start: number, end?: number) =>
      str.substring(start, end)
    );
    this.context.functions.set('split', (str: string, separator: string) =>
      str.split(separator)
    );
    this.context.functions.set('join', (arr: string[], separator: string) =>
      arr.join(separator)
    );
    this.context.functions.set('replace', (str: string, search: string, replace: string) =>
      str.replace(new RegExp(search, 'g'), replace)
    );
    this.context.functions.set('length', (value: any) => {
      if (typeof value === 'string') return value.length;
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'object' && value !== null) return Object.keys(value).length;
      return 0;
    });

    // Array functions
    this.context.functions.set('indexOf', (arr: any[], item: any) => arr.indexOf(item));
    this.context.functions.set('includes', (arr: any[], item: any) => arr.includes(item));
    this.context.functions.set('push', (arr: any[], item: any) => [...arr, item]);
    this.context.functions.set('pop', (arr: any[]) => arr.slice(0, -1));
    this.context.functions.set('slice', (arr: any[], start: number, end?: number) =>
      arr.slice(start, end)
    );
    this.context.functions.set('filter', (arr: any[], predicate: (item: any) => boolean) =>
      arr.filter(predicate)
    );
    this.context.functions.set('map', (arr: any[], transform: (item: any) => any) =>
      arr.map(transform)
    );
    this.context.functions.set('reduce', (arr: any[], reducer: (acc: any, item: any) => any, initial: any) =>
      arr.reduce(reducer, initial)
    );

    // Date functions
    this.context.functions.set('now', () => new Date());
    this.context.functions.set('timestamp', () => Date.now());
    this.context.functions.set('date', (timestamp: number) => new Date(timestamp));
    this.context.functions.set('toISOString', (date: Date) => date.toISOString());

    // Type checking functions
    this.context.functions.set('isArray', (value: any) => Array.isArray(value));
    this.context.functions.set('isObject', (value: any) => typeof value === 'object' && value !== null);
    this.context.functions.set('isString', (value: any) => typeof value === 'string');
    this.context.functions.set('isNumber', (value: any) => typeof value === 'number');
    this.context.functions.set('isBoolean', (value: any) => typeof value === 'boolean');
    this.context.functions.set('isNull', (value: any) => value === null);
    this.context.functions.set('isUndefined', (value: any) => value === undefined);

    // Logic functions
    this.context.functions.set('all', (arr: any[], predicate: (item: any) => boolean) =>
      arr.every(predicate)
    );
    this.context.functions.set('any', (arr: any[], predicate: (item: any) => boolean) =>
      arr.some(predicate)
    );
    this.context.functions.set('none', (arr: any[], predicate: (item: any) => boolean) =>
      !arr.some(predicate)
    );
  }

  /**
   * Evaluate a condition
   */
  public async evaluate(
    condition: Condition,
    context?: EvaluationContext
  ): Promise<boolean> {
    const ctx = context || this.context;

    // Check cache
    const cacheKey = JSON.stringify(condition);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.value as boolean;
    }

    try {
      let result: boolean;

      if (condition.conditions && condition.conditions.length > 0) {
        // Complex condition with nested conditions
        result = await this.evaluateComplexCondition(condition, ctx);
      } else {
        // Simple condition
        result = await this.evaluateSimpleCondition(condition, ctx);
      }

      // Cache result
      this.cache.set(cacheKey, { value: result, type: 'boolean' });

      return result;
    } catch (error) {
      throw new Error(`Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Evaluate a simple condition
   */
  private async evaluateSimpleCondition(
    condition: Condition,
    context: EvaluationContext
  ): Promise<boolean> {
    const leftValue = await this.evaluateOperand(condition.leftOperand, context);
    const rightValue = condition.rightOperand
      ? await this.evaluateOperand(condition.rightOperand, context)
      : undefined;

    return this.applyOperator(condition.operator, leftValue, rightValue);
  }

  /**
   * Evaluate a complex condition with nested conditions
   */
  private async evaluateComplexCondition(
    condition: Condition,
    context: EvaluationContext
  ): Promise<boolean> {
    const results = await Promise.all(
      condition.conditions!.map(c => this.evaluate(c, context))
    );

    if (condition.logicOperator === 'AND') {
      return results.every(r => r);
    } else if (condition.logicOperator === 'OR') {
      return results.some(r => r);
    }

    return results[0];
  }

  /**
   * Evaluate an operand
   */
  private async evaluateOperand(
    operand: Operand,
    context: EvaluationContext
  ): Promise<any> {
    if (operand === null || operand === undefined) {
      return operand;
    }

    if (typeof operand === 'string' || typeof operand === 'number' || typeof operand === 'boolean') {
      return operand;
    }

    if (Array.isArray(operand)) {
      return Promise.all(operand.map(o => this.evaluateOperand(o, context)));
    }

    if (typeof operand === 'object') {
      if (this.isVariableReference(operand)) {
        return this.resolveVariable(operand as VariableReference, context);
      }

      if (this.isFunctionCall(operand)) {
        return this.executeFunction(operand as FunctionCall, context);
      }

      // Recursive object evaluation
      const result: any = {};
      for (const [key, value] of Object.entries(operand)) {
        result[key] = await this.evaluateOperand(value, context);
      }
      return result;
    }

    return operand;
  }

  /**
   * Check if operand is a variable reference
   */
  private isVariableReference(operand: any): operand is VariableReference {
    return operand && typeof operand === 'object' && operand.type === 'variable';
  }

  /**
   * Check if operand is a function call
   */
  private isFunctionCall(operand: any): operand is FunctionCall {
    return operand && typeof operand === 'object' && operand.type === 'function';
  }

  /**
   * Resolve a variable reference
   */
  private resolveVariable(
    reference: VariableReference,
    context: EvaluationContext
  ): any {
    const path = reference.path;
    let value: any = context.variables.get(path);

    // Handle nested paths
    if (path.includes('.')) {
      const parts = path.split('.');
      value = context.variables.get(parts[0]);

      for (let i = 1; i < parts.length; i++) {
        if (value && typeof value === 'object') {
          value = value[parts[i]];
        } else {
          value = undefined;
          break;
        }
      }
    }

    // Use default value if not found
    if (value === undefined && reference.defaultValue !== undefined) {
      return reference.defaultValue;
    }

    return value;
  }

  /**
   * Execute a function
   */
  private async executeFunction(
    call: FunctionCall,
    context: EvaluationContext
  ): Promise<any> {
    const func = context.functions.get(call.name);

    if (!func) {
      throw new Error(`Function not found: ${call.name}`);
    }

    // Evaluate arguments
    const args = await Promise.all(
      call.arguments.map(arg => this.evaluateOperand(arg, context))
    );

    try {
      return await func(...args);
    } catch (error) {
      throw new Error(`Function execution failed: ${call.name} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply operator
   */
  private applyOperator(
    operator: ConditionOperator,
    left: any,
    right?: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return left === right;

      case 'not_equals':
        return left !== right;

      case 'greater_than':
        return left > right;

      case 'less_than':
        return left < right;

      case 'greater_than_or_equal':
        return left >= right;

      case 'less_than_or_equal':
        return left <= right;

      case 'contains':
        if (Array.isArray(left)) {
          return left.includes(right);
        }
        if (typeof left === 'string') {
          return left.includes(right);
        }
        return false;

      case 'not_contains':
        return !this.applyOperator('contains', left, right);

      case 'starts_with':
        if (typeof left === 'string') {
          return left.startsWith(right);
        }
        return false;

      case 'ends_with':
        if (typeof left === 'string') {
          return left.endsWith(right);
        }
        return false;

      case 'in':
        return Array.isArray(right) && right.includes(left);

      case 'not_in':
        return !this.applyOperator('in', left, right);

      case 'is_null':
        return left === null || left === undefined;

      case 'is_not_null':
        return left !== null && left !== undefined;

      case 'matches_regex':
        if (typeof left === 'string' && typeof right === 'string') {
          try {
            const regex = new RegExp(right);
            return regex.test(left);
          } catch {
            return false;
          }
        }
        return false;

      case 'is_empty':
        if (Array.isArray(left)) return left.length === 0;
        if (typeof left === 'string') return left.length === 0;
        if (typeof left === 'object' && left !== null) return Object.keys(left).length === 0;
        return !left;

      case 'is_not_empty':
        return !this.applyOperator('is_empty', left, undefined);

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Evaluate an expression
   */
  public async evaluateExpression(
    expression: Expression,
    context?: EvaluationContext
  ): Promise<EvaluationResult> {
    const ctx = context || this.context;

    try {
      const value = await this.evaluateExpressionInternal(expression, ctx);

      return {
        value,
        type: this.getValueType(value)
      };
    } catch (error) {
      return {
        value: null,
        type: 'null',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Internal expression evaluation
   */
  private async evaluateExpressionInternal(
    expression: Expression,
    context: EvaluationContext
  ): Promise<any> {
    switch (expression.type) {
      case 'literal':
        return expression.value;

      case 'variable':
        return context.variables.get(expression.value as string);

      case 'function':
        const call = expression as any;
        return this.executeFunction({
          type: 'function',
          name: expression.value as string,
          arguments: expression.operands?.map(op => ({ type: 'literal', value: op })) || []
        }, context);

      case 'binary':
        const left = await this.evaluateExpressionInternal(expression.left!, context);
        const right = await this.evaluateExpressionInternal(expression.right!, context);
        return this.applyBinaryOperator(expression.operator!, left, right);

      case 'unary':
        const operand = await this.evaluateExpressionInternal(expression.left!, context);
        return this.applyUnaryOperator(expression.operator!, operand);

      case 'conditional':
        const condition = await this.evaluateExpressionInternal(expression.left!, context);
        return condition
          ? await this.evaluateExpressionInternal(expression.right!, context)
          : await this.evaluateExpressionInternal(expression.operands![0], context);

      default:
        throw new Error(`Unknown expression type: ${expression.type}`);
    }
  }

  /**
   * Apply binary operator
   */
  private applyBinaryOperator(operator: string, left: any, right: any): any {
    switch (operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '%': return left % right;
      case '&&': return left && right;
      case '||': return left || right;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      default: throw new Error(`Unknown binary operator: ${operator}`);
    }
  }

  /**
   * Apply unary operator
   */
  private applyUnaryOperator(operator: string, operand: any): any {
    switch (operator) {
      case '!': return !operand;
      case '-': return -operand;
      case '+': return +operand;
      case 'typeof': return typeof operand;
      default: throw new Error(`Unknown unary operator: ${operator}`);
    }
  }

  /**
   * Get value type
   */
  private getValueType(value: any): EvaluationResult['type'] {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    return 'null';
  }

  /**
   * Register a rule
   */
  public registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Evaluate rules
   */
  public async evaluateRules(
    ruleIds?: string[],
    context?: EvaluationContext
  ): Promise<Rule[]> {
    const rules = ruleIds
      ? ruleIds.map(id => this.rules.get(id)).filter((r): r is Rule => !!r)
      : Array.from(this.rules.values());

    const matched: Rule[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const conditionsMet = await this.evaluateRuleConditions(rule, context);
      if (conditionsMet) {
        matched.push(rule);
      }
    }

    // Sort by priority
    return matched.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateRuleConditions(
    rule: Rule,
    context?: EvaluationContext
  ): Promise<boolean> {
    for (const condition of rule.conditions) {
      const result = await this.evaluate(condition, context);
      if (!result) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute rule actions
   */
  public async executeRuleActions(
    rule: Rule,
    context?: EvaluationContext
  ): Promise<void> {
    for (const action of rule.actions) {
      await this.executeAction(action, context);
    }
  }

  /**
   * Execute a rule action
   */
  private async executeAction(
    action: RuleAction,
    context?: EvaluationContext
  ): Promise<void> {
    const ctx = context || this.context;

    switch (action.type) {
      case 'set_variable':
        ctx.variables.set(action.target, action.value);
        break;

      case 'notify':
        // Trigger notification
        console.log(`Notification: ${action.target}`, action.value);
        break;

      case 'skip_node':
        // Mark node to be skipped
        console.log(`Skipping node: ${action.target}`);
        break;

      case 'execute_node':
        // Schedule node for execution
        console.log(`Executing node: ${action.target}`);
        break;

      case 'custom':
        // Execute custom action
        console.log(`Custom action: ${action.target}`, action.value);
        break;
    }
  }

  /**
   * Register a decision tree
   */
  public registerDecisionTree(tree: DecisionTree): void {
    this.decisionTrees.set(tree.id, tree);
  }

  /**
   * Evaluate a decision tree
   */
  public async evaluateDecisionTree(
    treeId: string,
    context?: EvaluationContext
  ): Promise<any> {
    const tree = this.decisionTrees.get(treeId);
    if (!tree) {
      throw new Error(`Decision tree not found: ${treeId}`);
    }

    return this.evaluateDecisionNode(tree.root, context || this.context);
  }

  /**
   * Evaluate a decision node
   */
  private async evaluateDecisionNode(
    node: DecisionNode,
    context: EvaluationContext
  ): Promise<any> {
    if (node.condition) {
      const result = await this.evaluate(node.condition, context);

      if (result && node.thenNode) {
        return await this.evaluateDecisionNode(node.thenNode, context);
      } else if (!result && node.elseNode) {
        return await this.evaluateDecisionNode(node.elseNode, context);
      }
    }

    // Execute actions if any
    if (node.actions) {
      for (const action of node.actions) {
        await this.executeAction(action, context);
      }
    }

    return node.value;
  }

  /**
   * Parse and evaluate a string expression
   */
  public async evaluateStringExpression(
    expression: string,
    context?: EvaluationContext
  ): Promise<EvaluationResult> {
    const parsed = this.parseExpression(expression);
    return this.evaluateExpression(parsed, context);
  }

  /**
   * Parse a string expression
   */
  private parseExpression(expression: string): Expression {
    // Simplified parser - in production, use a proper expression parser
    // This is a basic implementation for common cases

    expression = expression.trim();

    // Handle literals
    if (expression === 'true') return { type: 'literal', value: true };
    if (expression === 'false') return { type: 'literal', value: false };
    if (expression === 'null') return { type: 'literal', value: null };

    // Handle numbers
    if (/^\d+(\.\d+)?$/.test(expression)) {
      return { type: 'literal', value: parseFloat(expression) };
    }

    // Handle strings
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return { type: 'literal', value: expression.slice(1, -1) };
    }

    // Handle variables
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression)) {
      return { type: 'variable', value: expression };
    }

    // Handle binary operators
    const operators = ['&&', '\\|\\|', '==', '!=', '<=', '>=', '<', '>', '\\+', '-', '\\*', '/', '%'];
    for (const op of operators) {
      const regex = new RegExp(`^(.+)\\s*${op}\\s*(.+)$`);
      const match = expression.match(regex);
      if (match) {
        return {
          type: 'binary',
          operator: op.replace(/\\/g, ''),
          left: this.parseExpression(match[1]),
          right: this.parseExpression(match[2])
        };
      }
    }

    // Handle unary operators
    if (expression.startsWith('!')) {
      return {
        type: 'unary',
        operator: '!',
        left: this.parseExpression(expression.slice(1))
      };
    }

    // Default to variable
    return { type: 'variable', value: expression };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set context
   */
  public setContext(context: EvaluationContext): void {
    this.context = context;
    this.clearCache();
  }

  /**
   * Get context
   */
  public getContext(): EvaluationContext {
    return this.context;
  }
}
