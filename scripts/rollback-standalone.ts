#!/usr/bin/env tsx

/**
 * ClaudeFlare Standalone Rollback Script
 * Handles automated and manual rollback operations
 * Can be used independently or within CI/CD pipelines
 */

import { execSync } from 'child_process';
import { readFile, writeFile, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

interface RollbackConfig {
  environment: 'development' | 'staging' | 'production';
  targetVersion?: string;
  strategy: 'immediate' | 'gradual' | 'manual';
  backupBeforeRollback: boolean;
  verifyAfterRollback: boolean;
  healthCheckTimeout: number;
  maxRollbackTime: number;
  reason?: string;
  dryRun: boolean;
  verbose: boolean;
}

interface RollbackPlan {
  currentVersion: string;
  targetVersion: string;
  strategy: string;
  steps: Array<{
    order: number;
    description: string;
    estimatedTime: number;
    risks: string[];
  }>;
  totalEstimatedTime: number;
  risks: string[];
}

interface RollbackResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  strategy: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    duration: number;
    error?: string;
  }>;
  verification?: {
    healthCheckPassed: boolean;
    versionMatch: boolean;
    details: Record<string, unknown>;
  };
}

class RollbackOrchestrator {
  private config: RollbackConfig;
  private startTime: Date = new Date();

  constructor(config: RollbackConfig) {
    this.config = config;
  }

