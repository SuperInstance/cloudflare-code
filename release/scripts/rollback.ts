#!/usr/bin/env tsx

/**
 * Rollback Script
 * Automated rollback procedures for ClaudeFlare v1.0
 */

import { program } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface RollbackConfig {
  environment: 'development' | 'staging' | 'production';
  version: string;
  backupPath: string;
  skipDatabase: boolean;
  skipCache: boolean;
  force: boolean;
}

class RollbackManager {
  private config: RollbackConfig;
  private rollbackLog: string[] = [];

  constructor(config: RollbackConfig) {
    this.config = config;
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.rollbackLog.push(logEntry);
    console.log(logEntry);
  }

  async confirmRollback(): Promise<boolean> {
    if (this.config.force) {
      return true;
    }

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(
        `\n⚠️  ROLLBACK to ${this.config.version} on ${this.config.environment}?\n` +
          `This will:\n` +
          `  • Revert deployed code\n` +
          `  ${!this.config.skipDatabase ? '• Rollback database migrations\n' : ''}` +
          `  ${!this.config.skipCache ? '• Clear and restore cache\n' : ''}` +
          `  • Update DNS if needed\n\n` +
          `Type 'yes' to confirm: `,
        (answer: string) => {
          rl.close();
          resolve(answer.toLowerCase() === 'yes');
        }
      );
    });
  }

  async preRollbackChecks(): Promise<boolean> {
    this.log('Running pre-rollback checks...');

    // Check if we're on the right branch
    try {
      const branch = execSync('git branch --show-current').toString().trim();
      if (branch !== 'main' && branch !== 'master') {
        this.log(`WARNING: Not on main branch (current: ${branch})`);
      }
    } catch (error) {
      this.log('ERROR: Cannot determine git branch');
      return false;
    }

    // Check if working directory is clean
    try {
      const status = execSync('git status --porcelain').toString();
      if (status.trim() !== '') {
        this.log('WARNING: Working directory has uncommitted changes');
        if (!this.config.force) {
          return false;
        }
      }
    } catch (error) {
      this.log('ERROR: Cannot check git status');
      return false;
    }

    // Check if target version exists
    try {
      execSync(`git rev-parse --verify ${this.config.version}^{commit}`);
    } catch (error) {
      this.log(`ERROR: Version ${this.config.version} not found`);
      return false;
    }

    // Check if backup exists
    if (!fs.existsSync(this.config.backupPath)) {
      this.log(`WARNING: Backup path not found: ${this.config.backupPath}`);
      if (!this.config.force) {
        return false;
      }
    }

    this.log('✓ Pre-rollback checks passed');
    return true;
  }

  async createBackup(): Promise<void> {
    this.log('Creating pre-rollback backup...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.config.backupPath, `pre-rollback-${timestamp}`);

    try {
      fs.mkdirSync(backupDir, { recursive: true });

      // Backup current deployment info
      const currentVersion = execSync('git rev-parse HEAD').toString().trim();
      fs.writeFileSync(
        path.join(backupDir, 'current-version.txt'),
        currentVersion
      );

      // Backup environment variables
      if (fs.existsSync('.env')) {
        fs.copyFileSync('.env', path.join(backupDir, '.env'));
      }

      // Backup wrangler configuration
      if (fs.existsSync('wrangler.toml')) {
        fs.copyFileSync('wrangler.toml', path.join(backupDir, 'wrangler.toml'));
      }

      this.log(`✓ Backup created: ${backupDir}`);
    } catch (error) {
      this.log(`ERROR: Failed to create backup: ${error}`);
      throw error;
    }
  }

  async rollbackCode(): Promise<void> {
    this.log('Rolling back code...');

    try {
      // Checkout target version
      execSync(`git checkout ${this.config.version}`, { stdio: 'inherit' });

      // Build if needed
      if (fs.existsSync('package.json')) {
        this.log('Running build...');
        execSync('npm run build', { stdio: 'inherit' });
      }

      this.log('✓ Code rolled back');
    } catch (error) {
      this.log(`ERROR: Failed to rollback code: ${error}`);
      throw error;
    }
  }

  async rollbackDatabase(): Promise<void> {
    if (this.config.skipDatabase) {
      this.log('Skipping database rollback');
      return;
    }

    this.log('Rolling back database...');

    try {
      // Check for database rollback scripts
      const rollbackScript = path.join(process.cwd(), 'scripts', 'db', 'rollback.sh');

      if (fs.existsSync(rollbackScript)) {
        execSync(`bash ${rollbackScript}`, { stdio: 'inherit' });
        this.log('✓ Database rolled back');
      } else {
        this.log('No database rollback script found, skipping');
      }
    } catch (error) {
      this.log(`ERROR: Failed to rollback database: ${error}`);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    if (this.config.skipCache) {
      this.log('Skipping cache clearing');
      return;
    }

    this.log('Clearing cache...');

    try {
      // Clear Cloudflare KV cache
      const env = this.config.environment.toUpperCase();
      const kvNamespace = process.env[`KV_NAMESPACE_${env}`];

      if (kvNamespace) {
        execSync(
          `wrangler kv:key list --namespace-id=${kvNamespace} | xargs -I {} wrangler kv:key delete --namespace-id=${kvNamespace} {}`,
          { stdio: 'inherit' }
        );
        this.log('✓ KV cache cleared');
      } else {
        this.log('No KV namespace configured, skipping');
      }
    } catch (error) {
      this.log(`WARNING: Failed to clear cache: ${error}`);
      // Don't fail on cache errors
    }
  }

  async deployRollback(): Promise<void> {
    this.log('Deploying rollback...');

    try {
      const deployCmd = `npm run deploy:${this.config.environment}`;
      execSync(deployCmd, { stdio: 'inherit' });
      this.log('✓ Rollback deployed');
    } catch (error) {
      this.log(`ERROR: Failed to deploy rollback: ${error}`);
      throw error;
    }
  }

  async verifyRollback(): Promise<boolean> {
    this.log('Verifying rollback...');

    try {
      // Run smoke tests
      execSync('npm run test:smoke', { stdio: 'inherit' });

      // Run health check
      const healthCheck = `npm run health-check:${this.config.environment}`;
      execSync(healthCheck, { stdio: 'inherit' });

      this.log('✓ Rollback verified');
      return true;
    } catch (error) {
      this.log(`ERROR: Rollback verification failed: ${error}`);
      return false;
    }
  }

  async saveRollbackLog(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(
      this.config.backupPath,
      `rollback-${timestamp}.log`
    );

    try {
      fs.writeFileSync(logFile, this.rollbackLog.join('\n'));
      this.log(`✓ Rollback log saved: ${logFile}`);
    } catch (error) {
      this.log(`WARNING: Failed to save rollback log: ${error}`);
    }
  }

  async execute(): Promise<void> {
    console.log('\n🔄 ClaudeFlare v1.0 Rollback\n');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Target Version: ${this.config.version}`);
    console.log(`Backup Path: ${this.config.backupPath}\n`);

    // Confirm rollback
    const confirmed = await this.confirmRollback();
    if (!confirmed) {
      this.log('Rollback cancelled');
      return;
    }

    // Pre-rollback checks
    const checksPassed = await this.preRollbackChecks();
    if (!checksPassed) {
      this.log('❌ Pre-rollback checks failed');
      this.log('Use --force to override');
      process.exit(1);
    }

    try {
      // Create backup
      await this.createBackup();

      // Rollback code
      await this.rollbackCode();

      // Rollback database
      await this.rollbackDatabase();

      // Clear cache
      await this.clearCache();

      // Deploy
      await this.deployRollback();

      // Verify
      const verified = await this.verifyRollback();
      if (!verified) {
        throw new Error('Rollback verification failed');
      }

      // Save log
      await this.saveRollbackLog();

      console.log('\n✅ Rollback completed successfully!\n');
    } catch (error) {
      console.log('\n❌ Rollback failed!\n');
      this.log(`ERROR: ${error}`);
      process.exit(1);
    }
  }
}

// CLI Interface
program
  .version('1.0.0')
  .description('Rollback ClaudeFlare deployment')
  .option('-e, --environment <env>', 'Environment', 'production')
  .option('-v, --version <version>', 'Version to rollback to', 'HEAD~1')
  .option('-b, --backup-path <path>', 'Backup directory', './backups')
  .option('--skip-database', 'Skip database rollback')
  .option('--skip-cache', 'Skip cache clearing')
  .option('-f, --force', 'Force rollback without confirmation')
  .parse(process.argv);

const options = program.opts();

const config: RollbackConfig = {
  environment: options.environment,
  version: options.version,
  backupPath: options.backupPath,
  skipDatabase: options.skipDatabase || false,
  skipCache: options.skipCache || false,
  force: options.force || false,
};

const manager = new RollbackManager(config);
manager.execute().catch((error) => {
  console.error('Rollback failed:', error.message);
  process.exit(1);
});
