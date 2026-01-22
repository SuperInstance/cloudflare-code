/**
 * Project Generator for ClaudeFlare Application Factory
 * Generates production-ready Cloudflare applications based on requirements
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { ProjectSpec, Requirement, Constraint } from './index';
import { AnalysisResult } from './requirement-analyzer';
import { ArchitectureRecommendation } from './architecture-engine';
import { CostAnalysis } from './cost-calculator';

export interface GenerateOptions {
  outputDir: string;
  template?: string;
  framework?: string;
  language?: string;
  database?: string;
  auth?: string;
  testing?: boolean;
  linting?: boolean;
  typeCheck?: boolean;
  ci?: boolean;
  docs?: boolean;
  git?: boolean;
}

export interface GenerateResult {
  success: boolean;
  projectPath: string;
  template: string;
  files: GeneratedFile[];
  commands: string[];
  warnings: string[];
  errors: string[];
  architecture?: ArchitectureRecommendation;
  costAnalysis?: CostAnalysis;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'code' | 'config' | 'test' | 'doc' | 'script';
  description: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'saas' | 'api' | 'frontend' | 'backend' | 'fullstack';
  framework: string;
  language: string;
  database?: string;
  auth?: string;
  features: string[];
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  files: TemplateFile[];
  dependencies: string[];
  scripts: Record<string, string>;
}

export interface TemplateFile {
  path: string;
  content: string;
  variables: string[];
  type: 'code' | 'config' | 'test' | 'doc';
  description: string;
}

/**
 * Generate a complete Cloudflare application project
 */
export async function generateProject(options: ProjectSpec & GenerateOptions): Promise<GenerateResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];
  const commands: string[] = [];

  try {
    // Validate input
    validateOptions(options);

    // Initialize project structure
    const projectPath = createProjectStructure(options);

    // Analyze requirements if not provided
    let requirements: AnalysisResult;
    if (options.requirements && options.requirements.length > 0) {
      // Convert project requirements to analysis result
      requirements = convertProjectSpecToAnalysis(options);
    } else {
      // Analyze natural language description
      const { analyzeRequirements } = await import('./requirement-analyzer');
      requirements = await analyzeRequirements(options.description, '', options.constraints || []);
    }

    // Generate architecture
    const { recommendArchitecture } = await import('./architecture-engine');
    const architecture = await recommendArchitecture(requirements, options.constraints || {});

    // Estimate costs
    const { calculateCosts } = await import('./cost-calculator');
    const costAnalysis = await calculateCosts(architecture, 'global', {
      dailyRequests: 1000,
      averageCpuTime: 10,
      storage: 1,
      bandwidth: 5
    });

    // Select or create template
    const template = await selectTemplate(options, requirements, architecture);

    // Generate files based on template
    const generatedFiles = await generateFiles(template, projectPath, {
      projectSpec: options,
      requirements,
      architecture,
      costAnalysis
    });

    // Generate project-specific files
    const projectFiles = generateProjectFiles(options, projectPath, {
      requirements,
      architecture,
      costAnalysis
    });

    // Combine all files
    const allFiles = [...generatedFiles, ...projectFiles];

    // Write all files to disk
    writeFilesToDisk(allFiles, projectPath);

    // Generate configuration files
    const configFiles = generateConfigurationFiles(options, projectPath, {
      requirements,
      architecture
    });
    writeFilesToDisk(configFiles, projectPath);

    // Generate scripts
    const scriptFiles = generateScriptFiles(options, projectPath);
    writeFilesToDisk(scriptFiles, projectPath);

    // Generate documentation
    const docFiles = generateDocumentationFiles(options, projectPath, {
      requirements,
      architecture,
      costAnalysis
    });
    writeFilesToDisk(docFiles, projectPath);

    // Generate package.json
    const packageJson = generatePackageJson(options, projectPath, {
      requirements,
      architecture,
      template
    });
    writeFilesToDisk([packageJson], projectPath);

    // Generate wrangler.toml
    const wranglerConfig = generateWranglerConfig(options, projectPath, {
      requirements,
      architecture
    });
    writeFilesToDisk([wranglerConfig], projectPath);

    // Generate TypeScript config
    const tsConfig = generateTypeScriptConfig(options, projectPath);
    writeFilesToDisk([tsConfig], projectPath);

    // Initialize git repository if requested
    if (options.git) {
      await initializeGit(projectPath);
      commands.push(`cd ${projectPath} && git init`);
      commands.push(`cd ${projectPath} && git add .`);
      commands.push(`cd ${projectPath} && git commit -m "Initial project generated by ClaudeFlare"`);
    }

    // Generate setup instructions
    const setupCommands = generateSetupCommands(options, projectPath, {
      requirements,
      architecture
    });
    commands.push(...setupCommands);

    // Add warnings for any issues
    addWarnings(warnings, options, requirements, architecture, costAnalysis);

    return {
      success: true,
      projectPath,
      template: template.id,
      files: allFiles,
      commands,
      warnings,
      errors,
      architecture,
      costAnalysis
    };

  } catch (error) {
    errors.push(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      projectPath: '',
      template: '',
      files: [],
      commands,
      warnings,
      errors,
      architecture: undefined,
      costAnalysis: undefined
    };
  }
}

