/**
 * Secrets Command
 *
 * Manage Cloudflare Workers secrets
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import inquirer from 'inquirer';

const logger = createLogger('secrets');

export interface SecretsOptions {
  environment?: string;
}

export function registerSecretsCommand(program: Command): void {
  const secretsCmd = program
    .command('secrets')
    .description('Manage Cloudflare Workers secrets');

  secretsCmd
    .command('list')
    .description('List all secrets')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (options: SecretsOptions) => {
      await listSecrets(options);
    });

  secretsCmd
    .command('put <key>')
    .description('Set a secret')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (key: string, options: SecretsOptions) => {
      await putSecret(key, options);
    });

  secretsCmd
    .command('remove <key>')
    .description('Remove a secret')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (key: string, options: SecretsOptions) => {
      await removeSecret(key, options);
    });
}

async function listSecrets(options: SecretsOptions): Promise<void> {
  const spinner = createSpinner('Fetching secrets...');

  try {
    const args = ['wrangler', 'secret', 'list'];

    if (options.environment) {
      args.push('--env', options.environment);
    }

    const output = execSync(`npx ${args.join(' ')}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    spinner.succeed('Secrets fetched');

    console.log('');
    console.log(output);
  } catch (error) {
    spinner.fail('Failed to fetch secrets');
    logger.error(String(error));
  }
}

async function putSecret(key: string, options: SecretsOptions): Promise<void> {
  const { value } = await inquirer.prompt([
    {
      type: 'password',
      name: 'value',
      message: `Enter value for ${key}:`,
      mask: '*',
    },
  ]);

  const spinner = createSpinner(`Setting secret ${key}...`);

  try {
    const args = ['wrangler', 'secret', 'put', key];

    if (options.environment) {
      args.push('--env', options.environment);
    }

    execSync(`echo "${value}" | npx ${args.join(' ')}`, {
      stdio: 'pipe',
      shell: true,
    });

    spinner.succeed(`Secret ${key} set`);
  } catch (error) {
    spinner.fail(`Failed to set secret ${key}`);
    logger.error(String(error));
  }
}

async function removeSecret(key: string, options: SecretsOptions): Promise<void> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow(`⚠️  Remove secret ${key}? This cannot be undone.`),
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  const spinner = createSpinner(`Removing secret ${key}...`);

  try {
    const args = ['wrangler', 'secret', 'delete', key];

    if (options.environment) {
      args.push('--env', options.environment);
    }

    execSync(`npx ${args.join(' ')}`, {
      stdio: 'pipe',
    });

    spinner.succeed(`Secret ${key} removed`);
  } catch (error) {
    spinner.fail(`Failed to remove secret ${key}`);
    logger.error(String(error));
  }
}
