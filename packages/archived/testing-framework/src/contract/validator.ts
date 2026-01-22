/**
 * Contract Validator
 * Provides validation for API contracts across different service interfaces
 */

import { Contract, ContractSpecification, ContractValidationResult, ValidationError, ValidationMetadata, RuleResult } from './types';

export class ContractValidator {
  private rules: ContractRule[] = [];
  private metadata: ValidationMetadata;

  constructor() {
    this.initializeDefaultRules();
    this.metadata = {
      validatedAt: new Date(),
      validatorVersion: '1.0.0',
      executionTime: 0,
      rules: []
    };
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      new RequiredFieldsRule(),
      new SchemaValidationRule(),
      new OpenApiValidationRule(),
      new GraphQLValidationRule(),
      new AsyncApiValidationRule(),
      new SecurityValidationRule(),
      new DocumentationValidationRule(),
      new VersionCompatibilityRule()
    ];
  }

  /**
   * Validate a contract
   */
  async validate(contract: Contract): Promise<ContractValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];
    const ruleResults: RuleResult[] = [];

    for (const rule of this.rules) {
      try {
        const ruleStartTime = Date.now();
        const result = await rule.validate(contract);
        const ruleDuration = Date.now() - ruleStartTime;

        ruleResults.push({
          name: rule.name,
          passed: result.passed,
          message: result.message,
          duration: ruleDuration
        });

        if (!result.passed) {
          errors.push(...result.errors);
        }

        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      } catch (error) {
        const ruleError = error as Error;
        errors.push({
          path: 'contract',
          message: `Rule ${rule.name} failed: ${ruleError.message}`,
          severity: 'error',
          code: 'RULE_EXECUTION_FAILED',
          details: ruleError
        });
      }
    }

    this.metadata = {
      validatedAt: new Date(),
      validatorVersion: '1.0.0',
      executionTime: Date.now() - startTime,
      rules: ruleResults
    };

    return {
      contractId: contract.id,
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: this.metadata
    };
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ContractRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove validation rule
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
  }

  /**
   * Get validation metadata
   */
  getMetadata(): ValidationMetadata {
    return { ...this.metadata };
  }
}

/**
 * Contract Rule Interface
 */
export interface ContractRule {
  name: string;
  validate(contract: Contract): Promise<RuleValidationResult>;
}

export interface RuleValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: Warning[];
  message?: string;
}

/**
 * Required Fields Validation Rule
 */
class RequiredFieldsRule implements ContractRule {
  name = 'required-fields';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    // Check required top-level fields
    if (!contract.name) {
      errors.push({
        path: 'name',
        message: 'Contract name is required',
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD'
      });
    }

    if (!contract.version) {
      errors.push({
        path: 'version',
        message: 'Contract version is required',
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD'
      });
    }

    if (!contract.provider) {
      errors.push({
        path: 'provider',
        message: 'Contract provider is required',
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD'
      });
    }

    if (!contract.consumer) {
      errors.push({
        path: 'consumer',
        message: 'Contract consumer is required',
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD'
      });
    }

    // Check specification
    if (!contract.specification) {
      errors.push({
        path: 'specification',
        message: 'Contract specification is required',
        severity: 'error',
        code: 'MISSING_REQUIRED_FIELD'
      });
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Schema Validation Rule
 */
class SchemaValidationRule implements ContractRule {
  name = 'schema-validation';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    // Validate OpenAPI schema if present
    if (contract.specification.openapi) {
      const openapiErrors = this.validateOpenApiSchema(contract.specification.openapi);
      errors.push(...openapiErrors);
    }

    // Validate GraphQL schema if present
    if (contract.specification.graphql) {
      const graphqlErrors = this.validateGraphQLSchema(contract.specification.graphql);
      errors.push(...graphqlErrors);
    }

    // Validate AsyncAPI schema if present
    if (contract.specification.asyncapi) {
      const asyncapiErrors = this.validateAsyncApiSchema(contract.specification.asyncapi);
      errors.push(...asyncapiErrors);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateOpenApiSchema(openapi: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate required OpenAPI fields
    if (!openapi.openapi) {
      errors.push({
        path: 'openapi',
        message: 'OpenAPI version is required',
        severity: 'error',
        code: 'INVALID_OPENAPI'
      });
    }

    if (!openapi.info) {
      errors.push({
        path: 'info',
        message: 'OpenAPI info object is required',
        severity: 'error',
        code: 'INVALID_OPENAPI'
      });
    }

    if (!openapi.paths) {
      errors.push({
        path: 'paths',
        message: 'OpenAPI paths object is required',
        severity: 'error',
        code: 'INVALID_OPENAPI'
      });
    }

    return errors;
  }

  private validateGraphQLSchema(graphql: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!graphql.schema) {
      errors.push({
        path: 'schema',
        message: 'GraphQL schema is required',
        severity: 'error',
        code: 'INVALID_GRAPHQL'
      });
    }

    if (!graphql.queries || !Array.isArray(graphql.queries)) {
      errors.push({
        path: 'queries',
        message: 'GraphQL queries must be an array',
        severity: 'error',
        code: 'INVALID_GRAPHQL'
      });
    }

    if (!graphql.mutations || !Array.isArray(graphql.mutations)) {
      errors.push({
        path: 'mutations',
        message: 'GraphQL mutations must be an array',
        severity: 'error',
        code: 'INVALID_GRAPHQL'
      });
    }

    return errors;
  }

  private validateAsyncApiSchema(asyncapi: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!asyncapi.asyncapi) {
      errors.push({
        path: 'asyncapi',
        message: 'AsyncAPI version is required',
        severity: 'error',
        code: 'INVALID_ASYNCAPI'
      });
    }

    if (!asyncapi.info) {
      errors.push({
        path: 'info',
        message: 'AsyncAPI info object is required',
        severity: 'error',
        code: 'INVALID_ASYNCAPI'
      });
    }

    if (!asyncapi.channels) {
      errors.push({
        path: 'channels',
        message: 'AsyncAPI channels object is required',
        severity: 'error',
        code: 'INVALID_ASYNCAPI'
      });
    }

    return errors;
  }
}

/**
 * OpenAPI Validation Rule
 */
class OpenApiValidationRule implements ContractRule {
  name = 'openapi-validation';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    if (!contract.specification.openapi) {
      return { passed: true, errors, warnings };
    }

