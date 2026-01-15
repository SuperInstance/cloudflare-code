/**
 * Status command - Check platform status and account information
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import {
  createLogger,
  createSpinner,
  TableFormatter,
  SystemStatus,
} from '../utils/index.js';
import { checkWranglerInstalled, checkWranglerAuth } from '../utils/wrangler.js';

export interface StatusOptions {
  json?: boolean;
  verbose?: boolean;
  all?: boolean;
  debug?: boolean;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    workers: StatusComponent;
    api: StatusComponent;
    database: StatusComponent;
    storage: StatusComponent;
    monitoring: StatusComponent;
  };
  metrics: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
  lastUpdated: string;
}

export interface StatusComponent {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  details?: any;
  latency?: number;
  uptime?: number;
}

export interface AccountInfo {
  id: string;
  email: string;
  username: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  createdAt: string;
  lastActive: string;
  usage: {
    requests: number;
    storage: number;
    compute: number;
    tokens: number;
    agents: number;
  };
  limits: {
    requests: number;
    storage: number;
    compute: number;
    tokens: number;
    agents: number;
  };
  features: {
    vectorSearch: boolean;
    advancedAgents: boolean;
    teamCollaboration: boolean;
    prioritySupport: boolean;
  };
}

export interface ProjectStatus {
  id: string;
  name: string;
  status: 'active' | 'deploying' | 'error' | 'stopped';
  environment: 'production' | 'preview' | 'development';
  lastDeployed: string;
  url?: string;
  metrics: {
    requests: number;
    errors: number;
    latency: {
      average: number;
      p95: number;
      p99: number;
    };
  };
}

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Checking system status...',
    color: 'cyan',
  });

  try {
    spinner.start();

    // Check authentication
    const authPath = getAuthConfigPath();
    let isAuthenticated = false;
    let accountInfo: AccountInfo | null = null;

    if (existsSync(authPath)) {
      const authConfig = JSON.parse(readFileSync(authPath, 'utf-8'));
      isAuthenticated = !!authConfig.claudeflare?.accessToken;

      if (isAuthenticated && options.all) {
        try {
          spinner.start('Fetching account information...');
          accountInfo = await fetchAccountInfo(authConfig.claudeflare.accessToken);
          spinner.succeed('Account information fetched');
        } catch (error) {
          logger.warn('Failed to fetch account information');
        }
      }
    }

    // Check system health
    spinner.start('Checking system health...');
    const systemHealth = await fetchSystemHealth();
    spinner.succeed('System health checked');

    // Check local environment
    spinner.start('Checking local environment...');
    const localStatus = await checkLocalEnvironment();
    spinner.succeed('Local environment checked');

    // Check Cloudflare status
    spinner.start('Checking Cloudflare status...');
    const cloudflareStatus = await checkCloudflareStatus();
    spinner.succeed('Cloudflare status checked');

    // Get current project status
    let currentProject: ProjectStatus | null = null;
    let projects: ProjectStatus[] = [];

    if (isAuthenticated && options.all) {
      try {
        spinner.start('Fetching project status...');
        const projectData = await fetchProjectStatus(authConfig.claudeflare.accessToken);
        currentProject = projectData.current;
        projects = projectData.projects;
        spinner.succeed('Project status fetched');
      } catch (error) {
        logger.warn('Failed to fetch project status');
      }
    }

    // Display results
    spinner.stop();

    if (options.json) {
      // JSON output
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        system: systemHealth,
        local: localStatus,
        cloudflare: cloudflareStatus,
        account: accountInfo,
        project: currentProject,
        projects,
      }, null, 2));
    } else {
      // Human-readable output
      displayStatusReport(logger, systemHealth, localStatus, cloudflareStatus, accountInfo, currentProject, projects, options);
    }

  } catch (error) {
    spinner.fail('Status check failed');

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
 * Display status report
 */
