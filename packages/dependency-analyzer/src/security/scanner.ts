/**
 * Security Scanner for Dependencies
 *
 * This module provides comprehensive security scanning:
 * - Vulnerability scanning against databases
 * - CVE checking
 * - Security advisories
 * - Risk assessment
 * - Remediation suggestions
 * - Patch recommendations
 * - Security reporting
 */

import { join } from 'path';
import { promises as fs } from 'fs';

import type {
  Vulnerability,
  Severity,
  AnalyzerConfig,
  DependencyType,
} from '../types/index.js';

/**
 * Security scan result
 */
interface SecurityScanResult {
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  recommendations: string[];
}

/**
 * Advisory data from npm security database
 */
interface Advisory {
  ghsaId?: string;
  cveId?: string;
  summary: string;
  details: string;
  severity: Severity;
  publishedAt: string;
  updatedAt: string;
  patchedVersions?: string[];
  vulnerableVersions: string[];
  recommendations?: string[];
  references: string[];
  cvss?: number;
  cwe?: string[];
}

/**
 * Security Scanner
 */
export class SecurityScanner {
  private config: AnalyzerConfig;
  private cache: Map<string, Advisory[]>;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Perform full security scan
   */
  async scan(): Promise<SecurityScanResult> {
    const packageJson = await this.loadPackageJson();
    if (!packageJson) {
      throw new Error('Could not load package.json');
    }

    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
      ...(packageJson.peerDependencies || {}),
      ...(packageJson.optionalDependencies || {}),
    };

    const vulnerabilities: Vulnerability[] = [];
    const recommendations: string[] = [];

    // Scan each dependency
    for (const [name, version] of Object.entries(allDeps)) {
      try {
        const packageVulnerabilities = await this.scanPackage(name, version as string);
        vulnerabilities.push(...packageVulnerabilities);
      } catch (error) {
        console.warn(`Failed to scan ${name}:`, error);
      }
    }

    // Filter by severity if configured
    const filteredVulnerabilities = this.filterBySeverity(vulnerabilities);

    // Generate recommendations
    const generatedRecommendations = this.generateRecommendations(filteredVulnerabilities);
    recommendations.push(...generatedRecommendations);

    const summary = this.generateSummary(filteredVulnerabilities);

