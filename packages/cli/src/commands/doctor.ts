/**
 * Doctor command - Diagnose issues
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { cwd } from 'process';
import { execSync } from 'child_process';
import semver from 'semver';
import { loadConfig } from '../config/index.js';
import {
  createLogger,
  createSpinner,
  TableFormatter,
  DependencyError,
} from '../utils/index.js';
import { checkWranglerInstalled, checkWranglerAuth } from '../utils/wrangler.js';

export interface DoctorOptions {
  fix?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  fix?: () => Promise<void>;
}

/**
 * Check Node.js version
 */
async function checkNodeVersion(): Promise<HealthCheck> {
  const nodeVersion = process.version;
  const requiredVersion = '>=18.0.0';

  const status = semver.satisfies(nodeVersion, requiredVersion) ? 'pass' : 'fail';

  return {
    name: 'Node.js version',
    status,
    message: `Current: ${nodeVersion}, Required: ${requiredVersion}`,
    fix: async () => {
      throw new Error('Please upgrade Node.js to version 18 or higher');
    },
  };
}

/**
 * Check npm version
 */
async function checkNpmVersion(): Promise<HealthCheck> {
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    const requiredVersion = '>=9.0.0';

    const status = semver.satisfies(npmVersion, requiredVersion) ? 'pass' : 'warn';

    return {
      name: 'npm version',
      status,
      message: `Current: v${npmVersion}, Recommended: ${requiredVersion}`,
    };
  } catch {
    return {
      name: 'npm version',
      status: 'fail',
      message: 'npm not found',
    };
  }
}

/**
 * Check if wrangler is installed
 */
async function checkWrangler(): Promise<HealthCheck> {
  const hasWrangler = await checkWranglerInstalled();

  return {
    name: 'Wrangler CLI',
    status: hasWrangler ? 'pass' : 'fail',
    message: hasWrangler ? 'Wrangler is installed' : 'Wrangler not found',
    fix: async () => {
      execSync('npm install -g wrangler', { stdio: 'inherit' });
    },
  };
}

/**
 * Check Cloudflare authentication
 */
async function checkAuth(): Promise<HealthCheck> {
  const isAuthenticated = await checkWranglerAuth();

  return {
    name: 'Cloudflare authentication',
    status: isAuthenticated ? 'pass' : 'warn',
    message: isAuthenticated ? 'Authenticated' : 'Not logged in',
    fix: async () => {
      execSync('npx wrangler login', { stdio: 'inherit' });
    },
  };
}

/**
 * Check configuration file
 */
async function checkConfigFile(): Promise<HealthCheck> {
  const configPath = resolve(cwd(), 'claudeflare.config.ts');

  const exists = existsSync(configPath);

  return {
    name: 'Configuration file',
    status: exists ? 'pass' : 'fail',
    message: exists ? 'claudeflare.config.ts found' : 'claudeflare.config.ts not found',
    fix: async () => {
      throw new DependencyError('Run: claudeflare init');
    },
  };
}

/**
 * Check wrangler.toml
 */
async function checkWranglerConfig(): Promise<HealthCheck> {
  const wranglerPath = resolve(cwd(), 'wrangler.toml');

  const exists = existsSync(wranglerPath);

  return {
    name: 'Wrangler configuration',
    status: exists ? 'pass' : 'warn',
    message: exists ? 'wrangler.toml found' : 'wrangler.toml not found (will be generated)',
  };
}

/**
 * Check dependencies
 */
async function checkDependencies(): Promise<HealthCheck> {
  const packageJsonPath = resolve(cwd(), 'package.json');
  const nodeModulesPath = resolve(cwd(), 'node_modules');

  const hasPackageJson = existsSync(packageJsonPath);
  const hasNodeModules = existsSync(nodeModulesPath);

  if (!hasPackageJson) {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'package.json not found',
      fix: async () => {
        throw new DependencyError('Run: claudeflare init');
      },
    };
  }

  if (!hasNodeModules) {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'node_modules not found',
      fix: async () => {
        execSync('npm install', { stdio: 'inherit' });
      },
    };
  }

  return {
    name: 'Dependencies',
    status: 'pass',
    message: 'Dependencies installed',
  };
}

/**
 * Check source files
 */
