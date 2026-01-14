/**
 * Dependency Update Management
 *
 * This module provides comprehensive dependency update capabilities:
 * - Version checking against npm registry
 * - Update recommendations with semantic analysis
 * - Compatibility analysis
 * - Breaking change detection
 * - Update automation
 * - Changelog tracking
 * - Security updates prioritization
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import semver from 'semver';

import type {
  DependencyUpdate,
  PackageMetadata,
  AnalyzerConfig,
  VersionRange,
  CompatibilityResult,
} from '../types/index.js';

/**
 * Update check result
 */
interface UpdateCheckResult {
  updates: DependencyUpdate[];
  summary: {
    total: number;
    major: number;
    minor: number;
    patch: number;
    security: number;
  };
}

/**
 * Registry package info
 */
interface RegistryPackageInfo {
  'dist-tags': {
    latest: string;
    next?: string;
    [tag: string]: string;
  };
  versions: Record<string, VersionData>;
  time: Record<string, string>;
  deprecated?: Record<string, string>;
}

/**
 * Version data from registry
 */
interface VersionData {
  version: string;
  deprecated?: string;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  _hasShrinkwrap?: boolean;
  _nodeVersion?: string;
}

/**
 * Update Manager
 */
export class UpdateManager {
  private config: AnalyzerConfig;
  private cache: Map<string, RegistryPackageInfo>;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Check for available updates
   */
  async checkUpdates(): Promise<UpdateCheckResult> {
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

    const updates: DependencyUpdate[] = [];

    for (const [name, currentVersion] of Object.entries(allDeps)) {
      try {
        const update = await this.checkPackageUpdate(name, currentVersion as string);
        if (update) {
          updates.push(update);
        }
      } catch (error) {
        console.warn(`Failed to check updates for ${name}:`, error);
      }
    }

    const summary = this.generateUpdateSummary(updates);

    return { updates, summary };
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
   * Check update for a single package
   */
  async checkPackageUpdate(name: string, currentVersion: string): Promise<DependencyUpdate | null> {
    const info = await this.fetchPackageInfo(name);

    const latestVersion = info['dist-tags'].latest;
    const nextVersion = info['dist-tags'].next;

    // Calculate wanted version based on semver range
    const wantedVersion = this.calculateWantedVersion(currentVersion, info);

    // Determine update type
    const updateType = this.getUpdateType(currentVersion, latestVersion);

    // If already on latest, no update needed
    if (semver.eq(currentVersion, latestVersion) && !wantedVersion) {
      return null;
    }

    // Check for deprecation
    const deprecated = this.isDeprecated(currentVersion, info);

    // Check for breaking changes
    const breaking = this.hasBreakingChanges(currentVersion, latestVersion, info);

    return {
      name,
      currentVersion,
      latestVersion,
      wantedVersion: wantedVersion || latestVersion,
      type: updateType,
      deprecated,
      breaking,
    };
  }

  /**
   * Fetch package info from npm registry
   */
  private async fetchPackageInfo(name: string): Promise<RegistryPackageInfo> {
    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const response = await fetch(`https://registry.npmjs.org/${name}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch package info for ${name}`);
    }

    const info: RegistryPackageInfo = await response.json();
    this.cache.set(name, info);

    return info;
  }

  /**
   * Calculate wanted version based on semver range
   */
  private calculateWantedVersion(currentVersion: string, info: RegistryPackageInfo): string | null {
    const versions = Object.keys(info.versions).sort(semver.rcompare);

    for (const version of versions) {
      if (semver.satisfies(version, currentVersion)) {
        return version;
      }
    }

    return null;
  }

  /**
   * Get update type (major, minor, patch)
   */
  private getUpdateType(current: string, latest: string): DependencyUpdate['type'] {
    if (semver.major(current) !== semver.major(latest)) {
      return 'major';
    } else if (semver.minor(current) !== semver.minor(latest)) {
      return 'minor';
    } else if (semver.patch(current) !== semver.patch(latest)) {
      return 'patch';
    } else if (latest.includes('-')) {
      return 'prerelease';
    } else {
      return 'major-next';
    }
  }

  /**
   * Check if version is deprecated
   */
  private isDeprecated(version: string, info: RegistryPackageInfo): boolean {
    const versionData = info.versions[version];
    return !!versionData?.deprecated;
  }

  /**
   * Check if update has breaking changes
   */
  private hasBreakingChanges(current: string, latest: string, info: RegistryPackageInfo): boolean {
    const currentMajor = semver.major(current);
    const latestMajor = semver.major(latest);

    // Major version changes typically have breaking changes
    if (latestMajor > currentMajor) {
      return true;
    }

    return false;
  }

  /**
   * Generate update summary
   */
  private generateUpdateSummary(updates: DependencyUpdate[]): UpdateCheckResult['summary'] {
    return {
      total: updates.length,
      major: updates.filter((u) => u.type === 'major').length,
      minor: updates.filter((u) => u.type === 'minor').length,
      patch: updates.filter((u) => u.type === 'patch').length,
      security: updates.filter((u) => u.deprecated).length,
    };
  }

