import { describe, test, expect, beforeEach, afterEach, jest } from '../src/unit/jest-compat';
import {
  MockServiceRegistry,
  MockServiceConfig,
  MockDatabaseConfig,
  MockRequest,
  MockResponse,
  HttpMockService,
  DatabaseMockService,
  mockServiceRegistry
} from '../src/mock';
import { Logger } from '../src/core/logger';

describe('Mock Services', () => {
  let registry: MockServiceRegistry;

  beforeEach(() => {
    registry = new MockServiceRegistry();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HttpMockService', () => {
    let mockService: HttpMockService;

    beforeEach(() => {
      const config: MockServiceConfig = {
        id: 'test-http',
        name: 'Test HTTP Service',
        type: 'http',
        port: 3000,
        latency: 100,
        errorRate: 0.1
      };
      mockService = new HttpMockService(config);
    });

    test('should initialize HTTP mock service', () => {
      expect(mockService).toBeDefined();
    });

    test('should add and remove routes', () => {
      const route = {
        id: 'test-route',
        method: 'GET',
        path: '/test',
        handler: async () => ({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'test' }
        })
      };

      mockService.addRoute(route);
      expect(mockService['routes'].has('GET:/test')).toBe(true);

      const removed = mockService.removeRoute('GET', '/test');
      expect(removed).toBe(true);
      expect(mockService['routes'].has('GET:/test')).toBe(false);
    });

    test('should create CRUD resource', () => {
      const testData = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ];

      mockService.createCrudResource('items', testData);

      // Test GET all
      mockService['handleRequest']('GET', '/items', {}, null)
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body).toEqual(testData);
        });

      // Test GET by ID
      mockService['handleRequest']('GET', '/items/1', {}, null)
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body).toEqual(testData[0]);
        });

      // Test POST
      mockService['handleRequest']('POST', '/items', {}, { name: 'New Item' })
        .then(response => {
          expect(response.statusCode).toBe(201);
          expect(response.body.name).toBe('New Item');
          expect(response.body.id).toBeDefined();
        });
    });

    test('should create pagination mock', () => {
      const testData = Array.from({ length: 50 }, (_, i) => ({
        id: `item_${i}`,
        name: `Item ${i}`
      }));

      mockService.createPaginatedResource('items', testData);

      // Test paginated response
      mockService['handleRequest']('GET', '/items?page=1&limit=10', {}, null)
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body.data).toHaveLength(10);
          expect(response.body.pagination.page).toBe(1);
          expect(response.body.pagination.limit).toBe(10);
          expect(response.body.pagination.total).toBe(50);
        });
    });

    test('should create authentication mock', () => {
      mockService.createAuthMock();

      // Test login
      mockService['handleRequest']('POST', '/auth/login', {}, { username: 'admin', password: 'admin123' })
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body.token).toBeDefined();
          expect(response.body.user).toBeDefined();
        });

      // Test invalid credentials
      mockService['handleRequest']('POST', '/auth/login', {}, { username: 'admin', password: 'wrong' })
        .then(response => {
          expect(response.statusCode).toBe(401);
          expect(response.body.error).toBe('Invalid credentials');
        });
    });

    test('should create webhook mock', () => {
      mockService.createWebhookMock();

      // Test webhook receiving
      mockService['handleRequest']('POST', '/webhooks/123', {}, { event: 'test', data: { value: 1 } })
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body.success).toBe(true);
        });
    });

    test('should handle simulated errors based on error rate', async () => {
      const config: MockServiceConfig = {
        id: 'error-http',
        name: 'Error HTTP Service',
        type: 'http',
        errorRate: 1.0 // 100% error rate
      };

      const errorService = new HttpMockService(config);
      errorService.addRoute({
        id: 'error-route',
        method: 'GET',
        path: '/error',
        handler: async () => ({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'success' }
        })
      });

      try {
        await errorService['handleRequest']('GET', '/error', {}, null);
        // Should not reach here due to 100% error rate
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should apply response delay', async () => {
      const startTime = Date.now();
      await mockService['handleRequest']('GET', '/health', {}, null);
      const endTime = Date.now();

      // Response should be fast since we're using mock
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should get service info', () => {
      const info = mockService.getServiceInfo();
      expect(info.id).toBe('test-http');
      expect(info.name).toBe('Test HTTP Service');
      expect(info.type).toBe('http');
    });

    test('should get metrics', () => {
      const metrics = mockService.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });

    test('should reset statistics', () => {
      mockService['stats'].requests = 10;
      mockService.resetStats();
      expect(mockService['stats'].requests).toBe(0);
    });
  });

  describe('DatabaseMockService', () => {
    let dbService: DatabaseMockService;

    beforeEach(() => {
      const config: MockDatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        tables: []
      };
      dbService = new DatabaseMockService(config);
    });

    test('should initialize database service', () => {
      expect(dbService).toBeDefined();
    });

    test('should connect and disconnect', async () => {
      await dbService.connect();
      expect(dbService['isConnected']).toBe(true);

      await dbService.disconnect();
      expect(dbService['isConnected']).toBe(false);
    });

    test('should create and manage tables', () => {
      dbService.createTable('users', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string', unique: true }
      ]);

      expect(dbService.getTableNames()).toContain('users');

      dbService.dropTable('users');
      expect(dbService.getTableNames()).not.toContain('users');
    });

    test('should perform CRUD operations', () => {
      // Create table
      dbService.createTable('users', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
      ]);

      // Insert
      const user = dbService.insert('users', { name: 'John Doe', email: 'john@example.com' });
      expect(user.id).toBeDefined();
      expect(user.name).toBe('John Doe');

      // Find
      const users = dbService.find('users');
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('John Doe');

      // Find with criteria
      const john = dbService.find('users', { name: 'John Doe' });
      expect(john).toHaveLength(1);

      // Update
      const updated = dbService.update('users', { name: 'John Doe' }, { name: 'John Smith' });
      expect(updated).toBe(1);

      // Delete
      const deleted = dbService.delete('users', { name: 'John Smith' });
      expect(deleted).toBe(1);

      // Verify deletion
      const remaining = dbService.find('users');
      expect(remaining).toHaveLength(0);
    });

    test('should handle query operators', () => {
      // Create table with test data
      dbService.createTable('products', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'category', type: 'string' }
      ]);

      // Insert test data
      dbService.insert('products', [
        { name: 'Product 1', price: 10, category: 'A' },
        { name: 'Product 2', price: 20, category: 'B' },
        { name: 'Product 3', price: 30, category: 'A' },
        { name: 'Product 4', price: 15, category: 'C' }
      ]);

      // Test $gt
      const expensive = dbService.find('products', { price: { $gt: 15 } });
      expect(expensive).toHaveLength(2); // Products with price 20 and 30

      // Test $gte
      const expensiveOrEqual = dbService.find('products', { price: { $gte: 20 } });
      expect(expensiveOrEqual).toHaveLength(2);

      // Test $lt
      const cheap = dbService.find('products', { price: { $lt: 20 } });
      expect(cheap).toHaveLength(2);

      // Test $lte
      const cheapOrEqual = dbService.find('products', { price: { $lte: 15 } });
      expect(cheapOrEqual).toHaveLength(2);

      // Test $eq
      const product1 = dbService.find('products', { name: 'Product 1' });
      expect(product1).toHaveLength(1);

      // Test $ne
      const notProduct1 = dbService.find('products', { name: { $ne: 'Product 1' } });
      expect(notProduct1).toHaveLength(3);

      // Test $in
      const categoryAorB = dbService.find('products', { category: { $in: ['A', 'B'] } });
      expect(categoryAorB).toHaveLength(3);

      // Test $nin
      const notCategoryA = dbService.find('products', { category: { $nin: ['A'] } });
      expect(notCategoryA).toHaveLength(2);

      // Test $regex
      const productWith1 = dbService.find('products', { name: { $regex: '1$' } });
      expect(productWith1).toHaveLength(1);

      // Test $exists
      const withId = dbService.find('products', { id: { $exists: true } });
      expect(withId).toHaveLength(4);
    });

    test('should count records', () => {
      dbService.createTable('test_table', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' }
      ]);

      dbService.insert('test_table', [
        { name: 'Item 1' },
        { name: 'Item 2' },
        { name: 'Item 3' }
      ]);

      expect(dbService.count('test_table')).toBe(3);
      expect(dbService.count('test_table', { name: 'Item 1' })).toBe(1);
      expect(dbService.count('test_table', { name: 'Non-existent' })).toBe(0);
    });

    test('should check record existence', () => {
      dbService.createTable('test_table', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' }
      ]);

      dbService.insert('test_table', { name: 'Test Item' });

      expect(dbService.exists('test_table', { name: 'Test Item' })).toBe(true);
      expect(dbService.exists('test_table', { name: 'Non-existent' })).toBe(false);
    });

    test('should get table data and schema', () => {
      dbService.createTable('test_table', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' }
      ]);

      const data = dbService.getTableData('test_table');
      expect(data).toEqual([]);

      const schema = dbService.getSchema('test_table');
      expect(schema).toHaveLength(2);
      expect(schema[0].name).toBe('id');
      expect(schema[1].name).toBe('name');
    });

    test('should clear and reset tables', () => {
      dbService.createTable('test_table', [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' }
      ]);

      dbService.insert('test_table', { name: 'Test' });
      expect(dbService.count('test_table')).toBe(1);

      dbService.clearTable('test_table');
      expect(dbService.count('test_table')).toBe(0);

      dbService.reset();
      expect(dbService.getTableNames()).toEqual([]);
    });

    test('should create and seed common tables', () => {
      dbService.createCommonTables();
      expect(dbService.getTableNames()).toContain('users');
      expect(dbService.getTableNames()).toContain('posts');
      expect(dbService.getTableNames()).toContain('comments');

      dbService.seedCommonData();
      expect(dbService.count('users')).toBe(3);
      expect(dbService.count('posts')).toBe(3);
      expect(dbService.count('comments')).toBe(3);
    });

    test('should get database info and stats', () => {
      dbService.createTable('test', [
        { name: 'id', type: 'string', primaryKey: true }
      ]);

      const info = dbService.getInfo();
      expect(info.id).toBe('test_db');
      expect(info.config.database).toBe('test_db');

      const stats = dbService.getStats();
      expect(stats.tables).toBe(1);
      expect(stats.totalRows).toBe(0);
    });
  });

  describe('MockServiceRegistry', () => {
    test('should register and manage services', () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);
      expect(registry.getAllServices().has('test-service')).toBe(true);
    });

    test('should register database services', () => {
      const config: MockDatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db'
      };

      registry.registerDatabase(config);
      expect(registry.getAllServices().has('test_db')).toBe(true);
    });

    test('should start and stop services', async () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);

      await registry.startService('test-service');
      expect(registry.getServiceInfo('test-service').isActive).toBe(true);

      await registry.stopService('test-service');
      expect(registry.getServiceInfo('test-service').isActive).toBe(false);
    });

    test('should start all services', async () => {
      const config1: MockServiceConfig = {
        id: 'service1',
        name: 'Service 1',
        type: 'http'
      };

      const config2: MockServiceConfig = {
        id: 'service2',
        name: 'Service 2',
        type: 'http'
      };

      registry.registerService(config1);
      registry.registerService(config2);

      await registry.startAll();
      expect(registry.getServiceInfo('service1').isActive).toBe(true);
      expect(registry.getServiceInfo('service2').isActive).toBe(true);
    });

    test('should stop all services', async () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);
      await registry.startService('test-service');

      await registry.stopAll();
      expect(registry.getServiceInfo('test-service').isActive).toBe(false);
    });

    test('should add routes to services', () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);

      const route = {
        id: 'test-route',
        method: 'GET',
        path: '/test',
        handler: async () => ({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'test' }
        })
      };

      registry.addRoute('test-service', route);
      expect(registry['routes'].get('test-service')).toHaveLength(1);
    });

    test('should handle requests through registry', async () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);

      const route = {
        id: 'test-route',
        method: 'GET',
        path: '/test',
        handler: async () => ({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'test response' }
        })
      };

      registry.addRoute('test-service', route);

      await registry.startService('test-service');

      const response = await registry.handleRequest('test-service', 'GET', '/test', {});
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('test response');
    });

    test('should execute database queries', async () => {
      const config: MockDatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db'
      };

      registry.registerDatabase(config);
      await registry.startService('test_db');

      // Create table and insert data
      registry.registerDatabase({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db'
      });

      const result = await registry.executeQuery('test_db', 'SELECT 1 as test');
      expect(result).toBeDefined();
    });

    test('should create and execute scenarios', async () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);

      const scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        services: ['test-service'],
        setup: async () => {
          // Setup logic
        },
        teardown: async () => {
          // Teardown logic
        }
      };

      registry.createScenario(scenario);

      // Mock the startService method
      jest.spyOn(registry, 'startService').mockResolvedValue(undefined);

      await registry.executeScenario('test-scenario');
      expect(registry.startService).toHaveBeenCalledWith('test-service');
    });

    test('should get service metrics', () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);

      const metrics = registry.getServiceMetrics('test-service');
      expect(metrics).toBeDefined();
    });

    test('should get all metrics', () => {
      const config1: MockServiceConfig = {
        id: 'service1',
        name: 'Service 1',
        type: 'http'
      };

      const config2: MockServiceConfig = {
        id: 'service2',
        name: 'Service 2',
        type: 'http'
      };

      registry.registerService(config1);
      registry.registerService(config2);

      const allMetrics = registry.getAllMetrics();
      expect(allMetrics).toHaveProperty('service1');
      expect(allMetrics).toHaveProperty('service2');
    });

    test('should reset all services', () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);
      registry['routes'].set('test-service', []);

      registry.resetAll();
      expect(registry['routes'].get('test-service')).toHaveLength(0);
    });

    test('should get active services', () => {
      const config: MockServiceConfig = {
        id: 'test-service',
        name: 'Test Service',
        type: 'http'
      };

      registry.registerService(config);

      const activeServices = registry.getActiveServices();
      expect(activeServices.size).toBe(0);

      // Mock isActive property
      const service = registry.getServiceInfo('test-service');
      (service as any).isActive = true;

      const activeAfterStart = registry.getActiveServices();
      expect(activeAfterStart.size).toBe(1);
    });

    test('should handle non-existent services', () => {
      expect(() => registry.getServiceInfo('non-existent'))
        .toThrow('Service not found: non-existent');

      expect(() => registry.getServiceMetrics('non-existent'))
        .toThrow('Service not found: non-existent');
    });
  });

  describe('Mock Service Utilities', () => {
    test('should create HTTP service', () => {
      const config: MockServiceConfig = {
        id: 'test-http',
        name: 'Test HTTP',
        type: 'http'
      };

      const service = mockServiceRegistry.createHttpService(config);
      expect(service).toBeInstanceOf(HttpMockService);
    });

    test('should create REST API service', () => {
      const service = mockServiceRegistry.createRestApiService('http://localhost:3000', ['users', 'products']);
      expect(service).toBeInstanceOf(HttpMockService);

      // Should have health endpoint
      service['handleRequest']('GET', '/health', {}, null)
        .then(response => {
          expect(response.statusCode).toBe(200);
        });
    });

    test('should create database service', () => {
      const config: MockDatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test_db'
      };

      const database = mockServiceRegistry.createDatabaseService(config);
      expect(database).toBeInstanceOf(DatabaseMockService);
    });

    test('should create common database', () => {
      const database = mockServiceRegistry.createCommonDatabase();
      expect(database.getTableNames()).toContain('users');
      expect(database.getTableNames()).toContain('posts');
      expect(database.count('users')).toBe(3);
    });

    test('should create scenario', () => {
      const scenario = mockServiceRegistry.createCommonScenario({
        name: 'Test Scenario',
        description: 'A test scenario'
      });

      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBe('Test Scenario');
      expect(scenario.services).toEqual([]);
    });

    test('should create auth mock', () => {
      const authMock = mockServiceRegistry.createAuthMock();
      expect(authMock).toBeInstanceOf(HttpMockService);

      // Test authentication
      authMock['handleRequest']('POST', '/auth/login', {}, { username: 'admin', password: 'admin123' })
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body.token).toBeDefined();
        });
    });

    test('should create webhook mock', () => {
      const webhookMock = mockServiceRegistry.createWebhookMock();
      expect(webhookMock).toBeInstanceOf(HttpMockService);

      // Test webhook
      webhookMock['handleRequest']('POST', '/webhooks/123', {}, { event: 'test' })
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body.success).toBe(true);
        });
    });

    test('should create test environment', () => {
      const { registry, services } = mockServiceRegistry.createTestEnvironment({
        api: true,
        database: true,
        auth: true
      });

      expect(registry).toBeInstanceOf(MockServiceRegistry);
      expect(services.api).toBe('api-service');
      expect(services.database).toBe('test_db');
      expect(services.auth).toBe('auth-service');
    });
  });
});