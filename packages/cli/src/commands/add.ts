/**
 * Add Command
 *
 * Add dependencies, features, or integrations to the project
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';

const logger = createLogger('add');

export interface AddOptions {
  dev?: boolean;
  exact?: boolean;
}

export function registerAddCommand(program: Command): void {
  program
    .command('add <package>')
    .description('Add a package or feature to your project')
    .option('-D, --dev', 'Add as dev dependency')
    .option('-E, --exact', 'Install exact version')
    .action(async (pkg: string, options: AddOptions) => {
      try {
        await handleAdd(pkg, options);
      } catch (error) {
        logger.error('Failed to add package:', error);
        process.exit(1);
      }
    });
}

async function handleAdd(pkg: string, options: AddOptions): Promise<void> {
  const spinner = createSpinner(`Adding ${pkg}...`);

  try {
    const args = ['install'];

    if (options.dev) {
      args.push('--save-dev');
    }

    if (options.exact) {
      args.push('--save-exact');
    }

    args.push(pkg);

    execSync(`npm ${args.join(' ')}`, {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    spinner.succeed(`Added ${pkg}`);

    logger.info('');
    logger.info(chalk.cyan('Next steps:'));
    logger.info(`  1. Import the package in your code`);
    logger.info(`  2. Use it in your worker`);

    // Check if package requires special setup
    await provideSetupInstructions(pkg);

  } catch (error) {
    spinner.fail(`Failed to add ${pkg}`);
    throw error;
  }
}

async function provideSetupInstructions(pkg: string): Promise<void> {
  const instructions: Record<string, string[]> = {
    '@claudeflare/edge': [
      'Import: import { Router } from "@claudeflare/edge";',
      'Create: const router = new Router();',
      'Use: return router.handle(request, env, ctx);',
    ],
    hono: [
      'Import: import { Hono } from "hono";',
      'Create: const app = new Hono();',
      'Export: export default app;',
    ],
    'zod': [
      'Import: import { z } from "zod";',
      'Define: const schema = z.object({ name: z.string() });',
      'Validate: const data = schema.parse(input);',
    ],
  };

  const pkgInstructions = instructions[pkg.toLowerCase()];

  if (pkgInstructions) {
    logger.info('');
    logger.info(chalk.cyan('Quick start:'));
    pkgInstructions.forEach((instruction) => {
      logger.info(`  ${chalk.gray(instruction)}`);
    });
  }
}
