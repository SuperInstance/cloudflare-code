#!/usr/bin/env tsx

/**
 * ClaudeFlare Deployment Script
 * Automates deployment to Cloudflare Workers with support for:
 * - Multiple environments (dev, staging, production)
 * - Progressive delivery (canary, blue-green)
 * - Health checks and rollback on failure
 * - Deployment metrics and analytics
 */

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  type: 'full' | 'canary' | 'blue-green';
  percentage?: number;
  color?: 'blue' | 'green';
  accountId: string;
  apiToken: string;
}

interface DeploymentInfo {
  deployment_id: string;
  version: string;
  timestamp: string;
  environment: string;
  type: string;
  url: string;
  metadata: Record<string, unknown>;
}

interface HealthCheckConfig {
  url: string;
  timeout: number;
  retries: number;
  threshold: number;
}

const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 3,
  threshold: 99,
} as const;

class DeploymentManager {
  private config: DeploymentConfig;
  private deploymentInfo: Partial<DeploymentInfo> = {};

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  /**
   * Execute the complete deployment pipeline
   */
  async deploy(outputPath?: string): Promise<DeploymentInfo> {
    console.log(`🚀 Starting deployment to ${this.config.environment}`);
    console.log(`   Type: ${this.config.type}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('');

    try {
      // Stage 1: Pre-deployment checks
      await this.runPreDeploymentChecks();

      // Stage 2: Build
      await this.buildDeployment();

      // Stage 3: Backup current deployment
      await this.backupCurrentDeployment();

      // Stage 4: Deploy
      this.deploymentInfo = await this.executeDeployment();

      // Stage 5: Post-deployment verification
      await this.verifyDeployment();

      // Stage 6: Health checks
      await this.runHealthChecks();

      // Stage 7: Record deployment metrics
      await this.recordDeploymentMetrics();

      const info = this.deploymentInfo as DeploymentInfo;

      if (outputPath) {
        await writeFile(outputPath, JSON.stringify(info, null, 2));
        console.log(`✅ Deployment info saved to ${outputPath}`);
      }

      console.log('');
      console.log('✅ Deployment completed successfully!');
      console.log(`   Version: ${info.version}`);
      console.log(`   URL: ${info.url}`);
      console.log(`   Deployment ID: ${info.deployment_id}`);

      return info;
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      await this.rollback('Deployment failed');
      throw error;
    }
  }

  /**
   * Run pre-deployment checks
   */
  private async runPreDeploymentChecks(): Promise<void> {
    console.log('🔍 Running pre-deployment checks...');

    // Check if required environment variables are set
    if (!this.config.accountId) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');
    }
    if (!this.config.apiToken) {
      throw new Error('CLOUDFLARE_API_TOKEN is not set');
    }

    // Check if wrangler is installed
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
    } catch {
      throw new Error('Wrangler CLI is not installed');
    }

    // Check if dist directory exists
    if (!existsSync(join(process.cwd(), 'dist', 'worker.js'))) {
      throw new Error('Build artifact not found. Run "npm run build" first.');
    }

    console.log('✅ Pre-deployment checks passed\n');
  }

  /**
   * Build the deployment
   */
  private async buildDeployment(): Promise<void> {
    console.log('🔨 Building deployment...');

    try {
      const buildCommand = `npm run build -- --env=${this.config.environment}`;
      execSync(buildCommand, { stdio: 'inherit', env: { ...process.env, NODE_ENV: this.config.environment } });
      console.log('✅ Build completed\n');
    } catch (error) {
      throw new Error(`Build failed: ${error}`);
    }
  }

  /**
   * Backup current deployment
   */
  private async backupCurrentDeployment(): Promise<void> {
    console.log('💾 Backing up current deployment...');

    try {
      const backupDir = '.deploy-backups';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Create backup directory
      execSync(`mkdir -p ${backupDir}`, { stdio: 'pipe' });

      // Get current deployment info
      const deployments = execSync(
        `npx wrangler deployments list --env ${this.config.environment}`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      const backupFile = join(backupDir, `backup-${timestamp}.json`);
      await writeFile(backupFile, deployments);

      console.log(`✅ Backup saved to ${backupFile}\n`);
    } catch (error) {
      console.warn('⚠️  Backup failed, continuing with deployment:', error);
    }
  }

  /**
   * Execute the deployment
   */
  private async executeDeployment(): Promise<Partial<DeploymentInfo>> {
    console.log('🚀 Deploying to Cloudflare Workers...');

    try {
      const envFlag = this.config.environment === 'development' ? '' : `--env ${this.config.environment}`;
      const deployCommand = `npx wrangler deploy ${envFlag}`;

      execSync(deployCommand, {
        stdio: 'inherit',
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: this.config.apiToken,
          CLOUDFLARE_ACCOUNT_ID: this.config.accountId,
        },
      });

      // Get deployment info
      const deployments = execSync(
        `npx wrangler deployments list --env ${this.config.environment}`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      const deploymentId = this.extractDeploymentId(deployments);
      const version = this.extractVersion(deployments);

      const url = this.getDeploymentUrl();

      return {
        deployment_id: deploymentId,
        version,
        timestamp: new Date().toISOString(),
        environment: this.config.environment,
        type: this.config.type,
        url,
        metadata: {
          percentage: this.config.percentage,
          color: this.config.color,
        },
      };
    } catch (error) {
      throw new Error(`Deployment failed: ${error}`);
    }
  }

  /**
   * Verify the deployment
   */
  private async verifyDeployment(): Promise<void> {
    console.log('🔍 Verifying deployment...');

    const url = this.deploymentInfo.url;
    if (!url) {
      throw new Error('Deployment URL not found');
    }

    try {
      // Check if the worker is accessible
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'ClaudeFlare-Deploy/1.0' },
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Health check passed: ${JSON.stringify(data)}\n`);
    } catch (error) {
      throw new Error(`Deployment verification failed: ${error}`);
    }
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(config: Partial<HealthCheckConfig> = {}): Promise<void> {
    console.log('🏥 Running health checks...');

    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const url = this.deploymentInfo.url;

    if (!url) {
      throw new Error('Deployment URL not found');
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < finalConfig.retries) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(finalConfig.timeout),
        });

        const duration = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Health check passed (${duration}ms)`);
          console.log(`   Status: ${data.status || 'OK'}`);
          console.log(`   Version: ${data.version || 'unknown'}\n`);
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        attempts++;
        console.warn(`⚠️  Health check attempt ${attempts} failed: ${error}`);

        if (attempts < finalConfig.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
          console.log(`   Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Health checks failed after ${attempts} attempts: ${lastError?.message}`);
  }

  /**
   * Record deployment metrics
   */
  private async recordDeploymentMetrics(): Promise<void> {
    console.log('📊 Recording deployment metrics...');

    const metrics = {
      deployment_id: this.deploymentInfo.deployment_id,
      version: this.deploymentInfo.version,
      environment: this.config.environment,
      type: this.config.type,
      timestamp: new Date().toISOString(),
      commit_sha: process.env.GITHUB_SHA || 'unknown',
      actor: process.env.GITHUB_ACTOR || 'unknown',
      run_id: process.env.GITHUB_RUN_ID || 'unknown',
    };

    try {
      const metricsDir = '.deployment-metrics';
      execSync(`mkdir -p ${metricsDir}`, { stdio: 'pipe' });

      const metricsFile = join(metricsDir, `deployment-${Date.now()}.json`);
      await writeFile(metricsFile, JSON.stringify(metrics, null, 2));

      console.log(`✅ Metrics saved to ${metricsFile}\n`);
    } catch (error) {
      console.warn('⚠️  Failed to record metrics:', error);
    }
  }

  /**
   * Rollback the deployment
   */
  async rollback(reason: string): Promise<void> {
    console.log(`🔄 Rolling back deployment: ${reason}`);

    try {
      const envFlag = this.config.environment === 'development' ? '' : `--env ${this.config.environment}`;
      const rollbackCommand = `npx wrangler rollback ${envFlag}`;

      execSync(rollbackCommand, {
        stdio: 'inherit',
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: this.config.apiToken,
          CLOUDFLARE_ACCOUNT_ID: this.config.accountId,
        },
      });

      console.log('✅ Rollback completed');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get deployment URL based on environment and type
   */
  private getDeploymentUrl(): string {
    const env = this.config.environment;
    const type = this.config.type;

    if (type === 'canary') {
      return env === 'production'
        ? 'https://canary.claudeflare.workers.dev'
        : 'https://canary.staging.claudeflare.workers.dev';
    }

    if (type === 'blue-green') {
      const color = this.config.color || 'blue';
      return env === 'production'
        ? `https://${color}.claudeflare.workers.dev`
        : `https://${color}.staging.claudeflare.workers.dev`;
    }

    return env === 'production'
      ? 'https://claudeflare.workers.dev'
      : 'https://staging.claudeflare.workers.dev';
  }

  /**
   * Extract deployment ID from wrangler output
   */
  private extractDeploymentId(output: string): string {
    const match = output.match(/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/);
    return match ? match[1] : `deployment-${Date.now()}`;
  }

  /**
   * Extract version from wrangler output
   */
  private extractVersion(output: string): string {
    const match = output.match(/version[:\s]+([0-9.]+)/i);
    return match ? match[1] : '1.0.0';
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(): DeploymentConfig & { outputPath?: string } {
  const args = process.argv.slice(2);
  const config: DeploymentConfig & { outputPath?: string } = {
    environment: 'production',
    type: 'full',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--environment':
      case '-e':
        config.environment = (nextArg || 'production') as DeploymentConfig['environment'];
        i++;
        break;
      case '--type':
      case '-t':
        config.type = (nextArg || 'full') as DeploymentConfig['type'];
        i++;
        break;
      case '--percentage':
      case '-p':
        config.percentage = parseInt(nextArg || '10', 10);
        i++;
        break;
      case '--color':
      case '-c':
        config.color = (nextArg || 'blue') as 'blue' | 'green';
        i++;
        break;
      case '--output':
      case '-o':
        config.outputPath = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ClaudeFlare Deployment Script

Usage: tsx scripts/deploy.ts [options]

Options:
  -e, --environment <env>    Target environment (development, staging, production) [default: production]
  -t, --type <type>          Deployment type (full, canary, blue-green) [default: full]
  -p, --percentage <num>     Initial canary percentage [default: 10]
  -c, --color <color>        Blue-green deployment color (blue, green) [default: blue]
  -o, --output <path>        Output path for deployment info JSON
  -h, --help                 Show this help message

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID      Cloudflare account ID
  CLOUDFLARE_API_TOKEN       Cloudflare API token

Examples:
  tsx scripts/deploy.ts --environment staging
  tsx scripts/deploy.ts --type canary --percentage 20 --output deployment.json
  tsx scripts/deploy.ts --type blue-green --color green --environment production
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    const manager = new DeploymentManager(config);
    await manager.deploy(config.outputPath);
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DeploymentManager, DeploymentConfig, DeploymentInfo };
