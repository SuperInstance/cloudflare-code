/**
 * API Versioning v2
 * Supports multiple versioning strategies: URL, header, query parameter, content-type
 */

import {
  VersioningConfig,
  VersionDefinition,
  VersionedRequest,
  VersionedResponse,
  GatewayError,
} from '../types';

// ============================================================================
// Version Manager
// ============================================================================

export class VersionManager {
  private config: VersioningConfig;
  private versions: Map<string, VersionDefinition>;
  private transformers: Map<string, VersionTransformer>;

  constructor(config: VersioningConfig) {
    this.config = config;
    this.versions = new Map();
    this.transformers = new Map();

    this.initializeVersions();
  }

  /**
   * Initialize version definitions
   */
  private initializeVersions(): void {
    for (const version of this.config.versions) {
      this.versions.set(version.version, version);
    }
  }

  /**
   * Extract version from request
   */
  extractVersion(request: Request): string {
    switch (this.config.strategy) {
      case 'url':
        return this.extractFromURL(request);
      case 'header':
        return this.extractFromHeader(request);
      case 'query':
        return this.extractFromQuery(request);
      case 'content-type':
        return this.extractFromContentType(request);
      default:
        return this.config.defaultVersion;
    }
  }

  /**
   * Extract version from URL path
   */
  private extractFromURL(request: Request): string {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Check first path segment for version
    if (pathParts.length > 0) {
      const maybeVersion = pathParts[0];
      if (this.versions.has(maybeVersion)) {
        return maybeVersion;
      }

      // Check for v prefix (e.g., v1, v2)
      const vPrefixed = maybeVersion.match(/^v(\d+)$/);
      if (vPrefixed) {
        const version = vPrefixed[1];
        if (this.versions.has(version)) {
          return version;
        }
      }
    }

    return this.config.defaultVersion;
  }

  /**
   * Extract version from header
   */
  private extractFromHeader(request: Request): string {
    const versionHeader = request.headers.get('API-Version');
    if (versionHeader && this.versions.has(versionHeader)) {
      return versionHeader;
    }

    const acceptHeader = request.headers.get('Accept');
    if (acceptHeader) {
      // Parse Accept header for version
      const match = acceptHeader.match(/application\/vnd\.api\+json; version=(\d+)/);
      if (match) {
        const version = match[1];
        if (this.versions.has(version)) {
          return version;
        }
      }
    }

    return this.config.defaultVersion;
  }

  /**
   * Extract version from query parameter
   */
  private extractFromQuery(request: Request): string {
    const url = new URL(request.url);
    const versionParam = url.searchParams.get('version');

    if (versionParam && this.versions.has(versionParam)) {
      return versionParam;
    }

    return this.config.defaultVersion;
  }

  /**
   * Extract version from Content-Type header
   */
  private extractFromContentType(request: Request): string {
    const contentType = request.headers.get('Content-Type');

    if (contentType) {
      // Parse Content-Type for version
      const match = contentType.match(/application\/vnd\.api\.v(\d+)\+json/);
      if (match) {
        const version = match[1];
        if (this.versions.has(version)) {
          return version;
        }
      }
    }

    return this.config.defaultVersion;
  }

  /**
   * Create versioned request
   */
  async createVersionedRequest(request: Request): Promise<VersionedRequest> {
    const version = this.extractVersion(request);
    const versionDef = this.versions.get(version);

    if (!versionDef) {
      throw new GatewayError(
        `Unsupported API version: ${version}`,
        'UNSUPPORTED_VERSION',
        400
      );
    }

    // Transform request if needed
    let transformedRequest = request;
    if (versionDef.transformations) {
      for (const transformation of versionDef.transformations) {
        if (transformation.type === 'request') {
          transformedRequest = await this.transformRequest(
            transformedRequest,
            transformation
          );
        }
      }
    }

    return {
      version,
      originalRequest: request,
      transformedRequest,
    };
  }

  /**
   * Create versioned response
   */
  async createVersionedResponse(
    version: string,
    data: any,
    headers?: Record<string, string>
  ): Promise<VersionedResponse> {
    const versionDef = this.versions.get(version);

    if (!versionDef) {
      throw new GatewayError(
        `Unsupported API version: ${version}`,
        'UNSUPPORTED_VERSION',
        400
      );
    }

    // Transform response data if needed
    let transformedData = data;
    if (versionDef.transformations) {
      for (const transformation of versionDef.transformations) {
        if (transformation.type === 'response') {
          transformedData = await this.transformResponse(
            transformedData,
            transformation
          );
        }
      }
    }

    return {
      version,
      data: transformedData,
      headers: {
        ...versionDef.headers,
        ...headers,
      },
    };
  }

  /**
   * Transform request according to version schema
   */
  private async transformRequest(
    request: Request,
    transformation: any
  ): Promise<Request> {
    // Apply request transformation logic
    // This would use the schema to transform the request
    return request;
  }

