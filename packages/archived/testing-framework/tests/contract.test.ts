import { describe, test, expect, beforeEach, afterEach, jest } from '../src/unit/jest-compat';
import {
  Contract,
  ContractTestConfig,
  ContractTestRunner,
  ContractRegistry,
  ContractGenerator,
  ContractTestResults,
  DEFAULT_CONTRACT_TEST_CONFIG
} from '../src/contract';

describe('Contract Testing', () => {
  let registry: ContractRegistry;
  let testRunner: ContractTestRunner;
  let mockContract: Contract;

  beforeEach(() => {
    registry = new ContractRegistry();
    testRunner = new ContractTestRunner();
    mockContract = {
      id: 'test-contract-1',
      name: 'Test API Contract',
      version: '1.0.0',
      provider: 'http://localhost:3000',
      consumer: 'test-service',
      specification: {
        openapi: {
          openapi: '3.0.0',
          info: {
            title: 'Test API',
            version: '1.0.0'
          },
          servers: [{ url: 'http://localhost:3000' }],
          paths: {
            '/users': {
              get: {
                operationId: 'getUsers',
                responses: {
                  '200': {
                    description: 'OK'
                  }
                }
              }
            }
          }
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Contract Registry', () => {
    test('should register and retrieve contracts', () => {
      registry.register(mockContract);

      const retrieved = registry.getContract('test-contract-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-contract-1');
    });

    test('should get all contracts', () => {
      registry.register(mockContract);
      const anotherContract = { ...mockContract, id: 'test-contract-2' };
      registry.register(anotherContract);

      const allContracts = registry.getAllContracts();
      expect(allContracts).toHaveLength(2);
      expect(allContracts.map(c => c.id)).toContain('test-contract-1');
      expect(allContracts.map(c => c.id)).toContain('test-contract-2');
    });

    test('should remove contracts', () => {
      registry.register(mockContract);
      expect(registry.getContract('test-contract-1')).toBeDefined();

      const removed = registry.removeContract('test-contract-1');
      expect(removed).toBe(true);
      expect(registry.getContract('test-contract-1')).toBeUndefined();
    });

    test('should get contracts by provider', () => {
      registry.register(mockContract);
      const anotherContract = {
        ...mockContract,
        id: 'test-contract-2',
        provider: 'http://localhost:3001'
      };
      registry.register(anotherContract);

      const localhostContracts = registry.getContractsByProvider('localhost:3000');
      expect(localhostContracts).toHaveLength(1);
      expect(localhostContracts[0].provider).toBe('http://localhost:3000');
    });

    test('should get contracts by consumer', () => {
      registry.register(mockContract);
      const anotherContract = {
        ...mockContract,
        id: 'test-contract-2',
        consumer: 'another-service'
      };
      registry.register(anotherContract);

      const testServiceContracts = registry.getContractsByConsumer('test-service');
      expect(testServiceContracts).toHaveLength(1);
      expect(testServiceContracts[0].consumer).toBe('test-service');
    });

    test('should get contracts by status', () => {
      registry.register(mockContract);
      const activeContract = {
        ...mockContract,
        id: 'test-contract-2',
        status: 'active'
      };
      registry.register(activeContract);
      const pendingContract = {
        ...mockContract,
        id: 'test-contract-3',
        status: 'pending'
      };
      registry.register(pendingContract);

      const activeContracts = registry.getContractsByStatus('active');
      expect(activeContracts).toHaveLength(2);
      expect(activeContracts.every(c => c.status === 'active')).toBe(true);
    });
  });

  describe('Contract Generator', () => {
    test('should generate contract from OpenAPI', () => {
      const openapi = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        servers: [{ url: 'http://localhost:3000' }],
        paths: {}
      };

      const contract = ContractGenerator.fromOpenApi(openapi);

      expect(contract.name).toBe('Generated Contract');
      expect(contract.specification.openapi).toBe(openapi);
      expect(contract.status).toBe('active');
    });

    test('should generate contract from GraphQL', () => {
      const graphql = {
        name: 'Test GraphQL',
        version: '1.0.0',
        url: 'http://localhost:3000/graphql',
        queries: []
      };

      const contract = ContractGenerator.fromGraphQL(graphql);

      expect(contract.name).toBe('GraphQL Contract');
      expect(contract.specification.graphql).toBe(graphql);
    });

    test('should generate contract from AsyncAPI', () => {
      const asyncapi = {
        asyncapi: '2.0.0',
        info: {
          title: 'Test AsyncAPI',
          version: '1.0.0'
        },
        servers: [{ url: 'http://localhost:3000' }],
        channels: {}
      };

      const contract = ContractGenerator.fromAsyncApi(asyncapi);

      expect(contract.name).toBe('AsyncAPI Contract');
      expect(contract.specification.asyncapi).toBe(asyncapi);
    });
  });

  describe('Contract Test Runner', () => {
    test('should initialize with default config', () => {
      const runner = new ContractTestRunner();
      expect(runner).toBeDefined();
    });

    test('should initialize with custom config', () => {
      const customConfig: Partial<ContractTestConfig> = {
        baseUrl: 'http://localhost:8080',
        timeout: 10000
      };

      const runner = new ContractTestRunner(customConfig);
      expect(runner).toBeDefined();
    });

    test('should add contract to runner', () => {
      testRunner.addContract(mockContract);
      expect(testRunner).toBeDefined();
    });

    test('should generate test report', () => {
      testRunner.addContract(mockContract);

      const mockResults = new ContractTestResults();
      mockResults.duration = 1000;
      mockResults.isValid = true;

      const report = testRunner.generateReport(mockResults);
      expect(report).toContain('Contract Test Report');
      expect(report).toContain('✅ PASS');
      expect(report).toContain('1000ms');
    });
  });

  describe('Contract Test Results', () => {
    test('should initialize with default values', () => {
      const results = new ContractTestResults();

      expect(results.isValid).toBe(true);
      expect(results.validationResults).toEqual([]);
      expect(results.testResults).toEqual([]);
      expect(results.errors).toEqual([]);
      expect(results.warnings).toEqual([]);
      expect(results.startTime).toBeGreaterThan(0);
    });

    test('should add error and invalidate results', () => {
      const results = new ContractTestResults();

      results.addError('Test failed');

      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toBe('Test failed');
      expect(results.isValid).toBe(false);
    });

    test('should add warning', () => {
      const results = new ContractTestResults();

      results.addWarning('Warning message');

      expect(results.warnings).toHaveLength(1);
      expect(results.warnings[0]).toBe('Warning message');
    });

    test('should calculate test statistics', () => {
      const results = new ContractTestResults();

      results.validationResults = [
        { contractId: '1', isValid: true, errors: [], warnings: [], metadata: { validatedAt: new Date(), validatorVersion: '1.0.0', executionTime: 100, rules: [] } },
        { contractId: '2', isValid: true, errors: [], warnings: [], metadata: { validatedAt: new Date(), validatorVersion: '1.0.0', executionTime: 100, rules: [] } }
      ];

      results.testResults = [
        {
          contractId: '1',
          results: [
            { contractId: '1', testName: 'test1', passed: true, duration: 100, requests: [], responses: [] },
            { contractId: '1', testName: 'test2', passed: false, duration: 100, requests: [], responses: [], error: { message: 'Error' } }
          ]
        }
      ];

      expect(results.getTotalContracts()).toBe(2);
      expect(results.getTotalTests()).toBe(2);
      expect(results.getPassedTests()).toBe(1);
      expect(results.getFailedTests()).toBe(1);
      expect(results.getFailureRate()).toBe(50);
    });
  });

  describe('Default Configuration', () => {
    test('should have default contract test config', () => {
      expect(DEFAULT_CONTRACT_TEST_CONFIG.validateContracts).toBe(true);
      expect(DEFAULT_CONTRACT_TEST_CONFIG.testHttpServices).toBe(true);
      expect(DEFAULT_CONTRACT_TEST_CONFIG.timeout).toBe(5000);
      expect(DEFAULT_CONTRACT_TEST_CONFIG.retries).toBe(3);
      expect(DEFAULT_CONTRACT_TEST_CONFIG.parallel).toBe(true);
    });

    test('should allow partial config override', () => {
      const partialConfig = {
        baseUrl: 'http://localhost:8080',
        timeout: 3000
      };

      const config = { ...DEFAULT_CONTRACT_TEST_CONFIG, ...partialConfig };

      expect(config.baseUrl).toBe('http://localhost:8080');
      expect(config.timeout).toBe(3000);
      expect(config.validateContracts).toBe(true); // Should retain default
    });
  });

  describe('Contract Validation', () => {
    test('should fail validation for missing required fields', async () => {
      const invalidContract: Contract = {
        id: 'invalid-contract',
        name: '',
        version: '',
        provider: '',
        consumer: '',
        specification: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };

      registry.register(invalidContract);

      const validationResults = await registry.validateAllContracts();

      expect(validationResults).toHaveLength(1);
      expect(validationResults[0].isValid).toBe(false);
      expect(validationResults[0].errors.length).toBeGreaterThan(0);
    });

    test('should pass validation for complete contract', async () => {
      registry.register(mockContract);

      const validationResults = await registry.validateAllContracts();

      expect(validationResults).toHaveLength(1);
      expect(validationResults[0].isValid).toBe(true);
    });
  });

  describe('Contract Test Integration', () => {
    test('should run complete contract test flow', async () => {
      registry.register(mockContract);

      // Mock the test runner's validateContracts behavior
      testRunner.addContract(mockContract);

      // The actual test would make HTTP calls, but we'll test the structure
      expect(testRunner).toBeDefined();
    });

    test('should handle contract test failures gracefully', async () => {
      const failingContract: Contract = {
        ...mockContract,
        id: 'failing-contract',
        specification: {
          openapi: {
            openapi: '3.0.0',
            info: {
              title: 'Failing API',
              version: '1.0.0'
            },
            servers: [{ url: 'http://nonexistent-server:3000' }],
            paths: {
              '/error': {
                get: {
                  operationId: 'errorOperation',
                  responses: {
                    '200': { description: 'OK' }
                  }
                }
              }
            }
          }
        }
      };

      registry.register(failingContract);

      // The test runner should handle this gracefully
      const results = new ContractTestResults();
      results.testResults = [
        {
          contractId: 'failing-contract',
          results: [
            {
              contractId: 'failing-contract',
              testName: 'GET /error',
              passed: false,
              duration: 5000,
              error: { message: 'Connection failed', code: 'CONNECTION_ERROR' },
              requests: [],
              responses: []
            }
          ]
        }
      ];

      expect(results.isValid).toBe(false);
      expect(results.getFailedTests()).toBe(1);
    });
  });

  describe('Contract Management', () => {
    test('should handle multiple contracts', () => {
      const contracts = [
        { ...mockContract, id: 'contract-1' },
        { ...mockContract, id: 'contract-2' },
        { ...mockContract, id: 'contract-3' }
      ];

      contracts.forEach(contract => registry.register(contract));

      const allContracts = registry.getAllContracts();
      expect(allContracts).toHaveLength(3);

      const localhostContracts = registry.getContractsByProvider('localhost:3000');
      expect(localhostContracts).toHaveLength(3);
    });

    test('should handle contract version management', () => {
      const v1Contract = { ...mockContract, id: 'versioned-1', version: '1.0.0' };
      const v2Contract = { ...mockContract, id: 'versioned-2', version: '2.0.0' };

      registry.register(v1Contract);
      registry.register(v2Contract);

      const allContracts = registry.getAllContracts();
      const versions = allContracts.map(c => c.version);

      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
    });
  });
});