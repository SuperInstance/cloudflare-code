/**
 * Integration Testing Framework - Service orchestration and environment setup
 */

import type {
  ServiceConfig,
  TestEnvironment,
  TestLevel,
  TestFunction,
  TestContext,
  TestMetadata,
  KVNamespaceMock,
  R2BucketMock,
  D1DatabaseMock,
  DurableObjectMock,
} from '../types/index.js';
import { kvMockFactory, r2MockFactory, d1MockFactory, durableObjectMockFactory } from '../mocking/factory.js';

// ============================================================================
// Service Configuration
// ============================================================================

export interface WorkerServiceConfig extends ServiceConfig {
  type: 'worker';
  entrypoint?: string;
  bindings?: Record<string, unknown>;
  env?: Record<string, string>;
}

export interface KVServiceConfig extends ServiceConfig {
  type: 'kv';
  namespace?: string;
  mock?: boolean;
}

export interface R2ServiceConfig extends ServiceConfig {
  type: 'r2';
  bucket?: string;
  mock?: boolean;
}

export interface D1ServiceConfig extends ServiceConfig {
  type: 'd1';
  database?: string;
  mock?: boolean;
  schema?: string;
}

export interface DurableObjectServiceConfig extends ServiceConfig {
  type: 'durable-object';
  className?: string;
  scriptName?: string;
  mock?: boolean;
}

export type AnyServiceConfig =
  | WorkerServiceConfig
  | KVServiceConfig
  | R2ServiceConfig
  | D1ServiceConfig
  | DurableObjectServiceConfig;

// ============================================================================
// Service Factory
// ============================================================================

export class ServiceFactory {
  private services = new Map<string, unknown>();
  private configs = new Map<string, AnyServiceConfig>();

  async create(config: AnyServiceConfig): Promise<unknown> {
    this.configs.set(config.name, config);

    switch (config.type) {
      case 'kv':
        return this.createKV(config as KVServiceConfig);
      case 'r2':
        return this.createR2(config as R2ServiceConfig);
      case 'd1':
        return this.createD1(config as D1ServiceConfig);
      case 'durable-object':
        return this.createDurableObject(config as DurableObjectServiceConfig);
      case 'worker':
        return this.createWorker(config as WorkerServiceConfig);
      default:
        throw new Error(`Unknown service type: ${(config as any).type}`);
    }
  }

  private async createKV(config: KVServiceConfig): Promise<KVNamespaceMock> {
    const kv = kvMockFactory.create();
    this.services.set(config.name, kv);
    return kv;
  }

  private async createR2(config: R2ServiceConfig): Promise<R2BucketMock> {
    const r2 = r2MockFactory.create();
    this.services.set(config.name, r2);
    return r2;
  }

  private async createD1(config: D1ServiceConfig): Promise<D1DatabaseMock> {
    const d1 = d1MockFactory.create();
    this.services.set(config.name, d1);

    // Run schema if provided
    if (config.schema) {
      await this.runSchema(d1, config.schema);
    }

    return d1;
  }

  private async createDurableObject(config: DurableObjectServiceConfig): Promise<DurableObjectMock> {
    const doMock = durableObjectMockFactory.create(config.name);
    this.services.set(config.name, doMock);
    return doMock;
  }

  private async createWorker(config: WorkerServiceConfig): Promise<unknown> {
    // Create a mock worker instance
    const worker = {
      fetch: async (req: Request) => new Response('OK'),
      scheduled: async (event: ScheduledEvent) => {},
      queue: async (event: QueueEvent) => {},
    };

    // Add bindings
    if (config.bindings) {
      for (const [name, binding] of Object.entries(config.bindings)) {
        (worker as Record<string, unknown>)[name] = binding;
      }
    }

    this.services.set(config.name, worker);
    return worker;
  }

  private async runSchema(d1: D1DatabaseMock, schema: string): Promise<void> {
    // Simple SQL execution for schema setup
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      await d1.exec(stmt);
    }
  }

  get<T = unknown>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  async destroy(name: string): Promise<void> {
    this.services.delete(name);
    this.configs.delete(name);
  }

  async destroyAll(): Promise<void> {
    this.services.clear();
    this.configs.clear();
  }

  getConfig(name: string): AnyServiceConfig | undefined {
    return this.configs.get(name);
  }

  listConfigs(): AnyServiceConfig[] {
    return Array.from(this.configs.values());
  }
}

// ============================================================================
// Environment Setup
// ============================================================================