async function checkSourceFiles(): Promise<HealthCheck> {
  const indexPath = resolve(cwd(), 'src/index.ts');

  const exists = existsSync(indexPath);

  return {
    name: 'Source files',
    status: exists ? 'pass' : 'warn',
    message: exists ? 'src/index.ts found' : 'src/index.ts not found',
  };
}

/**
 * Check environment variables
 */
async function checkEnvironmentVariables(): Promise<HealthCheck> {
  const envPath = resolve(cwd(), '.env');

  const exists = existsSync(envPath);

  if (exists) {
    return {
      name: 'Environment variables',
      status: 'pass',
      message: '.env file found',
    };
  }

  return {
    name: 'Environment variables',
    status: 'warn',
    message: '.env not found (optional)',
  };
}

/**
 * Check Git repository
 */
async function checkGitRepository(): Promise<HealthCheck> {
  const gitPath = resolve(cwd(), '.git');

  const exists = existsSync(gitPath);

  return {
    name: 'Git repository',
    status: exists ? 'pass' : 'warn',
    message: exists ? 'Git initialized' : 'Not a Git repository',
  };
}

/**
 * Main doctor command
 */
export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
  });

  const spinner = createSpinner({
    text: 'Running diagnostics...',
    color: 'cyan',
  });

  try {
    spinner.start();

    // Run all health checks
    const checks: HealthCheck[] = [
      await checkNodeVersion(),
      await checkNpmVersion(),
      await checkWrangler(),
      await checkAuth(),
      await checkConfigFile(),
      await checkWranglerConfig(),
      await checkDependencies(),
      await checkSourceFiles(),
      await checkEnvironmentVariables(),
      await checkGitRepository(),
    ];

    spinner.stop();

    // Calculate overall status
    const failedChecks = checks.filter((c) => c.status === 'fail');
    const warningChecks = checks.filter((c) => c.status === 'warn');
    const passedChecks = checks.filter((c) => c.status === 'pass');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (failedChecks.length > 0) {
      overallStatus = 'unhealthy';
    } else if (warningChecks.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Display results
    logger.newline();
    logger.box(
      `System Status: ${overallStatus.toUpperCase()}`,
      `Passed: ${passedChecks.length} | Warnings: ${warningChecks.length} | Failed: ${failedChecks.length}`
    );

    logger.info(TableFormatter.status(checks));

    // Show recommendations
    const allIssues = [...failedChecks, ...warningChecks];

    if (allIssues.length > 0) {
      logger.newline();
      logger.bold('Recommendations:');
      logger.newline();

      for (const issue of allIssues) {
        const icon = issue.status === 'fail' ? '❌' : '⚠️';
        console.log(`  ${icon} ${issue.name}: ${issue.message ?? ''}`);
      }

      logger.newline();

      // Offer to fix issues
      if (options.fix) {
        const fixableChecks = allIssues.filter((c) => c.fix);

        if (fixableChecks.length > 0) {
          const { Prompts } = await import('../utils/index.js');
          const prompts = new Prompts(logger);

          const shouldFix = await prompts.confirm(
            `Fix ${fixableChecks.length} issue(s) automatically?`
          );

          if (shouldFix) {
            for (const check of fixableChecks) {
              if (check.fix) {
                try {
                  await check.fix();
                  logger.success(`Fixed: ${check.name}`);
                } catch (error) {
                  if (error instanceof Error) {
                    logger.error(`Failed to fix ${check.name}: ${error.message}`);
                  }
                }
              }
            }
          }
        }
      } else {
        logger.info('Run with --fix to automatically fix some issues');
      }
    } else {
      logger.newline();
      logger.success('All systems operational!');
    }

    logger.newline();

  } catch (error) {
    spinner.fail('Diagnostics failed');

    if (error instanceof Error) {
      logger.error(error.message);

      if (options.debug && error.stack) {
        logger.debug(error.stack);
      }
    }

    process.exit(1);
  }
}

/**
 * Register doctor command with CLI
 */
export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose and fix issues')
    .option('-f, --fix', 'Automatically fix issues')
    .option('-v, --verbose', 'Verbose output')
    .option('--debug', 'Enable debug output')
    .action(doctorCommand);
}