  /**
   * Get changelog for a package
   */
  async getChangelog(name: string, fromVersion: string, toVersion: string): Promise<string> {
    try {
      // Try to fetch from GitHub releases
      const packageInfo = await this.fetchPackageInfo(name);
      const repo = packageInfo.versions[toVersion]?.repository;

      if (repo && typeof repo === 'string' && repo.includes('github')) {
        const match = repo.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          const [, owner, repoName] = match;
          return this.fetchGitHubChangelog(owner, repoName, fromVersion, toVersion);
        }
      }

      return `Changelog for ${name} from ${fromVersion} to ${toVersion}`;
    } catch (error) {
      return `Could not fetch changelog for ${name}`;
    }
  }

  /**
   * Fetch changelog from GitHub
   */
  private async fetchGitHubChangelog(
    owner: string,
    repo: string,
    fromVersion: string,
    toVersion: string
  ): Promise<string> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch releases');
      }

      const releases = await response.json();
      const changelog: string[] = [];

      for (const release of releases) {
        const version = release.tag_name.replace(/^v/, '');
        if (
          semver.valid(version) &&
          semver.gt(version, fromVersion) &&
          semver.lte(version, toVersion)
        ) {
          changelog.push(`## ${version}\n\n${release.body || ''}`);
        }
      }

      return changelog.join('\n\n') || 'No changelog available';
    } catch (error) {
      return `Could not fetch changelog from GitHub`;
    }
  }

  /**
   * Analyze compatibility of updates
   */
  async analyzeCompatibility(
    updates: DependencyUpdate[]
  ): Promise<Map<string, CompatibilityResult>> {
    const results = new Map<string, CompatibilityResult>();

    for (const update of updates) {
      const result = await this.checkUpdateCompatibility(update);
      results.set(update.name, result);
    }

    return results;
  }

  /**
   * Check compatibility of a single update
   */
  private async checkUpdateCompatibility(update: DependencyUpdate): Promise<CompatibilityResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for breaking changes
    if (update.breaking) {
      issues.push(
        `Major version update from ${update.currentVersion} to ${update.latestVersion} may contain breaking changes`
      );
      recommendations.push(
        'Review the changelog and breaking changes before updating'
      );
    }

    // Check for deprecation
    if (update.deprecated) {
      warnings.push(`Current version ${update.currentVersion} is deprecated`);
      recommendations.push('Update to the latest version as soon as possible');
    }

    // Check peer dependencies
    if (update.type === 'major') {
      warnings.push(
        'Major updates may require updating related dependencies'
      );
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Generate update recommendations
   */
  generateRecommendations(updates: DependencyUpdate[]): Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
  }> {
    const recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      action: string;
      reason: string;
    }> = [];

    // High priority: deprecated packages
    for (const update of updates.filter((u) => u.deprecated)) {
      recommendations.push({
        priority: 'high',
        action: `Update ${update.name} to ${update.latestVersion}`,
        reason: `Current version ${update.currentVersion} is deprecated`,
      });
    }

    // High priority: security updates (would need security integration)
    // Medium priority: major updates
    for (const update of updates.filter((u) => u.type === 'major')) {
      recommendations.push({
        priority: 'medium',
        action: `Update ${update.name} to ${update.latestVersion}`,
        reason: `Major version update available from ${update.currentVersion} to ${update.latestVersion}`,
      });
    }

    // Low priority: minor and patch updates
    for (const update of updates.filter((u) => u.type === 'minor' || u.type === 'patch')) {
      recommendations.push({
        priority: 'low',
        action: `Update ${update.name} to ${update.latestVersion}`,
        reason: `${update.type === 'minor' ? 'Minor' : 'Patch'} update available`,
      });
    }

    return recommendations;
  }
}

/**
 * Automated Updater
 */
export class AutomatedUpdater {
  /**
   * Automatically update package.json
   */
  static async updatePackageJson(
    projectPath: string,
    updates: DependencyUpdate[],
    options: {
      type?: 'major' | 'minor' | 'patch' | 'all';
      dryRun?: boolean;
    } = {}
  ): Promise<{ updated: string[]; skipped: string[] }> {
    const packageJsonPath = join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    const updated: string[] = [];
    const skipped: string[] = [];

    for (const update of updates) {
      // Skip if type doesn't match filter
      if (
        options.type &&
        options.type !== 'all' &&
        update.type !== options.type
      ) {
        skipped.push(update.name);
        continue;
      }

      // Update in dependencies
      if (packageJson.dependencies?.[update.name]) {
        packageJson.dependencies[update.name] = update.wantedVersion;
        updated.push(update.name);
        continue;
      }

      // Update in devDependencies
      if (packageJson.devDependencies?.[update.name]) {
        packageJson.devDependencies[update.name] = update.wantedVersion;
        updated.push(update.name);
        continue;
      }

      skipped.push(update.name);
    }

    // Write back if not dry run
    if (!options.dryRun && updated.length > 0) {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n',
        'utf-8'
      );
    }

    return { updated, skipped };
  }
}

/**
 * Version History Tracker
 */
export class VersionHistoryTracker {
  private history: Map<string, Array<{ version: string; date: Date }>> = new Map();

  /**
   * Record version update
   */
  record(name: string, version: string): void {
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }

    this.history.get(name)!.push({
      version,
      date: new Date(),
    });
  }

  /**
   * Get version history for a package
   */
  getHistory(name: string): Array<{ version: string; date: Date }> {
    return this.history.get(name) || [];
  }

  /**
   * Get version trend
   */
  getTrend(name: string): 'stable' | 'increasing' | 'decreasing' | 'unknown' {
    const history = this.getHistory(name);
    if (history.length < 2) {
      return 'unknown';
    }

    const versions = history.map((h) => h.version);
    const majorChanges = versions.filter((v, i) => {
      if (i === 0) return false;
      return semver.major(v) > semver.major(versions[i - 1]);
    }).length;

    if (majorChanges === 0) {
      return 'stable';
    } else if (majorChanges > versions.length / 2) {
      return 'increasing';
    } else {
      return 'decreasing';
    }
  }
}
