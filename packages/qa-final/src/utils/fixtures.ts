/**
 * Test fixtures for QA framework
 */

import { Page, APIRequestContext } from '@playwright/test';
import { DataMockGenerator } from './mocks';
import { generateTestEmail, generateTestUsername, generateTestPassword } from './test-helpers';

/**
 * User fixture
 */
export interface UserFixture {
  id: string;
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: string;
}

/**
 * Project fixture
 */
export interface ProjectFixture {
  id: string;
  name: string;
  description: string;
  owner: string;
  visibility: 'public' | 'private';
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

/**
 * Session fixture
 */
export interface SessionFixture {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * File fixture
 */
export interface FileFixture {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  url: string;
  createdAt: string;
}

/**
 * Webhook fixture
 */
export interface WebhookFixture {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

/**
 * Fixture manager
 */
export class FixtureManager {
  private fixtures = new Map<string, unknown>();

  /**
   * Create a user fixture
   */
  createUser(overrides: Partial<UserFixture> = {}): UserFixture {
    const password = generateTestPassword();

    const user: UserFixture = {
      id: `user-${Date.now()}`,
      email: generateTestEmail(),
      username: generateTestUsername(),
      password,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      createdAt: new Date().toISOString(),
      ...overrides
    };

    this.fixtures.set(`user:${user.id}`, user);
    this.fixtures.set(`user:current`, user);
    return user;
  }

  /**
   * Create an admin user fixture
   */
  createAdminUser(overrides: Partial<UserFixture> = {}): UserFixture {
    return this.createUser({
      role: 'admin',
      ...overrides
    });
  }

  /**
   * Create a project fixture
   */
  createProject(overrides: Partial<ProjectFixture> = {}): ProjectFixture {
    const project: ProjectFixture = {
      id: `project-${Date.now()}`,
      name: 'Test Project',
      description: 'A test project for QA',
      owner: 'user-123',
      visibility: 'private',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    this.fixtures.set(`project:${project.id}`, project);
    return project;
  }

  /**
   * Create a session fixture
   */
  createSession(userId: string, overrides: Partial<SessionFixture> = {}): SessionFixture {
    const session: SessionFixture = {
      id: `session-${Date.now()}`,
      userId,
      token: `token-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      refreshToken: `refresh-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      ...overrides
    };

    this.fixtures.set(`session:${session.id}`, session);
    this.fixtures.set(`session:current`, session);
    return session;
  }

  /**
   * Create a file fixture
   */
  createFile(overrides: Partial<FileFixture> = {}): FileFixture {
    const file: FileFixture = {
      id: `file-${Date.now()}`,
      name: 'test-file.txt',
      size: 1024,
      type: 'text/plain',
      content: 'This is a test file content.',
      url: `https://example.com/files/${Date.now()}.txt`,
      createdAt: new Date().toISOString(),
      ...overrides
    };

    this.fixtures.set(`file:${file.id}`, file);
    return file;
  }

  /**
   * Create a webhook fixture
   */
  createWebhook(overrides: Partial<WebhookFixture> = {}): WebhookFixture {
    const webhook: WebhookFixture = {
      id: `webhook-${Date.now()}`,
      url: 'https://example.com/webhooks/test',
      events: ['user.created', 'user.updated'],
      secret: `webhook-secret-${Math.random().toString(36).substring(7)}`,
      active: true,
      createdAt: new Date().toISOString(),
      ...overrides
    };

    this.fixtures.set(`webhook:${webhook.id}`, webhook);
    return webhook;
  }

  /**
   * Get a fixture by key
   */
  get<T>(key: string): T | undefined {
    return this.fixtures.get(key) as T;
  }

  /**
   * Get current user
   */
  getCurrentUser(): UserFixture | undefined {
    return this.get<UserFixture>('user:current');
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionFixture | undefined {
    return this.get<SessionFixture>('session:current');
  }

  /**
   * Set a fixture
   */
  set<T>(key: string, value: T): void {
    this.fixtures.set(key, value);
  }

  /**
   * Check if fixture exists
   */
  has(key: string): boolean {
    return this.fixtures.has(key);
  }

  /**
   * Clear all fixtures
   */
  clear(): void {
    this.fixtures.clear();
  }

  /**
   * Clear fixtures by pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.fixtures.keys()) {
      if (regex.test(key)) {
        this.fixtures.delete(key);
      }
    }
  }
}

/**
 * Authenticated context fixture
 */
export class AuthenticatedContextFixture {
  private fixtureManager: FixtureManager;
  private user: UserFixture;
  private session: SessionFixture;

  constructor(
    private page: Page,
    private request: APIRequestContext
  ) {
    this.fixtureManager = new FixtureManager();
    this.user = this.fixtureManager.createUser();
    this.session = this.fixtureManager.createSession(this.user.id);
  }

  /**
   * Get the user
   */
  getUser(): UserFixture {
    return this.user;
  }

  /**
   * Get the session
   */
  getSession(): SessionFixture {
    return this.session;
  }

  /**
   * Get auth token
   */
  getAuthToken(): string {
    return this.session.token;
  }

  /**
   * Setup authenticated state
   */
  async setup(): Promise<void> {
    // Set auth token in localStorage
    await this.page.evaluate(token => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('refreshToken', token);
    }, this.session.token);

    // Set auth header for API requests
    this.request.setDefaultHeaders({
      'Authorization': `Bearer ${this.session.token}`
    });
  }

  /**
   * Cleanup authenticated state
   */
  async cleanup(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    });
  }
}

/**
 * Database fixture
 */
export class DatabaseFixture {
  private tables = new Map<string, unknown[]>();

