/**
 * Security test runner for ClaudeFlare
 */

// @ts-nocheck
import { Page, APIRequestContext } from '@playwright/test';
import type { SecurityTestConfig, SecurityTestResult, Vulnerability, SecuritySummary } from '../utils/types';

/**
 * Security test runner class
 */
export class SecurityTestRunner {
  private config: SecurityTestConfig;
  private vulnerabilities: Vulnerability[] = [];

  constructor(config: SecurityTestConfig) {
    this.config = config;
  }

  /**
   * Run security test suite
   */
  async runTests(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    this.vulnerabilities = [];

    // OWASP Top 10 checks
    if (this.config.owaspChecks) {
      await this.runOWASPChecks();
    }

    // Dependency scanning
    if (this.config.dependencyScan) {
      await this.runDependencyScan();
    }

    // Secret scanning
    if (this.config.secretScan) {
      await this.runSecretScan();
    }

    // Compliance checks
    if (this.config.complianceChecks.length > 0) {
      await this.runComplianceChecks();
    }

    const duration = Date.now() - startTime;

    return {
      name: 'Security Scan',
      timestamp: new Date(),
      duration,
      vulnerabilities: this.vulnerabilities,
      summary: this.calculateSummary(),
      passed: this.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0
    };
  }

  /**
   * Run OWASP Top 10 checks
   */
  private async runOWASPChecks(): Promise<void> {
    // A01:2021 - Broken Access Control
    await this.checkBrokenAccessControl();

    // A02:2021 - Cryptographic Failures
    await this.checkCryptographicFailures();

    // A03:2021 - Injection
    await this.checkInjection();

    // A04:2021 - Insecure Design
    await this.checkInsecureDesign();

    // A05:2021 - Security Misconfiguration
    await this.checkSecurityMisconfiguration();

    // A06:2021 - Vulnerable and Outdated Components
    await this.checkVulnerableComponents();

    // A07:2021 - Identification and Authentication Failures
    await this.checkAuthenticationFailures();

    // A08:2021 - Software and Data Integrity Failures
    await this.checkIntegrityFailures();

    // A09:2021 - Security Logging and Monitoring Failures
    await this.checkLoggingFailures();

    // A10:2021 - Server-Side Request Forgery (SSRF)
    await this.checkSSRF();
  }

  /**
   * Check for broken access control
   */
  private async checkBrokenAccessControl(): Promise<void> {
    // Check for unauthorized access to admin areas
    try {
      const response = await fetch(`${this.config.targetUrl}/admin`);
      if (response.status === 200) {
        this.addVulnerability({
          id: 'A01-001',
          severity: 'high',
          category: 'Broken Access Control',
          title: 'Unprotected Admin Area',
          description: 'Admin area is accessible without authentication',
          location: '/admin',
          remediation: 'Implement proper authentication and authorization checks',
          references: ['https://owasp.org/Top10/A01_2021-Broken_Access_Control/']
        });
      }
    } catch (error) {
      // Expected 401/403
    }

    // Check for path traversal
    const pathTraversalTests = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd'
    ];