    return {
      vulnerabilities: filteredVulnerabilities,
      summary,
      recommendations,
    };
  }

  /**
   * Load package.json
   */
  private async loadPackageJson(): Promise<any> {
    const packageJsonPath = join(this.config.projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Scan a single package for vulnerabilities
   */
  async scanPackage(name: string, version: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Check npm security advisories
      const advisories = await this.fetchAdvisories(name);
      const versionSemver = this.parseVersion(version);

      for (const advisory of advisories) {
        if (this.isVersionVulnerable(version, advisory.vulnerableVersions)) {
          const isPatched = this.isVersionPatched(version, advisory.patchedVersions);

          vulnerabilities.push({
            id: advisory.ghsaId || advisory.cveId || `npm-${name}-${Date.now()}`,
            packageName: name,
            title: advisory.summary,
            description: advisory.details,
            severity: advisory.severity,
            cvss: advisory.cvss,
            cwe: advisory.cwe,
            patchedVersions: advisory.patchedVersions,
            recommendations: advisory.recommendations || [
              `Update to a patched version: ${advisory.patchedVersions?.join(', ') || 'check npm for updates'}`,
            ],
            references: advisory.references,
            publishedDate: new Date(advisory.publishedAt),
            updatedDate: new Date(advisory.updatedAt),
          });
        }
      }

      // Check OSV database for known vulnerabilities
      const osvVulnerabilities = await this.checkOSVDatabase(name, version);
      vulnerabilities.push(...osvVulnerabilities);

    } catch (error) {
      // Continue scanning other packages
    }

    return vulnerabilities;
  }

  /**
   * Fetch advisories from npm
   */
  private async fetchAdvisories(name: string): Promise<Advisory[]> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    try {
      const response = await fetch(`https://registry.npmjs.org/-/npm/v1/advisories?package=${name}`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const advisories: Advisory[] = (data.objects || []).map((obj: any) => ({
        ghsaId: obj.ghsaId,
        cveId: obj.cveId,
        summary: obj.title || obj.summary || 'Security vulnerability',
        details: obj.overview || obj.details || '',
        severity: this.normalizeSeverity(obj.severity),
        publishedAt: obj.created || obj.publishedAt || new Date().toISOString(),
        updatedAt: obj.updated || new Date().toISOString(),
        patchedVersions: obj.patchedVersions,
        vulnerableVersions: obj.vulnerable_versions,
        recommendations: obj.recommendation ? [obj.recommendation] : undefined,
        references: obj.references || obj.url ? [obj.url] : [],
        cvss: obj.cvss_score,
        cwe: obj.cwe,
      }));

      this.cache.set(name, advisories);
      return advisories;
    } catch {
      return [];
    }
  }

  /**
   * Check OSV (Open Source Vulnerabilities) database
   */
  private async checkOSVDatabase(name: string, version: string): Promise<Vulnerability[]> {
    try {
      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package: {
            name,
            ecosystem: 'npm',
          },
          version,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const vulns: Vulnerability[] = [];

      for (const vuln of data.vulns || []) {
        const affected = vuln.affected?.find((a: any) =>
          a.package?.name === name && a.package?.ecosystem === 'npm'
        );

        vulns.push({
          id: vuln.id || 'OSV-UNKNOWN',
          packageName: name,
          title: vuln.summary || 'Security vulnerability found in OSV database',
          description: vuln.details || '',
          severity: this.extractSeverityFromOSV(vuln),
          cvss: this.extractCVSSFromOSV(vuln),
          cwe: this.extractCWEFromOSV(vuln),
          patchedVersions: affected?.versions?.filter((v: string) =>
            !this.isVersionAffected(v, affected?.ranges || [])
          ),
          recommendations: [
            'Update to the latest patched version',
            'Review the OSV entry for detailed remediation steps',
          ],
          references: vuln.references?.map((r: any) => r.url) || [],
          publishedDate: new Date(vuln.published || Date.now()),
          updatedDate: new Date(vun.modified || Date.now()),
        });
      }

      return vulns;
    } catch {
      return [];
    }
  }

  /**
   * Parse version to semver
   */
  private parseVersion(version: string): string {
    // Remove any prefixes (e.g., ^, ~, >=)
    return version.replace(/^[^0-9]+/, '');
  }

  /**
   * Check if version is vulnerable
   */
  private isVersionVulnerable(version: string, vulnerableRanges: string): boolean {
    const semver = require('semver');

    // Try different range formats
    try {
      const cleanVersion = this.parseVersion(version);

      // Check if version matches vulnerable ranges
      const ranges = vulnerableRanges.split(' || ');
      return ranges.some((range) => semver.satisfies(cleanVersion, range));
    } catch {
      // If semver check fails, do string comparison
      return vulnerableRanges.includes(version);
    }
  }

  /**
   * Check if version is patched
   */
  private isVersionPatched(version: string, patchedVersions?: string[]): boolean {
    if (!patchedVersions || patchedVersions.length === 0) {
      return false;
    }

    const semver = require('semver');
    const cleanVersion = this.parseVersion(version);

    return patchedVersions.some((patched) => {
      try {
        return semver.satisfies(cleanVersion, patched);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if version is affected by OSV vulnerability
   */
  private isVersionAffected(version: string, ranges: any[]): boolean {
    // Simple check - in production, would use more sophisticated version comparison
    return true;
  }

  /**
   * Normalize severity string
   */
  private normalizeSeverity(severity: string): Severity {
    const s = severity?.toLowerCase();

    if (s === 'critical' || s === 'high') return 'critical';
    if (s === 'moderate' || s === 'medium') return 'moderate';
    if (s === 'low') return 'low';

    return 'moderate'; // Default
  }

  /**
   * Extract severity from OSV data
   */
  private extractSeverityFromOSV(vuln: any): Severity {
    const severity = vuln.severity?.[0]?.score;
    if (typeof severity === 'string') {
      if (severity.includes('CRITICAL')) return 'critical';
      if (severity.includes('HIGH')) return 'high';
      if (severity.includes('MEDIUM') || severity.includes('MODERATE')) return 'moderate';
      if (severity.includes('LOW')) return 'low';
    }

    // Check CVSS score if available
    const cvss = this.extractCVSSFromOSV(vuln);
    if (cvss) {
      if (cvss >= 9.0) return 'critical';
      if (cvss >= 7.0) return 'high';
      if (cvss >= 4.0) return 'moderate';
      return 'low';
    }

    return 'moderate';
  }

  /**
   * Extract CVSS score from OSV data
   */
  private extractCVSSFromOSV(vuln: any): number | undefined {
    const severity = vuln.severity?.[0];
    if (severity?.type === 'CVSS_V3') {
      return parseFloat(severity.score);
    }
    return undefined;
  }

  /**
   * Extract CWE from OSV data
   */
  private extractCWEFromOSV(vuln: any): string[] | undefined {
    const affected = vuln.affected?.[0];
    const cwes = affected?.database_specific?.cwe_ids;
    return cwes?.length ? cwes : undefined;
  }

  /**
   * Filter vulnerabilities by severity based on config
   */
  private filterBySeverity(vulnerabilities: Vulnerability[]): Vulnerability[] {
    const allowedSeverities = this.config.rules?.security?.severity || [
      'low',
      'moderate',
      'high',
      'critical',
    ];

    return vulnerabilities.filter((v) =>
      allowedSeverities.includes(v.severity)
    );
  }

  /**
   * Generate summary
   */
  private generateSummary(vulnerabilities: Vulnerability[]): SecurityScanResult['summary'] {
    return {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
      high: vulnerabilities.filter((v) => v.severity === 'high').length,
      moderate: vulnerabilities.filter((v) => v.severity === 'moderate').length,
      low: vulnerabilities.filter((v) => v.severity === 'low').length,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations: string[] = [];

    // Count by severity
    const critical = vulnerabilities.filter((v) => v.severity === 'critical').length;
    const high = vulnerabilities.filter((v) => v.severity === 'high').length;

    if (critical > 0) {
      recommendations.push(
        `URGENT: ${critical} critical vulnerabilities found. Update immediately.`
      );
    }

    if (high > 0) {
      recommendations.push(
        `${high} high severity vulnerabilities found. Update as soon as possible.`
      );
    }

    // Get unique packages with vulnerabilities
    const vulnerablePackages = new Set(vulnerabilities.map((v) => v.packageName));

    if (vulnerablePackages.size > 0) {
      recommendations.push(
        `Run \`npm audit fix\` to automatically fix remediatable vulnerabilities.`
      );
      recommendations.push(
        `Review security advisories for affected packages: ${Array.from(vulnerablePackages).join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Generate security report
   */
  generateReport(result: SecurityScanResult): string {
    const lines: string[] = [];

    lines.push('# Security Scan Report');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total vulnerabilities: ${result.summary.total}`);
    lines.push(`- Critical: ${result.summary.critical}`);
    lines.push(`- High: ${result.summary.high}`);
    lines.push(`- Moderate: ${result.summary.moderate}`);
    lines.push(`- Low: ${result.summary.low}`);
    lines.push('');

    if (result.vulnerabilities.length > 0) {
      lines.push('## Vulnerabilities');
      lines.push('');

      // Group by severity
      const bySeverity = {
        critical: result.vulnerabilities.filter((v) => v.severity === 'critical'),
        high: result.vulnerabilities.filter((v) => v.severity === 'high'),
        moderate: result.vulnerabilities.filter((v) => v.severity === 'moderate'),
        low: result.vulnerabilities.filter((v) => v.severity === 'low'),
      };

      for (const [severity, vulns] of Object.entries(bySeverity)) {
        if (vulns.length === 0) continue;

        lines.push(`### ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${vulns.length})`);
        lines.push('');

        for (const vuln of vulns) {
          lines.push(`#### ${vuln.packageName} - ${vuln.id}`);
          lines.push('');
          lines.push(`**${vuln.title}**`);
          lines.push('');
          lines.push(vuln.description);
          lines.push('');
          if (vuln.cvss) {
            lines.push(`- **CVSS Score**: ${vuln.cvss}`);
          }
          if (vuln.cwe) {
            lines.push(`- **CWE**: ${vuln.cwe.join(', ')}`);
          }
          if (vuln.patchedVersions) {
            lines.push(`- **Patched Versions**: ${vuln.patchedVersions.join(', ')}`);
          }
          lines.push(`- **Published**: ${vuln.publishedDate.toISOString()}`);
          lines.push('');
          lines.push('**Recommendations:**');
          for (const rec of vuln.recommendations) {
            lines.push(`- ${rec}`);
          }
          lines.push('');
        }
      }
    } else {
      lines.push('No vulnerabilities found!');
      lines.push('');
    }

    if (result.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      for (const rec of result.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Calculate risk score for vulnerabilities
   */
  calculateRiskScore(vulnerabilities: Vulnerability[]): {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
  } {
    let score = 0;

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score += 10;
          break;
        case 'high':
          score += 7;
          break;
        case 'moderate':
          score += 4;
          break;
        case 'low':
          score += 1;
          break;
      }
    }

    let level: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 30) {
      level = 'critical';
    } else if (score >= 20) {
      level = 'high';
    } else if (score >= 10) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { score, level };
  }
}

/**
 * Risk Assessment
 */
export class RiskAssessment {
  /**
   * Assess overall security risk
   */
  static assess(vulnerabilities: Vulnerability[]): {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigation: string[];
  } {
    const factors: string[] = [];
    const mitigation: string[] = [];

    // Critical vulnerabilities
    const critical = vulnerabilities.filter((v) => v.severity === 'critical').length;
    if (critical > 0) {
      factors.push(`${critical} critical vulnerabilities present`);
      mitigation.push('Immediately patch all critical vulnerabilities');
    }

    // High vulnerabilities
    const high = vulnerabilities.filter((v) => v.severity === 'high').length;
    if (high > 0) {
      factors.push(`${high} high severity vulnerabilities`);
      mitigation.push('Prioritize patching high severity vulnerabilities');
    }

    // Unpatched vulnerabilities
    const unpatched = vulnerabilities.filter((v) => !v.patchedVersions || v.patchedVersions.length === 0);
    if (unpatched.length > 0) {
      factors.push(`${unpatched.length} vulnerabilities without available patches`);
      mitigation.push('Consider alternative packages or implement compensating controls');
    }

    // Old vulnerabilities
    const oldVulns = vulnerabilities.filter((v) => {
      const daysSincePublish = (Date.now() - v.publishedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSincePublish > 365;
    });
    if (oldVulns.length > 0) {
      factors.push(`${oldVulns.length} vulnerabilities published over a year ago`);
      mitigation.push('Review why these vulnerabilities have not been addressed');
    }

    // Determine overall level
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (critical > 0) {
      level = 'critical';
    } else if (high > 2) {
      level = 'high';
    } else if (high > 0 || vulnerabilities.filter((v) => v.severity === 'moderate').length > 5) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, factors, mitigation };
  }

  /**
   * Generate remediation plan
   */
  static generateRemediationPlan(vulnerabilities: Vulnerability[]): Array<{
    priority: number;
    package: string;
    vulnerability: string;
    action: string;
    effort: 'easy' | 'medium' | 'hard';
  }> {
    const plan: Array<{
      priority: number;
      package: string;
      vulnerability: string;
      action: string;
      effort: 'easy' | 'medium' | 'hard';
    }> = [];

    // Sort by severity and age
    const sorted = [...vulnerabilities].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      return a.publishedDate.getTime() - b.publishedDate.getTime();
    });

    for (const vuln of sorted) {
      const priority = sorted.indexOf(vuln) + 1;

      let action: string;
      let effort: 'easy' | 'medium' | 'hard';

      if (vuln.patchedVersions && vuln.patchedVersions.length > 0) {
        action = `Update ${vuln.packageName} to ${vuln.patchedVersions[0]}`;
        effort = 'easy';
      } else {
        action = `Find replacement for ${vuln.packageName} or implement mitigations`;
        effort = 'hard';
      }

      plan.push({
        priority,
        package: vuln.packageName,
        vulnerability: vuln.id,
        action,
        effort,
      });
    }

    return plan;
  }
}
