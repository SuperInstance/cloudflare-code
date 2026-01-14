/**
 * Version Utilities
 */

import { SemanticVersioning } from '../versions/SemanticVersioning.js';
import type {
  SemVer,
  APIVersion,
  APIEndpoint,
  APIContract,
  DeprecationRecord,
  VersionStatus,
} from '../types/index.js';

export class VersionUtils {
  /**
   * Create API version object from version string
   */
  static createAPIVersion(
    version: string,
    options: Partial<APIVersion> = {}
  ): APIVersion {
    const semver = SemanticVersioning.parse(version);

    return {
      version,
      semver,
      status: options.status || VersionStatus.STABLE,
      releasedAt: options.releasedAt || new Date(),
      deprecatedAt: options.deprecatedAt,
      sunsetAt: options.sunsetAt,
      description: options.description || `Version ${version}`,
      breakingChanges: options.breakingChanges || [],
      features: options.features || [],
      deprecations: options.deprecations || [],
    };
  }

  /**
   * Parse version from header
   */
  static parseVersionFromHeader(headerValue: string): string | null {
    // Handle patterns like:
    // - "1.0.0"
    // - "application/vnd.claudeflare.v1.0.0+json"
    // - "version=1.0.0"

    // Direct version
    if (SemanticVersioning.valid(headerValue)) {
      return headerValue;
    }

    // Content-Type pattern
    const vndMatch = headerValue.match(/vnd\.claudeflare\.v(\d+\.\d+\.\d+)/);
    if (vndMatch) {
      return vndMatch[1];
    }

    // Key-value pattern
    const kvMatch = headerValue.match(/version[=:]\s*(\d+\.\d+\.\d+)/);
    if (kvMatch) {
      return kvMatch[1];
    }

    // URL path pattern
    const pathMatch = headerValue.match(/\/v(\d+\.\d+\.\d+)\//);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }

  /**
   * Format version for header
   */
  static formatVersionForHeader(
    version: string,
    format: 'simple' | 'vnd' | 'param' = 'simple'
  ): string {
    switch (format) {
      case 'simple':
        return version;
      case 'vnd':
        return `application/vnd.claudeflare.v${version}+json`;
      case 'param':
        return `version=${version}`;
    }
  }

  /**
   * Get version from URL path
   */
  static extractVersionFromPath(path: string): string | null {
    const patterns = [
      /\/v(\d+\.\d+\.\d+)\//,
      /\/v(\d+\.\d+)\//,
      /\/v(\d+)\//,
      /\/api\/v(\d+\.\d+\.\d+)\//,
      /\/api\/v(\d+\.\d+)\//,
      /\/api\/v(\d+)\//,
    ];

    for (const pattern of patterns) {
      const match = path.match(pattern);
      if (match) {
        // Normalize version
        if (match[1].split('.').length === 1) {
          return `${match[1]}.0.0`;
        } else if (match[1].split('.').length === 2) {
          return `${match[1]}.0`;
        }
        return match[1];
      }
    }

    return null;
  }

  /**
   * Inject version into URL path
   */
  static injectVersionIntoPath(path: string, version: string): string {
    // Remove existing version if present
    const withoutVersion = path.replace(/\/v\d+(\.\d+)?(\.\d+)?\//, '/');

    // Insert version
    const parts = withoutVersion.split('/');
    if (parts[1] === 'api') {
      parts.splice(2, 0, `v${version}`);
    } else {
      parts.splice(1, 0, `v${version}`);
    }

    return parts.join('/');
  }

  /**
   * Calculate next version based on changes
   */
  static calculateNextVersion(
    currentVersion: string,
    changes: {
      breaking?: boolean;
      features?: boolean;
      fixes?: boolean;
    }
  ): string {
    const hasBreaking = changes.breaking || false;
    const hasFeatures = changes.features || false;
    const hasFixes = changes.fixes || false;

    return SemanticVersioning.calculateNextVersion(currentVersion, {
      breaking: hasBreaking,
      features: hasFeatures,
      fixes: hasFixes,
    });
  }

  /**
   * Get version range for compatibility
   */
  static getCompatibleVersionRange(version: string): string {
    const semver = SemanticVersioning.parse(version);
    return `^${semver.major}.${semver.minor}.${semver.patch}`;
  }

  /**
   * Check if two versions are compatible
   */
  static areVersionsCompatible(version1: string, version2: string): boolean {
    const sem1 = SemanticVersioning.parse(version1);
    const sem2 = SemanticVersioning.parse(version2);

    // Same major version means compatible
    return sem1.major === sem2.major;
  }

  /**
   * Get all versions between two versions
   */
  static getVersionsInRange(
    versions: string[],
    minVersion: string,
    maxVersion: string
  ): string[] {
    return SemanticVersioning.getVersionsBetween(versions, minVersion, maxVersion);
  }

  /**
   * Sort versions
   */
  static sortVersions(versions: string[], order: 'asc' | 'desc' = 'asc'): string[] {
    const sorted = SemanticVersioning.sort(versions);
    return order === 'desc' ? sorted.reverse() : sorted;
  }

  /**
   * Get latest version
   */
  static getLatestVersion(versions: string[]): string | null {
    const sorted = SemanticVersioning.sort(versions);
    return sorted.length > 0 ? sorted[sorted.length - 1] : null;
  }

  /**
   * Get oldest version
   */
  static getOldestVersion(versions: string[]): string | null {
    const sorted = SemanticVersioning.sort(versions);
    return sorted.length > 0 ? sorted[0] : null;
  }

  /**
   * Format version for display
   */
  static formatVersionForDisplay(version: string, style: 'full' | 'short' | 'major' = 'full'): string {
    const semver = SemanticVersioning.parse(version);

    switch (style) {
      case 'full':
        return `v${version}`;
      case 'short':
        return `v${semver.major}.${semver.minor}`;
      case 'major':
        return `v${semver.major}`;
    }
  }

  /**
   * Parse version range
   */
  static parseVersionRange(range: string): {
    minVersion: string | null;
    maxVersion: string | null;
    versions: string[];
  } {
    const versions = range.split(',').map(v => v.trim());
    const sorted = SemanticVersioning.sort(versions.filter(v => SemanticVersioning.valid(v)));

    return {
      minVersion: sorted[0] || null,
      maxVersion: sorted[sorted.length - 1] || null,
      versions: sorted,
    };
  }

  /**
   * Compare version status priority
   */
  static compareStatusPriority(status1: VersionStatus, status2: VersionStatus): number {
    const priority: Record<VersionStatus, number> = {
      [VersionStatus.STABLE]: 5,
      [VersionStatus.BETA]: 4,
      [VersionStatus.ALPHA]: 3,
      [VersionStatus.DEPRECATED]: 2,
      [VersionStatus.SUNSET]: 1,
      [VersionStatus.RETIRED]: 0,
      [VersionStatus.DEVELOPMENT]: -1,
    };

    return priority[status1] - priority[status2];
  }

  /**
   * Get stable versions only
   */
  static getStableVersions(versions: APIVersion[]): APIVersion[] {
    return versions.filter(v => v.status === VersionStatus.STABLE);
  }

  /**
   * Get active versions (not sunset or retired)
   */
  static getActiveVersions(versions: APIVersion[]): APIVersion[] {
    return versions.filter(
      v =>
        v.status !== VersionStatus.SUNSET && v.status !== VersionStatus.RETIRED
    );
  }

  /**
   * Filter versions by status
   */
  static filterVersionsByStatus(versions: APIVersion[], status: VersionStatus): APIVersion[] {
    return versions.filter(v => v.status === status);
  }

  /**
   * Get version lifecycle info
   */
  static getVersionLifecycle(version: APIVersion): {
    phase: 'development' | 'testing' | 'stable' | 'deprecated' | 'sunset' | 'retired';
    daysInPhase: number;
    daysUntilSunset?: number;
  } {
    const now = new Date();
    let phase: 'development' | 'testing' | 'stable' | 'deprecated' | 'sunset' | 'retired';
    let daysInPhase = 0;

    switch (version.status) {
      case VersionStatus.DEVELOPMENT:
        phase = 'development';
        daysInPhase = this.getDaysSince(version.releasedAt);
        break;
      case VersionStatus.ALPHA:
      case VersionStatus.BETA:
        phase = 'testing';
        daysInPhase = this.getDaysSince(version.releasedAt);
        break;
      case VersionStatus.STABLE:
        phase = 'stable';
        daysInPhase = this.getDaysSince(version.releasedAt);
        break;
      case VersionStatus.DEPRECATED:
        phase = 'deprecated';
        daysInPhase = version.deprecatedAt ? this.getDaysSince(version.deprecatedAt) : 0;
        break;
      case VersionStatus.SUNSET:
        phase = 'sunset';
        daysInPhase = version.sunsetAt ? this.getDaysSince(version.sunsetAt) : 0;
        break;
      case VersionStatus.RETIRED:
        phase = 'retired';
        daysInPhase = version.sunsetAt ? this.getDaysSince(version.sunsetAt) : 0;
        break;
    }

    const daysUntilSunset = version.sunsetAt
      ? Math.max(0, this.getDaysUntil(version.sunsetAt))
      : undefined;

    return {
      phase,
      daysInPhase,
      daysUntilSunset,
    };
  }

  /**
   * Get days since date
   */
  static getDaysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days until date
   */
  static getDaysUntil(date: Date): number {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Clone API version
   */
  static cloneAPIVersion(version: APIVersion): APIVersion {
    return {
      ...version,
      semver: { ...version.semver },
      breakingChanges: [...version.breakingChanges],
      features: [...version.features],
      deprecations: version.deprecations.map(d => ({ ...d })),
    };
  }

  /**
   * Merge API versions
   */
  static mergeAPIVersions(base: APIVersion, update: Partial<APIVersion>): APIVersion {
    return {
      ...base,
      ...update,
      semver: update.semver || base.semver,
      breakingChanges: update.breakingChanges || base.breakingChanges,
      features: update.features || base.features,
      deprecations: update.deprecations || base.deprecations,
    };
  }

  /**
   * Serialize API version
   */
  static serializeAPIVersion(version: APIVersion): string {
    return JSON.stringify({
      ...version,
      releasedAt: version.releasedAt.toISOString(),
      deprecatedAt: version.deprecatedAt?.toISOString(),
      sunsetAt: version.sunsetAt?.toISOString(),
      deprecations: version.deprecations.map(d => ({
        ...d,
        deprecationDate: d.deprecationDate.toISOString(),
        sunsetDate: d.sunsetDate.toISOString(),
      })),
    });
  }

  /**
   * Deserialize API version
   */
  static deserializeAPIVersion(data: string): APIVersion {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      releasedAt: new Date(parsed.releasedAt),
      deprecatedAt: parsed.deprecatedAt ? new Date(parsed.deprecatedAt) : undefined,
      sunsetAt: parsed.sunsetAt ? new Date(parsed.sunsetAt) : undefined,
      deprecations: parsed.deprecations.map((d: any) => ({
        ...d,
        deprecationDate: new Date(d.deprecationDate),
        sunsetDate: new Date(d.sunsetDate),
      })),
    };
  }

  /**
   * Validate version string
   */
  static isValidVersionString(version: string): boolean {
    return SemanticVersioning.validate(version);
  }

  /**
   * Normalize version string
   */
  static normalizeVersionString(version: string): string | null {
    return SemanticVersioning.clean(version);
  }

  /**
   * Increment version
   */
  static incrementVersion(
    version: string,
    type: 'major' | 'minor' | 'patch'
  ): string {
    return SemanticVersioning.increment(version, type);
  }

  /**
   * Compare versions
   */
  static compareVersions(version1: string, version2: string): number {
    return SemanticVersioning.compare(version1, version2);
  }

  /**
   * Get version diff type
   */
  static getVersionDiff(version1: string, version2: string): 'major' | 'minor' | 'patch' | 'equal' {
    return SemanticVersioning.diff(version1, version2) || 'equal';
  }

  /**
   * Generate version identifier
   */
  static generateVersionId(base: string, unique: boolean = true): string {
    if (!unique) return base;
    return `${base}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get version hash
   */
  static getVersionHash(version: string): string {
    let hash = 0;
    for (let i = 0; i < version.length; i++) {
      const char = version.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if version needs update
   */
  static needsUpdate(currentVersion: string, latestVersion: string): boolean {
    return SemanticVersioning.gt(latestVersion, currentVersion);
  }

  /**
   * Get version suggestions
   */
  static getVersionSuggestions(
    currentVersion: string,
    availableVersions: string[]
  ): {
    patch: string | null;
    minor: string | null;
    major: string | null;
    latest: string | null;
  } {
    const sorted = SemanticVersioning.sort(availableVersions);
    const current = SemanticVersioning.parse(currentVersion);

    const patch = sorted
      .filter(v => {
        const s = SemanticVersioning.parse(v);
        return s.major === current.major && s.minor === current.minor && s.patch > current.patch;
      })
      .sort((a, b) => SemanticVersioning.compare(a, b))
      .pop() || null;

    const minor = sorted
      .filter(v => {
        const s = SemanticVersioning.parse(v);
        return s.major === current.major && s.minor > current.minor;
      })
      .sort((a, b) => SemanticVersioning.compare(a, b))
      .pop() || null;

    const major = sorted
      .filter(v => {
        const s = SemanticVersioning.parse(v);
        return s.major > current.major;
      })
      .sort((a, b) => SemanticVersioning.compare(a, b))
      .pop() || null;

    const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    return { patch, minor, major, latest };
  }

  /**
   * Format version for logging
   */
  static formatForLogging(version: APIVersion): string {
    return `[${version.version}] ${version.status} - ${version.description}`;
  }

  /**
   * Create version summary
   */
  static createVersionSummary(versions: APIVersion[]): {
    total: number;
    byStatus: Record<VersionStatus, number>;
    latest: string | null;
    oldest: string | null;
    active: number;
    deprecated: number;
  } {
    const byStatus: Record<VersionStatus, number> = {
      [VersionStatus.DEVELOPMENT]: 0,
      [VersionStatus.ALPHA]: 0,
      [VersionStatus.BETA]: 0,
      [VersionStatus.STABLE]: 0,
      [VersionStatus.DEPRECATED]: 0,
      [VersionStatus.SUNSET]: 0,
      [VersionStatus.RETIRED]: 0,
    };

    for (const version of versions) {
      byStatus[version.status]++;
    }

    const sorted = SemanticVersioning.sort(versions.map(v => v.version));

    return {
      total: versions.length,
      byStatus,
      latest: sorted.length > 0 ? sorted[sorted.length - 1] : null,
      oldest: sorted.length > 0 ? sorted[0] : null,
      active: versions.filter(v => this.getVersionLifecycle(v).phase !== 'retired').length,
      deprecated: versions.filter(v => v.status === VersionStatus.DEPRECATED).length,
    };
  }
}
