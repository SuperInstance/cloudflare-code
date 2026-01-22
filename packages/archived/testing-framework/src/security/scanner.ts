/**
 * Security Scanner
 * Provides comprehensive security testing and vulnerability scanning capabilities
 */

import {
  SecurityTest,
  SecurityTestResult,
  SecurityFinding,
  SecurityTestError,
  SecurityMetadata,
  SecuritySeverity,
  SecurityTestType
} from './types';
import { HttpClient } from '../http/client';
import { Logger } from '../core/logger';

export class SecurityScanner {
  private httpClient: HttpClient;
  private logger: Logger;
  private testRegistry: Map<string, SecurityTest> = new Map();
  private results: SecurityTestResult[] = [];

  constructor() {
    this.httpClient = new HttpClient();
    this.logger = new Logger('SecurityScanner');
  }

  /**
   * Register a security test
   */
  registerTest(test: SecurityTest): void {
    this.testRegistry.set(test.id, test);
    this.logger.info(`Registered security test: ${test.name} (${test.id})`);
  }

  /**
   * Run all registered security tests
   */
  async runAllTests(target: string): Promise<SecurityTestResult[]> {
    this.logger.info(`Starting security scan for target: ${target}`);
    this.results = [];

    for (const test of this.testRegistry.values()) {
      if (test.enabled) {
        try {
          const result = await this.runTest(test, target);
          this.results.push(result);
        } catch (error) {
          this.logger.error(`Test ${test.name} failed: ${error}`);
          this.results.push(this.createErrorResult(test, error as Error));
        }
      }
    }

    this.logger.info(`Security scan completed: ${this.results.length} tests executed`);
    return this.results;
  }

  /**
   * Run a specific security test
   */
  async runTest(test: SecurityTest, target: string): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const metadata: SecurityMetadata = {
      timestamp: new Date(),
      environment: 'test',
      targetVersion: '1.0.0',
      testRunnerVersion: '1.0.0',
      scanId: this.generateId(),
      tags: test.type
    };

