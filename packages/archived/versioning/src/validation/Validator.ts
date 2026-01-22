/**
 * API Version Validation Utilities
 */

import {
  APIVersion,
  APIEndpoint,
  APIParameter,
  APIResponse,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  APIContract,
  DeprecationRecord,
} from '../types/index.js';
import { SemanticVersioning } from '../versions/SemanticVersioning.js';

export class APIValidator {
  /**
   * Validate API version definition
   */
  validateVersion(version: APIVersion): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate semantic version
    if (!SemanticVersioning.validate(version.version)) {
      errors.push({
        field: 'version',
        message: `Invalid semantic version: ${version.version}`,
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    // Validate dates
    if (version.releasedAt > new Date()) {
      errors.push({
        field: 'releasedAt',
        message: 'Release date cannot be in the future',
        code: 'FUTURE_RELEASE_DATE',
        severity: 'error',
      });
    }

    if (version.deprecatedAt && version.sunsetAt) {
      if (version.deprecatedAt >= version.sunsetAt) {
        errors.push({
          field: 'sunsetAt',
          message: 'Sunset date must be after deprecation date',
          code: 'INVALID_SUNSET_DATE',
          severity: 'error',
        });
      }
    }

    if (version.deprecatedAt && version.deprecatedAt < version.releasedAt) {
      errors.push({
        field: 'deprecatedAt',
        message: 'Deprecation date must be after release date',
        code: 'INVALID_DEPRECATION_DATE',
        severity: 'error',
      });
    }

    // Validate status consistency
    if (version.status === 'deprecated' && !version.deprecatedAt) {
      warnings.push({
        field: 'deprecatedAt',
        message: 'Deprecated version should have deprecation date',
        code: 'MISSING_DEPRECATION_DATE',
        suggestion: 'Set deprecationDate when marking version as deprecated',
      });
    }

    if (version.status === 'sunset' && !version.sunsetAt) {
      warnings.push({
        field: 'sunsetAt',
        message: 'Sunset version should have sunset date',
        code: 'MISSING_SUNSET_DATE',
        suggestion: 'Set sunsetDate when marking version as sunset',
      });
    }

    // Check for empty breaking changes if not stable
    if (version.breakingChanges.length === 0 && version.status === 'stable') {
      recommendations.push('Consider documenting breaking changes for new versions');
    }

    return {
      valid: errors.length === 0,
      version: version.version,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate API endpoint
   */
  validateEndpoint(endpoint: APIEndpoint): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(endpoint.method.toUpperCase())) {
      errors.push({
        field: 'method',
        message: `Invalid HTTP method: ${endpoint.method}`,
        code: 'INVALID_HTTP_METHOD',
        severity: 'error',
      });
    }

    // Validate path
    if (!endpoint.path || endpoint.path.length === 0) {
      errors.push({
        field: 'path',
        message: 'Endpoint path cannot be empty',
        code: 'EMPTY_PATH',
        severity: 'error',
      });
    }

    if (!endpoint.path.startsWith('/')) {
      errors.push({
        field: 'path',
        message: 'Endpoint path must start with /',
        code: 'INVALID_PATH_FORMAT',
        severity: 'error',
      });
    }

    // Validate version
    if (!SemanticVersioning.validate(endpoint.version)) {
      errors.push({
        field: 'version',
        message: `Invalid semantic version: ${endpoint.version}`,
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    // Validate deprecation consistency
    if (endpoint.deprecated && !endpoint.deprecation) {
      warnings.push({
        field: 'deprecation',
        message: 'Deprecated endpoint should have deprecation record',
        code: 'MISSING_DEPRECATION',
        suggestion: 'Add deprecation record with sunset date and migration guide',
      });
    }

    if (endpoint.sunsetAt && !endpoint.deprecated) {
      warnings.push({
        field: 'deprecated',
        message: 'Endpoint has sunset date but is not marked as deprecated',
        code: 'INCONSISTENT_DEPRECATION',
        suggestion: 'Mark endpoint as deprecated',
      });
    }

    // Validate parameters
    for (const param of endpoint.parameters) {
      const paramValidation = this.validateParameter(param);
      errors.push(...paramValidation.errors);
      warnings.push(...paramValidation.warnings);
    }

    // Validate response
    const responseValidation = this.validateResponse(endpoint.response);
    errors.push(...responseValidation.errors);
    warnings.push(...responseValidation.warnings);

    // Recommendations
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      const hasBodyParam = endpoint.parameters.some(p => p.in === 'body');
      if (!hasBodyParam) {
        recommendations.push(`Consider adding body parameter for ${endpoint.method} requests`);
      }
    }

    return {
      valid: errors.length === 0,
      version: endpoint.version,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate API parameter
   */
  validateParameter(parameter: APIParameter): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate name
    if (!parameter.name || parameter.name.length === 0) {
      errors.push({
        field: 'name',
        message: 'Parameter name cannot be empty',
        code: 'EMPTY_PARAMETER_NAME',
        severity: 'error',
      });
    }

    // Validate location
    const validLocations = ['path', 'query', 'header', 'cookie', 'body'];
    if (!validLocations.includes(parameter.in)) {
      errors.push({
        field: 'in',
        message: `Invalid parameter location: ${parameter.in}`,
        code: 'INVALID_PARAMETER_LOCATION',
        severity: 'error',
      });
    }

    // Validate required consistency
    if (parameter.in === 'path' && !parameter.required) {
      errors.push({
        field: 'required',
        message: 'Path parameters must be required',
        code: 'PATH_PARAM_NOT_REQUIRED',
        severity: 'error',
      });
    }

    // Validate deprecation consistency
    if (parameter.deprecated && !parameter.deprecationInfo) {
      warnings.push({
        field: 'deprecationInfo',
        message: 'Deprecated parameter should have deprecation info',
        code: 'MISSING_PARAM_DEPRECATION',
        suggestion: 'Add deprecation info with sunset date and alternative',
      });
    }

    return {
      valid: errors.length === 0,
      version: '',
      errors,
      warnings,
      recommendations: [],
    };
  }

  /**
   * Validate API response
   */
  validateResponse(response: APIResponse): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate status code
    if (response.statusCode < 100 || response.statusCode > 599) {
      errors.push({
        field: 'statusCode',
        message: `Invalid status code: ${response.statusCode}`,
        code: 'INVALID_STATUS_CODE',
        severity: 'error',
      });
    }

    // Validate description
    if (!response.description || response.description.length === 0) {
      warnings.push({
        field: 'description',
        message: 'Response description is empty',
        code: 'EMPTY_RESPONSE_DESCRIPTION',
        suggestion: 'Add description for the response',
      });
    }

    return {
      valid: errors.length === 0,
      version: '',
      errors,
      warnings,
      recommendations: [],
    };
  }

  /**
   * Validate API contract
   */
  validateContract(contract: APIContract): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate version
    if (!SemanticVersioning.validate(contract.version)) {
      errors.push({
        field: 'version',
        message: `Invalid semantic version: ${contract.version}`,
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    // Validate metadata
    if (!contract.metadata.title || contract.metadata.title.length === 0) {
      errors.push({
        field: 'metadata.title',
        message: 'Contract title cannot be empty',
        code: 'EMPTY_CONTRACT_TITLE',
        severity: 'error',
      });
    }

    if (!contract.metadata.baseUrl || contract.metadata.baseUrl.length === 0) {
      warnings.push({
        field: 'metadata.baseUrl',
        message: 'Base URL is not specified',
        code: 'MISSING_BASE_URL',
        suggestion: 'Add base URL for the API',
      });
    }

    // Validate endpoints
    const endpointPaths = new Set<string>();
    for (const endpoint of contract.endpoints) {
      const validation = this.validateEndpoint(endpoint);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);

      // Check for duplicate endpoints
      const key = `${endpoint.method}:${endpoint.path}`;
      if (endpointPaths.has(key)) {
        errors.push({
          field: 'endpoints',
          message: `Duplicate endpoint: ${endpoint.method} ${endpoint.path}`,
          code: 'DUPLICATE_ENDPOINT',
          severity: 'error',
        });
      }
      endpointPaths.add(key);

      // Check version consistency
      if (endpoint.version !== contract.version) {
        warnings.push({
          field: 'endpoint.version',
          message: `Endpoint version ${endpoint.version} differs from contract version ${contract.version}`,
          code: 'VERSION_MISMATCH',
          suggestion: 'Ensure endpoint version matches contract version',
        });
      }
    }

    // Validate security schemes
    for (const [name, scheme] of Object.entries(contract.securitySchemes)) {
      if (!name || name.length === 0) {
        errors.push({
          field: 'securitySchemes',
          message: 'Security scheme name cannot be empty',
          code: 'EMPTY_SCHEME_NAME',
          severity: 'error',
        });
      }

      const validTypes = ['apiKey', 'http', 'oauth2', 'openIdConnect'];
      if (!validTypes.includes(scheme.type)) {
        errors.push({
          field: 'securitySchemes.type',
          message: `Invalid security scheme type: ${scheme.type}`,
          code: 'INVALID_SECURITY_TYPE',
          severity: 'error',
        });
      }
    }

    return {
      valid: errors.length === 0,
      version: contract.version,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate deprecation record
   */
  validateDeprecation(deprecation: DeprecationRecord): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate dates
    if (deprecation.sunsetDate <= deprecation.deprecationDate) {
      errors.push({
        field: 'sunsetDate',
        message: 'Sunset date must be after deprecation date',
        code: 'INVALID_SUNSET_DATE',
        severity: 'error',
      });
    }

    // Validate version
    if (!SemanticVersioning.validate(deprecation.apiVersion)) {
      errors.push({
        field: 'apiVersion',
        message: `Invalid semantic version: ${deprecation.apiVersion}`,
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    // Validate successor
    if (
      deprecation.successorVersion &&
      !SemanticVersioning.validate(deprecation.successorVersion)
    ) {
      errors.push({
        field: 'successorVersion',
        message: `Invalid semantic version for successor: ${deprecation.successorVersion}`,
        code: 'INVALID_SUCCESSOR_VERSION',
        severity: 'error',
      });
    }

    // Check for migration guide
    if (!deprecation.migrationGuide) {
      warnings.push({
        field: 'migrationGuide',
        message: 'Deprecation should have migration guide',
        code: 'MISSING_MIGRATION_GUIDE',
        suggestion: 'Provide migration guide for users',
      });
    }

    // Check deprecation notice period
    const noticeDays =
      (deprecation.sunsetDate.getTime() - deprecation.deprecationDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (noticeDays < 90) {
      warnings.push({
        field: 'deprecationDate',
        message: `Deprecation notice period is short: ${noticeDays} days (recommended: 90+ days)`,
        code: 'SHORT_NOTICE_PERIOD',
        suggestion: 'Consider extending the notice period',
      });
    }

    return {
      valid: errors.length === 0,
      version: deprecation.apiVersion,
      errors,
      warnings,
      recommendations: [],
    };
  }

  /**
   * Validate version compatibility
   */
  validateCompatibility(
    sourceVersion: string,
    targetVersion: string
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate versions
    if (!SemanticVersioning.validate(sourceVersion)) {
      errors.push({
        field: 'sourceVersion',
        message: `Invalid semantic version: ${sourceVersion}`,
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    if (!SemanticVersioning.validate(targetVersion)) {
      errors.push({
        field: 'targetVersion',
        message: `Invalid semantic version: ${targetVersion}`,
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    // Compare versions
    const comparison = SemanticVersioning.compareDetailed(sourceVersion, targetVersion);

    if (comparison.majorChange) {
      recommendations.push('Major version change detected - review breaking changes carefully');
    }

    if (comparison.minorChange) {
      recommendations.push('Minor version change - new features available');
    }

    if (comparison.upgradeType === 'downgrade') {
      warnings.push({
        field: 'targetVersion',
        message: 'Target version is older than source version',
        code: 'VERSION_DOWNGRADE',
        suggestion: 'Verify intentional downgrade',
      });
    }

    return {
      valid: errors.length === 0,
      version: targetVersion,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate migration step
   */
  validateMigrationStep(step: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!step.description || step.description.length === 0) {
      errors.push({
        field: 'description',
        message: 'Migration step must have a description',
        code: 'EMPTY_STEP_DESCRIPTION',
        severity: 'error',
      });
    }

    if (!step.action) {
      errors.push({
        field: 'action',
        message: 'Migration step must have an action type',
        code: 'MISSING_STEP_ACTION',
        severity: 'error',
      });
    }

    if (typeof step.step !== 'number' || step.step < 1) {
      errors.push({
        field: 'step',
        message: 'Migration step must have a valid step number',
        code: 'INVALID_STEP_NUMBER',
        severity: 'error',
      });
    }

    return {
      valid: errors.length === 0,
      version: '',
      errors,
      warnings,
      recommendations: [],
    };
  }

  /**
   * Bulk validate multiple items
   */
  bulkValidate<T>(
    items: T[],
    validator: (item: T) => ValidationResult
  ): { valid: boolean; results: ValidationResult[] } {
    const results = items.map(validator);
    const valid = results.every(r => r.valid);

    return { valid, results };
  }

  /**
   * Get validation summary
   */
  getValidationSummary(result: ValidationResult): {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    recommendationCount: number;
  } {
    return {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      recommendationCount: result.recommendations.length,
    };
  }
}
