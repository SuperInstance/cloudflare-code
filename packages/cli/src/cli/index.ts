#!/usr/bin/env node
/**
 * ClaudeFlare CLI - Main entry point
 *
 * A comprehensive CLI tool for the ClaudeFlare distributed AI coding platform.
 * Provides command routing, parsing, help system, and auto-completion support.
 */

import { Command, CommanderError } from 'commander';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../config/loader.js';
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
  registerNewCommand,
  registerRunCommand,
  registerAddCommand,
  registerRemoveCommand,
  registerLoginCommand,
  registerLogoutCommand,
  registerWhoamiCommand,
  registerEnvCommand,
  registerSecretsCommand,
  registerKVCommand,
  registerR2Command,
  registerDurableCommand,
  registerAnalyticsCommand,
  registerMetricsCommand,
  registerTailCommand,
  registerRollbackCommand,
  registerStatusCommand,
  registerUpgradeCommand,
  registerDocsCommand,
  registerCompletionCommand,
} from '../commands/index.js';

const logger = createLogger('cli');

// Get package version
async function getPackageVersion(): Promise<string> {
  try {
    const packagePath = new URL('../../package.json', import.meta.url);
    const { readFile } = await import('fs/promises');
    const content = await readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(content);
    return packageJson.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

// Global options interface
export interface GlobalOptions {
  debug?: boolean;
  quiet?: boolean;
  colors?: boolean;
  config?: string;
}

// Create CLI program
export async function createProgram(): Promise<Command> {
  const version = await getPackageVersion();
  const program = new Command();

  program
    .name('claudeflare')
    .description('ClaudeFlare - Distributed AI coding platform on Cloudflare Workers')
    .version(version, '-v, --version', 'Display version number')
    .option('-d, --debug', 'Enable debug mode with verbose logging')
    .option('-q, --quiet', 'Suppress non-error messages')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('--no-colors', 'Disable colored output')
    .configureOutput({
      writeErr: (str) => logger.error(str.trim()),
      writeOut: (str) => logger.info(str.trim()),
    })
    .hook('preAction', (thisCommand) => {
      const options = thisCommand.opts() as GlobalOptions;

      // Set debug mode
      if (options.debug) {
        logger.setLogLevel('debug');
      }

      // Set quiet mode
      if (options.quiet) {
        logger.setLogLevel('error');
      }

      // Load config if specified
      if (options.config) {
        try {
          loadConfig(options.config);
        } catch (error) {
          logger.warn(`Failed to load config from ${options.config}: ${error}`);
        }
      }
    });

  // Register all commands
  registerInitCommand(program);
  registerNewCommand(program);
  registerDevCommand(program);
  registerRunCommand(program);
  registerBuildCommand(program);
  registerDeployCommand(program);
  registerTestCommand(program);
  registerLogsCommand(program);
  registerTailCommand(program);
  registerConfigCommand(program);
  registerEnvCommand(program);
  registerSecretsCommand(program);
  registerKVCommand(program);
  registerR2Command(program);
  registerDurableCommand(program);
  registerAddCommand(program);
  registerRemoveCommand(program);
  registerDoctorCommand(program);
  registerStatusCommand(program);
  registerAnalyticsCommand(program);
  registerMetricsCommand(program);
  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerWhoamiCommand(program);
  registerRollbackCommand(program);
  registerUpgradeCommand(program);
  registerDocsCommand(program);
  registerCompletionCommand(program);
  registerVersionCommand(program);

  return program;
}

// Main entry point
export async function main(argv: string[] = process.argv): Promise<void> {
  try {
    const program = await createProgram();

    // Show help if no arguments
    if (argv.length <= 2) {
      program.outputHelp();
      return;
    }

    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      // Commander handles its own errors
      process.exit(error.exitCode);
    } else {
      logger.error('Unexpected error:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
