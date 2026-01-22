/**
 * Version Manager - Core version management system
 */

import { SemVer, Range } from 'semver';
import {
  APIVersion,
  VersionStatus,
  VersioningStrategy,
  VersionLocation,
  VersionContext,
  VersionResolution,
  VersionComparison,
  VersionRegistry,
  VersionMetadata,
  VersionPolicy,
} from '../types/index.js';

export class VersionManager {
  private registry: VersionRegistry;
  private policy: VersionPolicy;
  private versionCache: Map<string, APIVersion>;
  private endpointCache: Map<string, Map<string, APIVersion>>;

  constructor(policy?: Partial<VersionPolicy>) {
    this.registry = {
      versions: new Map(),
      endpoints: new Map(),
      deprecations: new Map(),
      transforms: new Map(),
      contracts: new Map(),
    };
    this.policy = this.initializePolicy(policy);
    this.versionCache = new Map();
    this.endpointCache = new Map();
  }

  /**
   * Register a new API version
   */
  registerVersion(version: APIVersion): void {
    this.validateVersion(version);
    this.registry.versions.set(version.version, version);
    this.versionCache.set(version.version, version);
    this.invalidateEndpointCache();
  }

  /**
   * Get version by version string
   */
  getVersion(version: string): APIVersion | undefined {
    return this.registry.versions.get(version);
  }

  /**
   * Get all versions
   */
  getAllVersions(): APIVersion[] {
    return Array.from(this.registry.versions.values()).sort((a, b) => {
      const semA = new SemVer(a.version);
      const semB = new SemVer(b.version);
      return semA.compare(semB);
    });
  }

  /**
   * Get versions by status
   */
  getVersionsByStatus(status: VersionStatus): APIVersion[] {
    return this.getAllVersions().filter(v => v.status === status);
  }

  /**
   * Get latest stable version
   */
  getLatestStable(): APIVersion | undefined {
    const stableVersions = this.getVersionsByStatus(VersionStatus.STABLE);
    if (stableVersions.length === 0) return undefined;
    return stableVersions[stableVersions.length - 1];
  }

  /**
   * Get default version
   */
  getDefaultVersion(): string {
    return this.policy.defaultVersion;
  }

  /**
   * Set default version
   */
  setDefaultVersion(version: string): void {
    if (!this.registry.versions.has(version)) {
      throw new Error(`Version ${version} is not registered`);
    }
    this.policy.defaultVersion = version;
  }

  /**
   * Resolve version from request context
   */
  resolveVersion(
    context: VersionContext,
    strategies?: VersioningStrategy[]
  ): VersionResolution {
    const activeStrategies = strategies || this.getActiveStrategies();
    const resolutions: VersionResolution[] = [];

    for (const strategy of activeStrategies) {
      const resolution = this.resolveWithStrategy(context, strategy);
      if (resolution) {
        resolutions.push(resolution);
      }
    }

    // Sort by confidence and return best match
    resolutions.sort((a, b) => b.confidence - a.confidence);

    if (resolutions.length === 0) {
      return {
        version: this.policy.defaultVersion,
        strategy: VersioningStrategy.URL_PATH,
        confidence: 0,
        alternatives: this.getSupportedVersions(),
        metadata: {},
      };
    }

    return {
      ...resolutions[0],
      alternatives: this.getSupportedVersions(),
    };
  }

  /**
   * Compare two versions
   */
  compareVersions(version1: string, version2: string): VersionComparison {
    const sem1 = new SemVer(version1);
    const sem2 = new SemVer(version2);

    const diff = sem1.diff(sem2);
    const comparison = sem1.compare(sem2);

    return {
      sourceVersion: version1,
      targetVersion: version2,
      majorChange: sem1.major !== sem2.major,
      minorChange: sem1.minor !== sem2.minor,
      patchChange: sem1.patch !== sem2.patch,
      difference: diff || 'equal',
      upgradeType:
        comparison > 0
          ? 'major'
          : comparison < 0
          ? 'downgrade'
          : 'patch',
    };
  }

