/**
 * Tests for VersionManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionManager } from '../versions/VersionManager';
import { VersionStatus, VersioningStrategy, APIVersion } from '../types';

describe('VersionManager', () => {
  let versionManager: VersionManager;

  beforeEach(() => {
    versionManager = new VersionManager();
  });

  describe('Version Registration', () => {
    it('should register a new version', () => {
      const version: APIVersion = {
        version: '1.0.0',
        semver: { major: 1, minor: 0, patch: 0 },
        status: VersionStatus.STABLE,
        releasedAt: new Date('2024-01-01'),
        description: 'Initial release',
        breakingChanges: [],
        features: ['Initial feature set'],
        deprecations: [],
      };

      versionManager.registerVersion(version);
      const retrieved = versionManager.getVersion('1.0.0');

      expect(retrieved).toBeDefined();
      expect(retrieved?.version).toBe('1.0.0');
    });

    it('should reject invalid semantic version', () => {
      const version: APIVersion = {
        version: 'invalid',
        semver: { major: 0, minor: 0, patch: 0 },
        status: VersionStatus.STABLE,
        releasedAt: new Date(),
        description: 'Invalid version',
        breakingChanges: [],
        features: [],
        deprecations: [],
      };

      expect(() => versionManager.registerVersion(version)).toThrow();
    });

    it('should reject version with sunset before deprecation', () => {
      const version: APIVersion = {
        version: '1.0.0',
        semver: { major: 1, minor: 0, patch: 0 },
        status: VersionStatus.DEPRECATED,
        releasedAt: new Date('2024-01-01'),
        deprecatedAt: new Date('2024-06-01'),
        sunsetAt: new Date('2024-05-01'),
        description: 'Invalid dates',
        breakingChanges: [],
        features: [],
        deprecations: [],
      };

      expect(() => versionManager.registerVersion(version)).toThrow();
    });
  });

  describe('Version Resolution', () => {
    beforeEach(() => {
      const versions: APIVersion[] = [
        {
          version: '1.0.0',
          semver: { major: 1, minor: 0, patch: 0 },
          status: VersionStatus.STABLE,
          releasedAt: new Date('2024-01-01'),
          description: 'v1.0.0',
          breakingChanges: [],
          features: [],
          deprecations: [],
        },
        {
          version: '2.0.0',
          semver: { major: 2, minor: 0, patch: 0 },
          status: VersionStatus.STABLE,
          releasedAt: new Date('2024-06-01'),
          description: 'v2.0.0',
          breakingChanges: [],
          features: [],
          deprecations: [],
        },
      ];

      versions.forEach(v => versionManager.registerVersion(v));
    });

    it('should resolve version from URL path', () => {
      const context = {
        request: new Request('https://api.example.com/api/v1/users'),
        headers: new Headers(),
        query: new URLSearchParams(),
        cookies: {},
      };

      const resolution = versionManager.resolveVersion(context, [VersioningStrategy.URL_PATH]);

      expect(resolution.version).toBe('1.0.0');
      expect(resolution.strategy).toBe(VersioningStrategy.URL_PATH);
      expect(resolution.confidence).toBe(1.0);
    });

    it('should resolve version from header', () => {
      const headers = new Headers();
      headers.set('API-Version', '2.0.0');

      const context = {
        request: new Request('https://api.example.com/users'),
        headers,
        query: new URLSearchParams(),
        cookies: {},
      };

      const resolution = versionManager.resolveVersion(context, [VersioningStrategy.HEADER]);

      expect(resolution.version).toBe('2.0.0');
      expect(resolution.strategy).toBe(VersioningStrategy.HEADER);
    });

    it('should resolve version from query parameter', () => {
      const query = new URLSearchParams('version=1.0.0');

      const context = {
        request: new Request('https://api.example.com/users'),
        headers: new Headers(),
        query,
        cookies: {},
      };

      const resolution = versionManager.resolveVersion(context, [VersioningStrategy.QUERY_PARAM]);

      expect(resolution.version).toBe('1.0.0');
      expect(resolution.strategy).toBe(VersioningStrategy.QUERY_PARAM);
    });

    it('should fallback to default version when no version found', () => {
      const context = {
        request: new Request('https://api.example.com/users'),
        headers: new Headers(),
        query: new URLSearchParams(),
        cookies: {},
      };

      const resolution = versionManager.resolveVersion(context);

      expect(resolution.version).toBe(versionManager.getDefaultVersion());
    });
  });

  describe('Version Comparison', () => {
    it('should compare versions correctly', () => {
      const comparison = versionManager.compareVersions('1.0.0', '2.0.0');

      expect(comparison.majorChange).toBe(true);
      expect(comparison.minorChange).toBe(false);
      expect(comparison.patchChange).toBe(false);
      expect(comparison.difference).toBe('major');
    });

    it('should detect minor changes', () => {
      const comparison = versionManager.compareVersions('1.0.0', '1.1.0');

      expect(comparison.majorChange).toBe(false);
      expect(comparison.minorChange).toBe(true);
      expect(comparison.patchChange).toBe(false);
      expect(comparison.difference).toBe('minor');
    });

    it('should detect patch changes', () => {
      const comparison = versionManager.compareVersions('1.0.0', '1.0.1');

      expect(comparison.majorChange).toBe(false);
      expect(comparison.minorChange).toBe(false);
      expect(comparison.patchChange).toBe(true);
      expect(comparison.difference).toBe('patch');
    });
  });

  describe('Version Lifecycle', () => {
    it('should update version status', () => {
      const version: APIVersion = {
        version: '1.0.0',
        semver: { major: 1, minor: 0, patch: 0 },
        status: VersionStatus.STABLE,
        releasedAt: new Date('2024-01-01'),
        description: 'Test version',
        breakingChanges: [],
        features: [],
        deprecations: [],
      };

      versionManager.registerVersion(version);
      versionManager.updateVersionStatus('1.0.0', VersionStatus.DEPRECATED);

      const retrieved = versionManager.getVersion('1.0.0');
      expect(retrieved?.status).toBe(VersionStatus.DEPRECATED);
      expect(retrieved?.deprecatedAt).toBeDefined();
    });

    it('should get version lifecycle info', () => {
      const version: APIVersion = {
        version: '1.0.0',
        semver: { major: 1, minor: 0, patch: 0 },
        status: VersionStatus.DEPRECATED,
        releasedAt: new Date('2024-01-01'),
        deprecatedAt: new Date('2024-06-01'),
        sunsetAt: new Date('2024-12-01'),
        description: 'Test version',
        breakingChanges: [],
        features: [],
        deprecations: [],
      };

      versionManager.registerVersion(version);
      const lifecycle = versionManager.getVersionLifecycle('1.0.0');

      expect(lifecycle.status).toBe(VersionStatus.DEPRECATED);
      expect(lifecycle.daysUntilSunset).toBeGreaterThan(0);
    });
  });

  describe('Supported Versions', () => {
    it('should add supported version', () => {
      const version: APIVersion = {
        version: '1.0.0',
        semver: { major: 1, minor: 0, patch: 0 },
        status: VersionStatus.STABLE,
        releasedAt: new Date(),
        description: 'Test',
        breakingChanges: [],
        features: [],
        deprecations: [],
      };

      versionManager.registerVersion(version);
      versionManager.addSupportedVersion('1.0.0');

      expect(versionManager.isVersionSupported('1.0.0')).toBe(true);
    });

    it('should not add unsupported version', () => {
      expect(() => versionManager.addSupportedVersion('99.0.0')).toThrow();
    });
  });
});
