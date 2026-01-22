// @ts-nocheck
/**
 * Core plugin type definitions for ClaudeFlare plugin system
 */

import { z } from 'zod';

/**
 * Plugin version schema - follows semantic versioning
 */
export const PluginVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/);

export type PluginVersion = z.infer<typeof PluginVersionSchema>;

/**
 * Plugin identifier - unique ID for each plugin
 */
export const PluginIdSchema = z.string().regex(/^[a-z0-9-]+$/);

export type PluginId = z.infer<typeof PluginIdSchema>;

/**
 * Plugin type enumeration
 */
export enum PluginType {
  AI_PROVIDER = 'ai_provider',
  AGENT = 'agent',
  TOOL = 'tool',
  STORAGE = 'storage',
  AUTH = 'auth',
  ANALYTICS = 'analytics',
  WEBHOOK = 'webhook',
  MIDDLEWARE = 'middleware',
  CUSTOM = 'custom',
}

/**
 * Plugin lifecycle state
 */
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UNLOADING = 'unloading',
}

/**
 * Plugin capability flags
 */
export interface PluginCapabilities {
  /**
   * Can plugin run in sandbox
   */
  sandboxed: boolean;
  /**
   * Supports hot reload
   */
  hotReload: boolean;
  /**
   * Requires network access
   */
  networkAccess: boolean;
  /**
   * Requires file system access
   */
  fsAccess: boolean;
  /**
   * Requires database access
   */
  dbAccess: boolean;
  /**
   * Custom permissions requested
   */
  customPermissions: string[];
}

/**
 * Plugin dependency specification
 */
export interface PluginDependency {
  /**
   * Plugin ID being depended on
   */
  pluginId: PluginId;
  /**
   * Version constraint (e.g., "^1.0.0", ">=2.0.0")
   */
  version: string;
  /**
   * Whether this is a required or optional dependency
   */
  required: boolean;
}

/**
 * Plugin author information
 */
export interface PluginAuthor {
  /**
   * Author name
   */
  name: string;
  /**
   * Author email
   */
  email?: string;
  /**
   * Author website
   */
  website?: string;
  /**
   * Author organization
   */
  organization?: string;
}

/**
 * Plugin manifest schema
 */
export interface PluginManifest {
  /**
   * Unique plugin identifier
   */
  id: PluginId;

  /**
   * Human-readable plugin name
   */
  name: string;

  /**
   * Plugin description
   */
  description: string;

  /**
   * Plugin version
   */
  version: PluginVersion;

  /**
   * Minimum ClaudeFlare version required
   */
  minPlatformVersion: PluginVersion;

  /**
   * Maximum ClaudeFlare version supported (optional)
   */
  maxPlatformVersion?: PluginVersion;

  /**
   * Plugin type
   */
  type: PluginType;

  /**
   * Plugin author
   */
  author: PluginAuthor;

  /**
   * Plugin license
   */
  license: string;

  /**
   * Homepage URL
   */
  homepage?: string;

  /**
   * Repository URL
   */
  repository?: string;

  /**
   * Documentation URL
   */
  documentation?: string;

  /**
   * Bug tracking URL
   */
  bugs?: string;

  /**
   * List of keywords
   */
  keywords: string[];

  /**
   * Plugin capabilities
   */
  capabilities: PluginCapabilities;

  /**
   * Plugin dependencies
   */
  dependencies?: PluginDependency[];

  /**
   * Main entry point
   */
  main: string;

  /**
   * Icons
   */
  icons?: {
    small?: string; // 64x64
    large?: string; // 256x256
  };

  /**
   * Screenshots
   */
  screenshots?: string[];

  /**
   * Configuration schema
   */
  configSchema?: Record<string, unknown>;

  /**
   * Required secrets
   */
  requiredSecrets?: string[];

  /**
   * Environment variables
   */
  envVars?: Record<string, string>;

  /**
   * Hooks provided by this plugin
   */
  provides?: string[];

  /**
   * Hooks this plugin subscribes to
   */
  subscribes?: string[];

  /**
   * API routes provided
   */
  apiRoutes?: string[];

  /**
   * Webhook endpoints
   */
  webhooks?: string[];

  /**
   * Installation date (set by registry)
   */
  installedAt?: Date;

  /**
   * Last update date (set by registry)
   */
  updatedAt?: Date;
}

/**
 * Plugin context - runtime information provided to plugin
 */
export interface PluginContext {
  /**
   * Plugin ID
   */
  pluginId: PluginId;

  /**
   * Plugin version
   */
  version: PluginVersion;

  /**
   * Base directory for plugin
   */
  baseDir: string;

  /**
   * Configuration values
   */
  config: Record<string, unknown>;

  /**
   * Secrets storage (secure)
   */
  secrets: Record<string, string>;

  /**
   * Environment variables
   */
  env: Record<string, string>;

  /**
   * Cloudflare Workers bindings
   */
  bindings?: {
    kv?: Record<string, KVNamespace>;
    d1?: Record<string, D1Database>;
    r2?: Record<string, R2Bucket>;
    durableObjects?: Record<string, DurableObjectNamespace>;
    secrets?: Record<string, string>;
  };

