/**
 * Init command - Initialize new ClaudeFlare project
 */

import { Command } from 'commander';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { cwd } from 'process';
import { fileURLToPath } from 'url';
import { createLogger, createSpinner, Prompts, createProgressBar } from '../utils/index.js';
import { ProjectTemplate } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface InitOptions {
  name?: string;
  description?: string;
  template?: string;
  directory?: string;
  force?: boolean;
  install?: boolean;
  git?: boolean;
  debug?: boolean;
}

// Available templates
const TEMPLATES: Record<string, ProjectTemplate> = {
  basic: {
    name: 'basic',
    description: 'Basic Cloudflare Worker with Hono',
    path: 'basic',
    features: ['Hono framework', 'TypeScript', 'Health check endpoint', 'Example API routes'],
  },
  api: {
    name: 'api',
    description: 'REST API with routing and validation',
    path: 'api',
    features: [
      'Hono framework',
      'REST API structure',
      'Zod validation',
      'Error handling',
      'CORS support',
    ],
  },
  fullstack: {
    name: 'fullstack',
    description: 'Full-stack app with static assets',
    path: 'fullstack',
    features: [
      'Hono framework',
      'Static asset serving',
      'API routes',
      'HTML responses',
      'Asset optimization',
    ],
  },
};

/**
 * Read template file
 */
async function readTemplate(templateName: string, filename: string): Promise<string> {
  const templatePath = resolve(__dirname, '../../templates', filename);
  const content = readFileSync(templatePath, 'utf-8');
  return content;
}

/**
 * Replace template variables
 */
function replaceTemplateVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Create project files from template
 */
async function createProjectFiles(
  projectDir: string,
  variables: Record<string, string>,
  options: InitOptions
): Promise<void> {
  const files = [
    { template: 'config.ts', output: 'claudeflare.config.ts' },
    { template: 'worker.ts', output: 'src/index.ts' },
    { template: 'package.json', output: 'package.json' },
    { template: 'tsconfig.json', output: 'tsconfig.json' },
    { template: 'wrangler.toml', output: 'wrangler.toml' },
    { template: '.env.example', output: '.env.example' },
    { template: '.gitignore', output: '.gitignore' },
  ];

  for (const file of files) {
    const template = await readTemplate(options.template ?? 'basic', file.template);
    const content = replaceTemplateVariables(template, variables);
    const outputPath = resolve(projectDir, file.output);

    // Create directory if needed
    const outputDir = dirname(outputPath);
    mkdirSync(outputDir, { recursive: true });

    // Write file
    writeFileSync(outputPath, content, 'utf-8');
  }

  // Create README
  const readmeContent = `# ${variables.name}

${variables.description}

## Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

### Building

\`\`\`bash
npm run build
\`\`\`

### Deployment

\`\`\`bash
npm run deploy
\`\`\`

## Project Structure

- \`src/index.ts\` - Main worker entry point
- \`claudeflare.config.ts\` - ClaudeFlare configuration
- \`wrangler.toml\` - Cloudflare Workers configuration

## Learn More

- [ClaudeFlare Documentation](https://github.com/claudeflare/claudeflare)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
`;

  writeFileSync(resolve(projectDir, 'README.md'), readmeContent, 'utf-8');
}

/**
 * Initialize git repository
 */
async function initializeGit(projectDir: string): Promise<void> {
  const { execSync } = await import('child_process');

  try {
    execSync('git init', { cwd: projectDir, stdio: 'pipe' });
    execSync('git add .', { cwd: projectDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit from ClaudeFlare"', {
      cwd: projectDir,
      stdio: 'pipe',
    });
  } catch (error) {
    // Git might not be installed, just ignore
  }
}

/**
 * Install dependencies
 */
async function installDependencies(projectDir: string): Promise<void> {
  const { execSync } = await import('child_process');

  execSync('npm install', {
    cwd: projectDir,
    stdio: 'inherit',
  });
}

/**
 * Main init command
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  const logger = createLogger({
    debug: options.debug,
    colors: true,
  });

  const prompts = new Prompts(logger);

  logger.info('Welcome to ClaudeFlare! Let\'s create your project.');
  logger.newline();

  try {
    // Project name
    let projectName = options.name;

    if (!projectName) {
      projectName = await prompts.input({
        message: 'Project name:',
        default: 'my-claudeflare-app',
        validate: (input: string) => {
          if (!input) {
            return 'Project name is required';
          }
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Project name can only contain lowercase letters, numbers, and hyphens';
          }
          return true;
        },
      });
    }

    // Project description
    let description = options.description;

    if (!description) {
      description = await prompts.input({
        message: 'Project description:',
        default: 'A ClaudeFlare application',
      });
    }

    // Template selection
    let templateName = options.template;

    if (!templateName) {
      const templateChoices = Object.values(TEMPLATES).map((t) => ({
        name: `${t.name.padEnd(12)} - ${t.description}`,
        value: t.name,
      }));

      templateName = await prompts.list({
        message: 'Select a template:',
        choices: templateChoices,
        default: 'basic',
      });
    }

    const template = TEMPLATES[templateName];

    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    // Project directory
    const projectDir = options.directory
      ? resolve(cwd(), options.directory)
      : resolve(cwd(), projectName);

    // Check if directory exists
    const { existsSync } = await import('fs');
    if (existsSync(projectDir) && !options.force) {
      const overwrite = await prompts.confirm({
        message: `Directory ${projectDir} already exists. Overwrite?`,
        default: false,
      });

      if (!overwrite) {
        logger.info('Operation cancelled');
        process.exit(0);
      }
    }

    // Create project
    logger.newline();
    const spinner = createSpinner({
      text: `Creating project: ${projectName}`,
      color: 'cyan',
    });

    spinner.start();

    // Template variables
    const variables = {
      name: projectName,
      description,
      workerName: `${projectName}-worker`,
    };

    // Create project files
    await createProjectFiles(projectDir, variables, options);
    spinner.succeed('Project files created');

    // Initialize git if requested
    if (options.git !== false) {
      const gitSpinner = createSpinner({
        text: 'Initializing git repository...',
      });

      gitSpinner.start();

      await initializeGit(projectDir);

      gitSpinner.succeed('Git repository initialized');
    }

    // Install dependencies if requested
    if (options.install !== false) {
      const installSpinner = createSpinner({
        text: 'Installing dependencies...',
      });

      installSpinner.start();

      await installDependencies(projectDir);

      installSpinner.succeed('Dependencies installed');
    }

    spinner.stop();

    // Print success message
    logger.newline();
    logger.success('Project created successfully!');
    logger.newline();

    logger.box(
      'Next Steps',
      `cd ${projectName}\n` +
      `npm run dev\n\n` +
      `Available commands:\n` +
      `  npm run dev       - Start development server\n` +
      `  npm run build     - Build for production\n` +
      `  npm run deploy    - Deploy to Cloudflare Workers\n` +
      `  npm run test      - Run tests`
    );

    logger.newline();
    logger.info('Happy coding!');
    logger.newline();

  } catch (error) {
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
 * Register init command with CLI
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new ClaudeFlare project')
    .option('-n, --name <string>', 'Project name')
    .option('-d, --description <string>', 'Project description')
    .option('-t, --template <string>', 'Template to use (basic, api, fullstack)')
    .option('--directory <path>', 'Directory to create project in')
    .option('-f, --force', 'Overwrite existing directory')
    .option('--no-install', 'Skip installing dependencies')
    .option('--no-git', 'Skip git initialization')
    .option('--debug', 'Enable debug output')
    .action(initCommand);
}
