/**
 * Secret Scanner
 * Detects secrets, API keys, and sensitive information in code
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import type { SecretPattern, SecretMatch, SecretScanResult, SeverityLevel } from '../types';
import { securityLogger } from '../utils/logger';

// ============================================================================
// Secret Patterns
// ============================================================================

export const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'AWS Access Key ID',
    pattern: /(?:A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{16}/g,
    description: 'AWS Access Key ID',
    severity: 'critical',
    examples: ['AKIAIOSFODNN7EXAMPLE', 'ASIAQTESTDEST123456']
  },
  {
    name: 'AWS Secret Access Key',
    pattern: /(?<![A-Z0-9])[A-Z0-9]{40}(?![A-Z0-9])/g,
    description: 'AWS Secret Access Key (40 character alphanumeric)',
    severity: 'critical',
    examples: ['wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY']
  },
  {
    name: 'AWS Session Token',
    pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{16,}(?![A-Za-z0-9/+=])/g,
    description: 'AWS Session Token (temporary credentials)',
    severity: 'critical'
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    description: 'GitHub Personal Access Token',
    severity: 'critical',
    examples: ['ghp_1234567890abcdefghijklmnopqrstuv']
  },
  {
    name: 'GitHub OAuth Access Token',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    description: 'GitHub OAuth Access Token',
    severity: 'critical'
  },
  {
    name: 'GitHub App Token',
    pattern: /(ghu|ghs)_[a-zA-Z0-9]{36}/g,
    description: 'GitHub App/User/Server Token',
    severity: 'critical'
  },
  {
    name: 'GitHub Refresh Token',
    pattern: /ghr_[a-zA-Z0-9]{36}/g,
    description: 'GitHub Refresh Token',
    severity: 'critical'
  },
  {
    name: 'GitLab Personal Access Token',
    pattern: /glpat-[a-zA-Z0-9_-]{20}/g,
    description: 'GitLab Personal Access Token',
    severity: 'critical',
    examples: ['glpat-1234567890abcdefghij']
  },
  {
    name: 'Slack Token',
    pattern: /xox[pbar]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32}/g,
    description: 'Slack API Token',
    severity: 'critical',
    examples: ['xoxb-EXAMPLE-ONLY-XXXXXXXXXXXXX-XXXXXXXXXXXXX']
  },
  {
    name: 'Slack Webhook',
    pattern: /hooks\.slack\.com\/services\/[A-Z0-9]{9}\/[A-Z0-9]{9}\/[a-zA-Z0-9]{24}/g,
    description: 'Slack Webhook URL',
    severity: 'high'
  },
  {
    name: 'Stripe API Key',
    pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
    description: 'Stripe Live API Key',
    severity: 'critical',
    examples: ['sk_live_EXAMPLE_KEY_ONLY_DO_NOT_USE']
  },
  {
    name: 'Stripe Publishable Key',
    pattern: /pk_live_[0-9a-zA-Z]{24,}/g,
    description: 'Stripe Publishable Key',
    severity: 'high'
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\\-_]{35}/g,
    description: 'Google API Key',
    severity: 'high',
    examples: ['AIza1234567890abcdefghijklmnopqrstuvwx']
  },
  {
    name: 'Google Cloud OAuth',
    pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g,
    description: 'Google Cloud OAuth Client ID',
    severity: 'medium'
  },
  {
    name: 'Google Cloud Service Account',
    pattern: /"type":\s*"service_account"/g,
    description: 'Google Cloud Service Account credentials',
    severity: 'critical'
  },
  {
    name: 'Firebase Database Secret',
    pattern: /"[a-zA-Z0-9_]{40}"/g,
    description: 'Firebase Database Secret',
    severity: 'critical'
  },
  {
    name: 'Heroku API Key',
    pattern: /heroku_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    description: 'Heroku API Key',
    severity: 'critical'
  },
  {
    name: 'Twitter API Key',
    pattern: /twitter_api_[a-zA-Z0-9_-]{25,}/g,
    description: 'Twitter API Key',
    severity: 'high'
  },
  {
    name: 'Twitter Bearer Token',
    pattern: /AAAAAAAA[a-zA-Z0-9%]{35,}/g,
    description: 'Twitter Bearer Token',
    severity: 'critical'
  },
  {
    name: 'Facebook Access Token',
    pattern: /EAACwE[0-9A-Za-z]+/g,
    description: 'Facebook Access Token',
    severity: 'high'
  },
  {
    name: 'Auth0 Client Secret',
    pattern: /[a-zA-Z0-9_-]{43}/g,
    description: 'Auth0 Client Secret',
    severity: 'critical'
  },
  {
    name: 'PayPal Braintree Token',
    pattern: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/g,
    description: 'PayPal Braintree Access Token',
    severity: 'critical'
  },
  {
    name: 'Twilio API Key',
    pattern: /SK[0-9a-f]{32}/g,
    description: 'Twilio API Key',
    severity: 'high',
    examples: ['SK_EXAMPLE_TWILIO_KEY_FAKE']
  },
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    description: 'SendGrid API Key',
    severity: 'critical',
    examples: ['SG.1234567890abcdefghijklmnopqrstuvwxyz.1234567890abcdefghijklmnopqrstuv']
  },
  {
    name: 'Datadog API Key',
    pattern: /dd_[a-zA-Z0-9]{32}/g,
    description: 'Datadog API Key',
    severity: 'high'
  },
  {
    name: 'New Relic License Key',
    pattern: /[a-z0-9]{40}/g,
    description: 'New Relic License Key',
    severity: 'medium'
  },
  {
    name: 'Mailgun API Key',
    pattern: /key-[0-9a-zA-Z]{32}/g,
    description: 'Mailgun API Key',
    severity: 'high',
    examples: ['key-1234567890abcdefghijklmnopqrstuvwxyz']
  },
  {
    name: 'Nexmo API Key',
    pattern: /[a-z0-9]{16}/g,
    description: 'Nexmo/Vonage API Key',
    severity: 'medium'
  },
  {
    name: 'Docker Registry Auth',
    pattern: /"auths":\s*\{[^}]*"auth":\s*"[a-zA-Z0-9_]+=+"/g,
    description: 'Docker Registry Authentication',
    severity: 'critical'
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN[^\n]+PRIVATE KEY-----/g,
    description: 'Private Key (RSA, DSA, EC, etc.)',
    severity: 'critical'
  },
  {
    name: 'SSH Private Key',
    pattern: /-----BEGIN\s+RSA\s+PRIVATE\s+KEY-----/g,
    description: 'SSH Private Key',
    severity: 'critical'
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/g,
    description: 'PGP Private Key Block',
    severity: 'critical'
  },
  {
    name: 'JWT',
    pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    description: 'JSON Web Token',
    severity: 'medium'
  },
  {
    name: 'Database Connection String',
    pattern: /(mongodb|mysql|postgresql|redis):\/\/[^:]+:[^@]+@/g,
    description: 'Database Connection String with Credentials',
    severity: 'critical'
  },
  {
    name: 'Connection String Generic',
    pattern: /:\/\/[^:]+:[^@]+@/g,
    description: 'Generic Connection String with Password',
    severity: 'high'
  },
  {
    name: 'API Key Generic',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?/gi,
    description: 'Generic API Key',
    severity: 'medium'
  },
  {
    name: 'Secret Token Generic',
    pattern: /(?:secret[_-]?token|secrettoken|secret)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?/gi,
    description: 'Generic Secret Token',
    severity: 'high'
  },
  {
    name: 'Password in Config',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"]{4,}['"]?/gi,
    description: 'Password in Configuration File',
    severity: 'medium'
  },
  {
    name: 'Bearer Token',
    pattern: /Bearer\s+[a-zA-Z0-9_\-\.=]+/gi,
    description: 'Bearer Token',
    severity: 'high'
  },
  {
    name: 'Basic Auth',
    pattern: /Basic\s+[a-zA-Z0-9_\-=]+/gi,
    description: 'Basic Authentication Header',
    severity: 'medium'
  },
  {
    name: 'Email Address',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: 'Email Address (potential PII)',
    severity: 'low'
  },
  {
    name: 'IP Address',
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    description: 'IP Address (potential internal infrastructure)',
    severity: 'low'
  },
  {
    name: 'UUID',
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    description: 'UUID (may identify resources)',
    severity: 'info'
  }
];

// ============================================================================
// File Extensions to Scan
// ============================================================================

const CODE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.cs', '.scala', '.ex', '.exs',
  '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.yml', '.yaml', '.json', '.toml', '.ini', '.cfg', '.conf',
  '.env', '.env.example', '.env.local', '.env.development',
  '.md', '.txt', '.log'
];

const DIRECTORIES_TO_SKIP = [
  'node_modules', '.git', 'dist', 'build', 'out',
  '.next', '.nuxt', '.cache', 'coverage',
  'vendor', 'tmp', 'temp', '.vscode', '.idea'
];

const FILES_TO_SKIP = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'min.js', 'bundle.js', 'chunk.js',
  '.min.js', '.bundle.js'
];

// ============================================================================
// Secret Scanner
// ============================================================================

export class SecretScanner {
  private patterns: SecretPattern[];
  private maxFileSize: number;
  private excludePatterns: RegExp[];

  constructor(
    patterns: SecretPattern[] = DEFAULT_SECRET_PATTERNS,
    options?: {
      maxFileSize?: number;
      excludePatterns?: RegExp[];
    }
  ) {
    this.patterns = patterns;
    this.maxFileSize = options?.maxFileSize || 1024 * 1024; // 1MB
    this.excludePatterns = options?.excludePatterns || [];
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: SecretPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by name
   */
  removePattern(name: string): void {
    this.patterns = this.patterns.filter(p => p.name !== name);
  }

  /**
   * Set patterns
   */
  setPatterns(patterns: SecretPattern[]): void {
    this.patterns = patterns;
  }

  /**
   * Scan file for secrets
   */
  scanFile(filePath: string): SecretMatch[] {
    const matches: SecretMatch[] = [];

    try {
      if (!existsSync(filePath)) {
        return matches;
      }

      const stats = statSync(filePath);

      // Skip if too large
      if (stats.size > this.maxFileSize) {
        securityLogger.debug(`Skipping large file: ${filePath}`);
        return matches;
      }

      // Skip if file should be excluded
      if (this.shouldSkipFile(filePath)) {
        return matches;
      }

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const pattern of this.patterns) {
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match: RegExpExecArray | null;

          // Reset regex for new line
          regex.lastIndex = 0;

          while ((match = regex.exec(line)) !== null) {
            // Check if match should be excluded
            if (this.shouldExcludeMatch(line, match[0])) {
              continue;
            }

            matches.push({
              patternName: pattern.name,
              match: match[0],
              line: i + 1,
              column: match.index + 1,
              file: filePath,
              severity: pattern.severity,
              context: line.trim()
            });
          }
        }
      }
    } catch (error) {
      securityLogger.debug(`Error scanning file ${filePath}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return matches;
  }

  /**
   * Scan directory recursively
   */
  scanDirectory(dirPath: string, maxDepth: number = 10): SecretScanResult[] {
    const results: SecretScanResult[] = [];

    try {
      this.scanDirectoryRecursive(dirPath, dirPath, 0, maxDepth, results);
    } catch (error) {
      securityLogger.error(`Error scanning directory ${dirPath}:`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  /**
   * Recursively scan directory
   */
  private scanDirectoryRecursive(
    rootPath: string,
    currentPath: string,
    currentDepth: number,
    maxDepth: number,
    results: SecretScanResult[]
  ): void {
    if (currentDepth > maxDepth) {
      return;
    }

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = relative(rootPath, fullPath);

        // Skip certain directories
        if (entry.isDirectory()) {
          if (DIRECTORIES_TO_SKIP.includes(entry.name)) {
            continue;
          }

          this.scanDirectoryRecursive(rootPath, fullPath, currentDepth + 1, maxDepth, results);
        } else if (entry.isFile()) {
          // Skip certain files
          if (FILES_TO_SKIP.some(f => entry.name.endsWith(f))) {
            continue;
          }

          // Only scan files with known extensions
          const ext = extname(entry.name);
          if (!CODE_EXTENSIONS.includes(ext)) {
            continue;
          }

          const matches = this.scanFile(fullPath);

          if (matches.length > 0) {
            results.push({
              file: relativePath,
              matches,
              scannedAt: Date.now()
            });

            securityLogger.warn(`Secrets found in ${relativePath}`, {
              count: matches.length
            });
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Check if file should be skipped
   */
  private shouldSkipFile(filePath: string): boolean {
    const basename = filePath.split('/').pop() || '';

    for (const pattern of this.excludePatterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if match should be excluded
   */
  private shouldExcludeMatch(line: string, match: string): string | false {
    // Exclude common false positives
    const falsePositives = [
      /https?:\/\/.*/, // URLs
      /\/\/.*/, // Comments
      /# .*/, // Comments
      /\[.*\]/.source, // Array notation
      /`[^`]*`/.source, // Template literals
      /"[^"]*\{[^}]*\}[^"]*"/.source, // Template strings
      /example/i.test(match), // Examples
      /test/i.test(match), // Tests
      /sample/i.test(match), // Samples
      /xxx+/i.test(match) // Placeholders
    ];

    for (const pattern of falsePositives) {
      if (pattern.test(match)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate scan report
   */
  generateReport(results: SecretScanResult[]): string {
    const lines: string[] = [];

    lines.push('# Secret Scan Report');
    lines.push('');
    lines.push(`Scanned files: ${results.length}`);
    lines.push(`Total secrets found: ${results.reduce((sum, r) => sum + r.matches.length, 0)}`);
    lines.push('');

    if (results.length === 0) {
      lines.push('No secrets found! ✅');
      return lines.join('\n');
    }

    // Group by severity
    const bySeverity: Record<SeverityLevel, SecretMatch[]> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    for (const result of results) {
      for (const match of result.matches) {
        bySeverity[match.severity].push(match);
      }
    }

    // Print critical findings
    if (bySeverity.critical.length > 0) {
      lines.push('## 🔴 CRITICAL');
      lines.push('');
      for (const match of bySeverity.critical) {
        lines.push(`### ${match.patternName}`);
        lines.push(`- **File:** ${match.file}`);
        lines.push(`- **Line:** ${match.line}`);
        lines.push(`- **Secret:** ${this.maskSecret(match.match)}`);
        lines.push(`- **Context:** \`${match.context}\``);
        lines.push('');
      }
    }

    // Print high findings
    if (bySeverity.high.length > 0) {
      lines.push('## 🟠 HIGH');
      lines.push('');
      for (const match of bySeverity.high) {
        lines.push(`### ${match.patternName}`);
        lines.push(`- **File:** ${match.file}`);
        lines.push(`- **Line:** ${match.line}`);
        lines.push(`- **Secret:** ${this.maskSecret(match.match)}`);
        lines.push('');
      }
    }

    // Print medium findings
    if (bySeverity.medium.length > 0) {
      lines.push('## 🟡 MEDIUM');
      lines.push('');
      for (const match of bySeverity.medium) {
        lines.push(`### ${match.patternName}`);
        lines.push(`- **File:** ${match.file}`);
        lines.push(`- **Line:** ${match.line}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Mask secret for display
   */
  private maskSecret(secret: string, showChars: number = 4): string {
    if (secret.length <= showChars * 2) {
      return '*'.repeat(secret.length);
    }
    return secret.substring(0, showChars) +
           '*'.repeat(secret.length - showChars * 2) +
           secret.substring(secret.length - showChars);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create secret scanner
 */
export function createSecretScanner(
  patterns?: SecretPattern[],
  options?: {
    maxFileSize?: number;
    excludePatterns?: RegExp[];
  }
) {
  return new SecretScanner(patterns, options);
}

/**
 * Run secret scan
 */
export async function runSecretScan(
  path: string,
  patterns?: SecretPattern[]
): Promise<void> {
  const scanner = new SecretScanner(patterns);

  securityLogger.info(`Scanning ${path} for secrets...`);

  const stats = statSync(path);
  let results: SecretScanResult[] = [];

  if (stats.isDirectory()) {
    results = scanner.scanDirectory(path);
  } else {
    const matches = scanner.scanFile(path);
    if (matches.length > 0) {
      results.push({
        file: path,
        matches,
        scannedAt: Date.now()
      });
    }
  }

  const report = scanner.generateReport(results);
  console.log(report);

  const hasCriticalOrHigh = results.some(r =>
    r.matches.some(m => m.severity === 'critical' || m.severity === 'high')
  );

  if (hasCriticalOrHigh) {
    process.exit(1);
  }
}

/**
 * Get default patterns
 */
export function getDefaultSecretPatterns(): SecretPattern[] {
  return [...DEFAULT_SECRET_PATTERNS];
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: SeverityLevel): SecretPattern[] {
  return DEFAULT_SECRET_PATTERNS.filter(p => p.severity === severity);
}
