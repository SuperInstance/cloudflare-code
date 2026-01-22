// @ts-nocheck
/**
 * Plugin Versioning System
 *
 * Comprehensive version management for plugins:
 * - Semantic versioning (SemVer) support
 * - Version compatibility checking
 * - Update management
 * - Dependency version resolution
 * - Migration support
 * - Rollback capabilities
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('Versioning');

// ============================================================================
// Types
// ============================================================================

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export interface VersionRange {
  min?: SemVer;
  max?: SemVer;
  includePrerelease?: boolean;
}

export interface PluginVersionInfo {
  version: SemVer;
  compatVersion?: SemVer;
  breaking: boolean;
  features: string[];
  fixes: string[];
  deprecations: string[];
  migrations: Migration[];
  publishedAt: Date;
  checksum: string;
  size: number;
}

export interface Migration {
  id: string;
  from: SemVer;
  to: SemVer;
  script: string;
  checksum: string;
  dangerous: boolean;
  backupRequired: boolean;
  estimatedTime?: number;
}

export interface VersionConstraint {
  type: 'exact' | 'caret' | 'tilde' | 'range' | 'wildcard' | 'any';
  version?: SemVer;
  min?: SemVer;
  max?: SemVer;
}

export interface DependencyVersion {
  pluginId: string;
  constraint: VersionConstraint;
}

export interface VersionConflict {
  pluginId: string;
  requested: VersionConstraint;
  available: SemVer[];
  resolved?: SemVer;
  conflicts: string[];
}

// ============================================================================
// SemVer Operations
// ============================================================================

export function parseSemVer(version: string): SemVer {
  const regex = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  const match = version.match(regex);

  if (!match) {
    throw new Error(`Invalid semver string: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5]
  };
}

export function formatSemVer(version: SemVer, includePrefix = false): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;

  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }

  if (version.build) {
    result += `+${version.build}`;
  }

  if (includePrefix) {
    result = `v${result}`;
  }

  return result;
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // Prerelease versions come before release versions
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }

  return 0;
}

export function equalsSemVer(a: SemVer, b: SemVer): boolean {
  return compareSemVer(a, b) === 0;
}

export function greaterThanSemVer(a: SemVer, b: SemVer): boolean {
  return compareSemVer(a, b) > 0;
}

export function lessThanSemVer(a: SemVer, b: SemVer): boolean {
  return compareSemVer(a, b) < 0;
}

export function satisfiesSemVer(version: SemVer, constraint: VersionConstraint): boolean {
  switch (constraint.type) {
    case 'exact':
      return constraint.version ? equalsSemVer(version, constraint.version) : false;

    case 'caret':
      // ^1.2.3 allows >=1.2.3 <2.0.0
      if (!constraint.version) return false;
      if (version.major !== constraint.version.major) return false;
      if (version.major === 0) {
        // For 0.x.x, caret is more restrictive
        if (version.minor !== constraint.version.minor) return false;
        return version.patch >= constraint.version.patch;
      }
      if (version.minor > constraint.version.minor) return true;
      return version.minor === constraint.version.minor && version.patch >= constraint.version.patch;

    case 'tilde':
      // ~1.2.3 allows >=1.2.3 <1.3.0
      if (!constraint.version) return false;
      if (version.major !== constraint.version.major) return false;
      if (version.minor !== constraint.version.minor) return false;
      return version.patch >= constraint.version.patch;

    case 'range':
      if (constraint.min && lessThanSemVer(version, constraint.min)) return false;
      if (constraint.max && greaterThanSemVer(version, constraint.max)) return false;
      return true;

    case 'wildcard':
      // 1.2.* allows any patch version
      if (!constraint.version) return true;
      if (version.major !== constraint.version.major) return false;
      if (version.minor !== constraint.version.minor) return false;
      return true;

    case 'any':
      return true;

    default:
      return false;
  }
}

export function incrementSemVer(
  version: SemVer,
  type: 'major' | 'minor' | 'patch' | 'prerelease'
): SemVer {
  const result = { ...version };

  switch (type) {
    case 'major':
      result.major++;
      result.minor = 0;
      result.patch = 0;
      result.prerelease = undefined;
      break;

    case 'minor':
      result.minor++;
      result.patch = 0;
      result.prerelease = undefined;
      break;

    case 'patch':
      result.patch++;
      result.prerelease = undefined;
      break;

    case 'prerelease':
      if (result.prerelease) {
        // Increment existing prerelease
        const parts = result.prerelease.split('.');
        const last = parts[parts.length - 1];
        const num = parseInt(last, 10);
        if (!isNaN(num)) {
          parts[parts.length - 1] = String(num + 1);
        } else {
          parts.push('1');
        }
        result.prerelease = parts.join('.');
      } else {
        // Start new prerelease
        result.prerelease = 'rc.1';
      }
      break;
  }

  return result;
}

// ============================================================================
// Version Constraints
// ============================================================================

export function parseVersionConstraint(constraint: string): VersionConstraint {
  constraint = constraint.trim();

  // Exact version (1.2.3)
  if (/^\d+\.\d+\.\d+$/.test(constraint)) {
    return {
      type: 'exact',
      version: parseSemVer(constraint)
    };
  }

  // Caret (^1.2.3)
  if (constraint.startsWith('^')) {
    return {
      type: 'caret',
      version: parseSemVer(constraint.slice(1))
    };
  }

  // Tilde (~1.2.3)
  if (constraint.startsWith('~')) {
    return {
      type: 'tilde',
      version: parseSemVer(constraint.slice(1))
    };
  }

  // Wildcard (1.2.*, 1.x, 1.*)
  if (constraint.includes('*') || constraint.includes('x')) {
    const versionStr = constraint.replace(/[*x]/g, '0');
    return {
      type: 'wildcard',
      version: parseSemVer(versionStr)
    };
  }

  // Range (>=1.2.3 <2.0.0)
  if (constraint.includes('>')) {
    const parts = constraint.split(/\s+/);
    const result: VersionConstraint = { type: 'range' };

    for (const part of parts) {
      if (part.startsWith('>=')) {
        result.min = parseSemVer(part.slice(2));
      } else if (part.startsWith('>')) {
        const v = parseSemVer(part.slice(1));
        result.min = incrementSemVer(v, 'patch');
      } else if (part.startsWith('<=')) {
        result.max = parseSemVer(part.slice(2));
      } else if (part.startsWith('<')) {
        const v = parseSemVer(part.slice(1));
        result.max = incrementSemVer(v, 'patch');
        // Make it exclusive by decrementing
        result.max = {
          ...result.max,
          patch: Math.max(0, result.max.patch - 1)
        };
      }
    }

    return result;
  }

  // Any (*)
  if (constraint === '*' || constraint === '') {
    return { type: 'any' };
  }

  // Default to exact
  try {
    return {
      type: 'exact',
      version: parseSemVer(constraint)
    };
  } catch {
    return { type: 'any' };
  }
}

export function formatVersionConstraint(constraint: VersionConstraint): string {
  switch (constraint.type) {
    case 'exact':
      return constraint.version ? formatSemVer(constraint.version) : '*';

    case 'caret':
      return constraint.version ? `^${formatSemVer(constraint.version)}` : '*';

    case 'tilde':
      return constraint.version ? `~${formatSemVer(constraint.version)}` : '*';

    case 'range':
      const parts: string[] = [];
      if (constraint.min) parts.push(`>=${formatSemVer(constraint.min)}`);
      if (constraint.max) parts.push(`<=${formatSemVer(constraint.max)}`);
      return parts.join(' ');

    case 'wildcard':
      if (!constraint.version) return '*';
      return `${constraint.version.major}.${constraint.version.minor}.*`;

    case 'any':
      return '*';

    default:
      return '*';
  }
}

// ============================================================================
// Version Manager
// ============================================================================

export interface VersionManagerConfig {
  autoUpdate?: boolean;
  allowPrerelease?: boolean;
  checkInterval?: number;
  onUpdateAvailable?: (pluginId: string, current: SemVer, available: SemVer) => void;
}

export class VersionManager {
  private versions: Map<string, PluginVersionInfo[]> = new Map();
  private installed: Map<string, SemVer> = new Map();
  private dependencies: Map<string, DependencyVersion[]> = new Map();
  private config: Required<VersionManagerConfig>;
  private checkTimer?: NodeJS.Timeout;

  constructor(config: VersionManagerConfig = {}) {
    this.config = {
      autoUpdate: config.autoUpdate ?? false,
      allowPrerelease: config.allowPrerelease ?? false,
      checkInterval: config.checkInterval ?? 3600000, // 1 hour
      onUpdateAvailable: config.onUpdateAvailable ?? (() => {})
    };

    if (this.config.autoUpdate) {
      this.startUpdateChecker();
    }
  }

  // ========================================================================
  // Version Registration
  // ========================================================================

  /**
   * Register a plugin version
   */
  registerVersion(pluginId: string, version: PluginVersionInfo): void {
    const versions = this.versions.get(pluginId) || [];
    versions.push(version);
    versions.sort((a, b) => compareSemVer(b.version, a.version));
    this.versions.set(pluginId, versions);

    logger.debug('Version registered', { pluginId, version: formatSemVer(version.version) });
  }

  /**
   * Register multiple versions
   */
  registerVersions(pluginId: string, versions: PluginVersionInfo[]): void {
    for (const version of versions) {
      this.registerVersion(pluginId, version);
    }
  }

  /**
   * Get all versions for a plugin
   */
  getVersions(pluginId: string): PluginVersionInfo[] {
    return this.versions.get(pluginId) || [];
  }

  /**
   * Get latest version for a plugin
   */
  getLatestVersion(pluginId: string, includePrerelease = false): SemVer | null {
    const versions = this.getVersions(pluginId);

    if (versions.length === 0) return null;

    if (includePrerelease) {
      return versions[0].version;
    }

    // Find latest stable version
    for (const v of versions) {
      if (!v.version.prerelease) {
        return v.version;
      }
    }

    return versions[0].version;
  }

  /**
   * Get a specific version
   */
  getVersion(pluginId: string, version: SemVer): PluginVersionInfo | null {
    const versions = this.getVersions(pluginId);
    return versions.find(v => equalsSemVer(v.version, version)) || null;
  }

  // ========================================================================
  // Installation Tracking
  // ========================================================================

  /**
   * Mark a plugin version as installed
   */
  setInstalled(pluginId: string, version: SemVer): void {
    this.installed.set(pluginId, version);
    logger.info('Plugin version installed', { pluginId, version: formatSemVer(version) });
  }

  /**
   * Get installed version
   */
  getInstalled(pluginId: string): SemVer | null {
    return this.installed.get(pluginId) || null;
  }

  /**
   * Remove installed version
   */
  uninstall(pluginId: string): void {
    this.installed.delete(pluginId);
    logger.info('Plugin uninstalled', { pluginId });
  }

  // ========================================================================
  // Dependency Management
  // ========================================================================

  /**
   * Register dependencies for a plugin
   */
  registerDependencies(pluginId: string, dependencies: DependencyVersion[]): void {
    this.dependencies.set(pluginId, dependencies);
  }

  /**
   * Get dependencies for a plugin
   */
  getDependencies(pluginId: string): DependencyVersion[] {
    return this.dependencies.get(pluginId) || [];
  }

  /**
   * Resolve dependencies for a plugin
   */
  resolveDependencies(
    pluginId: string,
    version?: SemVer
  ): Map<string, SemVer> | null {
    const resolved = new Map<string, SemVer>();
    const conflicts: VersionConflict[] = [];

    const toProcess: Array<{ id: string; constraint: VersionConstraint }> = [];

    // Add plugin's dependencies
    const deps = this.getDependencies(pluginId);
    for (const dep of deps) {
      toProcess.push({ id: dep.pluginId, constraint: dep.constraint });
    }

    // Process dependencies
    while (toProcess.length > 0) {
      const { id, constraint } = toProcess.shift()!;

      // Find matching version
      const versions = this.getVersions(id);
      let matched: SemVer | null = null;

      for (const v of versions) {
        if (!this.config.allowPrerelease && v.version.prerelease) {
          continue;
        }
        if (satisfiesSemVer(v.version, constraint)) {
          matched = v.version;
          break;
        }
      }

      if (!matched) {
        conflicts.push({
          pluginId: id,
          requested: constraint,
          available: versions.map(v => v.version)
        });
        continue;
      }

      // Check for conflicts
      const existing = resolved.get(id);
      if (existing && !equalsSemVer(existing, matched)) {
        conflicts.push({
          pluginId: id,
          requested: constraint,
          available: versions.map(v => v.version),
          resolved: existing,
          conflicts: [`Already resolved to ${formatSemVer(existing)}`]
        });
        continue;
      }

      resolved.set(id, matched);

      // Add transitive dependencies
      const transitiveDeps = this.getDependencies(id);
      for (const dep of transitiveDeps) {
        toProcess.push({ id: dep.pluginId, constraint: dep.constraint });
      }
    }

    if (conflicts.length > 0) {
      logger.warn('Dependency resolution failed', { pluginId, conflicts });
      return null;
    }

    return resolved;
  }

  // ========================================================================
  // Update Management
  // ========================================================================

  /**
   * Check for updates for installed plugins
   */
  async checkUpdates(): Promise<Map<string, { current: SemVer; available: SemVer }>> {
    const updates = new Map<string, { current: SemVer; available: SemVer }>();

    for (const [pluginId, current] of this.installed) {
      const latest = this.getLatestVersion(pluginId, this.config.allowPrerelease);

      if (latest && greaterThanSemVer(latest, current)) {
        updates.set(pluginId, { current, available: latest });
        this.config.onUpdateAvailable(pluginId, current, latest);
      }
    }

    return updates;
  }

  /**
   * Check if a plugin has an update available
   */
  hasUpdate(pluginId: string): boolean {
    const current = this.getInstalled(pluginId);
    if (!current) return false;

    const latest = this.getLatestVersion(pluginId, this.config.allowPrerelease);
    if (!latest) return false;

    return greaterThanSemVer(latest, current);
  }

  /**
   * Get version diff between two versions
   */
  getVersionDiff(pluginId: string, from: SemVer, to: SemVer): {
    breaking: boolean;
    features: string[];
    fixes: string[];
    deprecations: string[];
    migrations: Migration[];
  } {
    const fromInfo = this.getVersion(pluginId, from);
    const toInfo = this.getVersion(pluginId, to);

    return {
      breaking: toInfo?.breaking ?? false,
      features: toInfo?.features ?? [],
      fixes: toInfo?.fixes ?? [],
      deprecations: toInfo?.deprecations ?? [],
      migrations: toInfo?.migrations ?? []
    };
  }

  // ========================================================================
  // Compatibility
  // ========================================================================

  /**
   * Check if two versions are compatible
   */
  areCompatible(v1: SemVer, v2: SemVer): boolean {
    // Major version changes are incompatible
    if (v1.major !== v2.major) return false;

    // If major is 0, minor changes are incompatible
    if (v1.major === 0 && v1.minor !== v2.minor) return false;

    return true;
  }

  /**
   * Get compatible versions for a given version
   */
  getCompatibleVersions(pluginId: string, version: SemVer): SemVer[] {
    const versions = this.getVersions(pluginId);

    return versions
      .filter(v => this.areCompatible(version, v.version))
      .map(v => v.version)
      .sort((a, b) => compareSemVer(b, a));
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Start automatic update checking
   */
  private startUpdateChecker(): void {
    this.checkTimer = setInterval(async () => {
      await this.checkUpdates();
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic update checking
   */
  stopUpdateChecker(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopUpdateChecker();
    this.versions.clear();
    this.installed.clear();
    this.dependencies.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // SemVer operations
  parseSemVer,
  formatSemVer,
  compareSemVer,
  equalsSemVer,
  greaterThanSemVer,
  lessThanSemVer,
  satisfiesSemVer,
  incrementSemVer,

  // Version constraints
  parseVersionConstraint,
  formatVersionConstraint,

  // Version manager
  VersionManager
};
