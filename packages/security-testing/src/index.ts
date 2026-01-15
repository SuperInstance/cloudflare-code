/**
 * ClaudeFlare Security Testing Package
 * Main entry point for all security testing functionality
 */

export { SASTScanner, SASTRule } from './sast/scanner';
export { DASTScanner, DASTOptions } from './dast/scanner';
export { DependencyScanner, SCAOptions } from './dependencies/scanner';
export { PentestAutomation, PentestConfig, PentestOptions } from './pentest/automation';
export { PolicyEngine, PolicyEngineConfig, ExceptionRequest } from './policy/engine';
export { ComplianceScanner, ComplianceScanConfig, ComplianceOptions, ComplianceReport } from './compliance/scanner';
export { VulnerabilityDatabase } from './scanners/vulnerability-database';

// Types
export * from './types';

// Utilities
export { Logger } from './utils/logger';
export { FileUtils } from './utils/file-utils';
export { ASTUtils } from './utils/ast-utils';

import { SASTScanner } from './sast/scanner';
import { DASTScanner } from './dast/scanner';
import { DependencyScanner } from './dependencies/scanner';
import { PentestAutomation } from './pentest/automation';
import { PolicyEngine } from './policy/engine';
import { ComplianceScanner } from './compliance/scanner';
import { VulnerabilityDatabase } from './scanners/vulnerability-database';
import { Logger } from './utils/logger';
import { Severity } from './types';

/**
 * Main Security Testing Orchestrator
 * Coordinates all security testing capabilities
 */
export class SecurityTesting {
  private logger: Logger;
  private sastScanner: SASTScanner;
  private dastScanner: DASTScanner;
  private dependencyScanner: DependencyScanner;
  private pentestAutomation: PentestAutomation;
  private policyEngine: PolicyEngine;
  private complianceScanner: ComplianceScanner;
  private vulnerabilityDb: VulnerabilityDatabase;

  constructor(options?: { logLevel?: 'debug' | 'info' | 'warn' | 'error' }) {
    this.logger = Logger.createDefault();
    this.sastScanner = new SASTScanner(this.logger);
    this.dastScanner = new DASTScanner(this.logger);
    this.dependencyScanner = new DependencyScanner(this.logger);
    this.pentestAutomation = new PentestAutomation(this.logger);
    this.complianceScanner = new ComplianceScanner(this.logger);
    this.vulnerabilityDb = new VulnerabilityDatabase();

    // Initialize policy engine with default config
    this.policyEngine = new PolicyEngine(this.logger, {
      policyDir: './policies',
      enablePreCommitHooks: false,
      enableCICD: false,
      exceptionWorkflowEnabled: true,
    });
  }

  /**
   * Scan a codebase for security vulnerabilities
   */
  async scanCode(
    targetPath: string,
    options?: {
      severityThreshold?: Severity;
      maxFiles?: number;
      customRules?: any[];
    }
  ) {
    this.logger.info(`Starting SAST scan of ${targetPath}`);
    return this.sastScanner.scanDirectory(targetPath, options);
  }

  /**
   * Scan a web application
   */
  async scanWebApplication(
    targetUrl: string,
    options?: {
      maxDepth?: number;
      maxPages?: number;
      auth?: any;
      timeout?: number;
    }
  ) {
    this.logger.info(`Starting DAST scan of ${targetUrl}`);
    return this.dastScanner.scan(targetUrl, options);
  }

  /**
   * Scan dependencies for vulnerabilities
   */
  async scanDependencies(
    projectPath: string,
    options?: {
      includeDevDependencies?: boolean;
      includeTransitiveDependencies?: boolean;
      severityThreshold?: Severity;
    }
  ) {
    this.logger.info(`Starting dependency scan of ${projectPath}`);
    return this.dependencyScanner.scanProject(projectPath, options);
  }

  /**
   * Run penetration test
   */
  async runPenTest(
    target: string,
    config?: {
      targetType?: 'web' | 'api' | 'network' | 'mobile';
      phases?: any[];
      options?: any;
    }
  ) {
    this.logger.info(`Starting penetration test of ${target}`);
    return this.pentestAutomation.execute({
      target,
      targetType: config?.targetType || 'web',
      phases: config?.phases || [],
      options: config?.options || {},
    });
  }

  /**
   * Evaluate security policies
   */
  async evaluatePolicies(findings: any[]) {
    this.logger.info('Evaluating security policies');
    return this.policyEngine.evaluate(findings);
  }

  /**
   * Scan for compliance
   */
  async scanCompliance(
    targetPath: string,
    frameworks: any[],
    options?: any
  ) {
    this.logger.info(`Starting compliance scan for ${frameworks.join(', ')}`);
    return this.complianceScanner.scan({
      frameworks,
      target: targetPath,
      options: options || {},
    });
  }

