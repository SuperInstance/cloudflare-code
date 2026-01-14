/**
 * Wrangler configuration utilities
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { cwd } from 'process';
import type { Config } from '../types/index.js';

export interface WranglerConfig {
  name: string;
  main?: string;
  compatibility_date: string;
  compatibility_flags?: string[];
  account_id?: string;
  workers_dev?: boolean;
  route?: string;
  routes?: Array<{ pattern: string; zone_name?: string }>;
  vars?: Record<string, string>;
  secrets?: Array<string>;
  kv_namespaces?: Array<{ binding: string; id: string; preview_id?: string }>;
  r2_buckets?: Array<{ binding: string; bucket_name: string }>;
  durable_objects?: {
    bindings?: Array<{
      name: string;
      class_name: string;
      script_name?: string;
    }>;
  };
  [key: string]: unknown;
}

/**
 * Read wrangler.toml file
 */
export function readWranglerConfig(projectDir: string = cwd()): WranglerConfig | null {
  const wranglerPath = resolve(projectDir, 'wrangler.toml');

  if (!existsSync(wranglerPath)) {
    return null;
  }

  try {
    const content = readFileSync(wranglerPath, 'utf-8');

    // Simple TOML parser (basic implementation)
    const config: WranglerConfig = {
      name: '',
      compatibility_date: '2024-01-01',
    };

    const lines = content.split('\n');
    let currentSection: string[] = [];

    for (let line of lines) {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        continue;
      }

      // Section headers
      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1).split('.');
        continue;
      }

      // Key-value pairs
      const match = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        const cleanValue = value.trim().replace(/^["']|["']$/g, '');

        if (currentSection.length === 0) {
          (config as Record<string, unknown>)[key] = cleanValue;
        } else {
          // Handle nested sections (simplified)
          if (currentSection[0] === 'vars') {
            if (!config.vars) config.vars = {};
            config.vars[key] = cleanValue;
          }
        }
      }
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to read wrangler.toml: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate wrangler.toml from ClaudeFlare config
 */
export function generateWranglerConfig(config: Config): string {
  const lines: string[] = [
    '# ClaudeFlare Wrangler Configuration',
    '# Generated from claudeflare.config.ts',
    `name = "${config.worker.name}"`,
    `main = "${config.worker.main}"`,
    `compatibility_date = "${config.worker.compatibility_date}"`,
    '',
  ];

  // Add compatibility flags
  if (config.worker.compatibility_flags.length > 0) {
    lines.push('compatibility_flags = [');
    config.worker.compatibility_flags.forEach(flag => {
      lines.push(`  "${flag}"`);
    });
    lines.push(']');
    lines.push('');
  }

  // Add account_id if present
  if (config.deploy.workers.account_id) {
    lines.push(`account_id = "${config.deploy.workers.account_id}"`);
    lines.push('');
  }

  // Add routes
  if (config.worker.routes.length > 0) {
    lines.push('routes = [');
    config.worker.routes.forEach(route => {
      if (route.zone_name) {
        lines.push(`  { pattern = "${route.pattern}", zone_name = "${route.zone_name}" }`);
      } else {
        lines.push(`  { pattern = "${route.pattern}" }`);
      }
    });
    lines.push(']');
    lines.push('');
  }

  // Add environment variables
  if (Object.keys(config.deploy.vars).length > 0) {
    lines.push('[vars]');
    Object.entries(config.deploy.vars).forEach(([key, value]) => {
      lines.push(`${key} = "${value}"`);
    });
    lines.push('');
  }

  // Add KV namespaces
  if (config.deploy.kv_namespaces.length > 0) {
    lines.push('[[kv_namespaces]]');
    config.deploy.kv_namespaces.forEach(kv => {
      lines.push(`binding = "${kv.binding}"`);
      lines.push(`id = "${kv.id}"`);
      if (kv.preview_id) {
        lines.push(`preview_id = "${kv.preview_id}"`);
      }
      lines.push('');
    });
  }

  // Add R2 buckets
  if (config.deploy.r2_buckets.length > 0) {
    lines.push('[[r2_buckets]]');
    config.deploy.r2_buckets.forEach(bucket => {
      lines.push(`binding = "${bucket.binding}"`);
      lines.push(`bucket_name = "${bucket.bucket_name}"`);
      lines.push('');
    });
  }

  // Add Durable Objects
  if (config.deploy.durable_objects.length > 0) {
    lines.push('[durable_objects]');
    lines.push('bindings = [');
    config.deploy.durable_objects.forEach(obj => {
      lines.push(`  { name = "${obj.name}", class_name = "${obj.class_name}" }`);
    });
    lines.push(']');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write wrangler.toml file
 */
export function writeWranglerConfig(config: Config, projectDir: string = cwd()): void {
  const wranglerPath = resolve(projectDir, 'wrangler.toml');
  const content = generateWranglerConfig(config);
  writeFileSync(wranglerPath, content, 'utf-8');
}

/**
 * Merge ClaudeFlare config with existing wrangler.toml
 */
export function mergeWranglerConfig(
  claudeflareConfig: Config,
  wranglerConfig: WranglerConfig
): WranglerConfig {
  return {
    name: claudeflareConfig.worker.name,
    main: claudeflareConfig.worker.main,
    compatibility_date: claudeflareConfig.worker.compatibility_date,
    compatibility_flags: claudeflareConfig.worker.compatibility_flags,
    account_id: wranglerConfig.account_id ?? claudeflareConfig.deploy.workers.account_id,
    vars: {
      ...wranglerConfig.vars,
      ...claudeflareConfig.deploy.vars,
    },
    kv_namespaces: [
      ...(wranglerConfig.kv_namespaces ?? []),
      ...claudeflareConfig.deploy.kv_namespaces,
    ],
    r2_buckets: [
      ...(wranglerConfig.r2_buckets ?? []),
      ...claudeflareConfig.deploy.r2_buckets,
    ],
    durable_objects: claudeflareConfig.deploy.durable_objects.length > 0
      ? {
          bindings: claudeflareConfig.deploy.durable_objects.map(obj => ({
            name: obj.name,
            class_name: obj.class_name,
            script_name: obj.script_name,
          })),
        }
      : wranglerConfig.durable_objects,
    routes: claudeflareConfig.worker.routes,
  };
}
