/**
 * Dependency Scanner - Software Composition Analysis (SCA)
 * Scans dependencies for vulnerabilities, license issues, and outdated packages
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { SemVer, parse as parseSemVer, lt as semverLt, gte as semverGte } from 'semver';
import { Severity, VulnerabilityType, Dependency, Vulnerability, License, Finding, ScanResult, ScanStatistics, ScanStatus } from '../types';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SCAOptions {
  includeDevDependencies?: boolean;
  includeTransitiveDependencies?: boolean;
  severityThreshold?: Severity;
  licenseWhitelist?: string[];
  licenseBlacklist?: string[];
  checkOutdated?: boolean;
}

export interface VulnerabilityDatabase {
  vulnerabilities: Map<string, Vulnerability[]>;
  lastUpdated: Date;
}

export class DependencyScanner {
  private logger: Logger;
  private vulnDb: VulnerabilityDatabase;

  constructor(logger: Logger) {
    this.logger = logger;
    this.vulnDb = {
      vulnerabilities: new Map(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Scan a project for dependencies
   */
  public async scanProject(projectPath: string, options: SCAOptions = {}): Promise<ScanResult> {
    const scanId = uuidv4();
    const startTime = new Date();
    this.logger = this.logger.withScanId(scanId);

    this.logger.info(`Starting dependency scan of ${projectPath}`);

    const findings: Finding[] = [];
    const dependencies = await this.discoverDependencies(projectPath, options);

    this.logger.info(`Found ${dependencies.length} dependencies`);

    // Check for vulnerabilities
    const vulnFindings = await this.checkVulnerabilities(dependencies);
    findings.push(...vulnFindings);

    // Check for license issues
    const licenseFindings = await this.checkLicenses(dependencies, options);
    findings.push(...licenseFindings);

    // Check for outdated packages
    if (options.checkOutdated) {
      const outdatedFindings = await this.checkOutdated(dependencies);
      findings.push(...outdatedFindings);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const stats = this.calculateStatistics(findings, dependencies.length);

    this.logger.info(`Dependency scan completed in ${duration}ms`);
    this.logger.info(`Found ${findings.length} issues`);

    return {
      id: scanId,
      scanType: 'sca',
      status: ScanStatus.COMPLETED,
      config: {
        target: projectPath,
        targetType: 'dependency',
        enableSAST: false,
        enableDAST: false,
        enableSCA: true,
        enableCompliance: false,
        outputFormat: 'json',
      } as any,
      findings,
      groupedFindings: this.groupFindings(findings),
      stats,
      startTime,
      endTime,
      duration,
      scannerVersion: '1.0.0',
    };
  }

  /**
   * Discover all dependencies in the project
   */
  private async discoverDependencies(projectPath: string, options: SCAOptions): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];

    // Scan package.json (npm/yarn)
    const npmDeps = await this.scanNpmDependencies(projectPath, options);
    dependencies.push(...npmDeps);

    // Scan requirements.txt (pip)
    const pipDeps = await this.scanPipDependencies(projectPath, options);
    dependencies.push(...pipDeps);

    // Scan go.mod (Go)
    const goDeps = await this.scanGoDependencies(projectPath, options);
    dependencies.push(...goDeps);

    return dependencies;
  }

  /**
   * Scan npm dependencies
   */
  private async scanNpmDependencies(projectPath: string, options: SCAOptions): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const packageJsonContent = await fsp.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const deps = packageJson.dependencies || {};
      const devDeps = options.includeDevDependencies ? (packageJson.devDependencies || {}) : {};

      for (const [name, version] of Object.entries({ ...deps, ...devDeps })) {
        dependencies.push({
          name,
          version: this.cleanVersion(version as string),
          type: 'npm',
          dev: devDeps.hasOwnProperty(name),
          optional: false,
          path: packageJsonPath,
        });
      }

      // Check for transitive dependencies if requested
      if (options.includeTransitiveDependencies) {
        const transitiveDeps = await this.getTransitiveNpmDependencies(projectPath, dependencies);
        dependencies.push(...transitiveDeps);
      }
    } catch (error) {
      this.logger.debug(`Failed to scan npm dependencies: ${error}`);
    }

    return dependencies;
  }

  /**
   * Get transitive npm dependencies
   */
  private async getTransitiveNpmDependencies(projectPath: string, directDeps: Dependency[]): Promise<Dependency[]> {
    const transitiveDeps: Dependency[] = [];

    for (const dep of directDeps) {
      const nodeModulesPath = path.join(projectPath, 'node_modules', dep.name, 'package.json');

      try {
        const packageJsonContent = await fsp.readFile(nodeModulesPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);

        const deps = packageJson.dependencies || {};
        for (const [name, version] of Object.entries(deps)) {
          transitiveDeps.push({
            name,
            version: this.cleanVersion(version as string),
            type: 'npm',
            dev: false,
            optional: false,
            transitive: true,
            path: nodeModulesPath,
          });
        }
      } catch (error) {
        // Skip if package.json doesn't exist
      }
    }

    return transitiveDeps;
  }

  /**
   * Scan pip dependencies
   */
  private async scanPipDependencies(projectPath: string, options: SCAOptions): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const requirementsFiles = ['requirements.txt', 'requirements-dev.txt', 'Pipfile'];

    for (const requirementsFile of requirementsFiles) {
      const requirementsPath = path.join(projectPath, requirementsFile);

      try {
        const content = await fsp.readFile(requirementsPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const match = trimmed.match(/^([a-zA-Z0-9_-]+)([>=<~!]+)([^;]+)?/);
            if (match) {
              const [, name, , version] = match;
              dependencies.push({
                name: name.toLowerCase(),
                version: version ? this.cleanVersion(version) : 'any',
                type: 'pypi',
                dev: requirementsFile.includes('dev'),
                optional: false,
                path: requirementsPath,
              });
            }
          }
        }
      } catch (error) {
        // Skip if file doesn't exist
      }
    }

    return dependencies;
  }

  /**
   * Scan Go dependencies
   */
  private async scanGoDependencies(projectPath: string, options: SCAOptions): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const goModPath = path.join(projectPath, 'go.mod');

    try {
      const content = await fsp.readFile(goModPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('require ')) {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 3) {
            dependencies.push({
              name: parts[1],
              version: parts[2],
              type: 'go',
              dev: false,
              optional: false,
              path: goModPath,
            });
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to scan go.mod: ${error}`);
    }

    return dependencies;
  }

  /**
   * Clean version string
   */
  private cleanVersion(version: string): string {
    return version.replace(/^[\^~]/, '').replace(/>.*/, '').replace(/<.*/, '');
  }

  /**
   * Check dependencies for vulnerabilities
   */
  private async checkVulnerabilities(dependencies: Dependency[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const dep of dependencies) {
      const vulnerabilities = await this.lookupVulnerabilities(dep);

      for (const vuln of vulnerabilities) {
        const finding: Finding = {
          id: `vuln-${dep.name}-${dep.version}-${vuln.id}`,
          title: `Vulnerability in ${dep.name}@${dep.version}`,
          description: vuln.description,
          severity: {
            level: vuln.severity,
            score: this.getSeverityScore(vuln.severity),
          },
          type: VulnerabilityType.VULNERABLE_DEPENDENCY,
          cwe: vuln.cwes.map((cwe) => ({ id: cwe, name: '', description: '', url: '' })),
          confidence: 95,
          file: dep.path || 'unknown',
          line: 0,
          column: 0,
          codeSnippet: `${dep.name}@${dep.version}`,
          context: `Vulnerable versions: ${vuln.affectedVersions.join(', ')}`,
          remediation: `Update to ${vuln.patchedVersions.join(' or ')} or later`,
          references: vuln.references,
          scanner: 'sca',
          timestamp: new Date(),
          metadata: {
            dependency: dep,
            vulnerability: vuln,
          },
        };

        findings.push(finding);
      }
    }

    return findings;
  }

  /**
   * Lookup vulnerabilities for a dependency
   */
  private async lookupVulnerabilities(dep: Dependency): Promise<Vulnerability[]> {
    const key = `${dep.name}:${dep.type}`;
    const allVulns = this.vulnDb.vulnerabilities.get(key) || [];

    // Filter by version
    return allVulns.filter((vuln) => {
      try {
        const depVersion = parseSemVer(dep.version);
        if (!depVersion) return false;

        return vuln.affectedVersions.some((affectedRange) => {
          return this.isVersionInRange(depVersion, affectedRange);
        });
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if version is in range
   */
  private isVersionInRange(version: SemVer, range: string): boolean {
    // Simplified version range checking
    if (range.startsWith('<=')) {
      const minVersion = parseSemVer(range.substring(2));
      return minVersion ? semverLt(version, minVersion) || version.equals(minVersion) : false;
    } else if (range.startsWith('>=')) {
      const maxVersion = parseSemVer(range.substring(2));
      return maxVersion ? semverGte(version, maxVersion) || version.equals(maxVersion) : false;
    } else if (range.startsWith('<')) {
      const minVersion = parseSemVer(range.substring(1));
      return minVersion ? semverLt(version, minVersion) : false;
    } else if (range.startsWith('>')) {
      const maxVersion = parseSemVer(range.substring(1));
      return maxVersion ? semverGte(version, maxVersion) : false;
    }

    return false;
  }

  /**
   * Check dependencies for license issues
   */
  private async checkLicenses(dependencies: Dependency[], options: SCAOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const dep of dependencies) {
      const license = await this.lookupLicense(dep);

      if (!license) {
        continue;
      }

      // Check blacklist
      if (options.licenseBlacklist && options.licenseBlacklist.includes(license.id)) {
        findings.push({
          id: `license-blacklist-${dep.name}-${license.id}`,
          title: `Blacklisted License: ${license.name}`,
          description: `Dependency ${dep.name} uses ${license.name} which is not allowed`,
          severity: {
            level: Severity.HIGH,
            score: 7,
          },
          type: VulnerabilityType.LICENSE_VIOLATION,
          confidence: 100,
          file: dep.path || 'unknown',
          line: 0,
          column: 0,
          codeSnippet: `${dep.name}@${dep.version} - ${license.name}`,
          remediation: `Replace ${dep.name} with an alternative that uses an approved license`,
          references: [license.url || ''],
          scanner: 'sca',
          timestamp: new Date(),
          metadata: {
            dependency: dep,
            license,
          },
        });
      }

      // Check whitelist (if provided and license not in whitelist)
      if (options.licenseWhitelist && !options.licenseWhitelist.includes(license.id)) {
        findings.push({
          id: `license-not-whitelisted-${dep.name}-${license.id}`,
          title: `Unapproved License: ${license.name}`,
          description: `Dependency ${dep.name} uses ${license.name} which is not in the approved list`,
          severity: {
            level: Severity.MEDIUM,
            score: 5,
          },
          type: VulnerabilityType.LICENSE_VIOLATION,
          confidence: 100,
          file: dep.path || 'unknown',
          line: 0,
          column: 0,
          codeSnippet: `${dep.name}@${dep.version} - ${license.name}`,
          remediation: `Add ${license.name} to the license whitelist or replace ${dep.name}`,
          references: [license.url || ''],
          scanner: 'sca',
          timestamp: new Date(),
          metadata: {
            dependency: dep,
            license,
          },
        });
      }

      // Check for high-risk licenses
      if (license.type === 'strong_copyleft' && !license.approved) {
        findings.push({
          id: `license-copyleft-${dep.name}-${license.id}`,
          title: `Strong Copyleft License: ${license.name}`,
          description: `Dependency ${dep.name} uses ${license.name} which may require sharing your source code`,
          severity: {
            level: Severity.MEDIUM,
            score: 5,
          },
          type: VulnerabilityType.LICENSE_VIOLATION,
          confidence: 100,
          file: dep.path || 'unknown',
          line: 0,
          column: 0,
          codeSnippet: `${dep.name}@${dep.version} - ${license.name}`,
          remediation: `Review ${license.name} requirements and ensure compliance. Consider alternative if needed.`,
          references: [license.url || ''],
          scanner: 'sca',
          timestamp: new Date(),
          metadata: {
            dependency: dep,
            license,
          },
        });
      }
    }

    return findings;
  }

  /**
   * Lookup license for a dependency
   */
  private async lookupLicense(dep: Dependency): Promise<License | null> {
    // Simplified license lookup
    const knownLicenses: Record<string, License> = {
      MIT: {
        id: 'MIT',
        name: 'MIT License',
        type: 'permissive',
        risk: 'low',
        approved: true,
        url: 'https://opensource.org/licenses/MIT',
      },
      ISC: {
        id: 'ISC',
        name: 'ISC License',
        type: 'permissive',
        risk: 'low',
        approved: true,
        url: 'https://opensource.org/licenses/ISC',
      },
      Apache: {
        id: 'Apache-2.0',
        name: 'Apache License 2.0',
        type: 'permissive',
        risk: 'low',
        approved: true,
        url: 'https://opensource.org/licenses/Apache-2.0',
      },
      BSD: {
        id: 'BSD',
        name: 'BSD License',
        type: 'permissive',
        risk: 'low',
        approved: true,
        url: 'https://opensource.org/licenses/BSD',
      },
      GPL: {
        id: 'GPL',
        name: 'GNU General Public License',
        type: 'strong_copyleft',
        risk: 'high',
        approved: false,
        url: 'https://opensource.org/licenses/GPL',
      },
      LGPL: {
        id: 'LGPL',
        name: 'GNU Lesser General Public License',
        type: 'weak_copyleft',
        risk: 'medium',
        approved: true,
        url: 'https://opensource.org/licenses/LGPL',
      },
      MPL: {
        id: 'MPL',
        name: 'Mozilla Public License',
        type: 'weak_copyleft',
        risk: 'medium',
        approved: true,
        url: 'https://opensource.org/licenses/MPL',
      },
      UNLICENSED: {
        id: 'UNLICENSED',
        name: 'Unlicensed',
        type: 'proprietary',
        risk: 'high',
        approved: false,
      },
      PROPRIETARY: {
        id: 'PROPRIETARY',
        name: 'Proprietary',
        type: 'proprietary',
        risk: 'high',
        approved: false,
      },
    };

    // This would typically query an API like npm registry or PyPI
    // For now, return a default license
    return knownLicenses.MIT;
  }

  /**
   * Check for outdated dependencies
   */
  private async checkOutdated(dependencies: Dependency[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const dep of dependencies) {
      const latestVersion = await this.getLatestVersion(dep);

      if (latestVersion && this.isVersionOutdated(dep.version, latestVersion)) {
        findings.push({
          id: `outdated-${dep.name}`,
          title: `Outdated Dependency: ${dep.name}`,
          description: `${dep.name} is outdated (current: ${dep.version}, latest: ${latestVersion})`,
          severity: {
            level: Severity.LOW,
            score: 2,
          },
          type: VulnerabilityType.OUTDATED_DEPENDENCY,
          confidence: 100,
          file: dep.path || 'unknown',
          line: 0,
          column: 0,
          codeSnippet: `${dep.name}@${dep.version}`,
          remediation: `Update ${dep.name} to version ${latestVersion}`,
          references: [],
          scanner: 'sca',
          timestamp: new Date(),
          metadata: {
            dependency: dep,
            currentVersion: dep.version,
            latestVersion,
          },
        });
      }
    }

    return findings;
  }

  /**
   * Get latest version of a dependency
   */
  private async getLatestVersion(dep: Dependency): Promise<string | null> {
    // This would typically query the npm registry, PyPI, etc.
    // For now, return null to indicate we couldn't determine latest version
    return null;
  }

  /**
   * Check if version is outdated
   */
  private isVersionOutdated(current: string, latest: string): boolean {
    try {
      const currentVer = parseSemVer(current);
      const latestVer = parseSemVer(latest);

      if (currentVer && latestVer) {
        return semverLt(currentVer, latestVer);
      }
    } catch {
      // If we can't parse, assume it's not outdated
    }

    return false;
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(findings: Finding[], depCount: number): ScanStatistics {
    const stats: ScanStatistics = {
      total: findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      filesScanned: depCount,
      linesScanned: 0,
      vulnerabilitiesFound: findings.filter(
        (f) => f.type === VulnerabilityType.VULNERABLE_DEPENDENCY
      ).length,
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
   * Group findings
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
   * Get severity score
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
   * Load vulnerability database from file
   */
  public async loadVulnerabilityDatabase(filePath: string): Promise<void> {
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const vuln of data.vulnerabilities || []) {
        const key = `${vuln.package}:${vuln.ecosystem}`;
        if (!this.vulnDb.vulnerabilities.has(key)) {
          this.vulnDb.vulnerabilities.set(key, []);
        }

        this.vulnDb.vulnerabilities.get(key)!.push({
          id: vuln.id,
          cve: vuln.cve,
          title: vuln.title || vuln.id,
          description: vuln.description || '',
          severity: this.mapSeverity(vuln.severity),
          cwes: vuln.cwes || [],
          references: vuln.references || [],
          affectedVersions: vuln.affected_versions || [],
          patchedVersions: vuln.patched_versions || [],
          publishedDate: new Date(vuln.published_date || Date.now()),
          modifiedDate: new Date(vuln.modified_date || Date.now()),
        });
      }

      this.vulnDb.lastUpdated = new Date();
      this.logger.info(`Loaded ${this.vulnDb.vulnerabilities.size} vulnerability entries`);
    } catch (error) {
      this.logger.error(`Failed to load vulnerability database: ${error}`);
    }
  }

  /**
   * Map severity string to enum
   */
  private mapSeverity(severity: string): Severity {
    const s = severity.toLowerCase();
    if (s === 'critical') return Severity.CRITICAL;
    if (s === 'high') return Severity.HIGH;
    if (s === 'medium') return Severity.MEDIUM;
    if (s === 'low') return Severity.LOW;
    return Severity.INFO;
  }
}