/**
 * Validate generation options
 */
function validateOptions(options: ProjectSpec & GenerateOptions): void {
  if (!options.name || options.name.trim().length === 0) {
    throw new Error('Project name is required');
  }

  if (!options.description || options.description.trim().length < 10) {
    throw new Error('Project description must be at least 10 characters long');
  }

  if (!options.outputDir || options.outputDir.trim().length === 0) {
    throw new Error('Output directory is required');
  }

  // Validate project name (no special characters, spaces allowed)
  if (!/^[a-zA-Z0-9\-_\s]+$/.test(options.name)) {
    throw new Error('Project name contains invalid characters');
  }
}

/**
 * Create project directory structure
 */
function createProjectStructure(options: ProjectSpec & GenerateOptions): string {
  const projectPath = join(options.outputDir, sanitizeProjectName(options.name));

  if (existsSync(projectPath)) {
    throw new Error(`Directory already exists: ${projectPath}`);
  }

  // Create basic directory structure
  mkdirSync(projectPath, { recursive: true });
  mkdirSync(join(projectPath, 'src'), { recursive: true });
  mkdirSync(join(projectPath, 'tests'), { recursive: true });
  mkdirSync(join(projectPath, 'docs'), { recursive: true });
  mkdirSync(join(projectPath, 'scripts'), { recursive: true });

  return projectPath;
}

/**
 * Sanitize project name for directory
 */
function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert project specification to analysis result
 */
function convertProjectSpecToAnalysis(spec: ProjectSpec): AnalysisResult {
  const analysis: AnalysisResult = {
    technicalRequirements: [],
    businessRequirements: [],
    securityRequirements: [],
    performanceRequirements: [],
    technologies: [],
    estimatedComplexity: 'medium',
    estimatedTimeline: '2-4 weeks',
    risks: []
  };

  // Convert requirements
  spec.requirements.forEach(req => {
    if (req.type === 'technical') {
      analysis.technicalRequirements.push({
        id: `tech-${req.type}-${Date.now()}`,
        category: 'backend',
        description: req.description,
        priority: req.priority,
        acceptance: req.acceptance
      });
    }
    if (req.type === 'business') {
      analysis.businessRequirements.push({
        id: `business-${req.type}-${Date.now()}`,
        goal: req.description,
        priority: req.priority,
        stakeholders: ['Stakeholders'],
        acceptance: req.acceptance
      });
    }
    if (req.type === 'security') {
      analysis.securityRequirements.push({
        id: `security-${req.type}-${Date.now()}`,
        domain: 'data-protection',
        description: req.description,
        standards: ['OWASP'],
        priority: req.priority,
        acceptance: req.acceptance
      });
    }
    if (req.type === 'performance') {
      analysis.performanceRequirements.push({
        id: `perf-${req.type}-${Date.now()}`,
        metric: 'response-time',
        target: 200,
        unit: 'ms',
        priority: req.priority,
        acceptance: req.acceptance
      });
    }
  });

  return analysis;
}

