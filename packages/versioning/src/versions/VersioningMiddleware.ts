/**
 * Versioning Middleware for Hono
 */

import { MiddlewareHandler } from 'hono';
import { VersionManager } from './VersionManager.js';
import { DeprecationManager } from '../deprecation/DeprecationManager.js';
import {
  VersioningStrategy,
  VersionContext,
  DeprecationHeaders,
  VersionStatus,
} from '../types/index.js';

export interface VersioningMiddlewareOptions {
  versionManager: VersionManager;
  deprecationManager?: DeprecationManager;
  defaultVersion?: string;
  supportedVersions?: string[];
  strategies?: VersioningStrategy[];
  versionHeader?: string;
  enableDeprecationHeaders?: boolean;
  enableVersionValidation?: boolean;
}

export class VersioningMiddleware {
  private versionManager: VersionManager;
  private deprecationManager?: DeprecationManager;
  private options: Required<Omit<VersioningMiddlewareOptions, 'deprecationManager'>>;

  constructor(options: VersioningMiddlewareOptions) {
    this.versionManager = options.versionManager;
    this.deprecationManager = options.deprecationManager;
    this.options = {
      versionManager: options.versionManager,
      defaultVersion: options.defaultVersion || '1.0.0',
      supportedVersions: options.supportedVersions || [],
      strategies: options.strategies || [
        VersioningStrategy.URL_PATH,
        VersioningStrategy.HEADER,
        VersioningStrategy.ACCEPT_HEADER,
      ],
      versionHeader: options.versionHeader || 'API-Version',
      enableDeprecationHeaders: options.enableDeprecationHeaders ?? true,
      enableVersionValidation: options.enableVersionValidation ?? true,
    };
  }

  /**
   * Create Hono middleware for version resolution
   */
  middleware(): MiddlewareHandler {
    return async (c, next) => {
      // Create version context
      const context = this.createContext(c);

      // Resolve version
      const resolution = this.versionManager.resolveVersion(
        context,
        this.options.strategies
      );

      // Validate version if enabled
      if (this.options.enableVersionValidation) {
        const validation = this.validateVersion(resolution.version);
        if (!validation.valid) {
          return c.json(
            {
              error: 'Unsupported API version',
              version: resolution.version,
              supportedVersions: this.options.supportedVersions,
            },
            400
          );
        }
      }

      // Store version in context
      c.set('apiVersion', resolution.version);
      c.set('versionResolution', resolution);

      // Add deprecation headers if enabled
      if (this.options.enableDeprecationHeaders && this.deprecationManager) {
        const deprecationHeaders = this.getDeprecationHeaders(
          c.req.path,
          resolution.version
        );
        this.setDeprecationHeaders(c, deprecationHeaders);
      }

      // Add version header to response
      c.header('API-Version', resolution.version);

      await next();
    };
  }

  /**
   * Middleware to require specific version
   */
  requireVersion(version: string): MiddlewareHandler {
    return async (c, next) => {
      const currentVersion = c.get('apiVersion');

      if (currentVersion !== version) {
        return c.json(
          {
            error: 'Endpoint requires specific API version',
            requiredVersion: version,
            currentVersion,
          },
          400
        );
      }

      await next();
    };
  }

  /**
   * Middleware to require minimum version
   */
  requireMinVersion(minVersion: string): MiddlewareHandler {
    return async (c, next) => {
      const currentVersion = c.get('apiVersion');

      const comparison = this.versionManager.compareVersions(
        currentVersion,
        minVersion
      );

      if (comparison.upgradeType === 'downgrade') {
        return c.json(
          {
            error: 'Endpoint requires newer API version',
            minimumVersion: minVersion,
            currentVersion,
          },
          400
        );
      }

      await next();
    };
  }

  /**
   * Middleware to require maximum version
   */
  requireMaxVersion(maxVersion: string): MiddlewareHandler {
    return async (c, next) => {
      const currentVersion = c.get('apiVersion');

      const comparison = this.versionManager.compareVersions(
        currentVersion,
        maxVersion
      );

      if (comparison.upgradeType !== 'downgrade' && comparison.difference !== 'equal') {
        return c.json(
          {
            error: 'Endpoint requires older API version',
            maximumVersion: maxVersion,
            currentVersion,
          },
          400
        );
      }

      await next();
    };
  }

  /**
   * Middleware for version range
   */
  requireVersionRange(minVersion: string, maxVersion: string): MiddlewareHandler {
    return async (c, next) => {
      const currentVersion = c.get('apiVersion');

      const minComparison = this.versionManager.compareVersions(
        currentVersion,
        minVersion
      );
      const maxComparison = this.versionManager.compareVersions(
        currentVersion,
        maxVersion
      );

      if (minComparison.upgradeType === 'downgrade') {
        return c.json(
          {
            error: 'API version too old',
            minimumVersion: minVersion,
            currentVersion,
          },
          400
        );
      }

      if (maxComparison.upgradeType !== 'downgrade' && maxComparison.difference !== 'equal') {
        return c.json(
          {
            error: 'API version too new',
            maximumVersion: maxVersion,
            currentVersion,
          },
          400
        );
      }

      await next();
    };
  }