  /**
   * Create a table
   */
  createTable<T>(name: string, data: T[] = []): void {
    this.tables.set(name, data);
  }

  /**
   * Insert data into a table
   */
  insert<T>(tableName: string, data: T): void {
    const table = this.tables.get(tableName) as T[] || [];
    table.push(data);
    this.tables.set(tableName, table);
  }

  /**
   * Select data from a table
   */
  select<T>(tableName: string, predicate?: (item: T) => boolean): T[] {
    const table = this.tables.get(tableName) as T[] || [];
    return predicate ? table.filter(predicate) : table;
  }

  /**
   * Update data in a table
   */
  update<T>(tableName: string, predicate: (item: T) => boolean, updates: Partial<T>): void {
    const table = this.tables.get(tableName) as T[] || [];
    const updated = table.map(item =>
      predicate(item) ? { ...item, ...updates } : item
    );
    this.tables.set(tableName, updated);
  }

  /**
   * Delete data from a table
   */
  delete<T>(tableName: string, predicate: (item: T) => boolean): void {
    const table = this.tables.get(tableName) as T[] || [];
    const filtered = table.filter(item => !predicate(item));
    this.tables.set(tableName, filtered);
  }

  /**
   * Clear a table
   */
  clearTable(tableName: string): void {
    this.tables.set(tableName, []);
  }

  /**
   * Get all tables
   */
  getTables(): Map<string, unknown[]> {
    return this.tables;
  }
}

/**
 * API response fixture
 */
export class ApiResponseFixture {
  /**
   * Create a success response
   */
  static success<T>(data: T, meta = {}) {
    return DataMockGenerator.apiResponse(data, meta);
  }

  /**
   * Create an error response
   */
  static error(message: string, code = 'ERROR', status = 400) {
    return DataMockGenerator.errorResponse(message, code, status);
  }

  /**
   * Create a paginated response
   */
  static paginated<T>(
    items: T[],
    page = 1,
    pageSize = 10,
    total?: number
  ) {
    return DataMockGenerator.paginatedResponse(items, page, pageSize, total);
  }

  /**
   * Create a validation error response
   */
  static validationError(errors: Record<string, string[]>) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
        status: 422
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req-123'
      }
    };
  }

  /**
   * Create a not found response
   */
  static notFound(resource: string, id: string) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `${resource} with id '${id}' not found`,
        status: 404
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req-123'
      }
    };
  }

  /**
   * Create an unauthorized response
   */
  static unauthorized(message = 'Unauthorized') {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
        status: 401
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req-123'
      }
    };
  }

  /**
   * Create a forbidden response
   */
  static forbidden(message = 'Forbidden') {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
        status: 403
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req-123'
      }
    };
  }
}

/**
 * Performance fixture
 */
export class PerformanceFixture {
  private metrics = new Map<string, number[]>();

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number): void {
    const values = this.metrics.get(name) || [];
    values.push(value);
    this.metrics.set(name, values);
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

/**
 * Log fixture
 */
export class LogFixture {
  private logs: string[] = [];

  /**
   * Add a log entry
   */
  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Get all logs
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Filter logs by level
   */
  filterByLevel(level: 'info' | 'warn' | 'error'): string[] {
    return this.logs.filter(log => log.includes(`[${level.toUpperCase()}]`));
  }
}

/**
 * Export fixture instances
 */
export const fixtureManager = new FixtureManager();
export const databaseFixture = new DatabaseFixture();
export const performanceFixture = new PerformanceFixture();
export const logFixture = new LogFixture();
