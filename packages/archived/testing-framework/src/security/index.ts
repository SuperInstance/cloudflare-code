/**
 * Security Testing Module
 * Provides comprehensive security testing and vulnerability scanning capabilities
 */

export * from './types';

import {
  SecurityTest,
  SecurityTestResult,
  SecurityScanReport,
  SecurityTestSuite,
  SecurityProfile,
  SecurityTestConfig,
  SecuritySeverity,
  SecurityTestType
} from './types';
import { SecurityScanner } from './scanner';
import { HttpClient } from '../http/client';
import { Logger } from '../core/logger';

export class SecurityTestRunner {
  private scanner: SecurityScanner;
  private httpClient: HttpClient;
  private logger: Logger;
  private suites: Map<string, SecurityTestSuite> = new Map();
  private profiles: Map<string, SecurityProfile> = new Map();
  private reports: Map<string, SecurityScanReport> = new Map();

  constructor() {
    this.scanner = new SecurityScanner();
    this.httpClient = new HttpClient();
    this.logger = new Logger('SecurityTestRunner');
  }

  /**
   * Register security tests
   */
  registerTests(tests: SecurityTest[]): void {
    tests.forEach(test => this.scanner.registerTest(test));
  }

  /**
   * Create security test suite
   */
  createSuite(suite: SecurityTestSuite): void {
    this.suites.set(suite.id, suite);
    this.logger.info(`Created security test suite: ${suite.name}`);
  }

  /**
   * Run security test suite
   */
  async runSuite(suiteId: string, target: string): Promise<SecurityScanReport> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    this.logger.info(`Running security test suite: ${suite.name}`);

    const report: SecurityScanReport = {
      id: this.generateId(),
      name: suite.name,
      startTime: new Date(),
      target,
      status: 'running',
      summary: {
        totalTests: suite.tests.length,
        passedTests: 0,
        failedTests: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        infoFindings: 0,
        vulnerabilityScore: 0,
        complianceScore: 0
      },
      findings: [],
      tests: [],
      recommendations: [],
      vulnerabilities: [],
      score: {
        overall: 0,
        details: {
          owaspTopTen: 0,
          inputValidation: 0,
          accessControl: 0,
          dataProtection: 0,
          secureHeaders: 0,
          sslTls: 0,
          dependencySecurity: 0,
          secretsManagement: 0
        },
        grade: 'F'
      }
    };

    this.reports.set(report.id, report);

