/**
 * Login command - Authenticate with ClaudeFlare and Cloudflare
 */

import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { loadConfig } from '../../config/index.js';
import {
  createLogger,
  createSpinner,
  Prompts,
  AuthenticationError,
} from '../../utils/index.js';
import { checkWranglerInstalled, execWrangler } from '../../utils/wrangler.js';

export interface LoginOptions {
  email?: string;
  apiToken?: string;
  interactive?: boolean;
  debug?: boolean;
}

export interface AuthConfig {
  cloudflare: {
    email?: string;
    apiToken?: string;
    accountId?: string;
  };
  claudeflare: {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
}

export async function loginCommand(options: LoginOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const prompts = new Prompts(logger);
  const spinner = createSpinner({
    text: 'Starting authentication...',
    color: 'cyan',
  });

  try {
    // Check if already authenticated
    const configPath = getAuthConfigPath();
    const existingAuth = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : null;

    if (existingAuth && !options.interactive) {
      logger.info('Already authenticated. Use --interactive to re-authenticate.');
      return;
    }

    spinner.start();

    // Check wrangler installation
    const hasWrangler = await checkWranglerInstalled();
    if (!hasWrangler) {
      spinner.fail('Wrangler not found');
      throw new AuthenticationError('Wrangler CLI is required for authentication');
    }

    // Step 1: Cloudflare Authentication
    logger.info('Step 1: Cloudflare Authentication');
    spinner.start('Authenticating with Cloudflare...');

    let cloudflareAuth: AuthConfig['cloudflare'] = {};

    if (options.apiToken) {
      // Use provided API token
      cloudflareAuth.apiToken = options.apiToken;

      // Verify the token
      try {
        const { execSync } = await import('child_process');
        const accountInfo = execSync(`npx wrangler whoami --api-token ${options.apiToken}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        const accountIdMatch = accountInfo.match(/Account ID:\s*(.+)/);
        if (accountIdMatch) {
          cloudflareAuth.accountId = accountIdMatch[1].trim();
        }
      } catch (error) {
        spinner.fail('Invalid API token');
        throw new AuthenticationError('Invalid Cloudflare API token');
      }
    } else if (options.email) {
      // Interactive login with email
      cloudflareAuth.email = options.email;

      const shouldLogin = await prompts.confirm(
        `Open browser for Cloudflare login with ${options.email}?`
      );

      if (shouldLogin) {
        const loginSpinner = createSpinner({ text: 'Opening browser...' });
        loginSpinner.start();

        // Run wrangler login
        const result = await execWrangler({
          command: 'login',
          silent: false,
        });

        loginSpinner.succeed('Browser login initiated');

        // Extract API token from wrangler output or prompt
        const tokenPrompt = await prompts.password(
          'Enter your Cloudflare API token (or leave blank to generate one)'
        );

        if (tokenPrompt) {
          cloudflareAuth.apiToken = tokenPrompt;
        } else {
          // Generate API token via wrangler
          const tokenResult = execSync('npx wrangler tokens create', {
            encoding: 'utf-8',
            stdio: 'pipe',
          });

          const tokenMatch = tokenResult.match(/API Token:\s*(.+)/);
          if (tokenMatch) {
            cloudflareAuth.apiToken = tokenMatch[1].trim();
          }
        }
      }
    } else {
      // Standard interactive login
      logger.info('Opening browser for Cloudflare login...');

      const shouldLogin = await prompts.confirm(
        'Open browser for Cloudflare login?'
      );

      if (!shouldLogin) {
        spinner.fail('Authentication cancelled');
        return;
      }

      const loginSpinner = createSpinner({ text: 'Opening browser...' });
      loginSpinner.start();

      await execWrangler({
        command: 'login',
        silent: false,
      });

      loginSpinner.succeed('Browser login completed');

      // Get account information
      spinner.start('Getting account information...');
      const accountInfo = execSync('npx wrangler whoami', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const emailMatch = accountInfo.match(/Email:\s*(.+)/);
      const accountIdMatch = accountInfo.match(/Account ID:\s*(.+)/);

      if (emailMatch) {
        cloudflareAuth.email = emailMatch[1].trim();
      }
      if (accountIdMatch) {
        cloudflareAuth.accountId = accountIdMatch[1].trim();
      }

      spinner.succeed('Account information retrieved');
    }

    // Step 2: ClaudeFlare Authentication
    logger.info('Step 2: ClaudeFlare Authentication');
    spinner.start('Authenticating with ClaudeFlare...');

    // Create ClaudeFlare API request
    const authResponse = await fetch('https://api.claudeflare.workers.dev/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cloudflareAuth.apiToken}`,
      },
      body: JSON.stringify({
        email: cloudflareAuth.email,
        accountId: cloudflareAuth.accountId,
        userAgent: `claudeflare-cli/${getPackageVersion()}`,
      }),
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json().catch(() => ({}));
      spinner.fail('ClaudeFlare authentication failed');
      throw new AuthenticationError(errorData.message || 'Failed to authenticate with ClaudeFlare');
    }

    const claudeflareAuth: AuthConfig['claudeflare'] = await authResponse.json();

    // Combine auth data
    const authConfig: AuthConfig = {
      cloudflare: cloudflareAuth,
      claudeflare: claudeflareAuth,
    };

    // Save auth configuration
    spinner.start('Saving authentication data...');
    saveAuthConfig(authConfig);
    spinner.succeed('Authentication data saved');

    // Step 3: Validate authentication
    logger.info('Step 3: Validating authentication');
    spinner.start('Validating authentication...');

    const validationResponse = await fetch('https://api.claudeflare.workers.dev/auth/validate', {
      headers: {
        'Authorization': `Bearer ${claudeflareAuth.accessToken}`,
      },
    });

    if (validationResponse.ok) {
      spinner.succeed('Authentication validated successfully');

      // Display success message
      logger.newline();
      logger.box(
        'Authentication Successful',
        `✓ Email: ${cloudflareAuth.email}\n✓ Account ID: ${cloudflareAuth.accountId}\n✓ ClaudeFlare User: ${claudeflareAuth.userId}\n✓ Access Token: ${claudeflareAuth.accessToken.substring(0, 20)}...`
      );

      logger.newline();
      logger.info('You can now use all ClaudeFlare CLI commands');
    } else {
      spinner.fail('Authentication validation failed');
      throw new AuthenticationError('Failed to validate authentication');
    }

  } catch (error) {
    spinner.fail('Authentication failed');

    if (error instanceof Error) {
      logger.error(error.message);

      if (options.debug && error.stack) {
        logger.debug(error.stack);
      }
    }

    // Clean up partial auth data on failure
    const configPath = getAuthConfigPath();
    if (existsSync(configPath)) {
      try {
        const existingAuth = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (existingAuth && existingAuth.claudeflare?.accessToken) {
          // Only clean up if we have partial auth data
          writeFileSync(configPath, JSON.stringify({
            ...existingAuth,
            claudeflare: {
              ...existingAuth.claudeflare,
              accessToken: undefined,
              refreshToken: undefined,
              expiresAt: undefined,
            }
          }, null, 2));
        }
      } catch {
        // Ignore cleanup errors
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
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  return join(configDir, 'auth.json');
}

/**
 * Save authentication configuration
 */
function saveAuthConfig(config: AuthConfig): void {
  const configPath = getAuthConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Get package version
 */
function getPackageVersion(): string {
  try {
    const packagePath = new URL('../../../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '1.0.0';
  }
}

/**
 * Register login command with CLI
 */
export function registerLoginCommand(program: Command): void {
  program
    .command('auth login')
    .description('Authenticate with ClaudeFlare and Cloudflare')
    .option('-e, --email <email>', 'Cloudflare account email')
    .option('-t, --api-token <token>', 'Cloudflare API token')
    .option('-i, --interactive', 'Force interactive login')
    .option('--debug', 'Enable debug output')
    .action(loginCommand);
}