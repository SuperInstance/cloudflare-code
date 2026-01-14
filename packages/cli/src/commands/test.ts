/**
 * Test command - Run tests
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { cwd } from 'process';
import { loadConfig } from '../config/index.js';
import {
  createLogger,
  createSpinner,
} from '../utils/index.js';

export interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  ui?: boolean;
  pattern?: string;
  environment?: string;
  debug?: boolean;
}

export async function testCommand(options: TestOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Running tests...',
    color: 'cyan',
  });

  try {
    // Load configuration
    const projectDir = cwd();
    const config = await loadConfig(projectDir, options.environment);

    spinner.start();

    // Build test command
    const testArgs: string[] = [];

    if (options.watch) {
      testArgs.push('--watch');
    }

    if (options.coverage) {
      testArgs.push('--coverage');
    }

    if (options.ui) {
      testArgs.push('--ui');
    }

    if (options.pattern) {
      testArgs.push('--run', options.pattern);
    } else if (!options.watch && !options.ui) {
      testArgs.push('--run');
    }

    // Run tests
    spinner.stop();

    logger.command(`npm test ${testArgs.join(' ')}`);
    logger.newline();

    const testProcess = spawn('npm', ['test', ...testArgs], {
      cwd: projectDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: options.environment ?? 'test',
      },
    });

    await new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          logger.newline();
          logger.success('Tests passed!');
          resolve(code);
        } else {
          logger.newline();
          logger.error('Tests failed');
          reject(new Error(`Test process exited with code ${code}`));
        }
      });

      testProcess.on('error', (error) => {
        spinner.fail('Failed to run tests');
        reject(error);
      });
    });

  } catch (error) {
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
 * Register test command with CLI
 */
export function registerTestCommand(program: Command): void {
  program
    .command('test')
    .description('Run tests')
    .option('-w, --watch', 'Watch mode')
    .option('-c, --coverage', 'Generate coverage report')
    .option('--ui', 'Run with UI')
    .option('-p, --pattern <pattern>', 'Test file pattern')
    .option('-e, --environment <name>', 'Environment to use', 'test')
    .option('--debug', 'Enable debug output')
    .action(testCommand);
}
