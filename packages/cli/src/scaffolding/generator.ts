/**
 * Project Scaffolding Generator
 *
 * Template engine and file generator for creating new ClaudeFlare projects.
 * Supports multiple templates, dependency installation, and Git initialization.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import type { Config } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('scaffolding');

/**
 * Project templates metadata
 */
export interface TemplateMetadata {
  name: string;
  description: string;
  path: string;
  features: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  name: string;
  description: string;
  template: string;
  directory: string;
  installDeps: boolean;
  initGit: boolean;
  createConfig: boolean;
  features: string[];
  config?: Partial<Config>;
}

/**
 * Get available templates
 */
export async function getAvailableTemplates(): Promise<TemplateMetadata[]> {
  return [
    {
      name: 'minimal',
      description: 'Minimal ClaudeFlare Worker',
      path: 'minimal',
      features: ['worker', 'typescript'],
    },
    {
      name: 'standard',
      description: 'Standard ClaudeFlare App',
      path: 'standard',
      features: ['worker', 'typescript', 'routing', 'middleware'],
    },
    {
      name: 'full',
      description: 'Full-featured ClaudeFlare Platform',
      path: 'full',
      features: [
        'worker',
        'typescript',
        'routing',
        'middleware',
        'ai-providers',
        'semantic-cache',
        'rate-limiting',
        'circuit-breaker',
        'metrics',
      ],
    },
    {
      name: 'api',
      description: 'REST API Template',
      path: 'api',
      features: ['worker', 'typescript', 'routing', 'validation'],
    },
    {
      name: 'webhook',
      description: 'Webhook Handler',
      path: 'webhook',
      features: ['worker', 'typescript', 'webhooks', 'verification'],
    },
  ];
}

/**
 * Generate project from template
 */
export async function generateProject(options: GeneratorOptions): Promise<void> {
  const spinner = createSpinner('Generating project...');

  try {
    // Create project directory
    await fs.mkdir(options.directory, { recursive: true });

    // Generate files from template
    await generateFromTemplate(options);

    // Create configuration
    if (options.createConfig) {
      await createConfigFile(options);
    }

    // Create package.json
    await createPackageJson(options);

    // Create tsconfig.json
    await createTsConfig(options);

    // Create .gitignore
    await createGitignore(options);

    // Create README
    await createReadme(options);

    // Create .env.example
    await createEnvExample(options);

    // Initialize Git
    if (options.initGit) {
      await initializeGit(options.directory);
    }

    // Install dependencies
    if (options.installDeps) {
      await installDependencies(options.directory);
    }

    spinner.succeed('Project generated successfully!');
    displayNextSteps(options);
  } catch (error) {
    spinner.fail('Failed to generate project');
    throw error;
  }
}

/**
 * Generate files from template
 */
async function generateFromTemplate(options: GeneratorOptions): Promise<void> {
  const templatePath = join(__dirname, '../../templates', options.template);

  try {
    await fs.access(templatePath);
  } catch {
    // Template doesn't exist, use minimal template
    logger.warn(`Template '${options.template}' not found, using minimal template`);
    await generateMinimalTemplate(options);
    return;
  }

  // Copy template files
  await copyTemplateFiles(templatePath, options.directory, options);
}

/**
 * Generate minimal template inline
 */
async function generateMinimalTemplate(options: GeneratorOptions): Promise<void> {
  const srcDir = join(options.directory, 'src');
  await fs.mkdir(srcDir, { recursive: true });

  // Generate main worker file
  const workerCode = generateWorkerCode(options);
  await fs.writeFile(join(srcDir, 'index.ts'), workerCode);

  // Generate wrangler.toml
  const wranglerConfig = generateWranglerConfig(options);
  await fs.writeFile(join(options.directory, 'wrangler.toml'), wranglerConfig);
}

/**
 * Generate worker code based on options
 */
