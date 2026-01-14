/**
 * Semantic Versioning utilities and helpers
 */

import { SemVer, Range as SemVerRange, compare, satisfies, minVersion, maxVersion, valid } from 'semver';
import { VersionComparison, SemVer as SemVerType } from '../types/index.js';

export class SemanticVersioning {
  /**
   * Parse version string to SemVer object
   */
  static parse(version: string): SemVerType {
    const semver = new SemVer(version);
    return {
      major: semver.major,
      minor: semver.minor,
      patch: semver.patch,
      prerelease: semver.prerelease.length ? semver.prerelease : undefined,
      build: semver.build.length ? semver.build : undefined,
    };
  }

  /**
   * Format SemVer object to string
   */
  static format(semver: SemVerType): string {
    const base = `${semver.major}.${semver.minor}.${semver.patch}`;
    const prerelease = semver.prerelease && semver.prerelease.length ? `-${semver.prerelease.join('.')}` : '';
    const build = semver.build && semver.build.length ? `+${semver.build.join('.')}` : '';
    return base + prerelease + build;
  }

  /**
   * Compare two versions
   */
  static compare(version1: string, version2: string): number {
    return compare(version1, version2);
  }

  /**
   * Check if version1 is greater than version2
   */
  static gt(version1: string, version2: string): boolean {
    return compare(version1, version2) > 0;
  }

  /**
   * Check if version1 is greater than or equal to version2
   */
  static gte(version1: string, version2: string): boolean {
    return compare(version1, version2) >= 0;
  }

  /**
   * Check if version1 is less than version2
   */
  static lt(version1: string, version2: string): boolean {
    return compare(version1, version2) < 0;
  }

  /**
   * Check if version1 is less than or equal to version2
   */
  static lte(version1: string, version2: string): boolean {
    return compare(version1, version2) <= 0;
  }

  /**
   * Check if version1 equals version2
   */
  static eq(version1: string, version2: string): boolean {
    return compare(version1, version2) === 0;
  }

  /**
   * Check if version satisfies semver range
   */
  static satisfies(version: string, range: string): boolean {
    return satisfies(version, range);
  }

  /**
   * Get minimum version from range
   */
  static minVersion(range: string): string | null {
    const min = minVersion(range);
    return min ? min.version : null;
  }

  /**
   * Get maximum version from range
   */
  static maxVersion(versions: string[]): string | null {
    return maxVersion(versions);
  }

  /**
   * Validate version string
   */
  static valid(version: string): string | null {
    return valid(version);
  }

  /**
   * Increment version
   */
  static increment(version: string, type: 'major' | 'minor' | 'patch' | 'prerelease'): string {
    const semver = new SemVer(version);
    return semver.inc(type).version;
  }

  /**
   * Get difference between two versions
   */
  static diff(version1: string, version2: string): VersionComparison['difference'] {
    const sem1 = new SemVer(version1);
    const sem2 = new SemVer(version2);
    return sem1.diff(sem2) || 'equal';
  }

  /**
   * Calculate next version based on changes
   */
  static calculateNextVersion(
    currentVersion: string,
    changes: {
      breaking: boolean;
      features: boolean;
      fixes: boolean;
    }
  ): string {
    if (changes.breaking) {
      return this.increment(currentVersion, 'major');
    }
    if (changes.features) {
      return this.increment(currentVersion, 'minor');
    }
    if (changes.fixes) {
      return this.increment(currentVersion, 'patch');
    }
    return currentVersion;
  }

  /**
   * Get version range
   */
  static getRange(versions: string[]): {
    min: string;
    max: string;
    range: string;
  } {
    const sorted = versions.sort((a, b) => compare(a, b));
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return {
      min,
      max,
      range: `>=${min} <=${max}`,
    };
  }

  /**
   * Filter versions by range
   */
  static filterByRange(versions: string[], range: string): string[] {
    return versions.filter(v => satisfies(v, range));
  }

  /**
   * Get all versions between two versions
   */
  static getVersionsBetween(
    versions: string[],
    min: string,
    max: string
  ): string[] {
    return versions.filter(v => this.gte(v, min) && this.lte(v, max));
  }

  /**
   * Sort versions
   */
  static sort(versions: string[]): string[] {
    return versions.sort(compare);
  }

  /**
   * Get version precedence (for sorting pre-release versions)
   */
  static rcompare(version1: string, version2: string): number {
    const sem1 = new SemVer(version1);
    const sem2 = new SemVer(version2);
    return sem2.compare(sem1);
  }

  /**
   * Check if version is pre-release
   */
  static isPrerelease(version: string): boolean {
    const semver = new SemVer(version);
    return semver.prerelease.length > 0;
  }

  /**
   * Clean version string
   */
  static clean(version: string): string | null {
    const cleaned = valid(version);
    return cleaned;
  }

  /**
   * Coerce version string (handles non-semver formats)
   */
  static coerce(version: string): string | null {
    try {
      const coerced = new SemVer(version, { loose: true });
      return coerced.version;
    } catch {
      return null;
    }
  }

  /**
   * Compare versions and return detailed comparison
   */
  static compareDetailed(version1: string, version2: string): VersionComparison {
    const sem1 = new SemVer(version1);
    const sem2 = new SemVer(version2);

    const comparison = sem1.compare(sem2);
    const diff = sem1.diff(sem2);

    return {
      sourceVersion: version1,
      targetVersion: version2,
      majorChange: sem1.major !== sem2.major,
      minorChange: sem1.minor !== sem2.minor,
      patchChange: sem1.patch !== sem2.patch,
      difference: diff || 'equal',
      upgradeType:
        comparison > 0
          ? diff === 'major'
            ? 'major'
            : diff === 'minor'
            ? 'minor'
            : 'patch'
          : comparison < 0
          ? 'downgrade'
          : 'patch',
    };
  }

