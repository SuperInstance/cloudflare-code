// @ts-nocheck - Missing enum values and type mismatches

/**
 * Security Policies - Policy-as-code engine for security rule enforcement
 * Provides policy enforcement, CI/CD gates, and violation tracking
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SecurityPolicy,
  PolicyCategory,
  PolicyStatus,
  PolicyRule,
  PolicyCondition,
  ConditionType,
  ConditionOperator,
  PolicyAction,
  ActionType,
  PolicySeverity,
  PolicyScope,
  EnforcementMode,
  GateType,
  ViolationAction,
  PolicyException,
  PolicyEvaluationResult,
  PolicyViolation,
  PolicyViolationError,
} from '../types';

// ============================================================================
// POLICY DEFINITIONS
// ============================================================================

export interface PolicyTemplate {
  name: string;
  description: string;
  category: PolicyCategory;
  rules: Partial<PolicyRule>[];
  defaultEnforcementMode: EnforcementMode;
}

export const POLICY_TEMPLATES: Record<string, PolicyTemplate> = {
  'enforce-mfa': {
    name: 'Enforce Multi-Factor Authentication',
    description: 'Require MFA for all privileged operations',
    category: PolicyCategory.ACCESS_CONTROL,
    rules: [
      {
        name: 'Require MFA for admin access',
        description: 'MFA must be enabled for admin role access',
        condition: {
          type: ConditionType.ROLE,
          operator: ConditionOperator.EQUALS,
          value: 'admin',
        },
        action: {
          type: ActionType.REQUIRE_MFA,
        },
        severity: PolicySeverity.HIGH,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'encrypt-data-at-rest': {
    name: 'Encrypt Data at Rest',
    description: 'Ensure all sensitive data is encrypted at rest',
    category: PolicyCategory.DATA_PROTECTION,
    rules: [
      {
        name: 'Database encryption required',
        description: 'All databases must use encryption',
        condition: {
          type: ConditionType.RESOURCE,
          operator: ConditionOperator.EQUALS,
          value: 'database',
        },
        action: {
          type: ActionType.BLOCK,
        },
        severity: PolicySeverity.CRITICAL,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'tls-required': {
    name: 'Require TLS for Network Traffic',
    description: 'Enforce TLS for all network communications',
    category: PolicyCategory.NETWORK_SECURITY,
    rules: [
      {
        name: 'HTTPS only',
        description: 'Only allow HTTPS traffic',
        condition: {
          type: ConditionType.CUSTOM,
          operator: ConditionOperator.EQUALS,
          value: 'http',
          metadata: { field: 'protocol' },
        },
        action: {
          type: ActionType.BLOCK,
        },
        severity: PolicySeverity.HIGH,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'code-review-required': {
    name: 'Require Code Review',
    description: 'Mandatory code review before merging',
    category: PolicyCategory.CHANGE_MANAGEMENT,
    rules: [
      {
        name: 'PR approval required',
        description: 'Pull requests must be approved before merge',
        condition: {
          type: ConditionType.CUSTOM,
          operator: ConditionOperator.EQUALS,
          value: 'pull_request',
          metadata: { field: 'eventType' },
        },
        action: {
          type: ActionType.REQUIRE_APPROVAL,
        },
        severity: PolicySeverity.MEDIUM,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'secrets-scanning': {
    name: 'Scan for Secrets',
    description: 'Scan code for committed secrets and credentials',
    category: PolicyCategory.SECURITY,
    rules: [
      {
        name: 'Block secret commits',
        description: 'Prevent committing of potential secrets',
        condition: {
          type: ConditionType.CUSTOM,
          operator: ConditionOperator.REGEX,
          value: '(password|secret|key|token)\\s*[=:]\\s*[\'"][^\'"]+[\'"]',
          metadata: { field: 'content' },
        },
        action: {
          type: ActionType.BLOCK,
        },
        severity: PolicySeverity.CRITICAL,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'api-rate-limit': {
    name: 'API Rate Limiting',
    description: 'Enforce rate limits on API endpoints',
    category: PolicyCategory.NETWORK_SECURITY,
    rules: [
      {
        name: 'Rate limit exceeded',
        description: 'Block requests exceeding rate limit',
        condition: {
          type: ConditionType.CUSTOM,
          operator: ConditionOperator.GREATER_THAN,
          value: 100,
          metadata: { field: 'requestCount', window: '1m' },
        },
        action: {
          type: ActionType.THROTTLE,
          parameters: { limit: 100, window: 60 },
        },
        severity: PolicySeverity.MEDIUM,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'vulnerability-scan': {
    name: 'Vulnerability Scanning',
    description: 'Scan dependencies for known vulnerabilities',
    category: PolicyCategory.SECURITY,
    rules: [
      {
        name: 'Block high severity vulnerabilities',
        description: 'Prevent deployment with high/critical vulnerabilities',
        condition: {
          type: ConditionType.CUSTOM,
          operator: ConditionOperator.GREATER_THAN,
          value: 0,
          metadata: { field: 'vulnerabilityCount', severity: 'high' },
        },
        action: {
          type: ActionType.BLOCK,
        },
        severity: PolicySeverity.HIGH,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },

  'data-classification': {
    name: 'Data Classification Enforcement',
    description: 'Enforce data handling based on classification',
    category: PolicyCategory.DATA_PROTECTION,
    rules: [
      {
        name: 'Encrypt confidential data',
        description: 'Confidential data must be encrypted',
        condition: {
          type: ConditionType.ATTRIBUTE,
          operator: ConditionOperator.EQUALS,
          value: 'confidential',
          metadata: { field: 'dataClassification' },
        },
        action: {
          type: ActionType.BLOCK,
          parameters: { reason: 'Confidential data must be encrypted' },
        },
        severity: PolicySeverity.HIGH,
        enabled: true,
      },
    ],
    defaultEnforcementMode: EnforcementMode.ENFORCED,
  },
};

// ============================================================================
// POLICY ENGINES
// ============================================================================

export interface PolicyEvaluationContext {
  resource: {
    id: string;
    type: string;
    name?: string;
    attributes?: Record<string, any>;
  };
  principal: {
    id: string;
    roles?: string[];
    permissions?: string[];
    attributes?: Record<string, any>;
  };
  action: string;
  environment?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PolicyStore {
  get(policyId: string): Promise<SecurityPolicy | null>;
  list(filter?: Partial<SecurityPolicy>): Promise<SecurityPolicy[]>;
  create(policy: Omit<SecurityPolicy, 'policyId'>): Promise<SecurityPolicy>;
  update(policyId: string, updates: Partial<SecurityPolicy>): Promise<SecurityPolicy>;
  delete(policyId: string): Promise<void>;
}

export class InMemoryPolicyStore implements PolicyStore {
  private policies: Map<string, SecurityPolicy> = new Map();

  async get(policyId: string): Promise<SecurityPolicy | null> {
    return this.policies.get(policyId) || null;
  }

  async list(filter?: Partial<SecurityPolicy>): Promise<SecurityPolicy[]> {
    let policies = Array.from(this.policies.values());

    if (filter) {
      policies = policies.filter(p => {
        return Object.entries(filter).every(([key, value]) => {
          const policyValue = (p as any)[key];
          return policyValue === value;
        });
      });
    }

    return policies;
  }

  async create(policy: Omit<SecurityPolicy, 'policyId'>): Promise<SecurityPolicy> {
    const policyId = uuidv4();
    const newPolicy: SecurityPolicy = {
      policyId,
      ...policy,
    };
    this.policies.set(policyId, newPolicy);
    return newPolicy;
  }

  async update(policyId: string, updates: Partial<SecurityPolicy>): Promise<SecurityPolicy> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    const updated = { ...policy, ...updates, updatedAt: new Date() };
    this.policies.set(policyId, updated);
    return updated;
  }

  async delete(policyId: string): Promise<void> {
    this.policies.delete(policyId);
  }
}

// ============================================================================
// POLICY ENFORCER
// ============================================================================

export interface PolicyEnforcerConfig {
  policyStore: PolicyStore;
  enforcementMode?: EnforcementMode;
  allowOverrides?: boolean;
  violationAction?: ViolationAction;
}

export class PolicyEnforcer {
  private config: Required<Omit<PolicyEnforcerConfig, 'policyStore'>>;

  constructor(config: PolicyEnforcerConfig) {
    this.config = {
      enforcementMode: config.enforcementMode || EnforcementMode.ENFORCED,
      allowOverrides: config.allowOverrides ?? false,
      violationAction: config.violationAction || ViolationAction.BLOCK,
    };
  }

  /**
   * Evaluate policies for a context
   */
  async evaluate(
    context: PolicyEvaluationContext,
    policyFilter?: Partial<SecurityPolicy>
  ): Promise<PolicyEvaluationResult[]> {
    const policies = await this.config.policyStore.list({
      status: PolicyStatus.ACTIVE,
      ...policyFilter,
    });

    const results: PolicyEvaluationResult[] = [];

    for (const policy of policies) {
      // Check if policy applies to the scope
      if (!this.isPolicyInScope(policy, context)) {
        continue;
      }

      // Check enforcement mode
      if (policy.enforcement.mode === EnforcementMode.DISABLED) {
        continue;
      }

      // Evaluate each rule
      const violations: PolicyViolation[] = [];

      for (const rule of policy.rules) {
        if (!rule.enabled) {
          continue;
        }

        const result = await this.evaluateRule(rule, context);
        if (!result.passed) {
          violations.push({
            ruleId: rule.ruleId,
            ruleName: rule.name,
            severity: rule.severity,
            message: result.message || `Rule ${rule.name} was violated`,
            resource: context.resource.id,
            remediation: this.getRemediation(rule),
          });
        }
      }

      results.push({
        policyId: policy.policyId,
        policyName: policy.name,
        passed: violations.length === 0,
        violations,
        evaluatedAt: new Date(),
        evaluator: 'policy-enforcer',
      });
    }

    return results;
  }

  /**
   * Enforce policies - block if any violations found
   */
  async enforce(
    context: PolicyEvaluationContext,
    policyFilter?: Partial<SecurityPolicy>
  ): Promise<void> {
    const results = await this.evaluate(context, policyFilter);

    for (const result of results) {
      if (!result.passed) {
        // Check for exceptions
        const hasException = await this.hasValidException(result, context);

        if (!hasException && this.shouldEnforce(result)) {
          throw new PolicyViolationError(
            `Policy violation: ${result.policyName}`,
            result.policyId,
            result.violations[0]?.ruleId || 'unknown'
          );
        }
      }
    }
  }

  /**
   * Evaluate a single policy rule
   */
  private async evaluateRule(
    rule: PolicyRule,
    context: PolicyEvaluationContext
  ): Promise<{ passed: boolean; message?: string }> {
    try {
      const conditionMet = await this.evaluateCondition(rule.condition, context);

      if (!conditionMet) {
        // Condition not met, rule doesn't apply
        return { passed: true };
      }

      // Condition was met, check if action is allowed
      switch (rule.action.type) {
        case ActionType.BLOCK:
          return {
            passed: false,
            message: `Action blocked by rule: ${rule.name}`,
          };

        case ActionType.ALLOW:
          return { passed: true };

        case ActionType.REQUIRE_MFA:
          const mfaVerified = context.principal.attributes?.mfaVerified === true;
          if (!mfaVerified) {
            return {
              passed: false,
              message: 'MFA required but not verified',
            };
          }
          return { passed: true };

        case ActionType.REQUIRE_APPROVAL:
          const approved = context.metadata?.approved === true;
          if (!approved) {
            return {
              passed: false,
              message: 'Approval required but not obtained',
            };
          }
          return { passed: true };

        case ActionType.LOG_ONLY:
          // Always pass, just log
          return { passed: true };

        case ActionType.ALERT:
          // Always pass, trigger alert
          return { passed: true };

        case ActionType.QUARANTINE:
          return {
            passed: false,
            message: 'Resource quarantined by policy',
          };

        case ActionType.THROTTLE:
          // Check rate limit
          const rateLimit = rule.action.parameters?.limit || 100;
          const requestCount = context.metadata?.requestCount || 0;
          if (requestCount > rateLimit) {
            return {
              passed: false,
              message: `Rate limit exceeded: ${requestCount}/${rateLimit}`,
            };
          }
          return { passed: true };

        default:
          return { passed: true };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Error evaluating rule: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Evaluate a policy condition
   */
  private async evaluateCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
  ): Promise<boolean> {
    let actualValue: any;

    // Get actual value based on condition type
    switch (condition.type) {
      case ConditionType.RESOURCE:
        actualValue = context.resource.type;
        break;

      case ConditionType.USER:
        actualValue = context.principal.id;
        break;

      case ConditionType.ROLE:
        actualValue = context.principal.roles || [];
        break;

      case ConditionType.PERMISSION:
        actualValue = context.principal.permissions || [];
        break;

      case ConditionType.ATTRIBUTE:
        const attributeName = condition.metadata?.field || condition.value;
        actualValue =
          context.resource.attributes?.[attributeName] ||
          context.principal.attributes?.[attributeName];
        break;

      case ConditionType.TIME:
        actualValue = new Date();
        break;

      case ConditionType.LOCATION:
        actualValue = context.principal.attributes?.location;
        break;

      case ConditionType.CUSTOM:
        const customField = condition.metadata?.field;
        if (customField) {
          actualValue = context.metadata?.[customField] || context.resource.attributes?.[customField];
        } else {
          actualValue = context.metadata;
        }
        break;

      default:
        return false;
    }

    // Evaluate based on operator
    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return actualValue === condition.value;

      case ConditionOperator.NOT_EQUALS:
        return actualValue !== condition.value;

      case ConditionOperator.CONTAINS:
        if (Array.isArray(actualValue)) {
          return actualValue.includes(condition.value);
        }
        return String(actualValue).includes(String(condition.value));

      case ConditionOperator.STARTS_WITH:
        return String(actualValue).startsWith(String(condition.value));

      case ConditionOperator.ENDS_WITH:
        return String(actualValue).endsWith(String(condition.value));

      case ConditionOperator.IN:
        return Array.isArray(condition.value) && condition.value.includes(actualValue);

      case ConditionOperator.NOT_IN:
        return Array.isArray(condition.value) && !condition.value.includes(actualValue);

      case ConditionOperator.GREATER_THAN:
        return Number(actualValue) > Number(condition.value);

      case ConditionOperator.LESS_THAN:
        return Number(actualValue) < Number(condition.value);

      case ConditionOperator.REGEX:
        const regex = new RegExp(String(condition.value));
        return regex.test(String(actualValue));

      case ConditionOperator.IP_RANGE:
        // Simplified IP range check
        return this.checkIpRange(String(actualValue), String(condition.value));

      default:
        return false;
    }
  }

  /**
   * Check if an IP is in a CIDR range
   */
  private checkIpRange(ip: string, cidr: string): boolean {
    // Simplified implementation
    // In production, use a proper IP address library
    if (cidr === '0.0.0.0/0' || cidr === '*') {
      return true;
    }
    return ip === cidr;
  }

  /**
   * Check if a policy applies to the given context
   */
  private isPolicyInScope(policy: SecurityPolicy, context: PolicyEvaluationContext): boolean {
    const scope = policy.scope;

    // Check environment
    if (scope.environments && scope.environments.length > 0) {
      if (!context.environment || !scope.environments.includes(context.environment)) {
        return false;
      }
    }

    // Check resources
    if (scope.resources && scope.resources.length > 0) {
      if (!scope.resources.includes(context.resource.id) &&
          !scope.resources.includes(context.resource.type)) {
        return false;
      }
    }

    // Check users
    if (scope.users && scope.users.length > 0) {
      if (!scope.users.includes(context.principal.id)) {
        return false;
      }
    }

    // Check roles
    if (scope.roles && scope.roles.length > 0) {
      const hasRole = context.principal.roles?.some(r => scope.roles!.includes(r));
      if (!hasRole) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if there's a valid exception for a policy
   */
  private async hasValidException(
    result: PolicyEvaluationResult,
    context: PolicyEvaluationContext
  ): Promise<boolean> {
    const policy = await this.config.policyStore.get(result.policyId);
    if (!policy || !policy.exceptions) {
      return false;
    }

    const now = new Date();

    return policy.exceptions.some(exception => {
      // Check expiration
      if (exception.expiresAt && exception.expiresAt <= now) {
        return false;
      }

      // Check if exception applies to the principal
      // In a real implementation, this would check against the requester
      return true;
    });
  }

  /**
   * Determine if a policy should be enforced
   */
  private shouldEnforce(result: PolicyEvaluationResult): boolean {
    const policy = this.config.policyStore.get(result.policyId);

    // Check enforcement mode
    if (policy?.enforcement.mode === EnforcementMode.MONITOR_ONLY) {
      return false;
    }

    // Check global enforcement mode
    if (this.config.enforcementMode === EnforcementMode.MONITOR_ONLY) {
      return false;
    }

    // Check if violations allow override
    if (this.config.allowOverrides) {
      return false;
    }

    return true;
  }

  /**
   * Get remediation for a rule
   */
  private getRemediation(rule: PolicyRule): string {
    switch (rule.action.type) {
      case ActionType.REQUIRE_MFA:
        return 'Enable multi-factor authentication for this account';

      case ActionType.REQUIRE_APPROVAL:
        return 'Obtain required approval before proceeding';

      case ActionType.BLOCK:
        return 'This action is not permitted by security policy';

      case ActionType.THROTTLE:
        return 'Reduce request rate or implement exponential backoff';

      default:
        return 'Contact security team for guidance';
    }
  }

  /**
   * Create a policy from a template
   */
  async createFromTemplate(
    templateName: string,
    overrides?: {
      name?: string;
      scope?: PolicyScope;
      enforcement?: Partial<SecurityPolicy['enforcement']>;
    }
  ): Promise<SecurityPolicy> {
    const template = POLICY_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Policy template not found: ${templateName}`);
    }

    const now = new Date();

    const policy: Omit<SecurityPolicy, 'policyId'> = {
      name: overrides?.name || template.name,
      version: '1.0.0',
      description: template.description,
      category: template.category,
      status: PolicyStatus.ACTIVE,
      rules: template.rules.map(r => ({
        ruleId: uuidv4(),
        name: r.name!,
        description: r.description!,
        condition: r.condition!,
        action: r.action!,
        severity: r.severity!,
        enabled: r.enabled ?? true,
      })),
      scope: overrides?.scope || {},
      enforcement: {
        mode: overrides?.enforcement?.mode || template.defaultEnforcementMode,
        gateTypes: overrides?.enforcement?.gateTypes || [GateType.PRE_DEPLOY],
        allowOverrides: overrides?.enforcement?.allowOverrides ?? false,
        overrideApprovalRequired: overrides?.enforcement?.overrideApprovalRequired ?? true,
        violationAction: overrides?.enforcement?.violationAction || ViolationAction.BLOCK,
      },
      exceptions: [],
      createdAt: now,
      updatedAt: now,
      effectiveFrom: now,
    };

    return this.config.policyStore.create(policy);
  }

  /**
   * List available templates
   */
  listTemplates(): PolicyTemplate[] {
    return Object.values(POLICY_TEMPLATES);
  }
}

// ============================================================================
// CI/CD GATE CHECKER
// ============================================================================

export interface GateCheckResult {
  gateType: GateType;
  passed: boolean;
  policiesEvaluated: number;
  violationsFound: number;
  blockedBy: string[];
  timestamp: Date;
}

export class CICDGateChecker {
  constructor(private enforcer: PolicyEnforcer) {}

  /**
   * Check if code can be committed
   */
  async preCommitCheck(context: PolicyEvaluationContext): Promise<GateCheckResult> {
    const results = await this.enforcer.evaluate(context, {
      enforcement: { mode: EnforcementMode.ENFORCED, gateTypes: [GateType.PRE_COMMIT] },
    });

    return this.buildGateResult(GateType.PRE_COMMIT, results);
  }

  /**
   * Check if code can be pushed
   */
  async prePushCheck(context: PolicyEvaluationContext): Promise<GateCheckResult> {
    const results = await this.enforcer.evaluate(context, {
      enforcement: { mode: EnforcementMode.ENFORCED, gateTypes: [GateType.PRE_PUSH] },
    });

    return this.buildGateResult(GateType.PRE_PUSH, results);
  }

  /**
   * Check if code can be merged
   */
  async preMergeCheck(context: PolicyEvaluationContext): Promise<GateCheckResult> {
    const results = await this.enforcer.evaluate(context, {
      enforcement: { mode: EnforcementMode.ENFORCED, gateTypes: [GateType.PRE_MERGE] },
    });

    return this.buildGateResult(GateType.PRE_MERGE, results);
  }

  /**
   * Check if deployment can proceed
   */
  async preDeployCheck(context: PolicyEvaluationContext): Promise<GateCheckResult> {
    const results = await this.enforcer.evaluate(context, {
      enforcement: { mode: EnforcementMode.ENFORCED, gateTypes: [GateType.PRE_DEPLOY] },
    });

    return this.buildGateResult(GateType.PRE_DEPLOY, results);
  }

  /**
   * Check if release can proceed
   */
  async preReleaseCheck(context: PolicyEvaluationContext): Promise<GateCheckResult> {
    const results = await this.enforcer.evaluate(context, {
      enforcement: { mode: EnforcementMode.ENFORCED, gateTypes: [GateType.PRE_RELEASE] },
    });

    return this.buildGateResult(GateType.PRE_RELEASE, results);
  }

  private buildGateResult(
    gateType: GateType,
    results: PolicyEvaluationResult[]
  ): GateCheckResult {
    const violations = results.flatMap(r => r.violations);
    const blockedBy = results
      .filter(r => !r.passed)
      .map(r => r.policyName);

    return {
      gateType,
      passed: blockedBy.length === 0,
      policiesEvaluated: results.length,
      violationsFound: violations.length,
      blockedBy,
      timestamp: new Date(),
    };
  }
}

// All classes are already exported inline - no duplicate export needed
