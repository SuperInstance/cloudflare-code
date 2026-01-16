// @ts-nocheck
/**
 * New Command
 *
 * Create a new resource (worker, route, middleware, etc.)
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { createLogger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';

const logger = createLogger('new');

export interface NewOptions {
  type?: string;
  name?: string;
  path?: string;
}

export function registerNewCommand(program: Command): void {
  program
    .command('new [type] [name]')
    .description('Create a new resource')
    .option('-t, --type <type>', 'Type of resource (worker, route, middleware, controller)')
    .option('-n, --name <name>', 'Name of the resource')
    .option('-p, --path <path>', 'Path for the resource')
    .action(async (type?: string, name?: string, options?: NewOptions) => {
      try {
        await handleNew(type, name, options);
      } catch (error) {
        logger.error('Failed to create resource:', error);
        process.exit(1);
      }
    });
}

async function handleNew(
  typeArg?: string,
  nameArg?: string,
  options?: NewOptions
): Promise<void> {
  const type = typeArg || options?.type;

  if (!type) {
    logger.error('Resource type is required');
    logger.info('Usage: claudeflare new <type> <name>');
    logger.info('');
    logger.info('Available types:');
    logger.info('  worker      - Create a new Cloudflare Worker');
    logger.info('  route       - Create a new route handler');
    logger.info('  middleware  - Create middleware');
    logger.info('  controller  - Create a controller');
    logger.info('  service     - Create a service');
    logger.info('  model       - Create a data model');
    return;
  }

  const name = nameArg || options?.name;

  if (!name) {
    logger.error('Resource name is required');
    logger.info(`Usage: claudeflare new ${type} <name>`);
    return;
  }

  const spinner = createSpinner(`Creating ${type}: ${name}`);

  try {
    switch (type.toLowerCase()) {
      case 'worker':
        await createWorker(name, options?.path);
        break;
      case 'route':
        await createRoute(name, options?.path);
        break;
      case 'middleware':
        await createMiddleware(name, options?.path);
        break;
      case 'controller':
        await createController(name, options?.path);
        break;
      case 'service':
        await createService(name, options?.path);
        break;
      case 'model':
        await createModel(name, options?.path);
        break;
      default:
        spinner.fail(`Unknown resource type: ${type}`);
        logger.info('Available types: worker, route, middleware, controller, service, model');
        return;
    }

    spinner.succeed(`Created ${type}: ${name}`);
  } catch (error) {
    spinner.fail(`Failed to create ${type}`);
    throw error;
  }
}

async function createWorker(name: string, basePath?: string): Promise<void> {
  const dir = join(process.cwd(), basePath || 'src/workers');
  await fs.mkdir(dir, { recursive: true });

  const fileName = toKebabCase(name);
  const filePath = join(dir, `${fileName}.ts`);

  const content = `/**
 * ${name} Worker
 */

import { Router } from '@claudeflare/edge';

export interface Env {
  // Add your environment variables here
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const router = new Router<Env>();