  /**
   * Middleware to handle deprecated endpoints
   */
  deprecateEndpoint(
    endpoint: string,
    sunsetDate: Date,
    options: {
      successorEndpoint?: string;
      successorVersion?: string;
    } = {}
  ): MiddlewareHandler {
    return async (c, next) => {
      const version = c.get('apiVersion');

      // Add deprecation headers
      c.header('Deprecation', 'true');
      c.header('Sunset', sunsetDate.toISOString());

      if (options.successorEndpoint) {
        c.header(
          'Link',
          `<${options.successorEndpoint}>; rel="successor-version"`
        );
      }

      if (options.successorVersion) {
        c.header('Successor-Version', options.successorVersion);
      }

      const daysUntilSunset = Math.ceil(
        (sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      c.header(
        'Warning',
        `299 - "This endpoint is deprecated and will be removed on ${sunsetDate.toISOString()}. Please migrate within ${daysUntilSunset} days."`
      );

      await next();
    };
  }

  /**
   * Create version context from Hono request
   */
  private createContext(c: any): VersionContext {
    return {
      request: c.req.raw,
      headers: c.req.header(),
      query: new URL(c.req.url).searchParams,
      body: c.req.raw.body,
      cookies: c.req.cookie() || {},
    };
  }

  /**
   * Validate version
   */
  private validateVersion(version: string): { valid: boolean; error?: string } {
    if (!this.versionManager.isVersionSupported(version)) {
      return {
        valid: false,
        error: `Version ${version} is not supported`,
      };
    }

    return { valid: true };
  }

  /**
   * Get deprecation headers for endpoint
   */
  private getDeprecationHeaders(
    endpoint: string,
    version: string
  ): DeprecationHeaders {
    if (!this.deprecationManager) {
      return { deprecation: false };
    }

    return this.deprecationManager.generateDeprecationHeaders(endpoint, version);
  }

  /**
   * Set deprecation headers on response
   */
  private setDeprecationHeaders(c: any, headers: DeprecationHeaders): void {
    if (headers.deprecation) {
      c.header('Deprecation', 'true');
    }

    if (headers.sunset) {
      c.header('Sunset', headers.sunset.toISOString());
    }

    if (headers.link) {
      c.header('Link', headers.link);
    }

    if (headers.warning) {
      c.header('Warning', headers.warning);
    }

    if (headers['successor-version']) {
      c.header('Successor-Version', headers['successor-version']);
    }
  }

  /**
   * Create versioned route handler
   */
  versionedHandler(
    handlers: Record<string, any>,
    defaultHandler?: any
  ): MiddlewareHandler {
    return async (c, next) => {
      const version = c.get('apiVersion');
      const handler = handlers[version] || defaultHandler;

      if (!handler) {
        return c.json(
          {
            error: 'No handler for API version',
            version,
            supportedVersions: Object.keys(handlers),
          },
          400
        );
      }

      return handler(c, next);
    };
  }

  /**
   * Get current version from context
   */
  static getCurrentVersion(c: any): string | undefined {
    return c.get('apiVersion');
  }

  /**
   * Get version resolution from context
   */
  static getVersionResolution(c: any): any {
    return c.get('versionResolution');
  }

  /**
   * Check if version matches
   */
  static isVersion(c: any, version: string): boolean {
    return c.get('apiVersion') === version;
  }

  /**
   * Check if version is at least
   */
  static isAtLeastVersion(c: any, version: string, versionManager: VersionManager): boolean {
    const currentVersion = c.get('apiVersion');
    const comparison = versionManager.compareVersions(currentVersion, version);
    return comparison.upgradeType !== 'downgrade';
  }

  /**
   * Check if version is at most
   */
  static isAtMostVersion(c: any, version: string, versionManager: VersionManager): boolean {
    const currentVersion = c.get('apiVersion');
    const comparison = versionManager.compareVersions(currentVersion, version);
    return comparison.upgradeType === 'downgrade' || comparison.difference === 'equal';
  }
}

/**
 * Convenience function to create versioning middleware
 */
export function createVersioningMiddleware(
  options: VersioningMiddlewareOptions
): MiddlewareHandler {
  const middleware = new VersioningMiddleware(options);
  return middleware.middleware();
}

/**
 * Convenience function to require specific version
 */
export function requireVersion(version: string): MiddlewareHandler {
  return async (c, next) => {
    const currentVersion = c.get('apiVersion');

    if (currentVersion !== version) {
      return c.json(
        {
          error: 'Endpoint requires specific API version',
          requiredVersion: version,
          currentVersion,
        },
        400
      );
    }

    await next();
  };
}