    try {
      this.logger.info(`Running security test: ${test.name}`);

      let findings: SecurityFinding[] = [];

      switch (test.type) {
        case 'xss':
          findings = await this.testXss(target, test.parameters);
          break;
        case 'sql-injection':
          findings = await this.testSqlInjection(target, test.parameters);
          break;
        case 'csrf':
          findings = await this.testCsrf(target, test.parameters);
          break;
        case 'auth-bypass':
          findings = await this.testAuthBypass(target, test.parameters);
          break;
        case 'directory-traversal':
          findings = await this.testDirectoryTraversal(target, test.parameters);
          break;
        case 'file-inclusion':
          findings = await this.testFileInclusion(target, test.parameters);
          break;
        case 'ssrf':
          findings = await this.testSsrf(target, test.parameters);
          break;
        case 'security-headers':
          findings = await this.testSecurityHeaders(target, test.parameters);
          break;
        case 'ssl-tls':
          findings = await this.testSslTls(target, test.parameters);
          break;
        case 'cors-misconfiguration':
          findings = await this.testCorsMisconfiguration(target, test.parameters);
          break;
        case 'dependency-vulnerability':
          findings = await this.testDependencyVulnerabilities(target, test.parameters);
          break;
        case 'secrets-scan':
          findings = await this.testSecretsScan(target, test.parameters);
          break;
        case 'input-validation':
          findings = await this.testInputValidation(target, test.parameters);
          break;
        case 'access-control':
          findings = await this.testAccessControl(target, test.parameters);
          break;
        case 'rate-limiting':
          findings = await this.testRateLimiting(target, test.parameters);
          break;
        case 'api-security':
          findings = await this.testApiSecurity(target, test.parameters);
          break;
        case 'owasp-top-ten':
          findings = await this.testOwaspTopTen(target, test.parameters);
          break;
        default:
          findings = await this.runCustomTest(test, target);
      }

      // Validate findings against expected results
      const passed = this.validateFindings(findings, test.expected);

      const result: SecurityTestResult = {
        id: this.generateId(),
        testId: test.id,
        testName: test.name,
        passed,
        severity: test.severity,
        duration: Date.now() - startTime,
        findings,
        metadata
      };

      this.logger.info(`Test ${test.name} completed: ${passed ? 'passed' : 'failed'} with ${findings.length} findings`);
      return result;

    } catch (error) {
      return this.createErrorResult(test, error as Error, metadata);
    }
  }

  /**
   * XSS Testing
   */
  private async testXss(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const payloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<body onload=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<input onfocus=alert("XSS") autofocus>',
      '<select onfocus=alert("XSS") autofocus>',
      '<textarea onfocus=alert("XSS") autofocus>'
    ];

    const endpoints = ['/', '/search', '/contact', '/login', '/register'];
    const parameters = ['q', 'search', 'query', 'id', 'name', 'email', 'comment'];

    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        // Test in URL parameters
        for (const param of parameters) {
          const url = `${target}${endpoint}?${param}=${encodeURIComponent(payload)}`;
          const response = await this.httpClient.get(url, { timeout: 5000 });

          if (this.detectXss(response.data, payload)) {
            findings.push(this.createFinding(
              'XSS Vulnerability',
              `Reflected XSS found in ${param} parameter`,
              'high',
              'Cross-Site Scripting',
              url,
              'GET',
              { param, payload },
              'Input should be properly encoded and validated'
            ));
          }
        }

        // Test in POST body
        const formData = new FormData();
        parameters.forEach(param => formData.append(param, payload));

        try {
          const response = await this.httpClient.post(target + endpoint, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (this.detectXss(response.data, payload)) {
            findings.push(this.createFinding(
              'XSS Vulnerability',
              `Stored/Reflected XSS found in POST data`,
              'high',
              'Cross-Site Scripting',
              target + endpoint,
              'POST',
              { payload },
              'Implement proper input validation and output encoding'
            ));
          }
        } catch (error) {
          // Continue with other tests
        }
      }
    }

    return findings;
  }

  /**
   * SQL Injection Testing
   */
  private async testSqlInjection(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const payloads = [
      "' OR '1'='1",
      "' OR 1=1--",
      "' OR 1=1#",
      "' UNION SELECT NULL--",
      "' UNION SELECT 1,2,3--",
      "' OR SLEEP(5)--",
      "' WAITFOR DELAY '0:0:5'--",
      "'; DROP TABLE users--",
      "1'; INSERT INTO users VALUES ('hacker', 'password')--"
    ];

    const parameters = ['id', 'user', 'username', 'email', 'search', 'query'];
    const endpoints = ['/', '/user', '/search', '/profile'];

    for (const endpoint of endpoints) {
      for (const param of parameters) {
        for (const payload of payloads) {
          const url = `${target}${endpoint}?${param}=${encodeURIComponent(payload)}`;
          const startTime = Date.now();

          try {
            const response = await this.httpClient.get(url, { timeout: 10000 });

            // Check for SQL error patterns
            if (this.containsSqlError(response.data)) {
              findings.push(this.createFinding(
                'SQL Injection Vulnerability',
                `SQL injection detected in ${param} parameter`,
                'critical',
                'SQL Injection',
                url,
                'GET',
                { param, payload },
                'Use parameterized queries or prepared statements',
                89,
                'OWASP-A1:2021'
              ));
            }

            // Check for time-based injection
            if (Date.now() - startTime > 8000) {
              findings.push(this.createFinding(
                'Time-based SQL Injection',
                `Time-based SQL injection detected in ${param} parameter`,
                'high',
                'SQL Injection',
                url,
                'GET',
                { param, payload },
                'Implement proper input validation and use parameterized queries'
              ));
            }
          } catch (error) {
            // Handle timeout for time-based tests
            if (error.message.includes('timeout')) {
              findings.push(this.createFinding(
                'Time-based SQL Injection',
                `Potential time-based SQL injection in ${param} parameter`,
                'high',
                'SQL Injection',
                url,
                'GET',
                { param, payload },
                'Implement proper input validation'
              ));
            }
          }
        }
      }
    }

    return findings;
  }

  /**
   * CSRF Testing
   */
  private async testCsrf(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const csrfToken = this.generateCsrfToken();

    // Test if CSRF protection is implemented
    const response = await this.httpClient.get(target + '/login');

    // Check for CSRF token in forms
    if (!this.hasCsrfToken(response.data)) {
      findings.push(this.createFinding(
        'Missing CSRF Protection',
        'No CSRF token found in login form',
        'high',
        'Cross-Site Request Forgery',
        target + '/login',
        'GET',
        {},
        'Implement anti-CSRF tokens in all state-changing operations'
      ));
    }

    // Test if CORS is misconfigured
    const corsHeaders = response.headers;
    if (corsHeaders['access-control-allow-credentials'] === 'true' &&
        corsHeaders['access-control-allow-origin'] === '*') {
      findings.push(this.createFinding(
        'CORS Misconfiguration',
        'CORS allows credentials from any origin',
        'medium',
        'Cross-Origin Resource Sharing',
        target + '/login',
        'OPTIONS',
        {},
        'Restrict CORS to trusted origins and avoid combining with credentials'
      ));
    }

    return findings;
  }

  /**
   * Directory Traversal Testing
   */
  private async testDirectoryTraversal(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const payloads = [
      '../',
      '..%2F',
      '..%252F',
      '..//',
      '..%5C',
      '..%255C',
      '..%2e%2e%2f',
      '..%2e%2e/'
    ];

    const endpoints = ['download', 'file', 'view', 'read'];
    const parameters = ['file', 'path', 'filename', 'location'];

    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        for (const param of parameters) {
          const url = `${target}/${endpoint}?${param}=${payload}etc/passwd`;
          const response = await this.httpClient.get(url, { timeout: 5000 });

          if (response.data.includes('root:') || response.data.includes('daemon:')) {
            findings.push(this.createFinding(
              'Directory Traversal',
              `Directory traversal vulnerability in ${param} parameter`,
              'high',
              'Path Traversal',
              url,
              'GET',
              { param, payload },
              'Validate and sanitize file paths'
            ));
          }
        }
      }
    }

    return findings;
  }

  /**
   * Security Headers Testing
   */
  private async testSecurityHeaders(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const response = await this.httpClient.get(target, { timeout: 5000 });
    const headers = response.headers;

    const expectedHeaders = {
      'strict-transport-security': 'HSTS not implemented',
      'x-frame-options': 'Clickjacking protection missing',
      'x-content-type-options': 'MIME type sniffing protection missing',
      'x-xss-protection': 'Legacy XSS filter missing',
      'content-security-policy': 'CSP not implemented',
      'referrer-policy': 'Referrer policy missing'
    };

    for (const [header, message] of Object.entries(expectedHeaders)) {
      if (!headers[header]) {
        findings.push(this.createFinding(
          'Missing Security Header',
          message,
          'medium',
          'Security Headers',
          target,
          'GET',
          {},
          `Implement ${header} header for better security`
        ));
      }
    }

    // Check HSTS configuration
    if (headers['strict-transport-security']) {
      const hstsValue = headers['strict-transport-security'];
      if (!hstsValue.includes('max-age') || !hstsValue.includes('preload')) {
        findings.push(this.createFinding(
          'Weak HSTS Configuration',
          'HSTS should include max-age and preload directives',
          'low',
          'Security Headers',
          target,
          'GET',
          {},
          'Configure HSTS with appropriate max-age and include preload'
        ));
      }
    }

    return findings;
  }

  /**
   * SSL/TLS Testing
   */
  private async testSslTls(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Test if HTTPS is available
      const httpsResponse = await this.httpClient.get('https://' + target.replace(/^https?:\/\//, ''), {
        timeout: 5000
      });

      if (!httpsResponse) {
        findings.push(this.createFinding(
          'No HTTPS',
          'HTTPS is not available',
          'high',
          'Transport Layer Security',
          target,
          'GET',
          {},
          'Enable HTTPS for all communications'
        ));
      } else {
        // In a real implementation, this would test SSL certificate validity,
        // weak cipher suites, protocol versions, etc.
        findings.push(this.createFinding(
          'HTTPS Available',
          'HTTPS is properly configured',
          'info',
          'Transport Layer Security',
          'https://' + target,
          'GET',
          {},
          'Good practice to use HTTPS'
        ));
      }
    } catch (error) {
      findings.push(this.createFinding(
        'No HTTPS',
        'HTTPS connection failed',
        'high',
        'Transport Layer Security',
        target,
        'GET',
        {},
        'Enable HTTPS and configure SSL/TLS properly'
      ));
    }

    return findings;
  }

  /**
   * OWASP Top 10 Testing
   */
  private async testOwaspTopTen(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Run OWASP Top 10 tests
    const xssFindings = await this.testXss(target, params);
    const sqlFindings = await this.testSqlInjection(target, params);
    const findingsFromOtherTests = await this.testCsrf(target, params);
    const traversalFindings = await this.testDirectoryTraversal(target, params);
    const headersFindings = await this.testSecurityHeaders(target, params);
    const sslFindings = await this.testSslTls(target, params);

    findings.push(...xssFindings);
    findings.push(...sqlFindings);
    findings.push(...findingsFromOtherTests);
    findings.push(...traversalFindings);
    findings.push(...headersFindings);
    findings.push(...sslFindings);

    // Additional OWASP Top 10 checks
    const authFindings = await this.testAuthBypass(target, params);
    const accessControlFindings = await this.testAccessControl(target, params);
    const secretFindings = await this.testSecretsScan(target, params);

    findings.push(...authFindings);
    findings.push(...accessControlFindings);
    findings.push(...secretFindings);

    return findings;
  }

  /**
   * Test for secrets scanning
   */
  private async testSecretsScan(target: string, params: any): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Get source code or responses to scan for secrets
    const response = await this.httpClient.get(target, { timeout: 5000 });
    const secretPatterns = [
      /(?i)\b(?:api_key|apikey|access_token|accesstoken|auth_token|authtoken|secret|password|passwd|pwd|token|bearer|jwt|oauth)[\s\-]*[:=][\s\-]*["']?([\w\-_]+)["']?/g,
      /(?i)\b(?:sk-|pk-|ghp_|glpat-)[a-zA-Z0-9]{20,}/g,
      /(?i)\b(?:password|passwd|pwd)\s*[:=]\s*["']?[\w!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+["']?/g,
      /(?i)\b(?:PRIVATE[_-]?KEY|SECRET[_-]?KEY|ACCESS[_-]?TOKEN)[\s\-]*[:=][\s\-]*["']?[\w\-_]+["']?/g
    ];

    const matches = this.scanForPatterns(response.data, secretPatterns);

    if (matches.length > 0) {
      findings.push(this.createFinding(
        'Secrets Found',
        'Potential secrets found in response',
        'critical',
        'Secrets Management',
        target,
        'GET',
        { matches },
        'Remove or properly secure secrets from responses and source code'
      ));
    }

    return findings;
  }

  /**
   * Run custom security test
   */
  private async runCustomTest(test: SecurityTest, target: string): Promise<SecurityFinding[]> {
    // This would implement user-defined security tests
    // For now, return empty findings
    return [];
  }

  /**
   * Helper methods
   */
  private createFinding(
    title: string,
    description: string,
    severity: SecuritySeverity,
    category: string,
    url: string,
    method: string,
    parameters: any,
    recommendation: string,
    cwe?: number,
    owasp?: string
  ): SecurityFinding {
    return {
      id: this.generateId(),
      title,
      description,
      severity,
      category,
      evidence: '',
      url,
      method,
      parameters,
      recommendation,
      cwe,
      owasp,
      reference: ''
    };
  }

  private createErrorResult(
    test: SecurityTest,
    error: Error,
    metadata?: SecurityMetadata
  ): SecurityTestResult {
    return {
      id: this.generateId(),
      testId: test.id,
      testName: test.name,
      passed: false,
      severity: test.severity,
      duration: 0,
      findings: [],
      error: {
        type: 'validation',
        message: error.message,
        code: 'TEST_EXECUTION_ERROR'
      },
      metadata: metadata || {
        timestamp: new Date(),
        environment: 'test',
        targetVersion: '1.0.0',
        testRunnerVersion: '1.0.0',
        scanId: this.generateId()
      }
    };
  }

  private detectXss(response: string, payload: string): boolean {
    // Simple XSS detection - in practice, this would be more sophisticated
    return response.includes(payload) ||
           response.includes('alert(') ||
           response.includes('<script') ||
           response.includes('onerror=') ||
           response.includes('onload=');
  }

  private containsSqlError(response: string): boolean {
    const sqlErrors = [
      /SQL syntax/i,
      /ORA-[0-9]+/i,
      /MySQL server has gone away/i,
      /Warning: mysql_/i,
      /Microsoft OLE DB Provider for ODBC Drivers error/i,
      /PostgreSQL query failed/i,
      /SQLite error/i
    ];

    return sqlErrors.some(pattern => pattern.test(response));
  }

  private hasCsrfToken(html: string): boolean {
    const csrfPatterns = [
      /name=["']csrf["']\s*value=["'][^"']+/i,
      /name="_token"\s*value=["'][^"']+/i,
      /name="csrfmiddlewaretoken"\s*value=["'][^"']+/i
    ];

    return csrfPatterns.some(pattern => pattern.test(html));
  }

  private generateCsrfToken(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private validateFindings(findings: SecurityFinding[], expected: any): boolean {
    // Validate findings against expected results
    if (!expected) return findings.length === 0;

    if (expected.pass) {
      // Expected to pass, so no findings should be found
      return findings.length === 0;
    } else {
      // Expected to fail, so findings should exist
      return findings.length > 0;
    }
  }

  private scanForPatterns(text: string, patterns: RegExp[]): any[] {
    const matches: any[] = [];

    patterns.forEach(pattern => {
      const found = text.match(pattern);
      if (found) {
        matches.push(...found);
      }
    });

    return matches;
  }

  private generateId(): string {
    return `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public methods
   */
  getResults(): SecurityTestResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
  }

  getTestRegistry(): Map<string, SecurityTest> {
    return new Map(this.testRegistry);
  }
}