  /**
   * Check if version is supported
   */
  isVersionSupported(version: string): boolean {
    return this.policy.supportedVersions.includes(version);
  }

  /**
   * Get supported versions
   */
  getSupportedVersions(): string[] {
    return [...this.policy.supportedVersions];
  }

  /**
   * Add supported version
   */
  addSupportedVersion(version: string): void {
    if (!this.registry.versions.has(version)) {
      throw new Error(`Cannot add unsupported version ${version}`);
    }
    this.policy.supportedVersions.push(version);
    this.sortSupportedVersions();
  }

  /**
   * Remove supported version
   */
  removeSupportedVersion(version: string): void {
    this.policy.supportedVersions = this.policy.supportedVersions.filter(
      v => v !== version
    );
  }

  /**
   * Get version metadata
   */
  getVersionMetadata(version: string): VersionMetadata | undefined {
    const apiVersion = this.getVersion(version);
    if (!apiVersion) return undefined;

    return {
      version: apiVersion.version,
      changelog: apiVersion.features.join('\n'),
      releaseNotes: apiVersion.description,
      knownIssues: [],
      dependencies: {},
    };
  }

  /**
   * Update version status
   */
  updateVersionStatus(version: string, status: VersionStatus): void {
    const apiVersion = this.getVersion(version);
    if (!apiVersion) {
      throw new Error(`Version ${version} not found`);
    }

    apiVersion.status = status;

    if (status === VersionStatus.DEPRECATED && !apiVersion.deprecatedAt) {
      apiVersion.deprecatedAt = new Date();
    }

    if (status === VersionStatus.SUNSET && !apiVersion.sunsetAt) {
      apiVersion.sunsetAt = new Date();
    }
  }

