/**
 * ClaudeFlare Deployment Orchestration
 * Main entry point for all deployment operations
 */

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentManifest,
  DeploymentMetrics,
  DeploymentEvent,
  Environment,
  WorkerDeploymentOptions,
  DurableObjectConfig,
  KVNamespaceConfig,
  R2BucketConfig,
  D1DatabaseConfig,
  SecretConfig,
  RollbackConfig,
  Logger,
} from './types.js';
import { createWorkerDeployer } from './worker.js';
import { createDurableObjectDeployer, DEFAULT_DURABLE_OBJECTS } from './durable-objects.js';
import { createStorageProvisioner, DEFAULT_STORAGE_CONFIGS } from './storage.js';
import { createSecretManager, DEFAULT_SECRETS } from './secrets.js';
import { createDeploymentVerifier } from './verify.js';
import { createRollbackManager } from './rollback.js';

/**
 * Default deployment configuration
 */
export const DEFAULT_DEPLOYMENT_CONFIG: Partial<DeploymentConfig> = {
  zeroDowntime: true,
  rolloutPercentage: 10,
  healthCheckTimeout: 30000,
  maxRetries: 3,
  skipTests: false,
  skipVerification: false,
  dryRun: false,
  verbose: false,
  regions: ['wnam', 'enam', 'weur', 'apac'],
};

/**
 * ClaudeFlare deployment orchestrator
 */
export class ClaudeFlareDeployer {
  private config: DeploymentConfig;
  private context: DeploymentContext;

  constructor(config: Partial<DeploymentConfig> = {}, logger?: Logger) {
    this.config = {
      ...DEFAULT_DEPLOYMENT_CONFIG,
      ...config,
      environment: config.environment || 'production',
    } as DeploymentConfig;

    this.context = this.createContext(logger);
  }

  /**
   * Execute full deployment pipeline
   */
  async deploy(options: {
    worker?: WorkerDeploymentOptions;
    durableObjects?: DurableObjectConfig[];
    storage?: {
      kv?: KVNamespaceConfig[];
      r2?: R2BucketConfig[];
      d1?: D1DatabaseConfig[];
    };
    secrets?: SecretConfig[];
  }): Promise<void> {
    const startTime = Date.now();

    this.log('info', 'Starting ClaudeFlare deployment...');
    this.log('info', `Environment: ${this.config.environment}`);
    this.log('info', `Zero-downtime: ${this.config.zeroDowntime}`);

    try {
      // 1. Pre-deployment checks
      await this.preDeployment();

      // 2. Backup current deployment
      await this.backupDeployment();

      // 3. Provision storage resources
      if (options.storage) {
        await this.provisionStorage(options.storage);
      }

      // 4. Deploy secrets
      if (options.secrets) {
        await this.deploySecrets(options.secrets);
      }

      // 5. Deploy Durable Objects
      if (options.durableObjects) {
        await this.deployDurableObjects(options.durableObjects);
      }

      // 6. Deploy worker
      if (options.worker) {
        await this.deployWorker(options.worker);
      }

      // 7. Verify deployment
      if (!this.config.skipVerification) {
        await this.verifyDeployment();
      }

      // 8. Finalize deployment
      await this.finalizeDeployment();

      const duration = Date.now() - startTime;
      this.context.metrics.endTime = new Date();
      this.context.metrics.duration = duration;

      this.log('success', `Deployment completed successfully in ${duration}ms`);
      this.printDeploymentSummary();
    } catch (error) {
      this.log('error', `Deployment failed: ${error}`);

      // Auto-rollback on failure
      if (this.config.zeroDowntime) {
        this.log('warning', 'Initiating automatic rollback...');
        await this.rollback();
      }

      throw error;
    }
  }

