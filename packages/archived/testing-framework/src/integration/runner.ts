import { TestRunner, TestConfig } from '../core';
import { IntegrationTestSuite, IntegrationTestCase, TestResult } from './types';
import { IntegrationScenario } from './scenarios';
import { Logger } from '../core/logger';

/**
 * Integration test runner specialized for multi-service testing
 */
export class IntegrationTestRunner extends TestRunner {
  private scenarios: IntegrationScenario[] = [];
  private services: Map<string, ServiceTest> = new Map();
  private networkTester: NetworkTester;
  private databaseTester: DatabaseTester;
  private messagingTester: MessagingTester;
  private loadTester: LoadTester;
  private healthChecker: HealthChecker;
  private circuitBreaker: CircuitBreaker;
  private metricsCollector: MetricsCollector;
  private logger: Logger;

  constructor(config: TestConfig) {
    super(config);
    this.logger = new Logger({ name: 'IntegrationTestRunner' });

    this.networkTester = new NetworkTester();
    this.databaseTester = new DatabaseTester();
    this.messagingTester = new MessagingTester();
    this.loadTester = new LoadTester();
    this.healthChecker = new HealthChecker();
    this.circuitBreaker = new CircuitBreaker();
    this.metricsCollector = new MetricsCollector();
  }

  /**
   * Add integration scenario
   */
  addScenario(scenario: IntegrationScenario): void {
    this.scenarios.push(scenario);
    this.logger.info(`Added integration scenario: ${scenario.name}`);
  }

  /**
   * Add service test
   */
  addServiceTest(service: ServiceTest): void {
    this.services.set(service.name, service);
    this.logger.info(`Added service test: ${service.name}`);
  }

  /**
   * Run all integration tests
   */
  async runIntegrationTests(): Promise<TestResult[]> {
    this.logger.info('Starting integration test run...');

    const results: TestResult[] = [];

    // Run service health checks
    await this.runHealthChecks();

    // Run network tests
    const networkResults = await this.runNetworkTests();
    results.push(...networkResults);

    // Run database tests
    const databaseResults = await this.runDatabaseTests();
    results.push(...databaseResults);

    // Run messaging tests
    const messagingResults = await this.runMessagingTests();
    results.push(...messagingResults);

    // Run load tests
    const loadResults = await this.runLoadTests();
    results.push(...loadResults);

    // Run integration scenarios
    const scenarioResults = await this.runScenarios();
    results.push(...scenarioResults);

    return results;
  }

  /**
   * Run health checks for all services
   */
  private async runHealthChecks(): Promise<TestResult[]> {
    this.logger.info('Running service health checks...');

    const results: TestResult[] = [];

    for (const service of this.services.values()) {
      try {
        const isHealthy = await this.healthChecker.checkHealth(service);
        results.push({
          name: `${service.name}-health`,
          status: isHealthy ? 'pass' : 'fail',
          duration: 0,
          error: isHealthy ? undefined : new Error(`Service ${service.name} is unhealthy`),
          metadata: { service: service.name }
        });
      } catch (error) {
        results.push({
          name: `${service.name}-health`,
          status: 'error',
          duration: 0,
          error: error instanceof Error ? error : new Error(String(error)),
          metadata: { service: service.name }
        });
      }
    }

    return results;
  }

  /**
   * Run network tests
   */
  private async runNetworkTests(): Promise<TestResult[]> {
    this.logger.info('Running network tests...');

    const results: TestResult[] = [];

    // Test connectivity between services
    const connectivityResults = await this.networkTester.testConnectivity(this.services);
    results.push(...connectivityResults);

    // Test load balancing
    const loadBalancerResults = await this.networkTester.testLoadBalancing(this.services);
    results.push(...loadBalancerResults);

    // Test service discovery
    const discoveryResults = await this.networkTester.testServiceDiscovery(this.services);
    results.push(...discoveryResults);

    return results;
  }

  /**
   * Run database tests
   */
  private async runDatabaseTests(): Promise<TestResult[]> {
    this.logger.info('Running database tests...');

    const results: TestResult[] = [];

    // Test database connectivity
    const connectivityResults = await this.databaseTester.testConnectivity(this.services);
    results.push(...connectivityResults);

    // Test database performance
    const performanceResults = await this.databaseTester.testPerformance(this.services);
    results.push(...performanceResults);

    // Test database queries
    const queryResults = await this.databaseTester.testQueries(this.services);
    results.push(...queryResults);

    // Test database transactions
    const transactionResults = await this.databaseTester.testTransactions(this.services);
    results.push(...transactionResults);

    return results;
  }