export interface EnvironmentConfig {
  name: string;
  services: AnyServiceConfig[];
  env?: Record<string, string>;
  bindings?: Record<string, unknown>;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export class TestEnvironmentImpl implements TestEnvironment {
  readonly name: string;
  readonly services: Map<string, unknown>;
  readonly env: Record<string, string>;
  readonly bindings: Record<string, unknown>;
  private factory: ServiceFactory;
  private setupHook?: () => Promise<void>;
  private teardownHook?: () => Promise<void>;
  private initialized = false;

  constructor(config: EnvironmentConfig) {
    this.name = config.name;
    this.services = new Map();
    this.env = { ...config.env };
    this.bindings = { ...config.bindings };
    this.factory = new ServiceFactory();
    this.setupHook = config.setup;
    this.teardownHook = config.teardown;
  }

  async setup(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Apply environment variables
    for (const [key, value] of Object.entries(this.env)) {
      process.env[key] = value;
    }

    // Create services
    const configs = this.factory.listConfigs();
    for (const config of configs) {
      await this.factory.create(config);
    }

    // Run setup hook
    if (this.setupHook) {
      await this.setupHook();
    }

    this.initialized = true;
  }

  async teardown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Run teardown hook
    if (this.teardownHook) {
      await this.teardownHook();
    }

    // Destroy all services
    await this.factory.destroyAll();

    // Clear environment variables
    for (const key of Object.keys(this.env)) {
      delete process.env[key];
    }

    this.initialized = false;
  }

  getService<T = unknown>(name: string): T {
    const service = this.factory.get<T>(name);
    if (!service) {
      throw new Error(`Service "${name}" not found in environment`);
    }
    return service;
  }

  getBinding<T = unknown>(name: string): T {
    const binding = this.bindings[name];
    if (binding === undefined) {
      throw new Error(`Binding "${name}" not found in environment`);
    }
    return binding as T;
  }

  async addService(config: AnyServiceConfig): Promise<void> {
    const service = await this.factory.create(config);
    this.services.set(config.name, service);
  }

  async removeService(name: string): Promise<void> {
    await this.factory.destroy(name);
    this.services.delete(name);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Database Seeding
// ============================================================================

export interface SeedConfig {
  tableName: string;
  data: Record<string, unknown>[];
  truncate?: boolean;
}

export class DatabaseSeeder {
  private seeds = new Map<string, SeedConfig[]>();

  register(dbName: string, seeds: SeedConfig[]): void {
    this.seeds.set(dbName, seeds);
  }

  async seed(dbName: string, d1: D1DatabaseMock): Promise<void> {
    const seeds = this.seeds.get(dbName);
    if (!seeds) {
      throw new Error(`No seeds found for database "${dbName}"`);
    }

    for (const seed of seeds) {
      await this.seedTable(d1, seed);
    }
  }

  private async seedTable(d1: D1DatabaseMock, seed: SeedConfig): Promise<void> {
    // Truncate table if requested
    if (seed.truncate) {
      await d1.exec(`DELETE FROM ${seed.tableName}`);
    }

    // Insert data
    for (const row of seed.data) {
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = values.map(() => '?').join(', ');

      const query = `INSERT INTO ${seed.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      const stmt = d1.prepare(query);
      await stmt.bind(...values).run();
    }
  }

  async clear(dbName: string, d1: D1DatabaseMock): Promise<void> {
    const seeds = this.seeds.get(dbName);
    if (!seeds) {
      return;
    }

    for (const seed of seeds) {
      await d1.exec(`DELETE FROM ${seed.tableName}`);
    }
  }

  clearAll(): void {
    this.seeds.clear();
  }
}

// ============================================================================
// API Testing Utilities
// ============================================================================

export interface APITestOptions {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class APITester {
  private options: APITestOptions;

  constructor(options: APITestOptions) {
    this.options = options;
  }

  async get(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.options.baseURL}${path}`;
    const init: RequestInit = {
      method: 'GET',
      headers: {
        ...this.options.headers,
        ...options?.headers,
      },
      ...options,
    };

    return this.fetchWithTimeout(url, init);
  }

  async post(path: string, body?: unknown, options?: RequestInit): Promise<Response> {
    const url = `${this.options.baseURL}${path}`;
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
        ...options?.headers,
      },
      body: JSON.stringify(body),
      ...options,
    };

    return this.fetchWithTimeout(url, init);
  }

  async put(path: string, body?: unknown, options?: RequestInit): Promise<Response> {
    const url = `${this.options.baseURL}${path}`;
    const init: RequestInit = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
        ...options?.headers,
      },
      body: JSON.stringify(body),
      ...options,
    };

