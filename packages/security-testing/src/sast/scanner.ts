/**
 * SAST Scanner - Static Application Security Testing
 * Performs comprehensive static code analysis for security vulnerabilities
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { Severity, VulnerabilityType, Finding, ScanConfig, ScanResult, ScanStatistics, ScanStatus, OWASPTop10 } from '../types';
import { FileUtils } from '../utils/file-utils';
import { ASTUtils } from '../utils/ast-utils';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SASTRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: Severity;
  cwe?: number;
  owasp?: OWASPTop10;
  enabled: boolean;
  languages: string[];
  patterns: RulePattern[];
}

export interface RulePattern {
  type: 'ast' | 'regex' | 'semantic';
  pattern: string | RegExp;
  confidence: number;
}

export interface SASTOptions {
  maxFiles?: number;
  maxDepth?: number;
  includeDevDependencies?: boolean;
  customRules?: SASTRule[];
  excludePaths?: string[];
  severityThreshold?: Severity;
  enableTaintAnalysis?: boolean;
  enableDataFlowAnalysis?: boolean;
}

export class SASTScanner {
  private logger: Logger;
  private rules: Map<string, SASTRule>;
  private customRules: SASTRule[];

  constructor(logger: Logger) {
    this.logger = logger;
    this.rules = new Map();
    this.customRules = [];
    this.initializeDefaultRules();
  }

  /**
   * Initialize default security rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: SASTRule[] = [
      // Injection vulnerabilities
      {
        id: 'SQL_INJECTION',
        name: 'SQL Injection',
        description: 'Detects potential SQL injection vulnerabilities',
        category: 'injection',
        severity: Severity.CRITICAL,
        cwe: 89,
        owasp: OWASPTop10.A03_INJECTION,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [
          { type: 'ast', pattern: 'sql-query-concat', confidence: 75 },
          { type: 'regex', pattern: /query\s*\(\s*['"`].*?\+.*?['"`]\s*\)/gi, confidence: 60 },
        ],
      },
      {
        id: 'XSS',
        name: 'Cross-Site Scripting (XSS)',
        description: 'Detects potential XSS vulnerabilities',
        category: 'injection',
        severity: Severity.HIGH,
        cwe: 79,
        owasp: OWASPTop10.A03_INJECTION,
        enabled: true,
        languages: ['javascript', 'typescript'],
        patterns: [
          { type: 'ast', pattern: 'dangerous-html', confidence: 85 },
          { type: 'regex', pattern: /innerHTML\s*=.*?\+/gi, confidence: 70 },
        ],
      },
      {
        id: 'COMMAND_INJECTION',
        name: 'Command Injection',
        description: 'Detects command execution vulnerabilities',
        category: 'injection',
        severity: Severity.CRITICAL,
        cwe: 78,
        owasp: OWASPTop10.A03_INJECTION,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [
          { type: 'ast', pattern: 'eval-usage', confidence: 95 },
          { type: 'ast', pattern: 'function-constructor', confidence: 90 },
          { type: 'regex', pattern: /eval\s*\(/gi, confidence: 80 },
        ],
      },
      {
        id: 'PATH_TRAVERSAL',
        name: 'Path Traversal',
        description: 'Detects path traversal vulnerabilities',
        category: 'injection',
        severity: Severity.HIGH,
        cwe: 22,
        owasp: OWASPTop10.A01_BROKEN_ACCESS_CONTROL,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [
          { type: 'regex', pattern: /fs\.(readFile|writeFile)\s*\(\s*[^,]*\s*\+/gi, confidence: 65 },
        ],
      },
      // Cryptographic issues
      {
        id: 'WEAK_ENCRYPTION',
        name: 'Weak Encryption',
        description: 'Detects use of weak encryption algorithms',
        category: 'cryptography',
        severity: Severity.MEDIUM,
        cwe: 327,
        owasp: OWASPTop10.A02_CRYPTOGRAPHIC_FAILURES,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [
          { type: 'regex', pattern: /create(Cipher|Decipher|Cipheriv|Decipheriv)\s*\(\s*['"`](des|rc4|md5)['"`]/gi, confidence: 95 },
          { type: 'regex', pattern: /algorithm\s*[:=]\s*['"`](DES|RC4|MD5)['"`]/gi, confidence: 90 },
        ],
      },
      {
        id: 'HARDCODED_SECRETS',
        name: 'Hardcoded Secrets',
        description: 'Detects hardcoded secrets and credentials',
        category: 'secrets',
        severity: Severity.HIGH,
        cwe: 798,
        owasp: OWASPTop10.A02_CRYPTOGRAPHIC_FAILURES,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [
          { type: 'regex', pattern: /password\s*[:=]\s*['"`](?!.*\$\{).*['"`]/gi, confidence: 70 },
          { type: 'regex', pattern: /api[_-]?key\s*[:=]\s*['"`][^'"`]{10,}['"`]/gi, confidence: 75 },
          { type: 'regex', pattern: /secret\s*[:=]\s*['"`][^'"`]{10,}['"`]/gi, confidence: 70 },
          { type: 'ast', pattern: 'hardcoded-secrets', confidence: 70 },
        ],
      },
      // Authentication & Authorization
      {
        id: 'WEAK_PASSWORD_HASH',
        name: 'Weak Password Hashing',
        description: 'Detects weak password hashing algorithms',
        category: 'authentication',
        severity: Severity.HIGH,
        cwe: 261,
        owasp: OWASPTop10.A02_CRYPTOGRAPHIC_FAILURES,
        enabled: true,
        languages: ['javascript', 'typescript', 'python'],
        patterns: [
          { type: 'regex', pattern: /createHash\s*\(\s*['"`](md5|sha1)['"`]/gi, confidence: 90 },
        ],
      },
      {
        id: 'HARDcoded_CREDENTIALS',
        name: 'Hardcoded Credentials',
        description: 'Detects hardcoded authentication credentials',
        category: 'authentication',
        severity: Severity.CRITICAL,
        cwe: 798,
        owasp: OWASPTop10.A07_AUTHENTICATION_FAILURES,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [
          { type: 'regex', pattern: /basic\s+auth\s*[:=]\s*['"`][^'"`]+:[^'"`]+['"`]/gi, confidence: 85 },
        ],
      },
      // Configuration
      {
        id: 'CORS_MISCONFIGURATION',
        name: 'CORS Misconfiguration',
        description: 'Detects overly permissive CORS configurations',
        category: 'configuration',
        severity: Severity.MEDIUM,
        cwe: 942,
        owasp: OWASPTop10.A05_SECURITY_MISCONFIGURATION,
        enabled: true,
        languages: ['javascript', 'typescript'],
        patterns: [
          { type: 'regex', pattern: /origin\s*[:=]\s*['"`]\*['"`]/gi, confidence: 85 },
          { type: 'regex', pattern: /Access-Control-Allow-Origin\s*:\s*\*/gi, confidence: 90 },
        ],
      },
      {
        id: 'DEBUG_MODE',
        name: 'Debug Mode Enabled',
        description: 'Detects debug mode enabled in production',
        category: 'configuration',
        severity: Severity.LOW,
        cwe: 489,
        owasp: OWASPTop10.A05_SECURITY_MISCONFIGURATION,
        enabled: true,
        languages: ['javascript', 'typescript', 'python'],
        patterns: [
          { type: 'regex', pattern: /debug\s*[:=]\s*true/gi, confidence: 60 },
        ],
      },
      // Data protection
      {
        id: 'SENSITIVE_DATA_LOGS',
        name: 'Sensitive Data in Logs',
        description: 'Detects logging of sensitive data',
        category: 'data-protection',
        severity: Severity.MEDIUM,
        cwe: 532,
        owasp: OWASPTop10.A09_LOGGING_MONITORING_FAILURES,
        enabled: true,
        languages: ['javascript', 'typescript', 'python'],
        patterns: [
          { type: 'regex', pattern: /console\.(log|debug|info)\s*\(\s*.*?(password|token|secret|credit|ssn)/gi, confidence: 75 },
        ],
      },
      // Code quality
      {
        id: 'UNUSED_IMPORTS',
        name: 'Unused Imports',
        description: 'Detects unused import statements',
        category: 'code-quality',
        severity: Severity.INFO,
        cwe: 1058,
        enabled: true,
        languages: ['javascript', 'typescript', 'python'],
        patterns: [],
      },
      {
        id: 'COMPLEX_FUNCTION',
        name: 'Complex Function',
        description: 'Detects overly complex functions',
        category: 'code-quality',
        severity: Severity.MEDIUM,
        cwe: 1058,
        enabled: true,
        languages: ['javascript', 'typescript', 'python', 'go'],
        patterns: [],
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Add custom rule
   */
  public addCustomRule(rule: SASTRule): void {
    this.customRules.push(rule);
    this.rules.set(rule.id, rule);
  }

  /**
   * Scan a project directory
   */
  public async scanDirectory(
    targetPath: string,
    options: SASTOptions = {}
  ): Promise<ScanResult> {
    const scanId = uuidv4();
    const startTime = new Date();
    this.logger = this.logger.withScanId(scanId);

    this.logger.info(`Starting SAST scan of ${targetPath}`);

    const findings: Finding[] = [];
    let filesScanned = 0;
    let linesScanned = 0;

    try {
      // Find all files to scan
      const fileFilter = {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go'],
        excludePaths: options.excludePaths,
      };

      const files = await FileUtils.findFiles(targetPath, fileFilter);

      this.logger.info(`Found ${files.length} files to scan`);

      // Limit files if specified
      const filesToScan = options.maxFiles ? files.slice(0, options.maxFiles) : files;

      // Scan each file
      for (const filePath of filesToScan) {
        try {
          const fileFindings = await this.scanFile(filePath, targetPath, options);
          findings.push(...fileFindings);
          filesScanned++;

          // Count lines
          const content = await FileUtils.readFile(filePath);
          linesScanned += content.split('\n').length;

          if (filesScanned % 100 === 0) {
            this.logger.debug(`Scanned ${filesScanned} files, found ${findings.length} findings`);
          }
        } catch (error) {
          this.logger.warn(`Failed to scan file ${filePath}: ${error}`);
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Group findings by severity
      const stats = this.calculateStatistics(findings, filesScanned, linesScanned);

      this.logger.info(`SAST scan completed in ${duration}ms`);
      this.logger.info(`Found ${findings.length} vulnerabilities: ${stats.critical} critical, ${stats.high} high, ${stats.medium} medium`);

      return {
        id: scanId,
        scanType: 'sast',
        status: ScanStatus.COMPLETED,
        config: {
          target: targetPath,
          targetType: 'code',
          enableSAST: true,
          enableDAST: false,
          enableSCA: false,
          enableCompliance: false,
          outputFormat: 'json',
        } as ScanConfig,
        findings,
        groupedFindings: this.groupFindings(findings),
        stats,
        startTime,
        endTime,
        duration,
        scannerVersion: '1.0.0',
      };
    } catch (error) {
      this.logger.error(`SAST scan failed: ${error}`);
      throw error;
    }
  }

  /**
   * Scan a single file
   */
  public async scanFile(
    filePath: string,
    rootPath: string,
    options: SASTOptions = {}
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const content = await FileUtils.readFile(filePath);
      const fileInfo = await FileUtils.getFileInfo(filePath, rootPath);

      // Skip binary files
      if (await FileUtils.isBinary(filePath)) {
        return findings;
      }

      // Get enabled rules for this language
      const enabledRules = Array.from(this.rules.values()).filter(
        (rule) => rule.enabled && rule.languages.includes(fileInfo.language)
      );

      // Parse AST if JavaScript/TypeScript
      if (fileInfo.language === 'javascript' || fileInfo.language === 'typescript') {
        try {
          const ast = ASTUtils.parse(content, filePath);

          // Run AST-based rules
          for (const rule of enabledRules) {
            for (const pattern of rule.patterns) {
              if (pattern.type === 'ast') {
                const ruleFindings = this.runASTRule(
                  ast,
                  content,
                  filePath,
                  fileInfo,
                  rule,
                  pattern
                );
                findings.push(...ruleFindings);
              }
            }
          }
        } catch (error) {
          this.logger.debug(`Failed to parse AST for ${filePath}: ${error}`);
        }
      }

      // Run regex-based rules
      for (const rule of enabledRules) {
        for (const pattern of rule.patterns) {
          if (pattern.type === 'regex') {
            const regexFindings = this.runRegexRule(
              content,
              filePath,
              fileInfo,
              rule,
              pattern
            );
            findings.push(...regexFindings);
          }
        }
      }

      // Run complexity analysis
      if (fileInfo.language === 'javascript' || fileInfo.language === 'typescript') {
        try {
          const ast = ASTUtils.parse(content, filePath);
          const complexityFinding = this.analyzeComplexity(ast, content, filePath, fileInfo);
          if (complexityFinding) {
            findings.push(complexityFinding);
          }
        } catch (error) {
          // Ignore AST parsing errors for complexity analysis
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to scan ${filePath}: ${error}`);
    }

    return findings;
  }

  /**
   * Run AST-based rule
   */
  private runASTRule(
    ast: any,
    content: string,
    filePath: string,
    fileInfo: any,
    rule: SASTRule,
    pattern: RulePattern
  ): Finding[] {
    const findings: Finding[] = [];

    try {
      let matches: any[] = [];

      switch (pattern.pattern) {
        case 'eval-usage':
          matches = ASTUtils.findEvalUsage(ast);
          break;
        case 'dangerous-html':
          matches = ASTUtils.findDangerousHTML(ast);
          break;
        case 'sql-query-concat':
          matches = ASTUtils.findSQLInjection(ast);
          break;
        case 'hardcoded-secrets':
          matches = ASTUtils.findHardcodedSecrets(ast);
          break;
        case 'function-constructor':
          matches = ASTUtils.findByPattern(ast, (node: any) => {
            return (
              node.type === 'NewExpression' &&
              node.callee.type === 'Identifier' &&
              node.callee.name === 'Function'
            );
          });
          if (matches.length > 0) {
            matches = matches.map((node) => ({
              node,
              type: VulnerabilityType.COMMAND_INJECTION,
              severity: Severity.HIGH,
              confidence: 90,
              message: 'Function constructor can lead to code injection',
              remediation: 'Avoid using Function constructor. Use safer alternatives.',
              cwe: 95,
              owasp: 'A03:2021-Injection',
            }));
          }
          break;
        default:
          break;
      }

      for (const match of matches) {
        const location = ASTUtils.getLocation(match.node);
        const snippet = ASTUtils.extractCode(content, match.node);

        findings.push({
          id: `${rule.id}-${filePath}-${location.line}`,
          title: rule.name,
          description: match.message || rule.description,
          severity: {
            level: rule.severity,
            score: this.getSeverityScore(rule.severity),
          },
          type: match.type || this.mapCategoryToType(rule.category),
          cwe: rule.cwe ? [{ id: rule.cwe, name: '', description: '', url: '' }] : undefined,
          owasp: rule.owasp ? [rule.owasp] : undefined,
          confidence: match.confidence || pattern.confidence,
          file: filePath,
          line: location.line,
          column: location.column,
          codeSnippet: snippet,
          context: this.extractContext(content, location.line),
          remediation: match.remediation || this.getDefaultRemediation(rule.id),
          references: this.getReferences(rule),
          scanner: 'sast',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.debug(`Failed to run AST rule ${rule.id}: ${error}`);
    }

    return findings;
  }

  /**
   * Run regex-based rule
   */
  private runRegexRule(
    content: string,
    filePath: string,
    fileInfo: any,
    rule: SASTRule,
    pattern: RulePattern
  ): Finding[] {
    const findings: Finding[] = [];
    const regex = pattern.pattern as RegExp;
    let match;

    // Reset regex state
    regex.lastIndex = 0;

    const lines = content.split('\n');
    while ((match = regex.exec(content)) !== null) {
      const lineIndex = content.substring(0, match.index).split('\n').length - 1;
      const line = lines[lineIndex];
      const column = match.index - content.lastIndexOf('\n', match.index) - 1;

      findings.push({
        id: `${rule.id}-${filePath}-${lineIndex}`,
        title: rule.name,
        description: rule.description,
        severity: {
          level: rule.severity,
          score: this.getSeverityScore(rule.severity),
        },
        type: this.mapCategoryToType(rule.category),
        cwe: rule.cwe ? [{ id: rule.cwe, name: '', description: '', url: '' }] : undefined,
        owasp: rule.owasp ? [rule.owasp] : undefined,
        confidence: pattern.confidence,
        file: filePath,
        line: lineIndex + 1,
        column,
        codeSnippet: line.trim(),
        context: this.extractContext(content, lineIndex + 1),
        remediation: this.getDefaultRemediation(rule.id),
        references: this.getReferences(rule),
        scanner: 'sast',
        timestamp: new Date(),
      });
    }

    return findings;
  }

  /**
   * Analyze function complexity
   */
  private analyzeComplexity(ast: any, content: string, filePath: string, fileInfo: any): Finding | null {
    const functions = ASTUtils.getFunctionDeclarations(ast);

    for (const [funcName, funcNode] of functions) {
      const complexity = ASTUtils.analyzeComplexity(funcNode);

      if (complexity.cyclomaticComplexity > 15) {
        const location = ASTUtils.getLocation(funcNode);

        return {
          id: `complexity-${filePath}-${location.line}`,
          title: 'Complex Function',
          description: `Function '${funcName}' has high cyclomatic complexity (${complexity.cyclomaticComplexity})`,
          severity: {
            level: complexity.cyclomaticComplexity > 25 ? Severity.HIGH : Severity.MEDIUM,
            score: complexity.cyclomaticComplexity > 25 ? 7 : 5,
          },
          type: VulnerabilityType.BUSINESS_LOGIC_flaw,
          confidence: 100,
          file: filePath,
          line: location.line,
          column: location.column,
          codeSnippet: ASTUtils.extractCode(content, funcNode),
          context: this.extractContext(content, location.line),
          remediation:
            'Refactor this function into smaller, more focused functions. Consider breaking down complex logic into helper functions.',
          references: [
            'https://en.wikipedia.org/wiki/Cyclomatic_complexity',
            'https://www.sonarsource.com/resources/clean-code/high-cyclomatic-complexity/',
          ],
          scanner: 'sast',
          timestamp: new Date(),
          metadata: {
            functionName: funcName,
            cyclomaticComplexity: complexity.cyclomaticComplexity,
            linesOfCode: complexity.linesOfCode,
            parameters: complexity.parameters,
            nestingDepth: complexity.nestingDepth,
          },
        };
      }
    }

    return null;
  }

  /**
   * Extract context around a line
   */
  private extractContext(content: string, lineNumber: number, contextLines: number = 2): string {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Calculate scan statistics
   */
  private calculateStatistics(
    findings: Finding[],
    filesScanned: number,
    linesScanned: number
  ): ScanStatistics {
    const stats: ScanStatistics = {
      total: findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      filesScanned,
      linesScanned,
      vulnerabilitiesFound: findings.length,
      falsePositiveRate: 0,
    };

    for (const finding of findings) {
      switch (finding.severity.level) {
        case Severity.CRITICAL:
          stats.critical++;
          break;
        case Severity.HIGH:
          stats.high++;
          break;
        case Severity.MEDIUM:
          stats.medium++;
          break;
        case Severity.LOW:
          stats.low++;
          break;
        case Severity.INFO:
          stats.info++;
          break;
      }
    }

    return stats;
  }

  /**
   * Group findings by type and severity
   */
  private groupFindings(findings: Finding[]): any[] {
    const groups = new Map<string, any>();

    for (const finding of findings) {
      const key = `${finding.type}-${finding.severity.level}`;
      if (!groups.has(key)) {
        groups.set(key, {
          type: finding.type,
          severity: finding.severity.level,
          findings: [],
          count: 0,
          files: new Set<string>(),
        });
      }
      const group = groups.get(key);
      group.findings.push(finding);
      group.count++;
      group.files.add(finding.file);
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      files: Array.from(group.files),
    }));
  }

  /**
   * Get severity score (0-10)
   */
  private getSeverityScore(severity: Severity): number {
    switch (severity) {
      case Severity.CRITICAL:
        return 10;
      case Severity.HIGH:
        return 8;
      case Severity.MEDIUM:
        return 5;
      case Severity.LOW:
        return 3;
      case Severity.INFO:
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Map category to vulnerability type
   */
  private mapCategoryToType(category: string): VulnerabilityType {
    const mapping: Record<string, VulnerabilityType> = {
      injection: VulnerabilityType.SQL_INJECTION,
      cryptography: VulnerabilityType.ENCRYPTION_FAILURE,
      secrets: VulnerabilityType.SENSITIVE_DATA_EXPOSURE,
      authentication: VulnerabilityType.AUTHENTICATION_BYPASS,
      configuration: VulnerabilityType.SECURITY_MISCONFIGURATION,
      'data-protection': VulnerabilityType.INSECURE_DESENSITIZATION,
      'code-quality': VulnerabilityType.BUSINESS_LOGIC_flaw,
    };

    return mapping[category] || VulnerabilityType.SECURITY_MISCONFIGURATION;
  }

  /**
   * Get default remediation for a rule
   */
  private getDefaultRemediation(ruleId: string): string {
    const remediations: Record<string, string> = {
      SQL_INJECTION:
        'Use parameterized queries or prepared statements. Never concatenate user input directly into SQL queries.',
      XSS:
        'Use textContent instead of innerHTML, or sanitize user input with DOMPurify before inserting into DOM.',
      COMMAND_INJECTION:
        'Avoid using eval(), Function constructor, or executing commands with user input. Use safe alternatives.',
      PATH_TRAVERSAL:
        'Validate and sanitize file paths. Use a whitelist of allowed files/directories. Never use user input directly in file paths.',
      WEAK_ENCRYPTION:
        'Use strong encryption algorithms like AES-256-GCM. Avoid DES, RC4, MD5, and other weak algorithms.',
      HARDCODED_SECRETS:
        'Store secrets in environment variables or a secure secret management system. Never commit secrets to code.',
      WEAK_PASSWORD_HASH:
        'Use strong password hashing algorithms like bcrypt, Argon2, or scrypt with appropriate work factors.',
      CORS_MISCONFIGURATION:
        'Configure CORS to only allow specific, trusted origins. Avoid using wildcard (*) in production.',
      DEBUG_MODE:
        'Ensure debug mode is disabled in production environments.',
      SENSITIVE_DATA_LOGS:
        'Avoid logging sensitive data like passwords, tokens, or PII. Sanitize log messages before output.',
    };

    return remediations[ruleId] || 'Review and fix the identified security issue.';
  }

  /**
   * Get reference links for a rule
   */
  private getReferences(rule: SASTRule): string[] {
    const refs: string[] = [];

    if (rule.cwe) {
      refs.push(`https://cwe.mitre.org/data/definitions/${rule.cwe}.html`);
    }

    const ruleRefs: Record<string, string[]> = {
      SQL_INJECTION: [
        'https://owasp.org/www-community/attacks/SQL_Injection',
        'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      ],
      XSS: [
        'https://owasp.org/www-community/attacks/xss/',
        'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
      ],
      COMMAND_INJECTION: [
        'https://owasp.org/www-community/attacks/Command_Injection',
      ],
    };

    if (ruleRefs[rule.id]) {
      refs.push(...ruleRefs[rule.id]);
    }

    return refs;
  }
}
