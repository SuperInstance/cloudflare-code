/**
 * Security Vulnerability Scanner
 *
 * Comprehensive security analysis including:
 * - SQL injection detection
 * - XSS vulnerability detection
 * - Secret/credential detection
 * - Dependency vulnerability scanning
 * - Insecure cryptographic practices
 * - Authentication/authorization issues
 * - API security issues
 *
 * References:
 * - OWASP Top 10
 * - CWE (Common Weakness Enumeration)
 * - CVE (Common Vulnerabilities and Exposures)
 */

import type { SupportedLanguage } from '../codebase/types';
import type {
  SecurityReport,
  SecurityVulnerability,
  Secret,
  DependencyVulnerability,
  CodeIssue,
  ReviewOptions,
} from './types';

// ============================================================================
// Security Pattern Database
// ============================================================================

/**
 * CWE (Common Weakness Enumeration) mappings
 */
const CWE_MAP: Record<string, { id: string; name: string; url: string }> = {
  'sql-injection': {
    id: 'CWE-89',
    name: 'SQL Injection',
    url: 'https://cwe.mitre.org/data/definitions/89.html',
  },
  'xss': {
    id: 'CWE-79',
    name: 'Cross-Site Scripting',
    url: 'https://cwe.mitre.org/data/definitions/79.html',
  },
  'csrf': {
    id: 'CWE-352',
    name: 'Cross-Site Request Forgery',
    url: 'https://cwe.mitre.org/data/definitions/352.html',
  },
  'hardcoded-secret': {
    id: 'CWE-798',
    name: 'Use of Hard-coded Credentials',
    url: 'https://cwe.mitre.org/data/definitions/798.html',
  },
  'weak-crypto': {
    id: 'CWE-327',
    name: 'Use of a Broken or Risky Cryptographic Algorithm',
    url: 'https://cwe.mitre.org/data/definitions/327.html',
  },
  'auth-bypass': {
    id: 'CWE-287',
    name: 'Improper Authentication',
    url: 'https://cwe.mitre.org/data/definitions/287.html',
  },
  'path-traversal': {
    id: 'CWE-22',
    name: 'Path Traversal',
    url: 'https://cwe.mitre.org/data/definitions/22.html',
  },
  'command-injection': {
    id: 'CWE-77',
    name: 'Command Injection',
    url: 'https://cwe.mitre.org/data/definitions/77.html',
  },
  'ssrf': {
    id: 'CWE-918',
    name: 'Server-Side Request Forgery',
    url: 'https://cwe.mitre.org/data/definitions/918.html',
  },
  'insecure-deserialization': {
    id: 'CWE-502',
    name: 'Deserialization of Untrusted Data',
    url: 'https://cwe.mitre.org/data/definitions/502.html',
  },
};

/**
 * OWASP category mappings
 */
const OWASP_MAP: Record<string, string> = {
  'sql-injection': 'A01:2021-Broken Access Control',
  'xss': 'A03:2021-Injection',
  'csrf': 'A01:2021-Broken Access Control',
  'hardcoded-secret': 'A07:2021-Identification and Authentication Failures',
  'weak-crypto': 'A02:2021-Cryptographic Failures',
  'auth-bypass': 'A01:2021-Broken Access Control',
  'path-traversal': 'A01:2021-Broken Access Control',
  'command-injection': 'A03:2021-Injection',
};

/**
 * Secret detection patterns
 */
const SECRET_PATTERNS: Array<{
  type: Secret['type'];
  pattern: RegExp;
  severity: SecurityVulnerability['severity'];
  description: string;
  cwe?: string;
}> = [
  {
    type: 'aws-access-key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'aws-secret-key',
    pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
    severity: 'critical',
    description: 'AWS Secret Access Key detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'google-cloud-key',
    pattern: /"type":\s*"service_account"/g,
    severity: 'critical',
    description: 'Google Cloud Service Account key detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'azure-key',
    pattern: /[a-zA-Z0-9/_-]{40}\.database\.azure\.com/g,
    severity: 'critical',
    description: 'Azure connection string detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'api-key',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([A-Za-z0-9/_-]{20,})['"]/gi,
    severity: 'high',
    description: 'API key detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'jwt',
    pattern: /eyJ[A-Za-z0-9/_-]+\.[A-Za-z0-9/_-]+\.[A-Za-z0-9/_-]+/g,
    severity: 'high',
    description: 'JWT token detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
    severity: 'critical',
    description: 'Hardcoded password detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'private-key',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    severity: 'critical',
    description: 'Private key detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'database-url',
    pattern: /(?:mongodb|mysql|postgres|redis):\/\/[^@]+@[^\/\s]+/g,
    severity: 'critical',
    description: 'Database connection string detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'service-account',
    pattern: /service[_-]?account\s*[:=]\s*['"]([^'"]+)['"]/gi,
    severity: 'high',
    description: 'Service account credential detected',
    cwe: 'hardcoded-secret',
  },
  {
    type: 'oauth-token',
    pattern: /oauth[_-]?token\s*[:=]\s*['"]([^'"]{20,})['"]/gi,
    severity: 'high',
    description: 'OAuth token detected',
    cwe: 'hardcoded-secret',
  },
];

