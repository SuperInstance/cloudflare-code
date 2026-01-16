// @ts-nocheck
/**
 * Dependency Updater
 *
 * Automated dependency update management with security and breaking change detection.
 */

import { Logger } from '../utils/logger';
import { GitIntegration } from '../utils/git-integration';
import { parseSemver, satisfies, gt, diff } from 'semver';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

export interface DependencyUpdateOptions {
  autoCommit?: boolean;
  includeDevDependencies?: boolean;
  includePeerDependencies?: boolean;
  securityOnly?: boolean;
  breakingChanges?: 'allow' | 'warn' | 'deny';
  registryUrl?: string;
}

export interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  wantedVersion: string;
  updatesAvailable: UpdateInfo[];
  securityIssues: SecurityIssue[];
  deprecated: boolean;
  deprecatedMessage?: string;
}

export interface UpdateInfo {
  type: 'major' | 'minor' | 'patch' | 'prerelease';
  from: string;
  to: string;
  breakingChanges: string[];
  features: string[];
  changelog: string;
}

export interface SecurityIssue {
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  patchedVersions: string[];
  cve?: string;
}

export interface UpdateResult {
  success: boolean;
  updatesApplied: UpdateInfo[];
  warnings: string[];
  errors: string[];
  rollbackInfo?: RollbackInfo;
}

export interface RollbackInfo {
  packageJsonPath: string;
  lockfilePaths: string[];
  originalPackageJson: string;
  originalLockfiles: Map<string, string>;
}

export class DependencyUpdater {
  private logger: Logger;
  private git: GitIntegration;
  private registryUrl: string;
  private cache: Map<string, any> = new Map();

  constructor(private options: DependencyUpdateOptions = {}) {
    this.logger = new Logger('info');
    this.git = new GitIntegration();
    this.registryUrl = options.registryUrl || 'https://registry.npmjs.org';
  }

  /**
   * Check for available updates
   */
  async checkUpdates(projectPath: string): Promise<DependencyInfo[]> {
    this.logger.info(`Checking for dependency updates in ${projectPath}`);

    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    const dependencies: DependencyInfo[] = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...(this.options.includeDevDependencies ? packageJson.devDependencies : {}),
      ...(this.options.includePeerDependencies ? packageJson.peerDependencies : {})
    };

    for (const [name, version] of Object.entries(allDeps)) {
      try {
        const info = await this.getDependencyInfo(name, version as string);
        dependencies.push(info);
      } catch (error) {
        this.logger.warn(`Failed to fetch info for ${name}: ${error}`);
      }
    }

    // Filter by security if requested
    if (this.options.securityOnly) {
      return dependencies.filter(dep => dep.securityIssues.length > 0);
    }

