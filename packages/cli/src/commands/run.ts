/**
 * Run Command
 *
 * Run a worker locally with hot reload
 */

import { Command } from 'commander';
import { startDevServer, setupShutdownHandlers } from '../server/dev-server.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('run');

export interface RunOptions {
  port?: number;
  host?: string;
  watch?: boolean;
  local?: boolean;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run worker locally (alias for dev)')
    .option('-p, --port <number>', 'Port to run on')
    .option('-h, --host <string>', 'Host to bind to')
    .option('--no-watch', 'Disable file watching')
    .option('--no-local', 'Disable local mode')
    .action(async (options: RunOptions) => {
      try {
        setupShutdownHandlers();
        await startDevServer(options);
      } catch (error) {
        logger.error('Failed to start worker:', error);
        process.exit(1);
      }
    });
}