/**
 * Injection vulnerability patterns
 */
const INJECTION_PATTERNS: Array<{
  type: string;
  pattern: RegExp;
  severity: SecurityVulnerability['severity'];
  description: string;
  cwe: string;
  owasp?: string;
}> = [
  {
    type: 'sql-injection',
    pattern: /(?:query|execute|exec)\s*\(\s*['"`][^'"`]*\$\{[^}]+\}[^'"`]*['"`]\s*\)/gi,
    severity: 'critical',
    description: 'SQL injection vulnerability detected via template literal interpolation',
    cwe: 'sql-injection',
    owasp: 'A03:2021-Injection',
  },
  {
    type: 'sql-injection',
    pattern: /(?:query|execute|exec)\s*\(\s*['"`][^'"`]*\+[^'"`]*['"`]\s*\)/gi,
    severity: 'critical',
    description: 'SQL injection vulnerability detected via string concatenation',
    cwe: 'sql-injection',
    owasp: 'A03:2021-Injection',
  },
  {
    type: 'sql-injection',
    pattern: /(?:query|execute|exec)\s*\(\s*['"`][^'"`]*format\s*\([^'"`]*['"`]\s*\)/gi,
    severity: 'critical',
    description: 'SQL injection vulnerability detected via format string',
    cwe: 'sql-injection',
    owasp: 'A03:2021-Injection',
  },
  {
    type: 'command-injection',
    pattern: /(?:exec|spawn)\s*\(\s*['"`][^'"`]*\$\{[^}]+\}[^'"`]*['"`]\s*\)/gi,
    severity: 'critical',
    description: 'Command injection vulnerability detected',
    cwe: 'command-injection',
    owasp: 'A03:2021-Injection',
  },
  {
    type: 'command-injection',
    pattern: /(?:exec|spawn)\s*\(\s*['"`][^'"`]*\+[^'"`]*['"`]\s*\)/gi,
    severity: 'critical',
    description: 'Command injection vulnerability detected via string concatenation',
    cwe: 'command-injection',
    owasp: 'A03:2021-Injection',
  },
  {
    type: 'path-traversal',
    pattern: /(?:readFile|writeFile|unlink)\s*\(\s*(?:[^,]*,\s*)?\$\{[^}]+\}/g,
    severity: 'high',
    description: 'Path traversal vulnerability detected via template literal',
    cwe: 'path-traversal',
    owasp: 'A01:2021-Broken Access Control',
  },
  {
    type: 'path-traversal',
    pattern: /(?:readFile|writeFile|unlink)\s*\(\s*(?:[^,]*,\s*)?[^,]*\+\s*[^)]+\)/g,
    severity: 'high',
    description: 'Path traversal vulnerability detected via string concatenation',
    cwe: 'path-traversal',
    owasp: 'A01:2021-Broken Access Control',
  },
];

/**
 * XSS vulnerability patterns
 */
