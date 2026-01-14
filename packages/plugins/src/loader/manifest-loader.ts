/**
 * Plugin manifest loader and validator
 */

import type { PluginManifest, PluginVersion, PluginId } from '../types';
import { z } from 'zod';
import { PluginValidationError } from '../types/errors';

/**
 * Plugin manifest schema
 */
const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/),
  minPlatformVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  maxPlatformVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  type: z.enum([
    'ai_provider',
    'agent',
    'tool',
    'storage',
    'auth',
    'analytics',
    'webhook',
    'middleware',
    'custom',
  ]),
  author: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    organization: z.string().optional(),
  }),
  license: z.string().min(1),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  documentation: z.string().url().optional(),
  bugs: z.string().url().optional(),
  keywords: z.array(z.string().min(1).max(50)).max(20),
  capabilities: z.object({
    sandboxed: z.boolean().default(false),
    hotReload: z.boolean().default(false),
    networkAccess: z.boolean().default(false),
    fsAccess: z.boolean().default(false),
    dbAccess: z.boolean().default(false),
    customPermissions: z.array(z.string()).default([]),
  }),
  dependencies: z.array(
    z.object({
      pluginId: z.string().regex(/^[a-z0-9-]+$/),
      version: z.string(),
      required: z.boolean().default(true),
    })
  ).optional(),
  main: z.string(),
  icons: z.object({
    small: z.string().optional(),
    large: z.string().optional(),
  }).optional(),
  screenshots: z.array(z.string().url()).max(10).optional(),
  configSchema: z.record(z.any()).optional(),
  requiredSecrets: z.array(z.string()).optional(),
  envVars: z.record(z.string()).optional(),
  provides: z.array(z.string()).optional(),
  subscribes: z.array(z.string()).optional(),
  apiRoutes: z.array(z.string()).optional(),
  webhooks: z.array(z.string()).optional(),
});

/**
 * Manifest loader options
 */
export interface ManifestLoaderOptions {
  /**
   * Strict mode - reject manifests with warnings
   */
  strict?: boolean;

  /**
   * Allow additional properties not in schema
   */
  allowAdditionalProperties?: boolean;

  /**
   * Custom validation rules
   */
  customValidators?: Array<(manifest: PluginManifest) => Promise<void> | void>;

  /**
   * Base URL for resolving relative URLs
   */
  baseUrl?: string;
}

/**
 * Manifest validation result
 */
export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Plugin manifest loader
 */
export class ManifestLoader {
  constructor(private options: ManifestLoaderOptions = {}) {}

  /**
   * Load manifest from JSON string
   */
  async loadFromJSON(json: string): Promise<PluginManifest> {
    try {
      const data = JSON.parse(json);
      return this.validate(data);
    } catch (error) {
      if (error instanceof PluginValidationError) {
        throw error;
      }
      throw new PluginValidationError(
        'unknown',
        'Invalid manifest JSON',
        [(error as Error).message]
      );
    }
  }

  /**
   * Load manifest from object
   */
  async loadFromObject(data: unknown): Promise<PluginManifest> {
    return this.validate(data);
  }

  /**
   * Validate manifest
   */
  async validate(data: unknown): Promise<PluginManifest> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse with Zod
      const manifest = PluginManifestSchema.parse(data);

      // Custom validations
      await this.runCustomValidations(manifest, warnings);

      // Check for warnings in strict mode
      if (this.options.strict && warnings.length > 0) {
        throw new PluginValidationError(
          manifest.id,
          'Manifest validation failed due to warnings',
          warnings
        );
      }

