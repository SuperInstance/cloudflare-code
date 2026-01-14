/**
 * Tail Command
 *
 * Tail worker logs in real-time
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tail');

export interface TailOptions {
  format?: 'json' | 'pretty';
  filter?: string;
  status?: 'success' | 'error' | 'canceled';
  debug?: boolean;
}

export function registerTailCommand(program: Command): void {
  program
    .command('tail')
    .description('Tail worker logs in real-time')
    .option('-f, --format <format>', 'Log format (json, pretty)', 'pretty')
    .option('--filter <filter>', 'Filter logs by expression')
    .option('-s, --status <status>', 'Filter by status (success, error, canceled)')
    .option('--debug', 'Enable debug output')
    .action(async (options: TailOptions) => {
      try {
        await handleTail(options);
      } catch (error) {
        logger.error('Failed to tail logs:', error);
        process.exit(1);
      }
    });
}

async function handleTail(options: TailOptions): Promise<void> {
  logger.info('Tailing worker logs...');
  logger.info('Press Ctrl+C to stop\n');

  const args = ['tail'];

  if (options.format === 'json') {
    args.push('--format', 'json');
  }

  if (options.filter) {
    args.push('--filter', options.filter);
  }

  if (options.status) {
    args.push('--status', options.status);
  }

  const wrangler = spawn('npx', ['wrangler', ...args], {
    stdio: 'inherit',
    shell: true,
  });

  wrangler.on('error', (error) => {
    logger.error('Failed to start tail:', error);
    process.exit(1);
  });

  wrangler.on('exit', (code) => {
    if (code !== 0) {
      logger.warn(`Wrangler tail exited with code ${code}`);
    }
  });
}