/**
 * Select template based on requirements and options
 */
async function selectTemplate(
  options: ProjectSpec & GenerateOptions,
  requirements: AnalysisResult,
  architecture: ArchitectureRecommendation
): Promise<Template> {
  // Define template registry
  const templates: Template[] = [
    {
      id: 'default-saas',
      name: 'Default SaaS Template',
      description: 'Complete SaaS application with authentication, payments, and dashboard',
      category: 'saas',
      framework: 'react',
      language: 'typescript',
      database: 'postgres',
      auth: 'jwt',
      features: ['auth', 'dashboard', 'payments', 'admin', 'analytics'],
      complexity: 'high',
      files: [],
      dependencies: ['@hono/hono', '@hono/zod-validator', 'bcrypt', 'jsonwebtoken'],
      scripts: {
        dev: 'wrangler dev',
        build: 'wrangler build',
        deploy: 'wrangler deploy'
      }
    },
    {
      id: 'api-service',
      name: 'API Service Template',
      description: 'RESTful API service with database and authentication',
      category: 'api',
      framework: 'express',
      language: 'typescript',
      database: 'postgres',
      auth: 'oauth',
      features: ['api', 'auth', 'database', 'docs'],
      complexity: 'medium',
      files: [],
      dependencies: ['@hono/hono', '@hono/zod-validator', 'pg', 'jsonwebtoken'],
      scripts: {
        dev: 'wrangler dev',
        build: 'wrangler build',
        deploy: 'wrangler deploy'
      }
    },
    {
      id: 'static-frontend',
      name: 'Static Frontend Template',
      description: 'Static frontend site with CMS capabilities',
      category: 'frontend',
      framework: 'react',
      language: 'typescript',
      database: 'kv',
      features: ['static', 'cms', 'blog', 'portfolio'],
      complexity: 'low',
      files: [],
      dependencies: ['@hono/hono', '@hono/zod-validator', 'react', 'react-dom'],
      scripts: {
        dev: 'wrangler dev',
        build: 'wrangler build',
        deploy: 'wrangler deploy'
      }
    },
    {
      id: 'fullstack-app',
      name: 'Full Stack Application',
      description: 'Complete full-stack application with frontend and backend',
      category: 'fullstack',
      framework: 'next',
      language: 'typescript',
      database: 'postgres',
      auth: 'firebase',
      features: ['frontend', 'backend', 'database', 'auth', 'api'],
      complexity: 'very-high',
      files: [],
      dependencies: ['@hono/hono', '@hono/zod-validator', 'react', 'next', 'firebase-admin'],
      scripts: {
        dev: 'wrangler dev',
        build: 'wrangler build',
        deploy: 'wrangler deploy'
      }
    }
  ];

  // Select template based on project type
  let template = templates.find(t => t.id === options.template || t.category === options.type);

  // Fallback to default template
  if (!template) {
    template = templates.find(t => t.id === 'default-saas') || templates[0];
  }

  // Customize template based on requirements
  return customizeTemplate(template, requirements, options);
}

/**
 * Customize template based on requirements
 */
function customizeTemplate(
  template: Template,
  requirements: AnalysisResult,
  options: ProjectSpec & GenerateOptions
): Template {
  const customized = { ...template };

  // Update features based on requirements
  if (requirements.securityRequirements.some(req => req.domain === 'authentication')) {
    customized.features.push('auth', 'security');
  }

  if (requirements.businessRequirements.some(req => req.goal.toLowerCase().includes('ecommerce'))) {
    customized.features.push('ecommerce', 'payments');
  }

  if (requirements.performanceRequirements.some(req => req.metric === 'analytics')) {
    customized.features.push('analytics', 'dashboard');
  }

  // Update framework if specified
  if (options.framework) {
    customized.framework = options.framework;
  }

  // Update language if specified
  if (options.language) {
    customized.language = options.language;
  }

  // Update database if specified
  if (options.database) {
    customized.database = options.database;
  }

  // Update auth if specified
  if (options.auth) {
    customized.auth = options.auth;
  }

  // Update complexity based on requirements
  customized.complexity = requirements.estimatedComplexity;

  return customized;
}