  /**
   * Run messaging tests
   */
  private async runMessagingTests(): Promise<TestResult[]> {
    this.logger.info('Running messaging tests...');

    const results: TestResult[] = [];

    // Test message delivery
    const deliveryResults = await this.messagingTester.testMessageDelivery(this.services);
    results.push(...deliveryResults);

    // Test message throughput
    const throughputResults = await this.messagingTester.testThroughput(this.services);
    results.push(...throughputResults);

    // Test message persistence
    const persistenceResults = await this.messagingTester.testPersistence(this.services);
    results.push(...persistenceResults);

    // Test message ordering
    const orderingResults = await this.messagingTester.testOrdering(this.services);
    results.push(...orderingResults);

    return results;
  }

  /**
   * Run load tests
   */
  private async runLoadTests(): Promise<TestResult[]> {
    this.logger.info('Running load tests...');

    const results: TestResult[] = [];

    // Test service under load
    const serviceLoadResults = await this.loadTester.testServiceLoad(this.services);
    results.push(...serviceLoadResults);

    // Test system under load
    const systemLoadResults = await this.loadTester.testSystemLoad(this.services);
    results.push(...systemLoadResults);

    // Test database under load
    const databaseLoadResults = await this.loadTester.testDatabaseLoad(this.services);
    results.push(...databaseLoadResults);

    return results;
  }

  /**
   * Run integration scenarios
   */
  private async runScenarios(): Promise<TestResult[]> {
    this.logger.info('Running integration scenarios...');

    const results: TestResult[] = [];

    for (const scenario of this.scenarios) {
      try {
        const scenarioResults = await this.runScenario(scenario);
        results.push(...scenarioResults);
      } catch (error) {
        this.logger.error(`Scenario ${scenario.name} failed:`, error);
        results.push({
          name: scenario.name,
          status: 'error',
          duration: 0,
          error: error instanceof Error ? error : new Error(String(error)),
          metadata: { scenario: scenario.name }
        });
      }
    }

    return results;
  }

  /**
   * Run a single integration scenario
   */
  private async runScenario(scenario: IntegrationScenario): Promise<TestResult[]> {
    this.logger.info(`Running scenario: ${scenario.name}`);

    const results: TestResult[] = [];

    try {
      // Initialize scenario
      await scenario.initialize(this.services);

      // Run test cases
      for (const testCase of scenario.testCases) {
        const startTime = Date.now();

        try {
          const result = await testCase.execute(this.services);

          results.push({
            name: `${scenario.name}.${testCase.name}`,
            status: result.status,
            duration: Date.now() - startTime,
            error: result.error,
            metadata: {
              scenario: scenario.name,
              testCase: testCase.name,
              ...result.metadata
            }
          });
        } catch (error) {
          results.push({
            name: `${scenario.name}.${testCase.name}`,
            status: 'error',
            duration: Date.now() - startTime,
            error: error instanceof Error ? error : new Error(String(error)),
            metadata: {
              scenario: scenario.name,
              testCase: testCase.name
            }
          });
        }
      }

      // Cleanup scenario
      await scenario.cleanup(this.services);

    } catch (error) {
      this.logger.error(`Scenario initialization failed for ${scenario.name}:`, error);
      results.push({
        name: scenario.name,
        status: 'error',
        duration: 0,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { scenario: scenario.name }
      });
    }

    return results;
  }

  /**
   * Get integration test statistics
   */
  getIntegrationStats(): IntegrationStats {
    const totalTests = this.scenarios.reduce((sum, scenario) => sum + scenario.testCases.length, 0);
    const totalServices = this.services.size;
    const totalScenarios = this.scenarios.length;

    return {
      scenarios: totalScenarios,
      services: totalServices,
      tests: totalTests,
      averageScenarioSize: totalScenarios > 0 ? totalTests / totalScenarios : 0,
      serviceCoverage: (totalServices / (totalServices + 1)) * 100 // +1 to avoid division by zero
    };
  }

  /**
   * Generate integration test report
   */
  async generateIntegrationReport(): Promise<IntegrationReport> {
    const stats = this.getIntegrationStats();
    const results = await this.runIntegrationTests();

    const report: IntegrationReport = {
      timestamp: Date.now(),
      stats,
      results,
      scenarios: this.scenarios,
      services: Array.from(this.services.values())
    };

    return report;
  }

