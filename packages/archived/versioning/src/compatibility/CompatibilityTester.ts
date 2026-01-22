/**
 * Compatibility Tester - Test API version compatibility
 */

import {
  CompatibilityTest,
  TestResult,
  BreakingChange,
  DeprecationWarning,
  APIEndpoint,
  APIContract,
} from '../types/index.js';
import { BreakingChangeDetector } from '../analysis/BreakingChangeDetector.js';

export interface TestCase {
  name: string;
  sourceVersion: string;
  targetVersion: string;
  endpoint?: string;
  test: () => Promise<TestResult>;
}

export class CompatibilityTester {
  private detector: BreakingChangeDetector;
  private testCases: Map<string, TestCase[]>;

  constructor() {
    this.detector = new BreakingChangeDetector();
    this.testCases = new Map();
  }

  /**
   * Test compatibility between two versions
   */
  async testCompatibility(
    sourceContract: APIContract,
    targetContract: APIContract
  ): Promise<CompatibilityTest> {
    const sourceVersion = sourceContract.version;
    const targetVersion = targetContract.version;

    // Detect breaking changes
    const analysis = this.detector.compareVersions(
      sourceContract.endpoints,
      targetContract.endpoints
    );

    // Run compatibility tests
    const testResults = await this.runTests(sourceVersion, targetVersion);

    // Generate warnings
    const warnings: DeprecationWarning[] = [];
    if (analysis.breakingChanges.length > 0) {
      warnings.push({
        type: 'breaking_change' as any,
        severity: 'error' as any,
        message: `${analysis.breakingChanges.length} breaking changes detected`,
        code: 'BREAKING_CHANGES',
      });
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(analysis);

    // Determine overall compatibility
    const compatible = analysis.breakingChanges.length === 0;

    return {
      sourceVersion,
      targetVersion,
      compatible,
      breakingChanges: analysis.breakingChanges,
      warnings,
      recommendations,
      testResults,
    };
  }

  /**
   * Test endpoint compatibility
   */
  async testEndpointCompatibility(
    sourceEndpoint: APIEndpoint,
    targetEndpoint: APIEndpoint
  ): Promise<TestResult> {
    try {
      const changes = this.detector.compareEndpoints(sourceEndpoint, targetEndpoint);

      if (changes.breaking.length > 0) {
        return {
          name: `Endpoint ${targetEndpoint.method} ${targetEndpoint.path}`,
          passed: false,
          message: `${changes.breaking.length} breaking changes found`,
          details: {
            breaking: changes.breaking,
            nonBreaking: changes.nonBreaking,
          },
        };
      }

      return {
        name: `Endpoint ${targetEndpoint.method} ${targetEndpoint.path}`,
        passed: true,
        message: 'No breaking changes detected',
        details: {
          nonBreaking: changes.nonBreaking,
        },
      };
    } catch (error) {
      return {
        name: `Endpoint ${targetEndpoint.method} ${targetEndpoint.path}`,
        passed: false,
        message: `Error during compatibility test: ${error}`,
        details: { error },
      };
    }
  }

  /**
   * Test contract compatibility
   */
  async testContractCompatibility(
    sourceContract: APIContract,
    targetContract: APIContract
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test overall structure
    results.push(await this.testContractStructure(sourceContract, targetContract));

    // Test each endpoint
    const sourceMap = this.createEndpointMap(sourceContract.endpoints);
    const targetMap = this.createEndpointMap(targetContract.endpoints);

    for (const [key, targetEndpoint] of targetMap.entries()) {
      const sourceEndpoint = sourceMap.get(key);
      if (sourceEndpoint) {
        results.push(await this.testEndpointCompatibility(sourceEndpoint, targetEndpoint));
      }
    }

    // Check for removed endpoints
    for (const [key, sourceEndpoint] of sourceMap.entries()) {
      if (!targetMap.has(key)) {
        results.push({
          name: `Endpoint ${sourceEndpoint.method} ${sourceEndpoint.path}`,
          passed: false,
          message: 'Endpoint was removed',
          details: { endpoint: sourceEndpoint },
        });
      }
    }

    return results;
  }

  /**
   * Test contract structure
   */
  private async testContractStructure(
    sourceContract: APIContract,
    targetContract: APIContract
  ): Promise<TestResult> {
    const issues: string[] = [];

    // Check security schemes
    const sourceSchemes = Object.keys(sourceContract.securitySchemes);
    const targetSchemes = Object.keys(targetContract.securitySchemes);

    for (const scheme of sourceSchemes) {
      if (!targetSchemes.includes(scheme)) {
        issues.push(`Security scheme '${scheme}' was removed`);
      }
    }

    // Check schemas
    const sourceSchemas = Object.keys(sourceContract.schemas);
    const targetSchemas = Object.keys(targetContract.schemas);

    for (const schema of sourceSchemas) {
      if (!targetSchemas.includes(schema)) {
        issues.push(`Schema '${schema}' was removed`);
      }
    }

    return {
      name: 'Contract Structure',
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Structure is compatible' : 'Structure changes detected',
      details: { issues },
    };
  }

  /**
   * Run all registered tests
   */
  private async runTests(
    sourceVersion: string,
    targetVersion: string
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const key = `${sourceVersion}->${targetVersion}`;
    const tests = this.testCases.get(key) || [];

    for (const test of tests) {
      try {
        const result = await test.test();
        results.push(result);
      } catch (error) {
        results.push({
          name: test.name,
          passed: false,
          message: `Test failed with error: ${error}`,
        });
      }
    }

    return results;
  }

  /**
   * Register a test case
   */
  registerTest(test: TestCase): void {
    const key = `${test.sourceVersion}->${test.targetVersion}`;
    const tests = this.testCases.get(key) || [];
    tests.push(test);
    this.testCases.set(key, tests);
  }

  /**
   * Test backward compatibility
   */
  async testBackwardCompatibility(
    oldContract: APIContract,
    newContract: APIContract
  ): Promise<CompatibilityTest> {
    const result = await this.testCompatibility(oldContract, newContract);

    // Add specific backward compatibility checks
    const additionalTests = await this.runBackwardCompatibilityTests(
      oldContract,
      newContract
    );

    result.testResults.push(...additionalTests);

    return result;
  }

  /**
   * Test forward compatibility
   */
  async testForwardCompatibility(
    newContract: APIContract,
    oldContract: APIContract
  ): Promise<CompatibilityTest> {
    const result = await this.testCompatibility(newContract, oldContract);

    // Add specific forward compatibility checks
    const additionalTests = await this.runForwardCompatibilityTests(
      newContract,
      oldContract
    );

    result.testResults.push(...additionalTests);

    return result;
  }

  /**
   * Run backward compatibility tests
   */
  private async runBackwardCompatibilityTests(
    oldContract: APIContract,
    newContract: APIContract
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test that old clients can still use the new API
    const oldMap = this.createEndpointMap(oldContract.endpoints);
    const newMap = this.createEndpointMap(newContract.endpoints);

    for (const [key, oldEndpoint] of oldMap.entries()) {
      const newEndpoint = newMap.get(key);
      if (newEndpoint) {
        // Check if old parameters still work
        const paramTest = this.testParameterBackwardCompatibility(
          oldEndpoint,
          newEndpoint
        );
        results.push(paramTest);

        // Check if old response structure is maintained
        const responseTest = this.testResponseBackwardCompatibility(
          oldEndpoint,
          newEndpoint
        );
        results.push(responseTest);
      }
    }

    return results;
  }

  /**
   * Test forward compatibility tests
   */
  private async runForwardCompatibilityTests(
    newContract: APIContract,
    oldContract: APIContract
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test that new features don't break old clients
    const newMap = this.createEndpointMap(newContract.endpoints);
    const oldMap = this.createEndpointMap(oldContract.endpoints);

    for (const [key, newEndpoint] of newMap.entries()) {
      const oldEndpoint = oldMap.get(key);
      if (oldEndpoint) {
        // Check if new fields are optional
        const fieldTest = this.testNewFieldsOptional(oldEndpoint, newEndpoint);
        results.push(fieldTest);
      }
    }

    return results;
  }

  /**
   * Test parameter backward compatibility
   */
  private testParameterBackwardCompatibility(
    oldEndpoint: APIEndpoint,
    newEndpoint: APIEndpoint
  ): TestResult {
    const issues: string[] = [];

    const oldParams = new Map(oldEndpoint.parameters.map(p => [p.name, p]));
    const newParams = new Map(newEndpoint.parameters.map(p => [p.name, p]));

    for (const [name, oldParam] of oldParams.entries()) {
      const newParam = newParams.get(name);

      if (!newParam) {
        issues.push(`Parameter '${name}' was removed`);
      } else if (oldParam.type !== newParam.type) {
        issues.push(
          `Parameter '${name}' type changed from ${oldParam.type} to ${newParam.type}`
        );
      } else if (!oldParam.required && newParam.required) {
        issues.push(`Parameter '${name}' is now required`);
      }
    }

    return {
      name: `Parameter Backward Compatibility: ${newEndpoint.method} ${newEndpoint.path}`,
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Parameters are backward compatible' : 'Parameter breaking changes detected',
      details: { issues },
    };
  }

  /**
   * Test response backward compatibility
   */
  private testResponseBackwardCompatibility(
    oldEndpoint: APIEndpoint,
    newEndpoint: APIEndpoint
  ): TestResult {
    const issues: string[] = [];

    if (oldEndpoint.response.statusCode !== newEndpoint.response.statusCode) {
      issues.push(
        `Response status code changed from ${oldEndpoint.response.statusCode} to ${newEndpoint.response.statusCode}`
      );
    }

    // Check schema compatibility
    if (oldEndpoint.response.schema && newEndpoint.response.schema) {
      const schemaIssues = this.checkSchemaBackwardCompatibility(
        oldEndpoint.response.schema,
        newEndpoint.response.schema
      );
      issues.push(...schemaIssues);
    }

    return {
      name: `Response Backward Compatibility: ${newEndpoint.method} ${newEndpoint.path}`,
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Response is backward compatible' : 'Response breaking changes detected',
      details: { issues },
    };
  }

  /**
   * Check schema backward compatibility
   */
  private checkSchemaBackwardCompatibility(
    oldSchema: any,
    newSchema: any,
    path = '$'
  ): string[] {
    const issues: string[] = [];

    if (oldSchema.type !== newSchema.type) {
      issues.push(`Field at ${path} type changed`);
    }

    if (oldSchema.type === 'object' && newSchema.type === 'object') {
      const oldProps = oldSchema.properties || {};
      const newProps = newSchema.properties || {};
      const oldRequired = new Set(oldSchema.required || []);
      const newRequired = new Set(newSchema.required || []);

      for (const propName of Object.keys(oldProps)) {
        if (!newProps[propName]) {
          issues.push(`Field '${path}.${propName}' was removed`);
        } else {
          const nestedIssues = this.checkSchemaBackwardCompatibility(
            oldProps[propName],
            newProps[propName],
            `${path}.${propName}`
          );
          issues.push(...nestedIssues);
        }
      }
    }

    if (oldSchema.type === 'array' && newSchema.type === 'array') {
      if (oldSchema.items && newSchema.items) {
        const itemIssues = this.checkSchemaBackwardCompatibility(
          oldSchema.items,
          newSchema.items,
          `${path}[]`
        );
        issues.push(...itemIssues);
      }
    }

    return issues;
  }

  /**
   * Test if new fields are optional
   */
  private testNewFieldsOptional(
    oldEndpoint: APIEndpoint,
    newEndpoint: APIEndpoint
  ): TestResult {
    const issues: string[] = [];

    const oldParams = new Map(oldEndpoint.parameters.map(p => [p.name, p]));
    const newParams = new Map(newEndpoint.parameters.map(p => [p.name, p]));

    for (const [name, newParam] of newParams.entries()) {
      if (!oldParams.has(name) && newParam.required) {
        issues.push(`New required parameter '${name}' will break old clients`);
      }
    }

    return {
      name: `New Fields Optional: ${newEndpoint.method} ${newEndpoint.path}`,
      passed: issues.length === 0,
      message: issues.length === 0 ? 'New fields are optional' : 'New required fields detected',
      details: { issues },
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(analysis: any): string[] {
    const recommendations: string[] = [];

    if (analysis.breakingChanges.length > 0) {
      recommendations.push('Create a new API version to maintain backward compatibility');
      recommendations.push('Provide migration guide for breaking changes');
      recommendations.push('Implement deprecation period for old version');
    }

    if (analysis.summary.severity === 'major') {
      recommendations.push('Consider maintaining multiple API versions');
      recommendations.push('Automate migration where possible');
    }

    return recommendations;
  }

  /**
   * Create endpoint map
   */
  private createEndpointMap(endpoints: APIEndpoint[]): Map<string, APIEndpoint> {
    const map = new Map<string, APIEndpoint>();
    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      map.set(key, endpoint);
    }
    return map;
  }

  /**
   * Get compatibility matrix
   */
  async getCompatibilityMatrix(
    contracts: APIContract[]
  ): Promise<Record<string, Record<string, boolean>>> {
    const matrix: Record<string, Record<string, boolean>> = {};

    for (const source of contracts) {
      matrix[source.version] = {};
      for (const target of contracts) {
        const test = await this.testCompatibility(source, target);
        matrix[source.version][target.version] = test.compatible;
      }
    }

    return matrix;
  }

  /**
   * Validate version compatibility
   */
  async validateCompatibility(
    sourceVersion: string,
    targetVersion: string,
    contracts: APIContract[]
  ): Promise<TestResult> {
    const sourceContract = contracts.find(c => c.version === sourceVersion);
    const targetContract = contracts.find(c => c.version === targetVersion);

    if (!sourceContract || !targetContract) {
      return {
        name: 'Compatibility Validation',
        passed: false,
        message: 'One or both versions not found',
      };
    }

    const test = await this.testCompatibility(sourceContract, targetContract);

    return {
      name: `Compatibility: ${sourceVersion} -> ${targetVersion}`,
      passed: test.compatible,
      message: test.compatible ? 'Versions are compatible' : 'Versions are not compatible',
      details: test,
    };
  }
}