/**
 * Generate template files
 */
async function generateFiles(
  template: Template,
  projectPath: string,
  context: {
    projectSpec: ProjectSpec;
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
    costAnalysis: CostAnalysis;
  }
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  // This would typically load template files from a template registry
  // For now, generate basic structure based on template

  // Generate main entry point
  const entryFile = {
    path: join(projectPath, 'src', 'index.ts'),
    content: generateEntryPoint(template, context),
    type: 'code' as const,
    description: 'Main application entry point'
  };
  files.push(entryFile);

  // Generate basic routes
  const routesFile = {
    path: join(projectPath, 'src', 'routes.ts'),
    content: generateRoutes(template, context),
    type: 'code' as const,
    description: 'Application routes and controllers'
  };
  files.push(routesFile);

  // Generate database schema
  if (template.database) {
    const schemaFile = {
      path: join(projectPath, 'src', 'schema.ts'),
      content: generateDatabaseSchema(template.database, context),
      type: 'code' as const,
      description: 'Database schema and migrations'
    };
    files.push(schemaFile);
  }

  // Generate authentication
  if (template.auth) {
    const authFile = {
      path: join(projectPath, 'src', 'auth.ts'),
      content: generateAuth(template.auth, context),
      type: 'code' as const,
      description: 'Authentication utilities and middleware'
    };
    files.push(authFile);
  }

  // Generate middleware
  const middlewareFile = {
    path: join(projectPath, 'src', 'middleware.ts'),
    content: generateMiddleware(template, context),
    type: 'code' as const,
    description: 'Application middleware'
  };
  files.push(middlewareFile);

  // Generate utilities
  const utilsFile = {
    path: join(projectPath, 'src', 'utils.ts'),
    content: generateUtils(template, context),
    type: 'code' as const,
    description: 'Utility functions and helpers'
  };
  files.push(utilsFile);

  return files;
}

/**
 * Generate project-specific files
 */
function generateProjectFiles(
  options: ProjectSpec & GenerateOptions,
  projectPath: string,
  context: {
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
    costAnalysis: CostAnalysis;
  }
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Generate README.md
  const readmeFile = {
    path: join(projectPath, 'README.md'),
    content: generateReadme(options, context),
    type: 'doc' as const,
    description: 'Project documentation'
  };
  files.push(readmeFile);

  // Generate environment variables template
  const envFile = {
    path: join(projectPath, '.env.example'),
    content: generateEnvTemplate(options, context),
    type: 'config' as const,
    description: 'Environment variables template'
  };
  files.push(envFile);

  // Generate Docker configuration
  const dockerFile = {
    path: join(projectPath, 'Dockerfile'),
    content: generateDockerfile(options, context),
    type: 'config' as const,
    description: 'Docker configuration'
  };
  files.push(dockerFile);

  // Generate Docker Compose
  const dockerComposeFile = {
    path: join(projectPath, 'docker-compose.yml'),
    content: generateDockerCompose(options, context),
    type: 'config' as const,
    description: 'Docker Compose configuration'
  };
  files.push(dockerComposeFile);

  return files;
}

/**
 * Generate configuration files
 */
