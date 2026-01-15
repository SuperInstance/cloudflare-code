/**
 * Projects command - Create, manage, and list ClaudeFlare projects
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, relative } from 'path';
import { spawn, execSync } from 'child_process';
import {
  createLogger,
  createSpinner,
  Prompts,
  TableFormatter,
  ValidationError,
} from '../utils/index.js';

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  path: string;
  template?: string;
  framework?: string;
  language: 'typescript' | 'javascript' | 'python' | 'go';
  environment: 'development' | 'preview' | 'production';
  createdAt: string;
  updatedAt: string;
  lastDeployed?: string;
  status: 'active' | 'archived' | 'suspended';
  settings: {
    build: {
      command?: string;
      output: string;
      docker?: boolean;
    };
    deploy: {
      environment: 'production' | 'preview' | 'development';
      domains?: string[];
      secrets: string[];
    };
    features: {
      vectorSearch: boolean;
      agents: boolean;
      gitIntegration: boolean;
      monitoring: boolean;
    };
  };
}

export interface CreateProjectOptions {
  name: string;
  description?: string;
  template?: string;
  framework?: string;
  language: 'typescript' | 'javascript' | 'python' | 'go';
  path?: string;
  initialize?: boolean;
  git?: boolean;
  interactive?: boolean;
  debug?: boolean;
}

export interface ProjectOptions {
  list?: boolean;
  create?: boolean;
  delete?: boolean;
  activate?: boolean;
  info?: boolean;
  rename?: string;
  path?: string;
  template?: string;
  environment?: 'development' | 'preview' | 'production';
  debug?: boolean;
}

export async function projectsCommand(options: ProjectOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
    timestamp: true,
  });

  const spinner = createSpinner({
    text: 'Initializing projects...',
    color: 'cyan',
  });

  try {
    // Validate authentication
    const configPath = getAuthConfigPath();
    if (!existsSync(configPath)) {
      spinner.fail('Not authenticated');
      throw new Error('Run `claudeflare auth login` to authenticate first');
    }

    const authConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!authConfig.claudeflare?.accessToken) {
      spinner.fail('No access token found');
      throw new Error('Run `claudeflare auth login` to authenticate');
    }

    // Get current working directory project
    const currentProject = detectCurrentProject();

    if (options.list) {
      await listProjects(logger, authConfig.claudeflare.accessToken);
    } else if (options.create) {
      // This will be handled by the create command
      throw new Error('Use `claudeflare projects create` to create a new project');
    } else if (options.delete) {
      await deleteProject(logger, options, authConfig.claudeflare.accessToken);
    } else if (options.activate) {
      await activateProject(logger, options, authConfig.claudeflare.accessToken);
    } else if (options.info) {
      await projectInfo(logger, options, authConfig.claudeflare.accessToken);
    } else if (options.rename) {
      await renameProject(logger, options, authConfig.claudeflare.accessToken);
    } else if (options.path) {
      await setProjectPath(logger, options);
    } else {
      // Interactive mode
      await interactiveProjects(logger, authConfig.claudeflare.accessToken, currentProject);
    }

  } catch (error) {
    spinner.fail('Projects command failed');

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
 * List projects
 */