function generateWorkerCode(options: GeneratorOptions): string {
  const hasRouting = options.features.includes('routing');
  const hasAI = options.features.includes('ai-providers');
  const hasCache = options.features.includes('semantic-cache');
  const hasRateLimit = options.features.includes('rate-limiting');
  const hasCircuitBreaker = options.features.includes('circuit-breaker');

  let code = `/**
 * ${options.name}
 * ${options.description}
 */

import { Router } from '@claudeflare/edge';
`;

  if (hasAI) {
    code += `import { AIProviderRouter } from '@claudeflare/edge';
`;
  }

  if (hasCache) {
    code += `import { SemanticCache } from '@claudeflare/edge';
`;
  }

  if (hasRateLimit) {
    code += `import { TokenBucket } from '@claudeflare/edge';
`;
  }

  if (hasCircuitBreaker) {
    code += `import { CircuitBreaker } from '@claudeflare/edge';
`;
  }

  code += `
export interface Env {
  // Add your environment variables here
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
`;

  if (hasRouting) {
    code += `    const router = new Router<Env>();

    router.get('/', () => {
      return new Response(JSON.stringify({
        message: 'Welcome to ${options.name}',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    return router.handle(request, env, ctx);
`;
  } else {
    code += `    return new Response(JSON.stringify({
      message: 'Welcome to ${options.name}',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
`;
  }

  code += `  },
};
`;

  return code;
}

/**
 * Generate wrangler.toml configuration
 */
function generateWranglerConfig(options: GeneratorOptions): string {
  const workerName = options.config?.worker?.name || `${options.name}-worker`;

  return `name = "${workerName}"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.development]
vars = { ENVIRONMENT = "development" }

[env.production]
vars = { ENVIRONMENT = "production" }
`;
}

/**
 * Copy template files recursively
 */
async function copyTemplateFiles(
  templatePath: string,
  targetPath: string,
  options: GeneratorOptions
): Promise<void> {
  const entries = await fs.readdir(templatePath, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(templatePath, entry.name);
    const destPath = join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyTemplateFiles(srcPath, destPath, options);
    } else {
      let content = await fs.readFile(srcPath, 'utf-8');
      content = replaceTemplateVariables(content, options);
      await fs.writeFile(destPath, content);
    }
  }
}

/**
 * Replace template variables in content
 */
function replaceTemplateVariables(content: string, options: GeneratorOptions): string {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, options.name)
    .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, options.description)
    .replace(/\{\{WORKER_NAME\}\}/g, options.config?.worker?.name || `${options.name}-worker`)
    .replace(/\{\{VERSION\}\}/g, '0.1.0');
}

/**
 * Create claudeflare.config.ts
 */
async function createConfigFile(options: GeneratorOptions): Promise<void> {
  const config = options.config || {};

  const configCode = `import { defineConfig } from '@claudeflare/cli';

export default defineConfig({
  name: '${options.name}',
  version: '0.1.0',
  description: '${options.description}',

  worker: {
    name: '${config.worker?.name || `${options.name}-worker`}',
    main: '${config.worker?.main || 'src/index.ts'}',
    compatibility_date: '2024-01-01',
    compatibility_flags: [],
    routes: [],
  },

  build: {
    input: '${config.build?.input || 'src/index.ts'}',
    output: '${config.build?.output || 'dist/worker.js'}',
    minify: ${config.build?.minify !== false},
    sourcemap: ${config.build?.sourcemap !== false},
    target: '${config.build?.target || 'esnext'}',
  },

  dev: {
    port: ${config.dev?.port || 8788},
    host: '${config.dev?.host || 'localhost'}',
    proxy: ${config.dev?.proxy !== false},
    open: ${config.dev?.open || false},
    https: ${config.dev?.https || false},
  },

  deploy: {
    environment: '${config.deploy?.environment || 'preview'}',
    workers: {
      name: '${config.deploy?.workers?.name || `${options.name}-worker`}',
    },
    vars: {},
    secrets: [],
    kv_namespaces: [],
    r2_buckets: [],
    durable_objects: [],
  },

  monitoring: {
    enabled: ${config.monitoring?.enabled !== false},
    metrics: true,
    traces: true,
    logs: true,
  },

  cli: {
    debug: false,
    verbose: false,
    colors: true,
    progress: true,
  },
});
`;

  await fs.writeFile(join(options.directory, 'claudeflare.config.ts'), configCode);
}

/**
 * Create package.json
 */