    return this.fetchWithTimeout(url, init);
  }

  async patch(path: string, body?: unknown, options?: RequestInit): Promise<Response> {
    const url = `${this.options.baseURL}${path}`;
    const init: RequestInit = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
        ...options?.headers,
      },
      body: JSON.stringify(body),
      ...options,
    };

    return this.fetchWithTimeout(url, init);
  }

  async delete(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.options.baseURL}${path}`;
    const init: RequestInit = {
      method: 'DELETE',
      headers: {
        ...this.options.headers,
        ...options?.headers,
      },
      ...options,
    };

    return this.fetchWithTimeout(url, init);
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const timeout = this.options.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async getJSON<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    const response = await this.get(path, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async postJSON<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const response = await this.post(path, body, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}

// ============================================================================
// Workflow Testing
// ============================================================================

export interface WorkflowStep {
  name: string;
  execute: (ctx: WorkflowContext) => Promise<void> | void;
  assert?: (ctx: WorkflowContext) => void | Promise<void>;
  timeout?: number;
}

export interface WorkflowContext {
  services: Map<string, unknown>;
  state: Map<string, unknown>;
  steps: WorkflowStep[];
  currentStep?: number;
  results: Map<string, unknown>;
}

export class WorkflowRunner {
  private steps: WorkflowStep[] = [];

  addStep(step: WorkflowStep): this {
    this.steps.push(step);
    return this;
  }

  async run(services: Map<string, unknown>): Promise<WorkflowContext> {
    const context: WorkflowContext = {
      services,
      state: new Map(),
      steps: this.steps,
      results: new Map(),
    };

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      context.currentStep = i;

      try {
        // Execute step with timeout
        const timeout = step.timeout || 5000;
        await Promise.race([
          step.execute(context),
          this.createTimeout(timeout, step.name),
        ]);

        // Run assertions
        if (step.assert) {
          await step.assert(context);
        }

        context.results.set(step.name, { success: true });
      } catch (error) {
        context.results.set(step.name, { success: false, error });
        throw new Error(`Workflow step "${step.name}" failed: ${error}`);
      }
    }

    return context;
  }

  private createTimeout(ms: number, stepName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step "${stepName}" timed out after ${ms}ms`)), ms);
    });
  }

  reset(): void {
    this.steps = [];
  }
}

// ============================================================================
// Integration Test Builder
// ============================================================================>

export class IntegrationTestBuilder {
  private config: EnvironmentConfig;
  private seeder = new DatabaseSeeder();
  private tests: Array<{ name: string; fn: TestFunction }> = [];

  constructor(name: string) {
    this.config = {
      name,
      services: [],
      env: {},
      bindings: {},
    };
  }

  addService(config: AnyServiceConfig): this {
    this.config.services.push(config);
    return this;
  }

  addKV(name: string): this {
    return this.addService({ type: 'kv', name });
  }

  addR2(name: string): this {
    return this.addService({ type: 'r2', name });
  }

  addD1(name: string, schema?: string): this {
    return this.addService({ type: 'd1', name, schema });
  }

  addDurableObject(name: string): this {
    return this.addService({ type: 'durable-object', name });
  }

  addWorker(name: string, bindings?: Record<string, unknown>): this {
    return this.addService({ type: 'worker', name, bindings });
  }

  setEnv(env: Record<string, string>): this {
    this.config.env = { ...this.config.env, ...env };
    return this;
  }

  setBindings(bindings: Record<string, unknown>): this {
    this.config.bindings = { ...this.config.bindings, ...bindings };
    return this;
  }

  setSetup(fn: () => Promise<void>): this {
    this.config.setup = fn;
    return this;
  }

  setTeardown(fn: () => Promise<void>): this {
    this.config.teardown = fn;
    return this;
  }

  addSeeds(dbName: string, seeds: SeedConfig[]): this {
    this.seeder.register(dbName, seeds);
    return this;
  }

  addTest(name: string, fn: TestFunction): this {
    this.tests.push({ name, fn });
    return this;
  }

  async build(): Promise<TestEnvironmentImpl> {
    const env = new TestEnvironmentImpl(this.config);

    // Setup environment
    await env.setup();

    return env;
  }

