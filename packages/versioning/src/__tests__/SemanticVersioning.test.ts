/**
 * Tests for SemanticVersioning
 */

import { describe, it, expect } from 'vitest';
import { SemanticVersioning } from '../versions/SemanticVersioning';

describe('SemanticVersioning', () => {
  describe('Parsing', () => {
    it('should parse valid semantic version', () => {
      const semver = SemanticVersioning.parse('1.2.3');

      expect(semver.major).toBe(1);
      expect(semver.minor).toBe(2);
      expect(semver.patch).toBe(3);
    });

    it('should parse version with prerelease', () => {
      const semver = SemanticVersioning.parse('1.2.3-alpha.1');

      expect(semver.major).toBe(1);
      expect(semver.minor).toBe(2);
      expect(semver.patch).toBe(3);
      expect(semver.prerelease).toEqual(['alpha', '1']);
    });

    it('should parse version with build metadata', () => {
      const semver = SemanticVersioning.parse('1.2.3+build.123');

      expect(semver.major).toBe(1);
      expect(semver.minor).toBe(2);
      expect(semver.patch).toBe(3);
      expect(semver.build).toEqual(['build', '123']);
    });

    it('should format SemVer object to string', () => {
      const semver = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: ['beta', '1'],
        build: ['build', '456'],
      };

      const formatted = SemanticVersioning.format(semver);

      expect(formatted).toBe('1.2.3-beta.1+build.456');
    });
  });

  describe('Comparison', () => {
    it('should compare versions correctly', () => {
      expect(SemanticVersioning.compare('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(SemanticVersioning.compare('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(SemanticVersioning.compare('1.0.0', '1.0.0')).toBe(0);
    });

    it('should check greater than', () => {
      expect(SemanticVersioning.gt('2.0.0', '1.0.0')).toBe(true);
      expect(SemanticVersioning.gt('1.0.0', '2.0.0')).toBe(false);
    });

    it('should check less than', () => {
      expect(SemanticVersioning.lt('1.0.0', '2.0.0')).toBe(true);
      expect(SemanticVersioning.lt('2.0.0', '1.0.0')).toBe(false);
    });

    it('should check equality', () => {
      expect(SemanticVersioning.eq('1.0.0', '1.0.0')).toBe(true);
      expect(SemanticVersioning.eq('1.0.0', '2.0.0')).toBe(false);
    });
  });

  describe('Incrementing', () => {
    it('should increment major version', () => {
      expect(SemanticVersioning.increment('1.2.3', 'major')).toBe('2.0.0');
    });

    it('should increment minor version', () => {
      expect(SemanticVersioning.increment('1.2.3', 'minor')).toBe('1.3.0');
    });

    it('should increment patch version', () => {
      expect(SemanticVersioning.increment('1.2.3', 'patch')).toBe('1.2.4');
    });
  });

  describe('Ranges', () => {
    it('should check if version satisfies range', () => {
      expect(SemanticVersioning.satisfies('1.2.3', '^1.2.0')).toBe(true);
      expect(SemanticVersioning.satisfies('2.0.0', '^1.2.0')).toBe(false);
    });

    it('should get minimum version from range', () => {
      expect(SemanticVersioning.minVersion('>=1.2.0')).toBe('1.2.0');
    });

    it('should get maximum version from list', () => {
      const versions = ['1.0.0', '1.2.3', '2.0.0', '1.5.0'];
      expect(SemanticVersioning.maxVersion(versions)).toBe('2.0.0');
    });
  });

  describe('Version Comparison', () => {
    it('should get detailed comparison', () => {
      const comparison = SemanticVersioning.compareDetailed('1.0.0', '2.0.0');

      expect(comparison.sourceVersion).toBe('1.0.0');
      expect(comparison.targetVersion).toBe('2.0.0');
      expect(comparison.majorChange).toBe(true);
      expect(comparison.minorChange).toBe(false);
      expect(comparison.patchChange).toBe(false);
    });

    it('should get version diff', () => {
      expect(SemanticVersioning.diff('1.0.0', '2.0.0')).toBe('major');
      expect(SemanticVersioning.diff('1.0.0', '1.1.0')).toBe('minor');
      expect(SemanticVersioning.diff('1.0.0', '1.0.1')).toBe('patch');
    });
  });

  describe('Utilities', () => {
    it('should validate version string', () => {
      expect(SemanticVersioning.validate('1.0.0')).toBe(true);
      expect(SemanticVersioning.validate('invalid')).toBe(false);
    });

    it('should clean version string', () => {
      expect(SemanticVersioning.clean('v1.0.0')).toBe('1.0.0');
      expect(SemanticVersioning.clean('=1.0.0')).toBe('1.0.0');
    });

    it('should coerce version string', () => {
      expect(SemanticVersioning.coerce('v1')).toBe('1.0.0');
      expect(SemanticVersioning.coerce('1.2')).toBe('1.2.0');
    });

    it('should check if version is prerelease', () => {
      expect(SemanticVersioning.isPrerelease('1.0.0-alpha')).toBe(true);
      expect(SemanticVersioning.isPrerelease('1.0.0')).toBe(false);
    });
  });

  describe('Upgrade Paths', () => {
    it('should get upgrade path for latest', () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];
      const path = SemanticVersioning.getUpgradePath('1.0.0', versions, 'latest');

      expect(path).toEqual(['1.1.0', '1.2.0', '2.0.0']);
    });

    it('should get upgrade path for stable versions only', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0-alpha', '2.0.0'];
      const path = SemanticVersioning.getUpgradePath('1.0.0', versions, 'stable');

      expect(path).toEqual(['1.1.0', '2.0.0']);
    });

    it('should get upgrade path for compatible versions', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0'];
      const path = SemanticVersioning.getUpgradePath('1.0.0', versions, 'compatible');

      expect(path).toEqual(['1.1.0']);
    });
  });

  describe('Version Recommendations', () => {
    it('should get recommendations for breaking changes allowed', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0'];
      const recs = SemanticVersioning.getRecommendations('1.0.0', versions, {
        allowBreaking: true,
      });

      expect(recs.recommended).toBe('2.0.0');
      expect(recs.reason).toBe('Latest version available');
    });

    it('should get recommendations for compatible versions only', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0'];
      const recs = SemanticVersioning.getRecommendations('1.0.0', versions, {
        allowBreaking: false,
      });

      expect(recs.recommended).toBe('1.1.0');
      expect(recs.reason).toBe('Latest compatible version (same major version)');
    });
  });
});