    try {
      // Run tests based on suite configuration
      const results: SecurityTestResult[] = [];

      for (const test of suite.tests) {
        if (test.enabled && this.shouldRunTest(test, suite.configuration)) {
          try {
            const result = await this.scanner.runTest(test, target);
            results.push(result);

            // Update report summary
            this.updateReportSummary(report, result);
          } catch (error) {
            this.logger.error(`Test ${test.name} failed: ${error}`);
          }
        }
      }

      // Generate recommendations
      report.recommendations = this.generateRecommendations(results);

      // Calculate final scores
      this.calculateScores(report);

      // Update report status
      report.endTime = new Date();
      report.duration = report.endTime.getTime() - report.startTime.getTime();
      report.status = 'completed';
      report.tests = results;

      this.logger.info(`Security suite completed: ${suite.name}`);
      return report;

    } catch (error) {
      report.status = 'failed';
      report.endTime = new Date();
      throw error;
    }
  }

  /**
   * Run OWASP Top 10 security scan
   */
  async runOwaspTopTen(target: string): Promise<SecurityScanReport> {
    const owaspTests: SecurityTest[] = [
      {
        id: 'owasp-1',
        name: 'Broken Access Control',
        type: 'access-control',
        severity: 'critical',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-2',
        name: 'Cryptographic Failures',
        type: 'ssl-tls',
        severity: 'high',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-3',
        name: 'Injection',
        type: 'sql-injection',
        severity: 'critical',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-4',
        name: 'Insecure Design',
        type: 'api-security',
        severity: 'high',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-5',
        name: 'Security Misconfiguration',
        type: 'security-headers',
        severity: 'high',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-6',
        name: 'Vulnerable and Outdated Components',
        type: 'dependency-vulnerability',
        severity: 'medium',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-7',
        name: 'Identification and Authentication Failures',
        type: 'auth-bypass',
        severity: 'critical',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-8',
        name: 'Software and Data Integrity Failures',
        type: 'api-security',
        severity: 'high',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-9',
        name: 'Security Logging and Monitoring Failures',
        type: 'api-security',
        severity: 'medium',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      },
      {
        id: 'owasp-10',
        name: 'Server-Side Request Forgery',
        type: 'ssrf',
        severity: 'high',
        target,
        parameters: {},
        expected: { pass: false },
        enabled: true
      }
    ];

    this.registerTests(owaspTests);

    const suite: SecurityTestSuite = {
      id: 'owasp-top-10-suite',
      name: 'OWASP Top 10 Security Test',
      description: 'Comprehensive OWASP Top 10 vulnerability assessment',
      target,
      tests: owaspTests,
      configuration: {
        baseUrl: target,
        timeout: 10000,
        retries: 2,
        parallel: true,
        maxConcurrent: 3,
        outputFormat: 'json',
        outputDir: './security-reports',
        includeTests: ['owasp-top-ten'],
        excludeTests: [],
        severityFilters: ['critical', 'high', 'medium', 'low']
      },
      enabled: true
    };

    this.createSuite(suite);
    return this.runSuite(suite.id, target);
  }

  /**
   * Create security profile
   */
  createProfile(profile: SecurityProfile): void {
    this.profiles.set(profile.id, profile);
    this.logger.info(`Created security profile: ${profile.name}`);
  }

  /**
   * Run security profile
   */
  async runProfile(profileId: string, target: string): Promise<SecurityScanReport> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const suite: SecurityTestSuite = {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      target,
      tests: profile.tests,
      configuration: profile.configuration,
      enabled: true
    };

    this.createSuite(suite);
    return this.runSuite(suite.id, target);
  }

  /**
   * Generate security report
   */
  generateReport(reportId: string): string {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    let markdown = `# Security Scan Report

**Scan ID:** ${report.id}
**Target:** ${report.target}
**Started:** ${report.startTime.toLocaleString()}
**Status:** ${report.status}
**Duration:** ${report.duration}ms

## Summary

- **Total Tests:** ${report.summary.totalTests}
- **Passed:** ${report.summary.passedTests}
- **Failed:** ${report.summary.failedTests}
- **Critical Findings:** ${report.summary.criticalFindings}
- **High Findings:** ${report.summary.highFindings}
- **Medium Findings:** ${report.summary.mediumFindings}
- **Low Findings:** ${report.summary.lowFindings}
- **Info Findings:** ${report.summary.infoFindings}
- **Security Score:** ${report.score.overall}/100 (${report.score.grade})

## Security Score Details

| Category | Score |
|----------|-------|
| OWASP Top Ten | ${report.score.details.owaspTopTen} |
| Input Validation | ${report.score.details.inputValidation} |
| Access Control | ${report.score.details.accessControl} |
| Data Protection | ${report.score.details.dataProtection} |
| Secure Headers | ${report.score.details.secureHeaders} |
| SSL/TLS | ${report.score.details.sslTls} |
| Dependency Security | ${report.score.details.dependencySecurity} |
| Secrets Management | ${report.score.details.secretsManagement} |

## Vulnerabilities

`;

    // Group findings by severity
    const findingsBySeverity = this.groupFindingsBySeverity(report.findings);

    ['critical', 'high', 'medium', 'low', 'info'].forEach(severity => {
      const findings = findingsBySeverity[severity as SecuritySeverity] || [];
      if (findings.length > 0) {
        markdown += `### ${severity.toUpperCase()} Severity\n\n`;
        findings.forEach(finding => {
          markdown += `#### ${finding.title}\n\n`;
          markdown += `**Description:** ${finding.description}\n\n`;
          markdown += `**URL:** ${finding.url}\n`;
          markdown += `**Method:** ${finding.method}\n`;
          markdown += `**Recommendation:** ${finding.recommendation}\n\n`;
          if (finding.cwe) {
            markdown += `**CWE:** ${finding.cwe}\n\n`;
          }
          if (finding.owasp) {
            markdown += `**OWASP:** ${finding.owasp}\n\n`;
          }
        });
      }
    });

    markdown += `## Recommendations\n\n`;

    report.recommendations.forEach((rec, index) => {
      markdown += `${index + 1}. **${rec.title}** (${rec.priority} priority)\n\n`;
      markdown += `   ${rec.description}\n`;
      markdown += `   **Complexity:** ${rec.complexity}\n`;
      if (rec.estimatedTime) {
        markdown += `   **Estimated Time:** ${rec.estimatedTime} minutes\n`;
      }
      markdown += '\n';
    });

    markdown += `## Test Results\n\n`;

    report.tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      const severityBadge = this.getSeverityBadge(test.severity);
      markdown += `- ${status} ${test.testName} ${severityBadge} (${test.duration}ms)\n`;
    });

    return markdown;
  }

  /**
   * Get all reports
   */
  getReports(): SecurityScanReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Get report by ID
   */
  getReport(reportId: string): SecurityScanReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * Delete report
   */
  deleteReport(reportId: string): boolean {
    return this.reports.delete(reportId);
  }

  /**
   * Export report to file
   */
  async exportReport(reportId: string, format: 'json' | 'html' | 'xml' | 'pdf'): Promise<string> {
    const report = this.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateHtmlReport(report);
      case 'xml':
        return this.generateXmlReport(report);
      case 'pdf':
        // In a real implementation, this would use a PDF library
        return this.generateReport(reportId);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get security score grade
   */
  getSecurityScore(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    if (score >= 30) return 'D+';
    if (score >= 20) return 'D';
    return 'F';
  }

  /**
   * Create security profile with common tests
   */
  createCommonProfiles(): void {
    // OWASP Top 10 Profile
    const owaspProfile: SecurityProfile = {
      id: 'owasp-profile',
      name: 'OWASP Top 10',
      description: 'OWASP Top 2021 security testing profile',
      tests: [
        {
          id: 'xss-test',
          name: 'Cross-Site Scripting',
          type: 'xss',
          severity: 'high',
          target: '',
          parameters: {},
          expected: { pass: false },
          enabled: true
        },
        {
          id: 'sql-injection-test',
          name: 'SQL Injection',
          type: 'sql-injection',
          severity: 'critical',
          target: '',
          parameters: {},
          expected: { pass: false },
          enabled: true
        },
        {
          id: 'csrf-test',
          name: 'Cross-Site Request Forgery',
          type: 'csrf',
          severity: 'high',
          target: '',
          parameters: {},
          expected: { pass: false },
          enabled: true
        }
        // More tests would be added here
      ],
      configuration: {
        baseUrl: '',
        timeout: 10000,
        retries: 2,
        parallel: true,
        maxConcurrent: 5,
        outputFormat: 'json',
        outputDir: './security-reports',
        includeTests: ['owasp-top-ten'],
        excludeTests: [],
        severityFilters: ['critical', 'high', 'medium', 'low']
      },
      tags: ['owasp', 'top-10'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // API Security Profile
    const apiProfile: SecurityProfile = {
      id: 'api-security-profile',
      name: 'API Security',
      description: 'Comprehensive API security testing profile',
      tests: [
        {
          id: 'api-auth-test',
          name: 'API Authentication',
          type: 'api-security',
          severity: 'critical',
          target: '',
          parameters: {},
          expected: { pass: false },
          enabled: true
        },
        {
          id: 'rate-limit-test',
          name: 'Rate Limiting',
          type: 'rate-limiting',
          severity: 'medium',
          target: '',
          parameters: {},
          expected: { pass: false },
          enabled: true
        }
      ],
      configuration: {
        baseUrl: '',
        timeout: 15000,
        retries: 3,
        parallel: false,
        maxConcurrent: 2,
        outputFormat: 'json',
        outputDir: './security-reports',
        includeTests: ['api-security'],
        excludeTests: [],
        severityFilters: ['critical', 'high', 'medium', 'low']
      },
      tags: ['api', 'security'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.createProfile(owaspProfile);
    this.createProfile(apiProfile);
  }

  /**
   * Private helper methods
   */
  private shouldRunTest(test: SecurityTest, config: SecurityTestConfig): boolean {
    // Check if test type is included
    if (config.includeTests.length > 0 && !config.includeTests.includes(test.type)) {
      return false;
    }

    // Check if test type is excluded
    if (config.excludeTests.includes(test.type)) {
      return false;
    }

    // Check severity filter
    if (config.severityFilters.length > 0 && !config.severityFilters.includes(test.severity)) {
      return false;
    }

    return true;
  }

  private updateReportSummary(report: SecurityScanReport, result: SecurityTestResult): void {
    report.summary.totalTests++;

    if (result.passed) {
      report.summary.passedTests++;
    } else {
      report.summary.failedTests++;
      report.tests.push(result);

      // Update findings by severity
      result.findings.forEach(finding => {
        switch (finding.severity) {
          case 'critical':
            report.summary.criticalFindings++;
            break;
          case 'high':
            report.summary.highFindings++;
            break;
          case 'medium':
            report.summary.mediumFindings++;
            break;
          case 'low':
            report.summary.lowFindings++;
            break;
          case 'info':
            report.summary.infoFindings++;
            break;
        }
      });
    }
  }

  private calculateScores(report: SecurityScanReport): void {
    // Calculate overall security score
    const criticalCount = report.summary.criticalFindings;
    const highCount = report.summary.highFindings;
    const mediumCount = report.summary.mediumFindings;
    const lowCount = report.summary.lowFindings;

    // Simple scoring algorithm
    const vulnerabilityPenalty = (criticalCount * 40) + (highCount * 25) + (mediumCount * 15) + (lowCount * 5);
    const score = Math.max(0, 100 - vulnerabilityPenalty);

    report.score.overall = score;
    report.score.grade = this.getSecurityScore(score);

    // Calculate category scores
    report.score.details.owaspTopTen = this.calculateCategoryScore(report.findings, 'Cross-Site Scripting', 'SQL Injection');
    report.score.details.inputValidation = this.calculateCategoryScore(report.findings, 'Input Validation');
    report.score.details.accessControl = this.calculateCategoryScore(report.findings, 'Access Control');
    report.score.details.dataProtection = this.calculateCategoryScore(report.findings, 'Data Protection');
    report.score.details.secureHeaders = this.calculateCategoryScore(report.findings, 'Security Headers');
    report.score.details.sslTls = this.calculateCategoryScore(report.findings, 'Transport Layer Security');
    report.score.details.dependencySecurity = this.calculateCategoryScore(report.findings, 'Dependency Vulnerability');
    report.score.details.secretsManagement = this.calculateCategoryScore(report.findings, 'Secrets Management');
  }

  private calculateCategoryScore(findings: any[], ...categories: string[]): number {
    const categoryFindings = findings.filter(f => categories.some(cat => f.category.includes(cat)));
    if (categoryFindings.length === 0) return 100;

    const penalty = categoryFindings.reduce((sum, finding) => {
      switch (finding.severity) {
        case 'critical': return sum + 40;
        case 'high': return sum + 25;
        case 'medium': return sum + 15;
        case 'low': return sum + 5;
        default: return sum;
      }
    }, 0);

    return Math.max(0, 100 - penalty);
  }

  private generateRecommendations(results: SecurityTestResult[]): any[] {
    const recommendations: any[] = [];

    // Generate recommendations based on findings
    results.forEach(result => {
      result.findings.forEach(finding => {
        if (finding.severity === 'critical' || finding.severity === 'high') {
          recommendations.push({
            id: this.generateId(),
            title: finding.title,
            description: finding.recommendation,
            priority: finding.severity === 'critical' ? 'immediate' : 'high',
            complexity: 'medium',
            category: finding.category,
            affectedTests: [result.testName],
            estimatedTime: finding.severity === 'critical' ? 120 : 60
          });
        }
      });
    });

    return recommendations;
  }

  private groupFindingsBySeverity(findings: any[]): Record<SecuritySeverity, any[]> {
    const grouped: Record<SecuritySeverity, any[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };

    findings.forEach(finding => {
      grouped[finding.severity].push(finding);
    });

    return grouped;
  }

  private getSeverityBadge(severity: SecuritySeverity): string {
    const badges: Record<SecuritySeverity, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      info: '🔵'
    };
    return badges[severity];
  }

  private generateHtmlReport(report: SecurityScanReport): string {
    // Simplified HTML generation
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .finding { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .critical { border-left: 5px solid #dc3545; }
        .high { border-left: 5px solid #fd7e14; }
        .medium { border-left: 5px solid #ffc107; }
        .low { border-left: 5px solid #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Scan Report</h1>
        <p>Target: ${report.target}</p>
        <p>Score: ${report.score.overall}/100 (${report.score.grade})</p>
    </div>
    <div id="findings">
        ${report.findings.map(f => `
        <div class="finding ${f.severity}">
            <h3>${f.title}</h3>
            <p>${f.description}</p>
            <p><strong>Recommendation:</strong> ${f.recommendation}</p>
        </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  private generateXmlReport(report: SecurityScanReport): string {
    // Simplified XML generation
    return `<?xml version="1.0" encoding="UTF-8"?>
<security-report>
    <id>${report.id}</id>
    <target>${report.target}</target>
    <score>${report.score.overall}</score>
    <grade>${report.score.grade}</grade>
    <total-tests>${report.summary.totalTests}</total-tests>
    <critical-findings>${report.summary.criticalFindings}</critical-findings>
    <high-findings>${report.summary.highFindings}</high-findings>
    <medium-findings>${report.summary.mediumFindings}</medium-findings>
    <low-findings>${report.summary.lowFindings}</low-findings>
    <info-findings>${report.summary.infoFindings}</info-findings>
</security-report>`;
  }

  private generateId(): string {
    return `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create default instance
export const securityTestRunner = new SecurityTestRunner();

// Common security profiles
export const SecurityProfiles = {
  OWASP_TOP_TEN: 'owasp-profile',
  API_SECURITY: 'api-security-profile',
  WEB_APPLICATION: 'web-app-profile',
  MOBILE_APPLICATION: 'mobile-app-profile'
};