async function listProjects(logger: any, accessToken: string): Promise<void> {
  const spinner = createSpinner({
    text: 'Fetching projects...',
    color: 'cyan',
  });

  try {
    spinner.start();

    const response = await fetch('https://api.claudeflare.workers.dev/projects', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const projects: ProjectInfo[] = await response.json();

    spinner.succeed(`Found ${projects.length} projects`);

    if (projects.length === 0) {
      logger.info('No projects found. Create your first project with:');
      logger.info('  claudeflare projects create');
      return;
    }

    // Display projects
    logger.newline();
    logger.box(
      'Your Projects',
      TableFormatter.projects(projects)
    );

    // Show current project indicator
    const currentProject = detectCurrentProject();
    if (currentProject) {
      logger.newline();
      logger.info(`Current project: ${currentProject}`);
    }

  } catch (error) {
    spinner.fail('Failed to fetch projects');

    if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Delete project
 */
async function deleteProject(logger: any, options: ProjectOptions, accessToken: string): Promise<void> {
  const projectPath = options.path;
  const spinner = createSpinner({
    text: 'Deleting project...',
    color: 'cyan',
  });

  try {
    spinner.start();

    // Get project ID
    let projectId: string;
    let projectName: string;

    if (projectPath) {
      // Local project detection
      const projectInfo = await fetchProjectInfo(projectPath);
      projectId = projectInfo.id;
      projectName = projectInfo.name;
    } else {
      // Prompt for project selection
      const projects = await fetchUserProjects(accessToken);
      if (projects.length === 0) {
        logger.info('No projects found');
        return;
      }

      const { Prompts } = await import('../utils/index.js');
      const prompts = new Prompts(logger);

      const selectedProject = await prompts.select(
        'Select project to delete:',
        projects.map(p => ({ name: p.name, value: p }))
      );

      projectId = selectedProject.id;
      projectName = selectedProject.name;
    }

    // Confirm deletion
    const shouldDelete = await confirmDeletion(logger, projectName);

    if (!shouldDelete) {
      spinner.fail('Deletion cancelled');
      return;
    }

    // Delete project
    const deleteResponse = await fetch(`https://api.claudeflare.workers.dev/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete project: ${deleteResponse.statusText}`);
    }

    spinner.succeed(`Project "${projectName}" deleted successfully`);

    // Clean up local config if it exists
    const localConfigPath = join(projectPath || process.cwd(), '.claudeflare-project');
    if (existsSync(localConfigPath)) {
      unlinkSync(localConfigPath);
      logger.info('Local project config cleaned up');
    }

  } catch (error) {
    spinner.fail('Failed to delete project');

    if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Activate project
 */
async function activateProject(logger: any, options: ProjectOptions, accessToken: string): Promise<void> {
  const projectPath = options.path;
  const spinner = createSpinner({
    text: 'Activating project...',
    color: 'cyan',
  });

  try {
    spinner.start();

    let projectId: string;
    let projectName: string;

    if (projectPath) {
      const projectInfo = await fetchProjectInfo(projectPath);
      projectId = projectInfo.id;
      projectName = projectInfo.name;
    } else {
      const projects = await fetchUserProjects(accessToken);
      if (projects.length === 0) {
        logger.info('No projects found');
        return;
      }

      const { Prompts } = await import('../utils/index.js');
      const prompts = new Prompts(logger);

      const selectedProject = await prompts.select(
        'Select project to activate:',
        projects.map(p => ({ name: p.name, value: p }))
      );

      projectId = selectedProject.id;
      projectName = selectedProject.name;
    }

    // Create local project config
    const localConfigPath = join(projectPath || process.cwd(), '.claudeflare-project');
    const localConfig = {
      projectId,
      projectName,
      activatedAt: new Date().toISOString(),
    };

    writeFileSync(localConfigPath, JSON.stringify(localConfig, null, 2));

    spinner.succeed(`Project "${projectName}" activated`);

    // Show next steps
    logger.newline();
    logger.info('You can now use ClaudeFlare commands with this project:');
    logger.info('  claudeflare deploy');
    logger.info('  claudeflare logs');
    logger.info('  claudeflare metrics');

  } catch (error) {
    spinner.fail('Failed to activate project');

    if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Show project info
 */
async function projectInfo(logger: any, options: ProjectOptions, accessToken: string): Promise<void> {
  const projectPath = options.path;
  const spinner = createSpinner({
    text: 'Fetching project info...',
    color: 'cyan',
  });

  try {
    spinner.start();

    let project: ProjectInfo;

    if (projectPath) {
      project = await fetchProjectInfo(projectPath);
    } else {
      const projects = await fetchUserProjects(accessToken);
      if (projects.length === 0) {
        logger.info('No projects found');
        return;
      }

      const { Prompts } = await import('../utils/index.js');
      const prompts = new Prompts(logger);

      const selectedProject = await prompts.select(
        'Select project:',
        projects.map(p => ({ name: p.name, value: p }))
      );

      project = selectedProject;
    }

    spinner.succeed('Project info retrieved');

    logger.newline();
    logger.box(
      `Project: ${project.name}`,
      TableFormatter.projectDetails(project)
    );

    // Show environment status
    if (project.lastDeployed) {
      logger.newline();
      logger.info(`Last deployed: ${new Date(project.lastDeployed).toLocaleString()}`);
    }

    // Show settings summary
    logger.newline();
    logger.bold('Project Settings:');
    logger.info(`Environment: ${project.environment}`);
    logger.info(`Language: ${project.language}`);
    logger.info(`Framework: ${project.framework || 'None'}`);
    logger.info(`Features: ${Object.entries(project.settings.features).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'None'}`);

  } catch (error) {
    spinner.fail('Failed to fetch project info');

    if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Rename project
 */
async function renameProject(logger: any, options: ProjectOptions, accessToken: string): Promise<void> {
  const newName = options.rename;
  if (!newName) {
    throw new Error('Project name is required for renaming');
  }

  const spinner = createSpinner({
    text: 'Renaming project...',
    color: 'cyan',
  });

  try {
    spinner.start();

    // Get current project
    const projectPath = options.path || process.cwd();
    const currentProject = detectCurrentProject();

    if (!currentProject) {
      logger.info('No active project found. Please specify a project with --path or navigate to a project directory');
      return;
    }

    // Rename API call
    const configPath = join(homedir(), '.claudeflare', 'auth.json');
    const authConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

    const renameResponse = await fetch(
      `https://api.claudeflare.workers.dev/projects/${currentProject}/rename`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authConfig.claudeflare.accessToken}`,
        },
        body: JSON.stringify({ newName }),
      }
    );

    if (!renameResponse.ok) {
      throw new Error(`Failed to rename project: ${renameResponse.statusText}`);
    }

    spinner.succeed(`Project renamed to "${newName}"`);

    // Update local config if it exists
    const localConfigPath = join(projectPath, '.claudeflare-project');
    if (existsSync(localConfigPath)) {
      const localConfig = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
      localConfig.projectName = newName;
      writeFileSync(localConfigPath, JSON.stringify(localConfig, null, 2));
    }

  } catch (error) {
    spinner.fail('Failed to rename project');

    if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Set project path
 */
async function setProjectPath(logger: any, options: ProjectOptions): Promise<void> {
  const projectPath = options.path;
  if (!projectPath) {
    throw new Error('Project path is required');
  }

  try {
    const absolutePath = resolve(projectPath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }

    // Create project config
    const configPath = join(absolutePath, '.claudeflare-project');
    const config = {
      path: absolutePath,
      configuredAt: new Date().toISOString(),
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    logger.info(`Project path set to: ${absolutePath}`);

  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Interactive mode
 */
async function interactiveProjects(
  logger: any,
  accessToken: string,
  currentProject: string | null
): Promise<void> {
  const { Prompts } = await import('../utils/index.js');
  const prompts = new Prompts(logger);

  logger.newline();
  logger.bold('📋 ClaudeFlare Projects Manager');
  logger.newline();

  // Show current project
  if (currentProject) {
    logger.info(`Current project: ${currentProject}`);
  }

  // Show projects
  try {
    const spinner = createSpinner({ text: 'Loading projects...' });
    spinner.start();

    const projects = await fetchUserProjects(accessToken);
    spinner.succeed();

    if (projects.length > 0) {
      logger.newline();
      logger.box('Your Projects', TableFormatter.projects(projects));
    }

  } catch (error) {
    logger.warn('Could not fetch remote projects');
  }

  // Show local projects
  const localProjects = detectLocalProjects();
  if (localProjects.length > 0) {
    logger.newline();
    logger.info('Local projects:');
    localProjects.forEach(project => {
      const isActive = project.name === currentProject;
      logger.info(`${isActive ? '→' : '  '}${project.name} (${project.path})`);
    });
  }

  // Interactive menu
  const choices = [
    { name: 'Create a new project', value: 'create' },
    { name: 'List all projects', value: 'list' },
    { name: 'Project settings', value: 'settings' },
    { name: 'Delete a project', value: 'delete' },
    { name: 'Activate a project', value: 'activate' },
    { name: 'View project info', value: 'info' },
    { name: 'Exit', value: 'exit' },
  ];

  while (true) {
    const action = await prompts.select('What would you like to do?', choices);

    switch (action) {
      case 'create':
        await createProjectInteractive(logger, accessToken);
        break;
      case 'list':
        await listProjects(logger, accessToken);
        break;
      case 'settings':
        await projectSettings(logger);
        break;
      case 'delete':
        await deleteProject(logger, {}, accessToken);
        break;
      case 'activate':
        await activateProject(logger, {}, accessToken);
        break;
      case 'info':
        await projectInfo(logger, {}, accessToken);
        break;
      case 'exit':
        return;
    }

    logger.newline();
  }
}

/**
 * Create project interactively
 */
async function createProjectInteractive(logger: any, accessToken: string): Promise<void> {
  const { Prompts } = await import('../utils/index.js');
  const prompts = new Prompts(logger);

  logger.newline();
  logger.bold('Create a new ClaudeFlare project');
  logger.newline();

  // Project name
  const name = await prompts.input('Project name:');
  if (!name) {
    logger.error('Project name is required');
    return;
  }

  // Description
  const description = await prompts.input('Description (optional):', { default: '' });

  // Template selection
  const templates = await fetchProjectTemplates();
  const template = await prompts.select(
    'Select template:',
    templates.map(t => ({ name: t.name, value: t }))
  );

  // Language
  const language = await prompts.select(
    'Language:',
    [
      { name: 'TypeScript', value: 'typescript' },
      { name: 'JavaScript', value: 'javascript' },
      { name: 'Python', value: 'python' },
      { name: 'Go', value: 'go' },
    ]
  );

  // Framework
  const frameworks = await fetchFrameworks(language);
  const framework = frameworks.length > 0
    ? await prompts.select(
        'Framework (optional):',
        [{ name: 'None', value: '' }, ...frameworks.map(f => ({ name: f, value: f }))]
      )
    : undefined;

  // Initialize git
  const initGit = await prompts.confirm('Initialize git repository?', { default: true });

  // Create project
  await createProject({
    name,
    description,
    template: template.name,
    framework,
    language,
    initialize: initGit,
    interactive: true,
    git: initGit,
  }, logger);
}

/**
 * Project settings
 */
async function projectSettings(logger: any): Promise<void> {
  logger.info('Project settings - Coming soon!');
}

/**
 * Helper functions
 */

function getAuthConfigPath(): string {
  const configDir = join(homedir(), '.claudeflare');
  return join(configDir, 'auth.json');
}

function detectCurrentProject(): string | null {
  const cwd = process.cwd();

  // Check for .claudeflare-project file
  const configPath = join(cwd, '.claudeflare-project');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.projectName || null;
  }

  // Check for parent directories
  let current = cwd;
  while (current !== '/') {
    const parentConfigPath = join(current, '.claudeflare-project');
    if (existsSync(parentConfigPath)) {
      const config = JSON.parse(readFileSync(parentConfigPath, 'utf-8'));
      return config.projectName || null;
    }
    current = join(current, '..');
  }

  return null;
}

function detectLocalProjects(): Array<{ name: string; path: string }> {
  const projects: Array<{ name: string; path: string }> = [];
  const cwd = process.cwd();

  // Look for .claudeflare-project files in current directory and subdirectories
  function scanDirectory(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules') {
        const configPath = join(fullPath, '.claudeflare-project');
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          projects.push({
            name: config.projectName || entry.name,
            path: fullPath,
          });
        }
        scanDirectory(fullPath);
      }
    }
  }

  scanDirectory(cwd);
  return projects;
}

async function fetchUserProjects(accessToken: string): Promise<ProjectInfo[]> {
  const response = await fetch('https://api.claudeflare.workers.dev/projects', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchProjectInfo(projectPath: string): Promise<ProjectInfo> {
  const configPath = join(projectPath, '.claudeflare-project');
  if (!existsSync(configPath)) {
    throw new Error('No project configuration found');
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Fetch project from API
  const authPath = getAuthConfigPath();
  const authConfig = JSON.parse(readFileSync(authPath, 'utf-8'));
  const response = await fetch(`https://api.claudeflare.workers.dev/projects/${config.projectId}`, {
    headers: {
      'Authorization': `Bearer ${authConfig.claudeflare.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch project info: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchProjectTemplates(): Promise<Array<{ name: string; description: string }>> {
  // Mock templates - in a real implementation, these would come from an API
  return [
    { name: 'worker-template', description: 'Basic Cloudflare Worker template' },
    { name: 'express-template', description: 'Express.js with Workers' },
    { name: 'react-template', description: 'React application with Workers' },
    { name: 'next-template', description: 'Next.js application with Workers' },
  ];
}

async function fetchFrameworks(language: string): Promise<string[]> {
  // Mock frameworks - in a real implementation, these would come from an API
  const frameworks: Record<string, string[]> = {
    typescript: ['Express', 'NestJS', 'Fastify'],
    javascript: ['Express', 'Koa', 'Fastify'],
    python: ['Flask', 'Django', 'FastAPI'],
    go: ['Gin', 'Echo', 'Fiber'],
  };

  return frameworks[language] || [];
}

async function confirmDeletion(logger: any, projectName: string): Promise<boolean> {
  const { Prompts } = await import('../utils/index.js');
  const prompts = new Prompts(logger);

  logger.warn('This action cannot be undone!');
  logger.warn(`Project "${projectName}" and all its data will be permanently deleted.`);
  logger.newline();

  return await prompts.confirmOrCancel(
    `Are you sure you want to delete "${projectName}"?`
  );
}

/**
 * Create a new project
 */
async function createProject(options: CreateProjectOptions, logger: any): Promise<void> {
  const spinner = createSpinner({
    text: `Creating project "${options.name}"...`,
    color: 'cyan',
  });

  try {
    spinner.start();

    // Validate project name
    if (!/^[a-z][a-z0-9-]*$/.test(options.name)) {
      throw new ValidationError('Project name must contain only lowercase letters, numbers, and hyphens');
    }

    // Create project directory
    const projectPath = options.path || resolve(options.name);
    if (existsSync(projectPath)) {
      throw new ValidationError('Project directory already exists');
    }

    mkdirSync(projectPath, { recursive: true });

    // Create project structure
    await createProjectStructure(projectPath, options);

    // Initialize git if requested
    if (options.git) {
      try {
        execSync('git init', { cwd: projectPath, stdio: 'pipe' });
        execSync('git add .', { cwd: projectPath, stdio: 'pipe' });
        execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'pipe' });
      } catch (error) {
        logger.warn('Git initialization failed');
      }
    }

    // Create ClaudeFlare config
    createClaudeFlareConfig(projectPath, options);

    spinner.succeed(`Project "${options.name}" created successfully`);

    // Show next steps
    logger.newline();
    logger.info('Next steps:');
    logger.info(`1. cd ${options.name}`);
    logger.info('2. Edit your worker code');
    logger.info('3. Run claudeflare deploy');

    // Open in editor if available
    const editor = process.env.EDITOR || process.env.VISUAL;
    if (editor) {
      logger.newline();
      logger.info(`Opening in editor: ${editor}`);
      spawn(editor, [projectPath], { stdio: 'inherit' });
    }

  } catch (error) {
    spinner.fail('Failed to create project');

    if (error instanceof Error) {
      logger.error(error.message);
    }

    // Clean up partially created project
    if (options.path || existsSync(resolve(options.name))) {
      const cleanupPath = options.path || resolve(options.name);
      try {
        rmSync(cleanupPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    process.exit(1);
  }
}

async function createProjectStructure(path: string, options: CreateProjectOptions): Promise<void> {
  // Create package.json for TypeScript/JavaScript projects
  if (options.language === 'typescript' || options.language === 'javascript') {
    const packageJson = {
      name: options.name,
      version: '1.0.0',
      description: options.description,
      main: 'dist/index.js',
      scripts: {
        dev: 'wrangler dev',
        deploy: 'wrangler deploy',
        build: 'tsc',
        test: 'vitest',
      },
      dependencies: {
        '@claudeflare/sdk': 'latest',
      },
      devDependencies: {
        'typescript': '^5.0.0',
        'wrangler': '^3.0.0',
        'vitest': '^1.0.0',
      },
    };

    writeFileSync(join(path, 'package.json'), JSON.stringify(packageJson, null, 2));
  }

  // Create source directory
  mkdirSync(join(path, 'src'), { recursive: true });

  // Create worker entry point
  const workerCode = `
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('Hello from ${options.name}!');
  },
};
`;

  writeFileSync(join(path, 'src', 'index.ts'), workerCode);

  // Create wrangler.toml
  const wranglerConfig = `
name = "${options.name}"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.preview]
vars = { ENVIRONMENT = "preview" }
`;

  writeFileSync(join(path, 'wrangler.toml'), wranglerConfig);

  // Create tsconfig.json for TypeScript
  if (options.language === 'typescript') {
    const tsconfig = {
      compilerOptions: {
        target: 'es2022',
        module: 'esnext',
        lib: ['es2022'],
        declaration: true,
        outDir: 'dist',
        rootDir: 'src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src'],
    };

    writeFileSync(join(path, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  }
}

function createClaudeFlareConfig(path: string, options: CreateProjectOptions): void {
  const config = {
    project: {
      name: options.name,
      description: options.description,
      language: options.language,
      framework: options.framework,
      template: options.template,
    },
    build: {
      command: options.language === 'typescript' ? 'npm run build' : undefined,
      output: 'dist',
    },
    deploy: {
      environment: 'preview',
      secrets: [],
    },
    features: {
      vectorSearch: false,
      agents: true,
      gitIntegration: true,
      monitoring: true,
    },
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(path, 'claudeflare.config.json'), JSON.stringify(config, null, 2));
}

/**
 * Register projects command with CLI
 */
export function registerProjectsCommand(program: Command): void {
  const projectsProgram = program
    .command('projects')
    .description('Create, manage, and list ClaudeFlare projects')
    .option('--list', 'List all projects')
    .option('--create', 'Create a new project')
    .option('--delete', 'Delete a project')
    .option('--activate', 'Activate a project')
    .option('--info', 'Show project information')
    .option('--rename <name>', 'Rename a project')
    .option('--path <path>', 'Project path')
    .option('--template <name>', 'Project template')
    .option('--env <environment>', 'Environment', 'development')
    .option('--debug', 'Enable debug output')
    .action(projectsCommand);

  // Add sub-commands
  projectsProgram
    .command('create')
    .description('Create a new project')
    .argument('<name>', 'Project name')
    .option('-d, --description <text>', 'Project description')
    .option('-t, --template <name>', 'Project template')
    .option('-f, --framework <name>', 'Framework')
    .option('-l, --language <type>', 'Programming language', 'typescript')
    .option('--path <path>', 'Project path')
    .option('--initialize', 'Initialize project')
    .option('-g, --git', 'Initialize git repository')
    .option('-i, --interactive', 'Interactive creation')
    .option('--debug', 'Enable debug output')
    .action(async (name: string, options: CreateProjectOptions) => {
      await createProject({ ...options, name }, createLogger());
    });
}