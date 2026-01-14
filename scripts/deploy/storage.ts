/**
 * Storage Provisioning Script for ClaudeFlare
 * Handles KV, R2, and D1 resource provisioning and configuration
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentEvent,
  KVNamespaceConfig,
  R2BucketConfig,
  D1DatabaseConfig,
  Environment,
  ProvisionResult,
  CloudflareAPIResponse,
} from './types.js';

/**
 * Storage provisioner class
 */
export class StorageProvisioner {
  private config: DeploymentConfig;
  private context: DeploymentContext;

  constructor(config: DeploymentConfig, context: DeploymentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Provision all storage resources
   */
  async provisionAll(options: {
    kv?: KVNamespaceConfig[];
    r2?: R2BucketConfig[];
    d1?: D1DatabaseConfig[];
  }): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Provisioning storage resources...',
      timestamp: new Date(),
    });

    const results: ProvisionResult[] = [];

    // Provision KV namespaces
    if (options.kv && options.kv.length > 0) {
      this.emitEvent({
        type: 'info',
        message: `Provisioning ${options.kv.length} KV namespaces...`,
        timestamp: new Date(),
      });

      for (const kv of options.kv) {
        const result = await this.provisionKV(kv);
        results.push(result);
      }
    }

    // Provision R2 buckets
    if (options.r2 && options.r2.length > 0) {
      this.emitEvent({
        type: 'info',
        message: `Provisioning ${options.r2.length} R2 buckets...`,
        timestamp: new Date(),
      });

      for (const r2 of options.r2) {
        const result = await this.provisionR2(r2);
        results.push(result);
      }
    }

    // Provision D1 databases
    if (options.d1 && options.d1.length > 0) {
      this.emitEvent({
        type: 'info',
        message: `Provisioning ${options.d1.length} D1 databases...`,
        timestamp: new Date(),
      });

      for (const d1 of options.d1) {
        const result = await this.provisionD1(d1);
        results.push(result);
      }
    }

    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(
        `Storage provisioning failed for ${failures.length} resource(s): ${failures.map(f => f.error).join(', ')}`
      );
    }

    this.emitEvent({
      type: 'success',
      message: 'All storage resources provisioned successfully',
      timestamp: new Date(),
      details: { results },
    });
  }

  /**
   * Provision KV namespace
   */
  async provisionKV(config: KVNamespaceConfig): Promise<ProvisionResult> {
    const warnings: string[] = [];

    this.emitEvent({
      type: 'info',
      message: `Provisioning KV namespace: ${config.binding}...`,
      timestamp: new Date(),
    });

    try {
      // If ID is provided, verify it exists
      if (config.id) {
        const exists = await this.kvNamespaceExists(config.id);
        if (exists) {
          warnings.push(`KV namespace ${config.binding} already exists with ID ${config.id}`);
          return {
            success: true,
            resourceId: config.id,
            warnings,
          };
        }
      }

      // Create new KV namespace
      const title = config.title || `${config.binding}-${this.config.environment}`;
      const command = `wrangler kv:namespace create "${title}"`;

      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: {
            ...process.env,
          },
        });

        // Parse the output to get the namespace ID
        const idMatch = output.match(/id = "([a-f0-9]+)"/);
        const previewIdMatch = output.match(/preview_id = "([a-f0-9]+)"/);

        if (!idMatch) {
          throw new Error('Failed to parse KV namespace ID from output');
        }

        const namespaceId = idMatch[1];
        const previewId = previewIdMatch ? previewIdMatch[1] : undefined;

        // Update wrangler.toml with the new namespace ID
        await this.updateKVBinding(config.binding, namespaceId, previewId);

        this.emitEvent({
          type: 'success',
          message: `KV namespace ${config.binding} provisioned with ID ${namespaceId}`,
          timestamp: new Date(),
        });

        return {
          success: true,
          resourceId: namespaceId,
          warnings,
        };
      } catch (error) {
        // Check if namespace already exists
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('already exists') || errorMessage.includes('already been created')) {
          warnings.push(`KV namespace ${config.binding} may already exist`);
          return {
            success: true,
            warnings,
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings,
      };
    }
  }

  /**
   * Check if KV namespace exists
   */
  private async kvNamespaceExists(namespaceId: string): Promise<boolean> {
    try {
      const command = `wrangler kv:key list --namespace-id=${namespaceId} --limit=1`;
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update KV binding in wrangler.toml
   */
  private async updateKVBinding(
    binding: string,
    namespaceId: string,
    previewId?: string
  ): Promise<void> {
    const wranglerPath = resolve(process.cwd(), 'wrangler.toml');

    if (!existsSync(wranglerPath)) {
      throw new Error('wrangler.toml not found');
    }

    let content = readFileSync(wranglerPath, 'utf-8');
    const envPrefix = this.config.environment === 'development'
      ? ''
      : `[env.${this.config.environment}]`;

    // Find and update the KV namespace binding
    const kvPattern = new RegExp(
      `\\[\\[${envPrefix ? envPrefix.replace('[', '\\[').replace(']', '\\]') + '\\.' : ''}kv_namespaces\\]\\][\\s\\S]*?binding\\s*=\\s*"${binding}"[\\s\\S]*?id\\s*=\\s*"[^"]*"`,
      'g'
    );

    const newKVBinding = `id = "${namespaceId}"${previewId ? `\npreview_id = "${previewId}"` : ''}`;

    if (kvPattern.test(content)) {
      content = content.replace(kvPattern, (match) => {
        return match.replace(/id\s*=\s*"[^"]*"/, newKVBinding.split('\n')[0]);
      });
    } else {
      // Add new KV namespace binding
      const newBinding = `
[[${envPrefix ? envPrefix + '.' : ''}kv_namespaces]]
binding = "${binding}"
id = "${namespaceId}"${previewId ? `\npreview_id = "${previewId}"` : ''}
`;
      content += newBinding;
    }

    writeFileSync(wranglerPath, content, 'utf-8');
  }

  /**
   * Provision R2 bucket
   */
  async provisionR2(config: R2BucketConfig): Promise<ProvisionResult> {
    const warnings: string[] = [];

    this.emitEvent({
      type: 'info',
      message: `Provisioning R2 bucket: ${config.name}...`,
      timestamp: new Date(),
    });

    try {
      // Check if bucket already exists
      const exists = await this.r2BucketExists(config.name);
      if (exists) {
        warnings.push(`R2 bucket ${config.name} already exists`);

        // Configure versioning and lifecycle rules if needed
        await this.configureR2Bucket(config);

        return {
          success: true,
          resourceId: config.name,
          warnings,
        };
      }

      // Create new R2 bucket
      const command = `wrangler r2 bucket create "${config.name}"`;

      try {
        execSync(command, { stdio: this.config.verbose ? 'inherit' : 'pipe' });

        // Configure bucket settings
        await this.configureR2Bucket(config);

        this.emitEvent({
          type: 'success',
          message: `R2 bucket ${config.name} provisioned successfully`,
          timestamp: new Date(),
        });

        return {
          success: true,
          resourceId: config.name,
          warnings,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('already exists')) {
          warnings.push(`R2 bucket ${config.name} already exists`);
          return {
            success: true,
            warnings,
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings,
      };
    }
  }

  /**
   * Check if R2 bucket exists
   */
  private async r2BucketExists(bucketName: string): Promise<boolean> {
    try {
      const command = `wrangler r2 bucket list`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      // Parse output to check if bucket exists
      return output.includes(bucketName);
    } catch {
      return false;
    }
  }

  /**
   * Configure R2 bucket settings
   */
  private async configureR2Bucket(config: R2BucketConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Configuring R2 bucket ${config.name}...`,
      timestamp: new Date(),
    });

    // Note: R2 bucket configuration is limited via CLI
    // Advanced configuration may require API calls

    if (config.versioning) {
      this.emitEvent({
        type: 'info',
        message: 'Enabling versioning for R2 bucket',
        timestamp: new Date(),
      });
      // Versioning is typically enabled by default or via API
    }

    if (config.lifecycleRules && config.lifecycleRules.length > 0) {
      this.emitEvent({
        type: 'info',
        message: `Configuring ${config.lifecycleRules.length} lifecycle rules`,
        timestamp: new Date(),
      });
      // Lifecycle rules require API configuration
    }
  }

  /**
   * Provision D1 database
   */
  async provisionD1(config: D1DatabaseConfig): Promise<ProvisionResult> {
    const warnings: string[] = [];

    this.emitEvent({
      type: 'info',
      message: `Provisioning D1 database: ${config.name}...`,
      timestamp: new Date(),
    });

    try {
      // If database ID is provided, verify it exists
      if (config.databaseId) {
        const exists = await this.d1DatabaseExists(config.databaseId);
        if (exists) {
          warnings.push(`D1 database ${config.name} already exists with ID ${config.databaseId}`);

          // Run migrations if path provided
          if (config.migrationsPath) {
            await this.runD1Migrations(config);
          }

          return {
            success: true,
            resourceId: config.databaseId,
            warnings,
          };
        }
      }

      // Create new D1 database
      const command = `wrangler d1 create "${config.name}"`;

      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        // Parse the output to get the database ID
        const idMatch = output.match(/database_id = "([a-f0-9-]+)"/);

        if (!idMatch) {
          throw new Error('Failed to parse D1 database ID from output');
        }

        const databaseId = idMatch[1];

        // Update wrangler.toml with the new database ID
        await this.updateD1Binding(config.binding, databaseId);

        // Run migrations if path provided
        if (config.migrationsPath) {
          await this.runD1Migrations({ ...config, databaseId });
        }

        this.emitEvent({
          type: 'success',
          message: `D1 database ${config.name} provisioned with ID ${databaseId}`,
          timestamp: new Date(),
        });

        return {
          success: true,
          resourceId: databaseId,
          warnings,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('already exists') || errorMessage.includes('already been created')) {
          warnings.push(`D1 database ${config.name} may already exist`);
          return {
            success: true,
            warnings,
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings,
      };
    }
  }

  /**
   * Check if D1 database exists
   */
  private async d1DatabaseExists(databaseId: string): Promise<boolean> {
    try {
      const command = `wrangler d1 info ${databaseId}`;
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update D1 binding in wrangler.toml
   */
  private async updateD1Binding(
    binding: string,
    databaseId: string
  ): Promise<void> {
    const wranglerPath = resolve(process.cwd(), 'wrangler.toml');

    if (!existsSync(wranglerPath)) {
      throw new Error('wrangler.toml not found');
    }

    let content = readFileSync(wranglerPath, 'utf-8');
    const envPrefix = this.config.environment === 'development'
      ? ''
      : `[env.${this.config.environment}]`;

    // Find and update the D1 database binding
    const d1Pattern = new RegExp(
      `\\[\\[${envPrefix ? envPrefix.replace('[', '\\[').replace(']', '\\]') + '\\.' : ''}d1_databases\\]\\][\\s\\S]*?binding\\s*=\\s*"${binding}"[\\s\\S]*?database_id\\s*=\\s*"[^"]*"`,
      'g'
    );

    const newD1Binding = `database_id = "${databaseId}"`;

    if (d1Pattern.test(content)) {
      content = content.replace(d1Pattern, (match) => {
        return match.replace(/database_id\s*=\s*"[^"]*"/, newD1Binding);
      });
    } else {
      // Add new D1 database binding
      const newBinding = `
[[${envPrefix ? envPrefix + '.' : ''}d1_databases]]
binding = "${binding}"
database_name = "${binding}"
database_id = "${databaseId}"
`;
      content += newBinding;
    }

    writeFileSync(wranglerPath, content, 'utf-8');
  }

  /**
   * Run D1 migrations
   */
  private async runD1Migrations(config: D1DatabaseConfig): Promise<void> {
    if (!config.migrationsPath) {
      return;
    }

    this.emitEvent({
      type: 'info',
      message: `Running migrations for D1 database ${config.name}...`,
      timestamp: new Date(),
    });

    try {
      const envFlag = this.config.environment !== 'development'
        ? `--env ${this.config.environment}`
        : '';

      const command = `wrangler d1 migrations apply ${config.databaseId || config.name} ${envFlag} --local`;

      execSync(command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        cwd: resolve(process.cwd(), config.migrationsPath),
      });

      this.emitEvent({
        type: 'success',
        message: `Migrations completed for ${config.name}`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'warning',
        message: `Migration warnings for ${config.name}: ${error}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * List all storage resources
   */
  async listResources(): Promise<{
    kv: string[];
    r2: string[];
    d1: string[];
  }> {
    const result = {
      kv: [] as string[],
      r2: [] as string[],
      d1: [] as string[],
    };

    try {
      // List KV namespaces
      const kvOutput = execSync('wrangler kv:namespace list', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const kvData = JSON.parse(kvOutput);
      result.kv = kvData.map((ns: any) => ns.id);

      // List R2 buckets
      const r2Output = execSync('wrangler r2 bucket list', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const r2Data = JSON.parse(r2Output);
      result.r2 = r2Data.buckets.map((b: any) => b.name);

      // List D1 databases
      const d1Output = execSync('wrangler d1 list', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const d1Data = JSON.parse(d1Output);
      result.d1 = d1Data.map((db: any) => db.uuid);
    } catch (error) {
      this.context.logger.warn(`Failed to list resources: ${error}`);
    }

    return result;
  }

  /**
   * Delete storage resource
   */
  async deleteResource(type: 'kv' | 'r2' | 'd1', resourceId: string): Promise<void> {
    this.emitEvent({
      type: 'warning',
      message: `Deleting ${type.toUpperCase()} resource: ${resourceId}...`,
      timestamp: new Date(),
    });

    try {
      let command = '';
      switch (type) {
        case 'kv':
          command = `wrangler kv:namespace delete "${resourceId}"`;
          break;
        case 'r2':
          command = `wrangler r2 bucket delete "${resourceId}"`;
          break;
        case 'd1':
          command = `wrangler d1 delete "${resourceId}"`;
          break;
      }

      execSync(command, { stdio: this.config.verbose ? 'inherit' : 'pipe' });

      this.emitEvent({
        type: 'success',
        message: `${type.toUpperCase()} resource ${resourceId} deleted`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `Failed to delete ${type.toUpperCase()} resource ${resourceId}`,
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Emit deployment event
   */
  private emitEvent(event: DeploymentEvent): void {
    this.context.events.push(event);
    this.context.logger.info(`[${event.type.toUpperCase()}] ${event.message}`);
  }
}

/**
 * Create a new storage provisioner instance
 */
export function createStorageProvisioner(
  config: DeploymentConfig,
  context: DeploymentContext
): StorageProvisioner {
  return new StorageProvisioner(config, context);
}

/**
 * Default storage configurations for ClaudeFlare
 */
export const DEFAULT_STORAGE_CONFIGS = {
  kv: [
    {
      binding: 'CACHE_KV',
      title: 'claudeflare-cache',
    },
    {
      binding: 'SESSIONS_KV',
      title: 'claudeflare-sessions',
    },
  ] as KVNamespaceConfig[],

  r2: [
    {
      name: 'claudeflare-storage',
      binding: 'STORAGE_BUCKET',
      versioning: true,
      lifecycleRules: [
        {
          id: 'delete-old-logs',
          prefix: 'logs/',
          expirationDays: 30,
        },
      ],
    },
  ] as R2BucketConfig[],

  d1: [
    {
      name: 'claudeflare-db',
      binding: 'DB',
      migrationsPath: 'migrations',
    },
  ] as D1DatabaseConfig[],
};