  /**
   * Validate integration test setup
   */
  async validateSetup(): Promise<ValidationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const checks: ValidationCheck[] = [];

    // Check service connectivity
    for (const service of this.services.values()) {
      try {
        const isHealthy = await this.healthChecker.checkHealth(service);
        if (!isHealthy) {
          issues.push(`Service ${service.name} is not healthy`);
        }
        checks.push({
          name: `health-${service.name}`,
          passed: isHealthy,
          message: isHealthy ? 'Service is healthy' : 'Service is unhealthy'
        });
      } catch (error) {
        issues.push(`Cannot check health of service ${service.name}: ${error}`);
        checks.push({
          name: `health-${service.name}`,
          passed: false,
          message: `Health check failed: ${error}`
        });
      }
    }

    // Check database connectivity
    try {
      const dbChecks = await this.databaseTester.testConnectivity(this.services);
      for (const check of dbChecks) {
        if (!check.passed) {
          warnings.push(`Database connectivity issue: ${check.message}`);
        }
        checks.push({
          name: `db-${check.service}`,
          passed: check.passed,
          message: check.message
        });
      }
    } catch (error) {
      warnings.push(`Database connectivity check failed: ${error}`);
    }

    // Check messaging connectivity
    try {
      const msgChecks = await this.messagingTester.testConnectivity(this.services);
      for (const check of msgChecks) {
        if (!check.passed) {
          warnings.push(`Messaging connectivity issue: ${check.message}`);
        }
        checks.push({
          name: `msg-${check.service}`,
          passed: check.passed,
          message: check.message
        });
      }
    } catch (error) {
      warnings.push(`Messaging connectivity check failed: ${error}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      checks
    };
  }
}

/**
 * Create integration test runner instance
 */
export function createIntegrationTestRunner(config: TestConfig): IntegrationTestRunner {
  return new IntegrationTestRunner(config);
}

/**
 * Integration test suite interface
 */
export interface IntegrationTestSuite {
  name: string;
  description?: string;
  scenarios: IntegrationScenario[];
  services: ServiceTest[];
  config?: TestConfig;
}

/**
 * Integration test case interface
 */
export interface IntegrationTestCase {
  name: string;
  description?: string;
  execute: (services: Map<string, ServiceTest>) => Promise<{
    status: 'pass' | 'fail';
    error?: Error;
    metadata?: Record<string, any>;
  }>;
  timeout?: number;
  dependencies?: string[];
}

/**
 * Service test interface
 */
export interface ServiceTest {
  name: string;
  type: 'http' | 'grpc' | 'database' | 'messaging' | 'cache';
  endpoint: string;
  config: any;
  healthCheck?: {
    endpoint: string;
    expectedStatus?: number;
    timeout?: number;
  };
}

/**
 * Network tester interface
 */
export interface NetworkTester {
  testConnectivity(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testLoadBalancing(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testServiceDiscovery(services: Map<string, ServiceTest>): Promise<TestResult[]>;
}

/**
 * Database tester interface
 */
export interface DatabaseTester {
  testConnectivity(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testPerformance(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testQueries(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testTransactions(services: Map<string, ServiceTest>): Promise<TestResult[]>;
}

/**
 * Messaging tester interface
 */
export interface MessagingTester {
  testConnectivity(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testMessageDelivery(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testThroughput(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testPersistence(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testOrdering(services: Map<string, ServiceTest>): Promise<TestResult[]>;
}

/**
 * Load tester interface
 */
export interface LoadTester {
  testServiceLoad(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testSystemLoad(services: Map<string, ServiceTest>): Promise<TestResult[]>;
  testDatabaseLoad(services: Map<string, ServiceTest>): Promise<TestResult[]>;
}

/**
 * Health checker interface
 */
export interface HealthChecker {
  checkHealth(service: ServiceTest): Promise<boolean>;
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  execute<T>(service: ServiceTest, operation: () => Promise<T>): Promise<T>;
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  collectMetrics(): Promise<TestResult[]>;
  startCollecting(): void;
  stopCollecting(): void;
}

/**
 * Integration statistics interface
 */
export interface IntegrationStats {
  scenarios: number;
  services: number;
  tests: number;
  averageScenarioSize: number;
  serviceCoverage: number;
}

/**
 * Integration report interface
 */
export interface IntegrationReport {
  timestamp: number;
  stats: IntegrationStats;
  results: TestResult[];
  scenarios: IntegrationScenario[];
  services: ServiceTest[];
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  checks: ValidationCheck[];
}

/**
 * Validation check interface
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}