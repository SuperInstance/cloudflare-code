/**
 * Integration Testing Example
 * Demonstrates integration testing with the ClaudeFlare testing framework
 */

import { describe, test, expect, mock, jest, beforeEach, afterEach } from '@claudeflare/testing-framework/unit';
import { createIntegrationTestRunner, createServiceTest, IntegrationScenario } from '@claudeflare/testing-framework/integration';

// Mock HTTP service
class MockHTTPService {
  private baseUrl: string;
  private data: any = {};

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get(endpoint: string): Promise<any> {
    return this.data[endpoint] || { status: 'not found' };
  }

  async post(endpoint: string, body: any): Promise<any> {
    const response = { id: Math.random().toString(36).substr(2, 9), ...body };
    this.data[endpoint] = response;
    return response;
  }

  async put(endpoint: string, body: any): Promise<any> {
    const existing = this.data[endpoint];
    if (existing) {
      this.data[endpoint] = { ...existing, ...body };
      return this.data[endpoint];
    }
    throw new Error('Not found');
  }

  async delete(endpoint: string): Promise<boolean> {
    const existed = endpoint in this.data;
    delete this.data[endpoint];
    return existed;
  }
}

// Mock Database service
class MockDatabaseService {
  private tables: Map<string, any[]> = new Map();

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Mock query execution
    const results = [];
    if (sql.includes('SELECT')) {
      // Mock SELECT
      return [];
    } else if (sql.includes('INSERT')) {
      // Mock INSERT
      return [{ id: 'generated-id' }];
    }
    return results;
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    // Mock execution
    return true;
  }

  async beginTransaction(): Promise<void> {
    // Mock transaction start
  }

  async commit(): Promise<void> {
    // Mock transaction commit
  }

  async rollback(): Promise<void> {
    // Mock transaction rollback
  }
}

// Mock Message Queue service
class MockMessageQueue {
  private messages: any[] = [];

  async publish(queue: string, message: any): Promise<void> {
    this.messages.push({ queue, message, timestamp: Date.now() });
  }

  async consume(queue: string, callback: (message: any) => void): Promise<void> {
    // Mock consumption would be handled differently
  }

  async getQueueSize(queue: string): Promise<number> {
    return this.messages.filter(m => m.queue === queue).length;
  }
}

// API Service that depends on other services
class APIService {
  private http: MockHTTPService;
  private db: MockDatabaseService;
  private mq: MockMessageQueue;

  constructor(http: MockHTTPService, db: MockDatabaseService, mq: MockMessageQueue) {
    this.http = http;
    this.db = db;
    this.mq = mq;
  }

  async createUser(userData: any): Promise<any> {
    // Validate input
    if (!userData.name || !userData.email) {
      throw new Error('Missing required fields');
    }

    // Check if user exists
    const existing = await this.db.query('SELECT * FROM users WHERE email = ?', [userData.email]);
    if (existing.length > 0) {
      throw new Error('User already exists');
    }

    // Insert user into database
    const result = await this.db.execute(
      'INSERT INTO users (name, email, created_at) VALUES (?, ?, NOW())',
      [userData.name, userData.email]
    );

    // Publish event
    await this.mq.publish('user-events', {
      type: 'user.created',
      userId: result.id,
      userData
    });

    // Return user data
    return { id: result.id, ...userData };
  }

  async getUser(id: string): Promise<any> {
    const users = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
    return users[0] || null;
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error('User not found');
    }

    const result = await this.db.execute(
      'UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ?',
      [updates.name || user.name, updates.email || user.email, id]
    );

    // Publish event
    await this.mq.publish('user-events', {
      type: 'user.updated',
      userId: id,
      updates
    });

    return this.getUser(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error('User not found');
    }

    const result = await this.db.execute('DELETE FROM users WHERE id = ?', [id]);

    // Publish event
    await this.mq.publish('user-events', {
      type: 'user.deleted',
      userId: id
    });

    return result.affectedRows > 0;
  }

  async getAllUsers(): Promise<any[]> {
    return await this.db.query('SELECT * FROM users ORDER BY created_at DESC');
  }
}

