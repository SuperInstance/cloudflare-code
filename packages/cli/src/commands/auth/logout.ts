/**
 * Logout command - Revoke authentication and clean up credentials
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { loadConfig } from '../../config/index.js';
import {
  createLogger,
  createSpinner,
  AuthenticationError,
} from '../../utils/index.js';

export interface LogoutOptions {
  revokeTokens?: boolean;
  all?: boolean;
  debug?: boolean;
}

export async function logoutCommand(options: LogoutOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Starting logout...',
    color: 'cyan',
  });

  try {
    spinner.start();

    const configPath = getAuthConfigPath();

    // Check if authenticated
    if (!existsSync(configPath)) {
      logger.info('Not authenticated');
      return;
    }

    const authConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    const hasAuthData = authConfig.cloudflare || authConfig.claudeflare;

    if (!hasAuthData) {
      logger.info('No authentication data found');
      return;
    }

    // Display current user info
    if (authConfig.cloudflare?.email) {
      logger.info(`Currently logged in as: ${authConfig.cloudflare.email}`);
    }
    if (authConfig.claudeflare?.userId) {
      logger.info(`ClaudeFlare user ID: ${authConfig.claudeflare.userId}`);
    }

    spinner.start('Preparing logout...');

    // Prompt for confirmation
    const shouldLogout = await promptForConfirmation(logger, authConfig, options);

    if (!shouldLogout) {
      spinner.fail('Logout cancelled');
      return;
    }

    // Step 1: Revoke ClaudeFlare tokens (if requested)
    if (options.revokeTokens && authConfig.claudeflare?.accessToken) {
      spinner.start('Revoking ClaudeFlare tokens...');

      try {
        const revokeResponse = await fetch('https://api.claudeflare.workers.dev/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authConfig.claudeflare.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            revokeTokens: true,
            allSessions: options.all || false,
          }),
        });

        if (revokeResponse.ok) {
          spinner.succeed('Tokens revoked successfully');
        } else {
          logger.warn('Failed to revoke tokens (manual cleanup required)');
        }
      } catch (error) {
        logger.warn('Network error while revoking tokens');
      }
    }

    // Step 2: Revoke Cloudflare API tokens
    if (authConfig.cloudflare?.apiToken) {
      spinner.start('Revoking Cloudflare API tokens...');

      try {
        const { execSync } = await import('child_process');
        execSync(`npx wrangler tokens revoke ${authConfig.cloudflare.apiToken}`, {
          stdio: 'pipe',
        });
        spinner.succeed('Cloudflare token revoked');
      } catch (error) {
        logger.warn('Failed to revoke Cloudflare token (manual cleanup required)');
      }
    }

    // Step 3: Clear authentication files
    spinner.start('Cleaning up authentication files...');

    try {
      // Clear auth config
      if (existsSync(configPath)) {
        rmSync(configPath);
      }

      // Clear any session files
      const sessionDir = getSessionDir();
      if (existsSync(sessionDir)) {
        rmSync(sessionDir, { recursive: true, force: true });
      }

      // Clear wrangler auth
      try {
        const { execSync } = await import('child_process');
        execSync('npx wrangler logout', {
          stdio: 'pipe',
        });
      } catch {
        // Ignore wrangler logout errors
      }

      spinner.succeed('Authentication files cleared');

      // Display success message
      logger.newline();
      logger.box(
        'Logged Out Successfully',
        'All authentication data has been removed from your system.'
      );

      // Provide cleanup instructions if needed
      if (options.revokeTokens && !revokeWasSuccessful(authConfig)) {
        logger.newline();
        logger.warn('Manual cleanup may be required:');
        logger.info('1. Visit Cloudflare Dashboard to manually revoke any remaining API tokens');
        logger.info('2. Clear browser cookies for claudeflare.workers.dev');
      }

    } catch (error) {
      spinner.fail('Failed to cleanup authentication files');

      if (error instanceof Error) {
        logger.error(error.message);
      }

      process.exit(1);
    }

    logger.newline();
    logger.info('You have been successfully logged out');
    logger.info('Run `claudeflare auth login` to authenticate again');

  } catch (error) {
    spinner.fail('Logout failed');

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
 * Get authentication configuration path
 */
function getAuthConfigPath(): string {
  const configDir = join(homedir(), '.claudeflare');
  return join(configDir, 'auth.json');
}

/**
 * Get session directory path
 */
function getSessionDir(): string {
  const configDir = join(homedir(), '.claudeflare');
  return join(configDir, 'sessions');
}

/**
 * Prompt for logout confirmation
 */
async function promptForConfirmation(logger: any, authConfig: any, options: LogoutOptions): Promise<boolean> {
  if (options.all) {
    return true;
  }

  const { createSpinner, Prompts } = await import('../../utils/index.js');
  const prompts = new Prompts(logger);

  logger.newline();
  logger.warn('This action will:');
  logger.info('• Remove all authentication data from your system');

  if (options.revokeTokens) {
    if (authConfig.claudeflare?.accessToken) {
      logger.info('• Revoke ClaudeFlare access tokens');
    }
    if (authConfig.cloudflare?.apiToken) {
      logger.info('• Revoke Cloudflare API tokens');
    }
  } else {
    logger.info('• Note: Tokens will not be automatically revoked');
    logger.info('  (Run with --revoke-tokens to fully clean up)');
  }

  logger.newline();
  logger.warn('This action cannot be undone');

  const confirmed = await prompts.confirmOrCancel(
    'Are you sure you want to logout?'
  );

  return confirmed;
}

/**
 * Check if token revocation was successful
 */
function revokeWasSuccessful(authConfig: any): boolean {
  // This is a simplified check - in a real implementation,
  // we would track revocation status
  return false;
}

/**
 * Register logout command with CLI
 */
export function registerLogoutCommand(program: Command): void {
  program
    .command('auth logout')
    .description('Logout and revoke authentication')
    .option('-r, --revoke-tokens', 'Revoke all API tokens')
    .option('-a, --all', 'Logout from all sessions and devices')
    .option('--debug', 'Enable debug output')
    .action(logoutCommand);
}