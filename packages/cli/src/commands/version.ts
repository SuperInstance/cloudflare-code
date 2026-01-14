/**
 * Version command - Show version info
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface VersionOptions {
  verbose?: boolean;
}

export async function versionCommand(options: VersionOptions = {}): Promise<void> {
  const logger = createLogger({ colors: true });

  // Read package.json
  const packageJsonPath = resolve(__dirname, '../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const version = packageJson.version;

  if (options.verbose) {
    logger.newline();
    logger.box(
      'ClaudeFlare CLI',
      `Version: ${version}\n\n` +
      `Node.js: ${process.version}\n` +
      `Platform: ${process.platform} ${process.arch}\n` +
      `npm: v${await getNpmVersion()}`
    );
    logger.newline();
  } else {
    logger.info(`claudeflare v${version}`);
  }
}

async function getNpmVersion(): Promise<string> {
  try {
    const { execSync } = await import('child_process');
    return execSync('npm --version', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Register version command with CLI
 */
export function registerVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Show version information')
    .option('-v, --verbose', 'Verbose output')
    .action(versionCommand);
}
