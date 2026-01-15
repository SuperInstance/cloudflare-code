/**
 * Whoami command - Display current authentication information
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  createLogger,
  createSpinner,
  TableFormatter,
} from '../../utils/index.js';
import { checkWranglerAuth } from '../../utils/wrangler.js';

export interface WhoamiOptions {
  json?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

export interface UserAccountInfo {
  email?: string;
  accountId?: string;
  userId?: string;
  username?: string;
  plan?: 'free' | 'pro' | 'team' | 'enterprise';
  credits?: number;
  permissions?: string[];
  lastActive?: string;
  sessionExpires?: string;
  twoFactorEnabled?: boolean;
}

export async function whoamiCommand(options: WhoamiOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Fetching account information...',
    color: 'cyan',
  });

  try {
    spinner.start();

    const configPath = getAuthConfigPath();
    let userAccount: UserAccountInfo = {};

    // Check if authenticated
    if (!existsSync(configPath)) {
      spinner.stop();
      logger.info('Not authenticated');
      logger.info('Run `claudeflare auth login` to authenticate');
      process.exit(1);
    }

    // Load stored authentication data
    const authConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Get Cloudflare authentication status
    const cloudflareAuthenticated = await checkWranglerAuth();

    // Fetch ClaudeFlare user information
    if (authConfig.claudeflare?.accessToken) {
      spinner.start('Fetching ClaudeFlare user info...');

      try {
        const userInfoResponse = await fetch('https://api.claudeflare.workers.dev/auth/user', {
          headers: {
            'Authorization': `Bearer ${authConfig.claudeflare.accessToken}`,
          },
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          userAccount = {
            ...userAccount,
            userId: userInfo.id,
            username: userInfo.username || userInfo.email,
            email: userInfo.email,
            plan: userInfo.plan,
            credits: userInfo.credits,
            permissions: userInfo.permissions,
            lastActive: userInfo.lastActive,
            sessionExpires: userInfo.sessionExpires,
            twoFactorEnabled: userInfo.twoFactorEnabled || false,
          };
          spinner.succeed('Fetched ClaudeFlare user info');
        } else {
          logger.warn('Failed to fetch ClaudeFlare user info');
        }
      } catch (error) {
        logger.warn('Network error while fetching ClaudeFlare user info');
      }
    } else {
      logger.warn('No ClaudeFlare access token found');
    }

    // Get Cloudflare account info
    if (cloudflareAuthenticated) {
      spinner.start('Fetching Cloudflare account info...');

      try {
        const { execSync } = await import('child_process');
        const accountInfo = execSync('npx wrangler whoami', {
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        // Parse Cloudflare account information
        const emailMatch = accountInfo.match(/Email:\s*(.+)/);
        const accountIdMatch = accountInfo.match(/Account ID:\s*(.+)/);
        const zoneMatch = accountInfo.match(/Zone\s+ID:\s*(.+)/);

        if (emailMatch) {
          userAccount.email = userAccount.email || emailMatch[1].trim();
        }
        if (accountIdMatch) {
          userAccount.accountId = accountIdMatch[1].trim();
        }
        if (zoneMatch) {
          userAccount.zoneId = zoneMatch[1].trim();
        }

        spinner.succeed('Fetched Cloudflare account info');
      } catch (error) {
        logger.warn('Failed to fetch Cloudflare account info');
      }
    } else {
      logger.warn('Not authenticated with Cloudflare');
    }

    // Display information
    spinner.stop();

    if (options.json) {
      // JSON output
      console.log(JSON.stringify(userAccount, null, 2));
    } else {
      // Human-readable output
      logger.newline();

      if (userAccount.email) {
        logger.box(
          'Account Information',
          TableFormatter.account({
            email: userAccount.email,
            accountId: userAccount.accountId,
            username: userAccount.username,
            plan: userAccount.plan,
            credits: userAccount.credits,
          })
        );
      }

      if (options.verbose && userAccount.permissions?.length) {
        logger.newline();
        logger.bold('Permissions:');
        logger.newline();

        const permissions = userAccount.permissions!;
        for (const permission of permissions) {
          console.log(`  ✓ ${permission}`);
        }
      }

      if (userAccount.lastActive) {
        logger.newline();
        logger.info(`Last active: ${formatDate(userAccount.lastActive)}`);
      }

      if (userAccount.sessionExpires) {
        const expires = new Date(userAccount.sessionExpires);
        const now = new Date();
        const isExpired = expires < now;

        logger.newline();
        logger.info(`Session expires: ${formatDate(userAccount.sessionExpires)}`);
        if (isExpired) {
          logger.warn('Session has expired - please login again');
        }
      }

      if (userAccount.twoFactorEnabled) {
        logger.newline();
        logger.info('✓ Two-factor authentication enabled');
      }

      // Show authentication status
      logger.newline();
      logger.bold('Authentication Status:');
      logger.newline();

      const cloudflareStatus = cloudflareAuthenticated ? '✓ Active' : '❌ Not authenticated';
      const claudeflareStatus = userAccount.userId ? '✓ Active' : '❌ Not authenticated';

      console.log(`  Cloudflare: ${cloudflareStatus}`);
      console.log(`  ClaudeFlare: ${claudeflareStatus}`);

      // Show active projects if available
      if (userAccount.userId) {
        try {
          spinner.start('Fetching active projects...');
          const projectsResponse = await fetch(`https://api.claudeflare.workers.dev/projects`, {
            headers: {
              'Authorization': `Bearer ${authConfig.claudeflare?.accessToken}`,
            },
          });

          if (projectsResponse.ok) {
            const projects = await projectsResponse.json();
            spinner.succeed('Fetched active projects');

            if (projects.length > 0) {
              logger.newline();
              logger.bold('Active Projects:');
              logger.newline();

              for (const project of projects.slice(0, 5)) {
                console.log(`  • ${project.name} (${project.id})`);
              }

              if (projects.length > 5) {
                console.log(`  ... and ${projects.length - 5} more`);
              }
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch projects');
        }
      }

      logger.newline();
      logger.info('Use --verbose for detailed information');
      logger.info('Use --json for machine-readable output');
    }

  } catch (error) {
    spinner.fail('Failed to get account information');

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
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Register whoami command with CLI
 */
export function registerWhoamiCommand(program: Command): void {
  program
    .command('auth whoami')
    .description('Show current authentication status and user information')
    .option('-j, --json', 'Output in JSON format')
    .option('-v, --verbose', 'Show detailed information')
    .option('--debug', 'Enable debug output')
    .action(whoamiCommand);
}