    for (const testPath of pathTraversalTests) {
      try {
        const response = await fetch(`${this.config.targetUrl}/api/files?path=${encodeURIComponent(testPath)}`);
        if (response.status === 200) {
          this.addVulnerability({
            id: 'A01-002',
            severity: 'critical',
            category: 'Broken Access Control',
            title: 'Path Traversal Vulnerability',
            description: 'Application is vulnerable to path traversal attacks',
            location: '/api/files',
            evidence: testPath,
            remediation: 'Validate and sanitize all file path inputs',
            references: ['https://owasp.org/www-community/attacks/Path_Traversal']
          });
          break;
        }
      } catch (error) {
        // Expected error
      }
    }
  }

  /**
   * Check for cryptographic failures
   */
  private async checkCryptographicFailures(): Promise<void> {
    // Check for HTTPS
    try {
      const response = await fetch(this.config.targetUrl);
      const url = new URL(this.config.targetUrl);

      if (url.protocol !== 'https:') {
        this.addVulnerability({
          id: 'A02-001',
          severity: 'high',
          category: 'Cryptographic Failures',
          title: 'No HTTPS Enforcement',
          description: 'Application does not enforce HTTPS',
          location: this.config.targetUrl,
          remediation: 'Redirect all HTTP traffic to HTTPS',
          references: ['https://owasp.org/Top10/A02_2021-Cryptographic_Failures/']
        });
      }

      // Check for security headers
      const headers = response.headers;
      const securityHeaders = [
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Content-Security-Policy'
      ];

      for (const header of securityHeaders) {
        if (!headers.get(header)) {
          this.addVulnerability({
            id: `A02-004-${header}`,
            severity: 'medium',
            category: 'Cryptographic Failures',
            title: `Missing Security Header: ${header}`,
            description: `Required security header ${header} is not set`,
            location: 'HTTP Headers',
            remediation: `Add ${header} header to responses`,
            references: ['https://owasp.org/www-project-secure-headers/']
          });
        }
      }
    } catch (error) {
      // Connection error
    }
  }

  /**
   * Check for injection vulnerabilities
   */
  private async checkInjection(): Promise<void> {
    // SQL Injection tests
    const sqliTests = [
      "' OR '1'='1",
      "1' UNION SELECT NULL--",
      "'; DROP TABLE users--",
      "1' AND 1=1--"
    ];

    for (const payload of sqliTests) {
      try {
        const response = await fetch(
          `${this.config.targetUrl}/api/users?id=${encodeURIComponent(payload)}`
        );

        const text = await response.text();
        if (text.includes('mysql') || text.includes('postgres') || text.includes('sqlite')) {
          this.addVulnerability({
            id: 'A03-001',
            severity: 'critical',
            category: 'Injection',
            title: 'SQL Injection Vulnerability',
            description: 'Application is vulnerable to SQL injection attacks',
            location: '/api/users',
            evidence: payload,
            remediation: 'Use parameterized queries and prepared statements',
            references: ['https://owasp.org/www-community/attacks/SQL_Injection']
          });
          break;
        }
      } catch (error) {
        // Expected error
      }
    }

    // XSS tests
    const xssTests = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ];

    for (const payload of xssTests) {
      try {
        const response = await fetch(
          `${this.config.targetUrl}/api/search?q=${encodeURIComponent(payload)}`
        );

        const text = await response.text();
        if (text.includes('<script>') || text.includes('onerror=')) {
          this.addVulnerability({
            id: 'A03-002',
            severity: 'high',
            category: 'Injection',
            title: 'Cross-Site Scripting (XSS)',
            description: 'Application is vulnerable to XSS attacks',
            location: '/api/search',
            evidence: payload,
            remediation: 'Sanitize and escape all user inputs',
            references: ['https://owasp.org/www-community/attacks/xss/']
          });
          break;
        }
      } catch (error) {
        // Expected error
      }
    }

    // Command injection tests
    const cmdInjectionTests = [
      '; ls -la',
      '| cat /etc/passwd',
      '`whoami`',
      '$(id)'
    ];

    for (const payload of cmdInjectionTests) {
      try {
        const response = await fetch(
          `${this.config.targetUrl}/api/ping?host=${encodeURIComponent(payload)}`
        );

        const text = await response.text();
        if (text.includes('root:') || text.includes('uid=')) {
          this.addVulnerability({
            id: 'A03-003',
            severity: 'critical',
            category: 'Injection',
            title: 'Command Injection Vulnerability',
            description: 'Application is vulnerable to command injection',
            location: '/api/ping',
            evidence: payload,
            remediation: 'Validate and sanitize all system command inputs',
            references: ['https://owasp.org/www-community/attacks/Command_Injection']
          });
          break;
        }
      } catch (error) {
        // Expected error
      }
    }
  }

  /**
   * Check for insecure design
   */
  private async checkInsecureDesign(): Promise<void> {
    // Check for default credentials
    const defaultCredentials = [
      { username: 'admin', password: 'admin' },
      { username: 'admin', password: 'password' },
      { username: 'root', password: 'root' },
      { username: 'admin', password: '123456' }
    ];

    for (const creds of defaultCredentials) {
      try {
        const response = await fetch(`${this.config.targetUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creds)
        });

        if (response.ok) {
          this.addVulnerability({
            id: 'A04-001',
            severity: 'high',
            category: 'Insecure Design',
            title: 'Default Credentials Enabled',
            description: 'Application accepts default credentials',
            location: '/api/login',
            evidence: `${creds.username}:${creds.password}`,
            remediation: 'Force users to change default credentials on first login',
            references: ['https://owasp.org/Top10/A04_2021-Insecure_Design/']
          });
          break;
        }
      } catch (error) {
        // Expected error
      }
    }
  }

  /**
   * Check for security misconfiguration
   */
  private async checkSecurityMisconfiguration(): Promise<void> {
    // Check for verbose error messages
    try {
      const response = await fetch(`${this.config.targetUrl}/api/non-existent-page-12345`);
      const text = await response.text();

      if (text.includes('Stack trace') || text.includes('Exception') ||
          text.includes('/var/www') || text.includes('node_modules')) {
        this.addVulnerability({
          id: 'A05-001',
          severity: 'medium',
          category: 'Security Misconfiguration',
          title: 'Verbose Error Messages',
          description: 'Application exposes sensitive information in error messages',
          location: 'Error Pages',
          remediation: 'Use generic error messages in production',
          references: ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/']
        });
      }
    } catch (error) {
      // Expected
    }

    // Check for directory listing
    try {
      const response = await fetch(`${this.config.targetUrl}/assets/`);
      const text = await response.text();

      if (text.includes('Index of') || text.includes('Directory Listing')) {
        this.addVulnerability({
          id: 'A05-002',
          severity: 'low',
          category: 'Security Misconfiguration',
          title: 'Directory Listing Enabled',
          description: 'Directory listing is enabled',
          location: '/assets/',
          remediation: 'Disable directory listing in web server configuration',
          references: ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/']
        });
      }
    } catch (error) {
      // Expected
    }
  }

  /**
   * Check for vulnerable components
   */
  private async checkVulnerableComponents(): Promise<void> {
    // This would integrate with dependency scanning tools
    // Placeholder for now
  }

  /**
   * Check for authentication failures
   */
  private async checkAuthenticationFailures(): Promise<void> {
    // Check for weak password policy
    const weakPasswords = ['123', 'password', 'abc'];

    for (const password of weakPasswords) {
      try {
        const response = await fetch(`${this.config.targetUrl}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `test${Date.now()}@example.com`,
            password
          })
        });

        if (response.ok) {
          this.addVulnerability({
            id: 'A07-001',
            severity: 'medium',
            category: 'Authentication Failures',
            title: 'Weak Password Policy',
            description: 'Application accepts weak passwords',
            location: '/api/register',
            evidence: password,
            remediation: 'Implement strong password requirements',
            references: ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/']
          });
          break;
        }
      } catch (error) {
        // Expected
      }
    }

    // Check for session fixation
    try {
      const response1 = await fetch(`${this.config.targetUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'test' })
      });

      const setCookie1 = response1.headers.get('set-cookie');

      const response2 = await fetch(`${this.config.targetUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user2@example.com', password: 'test' })
      });

      const setCookie2 = response2.headers.get('set-cookie');

      if (setCookie1 === setCookie2) {
        this.addVulnerability({
          id: 'A07-002',
          severity: 'high',
          category: 'Authentication Failures',
          title: 'Session Fixation Vulnerability',
          description: 'Session ID is not regenerated after login',
          location: '/api/login',
          remediation: 'Regenerate session ID after authentication',
          references: ['https://owasp.org/www-community/attacks/Session_fixation']
        });
      }
    } catch (error) {
      // Expected
    }
  }

  /**
   * Check for integrity failures
   */
  private async checkIntegrityFailures(): Promise<void> {
    // Check for subresource integrity
    try {
      const response = await fetch(this.config.targetUrl);
      const text = await response.text();

      // Check if external scripts have integrity attributes
      if (text.includes('<script src="https://cdn.') &&
          !text.includes('integrity=')) {
        this.addVulnerability({
          id: 'A08-001',
          severity: 'low',
          category: 'Integrity Failures',
          title: 'Missing Subresource Integrity',
          description: 'External resources lack integrity checks',
          location: 'HTML',
          remediation: 'Add SRI hashes to external resources',
          references: ['https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity']
        });
      }
    } catch (error) {
      // Expected
    }
  }

  /**
   * Check for logging failures
   */
  private async checkLoggingFailures(): Promise<void> {
    // This would check for proper logging and monitoring
    // Placeholder for now
  }

  /**
   * Check for SSRF vulnerabilities
   */
  private async checkSSRF(): Promise<void> {
    const ssrfTests = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://169.254.169.254/latest/meta-data/', // AWS metadata
      'file:///etc/passwd'
    ];

    for (const url of ssrfTests) {
      try {
        const response = await fetch(`${this.config.targetUrl}/api/fetch?url=${encodeURIComponent(url)}`);

        if (response.ok && !response.redirected) {
          this.addVulnerability({
            id: 'A10-001',
            severity: 'critical',
            category: 'SSRF',
            title: 'Server-Side Request Forgery',
            description: 'Application is vulnerable to SSRF attacks',
            location: '/api/fetch',
            evidence: url,
            remediation: 'Validate and whitelist all URLs',
            references: ['https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/']
          });
          break;
        }
      } catch (error) {
        // Expected error
      }
    }
  }

  /**
   * Run dependency scan
   */
  private async runDependencyScan(): Promise<void> {
    // This would integrate with tools like Snyk, npm audit, etc.
    // Placeholder for now
  }

  /**
   * Run secret scan
   */
  private async runSecretScan(): Promise<void> {
    // Scan codebase for secrets
    const secretPatterns = [
      /API[_-]?KEY\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
      /SECRET[_-]?KEY\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
      /PASSWORD\s*[:=]\s*['"]?([a-zA-Z0-9_-]{10,})['"]?/gi,
      /TOKEN\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
      /sk-[a-zA-Z0-9]{32,}/g, // Stripe
      /ghp_[a-zA-Z0-9]{36,}/g, // GitHub
      /AKIA[0-9A-Z]{16}/g // AWS
    ];

    // This would scan actual codebase files
    // Placeholder for now
  }

  /**
   * Run compliance checks
   */
  private async runComplianceChecks(): Promise<void> {
    for (const standard of this.config.complianceChecks) {
      switch (standard) {
        case 'GDPR':
          await this.checkGDPRCompliance();
          break;
        case 'PCI-DSS':
          await this.checkPCIDSSCompliance();
          break;
        case 'HIPAA':
          await this.checkHIPAACompliance();
          break;
        case 'SOC2':
          await this.checkSOC2Compliance();
          break;
      }
    }
  }

  /**
   * Check GDPR compliance
   */
  private async checkGDPRCompliance(): Promise<void> {
    // Check for privacy policy, consent management, data export, etc.
  }

  /**
   * Check PCI-DSS compliance
   */
  private async checkPCIDSSCompliance(): Promise<void> {
    // Check for PCI DSS requirements
  }

  /**
   * Check HIPAA compliance
   */
  private async checkHIPAACompliance(): Promise<void> {
    // Check for HIPAA requirements
  }

  /**
   * Check SOC2 compliance
   */
  private async checkSOC2Compliance(): Promise<void> {
    // Check for SOC2 requirements
  }

  /**
   * Add a vulnerability
   */
  private addVulnerability(vulnerability: Vulnerability): void {
    this.vulnerabilities.push(vulnerability);
  }

  /**
   * Calculate security summary
   */
  private calculateSummary(): SecuritySummary {
    const summary: SecuritySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
      score: 100
    };

    for (const vuln of this.vulnerabilities) {
      summary[vuln.severity]++;
      summary.total++;

      // Calculate score (CVSS-style)
      const scoreMap = {
        critical: 10,
        high: 7,
        medium: 4,
        low: 1,
        info: 0
      };

      summary.score -= scoreMap[vuln.severity];
    }

    summary.score = Math.max(0, summary.score);

    return summary;
  }
}