// Integration test setup
describe('API Service Integration Tests', () => {
  let testRunner: any;
  let httpService: MockHTTPService;
  let databaseService: MockDatabaseService;
  let messageQueue: MockMessageQueue;
  let apiService: APIService;

  beforeEach(() => {
    // Initialize services
    httpService = new MockHTTPService('http://localhost:3000');
    databaseService = new MockDatabaseService();
    messageQueue = new MockMessageQueue();
    apiService = new APIService(httpService, databaseService, messageQueue);

    // Create integration test runner
    testRunner = createIntegrationTestRunner({
      pattern: ['**/*.integration.ts'],
      testDir: ['integration'],
      maxParallel: 2
    });

    // Add services
    const apiServiceTest = createServiceTest({
      name: 'api-service',
      type: 'http',
      endpoint: 'http://localhost:3000',
      config: { timeout: 5000 },
      healthCheck: {
        endpoint: 'http://localhost:3000/health',
        expectedStatus: 200
      }
    });

    const databaseServiceTest = createServiceTest({
      name: 'database',
      type: 'database',
      endpoint: 'postgresql://localhost:5432/myapp',
      config: { connectionPool: 10 }
    });

    const messageQueueTest = createServiceTest({
      name: 'message-queue',
      type: 'messaging',
      endpoint: 'amqp://localhost:5672',
      config: { exchange: 'test' }
    });

    testRunner.addServiceTest(apiServiceTest);
    testRunner.addServiceTest(databaseServiceTest);
    testRunner.addServiceTest(messageQueueTest);

    // Mock service implementations
    const mockHealthChecker = new (class {
      async checkHealth(service: any) {
        return true;
      }
    })();

    const mockDatabaseTester = new (class {
      async testConnectivity(services: any) {
        return [];
      }
      async testPerformance(services: any) {
        return [];
      }
      async testQueries(services: any) {
        return [];
      }
      async testTransactions(services: any) {
        return [];
      }
    })();

    testRunner.healthChecker = mockHealthChecker;
    testRunner.databaseTester = mockDatabaseTester;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Communication', () => {
    test('should validate service connectivity', async () => {
      const results = await testRunner.runHealthChecks();

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'pass')).toBe(true);
    });

    test('should handle service communication failures', async () => {
      // Mock health checker to return failure
      testRunner.healthChecker.checkHealth = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const results = await testRunner.runHealthChecks();

      expect(results).toHaveLength(3);
      expect(results.some(r => r.status === 'fail')).toBe(true);
    });
  });

  describe('User Service Integration', () => {
    test('should create user through API', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const user = await apiService.createUser(userData);

      expect(user).toHaveProperty('id');
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
    });

    test('should validate required fields on user creation', async () => {
      const invalidUserData = {
        name: 'John Doe'
        // missing email
      };

      await expect(apiService.createUser(invalidUserData))
        .rejects.toThrow('Missing required fields');
    });

    test('should prevent duplicate user creation', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Create first user
      await apiService.createUser(userData);

      // Try to create duplicate
      await expect(apiService.createUser(userData))
        .rejects.toThrow('User already exists');
    });

    test('should retrieve user by ID', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      const createdUser = await apiService.createUser(userData);
      const retrievedUser = await apiService.getUser(createdUser.id);

      expect(retrievedUser).toEqual(createdUser);
    });

    test('should return null for non-existent user', async () => {
      const user = await apiService.getUser('non-existent-id');
      expect(user).toBeNull();
    });

    test('should update existing user', async () => {
      const userData = {
        name: 'Original Name',
        email: 'original@example.com'
      };

      const createdUser = await apiService.createUser(userData);
      const updates = { name: 'Updated Name' };

      const updatedUser = await apiService.updateUser(createdUser.id, updates);

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.email).toBe(userData.email);
    });

    test('should throw error when updating non-existent user', async () => {
      await expect(apiService.updateUser('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow('User not found');
    });

    test('should delete existing user', async () => {
      const userData = {
        name: 'To Be Deleted',
        email: 'delete@example.com'
      };

      const createdUser = await apiService.createUser(userData);
      const result = await apiService.deleteUser(createdUser.id);

      expect(result).toBe(true);
      const deletedUser = await apiService.getUser(createdUser.id);
      expect(deletedUser).toBeNull();
    });

    test('should return all users', async () => {
      const users = [
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
        { name: 'User 3', email: 'user3@example.com' }
      ];

      // Create users
      for (const userData of users) {
        await apiService.createUser(userData);
      }

      const allUsers = await apiService.getAllUsers();
      expect(allUsers).toHaveLength(users.length);
    });
  });

  describe('Event Publishing', () => {
    test('should publish user created event', async () => {
      const userData = {
        name: 'Event Test User',
        email: 'event@example.com'
      };

      await apiService.createUser(userData);

      const queueSize = await messageQueue.getQueueSize('user-events');
      expect(queueSize).toBe(1);
    });

    test('should publish user updated event', async () => {
      const userData = {
        name: 'Original Name',
        email: 'update@example.com'
      };

      const createdUser = await apiService.createUser(userData);
      await apiService.updateUser(createdUser.id, { name: 'Updated Name' });

      const queueSize = await messageQueue.getQueueSize('user-events');
      expect(queueSize).toBe(2); // create + update events
    });

    test('should publish user deleted event', async () => {
      const userData = {
        name: 'To Be Deleted',
        email: 'delete-event@example.com'
      };

      const createdUser = await apiService.createUser(userData);
      await apiService.deleteUser(createdUser.id);

      const queueSize = await messageQueue.getQueueSize('user-events');
      expect(queueSize).toBe(2); // create + delete events
    });
  });

  describe('Database Transactions', () => {
    test('should handle database operations within transactions', async () => {
      // This would test transaction behavior
      // For mock implementation, we'll simulate
      let transactionStarted = false;
      let transactionCommitted = false;

      const mockDatabaseService = new (class extends MockDatabaseService {
        async beginTransaction() {
          transactionStarted = true;
        }
        async commit() {
          transactionCommitted = true;
        }
      })();

      const apiServiceWithMockDb = new APIService(httpService, mockDatabaseService, messageQueue);

      const userData = {
        name: 'Transaction Test',
        email: 'transaction@example.com'
      };

      await apiServiceWithMockDb.createUser(userData);

      expect(transactionStarted).toBe(true);
      expect(transactionCommitted).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    test('should execute complete user workflow scenario', async () => {
      const scenario: IntegrationScenario = {
        name: 'Complete User Workflow',
        description: 'Test the complete user lifecycle: create, retrieve, update, delete',
        initialize: async (services: any) => {
          console.log('Initializing user workflow scenario');
        },
        testCases: [
          {
            name: 'Create user',
            async execute(services: any) {
              const userData = {
                name: 'Workflow User',
                email: 'workflow@example.com'
              };

              const user = await apiService.createUser(userData);
              return {
                status: 'pass' as const,
                metadata: { userId: user.id }
              };
            }
          },
          {
            name: 'Retrieve user',
            async execute(services: any) {
              const userData = {
                name: 'Retrieve User',
                email: 'retrieve@example.com'
              };

              const createdUser = await apiService.createUser(userData);
              const retrievedUser = await apiService.getUser(createdUser.id);

              return {
                status: retrievedUser ? 'pass' as const : 'fail' as const,
                metadata: { userId: createdUser.id }
              };
            }
          },
          {
            name: 'Update user',
            async execute(services: any) {
              const userData = {
                name: 'Update User',
                email: 'update-workflow@example.com'
              };

              const createdUser = await apiService.createUser(userData);
              await apiService.updateUser(createdUser.id, { name: 'Updated Workflow User' });

              const updatedUser = await apiService.getUser(createdUser.id);
              return {
                status: updatedUser && updatedUser.name.includes('Updated') ? 'pass' as const : 'fail' as const,
                metadata: { userId: createdUser.id }
              };
            }
          },
          {
            name: 'Delete user',
            async execute(services: any) {
              const userData = {
                name: 'Delete User',
                email: 'delete-workflow@example.com'
              };

              const createdUser = await apiService.createUser(userData);
              await apiService.deleteUser(createdUser.id);

              const deletedUser = await apiService.getUser(createdUser.id);
              return {
                status: deletedUser === null ? 'pass' as const : 'fail' as const,
                metadata: { userId: createdUser.id }
              };
            }
          }
        ],
        cleanup: async (services: any) => {
          console.log('Cleaning up user workflow scenario');
        }
      };

      testRunner.addScenario(scenario);
      const results = await testRunner.runScenarios();

      expect(results.length).toBe(4);
      expect(results.every(r => r.status === 'pass')).toBe(true);
    });

    test('should handle scenario failure gracefully', async () => {
      const failingScenario: IntegrationScenario = {
        name: 'Failing Scenario',
        description: 'A scenario with a failing test case',
        initialize: async () => {},
        testCases: [
          {
            name: 'Passing test',
            async execute() {
              return { status: 'pass' as const };
            }
          },
          {
            name: 'Failing test',
            async execute() {
              throw new Error('This test fails');
            }
          }
        ],
        cleanup: async () => {}
      };

      testRunner.addScenario(failingScenario);
      const results = await testRunner.runScenarios();

      expect(results.length).toBe(2);
      expect(results[0].status).toBe('pass');
      expect(results[1].status).toBe('error');
    });
  });

  describe('Performance Integration', () => {
    test('should measure integration test performance', async () => {
      const start = performance.now();

      // Simulate multiple API calls
      for (let i = 0; i < 100; i++) {
        const userData = {
          name: `Performance User ${i}`,
          email: `perf${i}@example.com`
        };
        await apiService.createUser(userData);
      }

      const end = performance.now();
      const duration = end - start;

      console.log(`Integration performance test took ${duration.toFixed(2)}ms`);
      expect(duration).toBeGreaterThan(0);
    });

    test('should handle concurrent requests', async () => {
      const concurrentCount = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentCount; i++) {
        const userData = {
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@example.com`
        };
        promises.push(apiService.createUser(userData));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentCount);
      expect(results.every(r => r.id !== undefined)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle service unavailability', async () => {
      // Mock database service to fail
      const failingDatabaseService = new (class extends MockDatabaseService {
        async execute(sql: string, params?: any[]) {
          throw new Error('Database connection failed');
        }
      })();

      const failingAPIService = new APIService(httpService, failingDatabaseService, messageQueue);

      await expect(failingAPIService.createUser({
        name: 'Fail User',
        email: 'fail@example.com'
      })).rejects.toThrow('Database connection failed');
    });

    test('should handle message queue failures', async () => {
      // Mock message queue to fail
      const failingMessageQueue = new (class extends MockMessageQueue {
        async publish(queue: string, message: any): Promise<void> {
          throw new Error('Message queue unavailable');
        }
      })();

      const failingAPIService = new APIService(httpService, databaseService, failingMessageQueue);

      // User creation should still work but event publishing should fail
      await expect(failingAPIService.createUser({
        name: 'Queue Fail User',
        email: 'queue-fail@example.com'
      })).resolves.toHaveProperty('id');
    });
  });

  describe('Integration Validation', () => {
    test('should validate integration setup', async () => {
      const validation = await testRunner.validateSetup();

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    test('should provide integration statistics', () => {
      const stats = testRunner.getIntegrationStats();

      expect(stats).toBeDefined();
      expect(stats.services).toBe(3);
      expect(stats.tests).toBe(0); // No tests added yet
      expect(stats.scenarios).toBe(0);
    });
  });

  describe('Integration Reporting', () => {
    test('should generate comprehensive integration report', async () => {
      // Add some test data
      const scenario: IntegrationScenario = {
        name: 'Report Test Scenario',
        description: 'Test scenario for reporting',
        initialize: async () => {},
        testCases: [
          {
            name: 'Test case 1',
            execute: async () => ({ status: 'pass' as const })
          },
          {
            name: 'Test case 2',
            execute: async () => ({ status: 'pass' as const })
          }
        ],
        cleanup: async () => {}
      };

      testRunner.addScenario(scenario);
      const report = await testRunner.generateIntegrationReport();

      expect(report).toBeDefined();
      expect(report.stats).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.scenarios).toHaveLength(1);
      expect(report.services).toHaveLength(3);
    });
  });
});

// Export services for external use
export {
  MockHTTPService,
  MockDatabaseService,
  MockMessageQueue,
  APIService
};