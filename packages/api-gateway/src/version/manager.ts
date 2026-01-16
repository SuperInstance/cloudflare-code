/**
 * API Version Manager
 *
 * Manages API versioning with support for:
 * - URL-based versioning (/v1/, /v2/)
 * - Header-based versioning (Accept-Version, API-Version)
 * - Content negotiation (Accept header)
 * - Version deprecation workflow
 * - Version compatibility matrix
 * - Migration assistance
 *
 * Features:
 * - Multiple versioning strategies
 * - Automatic version detection
 * - Deprecation warnings
 * - Sunset notifications
 * - Version routing
 * - Compatibility checking
 */

import type { GatewayRequest, GatewayContext, ApiVersion } from '../types';

/**
 * Versioning strategy
 */
export type VersioningStrategy =
  | 'url_path'
  | 'header'
  | 'accept_header'
  | 'query_param'
  | 'content_type';

/**
 * Version status
 */
export type VersionStatus = 'active' | 'deprecated' | 'sunset' | 'retired';

/**
 * Version manager configuration
 */
export interface VersionManagerConfig {
  defaultVersion: string;
  supportedVersions: string[];
  strategy: VersioningStrategy;
  headerName?: string;
  queryParam?: string;
  deprecationWarningDays?: number;
  sunsetWarningDays?: number;
  enableCompatibilityCheck?: boolean;
}

/**
 * Version compatibility rule
 */
interface CompatibilityRule {
  fromVersion: string;
  toVersion: string;
  compatible: boolean;
  breakingChanges?: string[];
  migrationGuide?: string;
}

/**
 * Version routing result
 */
export interface VersionRoutingResult {
  version: string;
  status: VersionStatus;
  deprecated?: boolean;
  sunsetAt?: Date;
  warnings: string[];
  routingPath: string;
}

/**
 * API Version Manager
 */
export class VersionManager {
  private config: Required<VersionManagerConfig>;
  private versions: Map<string, ApiVersion>;
  private compatibilityMatrix: Map<string, CompatibilityRule[]>;
  private routingStats: Map<string, number>;

  constructor(config: VersionManagerConfig) {
    this.config = {
      defaultVersion: config.defaultVersion,
      supportedVersions: config.supportedVersions,
      strategy: config.strategy,
      headerName: config.headerName || 'API-Version',
      queryParam: config.queryParam || 'version',
      deprecationWarningDays: config.deprecationWarningDays || 90,
      sunsetWarningDays: config.sunsetWarningDays || 30,
      enableCompatibilityCheck: config.enableCompatibilityCheck ?? true,
    };

    this.versions = new Map();
    this.compatibilityMatrix = new Map();
    this.routingStats = new Map();
  }

  /**
   * Add a version
   */
  addVersion(version: ApiVersion): void {
    this.versions.set(version.version, version);
  }

  /**
   * Remove a version
   */
  removeVersion(version: string): boolean {
    return this.versions.delete(version);
  }

  /**
   * Get a version
   */
  getVersion(version: string): ApiVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Get all versions
   */
  getAllVersions(): ApiVersion[] {
    return Array.from(this.versions.values()).sort((a, b) =>
      a.version.localeCompare(b.version)
    );
  }

  /**
   * Get active versions
   */
  getActiveVersions(): ApiVersion[] {
    return this.getAllVersions().filter(v => v.status === 'active');
  }

  /**
   * Detect version from request
   */
  detectVersion(request: GatewayRequest): string | null {
    switch (this.config.strategy) {
      case 'url_path':
        return this.detectFromPath(request);

      case 'header':
        return this.detectFromHeader(request);

      case 'accept_header':
        return this.detectFromAcceptHeader(request);

      case 'query_param':
        return this.detectFromQuery(request);

      case 'content_type':
        return this.detectFromContentType(request);

      default:
        return null;
    }
  }

  /**
   * Route request to appropriate version
   */
  async routeToVersion(
    request: GatewayRequest,
    _context: GatewayContext,
    requestedVersion?: string
  ): Promise<VersionRoutingResult> {
    // Detect version
    let version = requestedVersion || this.detectVersion(request);

    // Fall back to default version
    if (!version || !this.versions.has(version)) {
      version = this.config.defaultVersion;
    }

    const apiVersion = this.versions.get(version);

    if (!apiVersion) {
      // Version not found, use default
      version = this.config.defaultVersion;
    }

    // Update routing stats
    this.routingStats.set(version, (this.routingStats.get(version) || 0) + 1);

    const result: VersionRoutingResult = {
      version,
      status: apiVersion?.status || 'active',
      routingPath: this.buildRoutingPath(request, version),
      warnings: [],
    };

    // Check for deprecation
    if (apiVersion?.status === 'deprecated') {
      result.deprecated = true;
      result.warnings.push(
        `API version ${version} is deprecated and will be sunset on ${apiVersion.sunsetAt?.toISOString()}. ` +
        `Please migrate to ${this.getLatestVersion()}.`
      );
    }

    // Check for sunset
    if (apiVersion?.status === 'sunset') {
      result.deprecated = true;
      result.sunsetAt = apiVersion.sunsetAt;
      result.warnings.push(
        `API version ${version} is sunset and will be retired on ${apiVersion.supportedUntil?.toISOString()}. ` +
        `Please migrate to ${this.getLatestVersion()} immediately.`
      );
    }

    // Add migration guide if available
    if (result.deprecated && apiVersion?.migrationGuide) {
      result.warnings.push(`Migration guide: ${apiVersion.migrationGuide}`);
    }

    return result;
  }