    router.get('/', () => {
      return new Response(JSON.stringify({
        message: '${name} worker is running',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    return router.handle(request, env, ctx);
  },
};
`;

  await fs.writeFile(filePath, content);

  logger.info('');
  logger.info(chalk.cyan('Next steps:'));
  logger.info(`  1. Add your worker to wrangler.toml`);
  logger.info(`  2. Deploy with: claudeflare deploy --worker ${fileName}`);
}

async function createRoute(name: string, basePath?: string): Promise<void> {
  const dir = join(process.cwd(), basePath || 'src/routes');
  await fs.mkdir(dir, { recursive: true });

  const fileName = toKebabCase(name);
  const filePath = join(dir, `${fileName}.ts`);

  const content = `/**
 * ${name} Route
 */

import { Hono } from 'hono';
import { z } from 'zod';

export const route = new Hono();

// GET /${toKebabCase(name)}
route.get('/', (c) => {
  return c.json({
    message: '${name} route',
  });
});

// GET /${toKebabCase(name(name)}/:id
route.get('/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    id,
    message: '${name} details',
  });
});

// POST /${toKebabCase(name)}
const schema = z.object({
  name: z.string(),
  value: z.string(),
});

route.post('/', async (c) => {
  const body = await c.req.json();
  const validated = schema.parse(body);

  return c.json({
    message: '${name} created',
    data: validated,
  }, 201);
});
`;

  await fs.writeFile(filePath, content);

  logger.info('');
  logger.info(chalk.cyan('Next steps:'));
  logger.info(`  1. Import and register this route in your main worker`);
  logger.info(`     import { route as ${camelCase(name)} } from './routes/${fileName}';`);
}

async function createMiddleware(name: string, basePath?: string): Promise<void> {
  const dir = join(process.cwd(), basePath || 'src/middleware');
  await fs.mkdir(dir, { recursive: true });

  const fileName = toKebabCase(name);
  const filePath = join(dir, `${fileName}.ts`);

  const content = `/**
 * ${name} Middleware
 */

import { Context, Next } from 'hono';

export interface Env {
  // Add your environment variables here
}

export async function ${camelCase(name)}(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response> {
  // Before handler
  const start = Date.now();

  await next();

  // After handler
  const duration = Date.now() - start;

  c.header('X-${kebabCase(name)}-Duration', String(duration));
  return c.json({});
}
`;

  await fs.writeFile(filePath, content);

  logger.info('');
  logger.info(chalk.cyan('Next steps:'));
  logger.info(`  1. Import and use this middleware in your routes`);
  logger.info(`     import { ${camelCase(name)} } from './middleware/${fileName}';`);
}

async function createController(name: string, basePath?: string): Promise<void> {
  const dir = join(process.cwd(), basePath || 'src/controllers');
  await fs.mkdir(dir, { recursive: true });

  const fileName = toKebabCase(name);
  const className = `${name}Controller`;
  const filePath = join(dir, `${fileName}.ts`);

  const content = `/**
 * ${name} Controller
 */

import { Hono } from 'hono';

export class ${className} {
  constructor(private app: Hono) {
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.app.get('/${toKebabCase(name)}', this.index.bind(this));
    this.app.get('/${toKebabCase(name)}/:id', this.show.bind(this));
    this.app.post('/${toKebabCase(name)}', this.create.bind(this));
    this.app.put('/${toKebabCase(name)}/:id', this.update.bind(this));
    this.app.delete('/${toKebabCase(name)}/:id', this.delete.bind(this));
  }

  private async index(c: any): Promise<Response> {
    return c.json({
      message: 'List of ${toKebabCase(name)}',
      data: [],
    });
  }

  private async show(c: any): Promise<Response> {
    const id = c.req.param('id');
    return c.json({
      id,
      message: '${name} details',
    });
  }

  private async create(c: any): Promise<Response> {
    const body = await c.req.json();
    return c.json({
      message: '${name} created',
      data: body,
    }, 201);
  }

  private async update(c: any): Promise<Response> {
    const id = c.req.param('id');
    const body = await c.req.json();
    return c.json({
      id,
      message: '${name} updated',
      data: body,
    });
  }

  private async delete(c: any): Promise<Response> {
    const id = c.req.param('id');
    return c.json({
      id,
      message: '${name} deleted',
    });
  }
}
`;

  await fs.writeFile(filePath, content);

  logger.info('');
  logger.info(chalk.cyan('Next steps:'));
  logger.info(`  1. Instantiate the controller in your main worker`);
  logger.info(`     new ${className}(app);`);
}

async function createService(name: string, basePath?: string): Promise<void> {
  const dir = join(process.cwd(), basePath || 'src/services');
  await fs.mkdir(dir, { recursive: true });

  const fileName = toKebabCase(name);
  const className = `${name}Service`;
  const filePath = join(dir, `${fileName}.ts`);

  const content = `/**
 * ${name} Service
 */

export interface ${name}Model {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ${className} {
  /**
   * Find all items
   */
  async findAll(): Promise<${name}Model[]> {
    // Implement your logic here
    return [];
  }

  /**
   * Find item by ID
   */
  async findById(id: string): Promise<${name}Model | null> {
    // Implement your logic here
    return null;
  }

  /**
   * Create new item
   */
  async create(data: Partial<${name}Model>): Promise<${name}Model> {
    // Implement your logic here
    return {
      id: generateId(),
      name: data.name || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update item
   */
  async update(id: string, data: Partial<${name}Model>): Promise<${name}Model | null> {
    // Implement your logic here
    return null;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<boolean> {
    // Implement your logic here
    return true;
  }
}

function generateId(): string {
  return crypto.randomUUID();
}
`;

  await fs.writeFile(filePath, content);

  logger.info('');
  logger.info(chalk.cyan('Next steps:'));
  logger.info(`  1. Use this service in your controllers or routes`);
}

async function createModel(name: string, basePath?: string): Promise<void> {
  const dir = join(process.cwd(), basePath || 'src/models');
  await fs.mkdir(dir, { recursive: true });

  const fileName = toKebabCase(name);
  const filePath = join(dir, `${fileName}.ts`);

  const content = `/**
 * ${name} Model
 */

export interface ${name} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${name}Input {
  // Add your input fields here
}

export interface Update${name}Input {
  // Add your input fields here
}

export class ${name}Model {
  /**
   * Validate input
   */
  static validateCreate(input: unknown): Create${name}Input {
    // Add validation logic here
    return input as Create${name}Input;
  }

  /**
   * Validate update
   */
  static validateUpdate(input: unknown): Update${name}Input {
    // Add validation logic here
    return input as Update${name}Input;
  }
}
`;

  await fs.writeFile(filePath, content);
}

// Utility functions

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function camelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toLowerCase());
}
