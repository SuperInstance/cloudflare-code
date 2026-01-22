import {
  PolicyDefinition,
  PolicyEvaluationResult,
  PolicyViolation,
  ComplianceStatus,
  SeverityLevel
} from '../types';

/**
 * Policy evaluation context
 */
export interface EvaluationContext {
  target: any;
  timestamp: Date;
  evaluator: string;
  metadata?: Record<string, any>;
}

/**
 * Policy engine configuration
 */
export interface PolicyEngineConfig {
  enableCaching?: boolean;
  cacheTimeout?: number;
  maxEvaluationTime?: number;
  parallelEvaluation?: boolean;
}

/**
 * Policy engine for evaluating policies against targets
 */
export class PolicyEngine {
  private policies: Map<string, PolicyDefinition> = new Map();
  private cache: Map<string, { result: PolicyEvaluationResult; timestamp: number }> = new Map();
  private config: PolicyEngineConfig;

  constructor(config: PolicyEngineConfig = {}) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      maxEvaluationTime: 30000, // 30 seconds
      parallelEvaluation: true,
      ...config
    };
  }

  /**
   * Load a policy into the engine
   */
  loadPolicy(policy: PolicyDefinition): void {
    this.policies.set(policy.id, policy);
    this.invalidateCache(policy.id);
  }

  /**
   * Load multiple policies
   */
  loadPolicies(policies: PolicyDefinition[]): void {
    policies.forEach(policy => this.loadPolicy(policy));
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all loaded policies
   */
  getAllPolicies(): PolicyDefinition[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policies by standard
   */
  getPoliciesByStandard(standard: string): PolicyDefinition[] {
    return Array.from(this.policies.values()).filter(p => p.standard === standard);
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): boolean {
    this.invalidateCache(policyId);
    return this.policies.delete(policyId);
  }

  /**
   * Evaluate a single policy
   */
  async evaluatePolicy(
    policyId: string,
    context: EvaluationContext
  ): Promise<PolicyEvaluationResult> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // Check cache
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(policyId, context);
      if (cached) {
        return cached;
      }
    }

    const startTime = Date.now();
    const violations: PolicyViolation[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Evaluate each rule
    for (const rule of policy.rules) {
      try {
        const result = await this.evaluateRule(rule, context.target, policy.id);

        if (result.passed) {
          passedCount++;
        } else {
          failedCount++;
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            description: result.message || `Rule failed: ${rule.description}`,
            actualValue: result.actualValue,
            expectedValue: result.expectedValue,
            location: result.location,
            remediation: rule.remediation
          });
        }
      } catch (error) {
        skippedCount++;
        console.warn(`Failed to evaluate rule ${rule.id}:`, error);
      }
    }

    // Calculate compliance status and score
    const status = this.calculateStatus(passedCount, failedCount, skippedCount);
    const score = this.calculateScore(passedCount, failedCount, skippedCount);

    const result: PolicyEvaluationResult = {
      policyId: policy.id,
      policyName: policy.name,
      timestamp: context.timestamp,
      status,
      passedRules: passedCount,
      failedRules: failedCount,
      skippedRules: skippedCount,
      totalRules: policy.rules.length,
      violations,
      score
    };

    // Cache result
    if (this.config.enableCaching) {
      this.setCachedResult(policyId, context, result);
    }

    return result;
  }

  /**
   * Evaluate multiple policies
   */
  async evaluatePolicies(
    policyIds: string[],
    context: EvaluationContext
  ): Promise<PolicyEvaluationResult[]> {
    if (this.config.parallelEvaluation) {
      return Promise.all(
        policyIds.map(id => this.evaluatePolicy(id, context))
      );
    } else {
      const results: PolicyEvaluationResult[] = [];
      for (const id of policyIds) {
        results.push(await this.evaluatePolicy(id, context));
      }
      return results;
    }
  }

  /**
   * Evaluate all loaded policies
   */
  async evaluateAllPolicies(context: EvaluationContext): Promise<PolicyEvaluationResult[]> {
    const policyIds = Array.from(this.policies.keys());
    return this.evaluatePolicies(policyIds, context);
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    rule: any,
    target: any,
    policyId: string
  ): Promise<{
    passed: boolean;
    message?: string;
    actualValue?: any;
    expectedValue?: any;
    location?: string;
  }> {
    if (!rule.automatedCheck) {
      return {
        passed: false,
        message: 'Manual check required - cannot be automatically evaluated'
      };
    }

    try {
      // Parse and evaluate condition
      const result = this.evaluateCondition(rule.condition, target);

      return {
        passed: result,
        actualValue: this.extractActualValue(rule.condition, target),
        expectedValue: rule.expectedValue !== undefined ? rule.expectedValue : true,
        location: this.extractLocation(target)
      };
    } catch (error) {
      return {
        passed: false,
        message: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Evaluate a condition against a target
   */
  private evaluateCondition(condition: string, target: any): boolean {
    // Handle simple comparisons
    if (condition.includes('===') || condition.includes('!==') ||
        condition.includes('==') || condition.includes('!=') ||
        condition.includes('>=') || condition.includes('<=') ||
        condition.includes('>') || condition.includes('<')) {
      return this.evaluateComparison(condition, target);
    }

    // Handle logical operators
    if (condition.includes('&&')) {
      const parts = condition.split('&&').map(s => s.trim());
      return parts.every(part => this.evaluateCondition(part, target));
    }

    if (condition.includes('||')) {
      const parts = condition.split('||').map(s => s.trim());
      return parts.some(part => this.evaluateCondition(part, target));
    }

    // Handle simple property checks
    if (condition.includes('=== true')) {
      const path = condition.replace('=== true', '').trim();
      const value = this.getValueByPath(path, target);
      return value === true;
    }

    if (condition.includes('=== false')) {
      const path = condition.replace('=== false', '').trim();
      const value = this.getValueByPath(path, target);
      return value === false;
    }

    // Handle array includes
    if (condition.includes('.includes(')) {
      const match = condition.match(/(.+)\.includes\((.+)\)/);
      if (match) {
        const [, path, value] = match;
        const arr = this.getValueByPath(path.trim(), target);
        const searchValue = value.trim().replace(/['"]/g, '');
        return Array.isArray(arr) && arr.includes(searchValue);
      }
    }

    // Default: try to get value and check truthiness
    const value = this.getValueByPath(condition, target);
    return Boolean(value);
  }

  /**
   * Evaluate comparison conditions
   */
  private evaluateComparison(condition: string, target: any): boolean {
    // Extract operator and operands
    const operators = ['>=', '<=', '===', '!==', '==', '!=', '>', '<'];
    let op: string | null = null;
    let opIndex = -1;

    for (const operator of operators) {
      const index = condition.indexOf(operator);
      if (index !== -1) {
        op = operator;
        opIndex = index;
        break;
      }
    }

    if (!op) {
      throw new Error(`No comparison operator found in condition: ${condition}`);
    }

    const leftPath = condition.substring(0, opIndex).trim();
    const rightValue = condition.substring(opIndex + op.length).trim();

    const leftValue = this.getValueByPath(leftPath, target);
    const rightParsed = this.parseValue(rightValue);

    switch (op) {
      case '===':
        return leftValue === rightParsed;
      case '!==':
        return leftValue !== rightParsed;
      case '==':
        return leftValue == rightParsed;
      case '!=':
        return leftValue != rightParsed;
      case '>=':
        return leftValue >= rightParsed;
      case '<=':
        return leftValue <= rightParsed;
      case '>':
        return leftValue > rightParsed;
      case '<':
        return leftValue < rightParsed;
      default:
        throw new Error(`Unknown operator: ${op}`);
    }
  }

  /**
   * Get value from target by path
   */
  private getValueByPath(path: string, target: any): any {
    // Handle dotted paths
    const parts = path.split('.');
    let current = target;

    for (const part of parts) {
      if (current == null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Parse a value from condition
   */
  private parseValue(value: string): any {
    value = value.trim();

    // Strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Numbers
    if (!isNaN(Number(value))) {
      return Number(value);
    }

    // Booleans
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null
    if (value === 'null') return null;

    return value;
  }

  /**
   * Extract actual value for reporting
   */
  private extractActualValue(condition: string, target: any): any {
    const operators = ['>=', '<=', '===', '!==', '==', '!=', '>', '<'];
    for (const op of operators) {
      const index = condition.indexOf(op);
      if (index !== -1) {
        const path = condition.substring(0, index).trim();
        return this.getValueByPath(path, target);
      }
    }
    return undefined;
  }

  /**
   * Extract location from target
   */
  private extractLocation(target: any): string | undefined {
    if (target && typeof target === 'object') {
      if (target.id) return `id:${target.id}`;
      if (target.name) return `name:${target.name}`;
      if (target.path) return target.path;
      if (target.url) return target.url;
    }
    return undefined;
  }

  /**
   * Calculate compliance status
   */
  private calculateStatus(
    passed: number,
    failed: number,
    skipped: number
  ): ComplianceStatus {
    const total = passed + failed + skipped;

    if (failed === 0) {
      return ComplianceStatus.COMPLIANT;
    }

    if (passed === 0 && failed > 0) {
      return ComplianceStatus.NON_COMPLIANT;
    }

    const complianceRate = passed / total;
    if (complianceRate >= 0.8) {
      return ComplianceStatus.PARTIALLY_COMPLIANT;
    }

    return ComplianceStatus.NON_COMPLIANT;
  }

  /**
   * Calculate compliance score
   */
  private calculateScore(
    passed: number,
    failed: number,
    skipped: number
  ): number {
    const total = passed + failed;
    if (total === 0) return 100;

    return Math.round((passed / total) * 100);
  }

  /**
   * Get cached result
   */
  private getCachedResult(
    policyId: string,
    context: EvaluationContext
  ): PolicyEvaluationResult | null {
    const cacheKey = this.getCacheKey(policyId, context);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout!) {
      return cached.result;
    }

    return null;
  }

  /**
   * Set cached result
   */
  private setCachedResult(
    policyId: string,
    context: EvaluationContext,
    result: PolicyEvaluationResult
  ): void {
    const cacheKey = this.getCacheKey(policyId, context);
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for a policy
   */
  private invalidateCache(policyId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${policyId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate cache key
   */
  private getCacheKey(policyId: string, context: EvaluationContext): string {
    return `${policyId}:${JSON.stringify(context.target)}`;
  }

  /**
   * Get policy statistics
   */
  getStatistics(): {
    totalPolicies: number;
    policiesByStandard: Record<string, number>;
    totalRules: number;
    automatedRules: number;
    manualRules: number;
  } {
    const policies = Array.from(this.policies.values());
    const policiesByStandard: Record<string, number> = {};
    let totalRules = 0;
    let automatedRules = 0;
    let manualRules = 0;

    policies.forEach(policy => {
      policiesByStandard[policy.standard] = (policiesByStandard[policy.standard] || 0) + 1;
      totalRules += policy.rules.length;
      automatedRules += policy.rules.filter(r => r.automatedCheck).length;
      manualRules += policy.rules.filter(r => !r.automatedCheck).length;
    });

    return {
      totalPolicies: policies.length,
      policiesByStandard,
      totalRules,
      automatedRules,
      manualRules
    };
  }
}
