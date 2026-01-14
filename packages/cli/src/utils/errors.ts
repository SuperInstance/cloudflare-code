/**
 * Error handling utilities
 */

import chalk from 'chalk';
import { Logger } from './logger.js';

export class ClaudeFlareError extends Error {
  constructor(
    message: string,
    public code?: string,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = 'ClaudeFlareError';
  }
}

export class ConfigError extends ClaudeFlareError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'CONFIG_ERROR', suggestions);
    this.name = 'ConfigError';
  }
}

export class BuildError extends ClaudeFlareError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'BUILD_ERROR', suggestions);
    this.name = 'BuildError';
  }
}

export class DeployError extends ClaudeFlareError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'DEPLOY_ERROR', suggestions);
    this.name = 'DeployError';
  }
}

export class ValidationError extends ClaudeFlareError {
  constructor(message: string, public field?: string, suggestions?: string[]) {
    super(message, 'VALIDATION_ERROR', suggestions);
    this.name = 'ValidationError';
  }
}

export class DependencyError extends ClaudeFlareError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'DEPENDENCY_ERROR', [
      'Run: npm install',
      'Run: npm install -g wrangler',
      ...(suggestions ?? []),
    ]);
    this.name = 'DependencyError';
  }
}

export class NetworkError extends ClaudeFlareError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'NETWORK_ERROR', [
      'Check your internet connection',
      'Check if Cloudflare services are operational',
      ...(suggestions ?? []),
    ]);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ClaudeFlareError {
  constructor(message: string, suggestions?: string[]) {
    super(message, 'AUTH_ERROR', [
      'Run: wrangler login',
      'Check your API token in .env',
      ...(suggestions ?? []),
    ]);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error handler
 */
export class ErrorHandler {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger();
  }

  handle(error: unknown): void {
    if (error instanceof ClaudeFlareError) {
      this.handleClaudeFlareError(error);
    } else if (error instanceof Error) {
      this.handleError(error);
    } else {
      this.handleUnknown(error);
    }
  }

  private handleClaudeFlareError(error: ClaudeFlareError): void {
    this.logger.error(error.message);

    if (error.code) {
      console.log(chalk.dim(`  Error code: ${error.code}`));
    }

    if (error.suggestions && error.suggestions.length > 0) {
      console.log();
      console.log(chalk.bold('Suggestions:'));
      error.suggestions.forEach((suggestion, index) => {
        console.log(chalk.dim(`  ${index + 1}.`) + ` ${chalk.white(suggestion)}`);
      });
    }

    console.log();

    if (this.logger['debug']) {
      console.log(chalk.dim('─'.repeat(50)));
      console.log(chalk.gray(error.stack));
      console.log(chalk.dim('─'.repeat(50)));
    }
  }

  private handleError(error: Error): void {
    this.logger.error(error.message);

    if (this.logger['debug']) {
      console.log();
      console.log(chalk.dim('─'.repeat(50)));
      console.log(chalk.gray(error.stack));
      console.log(chalk.dim('─'.repeat(50)));
    }
  }

  private handleUnknown(error: unknown): void {
    this.logger.error(`Unknown error: ${String(error)}`);
  }

  /**
   * Handle error and exit
   */
  handleAndExit(error: unknown, exitCode: number = 1): never {
    this.handle(error);
    process.exit(exitCode);
  }
}

/**
 * Create error handler instance
 */
export function createErrorHandler(logger?: Logger): ErrorHandler {
  return new ErrorHandler(logger);
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<void>>(
  fn: T,
  logger?: Logger
): T {
  return (async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (error) {
      const handler = new ErrorHandler(logger);
      handler.handle(error);
      process.exit(1);
    }
  }) as T;
}
