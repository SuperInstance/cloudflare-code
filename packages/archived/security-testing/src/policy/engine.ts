/**
 * Security Policy Engine
 * Enforces security policies using policy-as-code (OPA/Rego)
 * Provides pre-commit hooks, CI/CD gates, and policy violation tracking
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { Severity, Finding, Policy, PolicyRule, PolicyViolation, ScanStatus } from '../types';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface PolicyEngineConfig {
  policyDir: string;
  enablePreCommitHooks: boolean;
  enableCIDCD Gates: boolean;
  exceptionWorkflowEnabled: boolean;
  notificationConfig?: NotificationConfig;
}

export interface NotificationConfig {
  onViolation: boolean;
  onException: boolean;
  recipients: string[];
  webhookUrl?: string;
}

export interface PolicyEvaluation {
  policyId: string;
  passed: boolean;
  violations: PolicyViolation[];
  timestamp: Date;
}

export interface ExceptionRequest {
  id: string;
  policyId: string;
  ruleId: string;
  findingId: string;
  reason: string;
  expires?: Date;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedBy: string;
  reviewedBy?: string;
  requestedAt: Date;
  reviewedAt?: Date;
}

export class PolicyEngine {
  private logger: Logger;
  private policies: Map<string, Policy>;
  private exceptions: Map<string, ExceptionRequest>;
  private config: PolicyEngineConfig;

  constructor(logger: Logger, config: PolicyEngineConfig) {
    this.logger = logger;
    this.policies = new Map();
    this.exceptions = new Map();
    this.config = config;
  }

  /**
   * Load policies from directory
   */
  public async loadPolicies(): Promise<void> {
    this.logger.info('Loading security policies');

    try {
      const policyFiles = await this.findPolicyFiles(this.config.policyDir);

      for (const file of policyFiles) {
        const policy = await this.loadPolicy(file);
        if (policy) {
          this.policies.set(policy.id, policy);
          this.logger.debug(`Loaded policy: ${policy.name}`);
        }
      }

      this.logger.info(`Loaded ${this.policies.size} policies`);
    } catch (error) {
      this.logger.error(`Failed to load policies: ${error}`);
      throw error;
    }
  }

  /**
   * Find all policy files
   */
  private async findPolicyFiles(dir: string): Promise<string[]> {
    const policyFiles: string[] = [];

    try {
      const files = await fsp.readdir(dir, { recursive: true });

      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
          policyFiles.push(path.join(dir, file));
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read policy directory: ${error}`);
    }

    return policyFiles;
  }

  /**
   * Load policy from file
   */
  private async loadPolicy(filePath: string): Promise<Policy | null> {
    try {
      const content = await fsp.readFile(filePath, 'utf-8');

      if (filePath.endsWith('.json')) {
        return JSON.parse(content) as Policy;
      } else {
        // Assume YAML
        const yaml = await import('js-yaml');
        return yaml.load(content) as Policy;
      }
    } catch (error) {
      this.logger.error(`Failed to load policy from ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Evaluate findings against policies
   */
  public async evaluate(findings: Finding[]): Promise<PolicyEvaluation[]> {
    const evaluations: PolicyEvaluation[] = [];

    this.logger.info(`Evaluating ${findings.length} findings against ${this.policies.size} policies`);

    for (const policy of this.policies.values()) {
      if (!policy.enabled) {
        continue;
      }

      const evaluation = await this.evaluatePolicy(policy, findings);
      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /**
   * Evaluate findings against a single policy
   */
  private async evaluatePolicy(policy: Policy, findings: Finding[]): Promise<PolicyEvaluation> {
    const violations: PolicyViolation[] = [];

    for (const rule of policy.rules) {
      // Check if rule has an active exception
      const hasActiveException = await this.hasActiveException(rule.id);

      if (hasActiveException) {
        continue;
      }

      // Evaluate rule against findings
      for (const finding of findings) {
        if (await this.evaluateRule(rule, finding)) {
          violations.push({
            policy,
            rule,
            finding,
            timestamp: new Date(),
            actionTaken: this.determineAction(rule, policy),
          });
        }
      }
    }

    return {
      policyId: policy.id,
      passed: violations.length === 0,
      violations,
      timestamp: new Date(),
    };
  }

  /**
   * Evaluate rule against finding
   */
  private async evaluateRule(rule: PolicyRule, finding: Finding): Promise<boolean> {
    // Parse rule condition
    const condition = rule.condition;

    // Simple condition evaluation
    if (condition.includes('severity')) {
      const severityMatch = condition.match(/severity\s*==\s*['"](\w+)['"]/);
      if (severityMatch) {
        const requiredSeverity = severityMatch[1];
        return finding.severity.level === requiredSeverity;
      }
    }

    if (condition.includes('type')) {
      const typeMatch = condition.match(/type\s*==\s*['"](\w+)['"]/);
      if (typeMatch) {
        const requiredType = typeMatch[1];
        return finding.type === requiredType;
      }
    }

    if (condition.includes('score')) {
      const scoreMatch = condition.match(/score\s*>=\s*(\d+)/);
      if (scoreMatch) {
        const minScore = parseInt(scoreMatch[1]);
        return finding.severity.score >= minScore;
      }
    }

    return false;
  }

  /**
   * Determine action to take for violation
   */
  private determineAction(rule: PolicyRule, policy: Policy): string {
    // Use rule action if specified, otherwise use policy severity
    if (rule.action === 'deny') {
      return 'BLOCKED - Policy violation';
    } else if (rule.action === 'warn') {
      return 'WARNING - Policy violation';
    } else if (rule.action === 'audit') {
      return 'LOGGED - Policy violation';
    }

    // Default to deny for high/critical severity
    if (policy.severity === Severity.CRITICAL || policy.severity === Severity.HIGH) {
      return 'BLOCKED - Policy violation';
    }

    return 'WARNING - Policy violation';
  }

  /**
   * Check if rule has active exception
   */
  private async hasActiveException(ruleId: string): Promise<boolean> {
    for (const exception of this.exceptions.values()) {
      if (
        exception.ruleId === ruleId &&
        exception.status === 'approved' &&
        (!exception.expires || exception.expires > new Date())
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Request exception for policy violation
   */
  public async requestException(request: Omit<ExceptionRequest, 'id' | 'status' | 'requestedAt'>): Promise<string> {
    const exception: ExceptionRequest = {
      ...request,
      id: uuidv4(),
      status: 'pending',
      requestedAt: new Date(),
    };

    this.exceptions.set(exception.id, exception);

    this.logger.info(`Exception request created: ${exception.id}`);

    if (this.config.notificationConfig?.onException) {
      await this.notifyExceptionRequest(exception);
    }

    return exception.id;
  }

  /**
   * Approve exception request
   */
  public async approveException(exceptionId: string, reviewer: string): Promise<void> {
    const exception = this.exceptions.get(exceptionId);

    if (!exception) {
      throw new Error(`Exception not found: ${exceptionId}`);
    }

    exception.status = 'approved';
    exception.reviewedBy = reviewer;
    exception.reviewedAt = new Date();

    this.logger.info(`Exception approved: ${exceptionId} by ${reviewer}`);

    if (this.config.notificationConfig?.onException) {
      await this.notifyExceptionDecision(exception);
    }
  }

  /**
   * Deny exception request
   */
  public async denyException(exceptionId: string, reviewer: string): Promise<void> {
    const exception = this.exceptions.get(exceptionId);

    if (!exception) {
      throw new Error(`Exception not found: ${exceptionId}`);
    }

    exception.status = 'denied';
    exception.reviewedBy = reviewer;
    exception.reviewedAt = new Date();

    this.logger.info(`Exception denied: ${exceptionId} by ${reviewer}`);

    if (this.config.notificationConfig?.onException) {
      await this.notifyExceptionDecision(exception);
    }
  }

  /**
   * Notify exception request
   */
  private async notifyExceptionRequest(exception: ExceptionRequest): Promise<void> {
    const message = `Exception request ${exception.id} for policy ${exception.policyId}`;

    if (this.config.notificationConfig?.webhookUrl) {
      // Send webhook notification
      try {
        await fetch(this.config.notificationConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'exception_request',
            exception,
            message,
          }),
        });
      } catch (error) {
        this.logger.error(`Failed to send webhook: ${error}`);
      }
    }

    this.logger.info(message);
  }

  /**
   * Notify exception decision
   */
  private async notifyExceptionDecision(exception: ExceptionRequest): Promise<void> {
    const message = `Exception ${exception.id} ${exception.status} by ${exception.reviewedBy}`;

    this.logger.info(message);
  }

  /**
   * Create pre-commit hook
   */
  public async createPreCommitHook(hookPath: string): Promise<void> {
    if (!this.config.enablePreCommitHooks) {
      this.logger.info('Pre-commit hooks disabled');
      return;
    }

    const hookScript = `#!/bin/bash
# Security Policy Pre-Commit Hook
# Automatically generated by ClaudeFlare Security Testing

echo "Running security policy checks..."

# Run security scanner
npx @claudeflare/security-testing scan-staged --policy-dir "${this.config.policyDir}"

# Check result
if [ $? -ne 0 ]; then
  echo "Security policy violations detected. Commit blocked."
  echo "Run 'npx @claudeflare/security-testing scan' for details."
  exit 1
fi

echo "Security policy checks passed."
exit 0
`;

    try {
      await fsp.writeFile(hookPath, hookScript, { mode: 0o755 });
      this.logger.info(`Pre-commit hook created at ${hookPath}`);
    } catch (error) {
      this.logger.error(`Failed to create pre-commit hook: ${error}`);
      throw error;
    }
  }

  /**
   * Create CI/CD gate
   */
  public async createCIDCGate(config: { type: 'github' | 'gitlab' | 'jenkins'; path: string }): Promise<void> {
    if (!this.config.enableCICD) {
      this.logger.info('CI/CD gates disabled');
      return;
    }

    let gateContent: string;

    switch (config.type) {
      case 'github':
        gateContent = this.createGitHubAction();
        break;
      case 'gitlab':
        gateContent = this.createGitLabCI();
        break;
      case 'jenkins':
        gateContent = this.createJenkinsFile();
        break;
      default:
        throw new Error(`Unknown CI/CD type: ${config.type}`);
    }

    try {
      await fsp.writeFile(config.path, gateContent);
      this.logger.info(`CI/CD gate created at ${config.path}`);
    } catch (error) {
      this.logger.error(`Failed to create CI/CD gate: ${error}`);
      throw error;
    }
  }

  /**
   * Create GitHub Action
   */
  private createGitHubAction(): string {
    return `name: Security Policy Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  security-policy-check:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Run security policy check
      run: npx @claudeflare/security-testing scan --policy-dir "${this.config.policyDir}"

    - name: Upload results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: security-policy-results
        path: security-results.json
`;
  }

  /**
   * Create GitLab CI
   */
  private createGitLabCI(): string {
    return `stages:
  - security

security-policy-check:
  stage: security
  image: node:18
  script:
    - npm ci
    - npx @claudeflare/security-testing scan --policy-dir "${this.config.policyDir}"
  artifacts:
    paths:
      - security-results.json
    expire_in: 1 week
  only:
    - main
    - develop
    - merge_requests
`;
  }

  /**
   * Create Jenkins file
   */
  private createJenkinsFile(): string {
    return `pipeline {
    agent any

    stages {
        stage('Security Policy Check') {
            steps {
                sh 'npm ci'
                sh 'npx @claudeflare/security-testing scan --policy-dir "${this.config.policyDir}"'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'security-results.json', fingerprint: true
        }
    }
}
`;
  }

  /**
   * Get policy by ID
   */
  public getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  /**
   * Get all policies
   */
  public getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get exception by ID
   */
  public getException(id: string): ExceptionRequest | undefined {
    return this.exceptions.get(id);
  }

  /**
   * Get all exceptions
   */
  public getExceptions(): ExceptionRequest[] {
    return Array.from(this.exceptions.values());
  }

  /**
   * Get active exceptions
   */
  public getActiveExceptions(): ExceptionRequest[] {
    return this.exceptions.filter((e) => e.status === 'approved' && (!e.expires || e.expires > new Date()));
  }

  /**
   * Clean up expired exceptions
   */
  public async cleanupExpiredExceptions(): Promise<void> {
    const now = new Date();
    let cleaned = 0;

    for (const [id, exception] of this.exceptions) {
      if (exception.expires && exception.expires < now) {
        exception.status = 'expired';
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired exceptions`);
    }
  }

  /**
   * Validate policy syntax
   */
  public async validatePolicy(policy: Policy): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check required fields
    if (!policy.id) {
      errors.push('Policy ID is required');
    }

    if (!policy.name) {
      errors.push('Policy name is required');
    }

    if (!policy.description) {
      errors.push('Policy description is required');
    }

    if (!Array.isArray(policy.rules)) {
      errors.push('Policy rules must be an array');
    } else {
      // Validate each rule
      for (let i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i];

        if (!rule.id) {
          errors.push(`Rule ${i}: ID is required`);
        }

        if (!rule.name) {
          errors.push(`Rule ${i}: name is required`);
        }

        if (!rule.condition) {
          errors.push(`Rule ${i}: condition is required`);
        }

        if (!rule.action) {
          errors.push(`Rule ${i}: action is required`);
        } else if (!['allow', 'deny', 'warn', 'audit'].includes(rule.action)) {
          errors.push(`Rule ${i}: action must be allow, deny, warn, or audit`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export policies to JSON
   */
  public exportPolicies(): string {
    const policies = Array.from(this.policies.values());
    return JSON.stringify(policies, null, 2);
  }

  /**
   * Import policies from JSON
   */
  public async importPolicies(json: string): Promise<void> {
    try {
      const policies = JSON.parse(json) as Policy[];

      for (const policy of policies) {
        const validation = await this.validatePolicy(policy);

        if (!validation.valid) {
          throw new Error(`Invalid policy ${policy.id}: ${validation.errors.join(', ')}`);
        }

        this.policies.set(policy.id, policy);
      }

      this.logger.info(`Imported ${policies.length} policies`);
    } catch (error) {
      this.logger.error(`Failed to import policies: ${error}`);
      throw error;
    }
  }

  /**
   * Generate default policies
   */
  public generateDefaultPolicies(): Policy[] {
    return [
      {
        id: 'block-critical-vulnerabilities',
        name: 'Block Critical Vulnerabilities',
        description: 'Block any code with critical severity vulnerabilities',
        version: '1.0.0',
        framework: 'custom',
        rules: [
          {
            id: 'no-critical',
            name: 'No Critical Vulnerabilities',
            description: 'No findings with critical severity',
            condition: 'severity == "critical"',
            action: 'deny',
            severity: Severity.CRITICAL,
          },
        ],
        scope: ['*'],
        severity: Severity.CRITICAL,
        enabled: true,
      },
      {
        id: 'limit-high-vulnerabilities',
        name: 'Limit High Vulnerabilities',
        description: 'Warn if more than 5 high severity vulnerabilities found',
        version: '1.0.0',
        framework: 'custom',
        rules: [
          {
            id: 'limit-high',
            name: 'Limit High Severity Findings',
            description: 'Maximum 5 high severity findings allowed',
            condition: 'severity == "high" && count > 5',
            action: 'warn',
            severity: Severity.HIGH,
          },
        ],
        scope: ['*'],
        severity: Severity.HIGH,
        enabled: true,
      },
      {
        id: 'enforce-secure-coding',
        name: 'Enforce Secure Coding',
        description: 'Block common insecure coding patterns',
        version: '1.0.0',
        framework: 'custom',
        rules: [
          {
            id: 'no-hardcoded-secrets',
            name: 'No Hardcoded Secrets',
            description: 'Block code with hardcoded secrets',
            condition: 'type == "SENSITIVE_DATA_EXPOSURE"',
            action: 'deny',
            severity: Severity.HIGH,
          },
          {
            id: 'no-sql-injection',
            name: 'No SQL Injection',
            description: 'Block code vulnerable to SQL injection',
            condition: 'type == "SQL_INJECTION"',
            action: 'deny',
            severity: Severity.CRITICAL,
          },
          {
            id: 'no-xss',
            name: 'No XSS Vulnerabilities',
            description: 'Block code vulnerable to XSS',
            condition: 'type == "XSS"',
            action: 'deny',
            severity: Severity.HIGH,
          },
        ],
        scope: ['*.ts', '*.js', '*.tsx', '*.jsx'],
        severity: Severity.HIGH,
        enabled: true,
      },
      {
        id: 'dependency-policy',
        name: 'Dependency Security Policy',
        description: 'Ensure dependencies meet security standards',
        version: '1.0.0',
        framework: 'custom',
        rules: [
          {
            id: 'no-vulnerable-deps',
            name: 'No Vulnerable Dependencies',
            description: 'Block dependencies with known vulnerabilities',
            condition: 'type == "VULNERABLE_DEPENDENCY" && severity == "high"',
            action: 'deny',
            severity: Severity.HIGH,
          },
          {
            id: 'license-compliance',
            name: 'License Compliance',
            description: 'Block dependencies with non-compliant licenses',
            condition: 'type == "LICENSE_VIOLATION"',
            action: 'deny',
            severity: Severity.MEDIUM,
          },
        ],
        scope: ['package.json', 'requirements.txt', 'go.mod'],
        severity: Severity.MEDIUM,
        enabled: true,
      },
    ];
  }
}