function generateConfigurationFiles(
  options: ProjectSpec & GenerateOptions,
  projectPath: string,
  context: {
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
  }
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Generate wrangler.toml
  const wranglerFile = {
    path: join(projectPath, 'wrangler.toml'),
    content: generateWranglerToml(options, context),
    type: 'config' as const,
    description: 'Cloudflare Workers configuration'
  };
  files.push(wranglerFile);

  // Generate tsconfig.json
  const tsConfigFile = {
    path: join(projectPath, 'tsconfig.json'),
    content: generateTsConfig(),
    type: 'config' as const,
    description: 'TypeScript configuration'
  };
  files.push(tsConfigFile);

  // Generate gitignore
  const gitignoreFile = {
    path: join(projectPath, '.gitignore'),
    content: generateGitignore(),
    type: 'config' as const,
    description: 'Git ignore file'
  };
  files.push(gitignoreFile);

  return files;
}

/**
 * Generate script files
 */
function generateScriptFiles(
  options: ProjectSpec & GenerateOptions,
  projectPath: string
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Generate setup script
  const setupFile = {
    path: join(projectPath, 'scripts', 'setup.sh'),
    content: generateSetupScript(),
    type: 'script' as const,
    description: 'Project setup script'
  };
  files.push(setupFile);

  // Generate deploy script
  const deployFile = {
    path: join(projectPath, 'scripts', 'deploy.sh'),
    content: generateDeployScript(),
    type: 'script' as const,
    description: 'Deployment script'
  };
  files.push(deployFile);

  // Generate test script
  const testFile = {
    path: join(projectPath, 'scripts', 'test.sh'),
    content: generateTestScript(),
    type: 'script' as const,
    description: 'Test script'
  };
  files.push(testFile);

  return files;
}

/**
 * Generate documentation files
 */
function generateDocumentationFiles(
  options: ProjectSpec & GenerateOptions,
  projectPath: string,
  context: {
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
    costAnalysis: CostAnalysis;
  }
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Generate API documentation
  const apiDocFile = {
    path: join(projectPath, 'docs', 'api.md'),
    content: generateApiDocs(options, context),
    type: 'doc' as const,
    description: 'API documentation'
  };
  files.push(apiDocFile);

  // Generate architecture documentation
  const archDocFile = {
    path: join(projectPath, 'docs', 'architecture.md'),
    content: generateArchDocs(options, context),
    type: 'doc' as const,
    description: 'Architecture documentation'
  };
  files.push(archDocFile);

  // Generate deployment documentation
  const deployDocFile = {
    path: join(projectPath, 'docs', 'deployment.md'),
    content: generateDeployDocs(options, context),
    type: 'doc' as const,
    description: 'Deployment documentation'
  };
  files.push(deployDocFile);

  return files;
}

/**
 * Write files to disk
 */
function writeFilesToDisk(files: GeneratedFile[], projectPath: string): void {
  files.forEach(file => {
    const fullPath = join(projectPath, file.path);
    mkdirSync(fullPath, { recursive: true });
    writeFileSync(fullPath, file.content);
  });
}

/**
 * Initialize git repository
 */
async function initializeGit(projectPath: string): Promise<void> {
  // This would typically run git commands
  // For now, create a basic .gitignore
  const gitignoreContent = `
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Storybook build outputs
.out
.storybook-out
storybook-static/

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Cloudflare specific
.wrangler/
.wrangler/

# Wrangler
.wrangler/
`;

  const gitignorePath = join(projectPath, '.gitignore');
  writeFileSync(gitignorePath, gitignoreContent);
}

/**
 * Generate package.json
 */