  /**
   * Get version lifecycle info
   */
  getVersionLifecycle(version: string): {
    status: VersionStatus;
    releasedAt: Date;
    deprecatedAt?: Date;
    sunsetAt?: Date;
    daysUntilSunset?: number;
  } {
    const apiVersion = this.getVersion(version);
    if (!apiVersion) {
      throw new Error(`Version ${version} not found`);
    }

    const daysUntilSunset = apiVersion.sunsetAt
      ? Math.ceil(
          (apiVersion.sunsetAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : undefined;

    return {
      status: apiVersion.status,
      releasedAt: apiVersion.releasedAt,
      deprecatedAt: apiVersion.deprecatedAt,
      sunsetAt: apiVersion.sunsetAt,
      daysUntilSunset,
    };
  }

  /**
   * Validate version
   */
  private validateVersion(version: APIVersion): void {
    try {
      new SemVer(version.version);
    } catch (error) {
      throw new Error(`Invalid semantic version: ${version.version}`);
    }

    if (version.sunsetAt && version.deprecatedAt) {
      if (version.sunsetAt <= version.deprecatedAt) {
        throw new Error('Sunset date must be after deprecation date');
      }
    }

    if (version.releasedAt > new Date()) {
      throw new Error('Release date cannot be in the future');
    }
  }

  /**
   * Initialize version policy
   */
  private initializePolicy(policy?: Partial<VersionPolicy>): VersionPolicy {
    return {
      supportedVersions: ['1.0.0'],
      defaultVersion: '1.0.0',
      deprecationPolicy: {
        minimumNoticePeriod: 90,
        warningPeriod: 30,
        defaultSunsetPeriod: 180,
        requireSuccessorVersion: true,
        requireMigrationGuide: true,
      },
      migrationPolicy: {
        automatedMigrationSupported: true,
        rollbackPeriod: 30,
        testingRequired: true,
        documentationRequired: true,
      },
      compatibilityPolicy: {
        backwardCompatible: true,
        forwardCompatible: false,
        gracePeriod: 30,
        allowBreakingChanges: true,
      },
      ...policy,
    };
  }

  /**
   * Get active versioning strategies
   */
  private getActiveStrategies(): VersioningStrategy[] {
    return [
      VersioningStrategy.URL_PATH,
      VersioningStrategy.HEADER,
      VersioningStrategy.ACCEPT_HEADER,
      VersioningStrategy.QUERY_PARAM,
    ];
  }

  /**
   * Resolve version with specific strategy
   */
  private resolveWithStrategy(
    context: VersionContext,
    strategy: VersioningStrategy
  ): VersionResolution | null {
    switch (strategy) {
      case VersioningStrategy.URL_PATH:
        return this.resolveFromPath(context);
      case VersioningStrategy.HEADER:
        return this.resolveFromHeader(context);
      case VersioningStrategy.ACCEPT_HEADER:
        return this.resolveFromAcceptHeader(context);
      case VersioningStrategy.QUERY_PARAM:
        return this.resolveFromQuery(context);
      default:
        return null;
    }
  }

  /**
   * Resolve version from URL path
   */
  private resolveFromPath(context: VersionContext): VersionResolution | null {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');

    // Look for version pattern like /api/v1/ or /v1/
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (part.startsWith('v')) {
        const version = part.substring(1);
        if (this.isValidVersion(version)) {
          return {
            version,
            strategy: VersioningStrategy.URL_PATH,
            confidence: 1.0,
            alternatives: [],
            metadata: { path: part },
          };
        }
      }
    }

    return null;
  }

  /**
   * Resolve version from header
   */
  private resolveFromHeader(context: VersionContext): VersionResolution | null {
    const versionHeader =
      context.headers.get('API-Version') ||
      context.headers.get('X-API-Version') ||
      context.headers.get('Api-Version');

    if (versionHeader && this.isValidVersion(versionHeader)) {
      return {
        version: versionHeader,
        strategy: VersioningStrategy.HEADER,
        confidence: 0.9,
        alternatives: [],
        metadata: { header: 'API-Version' },
      };
    }

    return null;
  }

  /**
   * Resolve version from Accept header
   */
  private resolveFromAcceptHeader(
    context: VersionContext
  ): VersionResolution | null {
    const acceptHeader = context.headers.get('Accept');
    if (!acceptHeader) return null;

    // Parse Accept header for version pattern
    // e.g., application/vnd.claudeflare.v1+json
    const versionMatch = acceptHeader.match(/vnd\.claudeflare\.v(\d+\.\d+\.\d+)/);
    if (versionMatch && this.isValidVersion(versionMatch[1])) {
      return {
        version: versionMatch[1],
        strategy: VersioningStrategy.ACCEPT_HEADER,
        confidence: 0.85,
        alternatives: [],
        metadata: { accept: acceptHeader },
      };
    }

    return null;
  }

  /**
   * Resolve version from query parameter
   */
  private resolveFromQuery(context: VersionContext): VersionResolution | null {
    const version = context.query.get('version') || context.query.get('api_version');
    if (version && this.isValidVersion(version)) {
      return {
        version,
        strategy: VersioningStrategy.QUERY_PARAM,
        confidence: 0.7,
        alternatives: [],
        metadata: { parameter: 'version' },
      };
    }

    return null;
  }

  /**
   * Check if version string is valid
   */
  private isValidVersion(version: string): boolean {
    try {
      new SemVer(version);
      return this.registry.versions.has(version);
    } catch {
      return false;
    }
  }

  /**
   * Sort supported versions
   */
  private sortSupportedVersions(): void {
    this.policy.supportedVersions.sort((a, b) => {
      const semA = new SemVer(a);
      const semB = new SemVer(b);
      return semA.compare(semB);
    });
  }

  /**
   * Invalidate endpoint cache
   */
  private invalidateEndpointCache(): void {
    this.endpointCache.clear();
  }

  /**
   * Get registry (for internal use)
   */
  getRegistry(): VersionRegistry {
    return this.registry;
  }

  /**
   * Get policy
   */
  getPolicy(): VersionPolicy {
    return { ...this.policy };
  }

  /**
   * Set policy
   */
  setPolicy(policy: Partial<VersionPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }
}