const XSS_PATTERNS: Array<{
  type: string;
  pattern: RegExp;
  severity: SecurityVulnerability['severity'];
  description: string;
  remediation: string;
}> = [
  {
    type: 'xss',
    pattern: /(?:innerHTML|outerHTML)\s*=\s*[^;]*\$\{[^}]+\}/g,
    severity: 'high',
    description: 'XSS vulnerability via innerHTML with template literal',
    remediation: 'Use textContent or sanitize HTML with a library like DOMPurify',
  },
  {
    type: 'xss',
    pattern: /(?:innerHTML|outerHTML)\s*=\s*[^;]*\+/g,
    severity: 'high',
    description: 'XSS vulnerability via innerHTML with string concatenation',
    remediation: 'Use textContent or sanitize HTML with a library like DOMPurify',
  },
  {
    type: 'xss',
    pattern: /dangerouslySetInnerHTML\s*=/g,
    severity: 'high',
    description: 'XSS vulnerability via dangerouslySetInnerHTML',
    remediation: 'Use React\'s safe rendering alternatives or sanitize with DOMPurify',
  },
  {
    type: 'xss',
    pattern: /document\.write\s*\(\s*[^)]*\$/g,
    severity: 'high',
    description: 'XSS vulnerability via document.write',
    remediation: 'Use safer DOM manipulation methods or sanitize input',
  },
  {
    type: 'xss',
    pattern: /(?:html|append|prepend)\s*\(\s*[^)]*\$/g,
    severity: 'medium',
    description: 'Potential XSS vulnerability via jQuery HTML manipulation',
    remediation: 'Use .text() instead or sanitize input',
  },
];

/**
 * Weak cryptography patterns
 */