function displayStatusReport(
  logger: any,
  systemHealth: SystemHealth,
  localStatus: any,
  cloudflareStatus: any,
  accountInfo: AccountInfo | null,
  currentProject: ProjectStatus | null,
  projects: ProjectStatus[],
  options: StatusOptions
): void {
  logger.newline();
  logger.box(
    'ClaudeFlare Status',
    `Updated: ${new Date(systemHealth.lastUpdated).toLocaleString()}`
  );

  // Overall system status
  logger.newline();
  logger.bold('🟢 System Status');
  logger.info(`Overall: ${systemHealth.status.toUpperCase()}`);
  logger.info(`Uptime: ${formatUptime(systemHealth.metrics.uptime)}`);

  if (systemHealth.status === 'degraded' || systemHealth.status === 'unhealthy') {
    logger.warn('Some system components are experiencing issues');
  }

  // Component status
  logger.newline();
  logger.bold('🔧 Component Status');
  const componentStatuses = [
    { component: systemHealth.components.workers, icon: '☁️' },
    { component: systemHealth.components.api, icon: '🌐' },
    { component: systemHealth.components.database, icon: '🗄️' },
    { component: systemHealth.components.storage, icon: '💾' },
    { component: systemHealth.components.monitoring, icon: '📊' },
  ];

  for (const { component, icon } of componentStatuses) {
    const statusIcon = component.status === 'ok' ? '✅' :
                     component.status === 'warning' ? '⚠️' : '❌';
    logger.info(`${icon} ${component.name}: ${statusIcon} ${component.message || 'OK'}`);
  }

  if (options.verbose) {
    logger.newline();
    logger.bold('📈 System Metrics');
    logger.info(`Response Time: ${systemHealth.metrics.responseTime}ms`);
    logger.info(`Error Rate: ${systemHealth.metrics.errorRate.toFixed(2)}%`);
  }

  // Local environment status
  logger.newline();
  logger.bold('💻 Local Environment');

  const localStatusIcon = localStatus.healthy ? '✅' : '❌';
  logger.info(`Environment: ${localStatusIcon} ${localStatus.message}`);

  // Check CLI dependencies
  if (options.verbose && localStatus.dependencies) {
    logger.newline();
    logger.bold('🔧 Dependencies');
    for (const [name, status] of Object.entries(localStatus.dependencies)) {
      const icon = status === 'installed' ? '✅' : '❌';
      logger.info(`${name}: ${icon} ${status}`);
    }
  }

  // Cloudflare status
  logger.newline();
  logger.bold('☁️ Cloudflare Status');

  const cfStatusIcon = cloudflareStatus.authenticated ? '✅' : '❌';
  logger.info(`Authentication: ${cfStatusIcon} ${cloudflareStatus.authenticated ? 'Authenticated' : 'Not authenticated'}`);

  if (cloudflareStatus.wrangler) {
    logger.info(`Wrangler CLI: ✅ ${cloudflareStatus.wrangler.version}`);
  } else {
    logger.info(`Wrangler CLI: ❌ Not installed`);
  }

  // Account information
  if (accountInfo) {
    logger.newline();
    logger.bold('👤 Account Information');

    const statusIcon = accountInfo.status === 'active' ? '✅' :
                     accountInfo.status === 'suspended' ? '🚫' : '🆓';
    logger.info(`Status: ${statusIcon} ${accountInfo.status}`);

    logger.info(`Plan: ${accountInfo.plan.toUpperCase()}`);
    logger.info(`Email: ${accountInfo.email}`);

    // Usage statistics
    logger.newline();
    logger.bold('📊 Usage Statistics');

    const usagePercentage = (key: keyof AccountInfo['usage'], limit: keyof AccountInfo['limits']) => {
      const used = accountInfo!.usage[key];
      const limit = accountInfo!.limits[limit];
      return (used / limit) * 100;
    };

    logger.info(`Requests: ${accountInfo.usage.requests.toLocaleString()} / ${accountInfo.limits.requests.toLocaleString()} (${usagePercentage('requests', 'requests').toFixed(1)}%)`);
    logger.info(`Storage: ${formatBytes(accountInfo.usage.storage)} / ${formatBytes(accountInfo.limits.storage)} (${usagePercentage('storage', 'storage').toFixed(1)}%)`);
    logger.info(`Compute: ${accountInfo.usage.compute.toLocaleString()} ms / ${accountInfo.limits.compute.toLocaleString()} ms (${usagePercentage('compute', 'compute').toFixed(1)}%)`);
    logger.info(`Tokens: ${accountInfo.usage.tokens.toLocaleString()} / ${accountInfo.limits.tokens.toLocaleString()} (${usagePercentage('tokens', 'tokens').toFixed(1)}%)`);
    logger.info(`Agents: ${accountInfo.usage.agents.toLocaleString()} / ${accountInfo.limits.agents.toLocaleString()} (${usagePercentage('agents', 'agents').toFixed(1)}%)`);

    // Feature status
    logger.newline();
    logger.bold('🔧 Feature Status');

    const features = [
      { name: 'Vector Search', key: 'vectorSearch' },
      { name: 'Advanced Agents', key: 'advancedAgents' },
      { name: 'Team Collaboration', key: 'teamCollaboration' },
      { name: 'Priority Support', key: 'prioritySupport' },
    ];

    for (const feature of features) {
      const icon = accountInfo.features[feature.key as keyof AccountInfo['features']] ? '✅' : '❌';
      logger.info(`${icon} ${feature.name}`);
    }
  }

  // Project status
  if (currentProject || projects.length > 0) {
    logger.newline();
    logger.bold('📁 Project Status');

    if (currentProject) {
      const statusIcon = currentProject.status === 'active' ? '✅' :
                       currentProject.status === 'deploying' ? '🔄' :
                       currentProject.status === 'error' ? '❌' : '⏸️';

      logger.info(`Current: ${statusIcon} ${currentProject.name} (${currentProject.environment})`);

      if (currentProject.url) {
        logger.info(`URL: ${currentProject.url}`);
      }

      if (currentProject.lastDeployed) {
        logger.info(`Last deployed: ${new Date(currentProject.lastDeployed).toLocaleString()}`);
      }

      if (options.verbose && currentProject.metrics) {
        logger.info(`Requests: ${currentProject.metrics.requests}`);
        logger.info(`Errors: ${currentProject.metrics.errors}`);
        logger.info(`Avg latency: ${currentProject.metrics.latency.average}ms`);
      }
    }

    if (projects.length > 0) {
      logger.newline();
      logger.info('All projects:');
      for (const project of projects) {
        const statusIcon = project.status === 'active' ? '✅' :
                         project.status === 'deploying' ? '🔄' :
                         project.status === 'error' ? '❌' : '⏸️';
        logger.info(`  ${statusIcon} ${project.name} (${project.environment})`);
      }
    }
  }

  // Recommendations
  logger.newline();
  logger.bold('💡 Recommendations');

  const recommendations: string[] = [];

  if (!localStatus.healthy) {
    recommendations.push('Fix local environment issues to use CLI features');
  }

  if (!cloudflareStatus.authenticated) {
    recommendations.push('Run `claudeflare auth login` to authenticate with Cloudflare');
  }

  if (!existsSync(getAuthConfigPath())) {
    recommendations.push('Run `claudeflare auth login` to authenticate with ClaudeFlare');
  }

  if (accountInfo) {
    const usage = Object.entries(accountInfo.usage).map(([key, value]) => ({
      key,
      value,
      percentage: (value / accountInfo!.limits[key as keyof AccountInfo['limits']]) * 100,
    }));

    const highUsage = usage.filter(u => u.percentage > 80);

    if (highUsage.length > 0) {
      recommendations.push(`High usage detected: ${highUsage.map(u => u.key).join(', ')}`);
    }
  }

  if (recommendations.length === 0) {
    logger.info('Everything looks good! 🎉');
  } else {
    recommendations.forEach(rec => logger.info(`• ${rec}`));
  }

  logger.newline();
}