function generatePackageJson(
  options: ProjectSpec & GenerateOptions,
  projectPath: string,
  context: {
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
    template: Template;
  }
): GeneratedFile {
  const packageJson = {
    name: sanitizeProjectName(options.name),
    version: '1.0.0',
    description: options.description,
    main: 'dist/index.js',
    module: 'dist/index.esm.js',
    types: 'dist/index.d.ts',
    scripts: {
      dev: 'wrangler dev',
      build: 'wrangler build',
      deploy: 'wrangler deploy',
      test: context.template.features.includes('testing') ? 'vitest' : 'echo "No tests configured"',
      lint: context.template.features.includes('linting') ? 'eslint .' : 'echo "No linting configured"',
      typecheck: context.template.features.includes('typeCheck') ? 'tsc --noEmit' : 'echo "No type checking configured"'
    },
    dependencies: context.template.dependencies,
    devDependencies: [
      'typescript',
      '@types/node',
      'wrangler',
      'vitest',
      '@vitest/coverage-v8',
      'eslint',
      '@typescript-eslint/parser',
      '@typescript-eslint/eslint-plugin'
    ],
    keywords: [
      'claudeflare',
      'cloudflare',
      'workers',
      'serverless',
      context.template.framework,
      options.type
    ],
    author: 'Generated by ClaudeFlare',
    license: 'MIT'
  };

  return {
    path: join(projectPath, 'package.json'),
    content: JSON.stringify(packageJson, null, 2),
    type: 'config' as const,
    description: 'Package configuration'
  };
}

/**
 * Generate wrangler config
 */
function generateWranglerConfig(
  options: ProjectSpec & GenerateOptions,
  projectPath: string,
  context: {
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
  }
): GeneratedFile {
  const wranglerConfig = {
    name: sanitizeProjectName(options.name),
    main: 'dist/index.js',
    compatibility_date: '2024-01-01',
    compatibility_flags: ['nodejs_compat'],
    env: {
      development: {
        vars: {
          ENVIRONMENT: 'development'
        }
      },
      production: {
        vars: {
          ENVIRONMENT: 'production'
        }
      }
    },
    triggers: [
      {
        cron: '0 0 * * *'
      }
    ],
    r2_buckets: [],
    kv_namespaces: [],
    d1_databases: []
  };

  // Add database bindings if needed
  if (context.architecture.services.some(s => s.type === 'database')) {
    wranglerConfig.d1_databases = [
      {
        binding: 'DB',
        database_name: `${sanitizeProjectName(options.name)}-db`,
        database_id: 'your-database-id'
      }
    ];
  }

  return {
    path: join(projectPath, 'wrangler.toml'),
    content: generateWranglerTomlContent(wranglerConfig),
    type: 'config' as const,
    description: 'Cloudflare Workers configuration'
  };
}

/**
 * Generate TypeScript config
 */
function generateTypeScriptConfig(
  options: ProjectSpec & GenerateOptions,
  projectPath: string
): GeneratedFile {
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022'],
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      noImplicitThis: true,
      alwaysStrict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      exactOptionalPropertyTypes: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      allowUnusedLabels: false,
      allowUnreachableCode: false,
      forceConsistentCasingInFileNames: true,
      esModuleInterop: true,
      skipLibCheck: true,
      useDefineForClassFields: true,
      importsNotUsedAsValues: 'error',
      allowJs: false,
      checkJs: false,
      jsx: 'react-jsx',
      reactNamespace: 'React'
    },
    include: [
      'src/**/*.ts',
      'src/**/*.tsx',
      'tests/**/*.ts',
      'tests/**/*.tsx'
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage'
    ]
  };

  return {
    path: join(projectPath, 'tsconfig.json'),
    content: JSON.stringify(tsConfig, null, 2),
    type: 'config' as const,
    description: 'TypeScript configuration'
  };
}

/**
 * Generate setup commands
 */
function generateSetupCommands(
  options: ProjectSpec & GenerateOptions,
  projectPath: string,
  context: {
    requirements: AnalysisResult;
    architecture: ArchitectureRecommendation;
  }
): string[] {
  const commands = [];

  commands.push(`cd ${projectPath}`);
  commands.push('npm install');
  commands.push('cp .env.example .env');
  commands.push('Edit .env with your configuration');
  commands.push('npm run dev');

  if (context.requirements.technicalRequirements.some(req => req.category === 'database')) {
    commands.push('Set up your database and update connection strings in .env');
  }

  return commands;
}

/**
 * Add warnings for potential issues
 */
