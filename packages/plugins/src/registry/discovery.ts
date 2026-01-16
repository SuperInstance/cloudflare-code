// @ts-nocheck
/**
 * Plugin discovery system
 */

import type { PluginManifest, PluginId } from '../types';
import { PluginRegistry } from './plugin-registry';
import { globalManifestLoader } from '../loader';
import { RegistryError } from '../types/errors';

/**
 * Discovery source
 */
export interface DiscoverySource {
  /**
   * Source name
   */
  name: string;

  /**
   * Source type
   */
  type: 'local' | 'remote' | 'registry' | 'marketplace';

  /**
   * Source URL or path
   */
  location: string;

  /**
   * Priority (higher = checked first)
   */
  priority: number;

  /**
   * Enabled
   */
  enabled: boolean;

  /**
   * Authentication credentials (if needed)
   */
  auth?: {
    type: 'basic' | 'bearer' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
  };
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  source: string;
  manifests: PluginManifest[];
  errors: Array<{ pluginId: string; error: string }>;
  duration: number;
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /**
   * Maximum concurrent requests
   */
  maxConcurrent?: number;

  /**
   * Timeout per source (ms)
   */
  timeout?: number;

  /**
   * Continue on error
   */
  continueOnError?: boolean;

  /**
   * Validate manifests
   */
  validate?: boolean;

  /**
   * Filter by type
   */
  type?: string;

  /**
   * Minimum version
   */
  minVersion?: string;
}

/**
 * Plugin discovery service
 */
export class PluginDiscovery {
  private sources: Map<string, DiscoverySource> = new Map();

  constructor(private registry: PluginRegistry) {}

  /**
   * Add discovery source
   */
  addSource(source: DiscoverySource): void {
    this.sources.set(source.name, source);
  }

  /**
   * Remove discovery source
   */
  removeSource(name: string): void {
    this.sources.delete(name);
  }

  /**
   * Get discovery source
   */
  getSource(name: string): DiscoverySource | undefined {
    return this.sources.get(name);
  }