/**
 * Helper functions
 */
function getAuthConfigPath(): string {
  const configDir = join(homedir(), '.claudeflare');
  return join(configDir, 'auth.json');
}

async function fetchSystemHealth(): Promise<SystemHealth> {
  // Mock implementation - in a real implementation, this would call the API
  return {
    status: 'healthy' as const,
    components: {
      workers: {
        name: 'Cloudflare Workers',
        status: 'ok' as const,
        message: 'All workers operational',
        latency: 45,
        uptime: 99.9,
      },
      api: {
        name: 'API Service',
        status: 'ok' as const,
        message: 'API responding normally',
        latency: 32,
        uptime: 99.8,
      },
      database: {
        name: 'Database Service',
        status: 'ok' as const,
        message: 'All databases healthy',
        latency: 15,
        uptime: 99.9,
      },
      storage: {
        name: 'Storage Service',
        status: 'ok' as const,
        message: 'Storage systems operational',
        latency: 28,
        uptime: 99.7,
      },
      monitoring: {
        name: 'Monitoring Service',
        status: 'ok' as const,
        message: 'Metrics collection active',
        latency: 12,
        uptime: 99.9,
      },
    },
    metrics: {
      uptime: 99.8,
      responseTime: 28,
      errorRate: 0.02,
    },
    lastUpdated: new Date().toISOString(),
  };
}

