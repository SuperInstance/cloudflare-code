/**
 * Remove Command
 *
 * Remove dependencies or features from the project
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import inquirer from 'inquirer';

const logger = createLogger('remove');

export interface RemoveOptions {
  force?: boolean;
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove <package>')
    .description('Remove a package from your project')
    .option('-f, --force', 'Skip confirmation')
    .action(async (pkg: string, options: RemoveOptions) => {
      try {
        await handleRemove(pkg, options);
      } catch (error) {
        logger.error('Failed to remove package:', error);
        process.exit(1);
      }
    });
}

async function handleRemove(pkg: string, options: RemoveOptions): Promise<void> {
  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Remove ${pkg} and its dependencies?`,
        default: false,
      },
    ]);

    if (!confirm) {
      logger.info('Cancelled');
      return;
    }
  }

  const spinner = createSpinner(`Removing ${pkg}...`);

  try {
    execSync(`npm uninstall ${pkg}`, {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    spinner.succeed(`Removed ${pkg}`);

    logger.info('');
    logger.info(chalk.cyan('Next steps:'));
    logger.info(`  1. Remove imports of ${pkg} from your code`);
    logger.info(`  2. Test your application`);

  } catch (error) {
    spinner.fail(`Failed to remove ${pkg}`);
    throw error;
  }
}
