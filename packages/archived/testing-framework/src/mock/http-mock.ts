/**
 * HTTP Mock Service
 * Provides HTTP server mocking capabilities for testing API integrations
 */

import {
  MockServiceConfig,
  MockRequest,
  MockResponse,
  MockRoute,
  MockService,
  MockMetrics,
  MockServiceError
} from './types';
import { Logger } from '../core/logger';
import { EventEmitter } from 'events';

export class HttpMockService extends EventEmitter {
  private config: MockServiceConfig;
  private logger: Logger;
  private routes: Map<string, MockRoute> = new Map();
  private server: any;
  private isActive = false;
  private stats: MockService['stats'] = {
    requests: 0,
    responses: 0,
    errors: 0,
    averageResponseTime: 0,
    uptime: 0,
    startTime: new Date()
  };

  constructor(config: MockServiceConfig) {
    super();
    this.config = config;
    this.logger = new Logger(`HttpMock:${config.name}`);
    this.initializeDefaultRoutes();
  }

  /**
   * Start the HTTP mock service
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Service already active');
      return;
    }

    try {
      // In a real implementation, this would use Express or similar
      this.server = this.createServer();
      await this.server.listen(this.config.port || 3000);
      this.isActive = true;
      this.stats.startTime = new Date();
      this.logger.info(`HTTP mock service started on port ${this.config.port || 3000}`);
      this.emit('started');
    } catch (error) {
      this.logger.error(`Failed to start service: ${error}`);
      throw error;
    }
  }

  /**
   * Stop the HTTP mock service
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.warn('Service not active');
      return;
    }

    try {
      if (this.server) {
        await this.server.close();
      }
      this.isActive = false;
      this.stats.uptime = Date.now() - this.stats.startTime.getTime();
      this.logger.info('HTTP mock service stopped');
      this.emit('stopped');
    } catch (error) {
      this.logger.error(`Failed to stop service: ${error}`);
      throw error;
    }
  }

  /**
   * Add a route to the mock service
   */
  addRoute(route: MockRoute): void {
    const key = `${route.method.toUpperCase()}:${route.path}`;
    this.routes.set(key, route);
    this.logger.info(`Added route: ${key}`);
  }

  /**
   * Remove a route from the mock service
   */
  removeRoute(method: string, path: string): boolean {
    const key = `${method.toUpperCase()}:${path}`;
    const removed = this.routes.delete(key);
    if (removed) {
      this.logger.info(`Removed route: ${key}`);
    }
    return removed;
  }

  /**
   * Add mock data for API responses
   */
  addMockData(path: string, method: string, response: MockResponse, condition?: (req: MockRequest) => boolean): void {
    const route: MockRoute = {
      id: `mock_${Date.now()}`,
      method: method.toUpperCase(),
      path,
      handler: async (request: MockRequest) => {
        // Simulate response delay
        if (this.config.responseDelay) {
          await this.delay(this.config.responseDelay);
        }

        // Simulate random errors
        if (this.config.errorRate && Math.random() < this.config.errorRate) {
          throw new Error(`Simulated error with ${(this.config.errorRate * 100).toFixed(0)}% rate`);
        }

        return response;
      },
      response,
      condition
    };

    this.addRoute(route);
  }

  /**
   * Create mock CRUD operations
   */
  createCrudResource(resource: string, data: any[] = []): void {
    // GET /resource
    this.addMockData(`/${resource}`, 'GET', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: data
    });