  /**
   * Lookup vulnerabilities in database
   */
  lookupVulnerabilities(packageName: string, ecosystem: string, version: string) {
    return this.vulnerabilityDb.lookup(packageName, ecosystem, version);
  }

  /**
   * Get vulnerability statistics
   */
  getVulnerabilityStats() {
    return this.vulnerabilityDb.getStatistics();
  }

  /**
   * Load vulnerability database
   */
  async loadVulnerabilityDatabase(filePath: string) {
    return this.dependencyScanner.loadVulnerabilityDatabase(filePath);
  }

  /**
   * Load security policies
   */
  async loadPolicies() {
    return this.policyEngine.loadPolicies();
  }

  /**
   * Request policy exception
   */
  async requestException(request: any) {
    return this.policyEngine.requestException(request);
  }

  /**
   * Get all policies
   */
  getPolicies() {
    return this.policyEngine.getPolicies();
  }

  /**
   * Get all exceptions
   */
  getExceptions() {
    return this.policyEngine.getExceptions();
  }

  /**
   * Create pre-commit hook
   */
  async createPreCommitHook(hookPath: string) {
    return this.policyEngine.createPreCommitHook(hookPath);
  }

  /**
   * Create CI/CD gate
   */
  async createCIDCGate(config: { type: 'github' | 'gitlab' | 'jenkins'; path: string }) {
    return this.policyEngine.createCIDCGate(config);
  }

  /**
   * Run comprehensive security scan
   * Combines SAST, DAST, SCA, and compliance scanning
   */
  async runComprehensiveScan(
    targetPath: string,
    options?: {
      enableSAST?: boolean;
      enableDAST?: boolean;
      enableSCA?: boolean;
      enableCompliance?: boolean;
      frameworks?: any[];
      severityThreshold?: Severity;
    }
  ) {
    this.logger.info('Starting comprehensive security scan');

    const results = {
      sast: null as any,
      dast: null as any,
      sca: null as any,
      compliance: null as any,
      policies: null as any,
      summary: {
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
    };

    // SAST Scan
    if (options?.enableSAST !== false) {
      try {
        results.sast = await this.scanCode(targetPath, options);
        this.aggregateSummary(results.summary, results.sast.stats);
      } catch (error) {
        this.logger.error(`SAST scan failed: ${error}`);
      }
    }

    // SCA Scan
    if (options?.enableSCA !== false) {
      try {
        results.sca = await this.scanDependencies(targetPath, options);
        this.aggregateSummary(results.summary, results.sca.stats);
      } catch (error) {
        this.logger.error(`SCA scan failed: ${error}`);
      }
    }

    // DAST Scan (if URL is provided)
    if (options?.enableDAST && typeof targetPath === 'string' && targetPath.startsWith('http')) {
      try {
        results.dast = await this.scanWebApplication(targetPath, options);
        this.aggregateSummary(results.summary, results.dast.stats);
      } catch (error) {
        this.logger.error(`DAST scan failed: ${error}`);
      }
    }

    // Compliance Scan
    if (options?.enableCompliance && options?.frameworks) {
      try {
        results.compliance = await this.scanCompliance(targetPath, options.frameworks, options);
      } catch (error) {
        this.logger.error(`Compliance scan failed: ${error}`);
      }
    }

    // Policy Evaluation
    try {
      const allFindings = [
        ...(results.sast?.findings || []),
        ...(results.dast?.findings || []),
        ...(results.sca?.findings || []),
      ];

      if (allFindings.length > 0) {
        results.policies = await this.evaluatePolicies(allFindings);
      }
    } catch (error) {
      this.logger.error(`Policy evaluation failed: ${error}`);
    }

    this.logger.info('Comprehensive security scan completed');

    return results;
  }

  /**
   * Aggregate summary statistics
   */
  private aggregateSummary(summary: any, stats: any) {
    summary.totalFindings += stats.total || 0;
    summary.critical += stats.critical || 0;
    summary.high += stats.high || 0;
    summary.medium += stats.medium || 0;
    summary.low += stats.low || 0;
    summary.info += stats.info || 0;
  }
}

/**
 * Quick scan function for common use cases
 */
export async function quickScan(targetPath: string) {
  const securityTesting = new SecurityTesting();
  return securityTesting.runComprehensiveScan(targetPath);
}

/**
 * Create a custom scanner with specific configuration
 */
export function createScanner(config?: {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  policyDir?: string;
  vulnDbPath?: string;
}) {
  return new SecurityTesting(config);
}

// Export all types
export { Severity, VulnerabilityType, ScanStatus, OWASPTop10, ComplianceFramework } from './types';