    const openapi = contract.specification.openapi;

    // Validate version format
    if (!this.isValidVersion(openapi.openapi)) {
      errors.push({
        path: 'openapi',
        message: `Invalid OpenAPI version format: ${openapi.openapi}`,
        severity: 'error',
        code: 'INVALID_OPENAPI_VERSION'
      });
    }

    // Validate info object
    if (openapi.info) {
      if (!openapi.info.title || typeof openapi.info.title !== 'string') {
        errors.push({
          path: 'info.title',
          message: 'OpenAPI info.title is required and must be a string',
          severity: 'error',
          code: 'INVALID_OPENAPI_INFO'
        });
      }

      if (!openapi.info.version || typeof openapi.info.version !== 'string') {
        errors.push({
          path: 'info.version',
          message: 'OpenAPI info.version is required and must be a string',
          severity: 'error',
          code: 'INVALID_OPENAPI_INFO'
        });
      }
    }

    // Validate paths
    if (openapi.paths) {
      for (const [path, pathItem] of Object.entries(openapi.paths)) {
        if (!path.startsWith('/')) {
          errors.push({
            path: `paths.${path}`,
            message: `Path must start with '/': ${path}`,
            severity: 'error',
            code: 'INVALID_OPENAPI_PATH'
          });
        }

        const pathItemErrors = this.validatePathItem(pathItem);
        errors.push(...pathItemErrors.map(error => ({
          ...error,
          path: `paths.${path}.${error.path}`
        })));
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version) || /^3\.0\.\d+$/.test(version);
  }

  private validatePathItem(pathItem: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for at least one operation
    const hasOperation = ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'trace']
      .some(method => pathItem[method]);

    if (!hasOperation) {
      errors.push({
        path: '',
        message: 'Path item must have at least one operation',
        severity: 'error',
        code: 'INVALID_OPENAPI_PATH'
      });
    }

    // Validate operations
    ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'trace'].forEach(method => {
      if (pathItem[method]) {
        const operation = pathItem[method];
        const opErrors = this.validateOperation(method, operation);
        errors.push(...opErrors);
      }
    });

    return errors;
  }

  private validateOperation(method: string, operation: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!operation.operationId) {
      errors.push({
        path: `operationId`,
        message: `${method.toUpperCase()} operation must have an operationId`,
        severity: 'error',
        code: 'INVALID_OPENAPI_OPERATION'
      });
    }

    if (!operation.responses) {
      errors.push({
        path: 'responses',
        message: `${method.toUpperCase()} operation must have responses`,
        severity: 'error',
        code: 'INVALID_OPENAPI_OPERATION'
      });
    }

    return errors;
  }
}

/**
 * GraphQL Validation Rule
 */
class GraphQLValidationRule implements ContractRule {
  name = 'graphql-validation';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    if (!contract.specification.graphql) {
      return { passed: true, errors, warnings };
    }

    const graphql = contract.specification.graphql;

    // Validate queries
    graphql.queries?.forEach((query: any, index: number) => {
      const queryErrors = this.validateGraphQLDefinition(query, 'query', index);
      errors.push(...queryErrors.map(error => ({
        ...error,
        path: `queries.${index}.${error.path}`
      })));
    });

    // Validate mutations
    graphql.mutations?.forEach((mutation: any, index: number) => {
      const mutationErrors = this.validateGraphQLDefinition(mutation, 'mutation', index);
      errors.push(...mutationErrors.map(error => ({
        ...error,
        path: `mutations.${index}.${error.path}`
      })));
    });

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateGraphQLDefinition(definition: any, type: string, index: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!definition.name) {
      errors.push({
        path: 'name',
        message: `${type} ${index} must have a name`,
        severity: 'error',
        code: 'INVALID_GRAPHQL_DEFINITION'
      });
    }

