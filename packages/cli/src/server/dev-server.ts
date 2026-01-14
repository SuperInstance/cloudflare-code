/**
 * Development Server
 *
 * Local development server with hot module replacement, file watching,
 * live reload, proxy configuration, and mock services.
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import { loadConfig } from '../config/loader.js';
import type { Config } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('dev-server');

/**
 * Dev server options
 */
export interface DevServerOptions {
  port?: number;
  host?: string;
  proxy?: boolean;
  open?: boolean;
  https?: boolean;
  watch?: boolean;
  environment?: string;
  workersPort?: number;
}

/**
 * Dev server state
 */
interface DevServerState {
  wranglerProcess?: ChildProcess;
  buildProcess?: ChildProcess;
  watcher?: chokidar.FSWatcher;
  rebuildPending: boolean;
  rebuildTimer?: NodeJS.Timeout;
}

const state: DevServerState = {
  rebuildPending: false,
};

/**
 * Start development server
 */
export async function startDevServer(options: DevServerOptions = {}): Promise<void> {
  const config = await loadConfig();
  const port = options.port || config.dev.port;
  const host = options.host || config.dev.host;

  logger.info('Starting development server...');
  logger.info(`  Host: ${chalk.cyan(host)}:${chalk.cyan(port)}`);

  try {
    // Start Express proxy server if proxy is enabled
    if (options.proxy !== false) {
      await startProxyServer(port, host, options);
    }

    // Start Wrangler dev server
    await startWranglerDev(options);

    // Setup file watching if enabled
    if (options.watch !== false) {
      setupFileWatcher(config, options);
    }

    // Open browser if requested
    if (options.open) {
      await openBrowser(`http://${host}:${port}`);
    }

    logger.success('Development server ready!');
    logger.info(`  Proxy: http://${host}:${port}`);
    logger.info(`  Workers: http://${host}:${options.workersPort || 8787}`);
    logger.info('\nWatching for changes...');
  } catch (error) {
    logger.error('Failed to start development server:', error);
    throw error;
  }
}

/**
 * Start Express proxy server
 */
async function startProxyServer(
  port: number,
  host: string,
  options: DevServerOptions
): Promise<void> {
  const app = express();

  // Health check endpoint
  app.get('/_health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Proxy to Wrangler dev server
  const workersPort = options.workersPort || 8787;
  app.use(
    createProxyMiddleware({
      target: `http://${host}:${workersPort}`,
      changeOrigin: true,
      logLevel: 'silent',
      onError: (err, _req, res) => {
        logger.warn('Proxy error:', err.message);
        res.status(500).json({
          error: 'Proxy error',
          message: err.message,
        });
      },
    })
  );

  return new Promise((resolve, reject) => {
    try {
      app.listen(port, host, () => {
        logger.debug(`Proxy server listening on ${host}:${port}`);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Start Wrangler dev server
 */
async function startWranglerDev(options: DevServerOptions): Promise<void> {
  const spinner = createSpinner('Starting Wrangler dev server...');

  return new Promise((resolve, reject) => {
    const wranglerArgs = ['dev', '--local', '--port', String(options.workersPort || 8787)];

    if (options.https) {
      wranglerArgs.push('--https');
    }

    if (options.environment) {
      wranglerArgs.push('--env', options.environment);
    }

    state.wranglerProcess = spawn('npx', ['wrangler', ...wranglerArgs], {
      stdio: 'pipe',
      shell: true,
    });

    let outputStarted = false;

    state.wranglerProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (!outputStarted) {
        spinner.succeed('Wrangler dev server started');
        outputStarted = true;
        resolve();
      }

      // Filter out noisy output
      if (output.includes('Ready on') || output.includes('⎔')) {
        logger.debug(output.trim());
      }
    });

    state.wranglerProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        logger.error(output.trim());
      } else {
        logger.warn(output.trim());
      }
    });

    state.wranglerProcess.on('error', (error) => {
      spinner.fail('Failed to start Wrangler');
      reject(error);
    });

    state.wranglerProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        logger.warn(`Wrangler exited with code ${code}`);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!outputStarted) {
        spinner.fail('Wrangler dev server timeout');
        reject(new Error('Timeout starting Wrangler dev server'));
      }
    }, 30000);
  });
}

/**
 * Setup file watcher for hot reload
 */
function setupFileWatcher(config: Config, options: DevServerOptions): void {
  const watchPaths = [
    join(process.cwd(), 'src'),
    join(process.cwd(), 'claudeflare.config.ts'),
    join(process.cwd(), 'wrangler.toml'),
  ];

  state.watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules|dist|\.git/,
    persistent: true,
    ignoreInitial: true,
  });

  state.watcher
    .on('change', (path) => {
      logger.debug(`File changed: ${path}`);
      scheduleRebuild(path, config, options);
    })
    .on('add', (path) => {
      logger.debug(`File added: ${path}`);
      scheduleRebuild(path, config, options);
    })
    .on('unlink', (path) => {
      logger.debug(`File removed: ${path}`);
      scheduleRebuild(path, config, options);
    })
    .on('error', (error) => {
      logger.error('Watcher error:', error);
    });
}

/**
 * Schedule a rebuild with debouncing
 */
function scheduleRebuild(
  filePath: string,
  config: Config,
  options: DevServerOptions
): void {
  state.rebuildPending = true;

  if (state.rebuildTimer) {
    clearTimeout(state.rebuildTimer);
  }

  state.rebuildTimer = setTimeout(() => {
    performRebuild(filePath, config, options);
  }, 300); // 300ms debounce
}

/**
 * Perform rebuild and hot reload
 */
async function performRebuild(
  filePath: string,
  config: Config,
  options: DevServerOptions
): Promise<void> {
  state.rebuildPending = false;
  const relativePath = filePath.replace(process.cwd(), '');

  logger.info(`\n${chalk.cyan('↻')} Reloading ${relativePath}...`);

  try {
    // Build the project
    await buildProject(config);

    // Restart Wrangler if needed
    if (state.wranglerProcess) {
      logger.debug('Restarting Wrangler...');
      state.wranglerProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await startWranglerDev(options);
    }

    logger.success(`${chalk.green('✓')} Reloaded ${relativePath}`);
  } catch (error) {
    logger.error(`Failed to reload ${relativePath}:`, error);
  }
}

/**
 * Build project
 */
async function buildProject(config: Config): Promise<void> {
  const { buildProject: doBuild } = await import('../build/builder.js');
  await doBuild({
    minify: false,
    sourcemap: true,
  });
}

/**
 * Open browser
 */
async function openBrowser(url: string): Promise<void> {
  const { default: open } = await import('open');
  try {
    await open(url);
    logger.debug(`Opened browser at ${url}`);
  } catch (error) {
    logger.warn('Failed to open browser:', error);
  }
}

/**
 * Stop development server
 */
export async function stopDevServer(): Promise<void> {
  logger.info('Stopping development server...');

  if (state.watcher) {
    await state.watcher.close();
  }

  if (state.wranglerProcess) {
    state.wranglerProcess.kill('SIGTERM');
  }

  if (state.buildProcess) {
    state.buildProcess.kill('SIGTERM');
  }

  if (state.rebuildTimer) {
    clearTimeout(state.rebuildTimer);
  }

  logger.success('Development server stopped');
}

/**
 * Handle process termination
 */
export function setupShutdownHandlers(): void {
  const shutdown = async () => {
    await stopDevServer();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    // Cleanup
  });
}