  /**
   * Transform response according to version schema
   */
  private async transformResponse(
    data: any,
    transformation: any
  ): Promise<any> {
    // Apply response transformation logic
    // This would use the schema to transform the response data
    return data;
  }

  /**
   * Map service call to version-specific endpoint
   */
  getServiceEndpoint(serviceName: string, version: string): string {
    const versionDef = this.versions.get(version);

    if (!versionDef) {
      throw new GatewayError(
        `Unsupported API version: ${version}`,
        'UNSUPPORTED_VERSION',
        400
      );
    }

    return versionDef.services.get(serviceName) || serviceName;
  }

  /**
   * Check if version is deprecated
   */
  isDeprecated(version: string): boolean {
    const versionDef = this.versions.get(version);
    return versionDef?.deprecated || false;
  }

  /**
   * Get sunset date for version
   */
  getSunsetDate(version: string): Date | undefined {
    const versionDef = this.versions.get(version);
    return versionDef?.sunsetAt
      ? new Date(versionDef.sunsetAt)
      : undefined;
  }

  /**
   * Get supported versions
   */
  getSupportedVersions(): string[] {
    return Array.from(this.versions.keys());
  }

  /**
   * Get version definition
   */
  getVersionDefinition(version: string): VersionDefinition | undefined {
    return this.versions.get(version);
  }

  /**
   * Register version transformer
   */
  registerTransformer(
    fromVersion: string,
    toVersion: string,
    transformer: VersionTransformer
  ): void {
    const key = `${fromVersion}:${toVersion}`;
    this.transformers.set(key, transformer);
  }

  /**
   * Transform data between versions
   */
  async transformBetweenVersions(
    data: any,
    fromVersion: string,
    toVersion: string
  ): Promise<any> {
    if (fromVersion === toVersion) {
      return data;
    }

    const key = `${fromVersion}:${toVersion}`;
    const transformer = this.transformers.get(key);

    if (!transformer) {
      throw new GatewayError(
        `No transformer found from ${fromVersion} to ${toVersion}`,
        'TRANSFORMER_NOT_FOUND',
        500
      );
    }

    return transformer(data);
  }

  /**
   * Add version headers to response
   */
  addVersionHeaders(
    response: Response,
    version: string
  ): Response {
    const versionDef = this.versions.get(version);
    const headers = new Headers(response.headers);

    headers.set('API-Version', version);

    if (versionDef?.deprecated) {
      headers.set('Deprecation', 'true');
      const sunsetDate = this.getSunsetDate(version);
      if (sunsetDate) {
        headers.set('Sunset', sunsetDate.toUTCString());
      }
    }

    // Add supported versions header
    headers.set('API-Supported-Versions', this.getSupportedVersions().join(', '));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

// ============================================================================
// Types
// ============================================================================

export type VersionTransformer = (data: any) => any | Promise<any>;

// ============================================================================
// Middleware
// ============================================================================

/**
 * Create versioning middleware
 */
export function createVersioningMiddleware(config: VersioningConfig) {
  const manager = new VersionManager(config);

  return async (request: Request): Promise<Request> => {
    const versioned = await manager.createVersionedRequest(request);
    return versioned.transformedRequest ?? request;
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Validate versioning configuration
 */
export function validateVersioningConfig(config: VersioningConfig): void {
  const validStrategies = ['url', 'header', 'query', 'content-type'];
  if (!validStrategies.includes(config.strategy)) {
    throw new GatewayError(
      `Invalid versioning strategy: ${config.strategy}`,
      'INVALID_CONFIG',
      400
    );
  }

  if (!config.versions || config.versions.length === 0) {
    throw new GatewayError(
      'At least one version must be defined',
      'INVALID_CONFIG',
      400
    );
  }

  // Check that default version exists
  const defaultExists = config.versions.some(v => v.version === config.defaultVersion);
  if (!defaultExists) {
    throw new GatewayError(
      `Default version ${config.defaultVersion} not found in versions list`,
      'INVALID_CONFIG',
      400
    );
  }

  // Validate each version
  for (const version of config.versions) {
    if (!version.version) {
      throw new GatewayError(
        'Version must have a version string',
        'INVALID_CONFIG',
        400
      );
    }

    if (version.sunsetAt && !version.deprecated) {
      throw new GatewayError(
        `Version ${version.version} has sunset date but is not marked as deprecated`,
        'INVALID_CONFIG',
        400
      );
    }
  }
}

/**
 * Create default versioning config
 */
export function createDefaultVersioningConfig(): VersioningConfig {
  return {
    strategy: 'header',
    defaultVersion: '1',
    versions: [
      {
        version: '1',
        deprecated: false,
        services: new Map(),
        headers: {},
        transformations: [],
      },
    ],
  };
}

/**
 * Create version definition
 */
export function createVersionDefinition(
  version: string,
  options?: Partial<VersionDefinition>
): VersionDefinition {
  return {
    version,
    deprecated: options?.deprecated || false,
    sunsetAt: options?.sunsetAt,
    services: options?.services || new Map(),
    headers: options?.headers || {},
    transformations: options?.transformations || [],
  };
}