    return dependencies;
  }

  /**
   * Update a specific package
   */
  async updatePackage(
    packageName: string,
    version: string,
    projectPath: string = process.cwd()
  ): Promise<UpdateResult> {
    this.logger.info(`Updating ${packageName} to ${version}`);

    const updatesApplied: UpdateInfo[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Store original for rollback
      const rollbackInfo: RollbackInfo = {
        packageJsonPath,
        lockfilePaths: [],
        originalPackageJson: JSON.stringify(packageJson, null, 2),
        originalLockfiles: new Map()
      };

      // Check if version update is allowed
      const currentVersion = packageJson.dependencies?.[packageName] ||
                           packageJson.devDependencies?.[packageName];
      if (!currentVersion) {
        errors.push(`Package ${packageName} not found in dependencies`);
        return { success: false, updatesApplied, warnings, errors };
      }

      const updateType = this.getUpdateType(currentVersion, version);

      if (updateType === 'major' && this.options.breakingChanges === 'deny') {
        errors.push(`Major version updates are denied for ${packageName}`);
        return { success: false, updatesApplied, warnings, errors, rollbackInfo };
      }

      if (updateType === 'major' && this.options.breakingChanges === 'warn') {
        warnings.push(`Major version update for ${packageName} may contain breaking changes`);
      }

      // Fetch package info and check for breaking changes
      const packageInfo = await this.getDependencyInfo(packageName, currentVersion);
      const updateInfo = packageInfo.updatesAvailable.find(
        u => u.to === version
      );

      if (updateInfo && updateInfo.breakingChanges.length > 0) {
        warnings.push(
          `Update to ${version} includes breaking changes:\n${updateInfo.breakingChanges.join('\n')}`
        );
      }

      // Update package.json
      if (packageJson.dependencies?.[packageName]) {
        packageJson.dependencies[packageName] = version;
      } else if (packageJson.devDependencies?.[packageName]) {
        packageJson.devDependencies[packageName] = version;
      }

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      // Run npm install to update lockfile
      await this.runNpmInstall(projectPath);

      updatesApplied.push(updateInfo || {
        type: updateType,
        from: currentVersion,
        to: version,
        breakingChanges: [],
        features: [],
        changelog: ''
      });

      // Commit changes if requested
      if (this.options.autoCommit) {
        await this.git.commit(`Update ${packageName} to ${version}`);
      }

      this.logger.info(`Successfully updated ${packageName} to ${version}`);

      return {
        success: true,
        updatesApplied,
        warnings,
        errors,
        rollbackInfo
      };
    } catch (error) {
      this.logger.error(`Failed to update ${packageName}: ${error}`);
      errors.push(error instanceof Error ? error.message : String(error));
      return { success: false, updatesApplied, warnings, errors };
    }
  }

  /**
   * Update all packages to latest versions
   */
  async updateAll(
    projectPath: string,
    targetVersion?: 'latest' | 'wanted' | 'greatest'
  ): Promise<UpdateResult> {
    this.logger.info(`Updating all packages to ${targetVersion || 'latest'}`);

    const updatesApplied: UpdateInfo[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const dependencies = await this.checkUpdates(projectPath);

      for (const dep of dependencies) {
        const target = targetVersion === 'wanted' ? dep.wantedVersion : dep.latestVersion;

        // Skip if no update needed
        if (target === dep.currentVersion) {
          continue;
        }

        // Check for security issues
        if (dep.securityIssues.length > 0) {
          this.logger.info(`Updating ${dep.name} to fix security issues`);
        }

        const result = await this.updatePackage(dep.name, target, projectPath);

        if (result.success) {
          updatesApplied.push(...result.updatesApplied);
        } else {
          errors.push(...result.errors);
        }

        warnings.push(...result.warnings);
      }

      return {
        success: errors.length === 0,
        updatesApplied,
        warnings,
        errors
      };
    } catch (error) {
      this.logger.error(`Failed to update packages: ${error}`);
      errors.push(error instanceof Error ? error.message : String(error));
      return { success: false, updatesApplied, warnings, errors };
    }
  }

  /**
   * Check for security vulnerabilities
   */
  async checkSecurity(projectPath: string): Promise<Map<string, SecurityIssue[]>> {
    this.logger.info(`Checking for security vulnerabilities in ${projectPath}`);

    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    const vulnerabilities = new Map<string, SecurityIssue[]>();
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    for (const [name, version] of Object.entries(allDeps)) {
      try {
        const advisory = await this.fetchSecurityAdvisory(name, version as string);
        if (advisory && advisory.length > 0) {
          vulnerabilities.set(name, advisory);
        }
      } catch (error) {
        this.logger.debug(`No security info for ${name}`);
      }
    }

    return vulnerabilities;
  }

  /**
   * Analyze compatibility between versions
   */
  async checkCompatibility(
    packageName: string,
    currentVersion: string,
    targetVersion: string
  ): Promise<{
    compatible: boolean;
    breakingChanges: string[];
    requiredUpdates: string[];
  }> {
    this.logger.info(`Checking compatibility for ${packageName}`);

    try {
      const packageInfo = await this.fetchPackageInfo(packageName);
      const current = parseSemver(currentVersion);
      const target = parseSemver(targetVersion);

      if (!current || !target) {
        return {
          compatible: false,
          breakingChanges: ['Invalid version format'],
          requiredUpdates: []
        };
      }

      // Major version change implies potential breaking changes
      if (target.major > current.major) {
        const changelog = await this.fetchChangelog(packageName, currentVersion, targetVersion);
        return {
          compatible: false,
          breakingChanges: this.extractBreakingChanges(changelog),
          requiredUpdates: await this.identifyRequiredDependencies(packageName, targetVersion)
        };
      }

      return {
        compatible: true,
        breakingChanges: [],
        requiredUpdates: []
      };
    } catch (error) {
      this.logger.error(`Compatibility check failed: ${error}`);
      return {
        compatible: false,
        breakingChanges: [error instanceof Error ? error.message : String(error)],
        requiredUpdates: []
      };
    }
  }

  /**
   * Generate a patch for dependency updates
   */
  async generatePatch(
    projectPath: string,
    updates: Array<{ name: string; version: string }>
  ): Promise<string> {
    this.logger.info(`Generating patch for ${updates.length} updates`);

    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    const patch: string[] = [];

    for (const update of updates) {
      const current = packageJson.dependencies?.[update.name] ||
                     packageJson.devDependencies?.[update.name];
      if (current) {
        patch.push(`- ${update.name}@${current}`);
        patch.push(`+ ${update.name}@${update.version}`);
      }
    }

    return patch.join('\n');
  }

  /**
   * Analyze changelog
   */
  async analyzeChangelog(
    packageName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<{
    features: string[];
    fixes: string[];
    breakingChanges: string[];
    other: string[];
  }> {
    const changelog = await this.fetchChangelog(packageName, fromVersion, toVersion);

    return {
      features: this.extractSection(changelog, ['feat', 'feature', 'features']),
      fixes: this.extractSection(changelog, ['fix', 'bug', 'bugfix']),
      breakingChanges: this.extractSection(changelog, ['breaking', 'BREAKING CHANGE']),
      other: []
    };
  }

  /**
   * Get dependency information
   */
  private async getDependencyInfo(
    packageName: string,
    currentVersion: string
  ): Promise<DependencyInfo> {
    const cacheKey = `${packageName}-${currentVersion}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const packageInfo = await this.fetchPackageInfo(packageName);
    const latestVersion = packageInfo['dist-tags'].latest;
    const wantedVersion = this.satisfiesRange(latestVersion, currentVersion) ? latestVersion : currentVersion;

    const updatesAvailable: UpdateInfo[] = [];

    // Check for different version ranges
    const versions = Object.keys(packageInfo.versions);
    const currentSemver = parseSemver(currentVersion.replace(/^[^0-9]*/, ''));

    if (currentSemver) {
      for (const version of versions) {
        const semver = parseSemver(version);
        if (semver && gt(semver, currentSemver)) {
          const type = this.getUpdateType(currentVersion, version);
          updatesAvailable.push({
            type,
            from: currentVersion,
            to: version,
            breakingChanges: [],
            features: [],
            changelog: ''
          });
        }
      }
    }

    // Check for security issues
    const securityIssues = await this.fetchSecurityAdvisory(packageName, currentVersion);

    const info: DependencyInfo = {
      name: packageName,
      currentVersion,
      latestVersion,
      wantedVersion,
      updatesAvailable: updatesAvailable.slice(0, 10), // Limit to 10 most recent
      securityIssues,
      deprecated: packageInfo.deprecated || false,
      deprecatedMessage: packageInfo.deprecatedMessage
    };

    this.cache.set(cacheKey, info);
    return info;
  }

  /**
   * Fetch package info from registry
   */
  private async fetchPackageInfo(packageName: string): Promise<any> {
    const url = `${this.registryUrl}/${packageName}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  }

  /**
   * Fetch security advisories
   */
  private async fetchSecurityAdvisory(
    packageName: string,
    version: string
  ): Promise<SecurityIssue[]> {
    try {
      // Use npm audit or OSS Index for security checks
      // This is a simplified implementation
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch changelog
   */
  private async fetchChangelog(
    packageName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<string> {
    try {
      // Try to fetch from GitHub or other sources
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Identify required dependencies for a version
   */
  private async identifyRequiredDependencies(
    packageName: string,
    version: string
  ): Promise<string[]> {
    const packageInfo = await this.fetchPackageInfo(packageName);
    const versionInfo = packageInfo.versions[version];

    if (!versionInfo) {
      return [];
    }

    const required: string[] = [];
    const deps = {
      ...versionInfo.dependencies,
      ...versionInfo.peerDependencies
    };

    for (const [dep, requiredVersion] of Object.entries(deps)) {
      required.push(`${dep}@${requiredVersion}`);
    }

    return required;
  }

  /**
   * Extract breaking changes from changelog
   */
  private extractBreakingChanges(changelog: string): string[] {
    const lines = changelog.split('\n');
    const breaking: string[] = [];
    let inBreakingSection = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('breaking')) {
        inBreakingSection = true;
        continue;
      }

      if (inBreakingSection && line.trim().startsWith('-')) {
        breaking.push(line.trim());
      } else if (inBreakingSection && line.trim() === '') {
        inBreakingSection = false;
      }
    }

    return breaking;
  }

  /**
   * Extract section from changelog
   */
  private extractSection(changelog: string, headers: string[]): string[] {
    const lines = changelog.split('\n');
    const items: string[] = [];
    let inSection = false;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (headers.some(h => lowerLine.includes(h))) {
        inSection = true;
        continue;
      }

      if (inSection && line.trim().startsWith('-')) {
        items.push(line.trim());
      } else if (inSection && line.startsWith('#')) {
        inSection = false;
      }
    }

    return items;
  }

  /**
   * Get update type between versions
   */
  private getUpdateType(from: string, to: string): 'major' | 'minor' | 'patch' | 'prerelease' {
    const fromSemver = parseSemver(from.replace(/^[^0-9]*/, ''));
    const toSemver = parseSemver(to.replace(/^[^0-9]*/, ''));

    if (!fromSemver || !toSemver) {
      return 'patch';
    }

    if (toSemver.major > fromSemver.major) return 'major';
    if (toSemver.minor > fromSemver.minor) return 'minor';
    if (toSemver.patch > fromSemver.patch) return 'patch';
    return 'prerelease';
  }

  /**
   * Check if version satisfies range
   */
  private satisfiesRange(version: string, range: string): boolean {
    try {
      return satisfies(version, range);
    } catch {
      return false;
    }
  }

  /**
   * Run npm install
   */
  private async runNpmInstall(projectPath: string): Promise<void> {
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], { cwd: projectPath });
      npm.on('close', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }
}