function addWarnings(
  warnings: string[],
  options: ProjectSpec & GenerateOptions,
  requirements: AnalysisResult,
  architecture: ArchitectureRecommendation,
  costAnalysis: CostAnalysis
): void {
  // Cost warnings
  if (costAnalysis.monthly.total > 100) {
    warnings.push(`High monthly cost detected: $${costAnalysis.monthly.total.toFixed(2)}/month`);
  }

  // Complexity warnings
  if (requirements.estimatedComplexity === 'very-high') {
    warnings.push('Very high complexity project - consider breaking into smaller components');
  }

  // Security warnings
  if (requirements.securityRequirements.some(req => req.priority === 'critical')) {
    warnings.push('Critical security requirements identified - ensure proper security review');
  }

  // Timeline warnings
  if (requirements.estimatedTimeline.includes('weeks') && parseInt(requirements.estimatedTimeline) > 8) {
    warnings.push('Estimated timeline is long - consider prioritizing features for MVP');
  }
}

// Content generation functions (simplified implementations)
function generateEntryPoint(template: Template, context: any): string {
  return `import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { routes } from './routes';
import { authMiddleware } from './middleware';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());
app.use('/api/*', authMiddleware);

// Routes
app.route('/', routes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;`;
}

function generateRoutes(template: Template, context: any): string {
  return `import { Hono } from 'hono';

const routes = new Hono();

// Basic routes
routes.get('/', (c) => {
  return c.json({ message: 'Welcome to your ClaudeFlare application!' });
});

export { routes };`;
}

function generateDatabaseSchema(database: string, context: any): string {
  return `// Database schema for ${database}
// This file will be populated based on your specific requirements

export const schema = {
  // Add your database schema here
};`;
}

function generateAuth(auth: string, context: any): string {
  return `// Authentication utilities for ${auth}
// This file will be populated based on your specific requirements

export const authMiddleware = async (c, next) => {
  // Add your authentication logic here
  await next();
};`;
}

function generateMiddleware(template: Template, context: any): string {
  return `import { authMiddleware } from './auth';

export { authMiddleware };`;
}

function generateUtils(template: Template, context: any): string {
  return `// Utility functions
// This file will be populated based on your specific requirements

export const utils = {
  // Add your utility functions here
};`;
}

function generateReadme(options: ProjectSpec & GenerateOptions, context: any): string {
  return `# ${options.name}

${options.description}

## Features

${context.architecture.technologies.map(tech => `- ${tech.name}`).join('\n')}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Development

This project was generated using ClaudeFlare Application Factory.

## Architecture

${context.architecture.patterns.join(', ')}
`;
}

function generateEnvTemplate(options: ProjectSpec & GenerateOptions, context: any): string {
  return `# Environment Variables
# Copy this file to .env and fill in your values

# Cloudflare
CF_ACCOUNT_ID=your-account-id
CF_ZONE_ID=your-zone-id
CF_API_TOKEN=your-api-token

# Database
DATABASE_URL=your-database-url

# Authentication
JWT_SECRET=your-jwt-secret

# Application
ENVIRONMENT=development
`;
}

function generateDockerfile(options: ProjectSpec & GenerateOptions, context: any): string {
  return `# Dockerfile for Cloudflare Workers
# Note: Workers run on Cloudflare's infrastructure, not Docker
# This is provided for local development only

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8787

CMD ["npm", "run", "dev"]
`;
}

function generateDockerCompose(options: ProjectSpec & GenerateOptions, context: any): string {
  return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8787:8787"
    environment:
      - ENVIRONMENT=development
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.env
`;
}

function generateWranglerToml(options: ProjectSpec & GenerateOptions, context: any): string {
  return `name = "${sanitizeProjectName(options.name)}"
main = "dist/index.js"
compatibility_date = "2024-01-01"

[env.development]
vars = { ENVIRONMENT = "development" }

[env.production]
vars = { ENVIRONMENT = "production" }
`;
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      declaration: true,
      outDir: "./dist",
      rootDir: "./src",
      strict: true
    },
    include: ["src/**/*.ts"]
  }, null, 2);
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build outputs
dist/
build/

# Environment files
.env
.env.local

# Logs
*.log

# Coverage
coverage/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Wrangler
.wrangler/
`;
}