  /**
   * Parse version range
   */
  static parseRange(range: string): string[] {
    const semverRange = new SemVerRange(range);
    return Array.from(semverRange.set);
  }

  /**
   * Check if ranges intersect
   */
  static rangesIntersect(range1: string, range2: string): boolean {
    const r1 = new SemVerRange(range1);
    const r2 = new SemVerRange(range2);
    return r1.intersects(r2);
  }

  /**
   * Get version suggestions for upgrade
   */
  static getUpgradePath(
    currentVersion: string,
    availableVersions: string[],
    preferences: 'latest' | 'stable' | 'compatible' = 'stable'
  ): string[] {
    const sorted = this.sort(availableVersions);
    const currentIndex = sorted.indexOf(currentVersion);

    if (currentIndex === -1) {
      return [sorted[sorted.length - 1]];
    }

    switch (preferences) {
      case 'latest':
        return sorted.slice(currentIndex + 1);
      case 'stable':
        return sorted
          .slice(currentIndex + 1)
          .filter(v => !this.isPrerelease(v));
      case 'compatible':
        const currentSemver = new SemVer(currentVersion);
        return sorted.slice(currentIndex + 1).filter(v => {
          const vSemver = new SemVer(v);
          return vSemver.major === currentSemver.major;
        });
    }
  }

  /**
   * Get downgrade path
   */
  static getDowngradePath(
    currentVersion: string,
    availableVersions: string[]
  ): string[] {
    const sorted = this.sort(availableVersions);
    const currentIndex = sorted.indexOf(currentVersion);

    if (currentIndex === -1) {
      return [sorted[0]];
    }

    return sorted.slice(0, currentIndex).reverse();
  }

  /**
   * Check if upgrade is breaking
   */
  static isBreakingUpgrade(fromVersion: string, toVersion: string): boolean {
    const sem1 = new SemVer(fromVersion);
    const sem2 = new SemVer(toVersion);
    return sem2.major > sem1.major;
  }

  /**
   * Get major version
   */
  static getMajor(version: string): number {
    return new SemVer(version).major;
  }

  /**
   * Get minor version
   */
  static getMinor(version: string): number {
    return new SemVer(version).minor;
  }

  /**
   * Get patch version
   */
  static getPatch(version: string): number {
    return new SemVer(version).patch;
  }

  /**
   * Create version from components
   */
  static create(
    major: number,
    minor: number,
    patch: number,
    prerelease?: string[],
    build?: string[]
  ): string {
    const base = `${major}.${minor}.${patch}`;
    const pre = prerelease && prerelease.length ? `-${prerelease.join('.')}` : '';
    const bld = build && build.length ? `+${build.join('.')}` : '';
    return base + pre + bld;
  }

  /**
   * Compare version ranges
   */
  static compareRanges(range1: string, range2: string): number {
    const min1 = this.minVersion(range1);
    const min2 = this.minVersion(range2);
    if (!min1 || !min2) return 0;
    return compare(min1, min2);
  }

  /**
   * Expand version range to list of versions
   */
  static expandRange(range: string, allVersions: string[]): string[] {
    return this.filterByRange(allVersions, range);
  }

  /**
   * Check if version is within allowed range
   */
  static isWithinRange(version: string, range: string): boolean {
    return satisfies(version, range);
  }

  /**
   * Get compatible versions for a given version
   */
  static getCompatibleVersions(
    version: string,
    allVersions: string[]
  ): string[] {
    const semver = new SemVer(version);
    const compatibleRange = `^${semver.major}.${semver.minor}.${semver.patch}`;
    return this.filterByRange(allVersions, compatibleRange);
  }

  /**
   * Validate semantic version
   */
  static validate(version: string, strict = true): boolean {
    try {
      new SemVer(version, { loose: !strict });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get version info
   */
  static getInfo(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[] | undefined;
    build: string[] | undefined;
    isPrerelease: boolean;
    isValid: boolean;
  } {
    try {
      const semver = new SemVer(version);
      return {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: semver.prerelease.length ? semver.prerelease : undefined,
        build: semver.build.length ? semver.build : undefined,
        isPrerelease: semver.prerelease.length > 0,
        isValid: true,
      };
    } catch {
      return {
        major: 0,
        minor: 0,
        patch: 0,
        prerelease: undefined,
        build: undefined,
        isPrerelease: false,
        isValid: false,
      };
    }
  }

  /**
   * Get version recommendations
   */
  static getRecommendations(
    currentVersion: string,
    availableVersions: string[],
    criteria: {
      allowBreaking?: boolean;
      allowPrerelease?: boolean;
      stability?: 'stable' | 'beta' | 'alpha' | 'any';
    } = {}
  ): {
    recommended: string;
    alternatives: string[];
    reason: string;
  } {
    const {
      allowBreaking = false,
      allowPrerelease = false,
      stability = 'stable',
    } = criteria;

    let candidates = availableVersions;

    // Filter by stability
    if (stability !== 'any') {
      candidates = candidates.filter(v => {
        const info = this.getInfo(v);
        if (!info.isPrerelease) return true;
        if (allowPrerelease) return true;
        return false;
      });
    }

    // Filter by breaking changes
    if (!allowBreaking) {
      candidates = candidates.filter(v => !this.isBreakingUpgrade(currentVersion, v));
    }

    // Get recommended version
    const sorted = this.sort(candidates);
    const recommended = sorted[sorted.length - 1] || currentVersion;

    return {
      recommended,
      alternatives: sorted.slice(0, -1).reverse(),
      reason: allowBreaking
        ? 'Latest version available'
        : 'Latest compatible version (same major version)',
    };
  }
}