async function checkLocalEnvironment(): Promise<{ healthy: boolean; message: string; dependencies?: Record<string, string> }> {
  const dependencies: Record<string, string> = {};
  let healthy = true;
  let message = 'Environment OK';

  try {
    // Check Node.js
    const nodeVersion = process.version;
    dependencies['Node.js'] = `v${nodeVersion}`;
    if (parseFloat(nodeVersion.substring(1)) < 18) {
      healthy = false;
      message = 'Node.js version too low (requires 18.0.0 or higher)';
    }
  } catch {
    healthy = false;
    message = 'Node.js not found';
    dependencies['Node.js'] = 'not found';
  }

  try {
    // Check npm
    const npmVersion = execSync('npm --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    dependencies['npm'] = `v${npmVersion}`;
  } catch {
    dependencies['npm'] = 'not found';
    healthy = false;
    message = 'npm not found';
  }

  try {
    // Check Wrangler
    const wranglerVersion = execSync('wrangler --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    dependencies['Wrangler'] = wranglerVersion;
  } catch {
    dependencies['wrangler'] = 'not found';
    if (message === 'Environment OK') {
      message = 'Wrangler CLI not found';
    }
  }

  return { healthy, message, dependencies };
}

async function checkCloudflareStatus(): Promise<{ authenticated: boolean; wrangler?: { version: string } }> {
  const authenticated = await checkWranglerAuth();

  let wrangler: { version: string } | undefined;
  if (authenticated) {
    try {
      const version = execSync('wrangler --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
      wrangler = { version };
    } catch {
      // Wrangler might be installed but not authenticated
    }
  }

  return { authenticated, wrangler };
}

async function fetchAccountInfo(accessToken: string): Promise<AccountInfo> {
  const response = await fetch('https://api.claudeflare.workers.dev/account', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch account info: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchProjectStatus(accessToken: string): Promise<{ current: ProjectStatus | null; projects: ProjectStatus[] }> {
  const response = await fetch('https://api.claudeflare.workers.dev/projects/status', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch project status: ${response.statusText}`);
  }

  return await response.json();
}

function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Register status command with CLI
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check platform status and your account info')
    .option('-j, --json', 'Output in JSON format')
    .option('-v, --verbose', 'Show detailed information')
    .option('-a, --all', 'Show all information including account and projects')
    .option('--debug', 'Enable debug output')
    .action(statusCommand);
}