    if (!definition.returnType) {
      errors.push({
        path: 'returnType',
        message: `${type} ${definition.name || index} must have a returnType`,
        severity: 'error',
        code: 'INVALID_GRAPHQL_DEFINITION'
      });
    }

    if (!definition.arguments || !Array.isArray(definition.arguments)) {
      errors.push({
        path: 'arguments',
        message: `${type} ${definition.name || index} must have an arguments array`,
        severity: 'error',
        code: 'INVALID_GRAPHQL_DEFINITION'
      });
    } else {
      definition.arguments.forEach((arg: any, argIndex: number) => {
        const argErrors = this.validateGraphQLArgument(arg, argIndex);
        errors.push(...argErrors.map(error => ({
          ...error,
          path: `arguments.${argIndex}.${error.path}`
        })));
      });
    }

    return errors;
  }

  private validateGraphQLArgument(argument: any, index: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!argument.name) {
      errors.push({
        path: 'name',
        message: `Argument ${index} must have a name`,
        severity: 'error',
        code: 'INVALID_GRAPHQL_ARGUMENT'
      });
    }

    if (!argument.type) {
      errors.push({
        path: 'type',
        message: `Argument ${argument.name || index} must have a type`,
        severity: 'error',
        code: 'INVALID_GRAPHQL_ARGUMENT'
      });
    }

    return errors;
  }
}

/**
 * AsyncAPI Validation Rule
 */
class AsyncApiValidationRule implements ContractRule {
  name = 'asyncapi-validation';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    if (!contract.specification.asyncapi) {
      return { passed: true, errors, warnings };
    }

    const asyncapi = contract.specification.asyncapi;

    // Validate AsyncAPI version
    if (!this.isValidAsyncApiVersion(asyncapi.asyncapi)) {
      errors.push({
        path: 'asyncapi',
        message: `Invalid AsyncAPI version format: ${asyncapi.asyncapi}`,
        severity: 'error',
        code: 'INVALID_ASYNCAPI_VERSION'
      });
    }

    // Validate info object
    if (asyncapi.info) {
      if (!asyncapi.info.title) {
        errors.push({
          path: 'info.title',
          message: 'AsyncAPI info.title is required',
          severity: 'error',
          code: 'INVALID_ASYNCAPI_INFO'
        });
      }

      if (!asyncapi.info.version) {
        errors.push({
          path: 'info.version',
          message: 'AsyncAPI info.version is required',
          severity: 'error',
          code: 'INVALID_ASYNCAPI_INFO'
        });
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidAsyncApiVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version) || /^2\.0\.\d+$/.test(version);
  }
}

/**
 * Security Validation Rule
 */
class SecurityValidationRule implements ContractRule {
  name = 'security-validation';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    // Check for potential security issues
    const openapi = contract.specification.openapi;
    if (openapi && openapi.paths) {
      for (const [path, pathItem] of Object.entries(openapi.paths)) {
        ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'trace'].forEach(method => {
          if (pathItem[method]) {
            const operation = pathItem[method];
            const opErrors = this.checkSecurity(operation);
            errors.push(...opErrors.map(error => ({
              ...error,
              path: `paths.${path}.${method}.security`
            })));
          }
        });
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private checkSecurity(operation: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (operation.security) {
      // Check for potentially weak security schemes
      operation.security.forEach((securityScheme: any, index: number) => {
        Object.keys(securityScheme).forEach(scheme => {
          if (scheme.toLowerCase().includes('basic') && !scheme.toLowerCase().includes('oauth')) {
            errors.push({
              path: '',
              message: `Consider using OAuth instead of basic auth for security scheme '${scheme}'`,
              severity: 'warning',
              code: 'WEAK_SECURITY_SCHEME'
            });
          }
        });
      });
    }

    return errors;
  }
}

/**
 * Documentation Validation Rule
 */
class DocumentationValidationRule implements ContractRule {
  name = 'documentation-validation';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    // Check for missing documentation
    if (!contract.specification.openapi?.info?.description) {
      warnings.push({
        path: 'info.description',
        message: 'Consider adding description to API documentation',
        code: 'MISSING_DOCUMENTATION'
      });
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Version Compatibility Rule
 */
class VersionCompatibilityRule implements ContractRule {
  name = 'version-compatibility';

  async validate(contract: Contract): Promise<RuleValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];

    // Check if version follows semantic versioning
    if (!this.isValidSemanticVersion(contract.version)) {
      warnings.push({
        path: 'version',
        message: `Version '${contract.version}' should follow semantic versioning (e.g., 1.0.0)`,
        code: 'NON_SEMANTIC_VERSION'
      });
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidSemanticVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
  }
}

export interface Warning {
  path: string;
  message: string;
  code: string;
}