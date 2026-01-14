/**
 * Dev command - Start local development server
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { cwd } from 'process';
import { loadConfig } from '../config/index.js';
import {
  createLogger,
  createSpinner,
  createProgressBar,
} from '../utils/index.js';
import {
  startDevServer,
  setupFileWatcher,
  rebuildWorker,
  openBrowser,
} from '../utils/dev-server.js';
import type { Config } from '../types/index.js';

export interface DevOptions {
  port?: number;
  host?: string;
  noProxy?: boolean;
  open?: boolean;
  https?: boolean;
  watch?: boolean;
  environment?: string;
  debug?: boolean;
}

export async function devCommand(options: DevOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Initializing development server...',
    color: 'cyan',
  });

  try {
    spinner.start();

    // Load configuration
    logger.debug('Loading configuration...');
    const projectDir = cwd();
    const config = await loadConfig(projectDir, options.environment);

    // Override config with CLI options
    const devConfig: Config = {
      ...config,
      dev: {
        ...config.dev,
        port: options.port ?? config.dev.port,
        host: options.host ?? config.dev.host,
        proxy: !options.noProxy && config.dev.proxy,
        open: options.open ?? config.dev.open,
        https: options.https ?? config.dev.https,
      },
    };

    spinner.succeed('Configuration loaded');

    // Build project
    const buildSpinner = createSpinner({ text: 'Building project...' });
    buildSpinner.start();

    try {
      await rebuildWorker({ projectDir, config: devConfig });
      buildSpinner.succeed('Project built successfully');
    } catch (error) {
      buildSpinner.fail('Build failed');
      throw error;
    }

    // Start Wrangler dev server in background
    const wranglerSpinner = createSpinner({
      text: 'Starting Cloudflare Workers dev server...'
    });
    wranglerSpinner.start();

    const workerPort = devConfig.dev.port + 1;

    // Spawn wrangler dev
    const { spawn } = await import('child_process');
    const wranglerProcess = spawn('npx', [
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(workerPort),
      '--config',
      resolve(projectDir, 'wrangler.toml'),
    ], {
      cwd: projectDir,
      stdio: 'pipe',
      detached: true,
    });

    wranglerProcess.unref();

    // Wait for wrangler to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    wranglerSpinner.succeed(`Cloudflare Workers dev server started on port ${workerPort}`);

    // Start development server
    const devSpinner = createSpinner({
      text: 'Starting development server...'
    });
    devSpinner.start();

    const context = {
      config: devConfig,
      projectDir,
    };

    const { server, url } = await startDevServer(context, {
      port: devConfig.dev.port,
      host: devConfig.dev.host,
      proxy: devConfig.dev.proxy,
      open: false,
    });

    devSpinner.succeed(`Development server started at ${url}`);

    // Setup file watcher
    let watcher: Awaited<ReturnType<typeof setupFileWatcher>> | null = null;

    if (options.watch !== false) {
      spinner.text = 'Setting up file watcher...';
      spinner.start();

      watcher = setupFileWatcher(context, {
        onFileChange: async (path) => {
          logger.info(`File changed: ${path}`);

          const reloadSpinner = createSpinner({ text: 'Rebuilding...' });
          reloadSpinner.start();

          try {
            await rebuildWorker(context);
            reloadSpinner.succeed('Rebuilt successfully');
            logger.verbose('Worker reloaded');
          } catch (error) {
            reloadSpinner.fail('Rebuild failed');
            logger.error(error instanceof Error ? error.message : String(error));
          }
        },
      });

      spinner.succeed('File watcher active');
    }

    // Open browser if requested
    if (devConfig.dev.open) {
      await openBrowser(url);
    }

    // Print ready message
    logger.newline();
    logger.box(
      'Development Server Ready',
      `${url}\n\n` +
      `  Worker: http://${devConfig.dev.host}:${workerPort}\n` +
      `  Project: ${config.name}\n` +
      `  Environment: ${options.environment ?? 'development'}`
    );

    logger.info('Press Ctrl+C to stop the server');

    // Handle shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');

      if (watcher) {
        await watcher.close();
      }

      server.close(() => {
        logger.success('Development server stopped');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    spinner.fail('Failed to start development server');
    logger.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }

    process.exit(1);
  }
}

/**
 * Register dev command with CLI
 */
export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Start local development server with hot reload')
    .option('-p, --port <number>', 'Port to run dev server on', (value) => parseInt(value, 10))
    .option('-h, --host <string>', 'Host to bind to', 'localhost')
    .option('--no-proxy', 'Disable proxy to Cloudflare Workers')
    .option('-o, --open', 'Open browser automatically')
    .option('--https', 'Use HTTPS')
    .option('--no-watch', 'Disable file watching')
    .option('-e, --environment <name>', 'Environment to use')
    .option('--debug', 'Enable debug output')
    .action(devCommand);
}