  /**
   * Check compatibility between versions
   */
  checkCompatibility(fromVersion: string, toVersion: string): CompatibilityRule | null {
    if (!this.config.enableCompatibilityCheck) {
      return null;
    }

    const rules = this.compatibilityMatrix.get(fromVersion) || [];

    for (const rule of rules) {
      if (rule.toVersion === toVersion) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Add compatibility rule
   */
  addCompatibilityRule(rule: CompatibilityRule): void {
    const rules = this.compatibilityMatrix.get(rule.fromVersion) || [];
    rules.push(rule);
    this.compatibilityMatrix.set(rule.fromVersion, rules);
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(version: string, sunsetDate: Date, migrationGuide?: string): void {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.status = 'deprecated';
      apiVersion.deprecatedAt = new Date();
      apiVersion.sunsetAt = sunsetDate;
      apiVersion.migrationGuide = migrationGuide;
    }
  }

  /**
   * Sunset a version
   */
  sunsetVersion(version: string, supportedUntil: Date): void {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.status = 'sunset';
      apiVersion.supportedUntil = supportedUntil;
    }
  }

  /**
   * Retire a version
   */
  retireVersion(version: string): void {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.status = 'retired';
    }
  }

  /**
   * Get latest version
   */
  getLatestVersion(): string {
    const versions = this.getActiveVersions();
    if (versions.length === 0) {
      return this.config.defaultVersion;
    }

    // Sort by version (assuming semantic versioning)
    return versions.sort((a, b) => {
      const aParts = a.version.split('.').map(Number);
      const bParts = b.version.split('.').map(Number);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;

        if (aPart !== bPart) {
          return bPart - aPart; // Descending order
        }
      }

      return 0;
    })[0].version;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): Map<string, number> {
    return new Map(this.routingStats);
  }

  /**
   * Reset routing statistics
   */
  resetRoutingStats(): void {
    this.routingStats.clear();
  }

  /**
   * Generate version response headers
   */
  generateVersionHeaders(result: VersionRoutingResult): Headers {
    const headers = new Headers();

    headers.set('API-Version', result.version);
    headers.set('API-Version-Status', result.status);

    if (result.deprecated) {
      headers.set('Deprecation', 'true');
      headers.set('Sunset', result.sunsetAt?.toISOString() || '');
    }

    if (result.warnings.length > 0) {
      headers.set('API-Version-Warnings', result.warnings.join('; '));
    }

    return headers;
  }

  /**
   * Detect version from URL path (private helper)
   */
  private detectFromPath(request: GatewayRequest): string | null {
    const pathParts = request.url.pathname.split('/').filter(Boolean);

    if (pathParts.length === 0) {
      return null;
    }

    const firstSegment = pathParts[0];

    // Check if it matches version pattern (v1, v2, etc.)
    const versionMatch = firstSegment.match(/^v(\d+)(?:\.(\d+))?$/);

    if (versionMatch) {
      const major = versionMatch[1];
      const minor = versionMatch[2] || '0';
      return `v${major}.${minor}`;
    }

    return null;
  }

  /**
   * Detect version from header (private helper)
   */
  private detectFromHeader(request: GatewayRequest): string | null {
    return request.headers.get(this.config.headerName) || null;
  }

  /**
   * Detect version from Accept header (private helper)
   */
  private detectFromAcceptHeader(request: GatewayRequest): string | null {
    const acceptHeader = request.headers.get('Accept') || '';

    // Parse Accept header for version parameter
    // Example: application/vnd.api.v1+json
    const vendorMatch = acceptHeader.match(/application\/vnd\.api\.v(\d+(?:\.\d+)?)/);

    if (vendorMatch) {
      return `v${vendorMatch[1]}`;
    }

    // Check for version parameter
    // Example: application/json; version=v1
    const versionMatch = acceptHeader.match(/version=v(\d+(?:\.\d+)?)/);

    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }

    return null;
  }

  /**
   * Detect version from query parameter (private helper)
   */
  private detectFromQuery(request: GatewayRequest): string | null {
    return request.query.get(this.config.queryParam) || null;
  }

  /**
   * Detect version from Content-Type (private helper)
   */
  private detectFromContentType(request: GatewayRequest): string | null {
    const contentType = request.headers.get('Content-Type') || '';

    // Parse Content-Type for version
    const versionMatch = contentType.match(/version=v(\d+(?:\.\d+)?)/);

    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }

    return null;
  }

  /**
   * Build routing path (private helper)
   */
  private buildRoutingPath(request: GatewayRequest, version: string): string {
    const originalPath = request.url.pathname;

    if (this.config.strategy === 'url_path') {
      const pathParts = originalPath.split('/').filter(Boolean);

      if (pathParts.length > 0 && pathParts[0].startsWith('v')) {
        // Already has version prefix, return as is
        return originalPath;
      }

      // Add version prefix
      return `/${version}${originalPath}`;
    }

    return originalPath;
  }
}

/**
 * Create a version manager
 */
export function createVersionManager(config: VersionManagerConfig): VersionManager {
  return new VersionManager(config);
}

/**
 * Create an API version
 */
export function createApiVersion(
  version: string,
  status: VersionStatus = 'active',
  releasedAt?: Date
): ApiVersion {
  return {
    version,
    path: `/${version}`,
    status,
    releasedAt: releasedAt || new Date(),
  };
}
