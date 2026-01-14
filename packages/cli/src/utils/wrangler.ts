/**
 * Wrangler integration utilities
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { cwd } from 'process';

export interface WranglerOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  silent?: boolean;
}

export interface WranglerResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Execute wrangler command
 */
export async function execWrangler(options: WranglerOptions): Promise<WranglerResult> {
  const { command, args = [], cwd: projectDir = cwd(), env, silent = false } = options;

  return new Promise((resolve, reject) => {
    const wranglerArgs = [command, ...args];

    const child = spawn('npx', ['wrangler', ...wranglerArgs], {
      cwd: projectDir,
      env: { ...process.env, ...env },
      stdio: silent ? 'pipe' : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (silent) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to execute wrangler: ${error.message}`));
    });
  });
}

/**
 * Check if wrangler is installed
 */
export async function checkWranglerInstalled(): Promise<boolean> {
  try {
    const result = await execWrangler({
      command: '--version',
      silent: true,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated with Cloudflare
 */
export async function checkWranglerAuth(): Promise<boolean> {
  try {
    const result = await execWrangler({
      command: 'whoami',
      silent: true,
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get worker info
 */
export async function getWorkerInfo(workerName: string): Promise<unknown> {
  const result = await execWrangler({
    command: ' deployments list',
    args: ['--name', workerName],
    silent: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get worker info: ${result.stderr}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return result.stdout;
  }
}

/**
 * List deployments
 */
export async function listDeployments(workerName: string): Promise<unknown[]> {
  const result = await execWrangler({
    command: 'deployments list',
    args: ['--name', workerName],
    silent: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list deployments: ${result.stderr}`);
  }

  try {
    return JSON.parse(result.stdout) as unknown[];
  } catch {
    return [];
  }
}

/**
 * Tail worker logs
 */
export async function tailWorkerLogs(
  workerName: string,
  options: {
    format?: 'json' | 'pretty';
    filter?: string;
    status?: 'success' | 'error' | 'canceled';
    onLog?: (log: unknown) => void;
  } = {}
): Promise<void> {
  const args = ['tail', workerName];

  if (options.format) {
    args.push('--format', options.format);
  }

  if (options.filter) {
    args.push('--filter', options.filter);
  }

  if (options.status) {
    args.push('--status', options.status);
  }

  const child = spawn('npx', ['wrangler', ...args], {
    cwd: cwd(),
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const log = JSON.parse(line);
        if (options.onLog) {
          options.onLog(log);
        }
      } catch {
        // Not JSON, just print
        console.log(line);
      }
    }
  });

  child.stderr?.on('data', (data) => {
    console.error(data.toString());
  });

  return new Promise((resolve, reject) => {
    child.on('close', resolve);
    child.on('error', reject);
  });
}

/**
 * Delete deployment
 */
export async function deleteDeployment(deploymentId: string): Promise<void> {
  await execWrangler({
    command: 'deployments delete',
    args: [deploymentId, '--force'],
  });
}

/**
 * Rollback to previous deployment
 */
export async function rollbackDeployment(
  workerName: string,
  deploymentId: string
): Promise<void> {
  await execWrangler({
    command: 'rollback',
    args: [workerName, deploymentId],
  });
}

/**
 * Get KV namespace info
 */
export async function getKVNamespaces(): Promise<unknown[]> {
  const result = await execWrangler({
    command: 'kv:namespace list',
    silent: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list KV namespaces: ${result.stderr}`);
  }

  try {
    return JSON.parse(result.stdout) as unknown[];
  } catch {
    return [];
  }
}

/**
 * Create KV namespace
 */
export async function createKVNamespace(title: string): Promise<string> {
  const result = await execWrangler({
    command: 'kv:namespace create',
    args: [title],
    silent: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create KV namespace: ${result.stderr}`);
  }

  // Parse namespace ID from output
  const match = result.stdout.match(/id = "([^"]+)"/);
  if (!match) {
    throw new Error('Failed to parse namespace ID from wrangler output');
  }

  return match[1];
}

/**
 * Get R2 bucket info
 */
export async function getR2Buckets(): Promise<unknown[]> {
  const result = await execWrangler({
    command: 'r2 bucket list',
    silent: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list R2 buckets: ${result.stderr}`);
  }

  try {
    return JSON.parse(result.stdout) as unknown[];
  } catch {
    return [];
  }
}

/**
 * Create R2 bucket
 */
export async function createR2Bucket(name: string): Promise<void> {
  const result = await execWrangler({
    command: 'r2 bucket create',
    args: [name],
    silent: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create R2 bucket: ${result.stderr}`);
  }
}
