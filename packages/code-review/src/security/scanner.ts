/**
 * Security Scanner - Detects security vulnerabilities and secrets
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  SecurityIssue,
  VulnerabilityReport,
  SecuritySummary,
  SecretFinding,
  DependencyVulnerability,
  FileInfo,
  Language,
  Severity,
  Issue,
} from '../types/index.js';

// ============================================================================
// Security Scanner Options
// ============================================================================

interface SecurityScannerOptions {
  enableSecretScanning?: boolean;
  enableDependencyScanning?: boolean;
  enableVulnerabilityScanning?: boolean;
  secretPatterns?: RegExp[];
  customRules?: SecurityRule[];
  owaspVersion?: '2021' | '2017' | '2010';
}

interface SecurityRule {
  id: string;
  name: string;
  description: string;
  cwe?: string;
  owasp?: string;
  severity: Severity;
  pattern: RegExp | string;
  language: Language[];
  fix?: string;
}

const DEFAULT_OPTIONS: SecurityScannerOptions = {
  enableSecretScanning: true,
  enableDependencyScanning: true,
  enableVulnerabilityScanning: true,
  owaspVersion: '2021',
};

// ============================================================================
// Security Scanner
// ============================================================================

export class SecurityScanner {
  private options: SecurityScannerOptions;
  private secretPatterns: RegExp[];
  private vulnerabilityRules: SecurityRule[];

  constructor(options: SecurityScannerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.secretPatterns = this.options.secretPatterns || this.getDefaultSecretPatterns();
    this.vulnerabilityRules = this.initializeVulnerabilityRules();
  }

  // ========================================================================
  // Main Scanning Methods
  // ========================================================================

  /**
   * Scan a single file for security issues
   */
  async scanFile(filePath: string, content: string, fileInfo: FileInfo): Promise<VulnerabilityReport> {
    const issues: SecurityIssue[] = [];

    // Scan for vulnerabilities
    if (this.options.enableVulnerabilityScanning) {
      const vulnerabilities = await this.scanVulnerabilities(filePath, content, fileInfo);
      issues.push(...vulnerabilities);
    }

    // Scan for secrets
    if (this.options.enableSecretScanning) {
      const secrets = await this.scanSecrets(filePath, content);
      // Convert secret findings to security issues
      for (const secret of secrets) {
        issues.push(this.secretToIssue(secret, fileInfo));
      }
    }

    // Apply custom rules
    if (this.options.customRules) {
      for (const rule of this.options.customRules) {
        if (rule.language.includes(fileInfo.language)) {
          const ruleIssues = await this.applyRule(rule, filePath, content, fileInfo);
          issues.push(...ruleIssues);
        }
      }
    }

    return this.buildVulnerabilityReport(issues);
  }

  /**
   * Scan multiple files
   */
  async scanFiles(files: Array<{ path: string; content: string; fileInfo: FileInfo }>): Promise<VulnerabilityReport> {
    const allIssues: SecurityIssue[] = [];

    for (const file of files) {
      const report = await this.scanFile(file.path, file.content, file.fileInfo);
      allIssues.push(...report.issues);
    }

    return this.buildVulnerabilityReport(allIssues);
  }

  /**
   * Scan for secrets only
   */
  async scanSecrets(filePath: string, content: string): Promise<SecretFinding[]> {
    const findings: SecretFinding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      for (const pattern of this.secretPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          findings.push({
            type: this.getSecretType(pattern),
            secret: this.maskSecret(match[0]),
            location: {
              path: filePath,
              line: i + 1,
              column: line.indexOf(match[0]) + 1,
            },
            verified: false, // Would need additional verification
          });
        }
      }
    }

    return findings;
  }

  /**
   * Scan for security vulnerabilities
   */
  async scanVulnerabilities(
    filePath: string,
    content: string,
    fileInfo: FileInfo
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    for (const rule of this.vulnerabilityRules) {
      if (!rule.language.includes(fileInfo.language)) {
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (typeof rule.pattern === 'string') {
          if (line.includes(rule.pattern)) {
            issues.push(this.createIssueFromRule(rule, filePath, i + 1, line, fileInfo));
          }
        } else {
          const match = line.match(rule.pattern);
          if (match) {
            issues.push(this.createIssueFromRule(rule, filePath, i + 1, line, fileInfo));
          }
        }
      }
    }

    return issues;
  }

  /**
   * Scan dependencies for vulnerabilities
   */
  async scanDependencies(projectPath: string): Promise<DependencyVulnerability[]> {
    if (!this.options.enableDependencyScanning) {
      return [];
    }

    const vulnerabilities: DependencyVulnerability[] = [];

    // Scan package.json for npm projects
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const [name, version] of Object.entries(deps)) {
        const vulns = await this.checkPackageVulnerabilities(name, version as string);
        vulnerabilities.push(...vulns);
      }
    } catch (error) {
      // No package.json or error reading it
    }

    // Scan requirements.txt for Python projects
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    try {
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      const packages = this.parseRequirementsTxt(requirements);

      for (const pkg of packages) {
        const vulns = await this.checkPythonVulnerabilities(pkg.name, pkg.version);
        vulnerabilities.push(...vulns);
      }
    } catch (error) {
      // No requirements.txt or error reading it
    }

    return vulnerabilities;
  }

  // ========================================================================
  // OWASP Top 10 (2021) Scanners
  // ========================================================================

  /**
   * Scan for OWASP Top 10 vulnerabilities
   */
  async scanOWASP(filePath: string, content: string, fileInfo: FileInfo): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // A01: Broken Access Control
    issues.push(...this.scanBrokenAccessControl(filePath, content, fileInfo));

    // A02: Cryptographic Failures
    issues.push(...this.scanCryptographicFailures(filePath, content, fileInfo));

    // A03: Injection
    issues.push(...this.scanInjection(filePath, content, fileInfo));

    // A04: Insecure Design
    issues.push(...this.scanInsecureDesign(filePath, content, fileInfo));

    // A05: Security Misconfiguration
    issues.push(...this.scanSecurityMisconfiguration(filePath, content, fileInfo));

    // A06: Vulnerable and Outdated Components
    issues.push(...this.scanOutdatedComponents(filePath, content, fileInfo));

    // A07: Identification and Authentication Failures
    issues.push(...this.scanAuthFailures(filePath, content, fileInfo));

    // A08: Software and Data Integrity Failures
    issues.push(...this.scanIntegrityFailures(filePath, content, fileInfo));

    // A09: Security Logging and Monitoring Failures
    issues.push(...this.scanLoggingFailures(filePath, content, fileInfo));

    // A10: Server-Side Request Forgery
    issues.push(...this.scanSSRF(filePath, content, fileInfo));

    return issues;
  }

  private scanBrokenAccessControl(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for missing authorization checks
      if (/\/\*(?!.*@private).*public\s+function/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A01-BROKEN-ACCESS-CONTROL',
          'Missing Authorization Check',
          'Public function without proper authorization check',
          'A01:2021 – Broken Access Control',
          'CWE-285',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for CORS misconfiguration
      if (/access-control-allow-origin:\s*\*/i.test(line)) {
        issues.push(this.createSecurityIssue(
          'A01-CORS-MISCONFIG',
          'CORS Misconfiguration',
          'Overly permissive CORS configuration allowing all origins',
          'A01:2021 – Broken Access Control',
          'CWE-942',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for path traversal
      if (/res\.sendFile\s*\(\s*[^,]+,\s*{\s*root:\s*[^}]+\s*\}\s*\)/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A01-PATH-TRAVERSAL',
          'Potential Path Traversal',
          'User input used in file operations without proper validation',
          'A01:2021 – Broken Access Control',
          'CWE-22',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanCryptographicFailures(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for weak encryption algorithms
      const weakAlgos = /\b(md4|md5|sha1|rc4|des|rc2)\b/i;
      if (weakAlgos.test(line)) {
        issues.push(this.createSecurityIssue(
          'A02-WEAK-CRYPTO',
          'Weak Cryptographic Algorithm',
          'Usage of weak or deprecated cryptographic algorithm',
          'A02:2021 – Cryptographic Failures',
          'CWE-327',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for hardcoded keys
      if (/private[_-]?key\s*=\s*['"`][^'"`]+['"`]/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A02-HARDCODED-KEY',
          'Hardcoded Cryptographic Key',
          'Cryptographic key is hardcoded in source code',
          'A02:2021 – Cryptographic Failures',
          'CWE-321',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for HTTP instead of HTTPS
      if (/http:\/\/(?!localhost)/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A02-INSECURE-PROTOCOL',
          'Insecure Protocol',
          'Usage of HTTP instead of HTTPS for sensitive data',
          'A02:2021 – Cryptographic Failures',
          'CWE-319',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanInjection(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // SQL Injection
      if (/\b(execute|query|raw)\s*\(\s*['"`].*\$\{.*\}['"`]/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A03-SQL-INJECTION',
          'SQL Injection',
          'User input directly concatenated into SQL query',
          'A03:2021 – Injection',
          'CWE-89',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Command Injection
      if (/\b(exec|spawn|system)\s*\(\s*[^,]+,\s*.*\$.*\)/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A03-COMMAND-INJECTION',
          'Command Injection',
          'User input used in command execution without proper sanitization',
          'A03:2021 – Injection',
          'CWE-78',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // XSS
      if (/\.innerHTML\s*=\s*.*\$\{.*\}/.test(line) || /dangerouslySetInnerHTML/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A03-XSS',
          'Cross-Site Scripting (XSS)',
          'User input rendered without proper sanitization',
          'A03:2021 – Injection',
          'CWE-79',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // LDAP Injection
      if (/\b(search|query)\s*\(\s*[^,]+,\s*.*\$.*\)/.test(line) && /filter=/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A03-LDAP-INJECTION',
          'LDAP Injection',
          'User input used in LDAP filter without sanitization',
          'A03:2021 – Injection',
          'CWE-90',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanInsecureDesign(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for missing rate limiting
      if (/(router|app)\.(get|post|put|delete)/.test(line)) {
        // Look ahead for rate limiting middleware
        const hasRateLimit = content.substring(
          Math.max(0, content.indexOf(line) - 200),
          content.indexOf(line) + 200
        ).includes('rateLimit');

        if (!hasRateLimit) {
          issues.push(this.createSecurityIssue(
            'A04-MISSING-RATE-LIMIT',
            'Missing Rate Limiting',
            'Endpoint without rate limiting protection',
            'A04:2021 – Insecure Design',
            'CWE-770',
            filePath,
            index + 1,
            line,
            fileInfo,
            'info'
          ));
        }
      }

      // Check for mass assignment
      if (/\b(new|create)\s+\w+\s*\(\s*req\.body/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A04-MASS-ASSIGNMENT',
          'Mass Assignment Vulnerability',
          'Direct assignment of request body to model without allowlist/denylist',
          'A04:2021 – Insecure Design',
          'CWE-915',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanSecurityMisconfiguration(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for debug mode enabled
      if (/debug\s*=\s*true/i.test(line)) {
        issues.push(this.createSecurityIssue(
          'A05-DEBUG-ENABLED',
          'Debug Mode Enabled',
          'Application running in debug mode in production',
          'A05:2021 – Security Misconfiguration',
          'CWE-489',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for verbose error messages
      if (/console\.log\s*\(\s*error/.test(line) || /console\.error\s*\(/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A05-VERBOSE-ERRORS',
          'Verbose Error Messages',
          'Sensitive information may be exposed through error messages',
          'A05:2021 – Security Misconfiguration',
          'CWE-209',
          filePath,
          index + 1,
          line,
          fileInfo,
          'info'
        ));
      }

      // Check for default credentials
      if (/(username|password|user|pass)\s*=\s*['"`](admin|password|root|test)['"`]/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A05-DEFAULT-CREDENTIALS',
          'Default Credentials',
          'Default or hardcoded credentials detected',
          'A05:2021 – Security Misconfiguration',
          'CWE-798',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanOutdatedComponents(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    // This requires dependency scanning, handled separately
    return [];
  }

  private scanAuthFailures(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for weak password requirements
      if (/password.*min.*length.*[0-4]\b/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A07-WEAK-PASSWORD',
          'Weak Password Requirements',
          'Password minimum length is too low',
          'A07:2021 – Identification and Authentication Failures',
          'CWE-521',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for missing authentication
      if (/router\.(get|post|put|delete)\s*\(\s*['"`]\s*\/(login|auth)/.test(line)) {
        // This is actually OK for login endpoints
      } else if (/router\.(get|post|put|delete)\s*\(/.test(line)) {
        // Check if auth middleware is present
        const hasAuth = content.substring(
          Math.max(0, content.indexOf(line) - 300),
          content.indexOf(line) + 300
        ).includes('authenticate') || content.includes('authorize');

        if (!hasAuth && !line.includes('public')) {
          issues.push(this.createSecurityIssue(
            'A07-MISSING-AUTH',
            'Missing Authentication',
            'Endpoint without proper authentication',
            'A07:2021 – Identification and Authentication Failures',
            'CWE-306',
            filePath,
            index + 1,
            line,
            fileInfo,
            'warning'
          ));
        }
      }

      // Check for session fixation
      if (/sessionID\s*=\s*req\.query/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A07-SESSION-FIXATION',
          'Session Fixation Vulnerability',
          'Session ID taken from URL parameter',
          'A07:2021 – Identification and Authentication Failures',
          'CWE-384',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanIntegrityFailures(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for code deserialization
      if (/\b(deserialize|unmarshal|parse)\s*\(\s*user/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A08-UNSAFE-DESERIALIZATION',
          'Unsafe Deserialization',
          'Deserializing untrusted user input',
          'A08:2021 – Software and Data Integrity Failures',
          'CWE-502',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for auto-update without signature verification
      if (/\b(update|upgrade)\s*\(\s*[^,]*,\s*{\s*verify:\s*false/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A08-UNVERIFIED-UPDATE',
          'Unverified Auto-Update',
          'Auto-update without signature verification',
          'A08:2021 – Software and Data Integrity Failures',
          'CWE-494',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanLoggingFailures(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    // Check for missing logging on sensitive operations
    let hasLogging = false;
    let hasSensitiveOperation = false;

    lines.forEach((line, index) => {
      if (/login|authenticate|authorize|password/.test(line)) {
        hasSensitiveOperation = true;
      }

      if (/logger\.|console\.|log\./.test(line)) {
        hasLogging = true;
      }
    });

    if (hasSensitiveOperation && !hasLogging) {
      issues.push(this.createSecurityIssue(
        'A09-MISSING-LOGGING',
        'Missing Security Logging',
        'Sensitive operations without proper logging',
        'A09:2021 – Security Logging and Monitoring Failures',
        'CWE-778',
        filePath,
        1,
        '',
        fileInfo,
        'info'
      ));
    }

    // Check for logging sensitive data
    lines.forEach((line, index) => {
      if (/logger\.(log|info|debug|warn)\s*\(\s*.*password|token|secret|key/i.test(line)) {
        issues.push(this.createSecurityIssue(
          'A09-LOGGING-SENSITIVE',
          'Logging Sensitive Data',
          'Sensitive information being logged',
          'A09:2021 – Security Logging and Monitoring Failures',
          'CWE-532',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  private scanSSRF(filePath: string, content: string, fileInfo: FileInfo): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for URL fetch with user input
      if (/\b(fetch|axios|request|http\.get)\s*\(\s*req\.(query|body|params)/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A10-SSRF',
          'Server-Side Request Forgery (SSRF)',
          'User-controlled URL in server-side request',
          'A10:2021 – Server-Side Request Forgery',
          'CWE-918',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }

      // Check for open redirect
      if (/res\.redirect\s*\(\s*302,\s*req\.(query|params)/.test(line)) {
        issues.push(this.createSecurityIssue(
          'A10-OPEN-REDIRECT',
          'Open Redirect Vulnerability',
          'Unvalidated redirect to user-controlled URL',
          'A10:2021 – Server-Side Request Forgery (Related)',
          'CWE-601',
          filePath,
          index + 1,
          line,
          fileInfo
        ));
      }
    });

    return issues;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private getDefaultSecretPatterns(): RegExp[] {
    return [
      // API Keys
      /(?:api[_-]?key|apikey)['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
      /(?:sk_|pk_|AIza)[a-zA-Z0-9_\-]{35,}/,

      // AWS Keys
      /AKIA[0-9A-Z]{16}/,
      /aws[_-]?(?:access[_-]?key[_-]?id|secret[_-]?access[_-]?key)['"\s]*[:=]['"\s]*[a-zA-Z0-9\/+]{20,}/i,

      // GitHub
      /ghp_[a-zA-Z0-9]{36}/,
      /gho_[a-zA-Z0-9]{36}/,
      /ghu_[a-zA-Z0-9]{36}/,
      /ghs_[a-zA-Z0-9]{36}/,
      /ghr_[a-zA-Z0-9]{36}/,

      // Slack
      /xox[pbar]-[a-zA-Z0-9-]{32,}/,

      // Database URLs
      /(?:mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@/,

      // JWT
      /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,

      // Private Keys
      /-----BEGIN[A-Z\s]+PRIVATE KEY-----/,
      /-----BEGIN[A-Z\s]+KEY-----/,

      // Passwords
      /(?:password|passwd|pwd)['"\s]*[:=]['"\s]*[^'\s]{8,}/i,

      // Tokens
      /(?:token|bearer|auth)['"\s]*[:=]['"\s]*[a-zA-Z0-9_\-]{20,}/i,

      // Secrets
      /(?:secret|private[_-]?key)['"\s]*[:=]['"\s]*[^'\s]{10,}/i,
    ];
  }

  private getSecretType(pattern: RegExp): string {
    const patternStr = pattern.toString();

    if (patternStr.includes('api')) return 'API Key';
    if (patternStr.includes('AKIA')) return 'AWS Access Key';
    if (patternStr.includes('ghp_')) return 'GitHub Personal Access Token';
    if (patternStr.includes('xox')) return 'Slack Token';
    if (patternStr.includes('mysql') || patternStr.includes('postgres')) return 'Database URL';
    if (patternStr.includes('jwt') || patternStr.includes('eyJ')) return 'JWT Token';
    if (patternStr.includes('PRIVATE KEY')) return 'Private Key';
    if (patternStr.includes('password')) return 'Password';
    if (patternStr.includes('token')) return 'Token';

    return 'Secret';
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length);
    }
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }

  private secretToIssue(secret: SecretFinding, fileInfo: FileInfo): SecurityIssue {
    const severity: Severity = secret.verified ? 'error' : 'warning';

    return {
      id: `SECRET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: 'security-secret-detected',
      severity,
      category: 'security',
      title: `${secret.type} Detected`,
      description: `A potential ${secret.type.toLowerCase()} was found in the codebase. Secrets should be stored in environment variables or a secret management system.`,
      location: secret.location,
      code: secret.secret,
      suggestion: 'Move this secret to environment variables or a secure vault',
      metadata: {
        secretType: secret.type,
        verified: secret.verified,
      },
      timestamp: new Date(),
      riskScore: secret.verified ? 9 : 7,
      exploitability: 8,
      impact: 9,
      cwe: 'CWE-798',
      owasp: 'A01:2021 – Broken Access Control (Related)',
    };
  }

  private initializeVulnerabilityRules(): SecurityRule[] {
    return [
      {
        id: 'eval-usage',
        name: 'Dangerous eval() Usage',
        description: 'Using eval() with user input can lead to code injection attacks',
        cwe: 'CWE-95',
        owasp: 'A03:2021 – Injection',
        severity: 'error',
        pattern: /\beval\s*\(\s*[^)]*\$/i,
        language: ['javascript', 'typescript'],
        fix: 'Avoid using eval() with user input. Use safe alternatives like JSON.parse() for JSON data.',
      },
      {
        id: 'unsafe-regexp',
        name: 'Unsafe Regular Expression',
        description: 'Regular expression that may cause ReDoS (Regular Expression Denial of Service)',
        cwe: 'CWE-1333',
        owasp: 'A04:2021 – Insecure Design',
        severity: 'warning',
        pattern: /\(.+\)\+\(.+\)+/,
        language: ['javascript', 'typescript', 'python', 'go', 'java'],
        fix: 'Rewrite the regex to avoid nested quantifiers and excessive backtracking.',
      },
      {
        id: 'hardcoded-port',
        name: 'Hardcoded Network Port',
        description: 'Network port should be configurable, not hardcoded',
        cwe: 'CWE-15',
        owasp: 'A05:2021 – Security Misconfiguration',
        severity: 'info',
        pattern: /:\s*(3000|8080|5000|8000|9000)\b/,
        language: ['javascript', 'typescript', 'python', 'go', 'java'],
        fix: 'Use environment variables for configuration: process.env.PORT || 3000',
      },
    ];
  }

  private async applyRule(
    rule: SecurityRule,
    filePath: string,
    content: string,
    fileInfo: FileInfo
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    if (typeof rule.pattern === 'string') {
      if (content.includes(rule.pattern)) {
        const lineIndex = content.split('\n').findIndex((line) => line.includes(rule.pattern as string));
        issues.push(this.createIssueFromRule(rule, filePath, lineIndex + 1, '', fileInfo));
      }
    } else {
      const matches = content.matchAll(rule.pattern);
      for (const match of matches) {
        const lineIndex = content.substring(0, match.index!).split('\n').length - 1;
        issues.push(this.createIssueFromRule(rule, filePath, lineIndex + 1, match[0], fileInfo));
      }
    }

    return issues;
  }

  private createIssueFromRule(
    rule: SecurityRule,
    filePath: string,
    line: number,
    code: string,
    fileInfo: FileInfo,
    customSeverity?: Severity
  ): SecurityIssue {
    return {
      id: `SEC-${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      severity: customSeverity || rule.severity,
      category: 'security',
      title: rule.name,
      description: rule.description,
      location: {
        path: filePath,
        line,
        column: 1,
      },
      code,
      suggestion: rule.fix,
      metadata: {
        cwe: rule.cwe,
        owasp: rule.owasp,
      },
      timestamp: new Date(),
      riskScore: this.calculateRiskScore(rule.severity),
      exploitability: 7,
      impact: 8,
      cwe: rule.cwe,
      owasp: rule.owasp,
    };
  }

  private createSecurityIssue(
    id: string,
    title: string,
    description: string,
    owasp: string,
    cwe: string,
    filePath: string,
    line: number,
    code: string,
    fileInfo: FileInfo,
    severity: Severity = 'error'
  ): SecurityIssue {
    return {
      id: `SEC-${id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: id,
      severity,
      category: 'security',
      title,
      description,
      location: {
        path: filePath,
        line,
        column: 1,
      },
      code,
      suggestion: 'Review and fix the security issue according to OWASP guidelines',
      metadata: {
        owasp,
        cwe,
      },
      timestamp: new Date(),
      riskScore: this.calculateRiskScore(severity),
      exploitability: 7,
      impact: 8,
      cwe,
      owasp,
    };
  }

  private calculateRiskScore(severity: Severity): number {
    const scores: Record<Severity, number> = {
      error: 9,
      warning: 6,
      info: 3,
      hint: 1,
    };
    return scores[severity];
  }

  private buildVulnerabilityReport(issues: SecurityIssue[]): VulnerabilityReport {
    const summary = this.buildSecuritySummary(issues);

    return {
      issues,
      summary,
      dependencies: [],
    };
  }

  private buildSecuritySummary(issues: SecurityIssue[]): SecuritySummary {
    const summary: SecuritySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      totalRiskScore: 0,
    };

    for (const issue of issues) {
      const score = issue.riskScore;
      if (score >= 9) summary.critical++;
      else if (score >= 7) summary.high++;
      else if (score >= 4) summary.medium++;
      else summary.low++;

      summary.totalRiskScore += score;
    }

    return summary;
  }

  private async checkPackageVulnerabilities(name: string, version: string): Promise<DependencyVulnerability[]> {
    // This would call npm audit or Snyk API
    // For now, return empty array
    return [];
  }

  private async checkPythonVulnerabilities(name: string, version: string): Promise<DependencyVulnerability[]> {
    // This would call safety check or PyPI API
    // For now, return empty array
    return [];
  }

  private parseRequirementsTxt(content: string): Array<{ name: string; version: string }> {
    const packages: Array<{ name: string; version: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[>=<]+(.+))?/);
        if (match) {
          packages.push({
            name: match[1],
            version: match[2] || '*',
          });
        }
      }
    }

    return packages;
  }
}