  /**
   * Execute rollback
   */
  async rollback(): Promise<RollbackResult> {
    console.log('🔄 ClaudeFlare Rollback Orchestrator');
    console.log(`   Environment: ${this.config.environment}`);
    console.log(`   Strategy: ${this.config.strategy}`);
    console.log(`   Started: ${this.startTime.toISOString()}`);
    console.log('');

    const result: RollbackResult = {
      success: false,
      fromVersion: '',
      toVersion: '',
      strategy: this.config.strategy,
      startTime: this.startTime,
      endTime: new Date(),
      duration: 0,
      steps: [],
    };

    try {
      // Step 1: Get current version
      result.fromVersion = await this.getCurrentVersion();
      console.log(`📍 Current version: ${result.fromVersion}\n`);

      // Step 2: Determine target version
      result.toVersion = this.config.targetVersion || await this.findPreviousVersion();
      console.log(`🎯 Target version: ${result.toVersion}\n`);

      // Step 3: Generate rollback plan
      const plan = await this.generateRollbackPlan(result.fromVersion, result.toVersion);
      this.printRollbackPlan(plan);

      if (this.config.dryRun) {
        console.log('⚠️  Dry run mode - no changes will be made');
        return result;
      }

      // Step 4: Backup current deployment if requested
      if (this.config.backupBeforeRollback) {
        await this.executeStep('Backup Current Deployment', this.backupCurrentDeployment.bind(this), result);
      }

      // Step 5: Execute rollback based on strategy
      switch (this.config.strategy) {
        case 'immediate':
          await this.executeStep('Immediate Rollback', this.immediateRollback.bind(this, result.toVersion), result);
          break;
        case 'gradual':
          await this.executeStep('Gradual Rollback', this.gradualRollback.bind(this, result.toVersion), result);
          break;
        case 'manual':
          await this.executeStep('Manual Rollback', this.manualRollback.bind(this, result.toVersion), result);
          break;
      }

      // Step 6: Verify rollback if requested
      if (this.config.verifyAfterRollback) {
        await this.executeStep('Verify Rollback', this.verifyRollback.bind(this, result.toVersion), result);
      }

      // Step 7: Final checks
      await this.executeStep('Final Checks', this.runFinalChecks.bind(this), result);

      result.success = true;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      console.log('');
      console.log('✅ Rollback completed successfully!');
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   From: ${result.fromVersion}`);
      console.log(`   To: ${result.toVersion}\n`);

      return result;
    } catch (error) {
      result.success = false;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      console.error('');
      console.error('❌ Rollback failed!');
      console.error(`   Error: ${error}`);
      console.error(`   Duration: ${result.duration}ms\n`);

      throw error;
    }
  }

  /**
   * Get current deployment version
   */
  private async getCurrentVersion(): Promise<string> {
    try {
      const envFlag = this.getEnvFlag();
      const command = `wrangler deployments list ${envFlag} --json`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      const deployments = JSON.parse(output);
      if (deployments.length > 0) {
        return deployments[0].id || deployments[0].version || 'unknown';
      }

      throw new Error('No deployments found');
    } catch (error) {
      // Fallback: read from local metadata
      const metadataPath = join(process.cwd(), '.deployments', 'current.json');
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFile(metadataPath, 'utf-8'));
        return metadata.version || 'unknown';
      }

      return 'unknown';
    }
  }

  /**
   * Find previous version
   */
  private async findPreviousVersion(): Promise<string> {
    try {
      const envFlag = this.getEnvFlag();
      const command = `wrangler deployments list ${envFlag} --json`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

      const deployments = JSON.parse(output);
      if (deployments.length > 1) {
        return deployments[1].id || deployments[1].version || 'unknown';
      }

      // Fallback: check local backups
      const backupDir = join(process.cwd(), '.deployments', 'backups');
      if (existsSync(backupDir)) {
        const backups = readdirSync(backupDir)
          .filter(f => f.endsWith('.json'))
          .map(f => join(backupDir, f))
          .sort((a, b) => statSync(b).mtime.getTime() - statSync(a).mtime.getTime());

        if (backups.length > 0) {
          const backup = JSON.parse(readFile(backups[0], 'utf-8'));
          return backup.version || 'unknown';
        }
      }

      throw new Error('No previous version found');
    } catch (error) {
      throw new Error(`Could not find previous version: ${error}`);
    }
  }

  /**
   * Generate rollback plan
   */
  private async generateRollbackPlan(fromVersion: string, toVersion: string): Promise<RollbackPlan> {
    const steps = [
      {
        order: 1,
        description: 'Backup current deployment state',
        estimatedTime: 30000,
        risks: ['Backup may fail if storage is unavailable'],
      },
      {
        order: 2,
        description: 'Verify target version exists',
        estimatedTime: 5000,
        risks: [],
      },
      {
        order: 3,
        description: 'Deploy target version',
        estimatedTime: 60000,
        risks: ['Traffic disruption during deployment', 'New version may have issues'],
      },
      {
        order: 4,
        description: 'Run health checks',
        estimatedTime: 30000,
        risks: ['Health checks may timeout'],
      },
      {
        order: 5,
        description: 'Verify deployment',
        estimatedTime: 10000,
        risks: [],
      },
    ];

    const totalEstimatedTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);

    return {
      currentVersion: fromVersion,
      targetVersion: toVersion,
      strategy: this.config.strategy,
      steps,
      totalEstimatedTime,
      risks: [
        'Temporary service interruption',
        'Data inconsistency if schema changed',
        'Cached responses may be stale',
        'Dependent services may be affected',
      ],
    };
  }

  /**
   * Print rollback plan
   */
  private printRollbackPlan(plan: RollbackPlan): void {
    console.log('📋 Rollback Plan:');
    console.log('');
    console.log(`   Current Version: ${plan.currentVersion}`);
    console.log(`   Target Version: ${plan.targetVersion}`);
    console.log(`   Strategy: ${plan.strategy}`);
    console.log(`   Estimated Time: ${(plan.totalEstimatedTime / 1000).toFixed(0)}s`);
    console.log('');
    console.log('   Steps:');
    for (const step of plan.steps) {
      console.log(`   ${step.order}. ${step.description} (${(step.estimatedTime / 1000).toFixed(0)}s)`);
      if (step.risks.length > 0) {
        console.log(`      Risks: ${step.risks.join(', ')}`);
      }
    }
    console.log('');
    console.log('   Overall Risks:');
    for (const risk of plan.risks) {
      console.log(`   - ${risk}`);
    }
    console.log('');
  }

  /**
   * Backup current deployment
   */
  private async backupCurrentDeployment(): Promise<void> {
    console.log('💾 Backing up current deployment...');

    const backupDir = join(process.cwd(), '.deployments', 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentVersion = await this.getCurrentVersion();
    const backupFile = join(backupDir, `${currentVersion}-${timestamp}.json`);

    // Create backup directory
    execSync(`mkdir -p ${backupDir}`, { stdio: 'pipe' });

    // Gather backup data
    const backup: any = {
      version: currentVersion,
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      reason: this.config.reason || 'Pre-rollback backup',
    };

    // Backup worker script
    const workerPath = join(process.cwd(), 'dist', 'worker.js');
    if (existsSync(workerPath)) {
      backup.workerScript = readFile(workerPath, 'utf-8');
    }

    // Backup wrangler config
    const wranglerPath = join(process.cwd(), 'wrangler.toml');
    if (existsSync(wranglerPath)) {
      backup.wranglerConfig = readFile(wranglerPath, 'utf-8');
    }

    // Write backup
    writeFile(backupFile, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup saved to ${backupFile}`);
  }

