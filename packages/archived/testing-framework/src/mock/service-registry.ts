/**
 * Mock Service Registry
 * Central registry for managing all mock services
 */

import {
  MockServiceConfig,
  MockServiceRegistry,
  MockDatabase,
  MockWebSocket,
  MockEventBus,
  MockStorage,
  MockRequest,
  MockResponse,
  MockScenario
} from './types';
import { HttpMockService } from './http-mock';
import { DatabaseMockService } from './database-mock';
import { Logger } from '../core/logger';

export class MockServiceRegistry implements MockServiceRegistry {
  private services: Map<string, MockService> = new Map();
  private routes: Map<string, MockRoute[]> = new Map();
  private databases: Map<string, DatabaseMockService> = new Map();
  private websockets: Map<string, MockWebSocket> = new Map();
  private eventBus: MockEventBus;
  private storage: MockStorage;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MockServiceRegistry');
    this.eventBus = this.createEventBus();
    this.storage = this.createStorage();
  }

  /**
   * Register a new mock service
   */
  registerService(config: MockServiceConfig): void {
    const serviceId = config.id;

    if (this.services.has(serviceId)) {
      throw new Error(`Service already exists: ${serviceId}`);
    }

    let service: any;

    switch (config.type) {
      case 'http':
        service = new HttpMockService(config);
        break;
      case 'database':
        throw new Error('Database services must be registered via registerDatabase');
      case 'websocket':
        throw new Error('WebSocket services must be registered via registerWebSocket');
      default:
        throw new Error(`Unsupported service type: ${config.type}`);
    }

    this.services.set(serviceId, {
      id: serviceId,
      name: config.name,
      type: config.type,
      config,
      isActive: false,
      stats: {
        requests: 0,
        responses: 0,
        errors: 0,
        averageResponseTime: 0,
        uptime: 0,
        startTime: new Date()
      }
    });

    this.logger.info(`Registered mock service: ${serviceId}`);
  }

  /**
   * Register a database service
   */
  registerDatabase(config: MockDatabase): void {
    const databaseId = config.database;
    const dbService = new DatabaseMockService(config);

    this.databases.set(databaseId, dbService);

    this.services.set(databaseId, {
      id: databaseId,
      name: `Database: ${databaseId}`,
      type: 'database',
      config: { type: 'database' } as MockServiceConfig,
      isActive: false,
      stats: {
        requests: 0,
        responses: 0,
        errors: 0,
        averageResponseTime: 0,
        uptime: 0,
        startTime: new Date()
      }
    });

    this.logger.info(`Registered database service: ${databaseId}`);
  }

  /**
   * Register a WebSocket service
   */
  registerWebSocket(config: any): void {
    const websocketId = config.id;

    this.websockets.set(websocketId, {
      id: websocketId,
      config,
      connections: new Set(),
      messages: [],
      isActive: false
    });

    this.services.set(websocketId, {
      id: websocketId,
      name: `WebSocket: ${websocketId}`,
      type: 'websocket',
      config: { type: 'websocket' } as MockServiceConfig,
      isActive: false,
      stats: {
        requests: 0,
        responses: 0,
        errors: 0,
        averageResponseTime: 0,
        uptime: 0,
        startTime: new Date()
      }
    });

    this.logger.info(`Registered WebSocket service: ${websocketId}`);
  }

  /**
   * Start a service
   */
  async startService(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    switch (service.type) {
      case 'http':
        const httpService = this.services.get(serviceId) as any;
        await httpService.start();
        service.isActive = true;
        break;
      case 'database':
        const dbService = this.databases.get(serviceId);
        if (dbService) {
          await dbService.connect();
          service.isActive = true;
        }
        break;
      case 'websocket':
        const wsService = this.websockets.get(serviceId);
        if (wsService) {
          wsService.isActive = true;
          service.isActive = true;
        }
        break;
    }

    this.logger.info(`Started service: ${serviceId}`);
  }

  /**
   * Stop a service
   */
  async stopService(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    switch (service.type) {
      case 'http':
        const httpService = this.services.get(serviceId) as any;
        await httpService.stop();
        service.isActive = false;
        break;
      case 'database':
        const dbService = this.databases.get(serviceId);
        if (dbService) {
          await dbService.disconnect();
          service.isActive = false;
        }
        break;
      case 'websocket':
        const wsService = this.websockets.get(serviceId);
        if (wsService) {
          wsService.isActive = false;
          service.isActive = false;
        }
        break;
    }

    this.logger.info(`Stopped service: ${serviceId}`);
  }

  /**
   * Start all services
   */
  async startAll(): Promise<void> {
    this.logger.info('Starting all mock services...');

    for (const [serviceId] of this.services) {
      try {
        await this.startService(serviceId);
      } catch (error) {
        this.logger.error(`Failed to start service ${serviceId}: ${error}`);
      }
    }
  }

  /**
   * Stop all services
   */
  async stopAll(): Promise<void> {
    this.logger.info('Stopping all mock services...');

    for (const [serviceId] of this.services) {
      try {
        await this.stopService(serviceId);
      } catch (error) {
        this.logger.error(`Failed to stop service ${serviceId}: ${error}`);
      }
    }
  }

  /**
   * Add a route to a service
   */
  addRoute(serviceId: string, route: MockRoute): void {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    if (service.type !== 'http') {
      throw new Error(`Routes can only be added to HTTP services`);
    }

    const serviceRoutes = this.routes.get(serviceId) || [];
    serviceRoutes.push(route);
    this.routes.set(serviceId, serviceRoutes);

    const httpService = this.services.get(serviceId) as any;
    httpService.addRoute(route);

    this.logger.info(`Added route to service ${serviceId}: ${route.method} ${route.path}`);
  }

  /**
   * Handle a request through the registry
   */
  async handleRequest(serviceId: string, method: string, path: string, headers: Record<string, string>, body?: any): Promise<MockResponse> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    if (service.type !== 'http') {
      throw new Error(`Request handling only supported for HTTP services`);
    }

    const httpService = this.services.get(serviceId) as any;
    return await httpService.handleRequest(method, path, headers, body);
  }

  /**
   * Execute a database query
   */
  async executeQuery(serviceId: string, sql: string, params?: any[]): Promise<any[]> {
    const database = this.databases.get(serviceId);
    if (!database) {
      throw new Error(`Database service not found: ${serviceId}`);
    }

    return await database.query(sql, params);
  }

  /**
   * Create a test scenario
   */
  createScenario(scenario: MockScenario): void {
    this.logger.info(`Creating scenario: ${scenario.name}`);

    // Add scenario setup and teardown hooks
    if (scenario.setup) {
      this.on('scenario:before', scenario.id, scenario.setup);
    }

    if (scenario.teardown) {
      this.on('scenario:after', scenario.id, scenario.teardown);
    }

    this.logger.info(`Created scenario: ${scenario.id}`);
  }

  /**
   * Execute a scenario
   */
  async executeScenario(scenarioId: string, data?: any): Promise<void> {
    this.logger.info(`Executing scenario: ${scenarioId}`);
    this.emit('scenario:before', scenarioId, { data });

    try {
      // Start all services in the scenario
      for (const serviceId of this.services.keys()) {
        await this.startService(serviceId);
      }

      // Add scenario data to services
      if (data) {
        for (const [serviceId, service] of this.services) {
          if (service.type === 'http') {
            const httpService = service as any;
            if (httpService.setData) {
              httpService.setData(data);
            }
          }
        }
      }

      this.emit('scenario:success', scenarioId);
    } catch (error) {
      this.logger.error(`Scenario execution failed: ${error}`);
      this.emit('scenario:error', scenarioId, { error });
      throw error;
    } finally {
      this.emit('scenario:after', scenarioId);
    }
  }

  /**
   * Get service information
   */
  getServiceInfo(serviceId: string): any {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    switch (service.type) {
      case 'http':
        const httpService = this.services.get(serviceId) as any;
        return httpService.getServiceInfo();
      case 'database':
        const dbService = this.databases.get(serviceId);
        return dbService?.getInfo();
      case 'websocket':
        const wsService = this.websockets.get(serviceId);
        return wsService;
      default:
        return service;
    }
  }

  /**
   * Get all services
   */
  getAllServices(): Map<string, any> {
    return new Map(this.services);
  }

  /**
   * Get active services
   */
  getActiveServices(): Map<string, any> {
    const activeServices = new Map<string, any>();

    for (const [serviceId, service] of this.services) {
      if (service.isActive) {
        activeServices.set(serviceId, this.getServiceInfo(serviceId));
      }
    }

    return activeServices;
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceId: string): any {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    switch (service.type) {
      case 'http':
        const httpService = this.services.get(serviceId) as any;
        return httpService.getMetrics();
      case 'database':
        const dbService = this.databases.get(serviceId);
        return dbService?.getStats();
      case 'websocket':
        const wsService = this.websockets.get(serviceId);
        return {
          connections: wsService?.connections.size || 0,
          messages: wsService?.messages.length || 0,
          isActive: wsService?.isActive || false
        };
      default:
        return service.stats;
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): { [serviceId: string]: any } {
    const metrics: { [serviceId: string]: any } = {};

    for (const serviceId of this.services.keys()) {
      try {
        metrics[serviceId] = this.getServiceMetrics(serviceId);
      } catch (error) {
        metrics[serviceId] = { error: error.message };
      }
    }

    return metrics;
  }

  /**
   * Reset all services
   */
  resetAll(): void {
    this.logger.info('Resetting all services...');

    for (const [serviceId] of this.services) {
      try {
        const service = this.services.get(serviceId);

        switch (service?.type) {
          case 'http':
            const httpService = this.services.get(serviceId) as any;
            httpService.clearRoutes();
            httpService.resetStats();
            break;
          case 'database':
            const dbService = this.databases.get(serviceId);
            dbService?.reset();
            break;
          case 'websocket':
            const wsService = this.websockets.get(serviceId);
            if (wsService) {
              wsService.messages = [];
              wsService.connections.clear();
            }
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to reset service ${serviceId}: ${error}`);
      }
    }

    this.logger.info('All services reset');
  }

  /**
   * Private methods
   */
  private createEventBus(): MockEventBus {
    return {
      config: {
        topics: [],
        handlers: []
      },
      subscribers: new Map(),
      published: 0,
      delivered: 0
    };
  }

  private createStorage(): MockStorage {
    return {
      config: {
        type: 'memory'
      },
      files: new Map(),
      uploads: 0,
      downloads: 0,
      size: 0
    };
  }

  /**
   * EventEmitter methods
   */
  private eventEmitter = new EventEmitter();

  on(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  once(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.once(event, listener);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(event, listener);
    return this;
  }
}

// Create default instance
export const mockServiceRegistry = new MockServiceRegistry();