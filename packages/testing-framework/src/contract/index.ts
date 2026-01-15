/**
 * Contract Testing Module
 * Provides comprehensive contract testing capabilities for service interactions
 */

export { Contract, ContractSpecification, ContractValidationResult, TestResult, TestRequest, TestResponse, TestError, ValidationError } from './types';
export { ContractValidator, ContractRule, RuleValidationResult } from './validator';
export { ContractTester } from './tester';

// Utility classes and functions
export class ContractGenerator {
  /**
   * Generate contract from OpenAPI specification
   */
  static fromOpenApi(openapi: any): Contract {
    return {
      id: this.generateId(),
      name: openapi.info?.title || 'Generated Contract',
      version: openapi.info?.version || '1.0.0',
      provider: openapi.servers?.[0]?.url || 'http://localhost:3000',
      consumer: 'test-consumer',
      specification: {
        openapi: openapi
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };
  }

  /**
   * Generate contract from GraphQL schema
   */
  static fromGraphQL(graphql: any): Contract {
    return {
      id: this.generateId(),
      name: graphql.name || 'GraphQL Contract',
      version: graphql.version || '1.0.0',
      provider: graphql.url || 'http://localhost:3000/graphql',
      consumer: 'test-consumer',
      specification: {
        graphql: graphql
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };
  }

  /**
   * Generate contract from AsyncAPI specification
   */
  static fromAsyncApi(asyncapi: any): Contract {
    return {
      id: this.generateId(),
      name: asyncapi.info?.title || 'AsyncAPI Contract',
      version: asyncapi.info?.version || '1.0.0',
      provider: asyncapi.servers?.[0]?.url || 'http://localhost:3000',
      consumer: 'test-consumer',
      specification: {
        asyncapi: asyncapi
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };
  }

  private static generateId(): string {
    return `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Contract Registry for managing multiple contracts
 */
export class ContractRegistry {
  private contracts: Map<string, Contract> = new Map();
  private validator: ContractValidator;
  private tester: ContractTester;

  constructor() {
    this.validator = new ContractValidator();
    this.tester = new ContractTester();
  }

  /**
   * Register a contract
   */
  register(contract: Contract): void {
    this.contracts.set(contract.id, contract);
  }

  /**
   * Get contract by ID
   */
  getContract(id: string): Contract | undefined {
    return this.contracts.get(id);
  }

  /**
   * Get all contracts
   */
  getAllContracts(): Contract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Remove contract by ID
   */
  removeContract(id: string): boolean {
    return this.contracts.delete(id);
  }

  /**
   * Validate all contracts
   */
  async validateAllContracts(): Promise<ContractValidationResult[]> {
    const results: ContractValidationResult[] = [];

    for (const contract of this.contracts.values()) {
      const result = await this.validator.validate(contract);
      results.push(result);
    }

    return results;
  }

  /**
   * Test all contracts
   */
  async testAllContracts(): Promise<{ contractId: string; results: TestResult[] }[]> {
    const results: { contractId: string; results: TestResult[] }[] = [];

    for (const contract of this.contracts.values()) {
      const testResults = await this.tester.testContract(contract);
      results.push({
        contractId: contract.id,
        results: testResults
      });
    }

    return results;
  }

  /**
   * Get contracts by provider
   */
  getContractsByProvider(provider: string): Contract[] {
    return Array.from(this.contracts.values())
      .filter(contract => contract.provider.includes(provider));
  }

  /**
   * Get contracts by consumer
   */
  getContractsByConsumer(consumer: string): Contract[] {
    return Array.from(this.contracts.values())
      .filter(contract => contract.consumer.includes(consumer));
  }

  /**
   * Get contracts by status
   */
  getContractsByStatus(status: 'active' | 'deprecated' | 'pending'): Contract[] {
    return Array.from(this.contracts.values())
      .filter(contract => contract.status === status);
  }
}

/**
 * Contract Testing Configuration
 */
export interface ContractTestConfig {
  validateContracts: boolean;
  testHttpServices: boolean;
  testGraphQLServices: boolean;
  testAsyncApiServices: boolean;
  baseUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  reporter: 'console' | 'json' | 'html' | 'junit';
  outputDir: string;
  includeTags: string[];
  excludeTags: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_CONTRACT_TEST_CONFIG: ContractTestConfig = {
  validateContracts: true,
  testHttpServices: true,
  testGraphQLServices: true,
  testAsyncApiServices: true,
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
  retries: 3,
  parallel: true,
  reporter: 'console',
  outputDir: 'contract-test-results',
  includeTags: [],
  excludeTags: []
};

/**
 * Contract Test Runner
 */
export class ContractTestRunner {
  private config: ContractTestConfig;
  private registry: ContractRegistry;
  private validator: ContractValidator;
  private tester: ContractTester;

  constructor(config: Partial<ContractTestConfig> = {}) {
    this.config = { ...DEFAULT_CONTRACT_TEST_CONFIG, ...config };
    this.registry = new ContractRegistry();
    this.validator = new ContractValidator();
    this.tester = new ContractTester();
  }

  /**
   * Add contract to test runner
   */
  addContract(contract: Contract): void {
    this.registry.register(contract);
  }

  /**
   * Run contract tests
   */
  async run(): Promise<ContractTestResults> {
    const results = new ContractTestResults();

    // Validate contracts if enabled
    if (this.config.validateContracts) {
      const validationResults = await this.registry.validateAllContracts();
      results.validationResults = validationResults;

      // Check if all contracts are valid
      const allValid = validationResults.every(r => r.isValid);
      if (!allValid) {
        results.isValid = false;
        results.errors.push('Some contracts failed validation');
      }
    }

    // Test contracts if enabled and contracts are valid
    if (this.config.validateContracts && !results.isValid) {
      results.warnings.push('Skipping contract tests due to validation failures');
    } else if (this.config.validateContracts || !this.config.validateContracts) {
      const testResults = await this.registry.testAllContracts();
      results.testResults = testResults;

      // Check if all tests passed
      const allTestsPassed = testResults.every(r =>
        r.results.every(test => test.passed)
      );

      results.isValid = allTestsPassed;
    }

    results.duration = Date.now() - results.startTime;

    return results;
  }

  /**
   * Generate test report
   */
  generateReport(results: ContractTestResults): string {
    let report = '# Contract Test Report\n\n';
    report += `Started: ${new Date(results.startTime).toISOString()}\n`;
    report += `Duration: ${results.duration}ms\n`;
    report += `Status: ${results.isValid ? '✅ PASS' : '❌ FAIL'}\n\n`;

    // Validation results
    if (results.validationResults && results.validationResults.length > 0) {
      report += '## Contract Validation\n\n';
      report += `Validated ${results.validationResults.length} contracts\n\n`;

      results.validationResults.forEach(result => {
        const status = result.isValid ? '✅' : '❌';
        report += `- ${status} ${result.contractId}: ${result.isValid ? 'Valid' : 'Invalid'}\n`;

        if (!result.isValid && result.errors.length > 0) {
          report += '  Errors:\n';
          result.errors.forEach(error => {
            report += `    - ${error.message}\n`;
          });
        }
      });

      report += '\n';
    }

    // Test results
    if (results.testResults && results.testResults.length > 0) {
      report += '## Contract Tests\n\n';
      report += `Ran tests for ${results.testResults.length} contracts\n\n`;

      results.testResults.forEach(contractResult => {
        const allPassed = contractResult.results.every(test => test.passed);
        const status = allPassed ? '✅' : '❌';
        report += `- ${status} ${contractResult.contractId}\n`;

        contractResult.results.forEach(test => {
          const testStatus = test.passed ? '✅' : '❌';
          report += `  ${testStatus} ${test.testName} (${test.duration}ms)\n`;

          if (!test.passed && test.error) {
            report += `    Error: ${test.error.message}\n`;
          }
        });

        report += '\n';
      });
    }

    // Summary
    report += '## Summary\n\n';
    report += `- Total contracts: ${this.registry.getAllContracts().length}\n`;
    report += `- Valid contracts: ${results.validationResults?.filter(r => r.isValid).length || 'N/A'}\n`;
    report += `- Contract tests: ${results.testResults?.reduce((sum, r) => sum + r.results.length, 0) || 0}\n`;
    report += `- Passed tests: ${results.testResults?.reduce((sum, r) => sum + r.results.filter(t => t.passed).length, 0) || 0}\n`;
    report += `- Failed tests: ${results.testResults?.reduce((sum, r) => sum + r.results.filter(t => !t.passed).length, 0) || 0}\n`;

    return report;
  }
}

/**
 * Contract Test Results
 */
export class ContractTestResults {
  startTime = Date.now();
  duration = 0;
  isValid = true;
  validationResults: ContractValidationResult[] = [];
  testResults: { contractId: string; results: TestResult[] }[] = [];
  errors: string[] = [];
  warnings: string[] = [];

  /**
   * Get total number of contracts
   */
  getTotalContracts(): number {
    return this.validationResults.length;
  }

  /**
   * Get total number of tests
   */
  getTotalTests(): number {
    return this.testResults.reduce((sum, r) => sum + r.results.length, 0);
  }

  /**
   * Get number of passed tests
   */
  getPassedTests(): number {
    return this.testResults.reduce((sum, r) => sum + r.results.filter(t => t.passed).length, 0);
  }

  /**
   * Get number of failed tests
   */
  getFailedTests(): number {
    return this.testResults.reduce((sum, r) => sum + r.results.filter(t => !t.passed).length, 0);
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    const total = this.getTotalTests();
    if (total === 0) return 0;
    return (this.getFailedTests() / total) * 100;
  }

  /**
   * Add error
   */
  addError(message: string): void {
    this.errors.push(message);
    this.isValid = false;
  }

  /**
   * Add warning
   */
  addWarning(message: string): void {
    this.warnings.push(message);
  }
}

// Create default instance
export const contractRegistry = new ContractRegistry();
export const contractTestRunner = new ContractTestRunner();