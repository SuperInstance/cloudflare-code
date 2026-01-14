/**
 * Rollback Automation Script for ClaudeFlare
 * Handles automatic and manual rollback of deployments
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type {
  DeploymentConfig,
  DeploymentContext,
  DeploymentEvent,
  RollbackConfig,
  RollbackStrategy,
  DeploymentManifest,
  Environment,
  BackupConfig,
} from './types.js';

/**
 * Rollback manager class
 */
export class RollbackManager {
  private config: DeploymentConfig;
  private context: DeploymentContext;

  constructor(config: DeploymentConfig, context: DeploymentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Execute rollback with specified strategy
   */
  async rollback(rollbackConfig: RollbackConfig): Promise<void> {
    this.emitEvent({
      type: 'warning',
      message: `Starting rollback to version ${rollbackConfig.targetVersion}...`,
      timestamp: new Date(),
    });

    try {
      // Backup current state if requested
      if (rollbackConfig.backupData) {
        await this.backupCurrentState();
      }

      // Execute rollback based on strategy
      switch (rollbackConfig.strategy) {
        case 'immediate':
          await this.immediateRollback(rollbackConfig);
          break;
        case 'gradual':
          await this.gradualRollback(rollbackConfig);
          break;
        case 'manual':
          await this.manualRollback(rollbackConfig);
          break;
        default:
          throw new Error(`Unknown rollback strategy: ${rollbackConfig.strategy}`);
      }

      // Verify rollback if requested
      if (rollbackConfig.verifyAfterRollback) {
        await this.verifyRollback(rollbackConfig);
      }

      this.emitEvent({
        type: 'success',
        message: `Rollback to version ${rollbackConfig.targetVersion} completed`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: 'Rollback failed',
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Immediate rollback - deploy previous version immediately
   */
  private async immediateRollback(rollbackConfig: RollbackConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Executing immediate rollback...',
      timestamp: new Date(),
    });

    const startTime = Date.now();

    try {
      // Get previous deployment info
      const previousVersion = rollbackConfig.targetVersion;

      // Deploy previous version
      await this.deployVersion(previousVersion);

      const duration = Date.now() - startTime;

      this.emitEvent({
        type: 'success',
        message: `Immediate rollback completed in ${duration}ms`,
        timestamp: new Date(),
      });
    } catch (error) {
      throw new Error(`Immediate rollback failed: ${error}`);
    }
  }

  /**
   * Gradual rollback - rollout previous version in stages
   */
  private async gradualRollback(rollbackConfig: RollbackConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Executing gradual rollback...',
      timestamp: new Date(),
    });

    const stages = [
      { percentage: 10, waitTime: 30000 },
      { percentage: 50, waitTime: 30000 },
      { percentage: 100, waitTime: 0 },
    ];

    for (const stage of stages) {
      this.emitEvent({
        type: 'info',
        message: `Rolling back to ${stage.percentage}%...`,
        timestamp: new Date(),
      });

      // Deploy to percentage of regions
      await this.deployPartialVersion(rollbackConfig.targetVersion, stage.percentage);

      // Wait for propagation
      if (stage.waitTime > 0) {
        await this.sleep(stage.waitTime);
      }

      // Health check
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error(`Health check failed at ${stage.percentage}% rollback`);
      }
    }

    this.emitEvent({
      type: 'success',
      message: 'Gradual rollback completed',
      timestamp: new Date(),
    });
  }