    // GET /resource/:id
    this.addMockData(`/${resource}/:id`, 'GET', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: null
    }, (req: MockRequest) => {
      const id = req.path.split('/').pop();
      const item = data.find(d => d.id === id);
      if (!item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Resource not found' }
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: item
      };
    });

    // POST /resource
    this.addMockData(`/${resource}`, 'POST', {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: null
    }, (req: MockRequest) => {
      const newItem = { ...req.body, id: Date.now().toString() };
      data.push(newItem);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: newItem
      };
    });

    // PUT /resource/:id
    this.addMockData(`/${resource}/:id`, 'PUT', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: null
    }, (req: MockRequest) => {
      const id = req.path.split('/').pop();
      const index = data.findIndex(d => d.id === id);
      if (index === -1) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Resource not found' }
        };
      }
      data[index] = { ...data[index], ...req.body };
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: data[index]
      };
    });

    // DELETE /resource/:id
    this.addMockData(`/${resource}/:id`, 'DELETE', {
      statusCode: 204,
      headers: {},
      body: null
    }, (req: MockRequest) => {
      const id = req.path.split('/').pop();
      const index = data.findIndex(d => d.id === id);
      if (index === -1) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Resource not found' }
        };
      }
      data.splice(index, 1);
      return {
        statusCode: 204,
        headers: {},
        body: null
      };
    });
  }

  /**
   * Create pagination mock
   */
  createPaginatedResource(resource: string, data: any[] = []): void {
    // GET /resource?page=1&limit=10
    this.addMockData(`/${resource}`, 'GET', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: null
    }, (req: MockRequest) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = data.slice(startIndex, endIndex);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          data: paginatedData,
          pagination: {
            page,
            limit,
            total: data.length,
            totalPages: Math.ceil(data.length / limit),
            hasNext: endIndex < data.length,
            hasPrev: page > 1
          }
        }
      };
    });
  }

  /**
   * Create authentication mock
   */
  createAuthMock(): void {
    const users = [
      { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
      { id: '2', username: 'user', password: 'user123', role: 'user' }
    ];

    // POST /auth/login
    this.addMockData('/auth/login', 'POST', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { token: 'mock-jwt-token', user: null }
    }, (req: MockRequest) => {
      const { username, password } = req.body;
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Invalid credentials' }
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          token: `mock-jwt-token-${user.id}`,
          user: { id: user.id, username: user.username, role: user.role }
        }
      };
    });

    // POST /auth/register
    this.addMockData('/auth/register', 'POST', {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: null
    }, (req: MockRequest) => {
      const { username, password } = req.body;
      if (users.find(u => u.username === username)) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Username already exists' }
        };
      }
      const newUser = { id: Date.now().toString(), username, password, role: 'user' };
      users.push(newUser);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: newUser
      };
    });
  }

  /**
   * Create webhook mock
   */
  createWebhookMock(): void {
    const webhookEvents: any[] = [];

    // POST /webhooks/:id
    this.addMockData('/webhooks/:id', 'POST', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true }
    }, (req: MockRequest) => {
      webhookEvents.push({
        webhookId: req.path.split('/').pop(),
        payload: req.body,
        headers: req.headers,
        timestamp: new Date()
      });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, received: true }
      };
    });

    // GET /webhooks/events
    this.addMockData('/webhooks/events', 'GET', {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: webhookEvents
    });
  }

  /**
   * Get service information
   */
  getServiceInfo(): MockService {
    return {
      id: this.config.id,
      name: this.config.name,
      type: 'http',
      config: this.config,
      isActive: this.isActive,
      stats: { ...this.stats }
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(): MockMetrics {
    const uptime = this.isActive ? Date.now() - this.stats.startTime.getTime() : this.stats.uptime;
    const errorRate = this.stats.requests > 0 ? (this.stats.errors / this.stats.requests) * 100 : 0;

    return {
      totalRequests: this.stats.requests,
      successfulRequests: this.stats.responses,
      failedRequests: this.stats.errors,
      averageResponseTime: this.stats.averageResponseTime,
      responseTimeDistribution: {
        min: 0,
        max: this.config.responseDelay || 100,
        mean: this.stats.averageResponseTime,
        median: this.stats.averageResponseTime,
        p95: this.config.responseDelay || 100,
        p99: this.config.responseDelay || 100
      },
      errorRate,
      throughput: this.stats.requests / (uptime / 1000),
      memoryUsage: {
        used: process.memoryUsage().heapUsed,
        total: require('os').totalmem(),
        percentage: (process.memoryUsage().heapUsed / require('os').totalmem()) * 100
      },
      activeConnections: 0 // Would track actual connections in real implementation
    };
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes.clear();
    this.logger.info('All routes cleared');
  }

  /**
   * Reset service statistics
   */
  resetStats(): void {
    this.stats = {
      requests: 0,
      responses: 0,
      errors: 0,
      averageResponseTime: 0,
      uptime: 0,
      startTime: new Date()
    };
    this.logger.info('Service statistics reset');
  }

  /**
   * Private methods
   */
  private createServer(): any {
    // In a real implementation, this would create an Express server
    return {
      listen: async (port: number) => {
        this.logger.info(`Server listening on port ${port}`);
      },
      close: async () => {
        this.logger.info('Server closed');
      }
    };
  }

  private initializeDefaultRoutes(): void {
    // Health check endpoint
    this.addRoute({
      id: 'health',
      method: 'GET',
      path: '/health',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'healthy', service: this.config.name }
      })
    });

    // Info endpoint
    this.addRoute({
      id: 'info',
      method: 'GET',
      path: '/info',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: this.getServiceInfo()
      })
    });

    // Metrics endpoint
    this.addRoute({
      id: 'metrics',
      method: 'GET',
      path: '/metrics',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: this.getMetrics()
      })
    });

    // Routes endpoint
    this.addRoute({
      id: 'routes',
      method: 'GET',
      path: '/routes',
      handler: async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: Array.from(this.routes.values()).map(r => ({
          id: r.id,
          method: r.method,
          path: r.path,
          enabled: r.enabled !== false
        }))
      })
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle incoming request (mock implementation)
   */
  private async handleRequest(method: string, path: string, headers: Record<string, string>, body?: any): Promise<MockResponse> {
    const request: MockRequest = {
      id: `req_${Date.now()}`,
      method,
      path,
      headers,
      body,
      query: {},
      timestamp: new Date()
    };

    const startTime = Date.now();
    this.stats.requests++;

    try {
      const routeKey = `${method.toUpperCase()}:${path}`;
      const route = this.routes.get(routeKey);

      if (!route || (route.condition && !route.condition(request))) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Route not found' }
        };
      }

      const response = await route.handler(request);
      this.stats.responses++;
      this.stats.averageResponseTime = (this.stats.averageResponseTime + (Date.now() - startTime)) / 2;

      this.emit('request', { request, response });
      return response;

    } catch (error) {
      this.stats.errors++;
      const serviceError: MockServiceError = {
        type: 'server',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SERVER_ERROR',
        timestamp: new Date()
      };
      this.emit('error', serviceError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Internal server error' }
      };
    }
  }
}