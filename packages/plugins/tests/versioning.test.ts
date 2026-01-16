// @ts-nocheck
/**
 * Plugin Versioning Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseSemVer,
  formatSemVer,
  compareSemVer,
  equalsSemVer,
  greaterThanSemVer,
  lessThanSemVer,
  satisfiesSemVer,
  incrementSemVer,
  parseVersionConstraint,
  formatVersionConstraint,
  VersionManager,
  type SemVer,
  type PluginVersionInfo
} from '../src/versioning';

describe('SemVer operations', () => {
  describe('parseSemVer', () => {
    it('should parse valid semver', () => {
      const result = parseSemVer('1.2.3');

      expect(result.major).toBe(1);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(3);
    });

    it('should parse semver with prerelease', () => {
      const result = parseSemVer('1.2.3-alpha.1');

      expect(result.prerelease).toBe('alpha.1');
    });

    it('should parse semver with build', () => {
      const result = parseSemVer('1.2.3+build.123');

      expect(result.build).toBe('build.123');
    });

    it('should parse semver with v prefix', () => {
      const result = parseSemVer('v1.2.3');

      expect(result.major).toBe(1);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(3);
    });

    it('should throw on invalid semver', () => {
      expect(() => parseSemVer('invalid')).toThrow();
    });
  });

  describe('formatSemVer', () => {
    it('should format semver', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const result = formatSemVer(version);

      expect(result).toBe('1.2.3');
    });

    it('should format semver with prerelease', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3, prerelease: 'alpha.1' };
      const result = formatSemVer(version);

      expect(result).toBe('1.2.3-alpha.1');
    });

    it('should format semver with v prefix', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const result = formatSemVer(version, true);

      expect(result).toBe('v1.2.3');
    });
  });

  describe('compareSemVer', () => {
    it('should compare equal versions', () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 3 };

      expect(compareSemVer(a, b)).toBe(0);
    });

    it('should compare by major version', () => {
      const a: SemVer = { major: 2, minor: 0, patch: 0 };
      const b: SemVer = { major: 1, minor: 9, patch: 9 };

      expect(compareSemVer(a, b)).toBeGreaterThan(0);
    });

    it('should compare by minor version', () => {
      const a: SemVer = { major: 1, minor: 2, patch: 0 };
      const b: SemVer = { major: 1, minor: 1, patch: 9 };

      expect(compareSemVer(a, b)).toBeGreaterThan(0);
    });

    it('should compare by patch version', () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 2 };

      expect(compareSemVer(a, b)).toBeGreaterThan(0);
    });

    it('should treat prerelease as lower than release', () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 3, prerelease: 'alpha.1' };

      expect(compareSemVer(a, b)).toBeGreaterThan(0);
    });
  });

  describe('equalsSemVer', () => {
    it('should return true for equal versions', () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 3 };

      expect(equalsSemVer(a, b)).toBe(true);
    });

    it('should return false for different versions', () => {
      const a: SemVer = { major: 1, minor: 2, patch: 3 };
      const b: SemVer = { major: 1, minor: 2, patch: 4 };

      expect(equalsSemVer(a, b)).toBe(false);
    });
  });

  describe('greaterThanSemVer', () => {
    it('should return true when greater', () => {
      const a: SemVer = { major: 2, minor: 0, patch: 0 };
      const b: SemVer = { major: 1, minor: 9, patch: 9 };

      expect(greaterThanSemVer(a, b)).toBe(true);
    });

    it('should return false when not greater', () => {
      const a: SemVer = { major: 1, minor: 0, patch: 0 };
      const b: SemVer = { major: 1, minor: 9, patch: 9 };

      expect(greaterThanSemVer(a, b)).toBe(false);
    });
  });

  describe('lessThanSemVer', () => {
    it('should return true when less', () => {
      const a: SemVer = { major: 1, minor: 0, patch: 0 };
      const b: SemVer = { major: 1, minor: 9, patch: 9 };

      expect(lessThanSemVer(a, b)).toBe(true);
    });

    it('should return false when not less', () => {
      const a: SemVer = { major: 2, minor: 0, patch: 0 };
      const b: SemVer = { major: 1, minor: 9, patch: 9 };

      expect(lessThanSemVer(a, b)).toBe(false);
    });
  });

  describe('incrementSemVer', () => {
    it('should increment major version', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const result = incrementSemVer(version, 'major');

      expect(result).toEqual({ major: 2, minor: 0, patch: 3 });
    });

    it('should increment minor version', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const result = incrementSemVer(version, 'minor');

      expect(result).toEqual({ major: 1, minor: 3, patch: 0 });
    });

    it('should increment patch version', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const result = incrementSemVer(version, 'patch');

      expect(result).toEqual({ major: 1, minor: 2, patch: 4 });
    });

    it('should increment prerelease version', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3, prerelease: 'rc.1' };
      const result = incrementSemVer(version, 'prerelease');

      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: 'rc.2' });
    });

    it('should start new prerelease if none exists', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const result = incrementSemVer(version, 'prerelease');

      expect(result.prerelease).toBe('rc.1');
    });
  });
});

describe('Version constraints', () => {
  describe('parseVersionConstraint', () => {
    it('should parse exact version', () => {
      const result = parseVersionConstraint('1.2.3');

      expect(result.type).toBe('exact');
      expect(result.version).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse caret version', () => {
      const result = parseVersionConstraint('^1.2.3');

      expect(result.type).toBe('caret');
      expect(result.version).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse tilde version', () => {
      const result = parseVersionConstraint('~1.2.3');

      expect(result.type).toBe('tilde');
      expect(result.version).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse wildcard version', () => {
      const result = parseVersionConstraint('1.2.*');

      expect(result.type).toBe('wildcard');
      expect(result.version).toEqual({ major: 1, minor: 2, patch: 0 });
    });

    it('should parse range version', () => {
      const result = parseVersionConstraint('>=1.2.3 <2.0.0');

      expect(result.type).toBe('range');
      expect(result.min).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(result.max).toEqual({ major: 1, minor: 9, patch: 9 });
    });

    it('should parse any version', () => {
      const result = parseVersionConstraint('*');

      expect(result.type).toBe('any');
    });
  });

  describe('satisfiesSemVer', () => {
    it('should satisfy exact version', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 3 };
      const constraint = parseVersionConstraint('1.2.3');

      expect(satisfiesSemVer(version, constraint)).toBe(true);
    });

    it('should not satisfy different exact version', () => {
      const version: SemVer = { major: 1, minor: 2, patch: 4 };
      const constraint = parseVersionConstraint('1.2.3');

      expect(satisfiesSemVer(version, constraint)).toBe(false);
    });

    it('should satisfy caret version', () => {
      expect(satisfiesSemVer(
        { major: 1, minor: 2, patch: 4 },
        parseVersionConstraint('^1.2.3')
      )).toBe(true);

      expect(satisfiesSemVer(
        { major: 1, minor: 3, patch: 0 },
        parseVersionConstraint('^1.2.3')
      )).toBe(true);

      expect(satisfiesSemVer(
        { major: 2, minor: 0, patch: 0 },
        parseVersionConstraint('^1.2.3')
      )).toBe(false);
    });

    it('should satisfy tilde version', () => {
      expect(satisfiesSemVer(
        { major: 1, minor: 2, patch: 4 },
        parseVersionConstraint('~1.2.3')
      )).toBe(true);

      expect(satisfiesSemVer(
        { major: 1, minor: 3, patch: 0 },
        parseVersionConstraint('~1.2.3')
      )).toBe(false);
    });
  });
});

describe('VersionManager', () => {
  let manager: VersionManager;

  beforeEach(() => {
    manager = new VersionManager({ autoUpdate: false });
  });

  describe('version registration', () => {
    it('should register a version', () => {
      const versionInfo: PluginVersionInfo = {
        version: { major: 1, minor: 0, patch: 0 },
        breaking: false,
        features: ['Initial release'],
        fixes: [],
        deprecations: [],
        migrations: [],
        publishedAt: new Date(),
        checksum: 'abc123',
        size: 1024000
      };

      manager.registerVersion('test-plugin', versionInfo);

      const versions = manager.getVersions('test-plugin');
      expect(versions).toHaveLength(1);
      expect(versions[0]).toEqual(versionInfo);
    });

    it('should sort versions by semver', () => {
      manager.registerVersions('test-plugin', [
        {
          version: { major: 1, minor: 0, patch: 0 },
          breaking: false,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'abc',
          size: 1000
        },
        {
          version: { major: 2, minor: 0, patch: 0 },
          breaking: true,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'def',
          size: 2000
        }
      ]);

      const versions = manager.getVersions('test-plugin');
      expect(versions[0].version.major).toBe(2);
      expect(versions[1].version.major).toBe(1);
    });
  });

  describe('getting versions', () => {
    beforeEach(() => {
      manager.registerVersions('test-plugin', [
        {
          version: { major: 1, minor: 0, patch: 0 },
          breaking: false,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'v1',
          size: 1000
        },
        {
          version: { major: 2, minor: 0, patch: 0, prerelease: 'beta.1' },
          breaking: true,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'v2-beta',
          size: 2000
        }
      ]);
    });

    it('should get latest stable version', () => {
      const latest = manager.getLatestVersion('test-plugin', false);

      expect(latest).toEqual({ major: 1, minor: 0, patch: 0 });
    });

    it('should get latest version including prerelease', () => {
      const latest = manager.getLatestVersion('test-plugin', true);

      expect(latest).toEqual({ major: 2, minor: 0, patch: 0, prerelease: 'beta.1' });
    });

    it('should get specific version', () => {
      const version = manager.getVersion('test-plugin', { major: 1, minor: 0, patch: 0 });

      expect(version).toBeDefined();
      expect(version!.version).toEqual({ major: 1, minor: 0, patch: 0 });
    });
  });

  describe('installation tracking', () => {
    it('should track installed version', () => {
      const version: SemVer = { major: 1, minor: 0, patch: 0 };
      manager.setInstalled('test-plugin', version);

      expect(manager.getInstalled('test-plugin')).toEqual(version);
    });

    it('should uninstall plugin', () => {
      manager.setInstalled('test-plugin', { major: 1, minor: 0, patch: 0 });
      manager.uninstall('test-plugin');

      expect(manager.getInstalled('test-plugin')).toBeNull();
    });
  });

  describe('update checking', () => {
    beforeEach(() => {
      manager.registerVersions('test-plugin', [
        {
          version: { major: 1, minor: 0, patch: 0 },
          breaking: false,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'v1',
          size: 1000
        },
        {
          version: { major: 2, minor: 0, patch: 0 },
          breaking: true,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'v2',
          size: 2000
        }
      ]);

      manager.setInstalled('test-plugin', { major: 1, minor: 0, patch: 0 });
    });

    it('should detect available update', () => {
      expect(manager.hasUpdate('test-plugin')).toBe(true);
    });

    it('should not detect update when on latest', () => {
      manager.setInstalled('test-plugin', { major: 2, minor: 0, patch: 0 });

      expect(manager.hasUpdate('test-plugin')).toBe(false);
    });

    it('should check all updates', async () => {
      const updates = await manager.checkUpdates();

      expect(updates.get('test-plugin')).toEqual({
        current: { major: 1, minor: 0, patch: 0 },
        available: { major: 2, minor: 0, patch: 0 }
      });
    });
  });

  describe('compatibility', () => {
    it('should detect compatible versions', () => {
      expect(manager.areCompatible(
        { major: 1, minor: 2, patch: 3 },
        { major: 1, minor: 2, patch: 4 }
      )).toBe(true);

      expect(manager.areCompatible(
        { major: 1, minor: 2, patch: 3 },
        { major: 1, minor: 3, patch: 0 }
      )).toBe(true);
    });

    it('should detect incompatible versions', () => {
      expect(manager.areCompatible(
        { major: 1, minor: 2, patch: 3 },
        { major: 2, minor: 0, patch: 0 }
      )).toBe(false);
    });

    it('should be strict for 0.x versions', () => {
      expect(manager.areCompatible(
        { major: 0, minor: 1, patch: 0 },
        { major: 0, minor: 2, patch: 0 }
      )).toBe(false);
    });
  });

  describe('dependency resolution', () => {
    beforeEach(() => {
      manager.registerVersions('dep-a', [
        {
          version: { major: 1, minor: 0, patch: 0 },
          breaking: false,
          features: [],
          fixes: [],
          deprecations: [],
          migrations: [],
          publishedAt: new Date(),
          checksum: 'a',
          size: 1000
        }
      ]);

      manager.registerDependencies('test-plugin', [
        {
          pluginId: 'dep-a',
          constraint: parseVersionConstraint('1.0.0')
        }
      ]);
    });

    it('should resolve dependencies', () => {
      const resolved = manager.resolveDependencies('test-plugin');

      expect(resolved).toBeDefined();
      expect(resolved!.get('dep-a')).toEqual({ major: 1, minor: 0, patch: 0 });
    });
  });

  describe('cleanup', () => {
    it('should destroy manager', () => {
      manager.registerVersion('test-plugin', {
        version: { major: 1, minor: 0, patch: 0 },
        breaking: false,
        features: [],
        fixes: [],
        deprecations: [],
        migrations: [],
        publishedAt: new Date(),
        checksum: 'abc',
        size: 1000
      });

      manager.destroy();

      expect(manager.getVersions('test-plugin')).toHaveLength(0);
    });
  });
});
