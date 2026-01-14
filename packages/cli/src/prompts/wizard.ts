/**
 * Interactive Prompts Wizard
 *
 * Provides interactive prompts and wizards for project setup,
 * configuration, and multi-step workflows.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import type { Config, ProjectTemplate } from '../types/index.js';
import { getAvailableTemplates } from '../scaffolding/templates.js';

const logger = createLogger('prompts');

/**
 * Prompt for project initialization
 */
export async function promptProjectInit(): Promise<{
  name: string;
  description: string;
  template: string;
  directory: string;
  installDeps: boolean;
  initGit: boolean;
  createConfig: boolean;
}> {
  logger.info('Welcome to ClaudeFlare!');
  logger.info('Let\'s create your project.\n');

  const templates = await getAvailableTemplates();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'my-claudeflare-app',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
      transformer: (input: string) => {
        return input.trim().toLowerCase().replace(/\s+/g, '-');
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A ClaudeFlare application',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: templates.map((t) => ({
        name: `${t.name} - ${t.description}`,
        value: t.path,
      })),
      default: 'minimal',
    },
    {
      type: 'input',
      name: 'directory',
      message: 'Project directory:',
      default: (answers: { name: string }) => answers.name,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Directory is required';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'installDeps',
      message: 'Install dependencies now?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'initGit',
      message: 'Initialize Git repository?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'createConfig',
      message: 'Create claudeflare.config.ts?',
      default: true,
    },
  ]);

  return answers;
}

/**
 * Prompt for configuration setup
 */
export async function promptConfigSetup(currentConfig?: Partial<Config>): Promise<Partial<Config>> {
  logger.info('Configure your ClaudeFlare project\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'workerName',
      message: 'Worker name:',
      default: currentConfig?.worker?.name || 'claudeflare-worker',
    },
    {
      type: 'input',
      name: 'mainFile',
      message: 'Main entry file:',
      default: currentConfig?.worker?.main || 'src/index.ts',
    },
    {
      type: 'number',
      name: 'devPort',
      message: 'Development server port:',
      default: currentConfig?.dev?.port || 8788,
      validate: (input: number) => {
        if (input < 1 || input > 65535) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'enableProxy',
      message: 'Enable proxy to Cloudflare Workers?',
      default: currentConfig?.dev?.proxy !== false,
    },
    {
      type: 'confirm',
      name: 'enableMonitoring',
      message: 'Enable monitoring and metrics?',
      default: currentConfig?.monitoring?.enabled !== false,
    },
    {
      type: 'list',
      name: 'defaultEnvironment',
      message: 'Default deployment environment:',
      choices: ['preview', 'production', 'development'],
      default: currentConfig?.deploy?.environment || 'preview',
    },
    {
      type: 'confirm',
      name: 'enableSourceMaps',
      message: 'Enable source maps in production?',
      default: currentConfig?.build?.sourcemap !== false,
    },
    {
      type: 'confirm',
      name: 'minifyBuild',
      message: 'Minify production build?',
      default: currentConfig?.build?.minify !== false,
    },
  ]);

  return {
    worker: {
      name: answers.workerName,
      main: answers.mainFile,
      compatibility_date: '2024-01-01',
      compatibility_flags: [],
      routes: [],
    },
    dev: {
      port: answers.devPort,
      host: 'localhost',
      proxy: answers.enableProxy,
      open: false,
      https: false,
    },
    monitoring: {
      enabled: answers.enableMonitoring,
      metrics: true,
      traces: true,
      logs: true,
    },
    deploy: {
      environment: answers.defaultEnvironment,
      workers: {
        name: answers.workerName,
      },
      vars: {},
      secrets: [],
      kv_namespaces: [],
      r2_buckets: [],
      durable_objects: [],
    },
    build: {
      input: answers.mainFile,
      output: 'dist/worker.js',
      minify: answers.minifyBuild,
      sourcemap: answers.enableSourceMaps,
      target: 'esnext',
    },
  };
}

/**
 * Prompt for feature selection
 */
export async function promptFeatureSelection(): Promise<string[]> {
  logger.info('Select features to include:\n');

  const { features } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select features:',
      choices: [
        {
          name: 'AI Provider Integration (OpenAI, Anthropic, etc.)',
          value: 'ai-providers',
          checked: true,
        },
        {
          name: 'Semantic Caching',
          value: 'semantic-cache',
          checked: true,
        },
        {
          name: 'Rate Limiting',
          value: 'rate-limiting',
          checked: true,
        },
        {
          name: 'Circuit Breaker',
          value: 'circuit-breaker',
          checked: true,
        },
        {
          name: 'Request Routing',
          value: 'request-routing',
          checked: true,
        },
        {
          name: 'Metrics Collection',
          value: 'metrics',
          checked: true,
        },
        {
          name: 'Session Management (Durable Objects)',
          value: 'sessions',
          checked: false,
        },
        {
          name: 'KV Storage',
          value: 'kv-storage',
          checked: false,
        },
        {
          name: 'R2 Object Storage',
          value: 'r2-storage',
          checked: false,
        },
        {
          name: 'WebSocket Support',
          value: 'websockets',
          checked: false,
        },
        {
          name: 'Cron Triggers',
          value: 'cron',
          checked: false,
        },
        {
          name: 'Email Handling',
          value: 'email',
          checked: false,
        },
      ],
    },
  ]);

  return features;
}