  /**
   * Get all discovery sources
   */
  getSources(): DiscoverySource[] {
    return Array.from(this.sources.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Discover plugins from all sources
   */
  async discover(options: DiscoveryOptions = {}): Promise<DiscoveryResult[]> {
    const sources = this.getSources().filter((s) => s.enabled);
    const results: DiscoveryResult[] = [];

    const maxConcurrent = options.maxConcurrent || 5;

    // Process in batches
    for (let i = 0; i < sources.length; i += maxConcurrent) {
      const batch = sources.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((source) =>
          this.discoverFromSource(source, options).catch((error) => ({
            source: source.name,
            manifests: [],
            errors: [{ pluginId: 'unknown', error: (error as Error).message }],
            duration: 0,
          }))
        )
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Discover plugins from a specific source
   */
  async discoverFromSource(
    source: DiscoverySource,
    options: DiscoveryOptions = {}
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const manifests: PluginManifest[] = [];
    const errors: Array<{ pluginId: string; error: string }> = [];

    try {
      switch (source.type) {
        case 'local':
          return await this.discoverLocal(source, options);
        case 'remote':
          return await this.discoverRemote(source, options);
        case 'registry':
          return await this.discoverRegistry(source, options);
        case 'marketplace':
          return await this.discoverMarketplace(source, options);
        default:
          throw new RegistryError(`Unknown discovery source type: ${source.type}`);
      }
    } catch (error) {
      return {
        source: source.name,
        manifests,
        errors: [{ pluginId: 'unknown', error: (error as Error).message }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Discover plugins from local directory
   */
  private async discoverLocal(
    source: DiscoverySource,
    options: DiscoveryOptions
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const manifests: PluginManifest[] = [];
    const errors: Array<{ pluginId: string; error: string }> = [];

    try {
      // In a real implementation, this would scan the directory for plugin manifests
      // For now, return empty result
      return {
        source: source.name,
        manifests,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        source: source.name,
        manifests,
        errors: [{ pluginId: 'unknown', error: (error as Error).message }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Discover plugins from remote URL
   */
  private async discoverRemote(
    source: DiscoverySource,
    options: DiscoveryOptions
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const manifests: PluginManifest[] = [];
    const errors: Array<{ pluginId: string; error: string }> = [];

    try {
      const headers: HeadersInit = {};

      // Add authentication
      if (source.auth) {
        switch (source.auth.type) {
          case 'bearer':
            headers['Authorization'] = `Bearer ${source.auth.token}`;
            break;
          case 'basic':
            headers['Authorization'] = `Basic ${btoa(`${source.auth.username}:${source.auth.password}`)}`;
            break;
          case 'api-key':
            headers['X-API-Key'] = source.auth.apiKey;
            break;
        }
      }

      const response = await fetch(source.location, {
        headers,
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse manifests
      if (Array.isArray(data)) {
        for (const item of data) {
          try {
            if (options.validate) {
              const manifest = await globalManifestLoader.loadFromObject(item);
              manifests.push(manifest);
            } else {
              manifests.push(item as PluginManifest);
            }
          } catch (error) {
            errors.push({
              pluginId: item.id || 'unknown',
              error: (error as Error).message,
            });
          }
        }
      }

      return {
        source: source.name,
        manifests,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        source: source.name,
        manifests,
        errors: [{ pluginId: 'unknown', error: (error as Error).message }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Discover plugins from registry
   */
  private async discoverRegistry(
    source: DiscoverySource,
    options: DiscoveryOptions
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const manifests: PluginManifest[] = [];
    const errors: Array<{ pluginId: string; error: string }> = [];

    try {
      // Query registry API
      const url = new URL(source.location);

      if (options.type) {
        url.searchParams.set('type', options.type);
      }

      if (options.minVersion) {
        url.searchParams.set('minVersion', options.minVersion);
      }

      const headers: HeadersInit = {};

      if (source.auth?.token) {
        headers['Authorization'] = `Bearer ${source.auth.token}`;
      }

      const response = await fetch(url.toString(), {
        headers,
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse manifests
      if (Array.isArray(data.plugins || data)) {
        const plugins = data.plugins || data;
        for (const item of plugins) {
          try {
            if (options.validate) {
              const manifest = await globalManifestLoader.loadFromObject(item);
              manifests.push(manifest);
            } else {
              manifests.push(item as PluginManifest);
            }
          } catch (error) {
            errors.push({
              pluginId: item.id || 'unknown',
              error: (error as Error).message,
            });
          }
        }
      }

      return {
        source: source.name,
        manifests,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        source: source.name,
        manifests,
        errors: [{ pluginId: 'unknown', error: (error as Error).message }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Discover plugins from marketplace
   */
  private async discoverMarketplace(
    source: DiscoverySource,
    options: DiscoveryOptions
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const manifests: PluginManifest[] = [];
    const errors: Array<{ pluginId: string; error: string }> = [];

    try {
      const url = new URL(source.location);
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (source.auth?.token) {
        headers['Authorization'] = `Bearer ${source.auth.token}`;
      }

      const response = await fetch(url.toString(), {
        headers,
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse manifests from marketplace format
      const plugins = data.results || data.plugins || data;
      for (const item of plugins) {
        try {
          // Marketplace might have different format, adapt as needed
          const manifestData = item.manifest || item;
          if (options.validate) {
            const manifest = await globalManifestLoader.loadFromObject(manifestData);
            manifests.push(manifest);
          } else {
            manifests.push(manifestData as PluginManifest);
          }
        } catch (error) {
          errors.push({
            pluginId: item.id || 'unknown',
            error: (error as Error).message,
          });
        }
      }

      return {
        source: source.name,
        manifests,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        source: source.name,
        manifests,
        errors: [{ pluginId: 'unknown', error: (error as Error).message }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Search for plugins
   */
  async search(query: string, options: DiscoveryOptions = {}): Promise<PluginManifest[]> {
    const results = await this.discover(options);
    const allManifests = results.flatMap((r) => r.manifests);

    const queryLower = query.toLowerCase();
    return allManifests.filter((m) =>
      m.name.toLowerCase().includes(queryLower) ||
      m.description.toLowerCase().includes(queryLower) ||
      m.keywords.some((k) => k.toLowerCase().includes(queryLower))
    );
  }

  /**
   * Get featured plugins
   */
  async getFeatured(options: DiscoveryOptions = {}): Promise<PluginManifest[]> {
    // In a real implementation, this would query a marketplace for featured plugins
    const results = await this.discover(options);
    return results.flatMap((r) => r.manifests).slice(0, 10);
  }

  /**
   * Get popular plugins
   */
  async getPopular(options: DiscoveryOptions = {}): Promise<PluginManifest[]> {
    // In a real implementation, this would query a marketplace for popular plugins
    const results = await this.discover(options);
    return results.flatMap((r) => r.manifests).slice(0, 20);
  }

  /**
   * Get recently updated plugins
   */
  async getRecentlyUpdated(options: DiscoveryOptions = {}): Promise<PluginManifest[]> {
    const results = await this.discover(options);
    return results
      .flatMap((r) => r.manifests)
      .sort((a, b) => {
        const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 20);
  }
}
