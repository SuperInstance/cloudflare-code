/**
 * CLI configuration types for ClaudeFlare
 */

import { z } from 'zod';

/**
 * Raw configuration from claudeflare.config.ts
 */
export interface RawConfig {
  name?: string;
  version?: string;
  description?: string;

  // Worker configuration
  worker?: {
    name?: string;
    main?: string;
    compatibility_date?: string;
    compatibility_flags?: string[];
    routes?: Array<{
      pattern: string;
      zone_name?: string;
    }>;
  };

  // Build configuration
  build?: {
    input?: string;
    output?: string;
    minify?: boolean;
    sourcemap?: boolean;
    target?: string;
  };

  // Environment configuration
  env?: {
    development?: Record<string, string>;
    production?: Record<string, string>;
    preview?: Record<string, string>;
  };

  // Development server configuration
  dev?: {
    port?: number;
    host?: string;
    proxy?: boolean;
    open?: boolean;
    https?: boolean;
  };

  // Deployment configuration
  deploy?: {
    environment?: 'production' | 'preview' | 'development';
    workers?: {
      name?: string;
      account_id?: string;
      zone_id?: string;
      route?: string;
    };
    vars?: Record<string, string>;
    secrets?: string[];
    kv_namespaces?: Array<{
      binding: string;
      id: string;
      preview_id?: string;
    }>;
    r2_buckets?: Array<{
      binding: string;
      bucket_name: string;
    }>;
    durable_objects?: Array<{
      name: string;
      class_name: string;
      script_name?: string;
    }>;
  };

  // Testing configuration
  test?: {
    command?: string;
    environment?: Record<string, string>;
    coverage?: boolean;
    watch?: boolean;
  };

  // Monitoring configuration
  monitoring?: {
    enabled?: boolean;
    metrics?: boolean;
    traces?: boolean;
    logs?: boolean;
  };

  // CLI-specific configuration
  cli?: {
    debug?: boolean;
    verbose?: boolean;
    colors?: boolean;
    progress?: boolean;
  };
}

/**
 * Validated and normalized configuration
 */
export interface Config {
  name: string;
  version: string;
  description: string;

  worker: WorkerConfig;
  build: BuildConfig;
  env: EnvConfig;
  dev: DevConfig;
  deploy: DeployConfig;
  test: TestConfig;
  monitoring: MonitoringConfig;
  cli: CliConfig;
}

export interface WorkerConfig {
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags: string[];
  routes: Array<{
    pattern: string;
    zone_name?: string;
  }>;
}

export interface BuildConfig {
  input: string;
  output: string;
  minify: boolean;
  sourcemap: boolean;
  target: string;
}

export interface EnvConfig {
  development: Record<string, string>;
  production: Record<string, string>;
  preview: Record<string, string>;
}

export interface DevConfig {
  port: number;
  host: string;
  proxy: boolean;
  open: boolean;
  https: boolean;
}

export interface DeployConfig {
  environment: 'production' | 'preview' | 'development';
  workers: {
    name: string;
    account_id?: string;
    zone_id?: string;
    route?: string;
  };
  vars: Record<string, string>;
  secrets: string[];
  kv_namespaces: Array<{
    binding: string;
    id: string;
    preview_id?: string;
  }>;
  r2_buckets: Array<{
    binding: string;
    bucket_name: string;
  }>;
  durable_objects: Array<{
    name: string;
    class_name: string;
    script_name?: string;
  }>;
}

export interface TestConfig {
  command: string;
  environment: Record<string, string>;
  coverage: boolean;
  watch: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: boolean;
  traces: boolean;
  logs: boolean;
}

export interface CliConfig {
  debug: boolean;
  verbose: boolean;
  colors: boolean;
  progress: boolean;
}

/**
 * Project template types
 */
export interface ProjectTemplate {
  name: string;
  description: string;
  path: string;
  features: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  environment: string;
  url?: string;
  version?: string;
  deploymentId?: string;
  duration: number;
  errors?: string[];
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
  script?: string;
  event?: {
    request?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
    };
    outcome?: string;
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }>;
  recommendations?: string[];
}

/**
 * Bundle analysis result
 */
export interface BundleAnalysis {
  size: number;
  minified: number;
  gzipped: number;
  modules: number;
  dependencies: Array<{
    name: string;
    version: string;
    size: number;
  }>;
  warnings: string[];
  errors: string[];
}

/**
 * Validation schemas
 */
export const ConfigSchema = z.object({
  name: z.string().min(1).default('claudeflare-app'),
  version: z.string().default('0.1.0'),
  description: z.string().default(''),
  worker: z.object({
    name: z.string().min(1).default('claudeflare-worker'),
    main: z.string().default('src/index.ts'),
    compatibility_date: z.string().default('2024-01-01'),
    compatibility_flags: z.array(z.string()).default([]),
    routes: z.array(z.object({
      pattern: z.string(),
      zone_name: z.string().optional()
    })).default([]),
  }).default({}),
  build: z.object({
    input: z.string().default('src/index.ts'),
    output: z.string().default('dist/worker.js'),
    minify: z.boolean().default(true),
    sourcemap: z.boolean().default(true),
    target: z.string().default('esnext'),
  }).default({}),
  env: z.object({
    development: z.record(z.string()).default({}),
    production: z.record(z.string()).default({}),
    preview: z.record(z.string()).default({}),
  }).default({}),
  dev: z.object({
    port: z.number().int().min(1).max(65535).default(8788),
    host: z.string().default('localhost'),
    proxy: z.boolean().default(true),
    open: z.boolean().default(false),
    https: z.boolean().default(false),
  }).default({}),
  deploy: z.object({
    environment: z.enum(['production', 'preview', 'development']).default('preview'),
    workers: z.object({
      name: z.string().min(1).default('claudeflare-worker'),
      account_id: z.string().optional(),
      zone_id: z.string().optional(),
      route: z.string().optional(),
    }).default({}),
    vars: z.record(z.string()).default({}),
    secrets: z.array(z.string()).default([]),
    kv_namespaces: z.array(z.object({
      binding: z.string(),
      id: z.string(),
      preview_id: z.string().optional()
    })).default([]),
    r2_buckets: z.array(z.object({
      binding: z.string(),
      bucket_name: z.string()
    })).default([]),
    durable_objects: z.array(z.object({
      name: z.string(),
      class_name: z.string(),
      script_name: z.string().optional()
    })).default([]),
  }).default({}),
  test: z.object({
    command: z.string().default('npm test'),
    environment: z.record(z.string()).default({}),
    coverage: z.boolean().default(true),
    watch: z.boolean().default(false),
  }).default({}),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metrics: z.boolean().default(true),
    traces: z.boolean().default(true),
    logs: z.boolean().default(true),
  }).default({}),
  cli: z.object({
    debug: z.boolean().default(false),
    verbose: z.boolean().default(false),
    colors: z.boolean().default(true),
    progress: z.boolean().default(true),
  }).default({}),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;
