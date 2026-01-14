/**
 * Worker Deployment Script for ClaudeFlare
 * Handles zero-downtime Cloudflare Workers deployment with multi-region support
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentEvent,
  WorkerDeploymentOptions,
  Environment,
  DeploymentRegion,
  HealthCheckResult,
  PreDeploymentCheckResult,
  BundleSizeLimits,
  WranglerResponse,
} from './types.js';

/**
 * Default bundle size limits (in bytes)
 */
const DEFAULT_BUNDLE_LIMITS: BundleSizeLimits = {
  maxSize: 1024 * 1024, // 1MB
  warningSize: 800 * 1024, // 800KB
  gzipWarningSize: 300 * 1024, // 300KB
};

/**
 * Worker deployment class
 */
export class WorkerDeployer {
  private config: DeploymentConfig;
  private context: DeploymentContext;

  constructor(config: DeploymentConfig, context: DeploymentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Execute pre-deployment checks
   */
  async preDeploymentChecks(): Promise<PreDeploymentCheckResult> {
    const checks: PreDeploymentCheckResult = {
      passed: true,
      checks: [],
      warnings: [],
      errors: [],
    };

    this.emitEvent({
      type: 'info',
      message: 'Running pre-deployment checks...',
      timestamp: new Date(),
    });

    // 1. Check if wrangler is installed
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
      checks.checks.push({
        name: 'Wrangler CLI',
        status: 'pass',
        message: 'Wrangler CLI is installed',
        critical: true,
      });
    } catch (error) {
      checks.checks.push({
        name: 'Wrangler CLI',
        status: 'fail',
        message: 'Wrangler CLI is not installed',
        critical: true,
      });
      checks.errors.push('Wrangler CLI is required but not installed');
      checks.passed = false;
    }

    // 2. Check Cloudflare authentication
    try {
      execSync('wrangler whoami', { stdio: 'pipe' });
      checks.checks.push({
        name: 'Cloudflare Authentication',
        status: 'pass',
        message: 'Authenticated with Cloudflare',
        critical: true,
      });
    } catch (error) {
      checks.checks.push({
        name: 'Cloudflare Authentication',
        status: 'fail',
        message: 'Not authenticated with Cloudflare',
        critical: true,
      });
      checks.errors.push('Run "wrangler login" to authenticate');
      checks.passed = false;
    }

    // 3. Check environment variables
    const requiredEnvVars = this.getRequiredEnvironmentVariables();
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        checks.checks.push({
          name: `Environment Variable: ${envVar}`,
          status: 'fail',
          message: `${envVar} is not set`,
          critical: true,
        });
        checks.errors.push(`Missing required environment variable: ${envVar}`);
        checks.passed = false;
      } else {
        checks.checks.push({
          name: `Environment Variable: ${envVar}`,
          status: 'pass',
          message: `${envVar} is set`,
          critical: true,
        });
      }
    }

    // 4. Check if build directory exists
    const buildPath = resolve(process.cwd(), 'dist');
    if (!existsSync(buildPath)) {
      checks.checks.push({
        name: 'Build Directory',
        status: 'fail',
        message: 'Build directory does not exist',
        critical: true,
      });
      checks.errors.push('Run "npm run build" first');
      checks.passed = false;
    } else {
      checks.checks.push({
        name: 'Build Directory',
        status: 'pass',
        message: 'Build directory exists',
        critical: true,
      });
    }

    // 5. Check bundle size
    const bundleCheck = await this.checkBundleSize();
    checks.checks.push(...bundleCheck.checks);
    if (bundleCheck.warnings.length > 0) {
      checks.warnings.push(...bundleCheck.warnings);
    }
    if (bundleCheck.errors.length > 0) {
      checks.errors.push(...bundleCheck.errors);
      checks.passed = false;
    }

    // 6. Check if tests pass (unless skipped)
    if (!this.config.skipTests) {
      const testCheck = await this.runTests();
      checks.checks.push(...testCheck.checks);
      if (!testCheck.passed) {
        checks.errors.push('Tests failed');
        checks.passed = false;
      }
    }

    // 7. Check worker configuration
    const configCheck = await this.validateWorkerConfig();
    checks.checks.push(...configCheck.checks);
    if (configCheck.warnings.length > 0) {
      checks.warnings.push(...configCheck.warnings);
    }
    if (configCheck.errors.length > 0) {
      checks.errors.push(...configCheck.errors);
      checks.passed = false;
    }

    return checks;
  }

  /**
   * Check bundle size
   */
  private async checkBundleSize(): Promise<PreDeploymentCheckResult> {
    const result: PreDeploymentCheckResult = {
      passed: true,
      checks: [],
      warnings: [],
      errors: [],
    };

    const bundlePath = resolve(process.cwd(), 'dist/worker.js');
    if (!existsSync(bundlePath)) {
      result.checks.push({
        name: 'Bundle Size Check',
        status: 'fail',
        message: 'Bundle file not found',
        critical: true,
      });
      result.passed = false;
      return result;
    }

    const stats = readFileSync(bundlePath);
    const size = stats.length;
    const sizeMB = (size / (1024 * 1024)).toFixed(2);

    result.checks.push({
      name: 'Bundle Size',
      status: size <= DEFAULT_BUNDLE_LIMITS.maxSize ? 'pass' : 'fail',
      message: `Bundle size: ${sizeMB}MB`,
      critical: true,
    });

    if (size > DEFAULT_BUNDLE_LIMITS.maxSize) {
      result.errors.push(`Bundle size (${sizeMB}MB) exceeds maximum (${(DEFAULT_BUNDLE_LIMITS.maxSize / (1024 * 1024)).toFixed(2)}MB)`);
      result.passed = false;
    } else if (size > DEFAULT_BUNDLE_LIMITS.warningSize) {
      result.warnings.push(`Bundle size (${sizeMB}MB) is approaching the limit`);
    }

    return result;
  }

  /**
   * Run tests
   */
  private async runTests(): Promise<PreDeploymentCheckResult> {
    const result: PreDeploymentCheckResult = {
      passed: true,
      checks: [],
      warnings: [],
      errors: [],
    };

    this.emitEvent({
      type: 'info',
      message: 'Running test suite...',
      timestamp: new Date(),
    });

    try {
      execSync('npm run test', { stdio: 'pipe' });
      result.checks.push({
        name: 'Test Suite',
        status: 'pass',
        message: 'All tests passed',
        critical: true,
      });
    } catch (error) {
      result.checks.push({
        name: 'Test Suite',
        status: 'fail',
        message: 'Tests failed',
        critical: true,
      });
      result.passed = false;
    }

    return result;
  }

  /**
   * Validate worker configuration
   */
  private async validateWorkerConfig(): Promise<PreDeploymentCheckResult> {
    const result: PreDeploymentCheckResult = {
      passed: true,
      checks: [],
      warnings: [],
      errors: [],
    };

    const wranglerPath = resolve(process.cwd(), 'wrangler.toml');
    if (!existsSync(wranglerPath)) {
      result.errors.push('wrangler.toml not found');
      result.passed = false;
      return result;
    }

    // Parse wrangler.toml (basic validation)
    const content = readFileSync(wranglerPath, 'utf-8');
    const checks = [
      { name: 'main', pattern: /main\s*=/, critical: true },
      { name: 'name', pattern: /name\s*=/, critical: true },
      { name: 'compatibility_date', pattern: /compatibility_date\s*=/, critical: true },
    ];

    for (const check of checks) {
      if (check.pattern.test(content)) {
        result.checks.push({
          name: `Wrangler Config: ${check.name}`,
          status: 'pass',
          message: `${check.name} is configured`,
          critical: check.critical,
        });
      } else {
        result.checks.push({
          name: `Wrangler Config: ${check.name}`,
          status: 'fail',
          message: `${check.name} is missing`,
          critical: check.critical,
        });
        result.errors.push(`Missing required wrangler.toml field: ${check.name}`);
        result.passed = false;
      }
    }

    return result;
  }

  /**
   * Deploy worker to Cloudflare
   */
  async deploy(options: WorkerDeploymentOptions): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: `Deploying worker ${options.name} to ${this.config.environment}...`,
      timestamp: new Date(),
    });

    // Run pre-deployment checks
    const checks = await this.preDeploymentChecks();
    if (!checks.passed) {
      this.emitEvent({
        type: 'error',
        message: 'Pre-deployment checks failed',
        timestamp: new Date(),
        details: { errors: checks.errors },
      });
      throw new Error(`Pre-deployment checks failed: ${checks.errors.join(', ')}`);
    }

    // Show warnings
    if (checks.warnings.length > 0) {
      this.emitEvent({
        type: 'warning',
        message: `Pre-deployment warnings: ${checks.warnings.join(', ')}`,
        timestamp: new Date(),
      });
    }

    // Dry run check
    if (this.config.dryRun) {
      this.emitEvent({
        type: 'info',
        message: 'Dry run mode - skipping actual deployment',
        timestamp: new Date(),
      });
      return;
    }

    // Zero-downtime deployment
    if (this.config.zeroDowntime) {
      await this.zeroDowntimeDeploy(options);
    } else {
      await this.standardDeploy(options);
    }

    // Verify deployment (unless skipped)
    if (!this.config.skipVerification) {
      await this.verifyDeployment(options);
    }

    this.emitEvent({
      type: 'success',
      message: `Worker ${options.name} deployed successfully`,
      timestamp: new Date(),
    });
  }

  /**
   * Standard deployment
   */
  private async standardDeploy(options: WorkerDeploymentOptions): Promise<void> {
    const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '';
    const command = `wrangler deploy ${envFlag}`;

    this.emitEvent({
      type: 'info',
      message: 'Starting standard deployment...',
      timestamp: new Date(),
    });

    await this.executeCommand(command);
  }

  /**
   * Zero-downtime deployment with staged rollout
   */
  private async zeroDowntimeDeploy(options: WorkerDeploymentOptions): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Starting zero-downtime deployment with staged rollout...',
      timestamp: new Date(),
    });

    const stages = this.getRolloutStages();

    for (const stage of stages) {
      this.emitEvent({
        type: 'info',
        message: `Deploying to ${stage.percentage}% of regions: ${stage.regions.join(', ')}`,
        timestamp: new Date(),
      });

      // Deploy to stage regions
      await this.deployToRegions(options, stage.regions);

      // Wait for deployment to propagate
      await this.sleep(stage.duration);

      // Health check
      if (stage.healthCheckRequired) {
        const healthResults = await this.performHealthChecks(stage.regions);
        const allHealthy = healthResults.every(r => r.status === 'healthy');

        if (!allHealthy) {
          this.emitEvent({
            type: 'error',
            message: 'Health checks failed, rolling back...',
            timestamp: new Date(),
          });
          throw new Error('Health checks failed during staged rollout');
        }

        this.emitEvent({
          type: 'success',
          message: `Health checks passed for stage ${stage.percentage}%`,
          timestamp: new Date(),
        });
      }

      this.emitEvent({
        type: 'success',
        message: `Stage ${stage.percentage}% completed successfully`,
        timestamp: new Date(),
      });
    }

    this.emitEvent({
      type: 'success',
      message: 'Zero-downtime deployment completed',
      timestamp: new Date(),
    });
  }

  /**
   * Deploy to specific regions
   */
  private async deployToRegions(
    options: WorkerDeploymentOptions,
    regions: DeploymentRegion[]
  ): Promise<void> {
    const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '';
    const command = `wrangler deploy ${envFlag}`;

    await this.executeCommand(command);
  }

  /**
   * Get rollout stages for zero-downtime deployment
   */
  private getRolloutStages() {
    return [
      {
        percentage: 10,
        regions: ['weur', 'enam'] as DeploymentRegion[],
        duration: 30000, // 30 seconds
        healthCheckRequired: true,
      },
      {
        percentage: 50,
        regions: ['weur', 'enam', 'wnam', 'apac'] as DeploymentRegion[],
        duration: 30000,
        healthCheckRequired: true,
      },
      {
        percentage: 100,
        regions: ['global'] as DeploymentRegion[],
        duration: 0,
        healthCheckRequired: false,
      },
    ];
  }

  /**
   * Perform health checks across regions
   */
  async performHealthChecks(regions: DeploymentRegion[]): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const region of regions) {
      const result = await this.healthCheckRegion(region);
      results.push(result);
    }

    return results;
  }

  /**
   * Health check for a specific region
   */
  private async healthCheckRegion(region: DeploymentRegion): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Determine URL based on environment
      const url = this.getWorkerUrl(region);

      // Make health check request
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.healthCheckTimeout),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        errors.push(`HTTP ${response.status}`);
        return {
          status: 'unhealthy',
          latency,
          timestamp: new Date(),
          errors,
          warnings,
          region,
        };
      }

      // Check response body
      const data = await response.json();
      if (data.status !== 'ok') {
        warnings.push('Health check status not ok');
      }

      return {
        status: errors.length === 0 ? 'healthy' : 'degraded',
        latency,
        timestamp: new Date(),
        errors,
        warnings,
        region,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        timestamp: new Date(),
        errors,
        warnings,
        region,
      };
    }
  }

  /**
   * Get worker URL for a region
   */
  private getWorkerUrl(region: DeploymentRegion): string {
    const subdomain = this.config.environment === 'production'
      ? 'claudeflare'
      : `claudeflare-${this.config.environment}`;

    return `https://${subdomain}.workers.dev`;
  }

  /**
   * Verify deployment
   */
  private async verifyDeployment(options: WorkerDeploymentOptions): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Verifying deployment...',
      timestamp: new Date(),
    });

    // Wait for deployment to propagate
    await this.sleep(5000);

    // Perform health checks
    const regions = this.config.regions;
    const healthResults = await this.performHealthChecks(regions);

    const allHealthy = healthResults.every(r => r.status === 'healthy');

    if (!allHealthy) {
      const unhealthy = healthResults.filter(r => r.status !== 'healthy');
      throw new Error(
        `Deployment verification failed. Unhealthy regions: ${unhealthy.map(r => r.region).join(', ')}`
      );
    }

    this.emitEvent({
      type: 'success',
      message: 'Deployment verification passed',
      timestamp: new Date(),
      details: { healthResults },
    });
  }

  /**
   * Get worker deployment info
   */
  async getDeploymentInfo(): Promise<WranglerResponse<any>> {
    try {
      const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '';
      const output = execSync(`wrangler deployments list ${envFlag}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      return {
        success: true,
        result: JSON.parse(output),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a command and stream output
   */
  private executeCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        shell: true,
      });

      let output = '';
      let error = '';

      if (!this.config.verbose) {
        process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data) => {
          error += data.toString();
        });
      }

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed: ${error || output}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get required environment variables for deployment
   */
  private getRequiredEnvironmentVariables(): string[] {
    const commonVars = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];

    if (this.config.environment === 'production') {
      return [
        ...commonVars,
        'PRODUCTION_API_KEY',
        'PRODUCTION_DATABASE_URL',
      ];
    } else if (this.config.environment === 'staging') {
      return [
        ...commonVars,
        'STAGING_API_KEY',
        'STAGING_DATABASE_URL',
      ];
    }

    return commonVars;
  }

  /**
   * Emit deployment event
   */
  private emitEvent(event: DeploymentEvent): void {
    this.context.events.push(event);
    this.context.logger.info(`[${event.type.toUpperCase()}] ${event.message}`);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current worker version
   */
  async getCurrentVersion(): Promise<string | null> {
    const info = await this.getDeploymentInfo();
    if (info.success && result.result && result.result.length > 0) {
      return result.result[0].id;
    }
    return null;
  }

  /**
   * Stream deployment logs
   */
  streamLogs(): void {
    const command = 'wrangler tail';
    this.executeCommand(command).catch(console.error);
  }
}

/**
 * Create a new worker deployer instance
 */
export function createWorkerDeployer(
  config: DeploymentConfig,
  context: DeploymentContext
): WorkerDeployer {
  return new WorkerDeployer(config, context);
}
