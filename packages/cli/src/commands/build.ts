/**
 * Build command - Build for production
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { cwd } from 'process';
import { loadConfig } from '../config/index.js';
import {
  createLogger,
  createSpinner,
  TableFormatter,
} from '../utils/index.js';

export interface BuildOptions {
  minify?: boolean;
  sourcemap?: boolean;
  analyze?: boolean;
  output?: string;
  environment?: string;
  debug?: boolean;
}

export async function buildCommand(options: BuildOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Building project...',
    color: 'cyan',
  });

  try {
    // Load configuration
    spinner.start('Loading configuration...');

    const projectDir = cwd();
    const config = await loadConfig(projectDir, options.environment);

    spinner.succeed('Configuration loaded');

    // Check source file exists
    const sourcePath = resolve(projectDir, config.build.input);

    if (!existsSync(sourcePath)) {
      spinner.fail('Source file not found');
      logger.error(`Expected: ${sourcePath}`);
      process.exit(1);
    }

    // Build
    spinner.text = 'Building...';
    spinner.start();

    const buildStart = Date.now();

    try {
      // Run build command
      const buildArgs: string[] = [];

      if (options.minify !== undefined) {
        buildArgs.push(`--minify=${options.minify}`);
      }

      if (options.sourcemap !== undefined) {
        buildArgs.push(`--sourcemap=${options.sourcemap}`);
      }

      execSync('npm run build', {
        cwd: projectDir,
        stdio: options.debug ? 'inherit' : 'pipe',
      });

      const buildDuration = Date.now() - buildStart;

      spinner.succeed(`Build completed in ${buildDuration}ms`);

    } catch (error) {
      spinner.fail('Build failed');
      throw error;
    }

    // Get build output info
    const outputPath = resolve(projectDir, config.build.output);

    if (!existsSync(outputPath)) {
      spinner.warn('Build output not found');
      logger.warn(`Expected: ${outputPath}`);
      return;
    }

    const stats = statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    // Check size limits
    const sizeLimitMB = 3; // Cloudflare Workers free tier limit
    const sizeLimitBytes = sizeLimitMB * 1024 * 1024;
    const isWithinLimit = stats.size <= sizeLimitBytes;

    logger.newline();

    if (!isWithinLimit) {
      logger.warn(`Build size exceeds ${sizeLimitMB}MB limit`);
    } else {
      logger.success('Build size within limits');
    }

    // Display build summary
    const summary = TableFormatter.keyValue({
      'Output file': config.build.output,
      'Size': `${sizeKB} KB (${sizeMB} MB)`,
      'Minified': config.build.minify ? 'Yes' : 'No',
      'Sourcemap': config.build.sourcemap ? 'Yes' : 'No',
      'Status': isWithinLimit ? '✓ Pass' : '✗ Fail',
    });

    logger.box('Build Summary', summary);

    if (options.analyze) {
      logger.info('Run: npm run analyze-bundle');
    }

  } catch (error) {
    spinner.fail('Build failed');

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
 * Register build command with CLI
 */
export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build for production')
    .option('--no-minify', 'Disable minification')
    .option('--no-sourcemap', 'Disable sourcemaps')
    .option('-a, --analyze', 'Analyze bundle')
    .option('-o, --output <path>', 'Output file path')
    .option('-e, --environment <name>', 'Environment to use')
    .option('--debug', 'Enable debug output')
    .action(buildCommand);
}