function generateSetupScript(): string {
  return `#!/bin/bash
# Setup script for ClaudeFlare project

echo "Setting up ${name}..."

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

echo "Setup complete!"
echo "Don't forget to edit .env with your configuration"
echo "Run 'npm run dev' to start the development server"
`;
}

function generateDeployScript(): string {
  return `#!/bin/bash
# Deployment script

echo "Deploying ${name}..."

# Build the project
npm run build

# Deploy to Cloudflare
npm run deploy

echo "Deployment complete!"
`;
}

function generateTestScript(): string {
  return `#!/bin/bash
# Test script

echo "Running tests..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    npm install
fi

# Run tests
npm test

echo "Tests complete!"
`;
}

function generateApiDocs(options: ProjectSpec & GenerateOptions, context: any): string {
  return `# API Documentation

## Overview

This document describes the API for ${options.name}.

## Authentication

All API endpoints require authentication via Bearer token.

## Endpoints

### Health Check

GET /health

Returns the health status of the application.

\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

## Rate Limiting

API requests are rate limited to 1000 requests per minute.

## Error Responses

All error responses follow this format:

\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`
`;
}

function generateArchDocs(options: ProjectSpec & GenerateOptions, context: any): string {
  return `# Architecture Documentation

## System Overview

${options.name} is a Cloudflare Workers-based application built with the following architecture:

## Components

${context.architecture.services.map(service => `
### ${service.name}
- **Type**: ${service.type}
- **Purpose**: ${service.purpose}
- **Technologies**: ${service.technologies.join(', ')}
`).join('\n')}

## Patterns

${context.architecture.patterns.map(pattern => `- ${pattern}`).join('\n')}

## Scalability

The application is designed to scale horizontally using Cloudflare's serverless infrastructure.

## Security

Security is implemented at multiple layers:
- Authentication and authorization
- Input validation
- HTTPS enforcement
- Rate limiting
`;
}

function generateDeployDocs(options: ProjectSpec & GenerateOptions, context: any): string {
  return `# Deployment Documentation

## Prerequisites

- Cloudflare account
- Wrangler CLI installed
- API token with appropriate permissions

## Local Development

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Production Deployment

1. Build the project:
   \`\`\`bash
   npm run build
   \`\`\`

2. Deploy to Cloudflare:
   \`\`\`bash
   npm run deploy
   \`\`\`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| CF_ACCOUNT_ID | Cloudflare account ID | Yes |
| CF_ZONE_ID | Cloudflare zone ID | Yes |
| CF_API_TOKEN | Cloudflare API token | Yes |
| DATABASE_URL | Database connection URL | Yes |
| JWT_SECRET | JWT signing secret | Yes |

## Monitoring

Application logs can be viewed in the Cloudflare dashboard.
`;
}

function generateWranglerTomlContent(config: any): string {
  return `[name]
main = "${config.main}"
compatibility_date = "${config.compatibility_date}"

[env.development]
vars = { ENVIRONMENT = "development" }

[env.production]
vars = { ENVIRONMENT = "production" }

${config.triggers ? `[[triggers.crons]]
cron = "${config.triggers[0].cron}"` : ''}

${config.r2_buckets ? `[[r2_buckets]]
binding = "${config.r2_buckets[0].binding}"
bucket_name = "${config.r2_buckets[0].database_name}"` : ''}

${config.kv_namespaces ? `[[kv_namespaces]]
binding = "${config.kv_namespaces[0].binding}"
id = "${config.kv_namespaces[0].id}"` : ''}

${config.d1_databases ? `[[d1_databases]]
binding = "${config.d1_databases[0].binding}"
database_name = "${config.d1_databases[0].database_name}"
database_id = "${config.d1_databases[0].database_id}"` : ''}
`;
}