const WEAK_CRYPTO_PATTERNS: Array<{
  type: string;
  pattern: RegExp;
  severity: SecurityVulnerability['severity'];
  description: string;
  recommendation: string;
}> = [
  {
    type: 'weak-crypto',
    pattern: /\bmd5\s*\(/gi,
    severity: 'medium',
    description: 'MD5 hash algorithm is cryptographically broken',
    recommendation: 'Use SHA-256 or stronger (e.g., SHA-384, SHA-512)',
  },
  {
    type: 'weak-crypto',
    pattern: /\bsha1?\s*\(/gi,
    severity: 'medium',
    description: 'SHA-1 hash algorithm is deprecated and cryptographically weak',
    recommendation: 'Use SHA-256 or stronger (e.g., SHA-384, SHA-512)',
  },
  {
    type: 'weak-crypto',
    pattern: /createHash\s*\(\s*['"`]md5['"`]/gi,
    severity: 'medium',
    description: 'MD5 hash algorithm is cryptographically broken',
    recommendation: 'Use createHash with "sha256" or stronger',
  },
  {
    type: 'weak-crypto',
    pattern: /createHash\s*\(\s*['"`]sha1['"`]/gi,
    severity: 'medium',
    description: 'SHA-1 hash algorithm is deprecated and cryptographically weak',
    recommendation: 'Use createHash with "sha256" or stronger',
  },
  {
    type: 'weak-crypto',
    pattern: /createCipher\s*\(/gi,
    severity: 'critical',
    description: 'Obsolete encryption function createCipher is insecure',
    recommendation: 'Use createCipherIV with proper authentication (e.g., AES-GCM)',
  },
  {
    type: 'weak-crypto',
    pattern: /createDecipher\s*\(/gi,
    severity: 'critical',
    description: 'Obsolete decryption function createDecipher is insecure',
    recommendation: 'Use createDecipherIV with proper authentication (e.g., AES-GCM)',
  },
  {
    type: 'weak-crypto',
    pattern: /\brc4\b/gi,
    severity: 'critical',
    description: 'RC4 cipher is broken and should not be used',
    recommendation: 'Use AES-256-GCM or another modern authenticated cipher',
  },
  {
    type: 'weak-crypto',
    pattern: /\bdes\b|\b3des\b/gi,
    severity: 'high',
    description: 'DES and 3DES are deprecated and insecure',
    recommendation: 'Use AES-256 or another modern cipher',
  },
];

/**
 * Weak random number patterns
 */
const WEAK_RANDOM_PATTERNS = [
  {
    pattern: /Math\.random\s*\(\s*\)/g,
    context: /password|token|key|secret|crypto|encrypt|auth|session|nonce/i,
    severity: 'high' as const,
    description: 'Weak random number generator (Math.random) used in security context',
    recommendation: 'Use crypto.getRandomValues() for cryptographically secure random numbers',
  },
  {
    pattern: /\brand\s*\(/g,
    context: /password|token|key|secret|crypto|encrypt|auth|session|nonce/i,
    severity: 'high' as const,
    description: 'Weak random number generator (rand) used in security context',
    recommendation: 'Use a cryptographically secure random number generator',
  },
];

// ============================================================================
// Security Scanner
// ============================================================================

/**
 * Security scanner configuration
 */
interface SecurityScannerConfig {
  checkSecrets: boolean;
  checkInjection: boolean;
  checkXSS: boolean;
  checkCrypto: boolean;
  checkAuth: boolean;
  checkDependencies: boolean;
  minSecretEntropy: number;
  maxFileSize: number;
}

/**
 * Security vulnerability scanner
 */
export class SecurityScanner {
  private config: SecurityScannerConfig;
  private vulnerabilityDB: Map<string, DependencyVulnerability[]>;

  constructor(config: Partial<SecurityScannerConfig> = {}) {
    this.config = {
      checkSecrets: config.checkSecrets ?? true,
      checkInjection: config.checkInjection ?? true,
      checkXSS: config.checkXSS ?? true,
      checkCrypto: config.checkCrypto ?? true,
      checkAuth: config.checkAuth ?? true,
      checkDependencies: config.checkDependencies ?? true,
      minSecretEntropy: config.minSecretEntropy ?? 3.5,
      maxFileSize: config.maxFileSize ?? 1024 * 1024,
    };
    this.vulnerabilityDB = new Map();
  }

  /**
   * Scan a file for security vulnerabilities
   */
  async scanFile(
    content: string,
    filePath: string,
    language: SupportedLanguage,
    options?: ReviewOptions
  ): Promise<SecurityReport> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const secrets: Secret[] = [];

    // Check file size
    if (content.length > this.config.maxFileSize) {
      throw new Error(`File too large: ${filePath}`);
    }

    // Scan for secrets
    if (this.config.checkSecrets) {
      const detectedSecrets = this.scanSecrets(content, filePath, language);
      secrets.push(...detectedSecrets);
    }

    // Scan for injection vulnerabilities
    if (this.config.checkInjection) {
      const injectionVulns = this.scanInjectionVulnerabilities(content, filePath, language);
      vulnerabilities.push(...injectionVulns);
    }

    // Scan for XSS vulnerabilities
    if (this.config.checkXSS) {
      const xssVulns = this.scanXSSVulnerabilities(content, filePath, language);
      vulnerabilities.push(...xssVulns);
    }

    // Scan for weak cryptography
    if (this.config.checkCrypto) {
      const cryptoVulns = this.scanWeakCryptography(content, filePath, language);
      vulnerabilities.push(...cryptoVulns);
    }

    // Scan for weak random in security contexts
    const randomVulns = this.scanWeakRandom(content, filePath, language);
    vulnerabilities.push(...randomVulns);

    // Calculate score
    const score = this.calculateSecurityScore(vulnerabilities, secrets);

    // Generate summary
    const summary = this.generateSummary(vulnerabilities, secrets);

    return {
      vulnerabilities,
      secrets,
      dependencyVulnerabilities: [], // Will be populated by dependency scanner
      score,
      summary,
    };
  }

  /**
   * Scan for hardcoded secrets
   */
  private scanSecrets(content: string, filePath: string, language: SupportedLanguage): Secret[] {
    const secrets: Secret[] = [];
    const lines = content.split('\n');

    for (const secretPattern of SECRET_PATTERNS) {
      let match;
      const regex = new RegExp(secretPattern.pattern.source, secretPattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        const column = content.substring(0, match.index).split('\n').pop()!.length;

        // Extract the secret value
        const value = match[1] || match[0];

        // Calculate entropy (measure of randomness)
        const entropy = this.calculateEntropy(value);

        // Filter by minimum entropy
        if (entropy < this.config.minSecretEntropy) {
          continue;
        }

        // Verify it's not a false positive
        if (this.isSecretFalsePositive(value, lines[lineNum - 1])) {
          continue;
        }

        secrets.push({
          type: secretPattern.type,
          value: this.maskSecret(value),
          file: filePath,
          line: lineNum,
          column,
          severity: secretPattern.severity,
          verified: true,
        });
      }
    }

    return secrets;
  }

  /**
   * Scan for injection vulnerabilities
   */
  private scanInjectionVulnerabilities(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = content.split('\n');

    for (const pattern of INJECTION_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        const cwe = CWE_MAP[pattern.cwe];
        const owasp = pattern.owasp || OWASP_MAP[pattern.cwe];

        vulnerabilities.push({
          id: this.generateVulnerabilityId(pattern.type, lineNum),
          severity: pattern.severity,
          category: pattern.type === 'sql-injection' ? 'injection' : 'data-exposure',
          title: pattern.description,
          description: pattern.description,
          cwe: cwe?.id,
          owasp,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          remediation: this.getInjectionRemediation(pattern.type),
          references: [
            cwe?.url || 'https://owasp.org/www-project-top-ten/',
            owasp ? `https://owasp.org/Top10/${owasp}` : undefined,
          ].filter(Boolean) as string[],
          confidence: 0.8,
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Scan for XSS vulnerabilities
   */
  private scanXSSVulnerabilities(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = content.split('\n');
    const cwe = CWE_MAP['xss'];

    for (const pattern of XSS_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        vulnerabilities.push({
          id: this.generateVulnerabilityId('xss', lineNum),
          severity: pattern.severity,
          category: 'injection',
          title: pattern.description,
          description: pattern.description,
          cwe: cwe?.id,
          owasp: 'A03:2021-Injection',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          remediation: pattern.remediation,
          references: [
            cwe?.url || 'https://owasp.org/www-project-top-ten/',
            'https://owasp.org/www-community/attacks/xss/',
          ],
          confidence: 0.7,
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Scan for weak cryptography
   */
  private scanWeakCryptography(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = content.split('\n');
    const cwe = CWE_MAP['weak-crypto'];

    for (const pattern of WEAK_CRYPTO_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        vulnerabilities.push({
          id: this.generateVulnerabilityId('weak-crypto', lineNum),
          severity: pattern.severity,
          category: 'crypto',
          title: pattern.description,
          description: pattern.description,
          cwe: cwe?.id,
          owasp: 'A02:2021-Cryptographic Failures',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          remediation: pattern.recommendation,
          references: [
            cwe?.url || 'https://owasp.org/www-project-top-ten/',
            'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html',
          ],
          confidence: 0.9,
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Scan for weak random number generation
   */
  private scanWeakRandom(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = content.split('\n');

    for (const pattern of WEAK_RANDOM_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        // Check if in security context
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 200);
        const context = content.substring(contextStart, contextEnd);

        if (pattern.context.test(context)) {
          vulnerabilities.push({
            id: this.generateVulnerabilityId('weak-random', lineNum),
            severity: pattern.severity,
            category: 'crypto',
            title: pattern.description,
            description: pattern.description,
            cwe: 'CWE-338',
            owasp: 'A02:2021-Cryptographic Failures',
            file: filePath,
            line: lineNum,
            code: lines[lineNum - 1]?.trim(),
            remediation: pattern.recommendation,
            references: [
              'https://cwe.mitre.org/data/definitions/338.html',
            ],
            confidence: 0.75,
          });
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Check for authentication/authorization issues
   */
  async scanAuthIssues(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = content.split('\n');
    const cwe = CWE_MAP['auth-bypass'];

    // Check for hardcoded credentials in auth logic
    const authPatterns = [
      {
        pattern: /(?:if|assert)\s*\([^)]*\s*(?:username|password|token)\s*[=!==]+\s*['"`][^'"`]+['"`]/gi,
        message: 'Hardcoded credentials in authentication logic',
      },
      {
        pattern: /auth(?:orize)?\s*[:=]\s*true/gi,
        message: 'Authorization bypassed with hardcoded value',
      },
      {
        pattern: /isAdmin\s*[=!:]+\s*true/gi,
        message: 'Admin check bypassed with hardcoded value',
      },
      {
        pattern: /skipAuth\s*[=!:]+\s*true/gi,
        message: 'Authentication skipped with hardcoded flag',
      },
    ];

    for (const { pattern, message } of authPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        vulnerabilities.push({
          id: this.generateVulnerabilityId('auth-bypass', lineNum),
          severity: 'critical',
          category: 'auth',
          title: message,
          description: message,
          cwe: cwe?.id,
          owasp: 'A01:2021-Broken Access Control',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          remediation: 'Remove hardcoded credentials and implement proper authentication/authorization',
          references: [
            cwe?.url || 'https://owasp.org/www-project-top-ten/',
            'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
          ],
          confidence: 0.9,
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Scan dependencies for known vulnerabilities
   */
  async scanDependencies(
    packageJson: Record<string, unknown>,
    lockFile?: string
  ): Promise<DependencyVulnerability[]> {
    const vulnerabilities: DependencyVulnerability[] = [];

    const dependencies = {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      ...(packageJson.devDependencies as Record<string, string> | undefined),
    };

    for (const [name, version] of Object.entries(dependencies)) {
      const knownVulns = this.vulnerabilityDB.get(name);

      if (knownVulns) {
        for (const vuln of knownVulns) {
          if (this.isVersionAffected(version, vuln)) {
            vulnerabilities.push({
              packageName: name,
              version,
              severity: vuln.severity,
              cve: vuln.cve,
              title: vuln.title,
              description: vuln.description,
              patchedVersions: vuln.patchedVersions,
              recommendation: `Update to ${vuln.patchedVersions?.[0] || 'latest version'}`,
              references: vuln.references,
            });
          }
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Load vulnerability database
   */
  loadVulnerabilityDatabase(vulnerabilities: DependencyVulnerability[]): void {
    for (const vuln of vulnerabilities) {
      const key = vuln.packageName;
      if (!this.vulnerabilityDB.has(key)) {
        this.vulnerabilityDB.set(key, []);
      }
      this.vulnerabilityDB.get(key)!.push(vuln);
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Calculate Shannon entropy of a string
   * Higher entropy = more random = more likely to be a secret
   */
  private calculateEntropy(str: string): number {
    if (!str || str.length === 0) return 0;

    const frequency: Record<string, number> = {};
    for (const char of str) {
      frequency[char] = (frequency[char] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(frequency)) {
      const probability = count / str.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Check if detected secret is a false positive
   */
  private isSecretFalsePositive(value: string, line: string): boolean {
    // Common false positives
    const falsePositives = [
      /^(true|false|null|undefined)$/i,
      /^[a-z]{2,30}$/, // Lowercase words
      /^[A-Z][a-z]+$/, // Capitalized words
      /^\d{4}-\d{2}-\d{2}$/, // Dates
      /^https?:\/\//, // URLs
      /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/, // Local addresses
    ];

    for (const pattern of falsePositives) {
      if (pattern.test(value)) {
        return true;
      }
    }

    // Check if it's in a comment or documentation
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine.startsWith('*')) {
      return true;
    }

    // Check if it's in a string literal that looks like documentation
    if (trimmedLine.match(/['"`](?:example|test|demo|placeholder)['"`]/i)) {
      return true;
    }

    return false;
  }

  /**
   * Mask secret value for display
   */
  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    const before = content.substring(0, index);
    return before.split('\n').length;
  }

  /**
   * Generate unique vulnerability ID
   */
  private generateVulnerabilityId(type: string, line: number): string {
    return `sec-${type}-${line}`;
  }

  /**
   * Get injection remediation
   */
  private getInjectionRemediation(type: string): string {
    switch (type) {
      case 'sql-injection':
        return 'Use parameterized queries or prepared statements. Example: db.query("SELECT * FROM users WHERE id = ?", [userId])';
      case 'command-injection':
        return 'Use spawn with array arguments instead of string concatenation. Never pass user input directly to shell commands.';
      case 'path-traversal':
        return 'Validate and sanitize file paths. Use path.join() and ensure paths don\'t escape the intended directory.';
      default:
        return 'Use proper input validation and parameterized APIs';
    }
  }

  /**
   * Check if version is affected by vulnerability
   */
  private isVersionAffected(version: string, vuln: DependencyVulnerability): boolean {
    // Simplified version comparison
    // In production, use semver or similar
    return true;
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(
    vulnerabilities: SecurityVulnerability[],
    secrets: Secret[]
  ): number {
    let score = 100;

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    for (const secret of secrets) {
      switch (secret.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate summary
   */
  private generateSummary(
    vulnerabilities: SecurityVulnerability[],
    secrets: Secret[]
  ): SecurityReport['summary'] {
    return {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length +
               secrets.filter(s => s.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length +
            secrets.filter(s => s.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length +
              secrets.filter(s => s.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length +
           secrets.filter(s => s.severity === 'low').length,
      total: vulnerabilities.length + secrets.length,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a security scanner instance
 */
export function createSecurityScanner(
  config?: Partial<SecurityScannerConfig>
): SecurityScanner {
  return new SecurityScanner(config);
}
