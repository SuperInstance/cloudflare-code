import { describe, test, expect, beforeEach, afterEach, mock, jest } from '../src/unit/jest-compat';
import { createIntegrationTestRunner } from '../src/integration/runner';
import { IntegrationScenario, ServiceTest } from '../src/integration/types';
import { HealthChecker, DatabaseTester, MessagingTester, LoadTester } from '../src/integration/runner';

describe('Integration Testing', () => {
  let testRunner: any;
  let mockServices: Map<string, ServiceTest>;

  beforeEach(() => {
    testRunner = createIntegrationTestRunner({
      pattern: ['**/*.integration.ts'],
      testDir: ['integration'],
      maxParallel: 2
    });

    mockServices = new Map([
      [
        'api-service',
        {
          name: 'api-service',
          type: 'http',
          endpoint: 'http://localhost:3000',
          config: { timeout: 5000 },
          healthCheck: {
            endpoint: 'http://localhost:3000/health',
            expectedStatus: 200
          }
        }
      ],
      [
        'database-service',
        {
          name: 'database-service',
          type: 'database',
          endpoint: 'postgresql://localhost:5432/test',
          config: { connectionPool: 10 }
        }
      ],
      [
        'message-service',
        {
          name: 'message-service',
          type: 'messaging',
          endpoint: 'amqp://localhost:5672',
          config: { exchange: 'test' }
        }
      ]
    ]);

    // Mock health checker
    const mockHealthChecker = new HealthChecker();
    mockHealthChecker.checkHealth = jest.fn().mockResolvedValue(true);
    testRunner.healthChecker = mockHealthChecker;

    // Mock database tester
    const mockDatabaseTester = new DatabaseTester();
    mockDatabaseTester.testConnectivity = jest.fn().mockResolvedValue([]);
    mockDatabaseTester.testPerformance = jest.fn().mockResolvedValue([]);
    mockDatabaseTester.testQueries = jest.fn().mockResolvedValue([]);
    mockDatabaseTester.testTransactions = jest.fn().mockResolvedValue([]);
    testRunner.databaseTester = mockDatabaseTester;

    // Mock messaging tester
    const mockMessagingTester = new MessagingTester();
    mockMessagingTester.testConnectivity = jest.fn().mockResolvedValue([]);
    mockMessagingTester.testMessageDelivery = jest.fn().mockResolvedValue([]);
    mockMessagingTester.testThroughput = jest.fn().mockResolvedValue([]);
    mockMessagingTester.testPersistence = jest.fn().mockResolvedValue([]);
    mockMessagingTester.testOrdering = jest.fn().mockResolvedValue([]);
    testRunner.messagingTester = mockMessagingTester;

    // Mock load tester
    const mockLoadTester = new LoadTester();
    mockLoadTester.testServiceLoad = jest.fn().mockResolvedValue([]);
    mockLoadTester.testSystemLoad = jest.fn().mockResolvedValue([]);
    mockLoadTester.testDatabaseLoad = jest.fn().mockResolvedValue([]);
    testRunner.loadTester = mockLoadTester;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Health Checks', () => {
    test('should check service health successfully', async () => {
      const results = await testRunner.runHealthChecks();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Verify health checker was called
      expect(testRunner.healthChecker.checkHealth).toHaveBeenCalledTimes(3);
    });

    test('should handle service health failures', async () => {
      // Mock health checker to return false for one service
      testRunner.healthChecker.checkHealth = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const results = await testRunner.runHealthChecks();

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('pass');
      expect(results[1].status).toBe('fail');
      expect(results[2].status).toBe('pass');
    });

    test('should handle health check errors', async () => {
      // Mock health checker to throw an error
      testRunner.healthChecker.checkHealth = jest.fn()
        .mockRejectedValueOnce(new Error('Connection failed'));

      const results = await testRunner.runHealthChecks();

      expect(results[0].status).toBe('error');
      expect(results[0].error?.message).toBe('Connection failed');
    });
  });

  describe('Network Testing', () => {
    test('should run network connectivity tests', async () => {
      const results = await testRunner.runNetworkTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should run load balancing tests', async () => {
      const results = await testRunner.runLoadBalancingTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should run service discovery tests', async () => {
      const results = await testRunner.runServiceDiscoveryTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Database Testing', () => {
    test('should run database connectivity tests', async () => {
      const results = await testRunner.runDatabaseTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Verify database tester was called
      expect(testRunner.databaseTester.testConnectivity).toHaveBeenCalled();
    });

    test('should run database performance tests', async () => {
      const results = await testRunner.runDatabasePerformanceTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.databaseTester.testPerformance).toHaveBeenCalled();
    });

    test('should run database query tests', async () => {
      const results = await testRunner.runDatabaseQueryTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.databaseTester.testQueries).toHaveBeenCalled();
    });

    test('should run transaction tests', async () => {
      const results = await testRunner.runTransactionTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.databaseTester.testTransactions).toHaveBeenCalled();
    });
  });

  describe('Messaging Testing', () => {
    test('should run messaging connectivity tests', async () => {
      const results = await testRunner.runMessagingTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.messagingTester.testConnectivity).toHaveBeenCalled();
    });

    test('should run message delivery tests', async () => {
      const results = await testRunner.runMessageDeliveryTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.messagingTester.testMessageDelivery).toHaveBeenCalled();
    });

    test('should run throughput tests', async () => {
      const results = await testRunner.runThroughputTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.messagingTester.testThroughput).toHaveBeenCalled();
    });

    test('should run persistence tests', async () => {
      const results = await testRunner.runPersistenceTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.messagingTester.testPersistence).toHaveBeenCalled();
    });

    test('should run message ordering tests', async () => {
      const results = await testRunner.runOrderingTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.messagingTester.testOrdering).toHaveBeenCalled();
    });
  });

  describe('Load Testing', () => {
    test('should run service load tests', async () => {
      const results = await testRunner.runLoadTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.loadTester.testServiceLoad).toHaveBeenCalled();
    });

    test('should run system load tests', async () => {
      const results = await testRunner.runSystemLoadTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.loadTester.testSystemLoad).toHaveBeenCalled();
    });

    test('should run database load tests', async () => {
      const results = await testRunner.runDatabaseLoadTests();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      expect(testRunner.loadTester.testDatabaseLoad).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    test('should run integration scenarios', async () => {
      const scenario: IntegrationScenario = {
        name: 'User Authentication Flow',
        description: 'Test complete user authentication flow across services',
        initialize: jest.fn(),
        testCases: [],
        cleanup: jest.fn()
      };

      testRunner.addScenario(scenario);

      const results = await testRunner.runScenarios();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Verify scenario was initialized
      expect(scenario.initialize).toHaveBeenCalled();
    });

    test('should handle scenario initialization failures', async () => {
      const scenario: IntegrationScenario = {
        name: 'Failed Scenario',
        description: 'A scenario that fails to initialize',
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        testCases: [],
        cleanup: jest.fn()
      };

      testRunner.addScenario(scenario);

      const results = await testRunner.runScenarios();

      expect(results.length).toBe(1);
      expect(results[0].status).toBe('error');
      expect(results[0].error?.message).toBe('Initialization failed');
    });

    test('should handle scenario execution errors', async () => {
      const testCase = {
        name: 'Failing Test Case',
        execute: jest.fn().mockRejectedValue(new Error('Test case failed'))
      };

      const scenario: IntegrationScenario = {
        name: 'Scenario with Failure',
        description: 'A scenario with a failing test case',
        initialize: jest.fn(),
        testCases: [testCase as any],
        cleanup: jest.fn()
      };

      testRunner.addScenario(scenario);

      const results = await testRunner.runScenarios();

      expect(results.length).toBe(1);
      expect(results[0].status).toBe('error');
      expect(results[0].error?.message).toBe('Test case failed');
    });
  });

  describe('Integration Statistics', () => {
    test('should calculate integration statistics', () => {
      testRunner.addServiceTest(mockServices.get('api-service')!);
      testRunner.addServiceTest(mockServices.get('database-service')!);
      testRunner.addServiceTest(mockServices.get('message-service')!);

      const stats = testRunner.getIntegrationStats();

      expect(stats).toBeDefined();
      expect(stats.scenarios).toBe(0);
      expect(stats.services).toBe(3);
      expect(stats.tests).toBe(0);
      expect(stats.averageScenarioSize).toBe(0);
      expect(stats.serviceCoverage).toBeGreaterThan(0);
    });

    test('should provide comprehensive test coverage', () => {
      const scenario: IntegrationScenario = {
        name: 'Coverage Test',
        description: 'Test scenario to verify coverage',
        initialize: jest.fn(),
        testCases: [
          { name: 'Test 1', execute: jest.fn() },
          { name: 'Test 2', execute: jest.fn() },
          { name: 'Test 3', execute: jest.fn() }
        ],
        cleanup: jest.fn()
      };

      testRunner.addScenario(scenario);
      testRunner.addServiceTest(mockServices.get('api-service')!);

      const stats = testRunner.getIntegrationStats();

      expect(stats.scenarios).toBe(1);
      expect(stats.tests).toBe(3);
      expect(stats.averageScenarioSize).toBe(3);
    });
  });

  describe('Validation', () => {
    test('should validate integration test setup', async () => {
      const validation = await testRunner.validateSetup();

      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.issues).toBeDefined();
      expect(validation.warnings).toBeDefined();
      expect(validation.checks).toBeDefined();

      // Since health checks are mocked to pass, validation should be valid
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should detect setup issues', async () => {
      // Mock health checker to return false for all services
      testRunner.healthChecker.checkHealth = jest.fn().mockResolvedValue(false);

      const validation = await testRunner.validateSetup();

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);

      // Check that issues were added
      expect(validation.issues.some(issue => issue.includes('not healthy'))).toBe(true);
    });

    test('should provide detailed validation checks', async () => {
      const validation = await testRunner.validateSetup();

      expect(validation.checks).toHaveLength(3); // 3 services

      const healthCheck = validation.checks.find(check => check.name.startsWith('health-'));
      expect(healthCheck).toBeDefined();
      expect(healthCheck?.passed).toBe(true);
      expect(healthCheck?.message).toBe('Service is healthy');
    });
  });

  describe('Test Reporting', () => {
    test('should generate integration test report', async () => {
      const report = await testRunner.generateIntegrationReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.stats).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.scenarios).toBeDefined();
      expect(report.services).toBeDefined();

      expect(Array.isArray(report.results)).toBe(true);
      expect(Array.isArray(report.scenarios)).toBe(true);
      expect(Array.isArray(report.services)).toBe(true);
    });

    test('should provide comprehensive report data', async () => {
      // Add test data
      testRunner.addServiceTest(mockServices.get('api-service')!);

      const report = await testRunner.generateIntegrationReport();

      expect(report.stats.services).toBe(1);
      expect(report.services.length).toBe(1);
      expect(report.services[0].name).toBe('api-service');
    });
  });
});