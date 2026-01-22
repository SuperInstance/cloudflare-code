/**
 * License Analysis and Compliance
 *
 * This module provides comprehensive license analysis:
 * - License detection from package metadata
 * - License validation against policies
 * - License compatibility checking
 * - License compliance reporting
 * - License policy enforcement
 * - License recommendations
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import type {
  LicenseInfo,
  LicenseType,
  AnalyzerConfig,
  PackageMetadata,
} from '../types/index.js';

/**
 * SPDX License data
 */
interface SPDXLicense {
  name: string;
  spdxId: string;
  url?: string;
  osiApproved?: boolean;
  fsfLibre?: boolean;
}

/**
 * License analysis result
 */
interface LicenseAnalysisResult {
  licenses: Map<string, LicenseInfo>;
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    unknown: number;
    byType: Record<LicenseType, number>;
  };
  issues: Array<{
    package: string;
    license: string;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

/**
 * License categories
 */
const LICENSE_CATEGORIES: Record<string, LicenseType> = {
  // Permissive licenses
  MIT: 'permissive',
  'MIT-0': 'permissive',
  Apache-2.0: 'permissive',
  'Apache-1.1': 'permissive',
  BSD: 'permissive',
  'BSD-2-Clause': 'permissive',
  'BSD-3-Clause': 'permissive',
  'BSD-4-Clause': 'permissive',
  ISC: 'permissive',
  '0BSD': 'permissive',
  Unlicense: 'permissive',
  CC0: 'permissive',

  // Weak copyleft
  LGPL: 'weak-copyleft',
  'LGPL-2.0': 'weak-copyleft',
  'LGPL-2.1': 'weak-copyleft',
  'LGPL-3.0': 'weak-copyleft',
  MPL: 'weak-copyleft',
  'MPL-2.0': 'weak-copyleft',
  CDDL: 'weak-copyleft',
  'CDDL-1.0': 'weak-copyleft',
  EPL: 'weak-copyleft',
  'EPL-1.0': 'weak-copyleft',
  'EPL-2.0': 'weak-copyleft',

  // Strong copyleft
  GPL: 'strong-copyleft',
  'GPL-2.0': 'strong-copyleft',
  'GPL-3.0': 'strong-copyleft',
  AGPL: 'strong-copyleft',
  'AGPL-3.0': 'strong-copyleft',
  'CDDL-1.0': 'weak-copyleft', // Also weak
  GFDL: 'strong-copyleft',
};

/**
 * License compatibility matrix
 */
const COMPATIBILITY_MATRIX: Record<string, string[]> = {
  MIT: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
  'Apache-2.0': ['Apache-2.0', 'MIT', 'BSD-3-Clause'],
  'BSD-3-Clause': ['BSD-3-Clause', 'MIT', 'Apache-2.0'],
  'BSD-2-Clause': ['BSD-2-Clause', 'MIT', 'BSD-3-Clause'],
  ISC: ['ISC', 'MIT'],
  'LGPL-2.1': ['LGPL-2.1', 'LGPL-3.0', 'GPL-2.0', 'GPL-3.0'],
  'LGPL-3.0': ['LGPL-3.0', 'GPL-3.0'],
  'GPL-2.0': ['GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0'],
  'GPL-3.0': ['GPL-3.0', 'LGPL-3.0', 'AGPL-3.0'],
  'AGPL-3.0': ['AGPL-3.0', 'GPL-3.0'],
};

/**
 * License Analyzer
 */
export class LicenseAnalyzer {
  private config: AnalyzerConfig;
  private cache: Map<string, LicenseInfo>;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Analyze all licenses in the project
   */
  async analyze(): Promise<LicenseAnalysisResult> {
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

    const licenses = new Map<string, LicenseInfo>();
    const issues: LicenseAnalysisResult['issues'] = [];

    for (const [name, version] of Object.entries(allDeps)) {
      try {
        const licenseInfo = await this.analyzePackageLicense(name, version as string);
        licenses.set(name, licenseInfo);

        // Check compliance
        const complianceIssues = this.checkCompliance(licenseInfo, name);
        issues.push(...complianceIssues);
      } catch (error) {
        console.warn(`Failed to analyze license for ${name}:`, error);

        // Add unknown license
        licenses.set(name, {
          name: 'Unknown',
          spdxId: 'UNKNOWN',
          type: 'unknown',
          compatible: false,
          risks: ['License could not be determined'],
        });
      }
    }

    const summary = this.generateSummary(licenses);

    return { licenses, summary, issues };
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
   * Analyze license for a single package
   */
  async analyzePackageLicense(name: string, version: string): Promise<LicenseInfo> {
    // Check cache first
    const cacheKey = `${name}@${version}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Fetch package info from npm
    const response = await fetch(`https://registry.npmjs.org/${name}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch package info for ${name}`);
    }

    const packageInfo = await response.json();

    // Get license for specific version
    const versionData = packageInfo.versions?.[version] || packageInfo.versions?.[packageInfo['dist-tags']?.latest];
    if (!versionData) {
      throw new Error(`Version ${version} not found for ${name}`);
    }

    const licenseData = versionData.license || versionData.licenses?.[0];
    const licenseString = typeof licenseData === 'string' ? licenseData : licenseData?.type;

    const licenseInfo = this.parseLicense(licenseString || 'UNLICENSED');
    this.cache.set(cacheKey, licenseInfo);

    return licenseInfo;
  }

  /**
   * Parse license string
   */
  private parseLicense(licenseString: string): LicenseInfo {
    const normalized = this.normalizeLicense(licenseString);

    const license: LicenseInfo = {
      name: this.getLicenseName(normalized),
      spdxId: normalized,
      type: this.getLicenseType(normalized),
      url: this.getLicenseUrl(normalized),
      compatible: false,
      risks: [],
    };

    // Assess risks
    license.risks = this.assessRisks(license);

    return license;
  }

  /**
   * Normalize license string to SPDX ID
   */
  private normalizeLicense(license: string): string {
    // Remove 'SEE LICENSE IN' prefixes
    const cleaned = license
      .replace(/^SEE LICENSE IN\s*/i, '')
      .replace(/^LICENSE\s*/i, '')
      .replace(/\s+/g, '-')
      .toUpperCase();

    // Common aliases
    const aliases: Record<string, string> = {
      'APACHE-2': 'Apache-2.0',
      'APACHE2': 'Apache-2.0',
      'GPL-2': 'GPL-2.0',
      'GPL2': 'GPL-2.0',
      'GPL-3': 'GPL-3.0',
      'GPL3': 'GPL-3.0',
      'LGPL-2': 'LGPL-2.1',
      'LGPL2': 'LGPL-2.1',
      'LGPL-3': 'LGPL-3.0',
      'LGPL3': 'LGPL-3.0',
      'BSD': 'BSD-3-Clause',
      'MIT-LICENSE': 'MIT',
      'X11': 'MIT',
      'PUBLIC-DOMAIN': 'Unlicense',
    };

    return aliases[cleaned] || cleaned;
  }

  /**
   * Get display name for license
   */
  private getLicenseName(spdxId: string): string {
    const names: Record<string, string> = {
      'MIT': 'MIT License',
      'Apache-2.0': 'Apache License 2.0',
      'GPL-3.0': 'GNU General Public License v3.0',
      'LGPL-3.0': 'GNU Lesser General Public License v3.0',
      'BSD-3-Clause': 'BSD 3-Clause "New" or "Revised" License',
      'ISC': 'ISC License',
      'UNLICENSED': 'UNLICENSED',
      'UNKNOWN': 'Unknown License',
    };

    return names[spdxId] || spdxId;
  }

  /**
   * Get license type
   */
  private getLicenseType(spdxId: string): LicenseType {
    return LICENSE_CATEGORIES[spdxId] || 'unknown';
  }

  /**
   * Get license URL
   */
  private getLicenseUrl(spdxId: string): string | undefined {
    const urls: Record<string, string> = {
      'MIT': 'https://opensource.org/licenses/MIT',
      'Apache-2.0': 'https://opensource.org/licenses/Apache-2.0',
      'GPL-3.0': 'https://www.gnu.org/licenses/gpl-3.0.html',
      'LGPL-3.0': 'https://www.gnu.org/licenses/lgpl-3.0.html',
      'BSD-3-Clause': 'https://opensource.org/licenses/BSD-3-Clause',
      'ISC': 'https://opensource.org/licenses/ISC',
    };

    return urls[spdxId];
  }

  /**
   * Assess risks for a license
   */
  private assessRisks(license: LicenseInfo): string[] {
    const risks: string[] = [];

    switch (license.type) {
      case 'strong-copyleft':
        risks.push(
          'Strong copyleft license may require your project to be open source',
          'May require sharing modifications and derivatives under the same license'
        );
        break;

      case 'weak-copyleft':
        risks.push(
          'Weak copyleft license may require sharing modifications to the library itself',
          'May have implications for dynamic linking'
        );
        break;

      case 'proprietary':
        risks.push(
          'Proprietary license may have usage restrictions',
          'Review license terms carefully before use'
        );
        break;

      case 'unknown':
        risks.push(
          'License type is unknown or unrecognized',
          'Manual review required to determine usage rights'
        );
        break;
    }

    return risks;
  }

  /**
   * Check compliance against policy
   */
  private checkCompliance(license: LicenseInfo, packageName: string): Array<{
    package: string;
    license: string;
    issue: string;
    severity: 'high' | 'medium' | 'low';
  }> {
    const issues: Array<{
      package: string;
      license: string;
      issue: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    const allowedLicenses = this.config.rules?.license?.allowedLicenses;
    const deniedLicenses = this.config.rules?.license?.deniedLicenses;

    // Check denied licenses
    if (deniedLicenses && deniedLicenses.includes(license.spdxId)) {
      issues.push({
        package: packageName,
        license: license.spdxId,
        issue: `License ${license.spdxId} is explicitly denied by policy`,
        severity: 'high',
      });
    }

    // Check allowed licenses (if specified)
    if (allowedLicenses && allowedLicenses.length > 0) {
      if (!allowedLicenses.includes(license.spdxId)) {
        issues.push({
          package: packageName,
          license: license.spdxId,
          issue: `License ${license.spdxId} is not in the allowed list`,
          severity: 'medium',
        });
      }
    }

    // Check for copyleft in commercial projects
    if (license.type === 'strong-copyleft') {
      issues.push({
        package: packageName,
        license: license.spdxId,
        issue: 'Strong copyleft license may have implications for commercial use',
        severity: 'high',
      });
    }

    return issues;
  }

  /**
   * Generate summary
   */
  private generateSummary(licenses: Map<string, LicenseInfo>): LicenseAnalysisResult['summary'] {
    const byType: Record<LicenseType, number> = {
      permissive: 0,
      'weak-copyleft': 0,
      'strong-copyleft': 0,
      proprietary: 0,
      unknown: 0,
    };

    let compliant = 0;
    let nonCompliant = 0;
    let unknown = 0;

    for (const license of licenses.values()) {
      byType[license.type]++;

      if (license.compatible) {
        compliant++;
      } else if (license.type === 'unknown') {
        unknown++;
      } else {
        nonCompliant++;
      }
    }

    return {
      total: licenses.size,
      compliant,
      nonCompliant,
      unknown,
      byType,
    };
  }

  /**
   * Check compatibility between licenses
   */
  checkCompatibility(license1: string, license2: string): boolean {
    const compat1 = COMPATIBILITY_MATRIX[license1];
    if (!compat1) return false;

    return compat1.includes(license2);
  }

  /**
   * Get recommendations for license compliance
   */
  getRecommendations(licenses: Map<string, LicenseInfo>): Array<{
    package: string;
    current: string;
    recommended?: string;
    reason: string;
  }> {
    const recommendations: Array<{
      package: string;
      current: string;
      recommended?: string;
      reason: string;
    }> = [];

    for (const [pkg, license] of licenses) {
      if (license.type === 'strong-copyleft') {
        recommendations.push({
          package: pkg,
          current: license.spdxId,
          recommended: 'Consider using a permissive alternative',
          reason: 'Strong copyleft licenses may require your project to be open source',
        });
      }

      if (license.type === 'unknown') {
        recommendations.push({
          package: pkg,
          current: license.spdxId,
          reason: 'License could not be determined - manual review required',
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate license report
   */
  generateReport(result: LicenseAnalysisResult): string {
    const lines: string[] = [];

    lines.push('# License Analysis Report');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total packages: ${result.summary.total}`);
    lines.push(`- Compliant: ${result.summary.compliant}`);
    lines.push(`- Non-compliant: ${result.summary.nonCompliant}`);
    lines.push(`- Unknown: ${result.summary.unknown}`);
    lines.push('');
    lines.push('## License Distribution');
    lines.push('');
    for (const [type, count] of Object.entries(result.summary.byType)) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push('');

    if (result.issues.length > 0) {
      lines.push('## Issues');
      lines.push('');
      for (const issue of result.issues) {
        lines.push(`### ${issue.package}`);
        lines.push(`- License: ${issue.license}`);
        lines.push(`- Issue: ${issue.issue}`);
        lines.push(`- Severity: ${issue.severity}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

/**
 * License Policy Enforcer
 */
export class LicensePolicyEnforcer {
  /**
   * Validate against policy
   */
  static validate(
    licenses: Map<string, LicenseInfo>,
    policy: {
      allowed?: string[];
      denied?: string[];
      requireSPDX?: boolean;
    }
  ): {
    valid: boolean;
    violations: Array<{ package: string; license: string; reason: string }>;
  } {
    const violations: Array<{ package: string; license: string; reason: string }> = [];

    for (const [pkg, license] of licenses) {
      // Check denied licenses
      if (policy.denied?.includes(license.spdxId)) {
        violations.push({
          package: pkg,
          license: license.spdxId,
          reason: 'License is explicitly denied',
        });
      }

      // Check allowed licenses (if specified)
      if (policy.allowed && policy.allowed.length > 0) {
        if (!policy.allowed.includes(license.spdxId)) {
          violations.push({
            package: pkg,
            license: license.spdxId,
            reason: 'License is not in allowed list',
          });
        }
      }

      // Check for SPDX compliance
      if (policy.requireSPDX && license.spdxId === 'UNKNOWN') {
        violations.push({
          package: pkg,
          license: license.spdxId,
          reason: 'License is not SPDX-compliant',
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate policy file
   */
  static generatePolicy(options: {
    allowCopyleft?: boolean;
    allowProprietary?: boolean;
    requireSPDX?: boolean;
  }): string {
    const lines: string[] = [];
    lines.push('{');
    lines.push('  "allowedLicenses": [');

    const allowed: string[] = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];

    if (options.allowCopyleft) {
      allowed.push('LGPL-3.0', 'MPL-2.0');
    }

    if (options.allowProprietary) {
      // Add proprietary licenses if needed
    }

    lines.push(allowed.map((l) => `    "${l}"`).join(',\n'));
    lines.push('  ],');
    lines.push('  "deniedLicenses": [],');
    lines.push(`  "requireSPDX": ${options.requireSPDX ? true : false}`);
    lines.push('}');

    return lines.join('\n');
  }
}