  /**
   * Logger instance
   */
  logger: PluginLogger;

  /**
   * Event emitter
   */
  events: EventEmitter;

  /**
   * HTTP client
   */
  http: HttpClient;

  /**
   * Storage client
   */
  storage: StorageClient;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  fatal(message: string, ...args: unknown[]): void;
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  once(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * HTTP client interface
 */
export interface HttpClient {
  get(url: string, options?: RequestInit): Promise<Response>;
  post(url: string, body?: unknown, options?: RequestInit): Promise<Response>;
  put(url: string, body?: unknown, options?: RequestInit): Promise<Response>;
  patch(url: string, body?: unknown, options?: RequestInit): Promise<Response>;
  delete(url: string, options?: RequestInit): Promise<Response>;
  request(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Storage client interface
 */
export interface StorageClient {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  clear(prefix?: string): Promise<void>;
}

/**
 * Plugin load options
 */
export interface PluginLoadOptions {
  /**
   * Load plugin in sandbox
   */
  sandboxed?: boolean;

  /**
   * Enable hot reload
   */
  hotReload?: boolean;

  /**
   * Auto-activate after loading
   */
  autoActivate?: boolean;

  /**
   * Plugin configuration
   */
  config?: Record<string, unknown>;

  /**
   * Secrets
   */
  secrets?: Record<string, string>;

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  /**
   * Whether loading was successful
   */
  success: boolean;

  /**
   * Plugin instance if successful
   */
  plugin?: Plugin;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Load time in milliseconds
   */
  loadTime: number;
}

/**
 * Hook context - passed to hook handlers
 */
export interface HookContext {
  /**
   * Hook name
   */
  hookName: string;

  /**
   * Plugin that triggered the hook
   */
  sourcePlugin: PluginId;

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Hook-specific data
   */
  data: unknown;

  /**
   * Metadata
   */
  metadata: Record<string, unknown>;

  /**
   * Cancel the operation
   */
  cancel(): void;

  /**
   * Modify data
   */
  modify(data: unknown): void;
}

/**
 * Hook handler signature
 */
export type HookHandler = (context: HookContext) => void | Promise<void>;

/**
 * Hook definition
 */
export interface HookDefinition {
  /**
   * Hook name
   */
  name: string;

  /**
   * Hook description
   */
  description: string;

  /**
   * Hook type
   */
  type: 'sync' | 'async';

  /**
   * Hook priority (higher = earlier)
   */
  priority: number;

  /**
   * Can this hook be cancelled
   */
  cancellable: boolean;

  /**
   * Can this hook modify data
   */
  mutable: boolean;

  /**
   * Schema for hook data
   */
  dataSchema?: z.ZodType;

  /**
   * Registered handlers
   */
  handlers: Map<string, HookHandler>;
}

/**
 * Webhook event types
 */
export enum WebhookEventType {
  GITHUB_PUSH = 'github.push',
  GITHUB_PULL_REQUEST = 'github.pull_request',
  GITHUB_ISSUE = 'github.issue',
  GITHUB_RELEASE = 'github.release',

  GITLAB_PUSH = 'gitlab.push',
  GITLAB_MERGE_REQUEST = 'gitlab.merge_request',
  GITLAB_ISSUE = 'gitlab.issue',

  BITBUCKET_PUSH = 'bitbucket.push',
  BITBUCKET_PULL_REQUEST = 'bitbucket.pull_request',

  CUSTOM = 'custom',
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  /**
   * Event type
   */
  type: WebhookEventType | string;

  /**
   * Event ID
   */
  id: string;

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Source (GitHub, GitLab, etc.)
   */
  source: string;

  /**
   * Event data
   */
  data: Record<string, unknown>;

  /**
   * Signature for verification
   */
  signature?: string;

  /**
   * Headers
   */
  headers: Record<string, string>;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /**
   * Memory limit in MB
   */
  memoryLimit: number;

  /**
   * CPU time limit in ms
   */
  cpuTimeLimit: number;

  /**
   * Wall time limit in ms
   */
  wallTimeLimit: number;

  /**
   * Allowed modules
   */
  allowedModules: string[];

  /**
   * Blocked modules
   */
  blockedModules: string[];

  /**
   * Network access
   */
  networkAccess: boolean;

  /**
   * Allowed domains
   */
  allowedDomains?: string[];

  /**
   * File system access
   */
  fsAccess: boolean;

  /**
   * Allowed paths
   */
  allowedPaths?: string[];

  /**
   * Environment variables
   */
  envVars: Record<string, string>;
}

/**
 * Security context
 */
export interface SecurityContext {
  /**
   * User ID
   */
  userId?: string;

  /**
   * Session ID
   */
  sessionId?: string;

  /**
   * API key ID
   */
  apiKeyId?: string;

  /**
   * Permissions
   */
  permissions: string[];

  /**
   * Roles
   */
  roles: string[];

  /**
   * IP address
   */
  ipAddress?: string;

  /**
   * User agent
   */
  userAgent?: string;

  /**
   * Request timestamp
   */
  timestamp: Date;
}