async function createPackageJson(options: GeneratorOptions): Promise<void> {
  const pkg = {
    name: options.name,
    version: '0.1.0',
    description: options.description,
    private: true,
    type: 'module',
    scripts: {
      dev: 'claudeflare dev',
      build: 'claudeflare build',
      deploy: 'claudeflare deploy',
      test: 'claudeflare test',
      lint: 'claudeflare lint',
      'typecheck': 'tsc --noEmit',
    },
    dependencies: {
      '@claudeflare/edge': '^0.1.0',
    },
    devDependencies: {
      '@claudeflare/cli': '^0.1.0',
      '@cloudflare/workers-types': '^4.20231218.0',
      'typescript': '^5.3.3',
      'wrangler': '^3.20.0',
    },
  };

  await fs.writeFile(
    join(options.directory, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
}

/**
 * Create tsconfig.json
 */
async function createTsConfig(options: GeneratorOptions): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022'],
      types: ['@cloudflare/workers-types'],
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: './dist',
      rootDir: './src',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeFile(
    join(options.directory, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );
}

/**
 * Create .gitignore
 */
async function createGitignore(options: GeneratorOptions): Promise<void> {
  const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
.wrangler/
worker/

# Environment files
.env
.env.local
.env.*.local

# Editor directories
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/

# Misc
.cache/
.temp/
*.tmp
`;

  await fs.writeFile(join(options.directory, '.gitignore'), gitignore);
}

/**
 * Create README.md
 */
async function createReadme(options: GeneratorOptions): Promise<void> {
  const readme = `# ${options.name}

${options.description}

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Cloudflare account (free tier works)
- Wrangler CLI installed

### Installation

\`\`\`bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login
\`\`\`

### Development

\`\`\`bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
\`\`\`

## Project Structure

\`\`\`
.
├── src/
│   └── index.ts          # Main worker file
├── claudeflare.config.ts # ClaudeFlare configuration
├── wrangler.toml         # Cloudflare Workers configuration
├── package.json
├── tsconfig.json
└── README.md
\`\`\`

## Configuration

Environment variables can be set in \`.env\` file:

\`\`\`bash
CLOUDFLARE_ACCOUNT_ID=your_account_id
ENVIRONMENT=development
\`\`\`

## Deployment

\`\`\`bash
# Deploy to preview
npm run deploy

# Deploy to production
npm run deploy -- --environment production
\`\`\`

## Learn More

- [ClaudeFlare Documentation](https://claudeflare.dev/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## License

MIT
`;

  await fs.writeFile(join(options.directory, 'README.md'), readme);
}

/**
 * Create .env.example
 */
async function createEnvExample(options: GeneratorOptions): Promise<void> {
  const envExample = `# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here

# Application
ENVIRONMENT=development
LOG_LEVEL=info

# AI Providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Monitoring (optional)
SENTRY_DSN=
`;

  await fs.writeFile(join(options.directory, '.env.example'), envExample);
}

/**
 * Initialize Git repository
 */
async function initializeGit(directory: string): Promise<void> {
  try {
    execSync('git init', { cwd: directory, stdio: 'pipe' });
    execSync('git add .', { cwd: directory, stdio: 'pipe' });
    execSync('git commit -m "Initial commit from ClaudeFlare"', {
      cwd: directory,
      stdio: 'pipe',
    });
  } catch (error) {
    logger.warn('Failed to initialize Git repository');
  }
}

/**
 * Install dependencies
 */
async function installDependencies(directory: string): Promise<void> {
  const spinner = createSpinner('Installing dependencies...');

  try {
    execSync('npm install', { cwd: directory, stdio: 'pipe' });
    spinner.succeed('Dependencies installed');
  } catch (error) {
    spinner.fail('Failed to install dependencies');
    throw error;
  }
}

/**
 * Display next steps
 */
function displayNextSteps(options: GeneratorOptions): void {
  console.log('');
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + ' ' + chalk.white.bold('Next Steps') + ' '.repeat(48) + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan.bold('║') + `  1. ${chalk.gray('cd')} ${chalk.cyan(options.directory)}` + ' '.repeat(50 - options.directory.length) + chalk.cyan.bold(' ║'));
  console.log(chalk.cyan.bold('║') + `  2. ${chalk.gray('npx wrangler login')}` + ' '.repeat(44) + chalk.cyan.bold(' ║'));
  console.log(chalk.cyan.bold('║') + `  3. ${chalk.gray('npm run dev')}` + ' '.repeat(51) + chalk.cyan.bold(' ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝'));
  console.log('');
}