      return manifest;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(
          (e) => `${e.path.join('.')}: ${e.message}`
        );
        throw new PluginValidationError(
          'unknown',
          'Manifest schema validation failed',
          validationErrors
        );
      }
      throw error;
    }
  }

  /**
   * Validate manifest without throwing
   */
  async validateSafe(data: unknown): Promise<ManifestValidationResult> {
    try {
      await this.validate(data);
      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      if (error instanceof PluginValidationError) {
        return {
          valid: false,
          errors: error.validationErrors,
          warnings: [],
        };
      }
      return {
        valid: false,
        errors: [(error as Error).message],
        warnings: [],
      };
    }
  }

  /**
   * Run custom validations
   */
  private async runCustomValidations(
    manifest: PluginManifest,
    warnings: string[]
  ): Promise<void> {
    // Validate version compatibility
    if (manifest.maxPlatformVersion) {
      const min = manifest.minPlatformVersion.split('.').map(Number);
      const max = manifest.maxPlatformVersion.split('.').map(Number);

      if (min[0] > max[0] || (min[0] === max[0] && min[1] > max[1])) {
        warnings.push(
          `minPlatformVersion (${manifest.minPlatformVersion}) is greater than maxPlatformVersion (${manifest.maxPlatformVersion})`
        );
      }
    }

    // Validate keywords
    if (manifest.keywords.length === 0) {
      warnings.push('Plugin has no keywords, which may reduce discoverability');
    }

    // Validate URLs if present
    if (manifest.homepage && !this.isValidURL(manifest.homepage)) {
      throw new PluginValidationError(
        manifest.id,
        'Invalid homepage URL',
        [manifest.homepage]
      );
    }

    if (manifest.repository && !this.isValidURL(manifest.repository)) {
      throw new PluginValidationError(
        manifest.id,
        'Invalid repository URL',
        [manifest.repository]
      );
    }

    // Validate capabilities consistency
    if (manifest.capabilities.sandboxed && manifest.capabilities.fsAccess) {
      warnings.push(
        'Sandboxed plugins with file system access may have limited functionality'
      );
    }

    // Validate hooks
    if (manifest.provides && manifest.provides.length === 0) {
      warnings.push('Plugin provides no hooks');
    }

    if (manifest.subscribes && manifest.subscribes.length === 0) {
      // This is fine, just informational
    }

    // Run custom validators
    if (this.options.customValidators) {
      for (const validator of this.options.customValidators) {
        await validator(manifest);
      }
    }
  }

  /**
   * Check if string is valid URL
   */
  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create manifest template
   */
  createTemplate(): Partial<PluginManifest> {
    return {
      id: 'example-plugin',
      name: 'Example Plugin',
      description: 'An example plugin for ClaudeFlare',
      version: '1.0.0',
      minPlatformVersion: '1.0.0',
      type: 'custom',
      author: {
        name: 'Your Name',
        email: 'your.email@example.com',
      },
      license: 'MIT',
      keywords: ['example', 'plugin', 'claudeflare'],
      capabilities: {
        sandboxed: false,
        hotReload: false,
        networkAccess: false,
        fsAccess: false,
        dbAccess: false,
        customPermissions: [],
      },
      main: 'index.js',
    };
  }

  /**
   * Merge manifests (for updates)
   */
  mergeManifests(
    base: PluginManifest,
    update: Partial<PluginManifest>
  ): PluginManifest {
    return {
      ...base,
      ...update,
      author: { ...base.author, ...update.author },
      capabilities: { ...base.capabilities, ...update.capabilities },
      icons: { ...base.icons, ...update.icons },
    };
  }

  /**
   * Compare versions
   */
  compareVersions(v1: PluginVersion, v2: PluginVersion): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }

    return 0;
  }

  /**
   * Check if version satisfies constraint
   */
  satisfiesVersion(version: PluginVersion, constraint: string): boolean {
    // Simple semver matching (for full implementation, use semver library)
    const versionParts = version.split('.').map(Number);
    const constraintParts = constraint.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (constraintParts[i] !== undefined && versionParts[i] !== constraintParts[i]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Global manifest loader instance
 */
export const globalManifestLoader = new ManifestLoader();

/**
 * Convenience function to load manifest from JSON
 */
export async function loadManifest(json: string): Promise<PluginManifest> {
  return globalManifestLoader.loadFromJSON(json);
}

/**
 * Convenience function to validate manifest
 */
export async function validateManifest(data: unknown): Promise<PluginManifest> {
  return globalManifestLoader.loadFromObject(data);
}
