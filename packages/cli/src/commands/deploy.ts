/**
 * Deploy command - Deploy to Cloudflare Workers
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { cwd } from 'process';
import { loadConfig, writeWranglerConfig } from '../config/index.js';
import { execWrangler, checkWranglerInstalled, checkWranglerAuth } from '../utils/wrangler.js';
import {
  createLogger,
  createSpinner,
  Prompts,
  TableFormatter,
  DependencyError,
  AuthenticationError,
} from '../utils/index.js';
import type { Config } from '../types/index.js';

export interface DeployOptions {
  environment?: 'production' | 'preview' | 'development';
  name?: string;
  var?: string[];
  secret?: string[];
  kvNamespace?: string[];
  r2Bucket?: string[];
  dryRun?: boolean;
  force?: boolean;
  debug?: boolean;
}

export async function deployCommand(options: DeployOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const prompts = new Prompts(logger);

  const spinner = createSpinner({
    text: 'Preparing deployment...',
    color: 'cyan',
  });

  try {
    // Check wrangler installation
    spinner.start('Checking dependencies...');

    const hasWrangler = await checkWranglerInstalled();

    if (!hasWrangler) {
      spinner.fail('Wrangler not found');
      throw new DependencyError('Wrangler CLI is not installed');
    }

    spinner.succeed('Wrangler found');

    // Check authentication
    spinner.start('Checking authentication...');

    const isAuthenticated = await checkWranglerAuth();

    if (!isAuthenticated) {
      spinner.fail('Not authenticated');

      const shouldLogin = await prompts.confirm(
        'You need to login to Cloudflare. Do you want to login now?'
      );

      if (shouldLogin) {
        logger.command('wrangler login');
        const loginSpinner = createSpinner({ text: 'Opening browser for login...' });
        loginSpinner.start();

        await execWrangler({
          command: 'login',
          silent: false,
        });

        loginSpinner.succeed('Authenticated successfully');
      } else {
        throw new AuthenticationError('Cloudflare authentication required');
      }
    } else {
      spinner.succeed('Authenticated');
    }

    // Load configuration
    spinner.start('Loading configuration...');

    const projectDir = cwd();
    const config = await loadConfig(projectDir);

    spinner.succeed('Configuration loaded');

    // Determine environment
    const environment = options.environment ?? config.deploy.environment ?? 'preview';
    const isProduction = environment === 'production';

    // Build project
    spinner.start('Building project...');

    const { execSync } = await import('child_process');

    try {
      execSync('npm run build', {
        cwd: projectDir,
        stdio: options.debug ? 'inherit' : 'pipe',
      });
      spinner.succeed('Project built successfully');
    } catch (error) {
      spinner.fail('Build failed');
      throw error;
    }

    // Write wrangler.toml
    spinner.start('Generating wrangler configuration...');

    const deployConfig: Config = {
      ...config,
      deploy: {
        ...config.deploy,
        environment,
      },
    };

    writeWranglerConfig(deployConfig, projectDir);

    spinner.succeed('Wrangler configuration generated');

    // Handle secrets
    if (config.deploy.secrets.length > 0 && !options.dryRun) {
      spinner.text = 'Configuring secrets...';

      for (const secretName of config.deploy.secrets) {
        const secretValue = process.env[secretName];

        if (!secretValue) {
          spinner.warn(`Secret ${secretName} not found in environment`);
          continue;
        }

        try {
          await execWrangler({
            command: 'secret put',
            args: [secretName],
            env: {
              CLOUDFLARE_API_TOKEN: secretValue,
            },
            silent: true,
          });
        } catch (error) {
          spinner.warn(`Failed to set secret ${secretName}`);
        }
      }

      spinner.succeed('Secrets configured');
    }

    // Handle CLI-provided vars and secrets
    const deployArgs: string[] = [];

    if (options.var) {
      for (const v of options.var) {
        deployArgs.push('--var', v);
      }
    }

    if (options.secret) {
      for (const secret of options.secret) {
        deployArgs.push('--secret', secret);
      }
    }

    // Confirm deployment if production
    if (isProduction && !options.force && !options.dryRun) {
      spinner.stop();

      const confirmed = await prompts.confirmOrCancel(
        'You are about to deploy to PRODUCTION. Are you sure?'
      );

      if (!confirmed) {
        logger.info('Deployment cancelled');
        process.exit(0);
      }

      spinner.start('Deploying...');
    } else {
      spinner.text = 'Deploying...';
    }

    if (!options.dryRun) {
      // Perform deployment
      const startTime = Date.now();

      const deployResult = await execWrangler({
        command: 'deploy',
        args: deployArgs,
        cwd: projectDir,
        silent: false,
      });

      const duration = Date.now() - startTime;

      if (deployResult.exitCode === 0) {
        spinner.succeed(`Deployed successfully in ${duration}ms`);

        // Parse deployment URL from output
        const urlMatch = deployResult.stdout.match(/https:\/\/[^\s]+/);
        const deploymentUrl = urlMatch ? urlMatch[0] : undefined;

        // Show deployment summary
        logger.newline();
        logger.box(
          'Deployment Successful',
          TableFormatter.deployment({
            environment,
            url: deploymentUrl,
            duration,
          })
        );

        if (deploymentUrl) {
          logger.info(`View your deployment at: ${deploymentUrl}`);
        }
      } else {
        spinner.fail('Deployment failed');
        throw new Error(deployResult.stderr);
      }
    } else {
      spinner.succeed('Dry run completed (no deployment performed)');

      logger.info('Configuration validated successfully');
      logger.newline();
      logger.keyvalue({
        Environment: environment,
        Worker: config.worker.name,
        'Build output': config.build.output,
      });
    }

  } catch (error) {
    spinner.fail('Deployment failed');

    if (error instanceof Error) {
      logger.error(error.message);

      if (options.debug && error.stack) {
        logger.newline();
        logger.debug(error.stack);
      }
    }

    process.exit(1);
  }
}

/**
 * Register deploy command with CLI
 */
export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy to Cloudflare Workers')
    .option('-e, --environment <name>', 'Environment to deploy to', 'preview')
    .option('-n, --name <string>', 'Worker name')
    .option('--var <key=value>', 'Environment variable (can be used multiple times)', [])
    .option('--secret <key=value>', 'Secret (can be used multiple times)', [])
    .option('--kv-namespace <binding:id>', 'KV namespace binding (can be used multiple times)', [])
    .option('--r2-bucket <binding:bucket>', 'R2 bucket binding (can be used multiple times)', [])
    .option('--dry-run', 'Validate without deploying')
    .option('-f, --force', 'Skip confirmation prompts')
    .option('--debug', 'Enable debug output')
    .action(deployCommand);
}