  async run(): Promise<void> {
    const env = await this.build();

    try {
      for (const test of this.tests) {
        await test.fn({
          metadata: {} as TestMetadata,
          expect: global.expect,
          skip: () => {},
          only: () => {},
        } as TestContext);
      }
    } finally {
      await env.teardown();
    }
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  getSeeder(): DatabaseSeeder {
    return this.seeder;
  }
}

// ============================================================================
// Distributed System Testing
// ============================================================================

export interface DistributedSystemConfig {
  nodes: Array<{
    name: string;
    services: AnyServiceConfig[];
  }>;
  connections: Array<{
    from: string;
    to: string;
    type: 'rpc' | 'messaging' | 'streaming';
  }>;
}

export class DistributedSystemTester {
  private environments = new Map<string, TestEnvironmentImpl>();

  async setup(config: DistributedSystemConfig): Promise<void> {
    // Create all environments
    for (const node of config.nodes) {
      const envConfig: EnvironmentConfig = {
        name: node.name,
        services: node.services,
        env: {},
        bindings: {},
      };

      const env = new TestEnvironmentImpl(envConfig);
      await env.setup();
      this.environments.set(node.name, env);
    }

    // Setup connections
    for (const connection of config.connections) {
      await this.setupConnection(connection);
    }
  }

  private async setupConnection(connection: {
    from: string;
    to: string;
    type: 'rpc' | 'messaging' | 'streaming';
  }): Promise<void> {
    const fromEnv = this.environments.get(connection.from);
    const toEnv = this.environments.get(connection.to);

    if (!fromEnv || !toEnv) {
      throw new Error(`Environment not found for connection ${connection.from} -> ${connection.to}`);
    }

    // Create connection based on type
    switch (connection.type) {
      case 'rpc':
        // Setup RPC binding
        fromEnv.bindings[`rpc_${connection.to}`] = {
          call: async (method: string, ...args: unknown[]) => {
            const service = toEnv.services.get(method);
            if (typeof service === 'function') {
              return service(...args);
            }
            throw new Error(`RPC method "${method}" not found`);
          },
        };
        break;

      case 'messaging':
        // Setup message queue binding
        fromEnv.bindings[`queue_${connection.to}`] = {
          send: async (message: unknown) => {
            const queue = toEnv.services.get('queue') as any;
            if (queue) {
              queue.push(message);
            }
          },
        };
        break;

      case 'streaming':
        // Setup streaming binding
        fromEnv.bindings[`stream_${connection.to}`] = {
          write: async (data: unknown) => {
            const stream = toEnv.services.get('stream') as any;
            if (stream) {
              stream.push(data);
            }
          },
        };
        break;
    }
  }

  async teardown(): Promise<void> {
    for (const env of this.environments.values()) {
      await env.teardown();
    }
    this.environments.clear();
  }

  getEnvironment(name: string): TestEnvironmentImpl {
    const env = this.environments.get(name);
    if (!env) {
      throw new Error(`Environment "${name}" not found`);
    }
    return env;
  }

  async simulateNetworkPartition(node1: string, node2: string): Promise<void> {
    const env1 = this.getEnvironment(node1);
    const env2 = this.getEnvironment(node2);

    // Remove RPC bindings
    delete env1.bindings[`rpc_${node2}`];
    delete env2.bindings[`rpc_${node1}`];
  }

  async healNetworkPartition(node1: string, node2: string): Promise<void> {
    const env1 = this.getEnvironment(node1);
    const env2 = this.getEnvironment(node2);

    // Restore RPC bindings
    env1.bindings[`rpc_${node2}`] = {
      call: async (method: string, ...args: unknown[]) => {
        const service = env2.services.get(method);
        if (typeof service === 'function') {
          return service(...args);
        }
        throw new Error(`RPC method "${method}" not found`);
      },
    };

    env2.bindings[`rpc_${node1}`] = {
      call: async (method: string, ...args: unknown[]) => {
        const service = env1.services.get(method);
        if (typeof service === 'function') {
          return service(...args);
        }
        throw new Error(`RPC method "${method}" not found`);
      },
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const serviceFactory = new ServiceFactory();
export const databaseSeeder = new DatabaseSeeder();
export const workflowRunner = new WorkflowRunner();
export const distributedSystemTester = new DistributedSystemTester();

export function createIntegrationTest(name: string): IntegrationTestBuilder {
  return new IntegrationTestBuilder(name);
}

export function createAPITester(options: APITestOptions): APITester {
  return new APITester(options);
}