  /**
   * Pre-deployment checks
   */
  private async preDeployment(): Promise<void> {
    this.log('info', 'Running pre-deployment checks...');

    // Create necessary directories
    const dirs = [
      resolve(process.cwd(), '.deployments'),
      resolve(process.cwd(), '.deployments', 'backups'),
      resolve(process.cwd(), '.secrets'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Check if wrangler is installed
    try {
      const { execSync } = await import('child_process');
      execSync('wrangler --version', { stdio: 'pipe' });
    } catch {
      throw new Error('Wrangler CLI is not installed. Run: npm install -g wrangler');
    }

    // Check authentication
    try {
      const { execSync } = await import('child_process');
      execSync('wrangler whoami', { stdio: 'pipe' });
    } catch {
      throw new Error('Not authenticated with Cloudflare. Run: wrangler login');
    }

    this.log('success', 'Pre-deployment checks passed');
  }

  /**
   * Backup current deployment
   */
  private async backupDeployment(): Promise<void> {
    this.log('info', 'Backing up current deployment...');

    const manifest: DeploymentManifest = {
      version: this.generateVersion(),
      timestamp: new Date(),
      environment: this.config.environment,
      deployments: [],
      checksums: new Map(),
    };

    this.context.manifest = manifest;

    this.log('success', 'Deployment backed up');
  }

  /**
   * Provision storage resources
   */
  private async provisionStorage(options: {
    kv?: KVNamespaceConfig[];
    r2?: R2BucketConfig[];
    d1?: D1DatabaseConfig[];
  }): Promise<void> {
    this.log('info', 'Provisioning storage resources...');

    const provisioner = createStorageProvisioner(this.config, this.context);

    await provisioner.provisionAll({
      kv: options.kv || DEFAULT_STORAGE_CONFIGS.kv,
      r2: options.r2 || DEFAULT_STORAGE_CONFIGS.r2,
      d1: options.d1 || DEFAULT_STORAGE_CONFIGS.d1,
    });

    this.log('success', 'Storage resources provisioned');
  }

  /**
   * Deploy secrets
   */
  private async deploySecrets(secrets: SecretConfig[]): Promise<void> {
    this.log('info', 'Deploying secrets...');

    const manager = createSecretManager(this.config, this.context);

    // Validate secrets first
    const validation = await manager.validateSecrets(secrets);
    if (!validation.valid) {
      throw new Error(`Secret validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      this.log('warning', `Secret warnings: ${validation.warnings.join(', ')}`);
    }

    await manager.provisionSecrets(secrets || DEFAULT_SECRETS);

    this.log('success', 'Secrets deployed');
  }

  /**
   * Deploy Durable Objects
   */
  private async deployDurableObjects(configs: DurableObjectConfig[]): Promise<void> {
    this.log('info', 'Deploying Durable Objects...');

    const deployer = createDurableObjectDeployer(this.config, this.context);

    await deployer.deployObjects(configs || DEFAULT_DURABLE_OBJECTS);

    this.log('success', 'Durable Objects deployed');
  }

  /**
   * Deploy worker
   */
  private async deployWorker(options: WorkerDeploymentOptions): Promise<void> {
    this.log('info', 'Deploying worker...');

    const deployer = createWorkerDeployer(this.config, this.context);

    // Build first
    this.log('info', 'Building worker...');
    try {
      const { execSync } = await import('child_process');
      execSync('npm run build', { stdio: this.config.verbose ? 'inherit' : 'pipe' });
    } catch (error) {
      throw new Error('Build failed');
    }

    await deployer.deploy(options);

    this.log('success', 'Worker deployed');
  }

  /**
   * Verify deployment
   */
  private async verifyDeployment(): Promise<void> {
    this.log('info', 'Verifying deployment...');

    const verifier = createDeploymentVerifier(this.config, this.context);

    const result = await verifier.verifyDeployment();

    if (!result.success) {
      throw new Error(
        `Deployment verification failed (Score: ${result.overallScore}/100)`
      );
    }

    this.log('success', `Deployment verified (Score: ${result.overallScore}/100)`);
  }

  /**
   * Finalize deployment
   */
  private async finalizeDeployment(): Promise<void> {
    this.log('info', 'Finalizing deployment...');

    // Save manifest
    const manifestPath = resolve(
      process.cwd(),
      '.deployments',
      `${this.context.manifest.version}.json`
    );

    writeFileSync(
      manifestPath,
      JSON.stringify({
        ...this.context.manifest,
        checksums: Object.fromEntries(this.context.manifest.checksums),
      }, null, 2),
      'utf-8'
    );

    this.log('success', 'Deployment finalized');
  }

  /**
   * Rollback deployment
   */
  async rollback(rollbackConfig?: RollbackConfig): Promise<void> {
    this.log('warning', 'Starting rollback...');

    const manager = createRollbackManager(this.config, this.context);

    await manager.rollback(rollbackConfig || {
      strategy: 'immediate',
      targetVersion: await this.getPreviousVersion(),
      backupData: true,
      verifyAfterRollback: true,
      maxRollbackTime: 300000,
    });

    this.log('success', 'Rollback completed');
  }

  /**
   * Get previous deployment version
   */
  private async getPreviousVersion(): Promise<string> {
    const manager = createRollbackManager(this.config, this.context);
    const versions = await manager.listRollbackVersions();

    if (versions.length < 2) {
      throw new Error('No previous version found for rollback');
    }

    return versions[1].version;
  }

  /**
   * Print deployment summary
   */
  private printDeploymentSummary(): void {
    const metrics = this.context.metrics;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          ClaudeFlare Deployment Summary                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nEnvironment:     ${this.config.environment}`);
    console.log(`Version:         ${this.context.manifest.version}`);
    console.log(`Duration:        ${metrics.duration}ms`);
    console.log(`Total Resources: ${metrics.totalResources}`);
    console.log(`Deployed:        ${metrics.deployedResources}`);
    console.log(`Failed:          ${metrics.failedResources}`);
    console.log(`Regions:         ${this.config.regions.join(', ')}`);
    console.log(`Zero-downtime:   ${this.config.zeroDowntime ? 'Yes' : 'No'}`);
    console.log('\n✅ Deployment successful!\n');
  }

  /**
   * Generate deployment version
   */
  private generateVersion(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `v${timestamp}-${random}`;
  }

  /**
   * Create deployment context
   */
  private createContext(logger?: Logger): DeploymentContext {
    return {
      config: this.config,
      manifest: {
        version: '',
        timestamp: new Date(),
        environment: this.config.environment,
        deployments: [],
        checksums: new Map(),
      },
      metrics: {
        startTime: new Date(),
        totalResources: 0,
        deployedResources: 0,
        failedResources: 0,
        regions: this.config.regions,
        healthChecks: [],
        errorRate: 0,
        avgLatency: 0,
      },
      events: [],
      logger: logger || this.createDefaultLogger(),
    };
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      info: (message, ...args) => console.log(`ℹ️  ${message}`, ...args),
      warn: (message, ...args) => console.warn(`⚠️  ${message}`, ...args),
      error: (message, ...args) => console.error(`❌ ${message}`, ...args),
      debug: (message, ...args) => console.debug(`🔍 ${message}`, ...args),
      success: (message, ...args) => console.log(`✅ ${message}`, ...args),
    };
  }

  /**
   * Log message
   */
  private log(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
    const logger = this.context.logger;
    const event: DeploymentEvent = {
      type: level === 'success' ? 'success' : level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info',
      message,
      timestamp: new Date(),
    };

    this.context.events.push(event);

    switch (level) {
      case 'info':
        logger.info(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message);
        break;
      case 'success':
        logger.success(message);
        break;
    }
  }

  /**
   * Get deployment events
   */
  getEvents(): DeploymentEvent[] {
    return this.context.events;
  }

  /**
   * Get deployment metrics
   */
  getMetrics(): DeploymentMetrics {
    return this.context.metrics;
  }
}

/**
 * Quick deploy function for common use cases
 */
export async function deploy(
  environment: Environment = 'production',
  options: Partial<DeploymentConfig> = {}
): Promise<void> {
  const deployer = new ClaudeFlareDeployer({
    environment,
    ...options,
  });

  await deployer.deploy({
    worker: {
      name: 'claudeflare',
      scriptPath: 'dist/worker.js',
      compatibilityDate: '2024-01-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: [],
      limits: {
        cpuMs: 50,
        memory: 128,
        maxRequestsPerSecond: 1000,
      },
      routes: [],
      cronTriggers: [],
    },
    durableObjects: DEFAULT_DURABLE_OBJECTS,
    storage: DEFAULT_STORAGE_CONFIGS,
    secrets: DEFAULT_SECRETS,
  });
}

/**
 * Quick rollback function
 */
export async function rollback(
  environment: Environment = 'production',
  targetVersion?: string
): Promise<void> {
  const deployer = new ClaudeFlareDeployer({ environment });
  await deployer.rollback({
    strategy: 'immediate',
    targetVersion: targetVersion || '',
    backupData: true,
    verifyAfterRollback: true,
    maxRollbackTime: 300000,
  });
}

/**
 * Verify deployment
 */
export async function verify(environment: Environment = 'production'): Promise<void> {
  const deployer = new ClaudeFlareDeployer({ environment });
  await deployer['verifyDeployment']();
}

// CLI entry point
export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = (args[1] as Environment) || 'production';

  try {
    switch (command) {
      case 'deploy':
        await deploy(environment);
        break;
      case 'rollback':
        await rollback(environment, args[2]);
        break;
      case 'verify':
        await verify(environment);
        break;
      default:
        console.log('Usage: deploy.ts [deploy|rollback|verify] [environment] [version]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
