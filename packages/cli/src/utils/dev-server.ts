/**
 * Development server with hot reload
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import chokidar from 'chokidar';
import { resolve } from 'path';
import { cwd } from 'process';
import type { Config } from '../types/index.js';

export interface DevServerOptions {
  port?: number;
  host?: string;
  proxy?: boolean;
  open?: boolean;
  https?: boolean;
  onReload?: () => Promise<void> | void;
}

export interface DevServerContext {
  config: Config;
  projectDir: string;
  expressApp?: express.Application;
}

/**
 * Create development server
 */
export async function createDevServer(
  context: DevServerContext,
  options: DevServerOptions = {}
): Promise<express.Application> {
  const { config, projectDir } = context;
  const port = options.port ?? config.dev.port;
  const host = options.host ?? config.dev.host;

  // Create Express app
  const app = express();

  // Parse JSON
  app.use(express.json());

  // Health check endpoint
  app.get('/_health', (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
  });

  // Hot reload endpoint
  app.post('/_reload', async (req, res) => {
    try {
      if (options.onReload) {
        await options.onReload();
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Note: Vite integration is optional and can be added if needed
  // For now, we'll use Express with proxy only

  // Proxy to Cloudflare Workers local server
  const workerPort = port + 1;
  const workerTarget = `http://${host}:${workerPort}`;

  app.use('/', createProxyMiddleware({
    target: workerTarget,
    changeOrigin: true,
    ws: true,
    logLevel: 'silent',
    onError: (err, req, res) => {
      console.error('Proxy error:', err.message);
    },
  }));

  context.expressApp = app;
  return app;
}

/**
 * Start development server
 */
export async function startDevServer(
  context: DevServerContext,
  options: DevServerOptions = {}
): Promise<{ server: ReturnType<express.Application['listen']>; url: string }> {
  const { config } = context;
  const port = options.port ?? config.dev.port;
  const host = options.host ?? config.dev.host;

  const app = await createDevServer(context, options);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      resolve({ server, url });
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Try a different port with --port`));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Setup file watcher for hot reload
 */
export function setupFileWatcher(
  context: DevServerContext,
  options: {
    onFileChange?: (path: string) => Promise<void> | void;
    ignore?: string[];
  } = {}
): chokidar.FSWatcher {
  const { projectDir, config } = context;

  const watchPaths = [
    resolve(projectDir, 'src'),
    resolve(projectDir, 'claudeflare.config.ts'),
    resolve(projectDir, '.env'),
  ];

  const ignored = [
    /node_modules/,
    /dist/,
    /\.git/,
    ...(options.ignore ?? []),
  ];

  const watcher = chokidar.watch(watchPaths, {
    ignored,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', async (path) => {
    console.log(`\n${path} changed, reloading...`);

    if (options.onFileChange) {
      await options.onFileChange(path);
    }
  });

  watcher.on('add', (path) => {
    console.log(`\nNew file detected: ${path}`);
  });

  watcher.on('unlink', (path) => {
    console.log(`\nFile removed: ${path}`);
  });

  return watcher;
}

/**
 * Build and restart worker
 */
export async function rebuildWorker(
  context: DevServerContext
): Promise<void> {
  const { projectDir } = context;

  // Import and run build
  const { execSync } = await import('child_process');

  try {
    execSync('npm run build', {
      cwd: projectDir,
      stdio: 'inherit',
    });
  } catch (error) {
    throw new Error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Open browser
 */
export async function openBrowser(url: string): Promise<void> {
  const { execSync } = await import('child_process');

  try {
    const platform = process.platform;

    if (platform === 'darwin') {
      execSync(`open ${url}`);
    } else if (platform === 'win32') {
      execSync(`start ${url}`);
    } else {
      execSync(`xdg-open ${url}`);
    }
  } catch (error) {
    // Ignore errors
  }
}
