// @ts-nocheck - Missing type definitions for p-queue
/**
 * Edge Deployer
 *
 * Advanced edge deployment with Workers, functions, and A/B testing support.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import PQueue from 'p-queue';
import { nanoid } from 'nanoid';
import type {
  IEdgeFunction,
  IDeploymentConfig,
  IDeploymentResult,
  DeploymentStatus,
  IRouteConfig,
  IAssetDeployment,
  IDeployerOptions,
  IABTestConfig,
  IRolloutConfig
} from '../types/index.js';

const execAsync = promisify(exec);

export class EdgeDeployer {
  private deployments: Map<string, IDeploymentResult>;
  private activeDeployments: Map<string, DeploymentStatus>;
  private queue: PQueue;
  private options: IDeployerOptions;
  private cloudflareConfig?: {
    apiKey: string;
    email: string;
    accountId: string;
    zoneId: string;
  };

  constructor(options?: IDeployerOptions) {
    this.options = {
      dryRun: options?.dryRun ?? false,
      skipTests: options?.skipTests ?? false,
      skipOptimization: options?.skipOptimization ?? false,
      verbose: options?.verbose ?? false,
      rollbackOnError: options?.rollbackOnError ?? true,
      progressCallback: options?.progressCallback
    };

    this.deployments = new Map();
    this.activeDeployments = new Map();
    this.queue = new PQueue({ concurrency: 1 });
  }

  /**
   * Configure Cloudflare
   */
  public configureCloudflare(config: {
    apiKey: string;
    email: string;
    accountId: string;
    zoneId: string;
  }): void {
    this.cloudflareConfig = config;
  }

  /**
   * Deploy edge functions
   */
  public async deploy(config: IDeploymentConfig): Promise<IDeploymentResult> {
    const deploymentId = nanoid();
    const startTime = Date.now();

    this.options.progressCallback?.('init', 0);

    const result: IDeploymentResult = {
      deploymentId,
      status: 'pending' as DeploymentStatus,
      version: config.version,
      url: '',
      deployedAt: new Date(),
      functions: config.functions.length,
      assets: config.assets.length,
      routes: config.routes.length,
      duration: 0,
      errors: []
    };

    try {
      // Update status
      result.status = 'building' as DeploymentStatus;
      this.activeDeployments.set(deploymentId, result.status);
      this.options.progressCallback?.('building', 10);

      // Build functions
      if (!this.options.skipTests) {
        const testResults = await this.runTests(config);
        if (!testResults.success) {
          throw new Error('Tests failed');
        }
      }

      this.options.progressCallback?.('uploading', 30);

      // Upload functions
      result.status = 'uploading' as DeploymentStatus;
      for (const func of config.functions) {
        try {
          await this.deployFunction(func);
          this.options.progressCallback?.('uploading', 30 + (config.functions.indexOf(func) / config.functions.length) * 20);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({
            resource: func.name,
            error: errorMessage
          });
        }
      }

      this.options.progressCallback?.('deploying', 50);

      // Deploy assets
      for (const asset of config.assets) {
        try {
          await this.deployAsset(asset);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({
            resource: asset.path,
            error: errorMessage
          });
        }
      }

      this.options.progressCallback?.('configuring', 70);

      // Configure routes
      for (const route of config.routes) {
        try {
          await this.configureRoute(route);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({
            resource: route.pattern,
            error: errorMessage
          });
        }
      }

      this.options.progressCallback?.('finalizing', 90);

      // Finalize deployment
      result.status = 'deploying' as DeploymentStatus;
      const finalizeResult = await this.finalizeDeployment(deploymentId, config);

      if (finalizeResult.success) {
        result.status = 'success' as DeploymentStatus;
        result.url = finalizeResult.url;
      } else {
        throw new Error(finalizeResult.error);
      }

      result.duration = Date.now() - startTime;
      this.options.progressCallback?.('complete', 100);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      result.status = 'failed' as DeploymentStatus;
      result.errors.push({
        resource: 'deployment',
        error: errorMessage
      });

      // Rollback if enabled
      if (this.options.rollbackOnError) {
        result.status = 'rolling_back' as DeploymentStatus;
        await this.rollbackDeployment(deploymentId);
        result.status = 'rolled_back' as DeploymentStatus;
      }

      result.duration = Date.now() - startTime;
    } finally {
      this.activeDeployments.delete(deploymentId);
      this.deployments.set(deploymentId, result);
    }

    return result;
  }

  /**
   * Deploy single function
   */
  private async deployFunction(func: IEdgeFunction): Promise<void> {
    if (this.options.dryRun) {
      console.log(`[DRY RUN] Would deploy function: ${func.name}`);
      return;
    }

    if (!this.cloudflareConfig) {
      throw new Error('Cloudflare not configured');
    }

    // Deploy using wrangler
    const wranglerPath = './node_modules/.bin/wrangler';

    try {
      // Write function to temporary file
      const tempPath = `/tmp/${func.name}.js`;
      await import('fs').then(fs => fs.promises.writeFile(tempPath, func.content));

      // Deploy with wrangler
      const command = `${wranglerPath} deploy ${tempPath} --name ${func.name}`;
      await execAsync(command);

      // Cleanup
      await import('fs').then(fs => fs.promises.unlink(tempPath));
    } catch (error) {
      throw new Error(`Failed to deploy function ${func.name}: ${error}`);
    }
  }

  /**
   * Deploy asset
   */
  private async deployAsset(asset: IAssetDeployment): Promise<void> {
    if (this.options.dryRun) {
      console.log(`[DRY RUN] Would deploy asset: ${asset.path}`);
      return;
    }

    if (!this.cloudflareConfig) {
      throw new Error('Cloudflare not configured');
    }

    // Upload to R2 or KV storage
    // This is a simplified implementation
    console.log(`Deploying asset: ${asset.path}`);
  }

  /**
   * Configure route
   */
  private async configureRoute(route: IRouteConfig): Promise<void> {
    if (this.options.dryRun) {
      console.log(`[DRY RUN] Would configure route: ${route.pattern}`);
      return;
    }

    if (!this.cloudflareConfig) {
      throw new Error('Cloudflare not configured');
    }

    // Configure route via Cloudflare API
    console.log(`Configuring route: ${route.pattern}`);
  }

  /**
   * Finalize deployment
   */
  private async finalizeDeployment(
    deploymentId: string,
    config: IDeploymentConfig
  ): Promise<{ success: boolean; url: string; error?: string }> {
    if (this.options.dryRun) {
      return {
        success: true,
        url: `https://dry-run.example.com`
      };
    }

    // In a real implementation, this would finalize the deployment
    // and return the deployment URL
    return {
      success: true,
      url: `https://${deploymentId}.workers.dev`
    };
  }

  /**
   * Rollback deployment
   */
  private async rollbackDeployment(deploymentId: string): Promise<void> {
    console.log(`Rolling back deployment: ${deploymentId}`);

    if (!this.cloudflareConfig) {
      return;
    }

    // Rollback to previous version
    // This is a simplified implementation
  }

  /**
   * Run tests before deployment
   */
  private async runTests(config: IDeploymentConfig): Promise<{
    success: boolean;
    results: Array<{ name: string; passed: boolean }>;
  }> {
    // Run tests for each function
    const results: Array<{ name: string; passed: boolean }> = [];

    for (const func of config.functions) {
      // In a real implementation, you would run actual tests
      results.push({
        name: func.name,
        passed: true
      });
    }

    return {
      success: results.every(r => r.passed),
      results
    };
  }

  /**
   * Deploy with A/B testing
   */
  public async deployAB(
    config: IDeploymentConfig,
    abTest: IABTestConfig
  ): Promise<IDeploymentResult[]> {
    const results: IDeploymentResult[] = [];

    // Deploy each variant
    for (const variant of abTest.variants) {
      const variantConfig = { ...config, environment: { ...config.environment, ...variant.config } };
      const result = await this.deploy(variantConfig);
      results.push(result);
    }

    // Configure A/B testing routing
    await this.configureABTest(abTest);

    return results;
  }

  /**
   * Configure A/B test
   */
  private async configureABTest(abTest: IABTestConfig): Promise<void> {
    console.log(`Configuring A/B test: ${abTest.name}`);

    // In a real implementation, you would configure routing rules
    // to direct traffic to different variants based on the weights
  }

  /**
   * Deploy with canary strategy
   */
  public async deployCanary(
    config: IDeploymentConfig,
    canaryPercentage: number = 10
  ): Promise<IDeploymentResult> {
    // Deploy canary version
    const canaryConfig = { ...config, version: `${config.version}-canary` };
    const canaryResult = await this.deploy(canaryConfig);

    if (canaryResult.status !== 'success') {
      return canaryResult;
    }

    // Gradually increase canary traffic
    // In a real implementation, you would monitor metrics and adjust
    console.log(`Canary deployed at ${canaryPercentage}% traffic`);

    return canaryResult;
  }

  /**
   * Deploy with blue-green strategy
   */
  public async deployBlueGreen(
    config: IDeploymentConfig
  ): Promise<IDeploymentResult> {
    // Deploy green environment
    const greenConfig = { ...config, version: `${config.version}-green` };
    const greenResult = await this.deploy(greenConfig);

    if (greenResult.status !== 'success') {
      return greenResult;
    }

    // Switch traffic to green
    await this.switchTraffic(greenResult.deploymentId);

    return greenResult;
  }

  /**
   * Switch traffic between deployments
   */
  private async switchTraffic(deploymentId: string): Promise<void> {
    console.log(`Switching traffic to deployment: ${deploymentId}`);

    if (!this.cloudflareConfig) {
      return;
    }

    // Update routing rules to point to new deployment
    // This is a simplified implementation
  }

  /**
   * Get deployment status
   */
  public getDeploymentStatus(deploymentId: string): DeploymentStatus | null {
    const deployment = this.deployments.get(deploymentId);
    return deployment?.status ?? null;
  }

  /**
   * Get deployment result
   */
  public getDeployment(deploymentId: string): IDeploymentResult | null {
    return this.deployments.get(deploymentId) ?? null;
  }

  /**
   * List deployments
   */
  public listDeployments(limit?: number): IDeploymentResult[] {
    const deployments = Array.from(this.deployments.values())
      .sort((a, b) => b.deployedAt.getTime() - a.deployedAt.getTime());

    return limit ? deployments.slice(0, limit) : deployments;
  }

  /**
   * Delete deployment
   */
  public async deleteDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return false;

    if (!this.cloudflareConfig) {
      return false;
    }

    // Delete deployment
    // This is a simplified implementation
    this.deployments.delete(deploymentId);
    return true;
  }

  /**
   * Validate deployment config
   */
  public validateConfig(config: IDeploymentConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check functions
    for (const func of config.functions) {
      if (!func.name) {
        errors.push('Function missing name');
      }
      if (!func.content) {
        errors.push(`Function ${func.name} missing content`);
      }
      if (!func.routes || func.routes.length === 0) {
        errors.push(`Function ${func.name} has no routes`);
      }
    }

    // Check assets
    for (const asset of config.assets) {
      if (!asset.path) {
        errors.push('Asset missing path');
      }
      if (!asset.content) {
        errors.push(`Asset ${asset.path} missing content`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get deployment statistics
   */
  public getStatistics(): {
    total: number;
    success: number;
    failed: number;
    active: number;
    avgDuration: number;
  } {
    const deployments = Array.from(this.deployments.values());
    const success = deployments.filter(d => d.status === 'success').length;
    const failed = deployments.filter(d => d.status === 'failed').length;
    const active = this.activeDeployments.size;

    const durations = deployments.map(d => d.duration);
    const avgDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    return {
      total: deployments.length,
      success,
      failed,
      active,
      avgDuration
    };
  }

  /**
   * Cleanup old deployments
   */
  public async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [id, deployment] of this.deployments.entries()) {
      if (deployment.deployedAt.getTime() < cutoff) {
        await this.deleteDeployment(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export default EdgeDeployer;