/**
 * Penetration testing helper
 */
export class PenetrationTestHelper {
  /**
   * Test authentication bypass
   */
  static async testAuthBypass(baseUrl: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Test for missing auth on sensitive endpoints
    const sensitiveEndpoints = [
      '/api/admin',
      '/api/users',
      '/api/settings'
    ];

    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`);
        if (response.status === 200) {
          vulnerabilities.push({
            id: 'PENTEST-001',
            severity: 'critical',
            category: 'Authentication Bypass',
            title: 'Unauthenticated Endpoint Access',
            description: `Sensitive endpoint ${endpoint} accessible without authentication`,
            location: endpoint,
            remediation: 'Implement authentication checks',
            references: []
          });
        }
      } catch (error) {
        // Expected
      }
    }

    return vulnerabilities;
  }

  /**
   * Test privilege escalation
   */
  static async testPrivilegeEscalation(baseUrl: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Test for horizontal/vertical privilege escalation
    try {
      // Login as regular user
      const loginResponse = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'user123' })
      });

      if (loginResponse.ok) {
        const data = await loginResponse.json();
        const token = data.token;

        // Try to access admin endpoint
        const adminResponse = await fetch(`${baseUrl}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (adminResponse.ok) {
          vulnerabilities.push({
            id: 'PENTEST-002',
            severity: 'critical',
            category: 'Privilege Escalation',
            title: 'Vertical Privilege Escalation',
            description: 'Regular user can access admin endpoints',
            location: '/api/admin/users',
            remediation: 'Implement proper role-based access control',
            references: []
          });
        }
      }
    } catch (error) {
      // Expected
    }

    return vulnerabilities;
  }

  /**
   * Test data exposure
   */
  static async testDataExposure(baseUrl: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Test for exposed sensitive data
    const sensitiveDataEndpoints = [
      '/api/debug',
      '/api/logs',
      '/api/config',
      '/.env',
      '/api/secrets'
    ];

    for (const endpoint of sensitiveDataEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`);
        if (response.ok) {
          const text = await response.text();

          if (text.includes('password') || text.includes('secret') ||
              text.includes('api_key') || text.includes('DATABASE_URL')) {
            vulnerabilities.push({
              id: 'PENTEST-003',
              severity: 'high',
              category: 'Data Exposure',
              title: 'Sensitive Data Exposed',
              description: `Endpoint ${endpoint} exposes sensitive information`,
              location: endpoint,
              remediation: 'Remove sensitive endpoints from production',
              references: []
            });
          }
        }
      } catch (error) {
        // Expected
      }
    }

    return vulnerabilities;
  }
}