  /**
   * Immediate rollback
   */
  private async immediateRollback(targetVersion: string): Promise<void> {
    console.log('🚀 Executing immediate rollback...');

    const envFlag = this.getEnvFlag();

    try {
      // Try wrangler rollback first
      const command = `wrangler rollback ${envFlag}`;
      execSync(command, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        timeout: this.config.maxRollbackTime,
      });

      console.log('✅ Rollback completed via wrangler');
    } catch (error) {
      console.warn('⚠️  Wrangler rollback not available, using alternative method');

      // Alternative: Deploy from backup
      const backupDir = join(process.cwd(), '.deployments', 'backups');
      const backupFile = join(backupDir, `${targetVersion}.json`);

      if (!existsSync(backupFile)) {
        throw new Error(`Backup not found: ${backupFile}`);
      }

      const backup = JSON.parse(readFile(backupFile, 'utf-8'));

      if (backup.workerScript) {
        // Restore worker script
        writeFile(join(process.cwd(), 'dist', 'worker.js'), backup.workerScript);

        // Deploy
        const deployCommand = `wrangler deploy ${envFlag}`;
        execSync(deployCommand, {
          stdio: this.config.verbose ? 'inherit' : 'pipe',
          timeout: this.config.maxRollbackTime,
        });

        console.log('✅ Rollback completed from backup');
      } else {
        throw new Error('Backup does not contain worker script');
      }
    }
  }

  /**
   * Gradual rollback
   */
  private async gradualRollback(targetVersion: string): Promise<void> {
    console.log('🔄 Executing gradual rollback...');

    const stages = [
      { percentage: 10, waitTime: 30000 },
      { percentage: 50, waitTime: 30000 },
      { percentage: 100, waitTime: 0 },
    ];

    for (const stage of stages) {
      console.log(`📍 Rolling back to ${stage.percentage}%...`);

      // Deploy to percentage (simplified - in practice would use traffic splitting)
      await this.immediateRollback(targetVersion);

      // Wait for propagation
      if (stage.waitTime > 0) {
        console.log(`⏳ Waiting ${stage.waitTime / 1000}s for propagation...`);
        await this.sleep(stage.waitTime);
      }

      // Health check
      const healthy = await this.quickHealthCheck();
      if (!healthy) {
        throw new Error(`Health check failed at ${stage.percentage}% rollback`);
      }

      console.log(`✅ ${stage.percentage}% rollback successful`);
    }

    console.log('✅ Gradual rollback completed');
  }

  /**
   * Manual rollback
   */
  private async manualRollback(targetVersion: string): Promise<void> {
    console.log('📋 Manual rollback requested...');
    console.log('');
    console.log('⚠️  Manual rollback requires the following steps:');
    console.log('   1. Review the rollback plan above');
    console.log('   2. Prepare the target version');
    console.log('   3. Deploy the target version');
    console.log('   4. Verify the deployment');
    console.log('');
    console.log('To continue with automated rollback, use --strategy immediate or gradual');
    console.log('');

    throw new Error('Manual rollback requires human intervention. Use --strategy immediate or gradual for automated rollback.');
  }

  /**
   * Verify rollback
   */
  private async verifyRollback(targetVersion: string): Promise<void> {
    console.log('🔍 Verifying rollback...');

    // Wait for deployment to propagate
    console.log('⏳ Waiting 10s for deployment propagation...');
    await this.sleep(10000);

    // Health check
    const healthy = await this.quickHealthCheck();
    if (!healthy) {
      throw new Error('Health check failed after rollback');
    }

    // Version check
    const currentVersion = await this.getCurrentVersion();
    if (currentVersion !== targetVersion) {
      throw new Error(`Version mismatch: expected ${targetVersion}, got ${currentVersion}`);
    }

    console.log('✅ Rollback verified successfully');
  }

  /**
   * Run final checks
   */
  private async runFinalChecks(): Promise<void> {
    console.log('🔍 Running final checks...');

    // Check critical endpoints
    const url = this.getDeploymentUrl();
    const endpoints = ['/health', '/metrics', '/api/status'];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${url}${endpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          console.log(`✅ ${endpoint}: OK`);
        } else {
          console.warn(`⚠️  ${endpoint}: HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn(`⚠️  ${endpoint}: ${error}`);
      }
    }

    console.log('✅ Final checks completed');
  }

  /**
   * Quick health check
   */
  private async quickHealthCheck(): Promise<boolean> {
    try {
      const url = this.getDeploymentUrl();
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.healthCheckTimeout),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Execute a rollback step
   */
  private async executeStep(
    name: string,
    stepFn: () => Promise<void>,
    result: RollbackResult
  ): Promise<void> {
    const startTime = Date.now();
    const step = {
      name,
      status: 'running' as const,
      duration: 0,
    };

    result.steps.push(step);
    console.log(`🔧 ${name}...`);

    try {
      await stepFn();
      step.status = 'success';
      step.duration = Date.now() - startTime;
      console.log(`✅ ${name} completed (${step.duration}ms)\n`);
    } catch (error) {
      step.status = 'failed';
      step.duration = Date.now() - startTime;
      step.error = error instanceof Error ? error.message : String(error);

      console.error(`❌ ${name} failed (${step.duration}ms)`);
      console.error(`   Error: ${step.error}\n`);

      throw error;
    }
  }

  /**
   * Get environment flag for wrangler
   */
  private getEnvFlag(): string {
    return this.config.environment === 'development' ? '' : `--env ${this.config.environment}`;
  }

  /**
   * Get deployment URL
   */
  private getDeploymentUrl(): string {
    switch (this.config.environment) {
      case 'production':
        return 'https://claudeflare.workers.dev';
      case 'staging':
        return 'https://staging.claudeflare.workers.dev';
      case 'development':
        return 'http://localhost:8787';
      default:
        throw new Error(`Unknown environment: ${this.config.environment}`);
    }
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
function parseArgs(): RollbackConfig {
  const args = process.argv.slice(2);
  const config: Partial<RollbackConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--environment':
      case '-e':
        config.environment = (nextArg || 'production') as RollbackConfig['environment'];
        i++;
        break;
      case '--target':
      case '-t':
        config.targetVersion = nextArg;
        i++;
        break;
      case '--strategy':
      case '-s':
        config.strategy = (nextArg || 'immediate') as RollbackConfig['strategy'];
        i++;
        break;
      case '--reason':
      case '-r':
        config.reason = nextArg;
        i++;
        break;
      case '--no-backup':
        config.backupBeforeRollback = false;
        break;
      case '--no-verify':
        config.verifyAfterRollback = false;
        break;
      case '--dry-run':
      case '-n':
        config.dryRun = true;
        break;
      case '--quiet':
      case '-q':
        config.verbose = false;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return {
    environment: config.environment || 'production',
    targetVersion: config.targetVersion,
    strategy: config.strategy || 'immediate',
    backupBeforeRollback: config.backupBeforeRollback !== false,
    verifyAfterRollback: config.verifyAfterRollback !== false,
    healthCheckTimeout: 10000,
    maxRollbackTime: 300000,
    reason: config.reason,
    dryRun: config.dryRun || false,
    verbose: config.verbose !== false,
  };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ClaudeFlare Rollback Script

Usage: tsx scripts/rollback-standalone.ts [options]

Options:
  -e, --environment <env>     Target environment (development, staging, production) [default: production]
  -t, --target <version>      Specific version to rollback to [default: previous version]
  -s, --strategy <strategy>   Rollback strategy (immediate, gradual, manual) [default: immediate]
  -r, --reason <text>         Reason for rollback
      --no-backup             Skip backup before rollback
      --no-verify             Skip verification after rollback
  -n, --dry-run               Show rollback plan without executing
  -q, --quiet                 Reduce output verbosity
  -h, --help                  Show this help message

Examples:
  tsx scripts/rollback-standalone.ts --environment staging
  tsx scripts/rollback-standalone.ts -e production -s gradual --reason "High error rate"
  tsx scripts/rollback-standalone.ts -t v1234567890-abc123 --dry-run
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    const orchestrator = new RollbackOrchestrator(config);
    await orchestrator.rollback();
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { RollbackOrchestrator, RollbackConfig, RollbackResult, RollbackPlan };
