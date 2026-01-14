/**
 * Logs command - Tail worker logs
 */

import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { tailWorkerLogs } from '../utils/wrangler.js';
import {
  createLogger,
  createSpinner,
} from '../utils/index.js';
import type { LogEntry } from '../types/index.js';

export interface LogsOptions {
  format?: 'json' | 'pretty';
  filter?: string;
  status?: 'success' | 'error' | 'canceled';
  tail?: boolean;
  limit?: number;
  environment?: string;
  debug?: boolean;
}

export async function logsCommand(options: LogsOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Starting log tail...',
    color: 'cyan',
  });

  try {
    // Load configuration
    spinner.start('Loading configuration...');

    const projectDir = process.cwd();
    const config = await loadConfig(projectDir, options.environment);

    spinner.succeed('Configuration loaded');

    // Start tailing
    logger.info(`Tailing logs for ${config.worker.name}...`);
    logger.info('Press Ctrl+C to stop');
    logger.newline();

    await tailWorkerLogs(config.worker.name, {
      format: options.format ?? 'pretty',
      filter: options.filter,
      status: options.status,
      onLog: (log: unknown) => {
        const entry = log as LogEntry;

        if (options.format === 'json') {
          logger.json(entry);
        } else {
          // Pretty print
          const timestamp = new Date(entry.timestamp).toLocaleTimeString();
          const level = entry.level.toUpperCase().padEnd(5);

          let message = `${timestamp} [${level}] `;

          if (entry.script) {
            message += `[${entry.script}] `;
          }

          message += entry.message;

          if (entry.level === 'error') {
            logger.error(message);
          } else if (entry.level === 'warn') {
            logger.warn(message);
          } else if (entry.level === 'debug') {
            logger.debug(message);
          } else {
            logger.info(message);
          }

          // Print request info if available
          if (entry.event?.request) {
            const req = entry.event.request;
            logger.verbose(`  ${req.method} ${req.url}`);
          }

          // Print outcome if available
          if (entry.event?.outcome) {
            const outcome = entry.event.outcome;
            const outcomeColor =
              outcome === 'ok' || outcome === 'exception'
                ? 'green'
                : outcome === 'exceededCpu' || outcome === 'exceededMemory'
                  ? 'red'
                  : 'yellow';

            logger.verbose(`  Outcome: ${outcomeColor}${outcome}`);
          }
        }
      },
    });

  } catch (error) {
    spinner.fail('Failed to tail logs');

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
 * Register logs command with CLI
 */
export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('Tail worker logs')
    .option('-f, --format <format>', 'Log format (json, pretty)', 'pretty')
    .option('--filter <filter>', 'Filter logs')
    .option('-s, --status <status>', 'Filter by status (success, error, canceled)')
    .option('-e, --environment <name>', 'Environment to use')
    .option('--debug', 'Enable debug output')
    .action(logsCommand);
}
