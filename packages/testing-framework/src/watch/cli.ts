#!/usr/bin/env node

/**
 * Watch Mode CLI
 * Command-line interface for watch mode
 */

import { Command } from 'commander';
import { FileWatcher } from './watcher';
import { TestRunner } from '../core/test-runner';
import { TestConfig } from '../core/types';
import { WatchConfig } from './types';
import { validateWatchConfig } from './utils';
import { Logger } from '../core/logger';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const program = new Command();
const logger = new Logger('WatchCLI');

program
  .name('claudeflare-test-watch')
  .description('Watch mode for testing')
  .version('1.0.0');

program
  .command('watch')
  .description('Watch files for changes and run tests')
  .argument('[patterns...]', 'File patterns to watch')
  .option('-c, --config <file>', 'Watch configuration file')
  .option('-i, --ignore <patterns...>', 'Patterns to ignore')
  .option('-t, --test-pattern <pattern>', 'Test file pattern', '**/*.test.{js,ts,jsx,tsx}')
  .option('-e, --extensions <exts...>', 'Test file extensions', ['.test.js', '.test.ts', '.spec.js', '.spec.ts'])
  .option('--parallel', 'Enable parallel test execution', false)
  .option('--workers <n>', 'Maximum number of workers', '4')
  .option('--fail-fast', 'Stop on first failure', false)
  .option('--reporter <reporter>', 'Test reporter', 'default')
  .option('--env <environment>', 'Test environment', 'node')
  .option('--clear', 'Clear screen before each run', false)
  .option('--verbose', 'Verbose logging', false)
  .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
  .option('--poll', 'Use polling instead of native events', false)
  .option('--poll-interval <ms>', 'Polling interval', '100')
  .option('--no-auto-run', 'Disable automatic test runs', false)
  .option('--output <dir>', 'Output directory for reports', './reports')
  .action(async (patterns: string[], options) => {
    try {
      // Load configuration
      const config = await loadConfiguration(options, patterns);

      // Validate configuration
      const validation = validateWatchConfig(config);
      if (!validation.valid) {
        logger.error('Configuration validation failed:');
        validation.errors.forEach(error => logger.error(`  - ${error}`));
        process.exit(1);
      }

      // Create test runner configuration
      const testConfig: TestConfig = {
        files: config.tests.pattern,
        parallel: config.tests.run.parallel,
        maxWorkers: parseInt(config.tests.run.maxWorkers.toString()),
        failFast: config.tests.run.failFast,
        reporter: config.tests.run.reporter,
        environment: config.tests.run.environment,
        env: config.tests.run.env,
        outputDir: options.output
      };

      // Initialize test runner
      const testRunner = new TestRunner(testConfig);

      // Create file watcher
      const watcher = new FileWatcher(config, testRunner);

      // Set up signal handlers
      setupSignalHandlers(watcher);

      // Start watching
      await watcher.start();

      // Log ready message
      logger.info('🚀 Watch mode started');
      logger.info(`📁 Watching ${config.watch.length} pattern(s)`);
      logger.info(`🧪 Test pattern: ${config.tests.pattern}`);
      logger.info(`🔄 Auto-run: ${config.autoRun ? 'enabled' : 'disabled'}`);
      logger.info(`⚡ Debounce: ${config.debounce.delay}ms`);
      logger.info('Press Ctrl+C to stop');

      if (options.verbose) {
        // Log detailed configuration
        logger.debug('Configuration:', JSON.stringify(config, null, 2));
      }
    } catch (error) {
      logger.error(`Failed to start watch mode: ${error}`);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize watch configuration file')
  .option('-o, --output <file>', 'Output configuration file', 'watch.config.json')
  .action((options) => {
    try {
      const defaultConfig: WatchConfig = {
        watch: ['src/**/*.{js,ts,jsx,tsx}', '**/*.{js,ts,jsx,tsx}'],
        ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**'],
        tests: {
          pattern: '**/*.test.{js,ts,jsx,tsx}',
          extensions: ['.test.js', '.test.ts', '.spec.js', '.spec.ts'],
          run: {
            parallel: true,
            maxWorkers: 4,
            failFast: false,
            reporter: 'default',
            environment: 'node',
            env: {}
          }
        },
        watchOptions: {
          usePolling: false,
          interval: 100,
          awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
          },
          followSymlinks: true,
          ignoreInitial: false
        },
        debounce: {
          delay: 300,
          maxWait: 5000,
          leading: false,
          trailing: true
        },
        clearScreen: true,
        verbose: false,
        autoRun: true
      };

      const configPath = join(process.cwd(), options.output);
      const configDir = join(configPath, '..');

      // Create directory if it doesn't exist
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      // Write configuration file
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      logger.info(`✅ Watch configuration created: ${configPath}`);
    } catch (error) {
      logger.error(`Failed to create configuration: ${error}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate watch configuration file')
  .argument('<file>', 'Configuration file path')
  .action(async (file: string) => {
    try {
      if (!existsSync(file)) {
        logger.error(`Configuration file not found: ${file}`);
        process.exit(1);
      }

      const configContent = readFileSync(file, 'utf-8');
      const config = JSON.parse(configContent) as WatchConfig;

      const validation = validateWatchConfig(config);
      if (validation.valid) {
        logger.info('✅ Configuration is valid');
      } else {
        logger.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => logger.error(`  - ${error}`));
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to validate configuration: ${error}`);
      process.exit(1);
    }
  });

/**
 * Load configuration from file or create default
 */
async function loadConfiguration(options: any, patterns: string[]): Promise<WatchConfig> {
  let config: WatchConfig;

  if (options.config) {
    if (!existsSync(options.config)) {
      throw new Error(`Configuration file not found: ${options.config}`);
    }

    const configContent = readFileSync(options.config, 'utf-8');
    config = JSON.parse(configContent);
  } else {
    // Create default config
    config = {
      watch: patterns.length > 0 ? patterns : ['src/**/*.{js,ts,jsx,tsx}'],
      ignore: options.ignore || ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**'],
      tests: {
        pattern: options.testPattern || '**/*.test.{js,ts,jsx,tsx}',
        extensions: options.extensions || ['.test.js', '.test.ts', '.spec.js', '.spec.ts'],
        run: {
          parallel: options.parallel || false,
          maxWorkers: parseInt(options.workers || '4'),
          failFast: options.failFast || false,
          reporter: options.reporter || 'default',
          environment: options.env || 'node',
          env: {}
        }
      },
      watchOptions: {
        usePolling: options.poll || false,
        interval: parseInt(options.pollInterval || '100'),
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        },
        followSymlinks: true,
        ignoreInitial: false
      },
      debounce: {
        delay: parseInt(options.debounce || '300'),
        maxWait: 5000,
        leading: false,
        trailing: true
      },
      clearScreen: options.clear || false,
      verbose: options.verbose || false,
      autoRun: options.autoRun !== false
    };
  }

  // Override with CLI options
  if (options.testPattern) config.tests.pattern = options.testPattern;
  if (options.extensions) config.tests.extensions = options.extensions;
  if (options.parallel !== undefined) config.tests.run.parallel = options.parallel;
  if (options.workers) config.tests.run.maxWorkers = parseInt(options.workers.toString());
  if (options.failFast !== undefined) config.tests.run.failFast = options.failFast;
  if (options.reporter) config.tests.run.reporter = options.reporter;
  if (options.env) config.tests.run.environment = options.env;
  if (options.clear !== undefined) config.clearScreen = options.clear;
  if (options.verbose !== undefined) config.verbose = options.verbose;
  if (options.debounce) config.debounce.delay = parseInt(options.debounce.toString());
  if (options.poll !== undefined) config.watchOptions.usePolling = options.poll;
  if (options.pollInterval) config.watchOptions.interval = parseInt(options.pollInterval.toString());
  if (options.autoRun !== undefined) config.autoRun = options.autoRun;

  return config;
}

/**
 * Set up signal handlers
 */
function setupSignalHandlers(watcher: FileWatcher): void {
  const signals = ['SIGINT', 'SIGTERM'];

  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`\nReceived ${signal}, shutting down gracefully...`);
      await watcher.stop();
      process.exit(0);
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error}`);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
    process.exit(1);
  });
}

/**
 * Parse command line arguments
 */
if (require.main === module) {
  program.parse();
}