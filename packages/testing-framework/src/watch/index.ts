/**
 * Watch Mode Module
 * Provides file watching and test execution capabilities
 */

export * from './types';
export * from './watcher';
export * from './utils';
export * from './cli';

import {
  WatchConfig,
  WatchSession,
  WatchRunResult,
  WatchReport,
  WatchHook
} from './types';
import { FileWatcher } from './watcher';
import { TestRunner } from '../core/test-runner';
import { Logger } from '../core/logger';
import { validateWatchConfig } from './utils';

export class WatchMode {
  private watcher: FileWatcher;
  private logger: Logger;

  constructor(config: WatchConfig, testRunner: TestRunner) {
    this.watcher = new FileWatcher(config, testRunner);
    this.logger = new Logger('WatchMode');
  }

  /**
   * Start watching files
   */
  async start(): Promise<void> {
    await this.watcher.start();
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    await this.watcher.stop();
  }

  /**
   * Trigger manual test run
   */
  async run(): Promise<void> {
    await this.watcher.triggerRun();
  }

  /**
   * Pause watching
   */
  pause(): void {
    this.watcher.pause();
  }

  /**
   * Resume watching
   */
  resume(): void {
    this.watcher.resume();
  }

  /**
   * Get current session
   */
  getSession(): WatchSession {
    return this.watcher.getSession();
  }

  /**
   * Get report
   */
  getReport(): WatchReport {
    return this.watcher.getReport();
  }

  /**
   * Add custom hook
   */
  addHook(hook: WatchHook): void {
    this.watcher.addHook(hook);
  }

  /**
   * Remove hook
   */
  removeHook(hookName: string, type?: string): void {
    this.watcher.removeHook(hookName, type);
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: Partial<WatchConfig>): { valid: boolean; errors: string[] } {
    return validateWatchConfig(config);
  }

  /**
   * Create default configuration
   */
  static createDefaultConfig(): WatchConfig {
    return {
      watch: ['src/**/*.{js,ts,jsx,tsx}'],
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.git/**',
        '**/build/**'
      ],
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
  }

  /**
   * Load configuration from file
   */
  static async loadConfig(filePath: string): Promise<WatchConfig> {
    const fs = await import('fs');
    const path = await import('path');

    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    const configContent = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(configContent) as WatchConfig;

    // Validate configuration
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    return config;
  }
}

// Export utility functions
export const WatchUtils = {
  debounce: require('./utils').debounce,
  throttle: require('./utils').throttle,
  globToRegex: require('./utils').globToRegex,
  formatDuration: require('./utils').formatDuration,
  formatFileSize: require('./utils').formatFileSize,
  validateConfig: WatchMode.validateConfig
};

// Create default instance
export const watchMode = new WatchMode(
  WatchMode.createDefaultConfig(),
  new TestRunner({
    files: '**/*.test.{js,ts,jsx,tsx}',
    parallel: true,
    maxWorkers: 4,
    failFast: false,
    reporter: 'default',
    environment: 'node'
  })
);