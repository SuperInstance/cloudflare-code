/**
 * Dependency Vulnerability Scanner
 * Scans npm dependencies for known security vulnerabilities
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DependencyVulnerability, DependencyScanResult, AuditReport, SeverityLevel } from '../types';
import { securityLogger } from '../utils/logger';

// ============================================================================
// Dependency Scanner
// ============================================================================

export class DependencyScanner {
  private projectRoot: string;
  private cacheEnabled: boolean;

  constructor(projectRoot: string = process.cwd(), cacheEnabled: boolean = true) {
    this.projectRoot = projectRoot;
    this.cacheEnabled = cacheEnabled;
  }

  /**
   * Run npm audit
   */
  async runNpmAudit(): Promise<any> {
    try {
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      });

      return JSON.parse(auditOutput);
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      const output = (error as any).stdout;
      if (output) {
        try {
          return JSON.parse(output);
        } catch {
          return { error: 'Failed to parse npm audit output' };
        }
      }
      return { error: 'Failed to run npm audit' };
    }
  }

  /**
   * Run yarn audit
   */
  async runYarnAudit(): Promise<any> {
    try {
      const auditOutput = execSync('yarn audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      });

      const lines = auditOutput.split('\n').filter(line => line.trim());
      const results = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      return results;
    } catch (error) {
      return { error: 'Failed to run yarn audit' };
    }
  }

  /**
   * Run pnpm audit
   */
  async runPnpmAudit(): Promise<any> {
    try {
      const auditOutput = execSync('pnpm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      });

      return JSON.parse(auditOutput);
    } catch (error) {
      const output = (error as any).stdout;
      if (output) {
        try {
          return JSON.parse(output);
        } catch {
          return { error: 'Failed to parse pnpm audit output' };
        }
      }
      return { error: 'Failed to run pnpm audit' };
    }
  }

  /**
   * Parse npm audit results
   */
  parseNpmAuditResults(auditData: any): DependencyScanResult[] {
    const results: DependencyScanResult[] = [];

    if (!auditData.vulnerabilities) {
      return results;
    }

    for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
      const data = vulnData as any;
      const vulnerabilities: DependencyVulnerability[] = [];

      for (const via of data.via || []) {
        if (typeof via === 'object' && via.url) {
          vulnerabilities.push({
            packageName,
            version: data.range,
            severity: this.parseSeverity(data.severity),
            title: via.title || data.title || 'Unknown vulnerability',
            description: via.url || data.url || '',
            cve: this.extractCVE(via.url || data.url || ''),
            cvss: data.cvss?.score,
            patchedIn: data.fixAvailable?.versions || [],
            recommendation: data.fixAvailable
              ? `Update to version ${data.fixAvailable.versions[0]} or later`
              : 'No fix available. Consider replacing this package.',
            references: [via.url, data.url].filter(Boolean) as string[]
          });
        }
      }

      results.push({
        packageName,
        version: data.range || 'unknown',
        vulnerabilities,
        scanTime: Date.now()
      });
    }

    return results;
  }

  /**
   * Parse severity level
   */
  private parseSeverity(severity: string): SeverityLevel {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'low';
    }
  }

  /**
   * Extract CVE ID from URL
   */
  private extractCVE(url: string): string | undefined {
    const cveMatch = url.match(/CVE-\d{4}-\d{4,7}/i);
    return cveMatch ? cveMatch[0].toUpperCase() : undefined;
  }

  /**
   * Scan package.json dependencies
   */
  async scanPackageJson(): Promise<Map<string, string>> {
    const packageJsonPath = join(this.projectRoot, 'package.json');

    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = new Map<string, string>();

    // Add production dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.set(name, version as string);
      }
    }

    // Add development dependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.set(name, version as string);
      }
    }

    return dependencies;
  }

  /**
   * Scan for outdated packages
   */
  async scanOutdated(): Promise<any> {
    try {
      const outdatedOutput = execSync('npm outdated --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      });

      return JSON.parse(outdatedOutput);
    } catch (error) {
      // npm outdated returns non-zero when packages are outdated
      const output = (error as any).stdout;
      if (output) {
        try {
          return JSON.parse(output);
        } catch {
          return {};
        }
      }
      return {};
    }
  }

  /**
   * Run full dependency scan
   */
  async runFullScan(): Promise<AuditReport> {
    securityLogger.info('Starting full dependency scan', {
      projectRoot: this.projectRoot
    });

    const startTime = Date.now();

    // Run npm audit
    const auditData = await this.runNpmAudit();
    const scanResults = this.parseNpmAuditResults(auditData);

    // Scan for outdated packages
    const outdatedData = await this.scanOutdated();

    // Calculate summary
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const result of scanResults) {
      for (const vuln of result.vulnerabilities) {
        summary[vuln.severity]++;
      }
    }

    const report: AuditReport = {
      scanned: scanResults.length,
      vulnerable: scanResults.filter(r => r.vulnerabilities.length > 0).length,
      dependencies: scanResults,
      scanTime: startTime,
      summary
    };

    securityLogger.info('Dependency scan complete', {
      scanned: report.scanned,
      vulnerable: report.vulnerable,
      summary
    });

    return report;
  }

  /**
   * Generate audit report
   */
  generateReport(auditReport: AuditReport): string {
    const lines: string[] = [];

    lines.push('# Dependency Vulnerability Report');
    lines.push('');
    lines.push(`Scanned: ${auditReport.scanned} dependencies`);
    lines.push(`Vulnerable: ${auditReport.vulnerable} dependencies`);
    lines.push(`Scan Time: ${new Date(auditReport.scanTime).toISOString()}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Critical: ${auditReport.summary.critical}`);
    lines.push(`- High: ${auditReport.summary.high}`);
    lines.push(`- Medium: ${auditReport.summary.medium}`);
    lines.push(`- Low: ${auditReport.summary.low}`);
    lines.push('');

    if (auditReport.dependencies.length > 0) {
      lines.push('## Vulnerabilities');
      lines.push('');

      for (const dep of auditReport.dependencies) {
        if (dep.vulnerabilities.length > 0) {
          lines.push(`### ${dep.packageName} (${dep.version})`);
          lines.push('');

          for (const vuln of dep.vulnerabilities) {
            lines.push(`- **Severity:** ${vuln.severity.toUpperCase()}`);
            lines.push(`- **Title:** ${vuln.title}`);
            lines.push(`- **Description:** ${vuln.description}`);
            if (vuln.cve) {
              lines.push(`- **CVE:** ${vuln.cve}`);
            }
            if (vuln.cvss) {
              lines.push(`- **CVSS Score:** ${vuln.cvss}`);
            }
            lines.push(`- **Recommendation:** ${vuln.recommendation}`);
            lines.push('');
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Auto-fix vulnerabilities
   */
  async autoFix(): Promise<boolean> {
    try {
      securityLogger.info('Running npm audit fix');

      execSync('npm audit fix', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      return true;
    } catch (error) {
      securityLogger.error('Failed to auto-fix vulnerabilities', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// ============================================================================
// Lockfile Analyzer
// ============================================================================

export class LockfileAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze package-lock.json
   */
  analyzePackageLock(): any {
    const lockPath = join(this.projectRoot, 'package-lock.json');

    if (!existsSync(lockPath)) {
      throw new Error('package-lock.json not found');
    }

    const lockFile = JSON.parse(readFileSync(lockPath, 'utf-8'));
    const dependencies: Map<string, string> = new Map();

    if (lockFile.dependencies) {
      for (const [name, data] of Object.entries(lockFile.dependencies)) {
        const dep = data as any;
        dependencies.set(name, dep.version);
      }
    }

    return {
      lockfileVersion: lockFile.lockfileVersion,
      dependencies: Object.fromEntries(dependencies),
      dependencyCount: dependencies.size
    };
  }

  /**
   * Analyze yarn.lock
   */
  analyzeYarnLock(): any {
    const lockPath = join(this.projectRoot, 'yarn.lock');

    if (!existsSync(lockPath)) {
      throw new Error('yarn.lock not found');
    }

    const lockContent = readFileSync(lockPath, 'utf-8');
    const lines = lockContent.split('\n');
    const dependencies: Map<string, string> = new Map();

    let currentPackage: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('@') || /^[a-z]/i.test(trimmed)) {
        const match = trimmed.match(/^(@?[^@,]+)@/);
        if (match) {
          currentPackage = match[1];
        }
      }

      if (trimmed.startsWith('version:') && currentPackage) {
        const version = trimmed.split(':')[1].trim();
        const [existingVersion] = dependencies.get(currentPackage) || [null];
        if (!existingVersion) {
          dependencies.set(currentPackage, version);
        }
        currentPackage = null;
      }
    }

    return {
      dependencies: Object.fromEntries(dependencies),
      dependencyCount: dependencies.size
    };
  }

  /**
   * Detect dependency conflicts
   */
  detectConflicts(): any[] {
    try {
      const lsOutput = execSync('npm ls --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      });

      const lsData = JSON.parse(lsOutput);
      const conflicts: any[] = [];

      if (lsData.problems) {
        for (const problem of lsData.problems) {
          if (problem.includes('UNMET PEER DEPENDENCY')) {
            conflicts.push({
              type: 'unmet-peer-dependency',
              message: problem
            });
          } else if (problem.includes('extraneous')) {
            conflicts.push({
              type: 'extraneous',
              message: problem
            });
          }
        }
      }

      return conflicts;
    } catch (error) {
      return [];
    }
  }
}

// ============================================================================
// License Scanner
// ============================================================================

export class LicenseScanner {
  private projectRoot: string;
  private allowedLicenses: Set<string>;
  private forbiddenLicenses: Set<string>;

  constructor(
    projectRoot: string = process.cwd(),
    options?: {
      allowedLicenses?: string[];
      forbiddenLicenses?: string[];
    }
  ) {
    this.projectRoot = projectRoot;
    this.allowedLicenses = new Set(options?.allowedLicenses || [
      'MIT',
      'Apache-2.0',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'ISC',
      '0BSD'
    ]);
    this.forbiddenLicenses = new Set(options?.forbiddenLicenses || [
      'GPL-3.0',
      'AGPL-3.0'
    ]);
  }

  /**
   * Scan licenses
   */
  async scanLicenses(): Promise<any> {
    try {
      const output = execSync('npx license-checker --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      });

      const licenses = JSON.parse(output);
      const results: any[] = [];

      for (const [name, data] of Object.entries(licenses)) {
        const licenseData = data as any;
        const license = licenseData.licenses || 'Unknown';

        const result = {
          package: name,
          version: licenseData.version,
          license: Array.isArray(license) ? license.join(', ') : license,
          publisher: licenseData.publisher,
          allowed: this.isLicenseAllowed(license),
          forbidden: this.isLicenseForbidden(license)
        };

        results.push(result);
      }

      return {
        total: results.length,
        allowed: results.filter(r => r.allowed).length,
        forbidden: results.filter(r => r.forbidden).length,
        licenses: results
      };
    } catch (error) {
      return {
        error: 'Failed to scan licenses. Make sure license-checker is installed.'
      };
    }
  }

  /**
   * Check if license is allowed
   */
  private isLicenseAllowed(license: string | string[]): boolean {
    const licenses = Array.isArray(license) ? license : [license];

    for (const l of licenses) {
      if (this.allowedLicenses.has(l)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if license is forbidden
   */
  private isLicenseForbidden(license: string | string[]): boolean {
    const licenses = Array.isArray(license) ? license : [license];

    for (const l of licenses) {
      if (this.forbiddenLicenses.has(l)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate license report
   */
  generateLicenseReport(scanResult: any): string {
    if (scanResult.error) {
      return `Error: ${scanResult.error}`;
    }

    const lines: string[] = [];

    lines.push('# License Scan Report');
    lines.push('');
    lines.push(`Total packages: ${scanResult.total}`);
    lines.push(`Allowed licenses: ${scanResult.allowed}`);
    lines.push(`Forbidden licenses: ${scanResult.forbidden}`);
    lines.push('');

    if (scanResult.forbidden > 0) {
      lines.push('## Forbidden Licenses');
      lines.push('');

      for (const pkg of scanResult.licenses.filter((r: any) => r.forbidden)) {
        lines.push(`### ${pkg.package} (${pkg.version})`);
        lines.push(`- License: ${pkg.license}`);
        lines.push(`- Publisher: ${pkg.publisher || 'Unknown'}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create dependency scanner
 */
export function createDependencyScanner(projectRoot?: string, cacheEnabled?: boolean) {
  return new DependencyScanner(projectRoot, cacheEnabled);
}

/**
 * Create lockfile analyzer
 */
export function createLockfileAnalyzer(projectRoot?: string) {
  return new LockfileAnalyzer(projectRoot);
}

/**
 * Create license scanner
 */
export function createLicenseScanner(
  projectRoot?: string,
  options?: {
    allowedLicenses?: string[];
    forbiddenLicenses?: string[];
  }
) {
  return new LicenseScanner(projectRoot, options);
}

// ============================================================================
// CLI Functions
// ============================================================================

/**
 * Run dependency scan and output report
 */
export async function runDependencyScan(projectRoot?: string): Promise<void> {
  const scanner = new DependencyScanner(projectRoot);

  const report = await scanner.runFullScan();
  const reportText = scanner.generateReport(report);

  console.log(reportText);

  if (report.summary.critical > 0 || report.summary.high > 0) {
    process.exit(1);
  }
}

/**
 * Run license scan and output report
 */
export async function runLicenseScan(
  projectRoot?: string,
  options?: {
    allowedLicenses?: string[];
    forbiddenLicenses?: string[];
  }
): Promise<void> {
  const scanner = new LicenseScanner(projectRoot, options);

  const result = await scanner.scanLicenses();
  const report = scanner.generateLicenseReport(result);

  console.log(report);

  if (result.forbidden > 0) {
    process.exit(1);
  }
}
