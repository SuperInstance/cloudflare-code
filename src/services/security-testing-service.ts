/**
 * Security Testing Service for Cloudflare Workers
 * Provides security testing functionality with simplified implementation
 */

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  file?: string;
  line?: number;
  column?: number;
  codeSnippet?: string;
  remediation: string;
  references: string[];
  timestamp: Date;
}

export interface SecurityTestRequest {
  target: string;
  targetType?: 'code' | 'url' | 'api' | 'dependency';
  content?: string; // For inline code scanning
  options?: {
    enableSAST?: boolean;
    enableDAST?: boolean;
    enableSCA?: boolean;
    enableCompliance?: boolean;
    frameworks?: string[];
    severityThreshold?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    maxFiles?: number;
    timeout?: number;
  };
}

export interface SecurityTestResponse {
  success: boolean;
  result?: {
    scanId: string;
    status: string;
    findings: Finding[];
    summary: {
      totalFindings: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    scanTypes: {
      sast?: any;
      dast?: any;
      sca?: any;
      compliance?: any;
    };
    duration: number;
  };
  error?: string;
}

export class SecurityTestingService {
  private scans: Map<string, {
    startTime: Date;
    status: string;
    result?: any;
  }> = new Map();

  /**
   * Perform a comprehensive security scan
   */
  async performSecurityScan(request: SecurityTestRequest): Promise<SecurityTestResponse> {
    const startTime = Date.now();
    const scanId = this.generateScanId();

    try {
      this.scans.set(scanId, {
        startTime: new Date(startTime),
        status: 'running'
      });

      let findings: Finding[] = [];

      // Parse frameworks if provided
      const frameworks = request.options?.frameworks || [];

      // Perform different types of scans based on request
      if (request.targetType === 'code' || request.content) {
        // SAST Scan
        if (request.options?.enableSAST !== false) {
          const sastFindings = await this.performSASTScan(request);
          findings.push(...sastFindings);
        }
      }

      if (request.target.startsWith('http') && request.options?.enableDAST) {
        // DAST Scan (simulated)
        if (request.options?.enableDAST) {
          const dastFindings = await this.performDASTScan(request.target);
          findings.push(...dastFindings);
        }
      }

      if (request.target.includes('package.json') && request.options?.enableSCA) {
        // SCA Scan (simulated)
        if (request.options?.enableSCA) {
          const scaFindings = await this.performSCAScan(request.target);
          findings.push(...scaFindings);
        }
      }

      // Compliance scan if frameworks are specified
      if (request.options?.enableCompliance && frameworks.length > 0) {
        const complianceFindings = await this.performComplianceScan(request.target, frameworks);
        findings.push(...complianceFindings);
      }

      const duration = Date.now() - startTime;

      this.scans.set(scanId, {
        startTime: new Date(startTime),
        status: 'completed',
        result: {
          findings,
          summary: this.calculateSummary(findings)
        }
      });

      return {
        success: true,
        result: {
          scanId,
          status: 'completed',
          findings,
          summary: this.calculateSummary(findings),
          scanTypes: {
            sast: request.options?.enableSAST ? { findings: findings.filter(f => f.type.includes('SAST')) } : undefined,
            dast: request.options?.enableDAST ? { findings: findings.filter(f => f.type.includes('DAST')) } : undefined,
            sca: request.options?.enableSCA ? { findings: findings.filter(f => f.type.includes('SCA')) } : undefined,
            compliance: request.options?.enableCompliance ? { findings: findings.filter(f => f.type.includes('Compliance')) } : undefined,
          },
          duration
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      this.scans.set(scanId, {
        startTime: new Date(startTime),
        status: 'failed'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        result: {
          scanId,
          status: 'failed',
          findings: [],
          summary: {
            totalFindings: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
          },
          scanTypes: {},
          duration
        }
      };
    }
  }

  /**
   * Perform SAST (Static Application Security Testing)
   */
  private async performSASTScan(request: SecurityTestRequest): Promise<Finding[]> {
    const findings: Finding[] = [];
    const content = request.content || '';

    // Common security patterns to detect
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        type: 'SAST',
        severity: 'high' as const,
        title: 'Use of eval()',
        description: 'Use of eval() can lead to code injection vulnerabilities',
        remediation: 'Avoid using eval(). Use alternative approaches like JSON.parse() for JSON or function constructors for dynamic code.',
        cwe: 95
      },
      {
        pattern: /innerHTML\s*=/g,
        type: 'SAST',
        severity: 'medium' as const,
        title: 'innerHTML Assignment',
        description: 'Direct assignment to innerHTML can lead to XSS vulnerabilities',
        remediation: 'Use textContent or createTextNode() instead of innerHTML for untrusted content.',
        cwe: 79
      },
      {
        pattern: /document\.write\s*\(/g,
        type: 'SAST',
        severity: 'high' as const,
        title: 'document.write Usage',
        description: 'document.write() can lead to XSS vulnerabilities',
        remediation: 'Use DOM manipulation methods like appendChild() or innerHTML with proper sanitization.',
        cwe: 79
      },
      {
        pattern: /setTimeout\s*\([^,]+,/g,
        type: 'SAST',
        severity: 'medium' as const,
        title: 'setTimeout with String',
        description: 'setTimeout with string arguments can lead to code injection',
        remediation: 'Use function references instead of string arguments for setTimeout.',
        cwe: 94
      },
      {
        pattern: /setInterval\s*\([^,]+,/g,
        type: 'SAST',
        severity: 'medium' as const,
        title: 'setInterval with String',
        description: 'setInterval with string arguments can lead to code injection',
        remediation: 'Use function references instead of string arguments for setInterval.',
        cwe: 94
      },
      {
        pattern: /\.exec\s*\(/g,
        type: 'SAST',
        severity: 'low' as const,
        title: 'Regular Expression Execution',
        description: 'Complex regular expressions can lead to performance issues',
        remediation: 'Use simpler patterns and test with large inputs to ensure performance.',
        cwe: 400
      },
      {
        pattern: /new\s+Function\s*\(/g,
        type: 'SAST',
        severity: 'high' as const,
        title: 'Function Constructor',
        description: 'Using Function constructor can lead to code injection',
        remediation: 'Use alternative approaches and avoid constructing functions from strings.',
        cwe: 94
      },
      {
        pattern: /fetch\s*\([^,]+,\s*\{[^}]*method\s*:\s*['"]GET['"][^}]*credentials\s*:\s*['"]include['"][^}]*\}\s*\)/g,
        type: 'SAST',
        severity: 'medium' as const,
        title: 'GET Request with Credentials',
        description: 'GET requests should not include credentials as they can be cached in browser history',
        remediation: 'Use POST requests or remove credentials from GET requests.',
        cwe: 522
      }
    ];

    // Check each pattern
    securityPatterns.forEach((patternInfo, index) => {
      const matches = content.match(patternInfo.pattern);
      if (matches) {
        matches.forEach((match, matchIndex) => {
          findings.push({
            id: `sast-${Date.now()}-${index}-${matchIndex}`,
            title: patternInfo.title,
            description: patternInfo.description,
            severity: patternInfo.severity,
            type: patternInfo.type,
            codeSnippet: match,
            remediation: patternInfo.remediation,
            references: [`https://cwe.mitre.org/data/definitions/${patternInfo.cwe}.html`],
            timestamp: new Date()
          });
        });
      }
    });

    // Check for hardcoded credentials
    const credentialPatterns = [
      { pattern: /password\s*[:=]\s*['"]\w+['"]/gi, type: 'password' },
      { pattern: /secret\s*[:=]\s*['"]\w+['"]/gi, type: 'secret' },
      { pattern: /api[_-]?key\s*[:=]\s*['"][\w-]+['"]/gi, type: 'api-key' },
      { pattern: /token\s*[:=]\s*['"][\w-]+\.[\w-]+\.[\w-]+['"]/gi, type: 'jwt-token' }
    ];

    credentialPatterns.forEach((patternInfo, index) => {
      const matches = content.match(patternInfo.pattern);
      if (matches) {
        matches.forEach((match, matchIndex) => {
          findings.push({
            id: `credential-${Date.now()}-${index}-${matchIndex}`,
            title: 'Hardcoded Credentials',
            description: `Hardcoded ${patternInfo.type} detected in code`,
            severity: 'critical' as const,
            type: 'SAST',
            codeSnippet: match,
            remediation: 'Move credentials to environment variables or secure configuration',
            references: ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures'],
            timestamp: new Date()
          });
        });
      }
    });

    return findings;
  }

  /**
   * Perform DAST (Dynamic Application Security Testing) - Simulated
   */
  private async performDASTScan(_targetUrl: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Simulated DAST findings
    findings.push({
      id: `dast-${Date.now()}-1`,
      title: 'Missing Security Headers',
      description: 'Common security headers are missing',
      severity: 'medium' as const,
      type: 'DAST',
      remediation: 'Add security headers like X-Frame-Options, X-Content-Type-Options, and Strict-Transport-Security',
      references: ['https://owasp.org/www-project-top-ten/'],
      timestamp: new Date()
    });

    findings.push({
      id: `dast-${Date.now()}-2`,
      title: 'Information Disclosure',
      description: 'Server may be revealing unnecessary information',
      severity: 'low' as const,
      type: 'DAST',
      remediation: 'Remove or minimize server information disclosure',
      references: ['https://owasp.org/www-project-top-ten/'],
      timestamp: new Date()
    });

    return findings;
  }

  /**
   * Perform SCA (Software Composition Analysis) - Simulated
   */
  private async performSCAScan(_targetPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Simulated SCA findings
    findings.push({
      id: `sca-${Date.now()}-1`,
      title: 'Outdated Dependency',
      description: 'Dependencies may have known vulnerabilities',
      severity: 'high' as const,
      type: 'SCA',
      remediation: 'Update dependencies to their latest secure versions',
      references: ['https://npmjs.com/advisories'],
      timestamp: new Date()
    });

    findings.push({
      id: `sca-${Date.now()}-2`,
      title: 'License Risk',
      description: 'Some dependencies have restrictive licenses',
      severity: 'medium' as const,
      type: 'SCA',
      remediation: 'Review and replace dependencies with restrictive licenses',
      references: ['https://spdx.org/licenses/'],
      timestamp: new Date()
    });

    return findings;
  }

  /**
   * Perform Compliance Scanning - Simulated
   */
  private async performComplianceScan(_targetPath: string, frameworks: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    frameworks.forEach(framework => {
      findings.push({
        id: `compliance-${Date.now()}-${framework}`,
        title: `${framework} Compliance Issue`,
        description: `Potential compliance issue for ${framework}`,
        severity: 'medium' as const,
        type: 'Compliance',
        remediation: `Review ${framework} requirements and implement necessary controls`,
        references: [`https://example.com/${framework.toLowerCase()}-requirements`],
        timestamp: new Date()
      });
    });

    return findings;
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string): Promise<{
    scanId: string;
    status: string;
    startTime: Date;
    duration?: number;
    result?: any;
  } | null> {
    const scan = this.scans.get(scanId);
    if (!scan) return null;

    return {
      scanId,
      status: scan.status,
      startTime: scan.startTime,
      ...(scan.status !== 'running' ? { duration: Date.now() - scan.startTime.getTime() } : {}),
      result: scan.result
    };
  }

  /**
   * Get all available scan types
   */
  getAvailableScanTypes(): Array<{
    id: string;
    name: string;
    description: string;
    supportedTargets: string[];
  }> {
    return [
      {
        id: 'sast',
        name: 'Static Application Security Testing',
        description: 'Analyzes source code for security vulnerabilities',
        supportedTargets: ['code directories', 'file content', 'inline code']
      },
      {
        id: 'dast',
        name: 'Dynamic Application Security Testing',
        description: 'Tests running web applications for security vulnerabilities',
        supportedTargets: ['http URLs', 'web applications']
      },
      {
        id: 'sca',
        name: 'Software Composition Analysis',
        description: 'Scans dependencies for known vulnerabilities and license issues',
        supportedTargets: ['package.json', 'requirements.txt', 'Go.mod', 'pom.xml']
      },
      {
        id: 'compliance',
        name: 'Compliance Scanning',
        description: 'Checks code and systems against security compliance frameworks',
        supportedTargets: ['code directories', 'project root']
      }
    ];
  }

  /**
   * Get available compliance frameworks
   */
  getAvailableComplianceFrameworks(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return [
      { id: 'SOC_2', name: 'SOC 2', description: 'Service Organization Control 2' },
      { id: 'ISO_27001', name: 'ISO 27001', description: 'Information Security Management System' },
      { id: 'PCI_DSS', name: 'PCI DSS', description: 'Payment Card Industry Data Security Standard' },
      { id: 'GDPR', name: 'GDPR', description: 'General Data Protection Regulation' },
      { id: 'HIPAA', name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
      { id: 'NIST', name: 'NIST', description: 'National Institute of Standards and Technology' },
      { id: 'CIS', name: 'CIS', description: 'Center for Internet Security Benchmarks' },
      { id: 'OWASP', name: 'OWASP', description: 'Open Web Application Security Project' }
    ];
  }

  /**
   * Get security testing statistics
   */
  getStatistics(): {
    totalScans: number;
    completedScans: number;
    failedScans: number;
    averageDuration: number;
    vulnerabilitiesFound: number;
  } {
    const scans = Array.from(this.scans.values());
    const completedScans = scans.filter(s => s.status === 'completed');
    const failedScans = scans.filter(s => s.status === 'failed');

    let totalVulnerabilities = 0;
    completedScans.forEach(scan => {
      if (scan.result?.summary) {
        totalVulnerabilities += scan.result.summary.totalFindings || 0;
      }
    });

    const totalDuration = completedScans.reduce((sum, scan) => {
      const duration = scan.result?.duration || 0;
      return sum + duration;
    }, 0);

    return {
      totalScans: scans.length,
      completedScans: completedScans.length,
      failedScans: failedScans.length,
      averageDuration: completedScans.length > 0 ? totalDuration / completedScans.length : 0,
      vulnerabilitiesFound: totalVulnerabilities
    };
  }

  /**
   * Generate a unique scan ID
   */
  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(findings: Finding[]): {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  } {
    const summary = {
      totalFindings: findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          summary.critical++;
          break;
        case 'high':
          summary.high++;
          break;
        case 'medium':
          summary.medium++;
          break;
        case 'low':
          summary.low++;
          break;
        case 'info':
          summary.info++;
          break;
      }
    });

    return summary;
  }
}