/**
 * Prompt for deployment configuration
 */
export async function promptDeployment(): Promise<{
  environment: string;
  workerName?: string;
  vars: Record<string, string>;
  secrets: string[];
}> {
  logger.info('Configure deployment\n');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message: 'Select environment:',
      choices: [
        { name: 'Preview (for testing)', value: 'preview' },
        { name: 'Production', value: 'production' },
        { name: 'Development', value: 'development' },
      ],
      default: 'preview',
    },
    {
      type: 'input',
      name: 'workerName',
      message: 'Worker name (leave empty to use config):',
      default: '',
    },
    {
      type: 'confirm',
      name: 'addVars',
      message: 'Add environment variables?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'addSecrets',
      message: 'Add secrets?',
      default: false,
    },
  ]);

  const vars: Record<string, string> = {};
  const secrets: string[] = [];

  if (answers.addVars) {
    const { varsList } = await inquirer.prompt([
      {
        type: 'input',
        name: 'varsList',
        message: 'Enter variables (KEY=value, comma-separated):',
        default: '',
      },
    ]);

    if (varsList) {
      for (const v of varsList.split(',')) {
        const [key, value] = v.split('=');
        if (key && value) {
          vars[key.trim()] = value.trim();
        }
      }
    }
  }

  if (answers.addSecrets) {
    const { secretsList } = await inquirer.prompt([
      {
        type: 'input',
        name: 'secretsList',
        message: 'Enter secret names (comma-separated):',
        default: '',
      },
    ]);

    if (secretsList) {
      secrets.push(...secretsList.split(',').map((s: string) => s.trim()));
    }
  }

  return {
    environment: answers.environment,
    workerName: answers.workerName || undefined,
    vars,
    secrets,
  };
}

/**
 * Prompt for rollback
 */
export async function promptRollback(): Promise<{
  version: string;
  confirm: boolean;
}> {
  logger.info('Rollback deployment\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'version',
      message: 'Enter version to rollback to:',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Version is required';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to rollback?',
      default: false,
    },
  ]);

  return answers;
}

/**
 * Multi-step workflow for project setup
 */
export async function projectSetupWorkflow(): Promise<{
  project: Awaited<ReturnType<typeof promptProjectInit>>;
  features: string[];
  config: Partial<Config>;
}> {
  console.clear();
  displayBanner();

  // Step 1: Project init
  const project = await promptProjectInit();
  logger.success('Project configuration complete!\n');

  // Step 2: Feature selection
  const features = await promptFeatureSelection();
  logger.success(`${features.length} features selected!\n`);

  // Step 3: Config setup
  const config = await promptConfigSetup();
  logger.success('Configuration complete!\n');

  return { project, features, config };
}

/**
 * Display welcome banner
 */
export function displayBanner(): void {
  console.log('');
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold('  _____            _      _      _    _             ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold(' |  __ \\          | |    | |    | |  (_)            ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold(' | |__) |___  ___ | |_  | | __| | ___ _ __   __ _    ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold(' |  _  // _ \\/ _ \\| __| | |/ /| |/ / | \'_ \\ / _` |   ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold(' | | \\ \\ (_) | (_) | |_  |   < |   <| | | | | (_| |   ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold(' |_|  \\_\\___/ \\___/ \\__| |_|\\_\\|_|\\_\\_|_| |_|\\__, |   ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold('                                              __/ |   ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold('                    Distributed AI Platform  |___/    ') + chalk.cyan.bold('  ║'));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan.bold('║') + ' ' + chalk.gray('https://claudeflare.dev') + ' '.repeat(40) + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Display progress in a workflow
 */
export async function displayProgress(
  steps: Array<{ name: string; action: () => Promise<void> }>
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const progress = chalk.cyan(`[${i + 1}/${steps.length}]`);
    logger.info(`${progress} ${step.name}...`);

    try {
      await step.action();
      logger.success(`${progress} ${step.name} complete!`);
    } catch (error) {
      logger.error(`${progress} ${step.name} failed:`, error);
      throw error;
    }
  }
}

/**
 * Confirm destructive action
 */
export async function confirmDestructive(action: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow(`⚠️  This will ${action}. Continue?`),
      default: false,
    },
  ]);

  return confirm;
}

/**
 * Select from list with search
 */
export async function selectFromList<T>(
  items: T[],
  displayFn: (item: T) => string,
  message: string
): Promise<T> {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices: items.map((item) => ({
        name: displayFn(item),
        value: item,
      })),
    },
  ]);

  return selected;
}

/**
 * Multi-select from list
 */
export async function multiSelectFromList<T>(
  items: T[],
  displayFn: (item: T) => string,
  message: string
): Promise<T[]> {
  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message,
      choices: items.map((item) => ({
        name: displayFn(item),
        value: item,
      })),
    },
  ]);

  return selected;
}
