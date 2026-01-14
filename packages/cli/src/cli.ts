#!/usr/bin/env node
/**
 * ClaudeFlare CLI - Main entry point
 */

import { Command } from 'commander';
import { createLogger } from './utils/index.js';
import {
  registerInitCommand,
  registerDevCommand,
  registerBuildCommand,
  registerDeployCommand,
  registerTestCommand,
  registerLogsCommand,
  registerConfigCommand,
  registerDoctorCommand,
  registerVersionCommand,
} from './commands/index.js';

// Get package version
let version = '0.1.0';

try {
  const packagePath = new URL('../../package.json', import.meta.url);
  const packageJson = JSON.parse(await readFile(packagePath));
  version = packageJson.version;
} catch {
  // Use default version
}

async function readFile(path: URL): Promise<string> {
  const { readFile } = await import('fs/promises');
  return readFile(path, 'utf-8');
}

// Create CLI program
const program = new Command();

program
  .name('claudeflare')
  .description('CLI for ClaudeFlare - Distributed AI coding platform on Cloudflare Workers')
  .version(version, '-v, --version', 'Display version number')
  .option('-d, --debug', 'Enable debug mode')
  .option('-q, --quiet', 'Suppress non-error messages')
  .option('--no-colors', 'Disable colored output');

// Register commands
registerInitCommand(program);
registerDevCommand(program);
registerBuildCommand(program);
registerDeployCommand(program);
registerTestCommand(program);
registerLogsCommand(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerVersionCommand(program);

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