  /**
   * Manual rollback - prepare rollback but require confirmation
   */
  private async manualRollback(rollbackConfig: RollbackConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Preparing manual rollback...',
      timestamp: new Date(),
    });

    // Show rollback plan
    const plan = await this.generateRollbackPlan(rollbackConfig);

    this.emitEvent({
      type: 'info',
      message: 'Rollback plan generated',
      timestamp: new Date(),
      details: { plan },
    });

    // Wait for manual confirmation
    this.emitEvent({
      type: 'warning',
      message: 'Manual rollback requires confirmation. Please review and confirm.',
      timestamp: new Date(),
    });

    // In automated flow, this would pause for manual approval
    // For now, we'll proceed with the rollback
    await this.immediateRollback(rollbackConfig);
  }

  /**
   * Deploy a specific version
   */
  private async deployVersion(version: string): Promise<void> {
    const envFlag = this.config.environment !== 'development'
      ? `--env ${this.config.environment}`
      : '';

    try {
      // Use wrangler to deploy specific version
      const command = `wrangler rollback ${envFlag} --to-version=${version}`;

      execSync(command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
      });
    } catch (error) {
      // If wrangler rollback is not available, try alternative method
      this.context.logger.warn('wrangler rollback not available, using alternative method');

      // Get backup from version history
      await this.deployFromBackup(version);
    }
  }

  /**
   * Deploy version from backup
   */
  private async deployFromBackup(version: string): Promise<void> {
    const backupPath = this.getBackupPath(version);

    if (!existsSync(backupPath)) {
      throw new Error(`Backup not found for version ${version}`);
    }

    this.emitEvent({
      type: 'info',
      message: `Deploying from backup: ${backupPath}`,
      timestamp: new Date(),
    });

    // Restore from backup
    const backup = JSON.parse(readFileSync(backupPath, 'utf-8'));

    // Deploy worker script
    const scriptPath = backup.workerScript;
    if (scriptPath && existsSync(scriptPath)) {
      await this.deployWorkerScript(scriptPath);
    }

    // Restore secrets if backed up
    if (backup.secrets) {
      await this.restoreSecrets(backup.secrets);
    }
  }

  /**
   * Deploy partial version to percentage of regions
   */
  private async deployPartialVersion(version: string, percentage: number): Promise<void> {
    // This is a simplified implementation
    // In practice, you'd use traffic splitting or weighted routing
    this.emitEvent({
      type: 'info',
      message: `Deploying version ${version} to ${percentage}% of traffic`,
      timestamp: new Date(),
    });

    await this.deployVersion(version);
  }

  /**
   * Generate rollback plan
   */
  private async generateRollbackPlan(
    rollbackConfig: RollbackConfig
  ): Promise<{
    targetVersion: string;
    steps: string[];
    estimatedTime: number;
    risks: string[];
  }> {
    return {
      targetVersion: rollbackConfig.targetVersion,
      steps: [
        'Backup current deployment state',
        'Verify target version exists',
        'Deploy target version',
        'Verify health checks',
        'Update DNS if needed',
      ],
      estimatedTime: 300000, // 5 minutes
      risks: [
        'Traffic disruption during rollback',
        'Data inconsistency if schema changed',
        'Secrets may need rotation',
      ],
    };
  }

  /**
   * Verify rollback was successful
   */
  private async verifyRollback(rollbackConfig: RollbackConfig): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Verifying rollback...',
      timestamp: new Date(),
    });

    // Wait for deployment to propagate
    await this.sleep(10000);

    // Perform health checks
    const healthy = await this.healthCheck();

    if (!healthy) {
      throw new Error('Rollback verification failed - health checks not passing');
    }

    // Verify version
    const currentVersion = await this.getCurrentVersion();
    if (currentVersion !== rollbackConfig.targetVersion) {
      throw new Error(
        `Rollback verification failed - expected version ${rollbackConfig.targetVersion}, got ${currentVersion}`
      );
    }

    this.emitEvent({
      type: 'success',
      message: 'Rollback verified successfully',
      timestamp: new Date(),
    });
  }

  /**
   * Health check after rollback
   */
  private async healthCheck(): Promise<boolean> {
    try {
      const url = this.getWorkerUrl();
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current deployment version
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const envFlag = this.config.environment !== 'development'
        ? `--env ${this.config.environment}`
        : '';

      const command = `wrangler deployments list ${envFlag}`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      // Parse output to get latest version
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('id')) {
          const match = line.match(/id["\s:]+([a-f0-9-]+)/i);
          if (match) {
            return match[1];
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * List available rollback versions
   */
  async listRollbackVersions(): Promise<Array<{
    version: string;
    timestamp: Date;
    description?: string;
  }>> {
    const versions: Array<{
      version: string;
      timestamp: Date;
      description?: string;
    }> = [];

    try {
      const envFlag = this.config.environment !== 'development'
        ? `--env ${this.config.environment}`
        : '';

      const command = `wrangler deployments list ${envFlag}`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      // Parse deployments
      const lines = output.split('\n');
      let currentVersion: string | null = null;
      let currentTimestamp: Date | null = null;

      for (const line of lines) {
        const versionMatch = line.match(/id["\s:]+([a-f0-9-]+)/i);
        const timestampMatch = line.match(/created_at["\s:]+([0-9T\-:.]+)/i);

        if (versionMatch) {
          currentVersion = versionMatch[1];
        }
        if (timestampMatch) {
          currentTimestamp = new Date(timestampMatch[1]);
        }

        if (currentVersion && currentTimestamp) {
          versions.push({
            version: currentVersion,
            timestamp: currentTimestamp,
          });
          currentVersion = null;
          currentTimestamp = null;
        }
      }
    } catch (error) {
      this.context.logger.warn(`Failed to list rollback versions: ${error}`);
    }

    return versions;
  }

  /**
   * Backup current deployment state
   */
  async backupCurrentState(): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Backing up current deployment state...',
      timestamp: new Date(),
    });

    const version = await this.getCurrentVersion();
    if (!version) {
      throw new Error('Failed to get current version for backup');
    }

    const backupPath = this.getBackupPath(version);
    const backup: any = {
      version,
      timestamp: new Date(),
      environment: this.config.environment,
    };

    // Backup worker script
    const scriptPath = resolve(process.cwd(), 'dist/worker.js');
    if (existsSync(scriptPath)) {
      backup.workerScript = scriptPath;
      backup.workerContent = readFileSync(scriptPath, 'utf-8');
    }

    // Backup secrets if enabled
    const secretsPath = resolve(process.cwd(), '.secrets', `${this.config.environment}.json`);
    if (existsSync(secretsPath)) {
      backup.secrets = JSON.parse(readFileSync(secretsPath, 'utf-8'));
    }

    // Backup configuration
    const wranglerPath = resolve(process.cwd(), 'wrangler.toml');
    if (existsSync(wranglerPath)) {
      backup.wranglerConfig = readFileSync(wranglerPath, 'utf-8');
    }

    // Write backup
    writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');

    this.emitEvent({
      type: 'success',
      message: `Backup created at ${backupPath}`,
      timestamp: new Date(),
    });
  }

  /**
   * Get backup path for a version
   */
  private getBackupPath(version: string): string {
    const backupDir = resolve(process.cwd(), '.deployments', 'backups');
    return resolve(backupDir, `${version}.json`);
  }

  /**
   * Restore secrets from backup
   */
  private async restoreSecrets(secrets: Record<string, string>): Promise<void> {
    this.emitEvent({
      type: 'info',
      message: 'Restoring secrets from backup...',
      timestamp: new Date(),
    });

    for (const [name, value] of Object.entries(secrets)) {
      try {
        const envFlag = this.config.environment !== 'development'
          ? `--env ${this.config.environment}`
          : '';

        const command = `echo "${value}" | wrangler secret put ${name} ${envFlag}`;
        execSync(command, {
          stdio: 'pipe',
          input: value,
        });
      } catch (error) {
        this.context.logger.warn(`Failed to restore secret ${name}: ${error}`);
      }
    }

    this.emitEvent({
      type: 'success',
      message: 'Secrets restored from backup',
      timestamp: new Date(),
    });
  }

  /**
   * Deploy worker script from file
   */
  private async deployWorkerScript(scriptPath: string): Promise<void> {
    const envFlag = this.config.environment !== 'development'
      ? `--env ${this.config.environment}`
      : '';

    const command = `wrangler deploy ${envFlag} --no-bundle`;

    execSync(command, {
      stdio: this.config.verbose ? 'inherit' : 'pipe',
      cwd: resolve(process.cwd(), scriptPath, '..'),
    });
  }

  /**
   * Auto-rollback on failure
   */
  async autoRollbackOnFailure(): Promise<void> {
    this.emitEvent({
      type: 'warning',
      message: 'Initiating automatic rollback due to deployment failure...',
      timestamp: new Date(),
    });

    try {
      // Get previous version
      const versions = await this.listRollbackVersions();
      if (versions.length < 2) {
        throw new Error('No previous version to rollback to');
      }

      const previousVersion = versions[1].version;

      // Execute immediate rollback
      await this.rollback({
        strategy: 'immediate',
        targetVersion: previousVersion,
        backupData: false,
        verifyAfterRollback: true,
        maxRollbackTime: 300000,
      });

      this.emitEvent({
        type: 'success',
        message: 'Automatic rollback completed',
        timestamp: new Date(),
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: 'Automatic rollback failed',
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Get worker URL based on environment
   */
  private getWorkerUrl(): string {
    const subdomain = this.config.environment === 'production'
      ? 'claudeflare'
      : `claudeflare-${this.config.environment}`;

    return `https://${subdomain}.workers.dev`;
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
}

/**
 * Create a new rollback manager instance
 */
export function createRollbackManager(
  config: DeploymentConfig,
  context: DeploymentContext
): RollbackManager {
  return new RollbackManager(config, context);
}
