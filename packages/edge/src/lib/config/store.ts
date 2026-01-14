/**
 * Configuration Durable Object
 *
 * Stores configuration in a Durable Object for fast access
 * and automatic persistence. Provides eventual consistency
 * with KV for backup.
 */

import type {
  AppConfig,
  ConfigVersion,
  ConfigChange,
  EvaluationContext,
  EvaluationResult,
} from './types';
import { ConfigValidator } from './validation';

/**
 * Configuration DO state
 */
interface ConfigDOState {
  config: AppConfig;
  versions: ConfigVersion[];
  changes: ConfigChange[];
  currentVersion: number;
  lastModified: number;
}

/**
 * Configuration Durable Object
 */
export class ConfigDurableObject {
  private state: DurableObjectState;
  private env: {
    CONFIG_KV: KVNamespace;
  };

  // In-memory state
  private memoryState: ConfigDOState;

  constructor(state: DurableObjectState, env: { CONFIG_KV: KVNamespace }) {
    this.state = state;
    this.env = env;

    // Initialize from storage or create default
    this.memoryState = {
      config: this.getDefaultConfig(),
      versions: [],
      changes: [],
      currentVersion: 0,
      lastModified: Date.now(),
    };
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/get':
          return this.handleGet(request);

        case '/set':
          return this.handleSet(request);

        case '/evaluate':
          return this.handleEvaluate(request);

        case '/rollback':
          return this.handleRollback(request);

        case '/history':
          return this.handleHistory(request);

        case '/versions':
          return this.handleVersions(request);

        case '/sync':
          return this.handleSync(request);

        case '/health':
          return this.handleHealth();

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get current configuration
   */
  private async handleGet(request: Request): Promise<Response> {
    // Ensure storage is loaded
    await this.ensureLoaded();

    return new Response(JSON.stringify(this.memoryState.config), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Set configuration value
   */
  private async handleSet(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const body = await request.json();
    const { path, value, author, reason } = body;

    if (!path || value === undefined) {
      return new Response('Missing path or value', { status: 400 });
    }

    // Validate update
    const validation = ConfigValidator.validatePartialUpdate(path, value);
    if (!validation.valid) {
      return new Response(JSON.stringify({ errors: validation.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get old value
    const oldValue = this.getNestedValue(this.memoryState.config, path);

    // Set new value
    this.setNestedValue(this.memoryState.config, path, value);

    // Record change
    const change: ConfigChange = {
      type: 'update',
      path,
      oldValue,
      newValue: value,
      author: author || 'unknown',
      timestamp: Date.now(),
      reason,
    };

    this.memoryState.changes.push(change);

    // Increment version
    this.memoryState.currentVersion++;
    this.memoryState.lastModified = Date.now();

    // Persist to storage
    await this.persist();

    // Sync to KV
    await this.syncToKV();

    return new Response(
      JSON.stringify({
        success: true,
        version: this.memoryState.currentVersion,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Evaluate feature flag
   */
  private async handleEvaluate(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const body = await request.json();
    const { flagName, context } = body;

    if (!flagName) {
      return new Response('Missing flagName', { status: 400 });
    }

    const result = this.evaluateFeatureFlag(flagName, context || {});

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Rollback to previous version
   */
  private async handleRollback(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const body = await request.json();
    const { targetVersion, author } = body;

    if (targetVersion === undefined) {
      return new Response('Missing targetVersion', { status: 400 });
    }

    // Validate rollback
    const validation = ConfigValidator.validateRollback(
      this.memoryState.currentVersion,
      targetVersion
    );

    if (!validation.valid) {
      return new Response(JSON.stringify({ errors: validation.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find target version
    const version = this.memoryState.versions.find(
      (v) => v.version === targetVersion
    );

    if (!version) {
      return new Response('Version not found', { status: 404 });
    }

    // Apply rollback
    this.memoryState.config = this.deepMerge(
      this.memoryState.config,
      version.config
    );

    // Record rollback
    const change: ConfigChange = {
      type: 'rollback',
      path: '(root)',
      oldValue: this.memoryState.config,
      newValue: version.config,
      author: author || 'unknown',
      timestamp: Date.now(),
      reason: `Rollback to version ${targetVersion}`,
    };

    this.memoryState.changes.push(change);
    this.memoryState.currentVersion++;
    this.memoryState.lastModified = Date.now();

    // Persist
    await this.persist();

    return new Response(
      JSON.stringify({
        success: true,
        version: this.memoryState.currentVersion,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get change history
   */
  private async handleHistory(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const history = this.memoryState.changes.slice(-limit).reverse();

    return new Response(JSON.stringify(history), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Get version history
   */
  private async handleVersions(request: Request): Promise<Response> {
    await this.ensureLoaded();

    return new Response(JSON.stringify(this.memoryState.versions), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Sync from KV
   */
  private async handleSync(request: Request): Promise<Response> {
    await this.syncFromKV();

    return new Response(
      JSON.stringify({
        success: true,
        version: this.memoryState.currentVersion,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Health check
   */
  private async handleHealth(): Promise<Response> {
    const health = {
      status: 'healthy',
      version: this.memoryState.currentVersion,
      lastModified: this.memoryState.lastModified,
      timestamp: Date.now(),
    };

    return new Response(JSON.stringify(health), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Ensure state is loaded from storage
   */
  private async ensureLoaded(): Promise<void> {
    if (this.memoryState.currentVersion === 0) {
      await this.loadFromStorage();
    }
  }

  /**
   * Load state from Durable Object storage
   */
  private async loadFromStorage(): Promise<void> {
    const data = await this.state.storage.get<ConfigDOState>('config');

    if (data) {
      this.memoryState = data;
    } else {
      // Try loading from KV as backup
      await this.syncFromKV();
    }
  }

  /**
   * Persist state to Durable Object storage
   */
  private async persist(): Promise<void> {
    await this.state.storage.put('config', this.memoryState);

    // Create version snapshot
    const version: ConfigVersion = {
      version: this.memoryState.currentVersion,
      config: this.deepClone(this.memoryState.config),
      author: 'system',
      description: 'Automatic version snapshot',
      timestamp: Date.now(),
    };

    this.memoryState.versions.push(version);

    // Keep only last 100 versions
    if (this.memoryState.versions.length > 100) {
      this.memoryState.versions = this.memoryState.versions.slice(-100);
    }

    // Keep only last 1000 changes
    if (this.memoryState.changes.length > 1000) {
      this.memoryState.changes = this.memoryState.changes.slice(-1000);
    }
  }

  /**
   * Sync to KV for backup
   */
  private async syncToKV(): Promise<void> {
    try {
      const key = 'config:snapshot';
      await this.env.CONFIG_KV.put(key, JSON.stringify(this.memoryState), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
    } catch (error) {
      console.error('Failed to sync to KV:', error);
    }
  }

  /**
   * Sync from KV for recovery
   */
  private async syncFromKV(): Promise<void> {
    try {
      const key = 'config:snapshot';
      const data = await this.env.CONFIG_KV.get(key, 'text');

      if (data) {
        const parsed = JSON.parse(data) as ConfigDOState;
        this.memoryState = parsed;
      }
    } catch (error) {
      console.error('Failed to sync from KV:', error);
    }
  }

  /**
   * Evaluate feature flag
   */
  private evaluateFeatureFlag(
    flagName: string,
    context: EvaluationContext
  ): EvaluationResult {
    const flag = this.getNestedValue(this.memoryState.config, `features.${flagName}`);

    if (!flag) {
      return {
        enabled: false,
        reason: `Feature flag "${flagName}" not found`,
      };
    }

    if (!flag.enabled) {
      return {
        enabled: false,
        reason: `Feature flag "${flagName}" is disabled`,
      };
    }

    // Check targeting rules
    if (flag.targeting.tier !== 'all' && context.tier !== flag.targeting.tier) {
      return {
        enabled: false,
        reason: `User tier "${context.tier}" does not match`,
      };
    }

    if (flag.targeting.users.length > 0 && context.userId) {
      if (flag.targeting.users.includes(context.userId)) {
        return {
          enabled: true,
          reason: 'User is explicitly targeted',
          config: flag.metadata,
        };
      }
    }

    if (flag.targeting.percentage > 0) {
      const bucket = this.getBucketForUser(flagName, context.userId || 'anonymous');
      if (bucket < flag.targeting.percentage) {
        return {
          enabled: true,
          reason: `User in ${flag.targeting.percentage}% rollout`,
          config: flag.metadata,
        };
      }
      return {
        enabled: false,
        reason: `User not in ${flag.targeting.percentage}% rollout`,
      };
    }

    return {
      enabled: true,
      reason: 'Feature flag enabled',
      config: flag.metadata,
    };
  }

  /**
   * Get consistent bucket for user
   */
  private getBucketForUser(flagName: string, userId: string): number {
    const input = `${flagName}:${userId}`;
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Get nested value by path
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set nested value by path
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target: unknown = obj;

    for (const key of keys) {
      if (target && typeof target === 'object' && key in target) {
        target = (target as Record<string, unknown>)[key];
      } else {
        throw new Error(`Invalid path: ${path}`);
      }
    }

    if (target && typeof target === 'object') {
      (target as Record<string, unknown>)[lastKey] = value;
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Partial<T>
  ): T {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            (output as Record<string, unknown>)[key] = this.deepMerge(
              target[key] as Record<string, unknown>,
              source[key] as Record<string, unknown>
            );
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Deep clone object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
      version: '0.1.0',
      environment: 'development',
      features: {
        websockets: {
          name: 'websockets',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        codeIndexing: {
          name: 'codeIndexing',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        advancedCache: {
          name: 'advancedCache',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        realTimeCollaboration: {
          name: 'realTimeCollaboration',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        fileUploads: {
          name: 'fileUploads',
          enabled: false,
          targeting: {
            users: [],
            percentage: 0,
            organizations: [],
            tier: 'all',
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      providers: {
        defaultProvider: 'anthropic',
        fallbackChain: ['openai', 'google', 'cohere'],
        modelPreferences: {},
        providerSettings: {},
      },
      rateLimits: {
        free: { rpm: 10, rpd: 100 },
        pro: { rpm: 100, rpd: 1000 },
        enterprise: { rpm: 1000, rpd: 10000 },
      },
      ui: {
        maxMessageLength: 10000,
        enableStreaming: true,
        theme: 'auto',
        features: {
          websockets: false,
          codeIndexing: false,
          advancedCache: false,
          fileUploads: false,
          collaboration: false,
        },
      },
      cache: {
        kv: {
          defaultTTL: 604800,
          compression: true,
          maxSize: 1073741824,
        },
        do: {
          maxEntries: 10000,
          ttl: 3600,
          persistence: true,
        },
      },
      monitoring: {
        metrics: {
          enabled: true,
          samplingRate: 0.1,
          exportInterval: 60000,
          includeMetrics: ['latency', 'throughput', 'errors'],
        },
        logging: {
          level: 'info',
          structured: true,
          samplingRate: 1.0,
        },
        tracing: {
          enabled: true,
          samplingRate: 0.01,
        },
      },
      security: {
        rateLimiting: {
          enabled: true,
          strategy: 'token-bucket',
          limits: {
            free: { rpm: 10, rpd: 100 },
            pro: { rpm: 100, rpd: 1000 },
            enterprise: { rpm: 1000, rpd: 10000 },
          },
        },
        auth: {
          sessionDuration: 86400,
          maxSessionsPerUser: 5,
          mfaEnabled: false,
          allowedOrigins: ['*'],
        },
        csp: {
          enabled: false,
          policy: '',
        },
      },
    };
  }
}

function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}
