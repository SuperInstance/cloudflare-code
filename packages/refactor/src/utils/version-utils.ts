/**
 * Version Utilities
 *
 * Utilities for working with semantic versioning.
 */

import * as semver from 'semver';

export interface VersionRange {
  min: string;
  max: string;
  includePrerelease: boolean;
}

export class VersionUtils {
  /**
   * Parse a version string
   */
  static parse(version: string): semver.SemVer | null {
    return semver.parse(version);
  }

  /**
   * Compare two versions
   */
  static compare(v1: string, v2: string): number {
    return semver.compare(v1, v2);
  }

  /**
   * Check if version1 is greater than version2
   */
  static gt(v1: string, v2: string): boolean {
    return semver.gt(v1, v2);
  }

  /**
   * Check if version1 is less than version2
   */
  static lt(v1: string, v2: string): boolean {
    return semver.lt(v1, v2);
  }

  /**
   * Check if version1 equals version2
   */
  static eq(v1: string, v2: string): boolean {
    return semver.eq(v1, v2);
  }

  /**
   * Check if version satisfies range
   */
  static satisfies(version: string, range: string): boolean {
    return semver.satisfies(version, range);
  }

  /**
   * Get the difference between two versions
   */
  static diff(v1: string, v2: string): semver.ReleaseType | null {
    return semver.diff(v1, v2);
  }

  /**
   * Increment version
   */
  static increment(version: string, release: semver.ReleaseType): string {
    return semver.inc(version, release) || version;
  }

  /**
   * Get the valid version range
   */
  static validRange(range: string): string | null {
    return semver.validRange(range);
  }

  /**
   * Get the maximum satisfying version
   */
  static maxSatisfying(versions: string[], range: string): string | null {
    return semver.maxSatisfying(versions, range);
  }

  /**
   * Get the minimum satisfying version
   */
  static minSatisfying(versions: string[], range: string): string | null {
    return semver.minSatisfying(versions, range);
  }

  /**
   * Clean a version string
   */
  static clean(version: string): string | null {
    return semver.clean(version);
  }

  /**
   * Check if version is valid
   */
  static valid(version: string): boolean {
    return semver.valid(version) !== null;
  }

  /**
   * Coerce a version string
   */
  static coerce(version: string): semver.SemVer | null {
    return semver.coerce(version);
  }

  /**
   * Compare version identifiers (major, minor, patch)
   */
  static compareIdentifiers(identifier1: string, identifier2: string): number {
    return semver.compareIdentifiers(identifier1, identifier2);
  }

  /**
   * Get the rcompare (reverse compare) of two versions
   */
  static rcompare(v1: string, v2: string): number {
    return semver.rcompare(v1, v2);
  }

  /**
   * Sort versions
   */
  static sort(versions: string[]): string[] {
    return versions.sort(semver.compare);
  }

  /**
   * Reverse sort versions
   */
  static rsort(versions: string[]): string[] {
    return versions.sort(semver.rcompare);
  }
}

export { semver };
