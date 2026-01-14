/**
 * Env Command
 *
 * Manage environment variables
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import inquirer from 'inquirer';

const logger = createLogger('env');

export interface EnvOptions {
  environment?: string;
}

export function registerEnvCommand(program: Command): void {
  const envCmd = program
    .command('env')
    .description('Manage environment variables');

  envCmd
    .command('list')
    .description('List all environment variables')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (options: EnvOptions) => {
      await listEnv(options);
    });

  envCmd
    .command('set <key> <value>')
    .description('Set an environment variable')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (key: string, value: string, options: EnvOptions) => {
      await setEnv(key, value, options);
    });

  envCmd
    .command('get <key>')
    .description('Get an environment variable')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (key: string, options: EnvOptions) => {
      await getEnv(key, options);
    });

  envCmd
    .command('remove <key>')
    .description('Remove an environment variable')
    .option('-e, --environment <name>', 'Environment to use')
    .action(async (key: string, options: EnvOptions) => {
      await removeEnv(key, options);
    });
}

async function listEnv(options: EnvOptions): Promise<void> {
  const envFile = getEnvFile(options.environment);

  try {
    const content = await fs.readFile(envFile, 'utf-8');
    const env = parseEnv(content);

    if (Object.keys(env).length === 0) {
      logger.info('No environment variables set');
      return;
    }

    logger.info('Environment variables:');
    console.log('');

    for (const [key, value] of Object.entries(env)) {
      console.log(`  ${chalk.cyan(key)} = ${chalk.gray(maskValue(String(value)))}`);
    }

    console.log('');
  } catch {
    logger.info('No environment variables set');
  }
}

async function setEnv(
  key: string,
  value: string,
  options: EnvOptions
): Promise<void> {
  const envFile = getEnvFile(options.environment);
  const spinner = createSpinner(`Setting ${key}...`);

  try {
    let content = '';
    try {
      content = await fs.readFile(envFile, 'utf-8');
    } catch {
      // File doesn't exist, will be created
    }

    const env = parseEnv(content);
    env[key] = value;

    const newContent = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    await fs.mkdir(join(envFile, '..'), { recursive: true });
    await fs.writeFile(envFile, newContent + '\n');

    spinner.succeed(`Set ${key}`);
  } catch (error) {
    spinner.fail(`Failed to set ${key}`);
    throw error;
  }
}

async function getEnv(key: string, options: EnvOptions): Promise<void> {
  const envFile = getEnvFile(options.environment);

  try {
    const content = await fs.readFile(envFile, 'utf-8');
    const env = parseEnv(content);
    const value = env[key];

    if (value === undefined) {
      logger.info(`${key} is not set`);
      return;
    }

    console.log(value);
  } catch {
    logger.info(`${key} is not set`);
  }
}

async function removeEnv(key: string, options: EnvOptions): Promise<void> {
  const envFile = getEnvFile(options.environment);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove ${key}?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  const spinner = createSpinner(`Removing ${key}...`);

  try {
    const content = await fs.readFile(envFile, 'utf-8');
    const env = parseEnv(content);

    delete env[key];

    const newContent = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    await fs.writeFile(envFile, newContent + '\n');

    spinner.succeed(`Removed ${key}`);
  } catch (error) {
    spinner.fail(`Failed to remove ${key}`);
    throw error;
  }
}

function getEnvFile(environment?: string): string {
  if (environment && environment !== 'development') {
    return join(process.cwd(), `.env.${environment}`);
  }
  return join(process.cwd(), '.env');
}

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key] = value;
    }
  }

  return env;
}

function maskValue(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
}
