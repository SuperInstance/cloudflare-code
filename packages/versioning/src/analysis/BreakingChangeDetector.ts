/**
 * Breaking Change Detector - Analyze API changes for breaking changes
 */

import {
  BreakingChange,
  BreakingChangeType,
  APIEndpoint,
  APIParameter,
  APIResponse,
  MigrationStep,
  MigrationAction,
} from '../types/index.js';

export interface ChangeAnalysis {
  breakingChanges: BreakingChange[];
  nonBreakingChanges: BreakingChange[];
  summary: {
    total: number;
    breaking: number;
    nonBreaking: number;
    severity: 'major' | 'minor' | 'patch';
  };
}

export interface EndpointComparison {
  endpoint: string;
  removed: boolean;
  added: boolean;
  modified: boolean;
  changes: BreakingChange[];
}

export class BreakingChangeDetector {
  /**
   * Compare two API versions and detect breaking changes
   */
  compareVersions(
    oldEndpoints: APIEndpoint[],
    newEndpoints: APIEndpoint[]
  ): ChangeAnalysis {
    const breakingChanges: BreakingChange[] = [];
    const nonBreakingChanges: BreakingChange[] = [];

    // Create maps for easier comparison
    const oldMap = this.createEndpointMap(oldEndpoints);
    const newMap = this.createEndpointMap(newEndpoints);

    // Check for removed endpoints
    for (const [key, oldEndpoint] of oldMap.entries()) {
      if (!newMap.has(key)) {
        breakingChanges.push({
          type: BreakingChangeType.ENDPOINT_REMOVED,
          severity: 'major',
          category: 'breaking',
          description: `Endpoint ${oldEndpoint.method} ${oldEndpoint.path} was removed`,
          impact: [`Clients using ${oldEndpoint.method} ${oldEndpoint.path} will fail`],
          affectedEndpoints: [`${oldEndpoint.method} ${oldEndpoint.path}`],
          migration: this.generateEndpointRemovalMigration(oldEndpoint),
          automatedFix: false,
        });
      }
    }

    // Check for added and modified endpoints
    for (const [key, newEndpoint] of newMap.entries()) {
      const oldEndpoint = oldMap.get(key);

      if (!oldEndpoint) {
        // New endpoint added
        nonBreakingChanges.push({
          type: BreakingChangeType.ENDPOINT_REMOVED,
          severity: 'minor',
          category: 'non-breaking',
          description: `New endpoint ${newEndpoint.method} ${newEndpoint.path} was added`,
          impact: ['Clients can optionally use the new endpoint'],
          affectedEndpoints: [`${newEndpoint.method} ${newEndpoint.path}`],
          migration: [],
          automatedFix: true,
        });
      } else {
        // Compare existing endpoint
        const changes = this.compareEndpoints(oldEndpoint, newEndpoint);
        breakingChanges.push(...changes.breaking);
        nonBreakingChanges.push(...changes.nonBreaking);
      }
    }

    // Calculate summary
    const total = breakingChanges.length + nonBreakingChanges.length;
    let severity: 'major' | 'minor' | 'patch' = 'patch';
    if (breakingChanges.length > 0) {
      severity = 'major';
    } else if (nonBreakingChanges.length > 0) {
      severity = 'minor';
    }

    return {
      breakingChanges,
      nonBreakingChanges,
      summary: {
        total,
        breaking: breakingChanges.length,
        nonBreaking: nonBreakingChanges.length,
        severity,
      },
    };
  }

  /**
   * Compare two endpoints
   */
  compareEndpoints(
    oldEndpoint: APIEndpoint,
    newEndpoint: APIEndpoint
  ): { breaking: BreakingChange[]; nonBreaking: BreakingChange[] } {
    const breaking: BreakingChange[] = [];
    const nonBreaking: BreakingChange[] = [];

    // Check HTTP method change
    if (oldEndpoint.method !== newEndpoint.method) {
      breaking.push({
        type: BreakingChangeType.HTTP_METHOD_CHANGED,
        severity: 'major',
        category: 'breaking',
        description: `HTTP method changed from ${oldEndpoint.method} to ${newEndpoint.method}`,
        impact: ['All client requests will fail with method not allowed'],
        affectedEndpoints: [`${oldEndpoint.method} ${oldEndpoint.path}`],
        migration: [
          {
            step: 1,
            description: `Update HTTP method from ${oldEndpoint.method} to ${newEndpoint.method}`,
            action: MigrationAction.CHANGE_METHOD,
            automated: true,
            codeExample: `// Change: ${oldEndpoint.method} ${oldEndpoint.path}\n// To: ${newEndpoint.method} ${newEndpoint.path}`,
          },
        ],
        automatedFix: true,
      });
    }

    // Check parameters
    const paramChanges = this.compareParameters(
      oldEndpoint.parameters,
      newEndpoint.parameters
    );
    breaking.push(...paramChanges.breaking);
    nonBreaking.push(...paramChanges.nonBreaking);

    // Check response
    const responseChanges = this.compareResponses(
      oldEndpoint.response,
      newEndpoint.response
    );
    breaking.push(...responseChanges.breaking);
    nonBreaking.push(...responseChanges.nonBreaking);

    // Check authentication
    const authChanges = this.compareAuthentication(
      oldEndpoint.authentication,
      newEndpoint.authentication
    );
    breaking.push(...authChanges.breaking);
    nonBreaking.push(...authChanges.nonBreaking);

    // Check rate limit
    const rateLimitChanges = this.compareRateLimits(
      oldEndpoint.rateLimit,
      newEndpoint.rateLimit
    );
    breaking.push(...rateLimitChanges.breaking);
    nonBreaking.push(...rateLimitChanges.nonBreaking);

    return { breaking, nonBreaking };
  }

  /**
   * Compare endpoint parameters
   */
  compareParameters(
    oldParams: APIParameter[],
    newParams: APIParameter[]
  ): { breaking: BreakingChange[]; nonBreaking: BreakingChange[] } {
    const breaking: BreakingChange[] = [];
    const nonBreaking: BreakingChange[] = [];

    const oldMap = new Map(oldParams.map(p => [p.name, p]));
    const newMap = new Map(newParams.map(p => [p.name, p]));

    // Check for removed parameters
    for (const [name, oldParam] of oldMap.entries()) {
      if (!newMap.has(name)) {
        if (oldParam.required) {
          breaking.push({
            type: BreakingChangeType.PARAMETER_REMOVED,
            severity: 'major',
            category: 'breaking',
            description: `Required parameter '${name}' was removed`,
            impact: [`Requests including parameter '${name}' will fail`],
            affectedEndpoints: [],
            migration: [
              {
                step: 1,
                description: `Remove parameter '${name}' from requests`,
                action: MigrationAction.REMOVE_PARAMETER,
                automated: true,
                codeExample: `// Remove: ${name}`,
              },
            ],
            automatedFix: true,
          });
        } else {
          nonBreaking.push({
            type: BreakingChangeType.PARAMETER_REMOVED,
            severity: 'patch',
            category: 'non-breaking',
            description: `Optional parameter '${name}' was removed`,
            impact: [`Requests including parameter '${name}' may be ignored`],
            affectedEndpoints: [],
            migration: [
              {
                step: 1,
                description: `Remove parameter '${name}' from requests (optional)`,
                action: MigrationAction.REMOVE_PARAMETER,
                automated: true,
              },
            ],
            automatedFix: true,
          });
        }
      }
    }

    // Check for modified and added parameters
    for (const [name, newParam] of newMap.entries()) {
      const oldParam = oldMap.get(name);

      if (!oldParam) {
        // New parameter added
        if (newParam.required) {
          breaking.push({
            type: BreakingChangeType.PARAMETER_REQUIRED_CHANGED,
            severity: 'major',
            category: 'breaking',
            description: `New required parameter '${name}' was added`,
            impact: [`Requests without parameter '${name}' will fail`],
            affectedEndpoints: [],
            migration: [
              {
                step: 1,
                description: `Add required parameter '${name}' to requests`,
                action: MigrationAction.ADD_PARAMETER,
                automated: false,
              },
            ],
            automatedFix: false,
          });
        } else {
          nonBreaking.push({
            type: BreakingChangeType.PARAMETER_REQUIRED_CHANGED,
            severity: 'minor',
            category: 'non-breaking',
            description: `New optional parameter '${name}' was added`,
            impact: ['Clients can optionally use the new parameter'],
            affectedEndpoints: [],
            migration: [],
            automatedFix: true,
          });
        }
      } else {
        // Check for parameter changes
        if (oldParam.type !== newParam.type) {
          breaking.push({
            type: BreakingChangeType.PARAMETER_TYPE_CHANGED,
            severity: 'major',
            category: 'breaking',
            description: `Parameter '${name}' type changed from ${oldParam.type} to ${newParam.type}`,
            impact: [`Requests with parameter '${name}' may be rejected or behave differently`],
            affectedEndpoints: [],
            migration: [
              {
                step: 1,
                description: `Update parameter '${name}' type from ${oldParam.type} to ${newParam.type}`,
                action: MigrationAction.CHANGE_PARAMETER_TYPE,
                automated: this.canAutomateTypeChange(oldParam.type, newParam.type),
              },
            ],
            automatedFix: this.canAutomateTypeChange(oldParam.type, newParam.type),
          });
        }

        if (oldParam.required && !newParam.required) {
          nonBreaking.push({
            type: BreakingChangeType.PARAMETER_REQUIRED_CHANGED,
            severity: 'minor',
            category: 'non-breaking',
            description: `Parameter '${name}' is now optional`,
            impact: ['Parameter can now be omitted'],
            affectedEndpoints: [],
            migration: [],
            automatedFix: true,
          });
        }

        if (!oldParam.required && newParam.required) {
          breaking.push({
            type: BreakingChangeType.PARAMETER_REQUIRED_CHANGED,
            severity: 'major',
            category: 'breaking',
            description: `Parameter '${name}' is now required`,
            impact: [`Requests without parameter '${name}' will fail`],
            affectedEndpoints: [],
            migration: [
              {
                step: 1,
                description: `Add required parameter '${name}' to requests`,
                action: MigrationAction.ADD_PARAMETER,
                automated: false,
              },
            ],
            automatedFix: false,
          });
        }
      }
    }

    return { breaking, nonBreaking };
  }

  /**
   * Compare response schemas
   */
  compareResponses(
    oldResponse: APIResponse,
    newResponse: APIResponse
  ): { breaking: BreakingChange[]; nonBreaking: BreakingChange[] } {
    const breaking: BreakingChange[] = [];
    const nonBreaking: BreakingChange[] = [];

    // Check status code change
    if (oldResponse.statusCode !== newResponse.statusCode) {
      breaking.push({
        type: BreakingChangeType.RESPONSE_STRUCTURE_CHANGED,
        severity: 'major',
        category: 'breaking',
        description: `Response status code changed from ${oldResponse.statusCode} to ${newResponse.statusCode}`,
        impact: ['Client error handling may break'],
        affectedEndpoints: [],
        migration: [
          {
            step: 1,
            description: `Update response handling for status code ${newResponse.statusCode}`,
            action: MigrationAction.CHANGE_FIELD_TYPE,
            automated: false,
          },
        ],
        automatedFix: false,
      });
    }

    // Compare schemas if both exist
    if (oldResponse.schema && newResponse.schema) {
      const schemaChanges = this.compareSchemas(oldResponse.schema, newResponse.schema);
      breaking.push(...schemaChanges.breaking);
      nonBreaking.push(...schemaChanges.nonBreaking);
    }

    return { breaking, nonBreaking };
  }

  /**
   * Compare JSON schemas
   */
  compareSchemas(
    oldSchema: any,
    newSchema: any,
    path = '$'
  ): { breaking: BreakingChange[]; nonBreaking: BreakingChange[] } {
    const breaking: BreakingChange[] = [];
    const nonBreaking: BreakingChange[] = [];

    // Handle different schema types
    if (oldSchema.type !== newSchema.type) {
      breaking.push({
        type: BreakingChangeType.RESPONSE_FIELD_TYPE_CHANGED,
        severity: 'major',
        category: 'breaking',
        description: `Field at ${path} type changed from ${oldSchema.type} to ${newSchema.type}`,
        impact: [`Client parsing of field at ${path} will fail`],
        affectedEndpoints: [],
        migration: [
          {
            step: 1,
            description: `Update type handling for field at ${path}`,
            action: MigrationAction.CHANGE_FIELD_TYPE,
            automated: false,
          },
        ],
        automatedFix: false,
      });
    }

    // Handle object properties
    if (oldSchema.type === 'object' && newSchema.type === 'object') {
      const oldProps = oldSchema.properties || {};
      const newProps = newSchema.properties || {};
      const oldRequired = new Set(oldSchema.required || []);
      const newRequired = new Set(newSchema.required || []);

      // Check for removed properties
      for (const propName of Object.keys(oldProps)) {
        if (!newProps[propName]) {
          breaking.push({
            type: BreakingChangeType.RESPONSE_FIELD_REMOVED,
            severity: 'major',
            category: 'breaking',
            description: `Field '${path}.${propName}' was removed`,
            impact: [`Clients accessing field '${propName}' will get undefined`],
            affectedEndpoints: [],
            migration: [
              {
                step: 1,
                description: `Remove access to field '${propName}'`,
                action: MigrationAction.REMOVE_FIELD,
                automated: true,
              },
            ],
            automatedFix: true,
          });
        }
      }

      // Check for added/modified properties
      for (const propName of Object.keys(newProps)) {
        const oldProp = oldProps[propName];
        const newProp = newProps[propName];

        if (!oldProp) {
          // New property added
          if (newRequired.has(propName)) {
            nonBreaking.push({
              type: BreakingChangeType.RESPONSE_FIELD_TYPE_CHANGED,
              severity: 'minor',
              category: 'non-breaking',
              description: `New required field '${path}.${propName}' was added`,
              impact: ['Clients should handle the new field'],
              affectedEndpoints: [],
              migration: [],
              automatedFix: true,
            });
          }
        } else {
          // Recursively compare nested properties
          const nestedChanges = this.compareSchemas(
            oldProp,
            newProp,
            `${path}.${propName}`
          );
          breaking.push(...nestedChanges.breaking);
          nonBreaking.push(...nestedChanges.nonBreaking);
        }
      }

      // Check for newly required fields
      for (const propName of newRequired) {
        if (!oldRequired.has(propName) && oldProps[propName]) {
          breaking.push({
            type: BreakingChangeType.RESPONSE_STRUCTURE_CHANGED,
            severity: 'minor',
            category: 'breaking',
            description: `Field '${path}.${propName}' is now required`,
            impact: ['Responses may not include this field for old clients'],
            affectedEndpoints: [],
            migration: [],
            automatedFix: true,
          });
        }
      }
    }

    // Handle array items
    if (oldSchema.type === 'array' && newSchema.type === 'array') {
      if (oldSchema.items && newSchema.items) {
        const itemChanges = this.compareSchemas(
          oldSchema.items,
          newSchema.items,
          `${path}[]`
        );
        breaking.push(...itemChanges.breaking);
        nonBreaking.push(...itemChanges.nonBreaking);
      }
    }

    return { breaking, nonBreaking };
  }

  /**
   * Compare authentication schemes
   */
  compareAuthentication(
    oldAuth: any,
    newAuth: any
  ): { breaking: BreakingChange[]; nonBreaking: BreakingChange[] } {
    const breaking: BreakingChange[] = [];
    const nonBreaking: BreakingChange[] = [];

    if (!oldAuth && newAuth) {
      breaking.push({
        type: BreakingChangeType.AUTHENTICATION_CHANGED,
        severity: 'major',
        category: 'breaking',
        description: 'Authentication is now required',
        impact: ['Unauthenticated requests will fail'],
        affectedEndpoints: [],
        migration: [
          {
            step: 1,
            description: 'Add authentication to requests',
            action: MigrationAction.UPDATE_AUTHENTICATION,
            automated: false,
          },
        ],
        automatedFix: false,
      });
    } else if (oldAuth && !newAuth) {
      nonBreaking.push({
        type: BreakingChangeType.AUTHENTICATION_CHANGED,
        severity: 'minor',
        category: 'non-breaking',
        description: 'Authentication is no longer required',
        impact: ['Requests can be made without authentication'],
        affectedEndpoints: [],
        migration: [],
        automatedFix: true,
      });
    } else if (oldAuth && newAuth && oldAuth.type !== newAuth.type) {
      breaking.push({
        type: BreakingChangeType.AUTHENTICATION_CHANGED,
        severity: 'major',
        category: 'breaking',
        description: `Authentication type changed from ${oldAuth.type} to ${newAuth.type}`,
        impact: ['Existing authentication will not work'],
        affectedEndpoints: [],
        migration: [
          {
            step: 1,
            description: `Update authentication to ${newAuth.type}`,
            action: MigrationAction.UPDATE_AUTHENTICATION,
            automated: false,
          },
        ],
        automatedFix: false,
      });
    }

    return { breaking, nonBreaking };
  }

  /**
   * Compare rate limits
   */
  compareRateLimits(
    oldLimit: any,
    newLimit: any
  ): { breaking: BreakingChange[]; nonBreaking: BreakingChange[] } {
    const breaking: BreakingChange[] = [];
    const nonBreaking: BreakingChange[] = [];

    if (!oldLimit && newLimit) {
      breaking.push({
        type: BreakingChangeType.RATE_LIMIT_CHANGED,
        severity: 'minor',
        category: 'breaking',
        description: `Rate limit added: ${newLimit.requests} requests per ${newLimit.period}s`,
        impact: ['Requests may be rate-limited'],
        affectedEndpoints: [],
        migration: [],
        automatedFix: true,
      });
    } else if (oldLimit && !newLimit) {
      nonBreaking.push({
        type: BreakingChangeType.RATE_LIMIT_CHANGED,
        severity: 'minor',
        category: 'non-breaking',
        description: 'Rate limit removed',
        impact: ['Higher request throughput possible'],
        affectedEndpoints: [],
        migration: [],
        automatedFix: true,
      });
    } else if (oldLimit && newLimit) {
      if (newLimit.requests < oldLimit.requests) {
        breaking.push({
          type: BreakingChangeType.RATE_LIMIT_CHANGED,
          severity: 'minor',
          category: 'breaking',
          description: `Rate limit decreased from ${oldLimit.requests} to ${newLimit.requests} requests per ${oldLimit.period}s`,
          impact: ['More requests may be rate-limited'],
          affectedEndpoints: [],
          migration: [],
          automatedFix: true,
        });
      } else if (newLimit.requests > oldLimit.requests) {
        nonBreaking.push({
          type: BreakingChangeType.RATE_LIMIT_CHANGED,
          severity: 'minor',
          category: 'non-breaking',
          description: `Rate limit increased from ${oldLimit.requests} to ${newLimit.requests} requests per ${oldLimit.period}s`,
          impact: ['Higher request throughput possible'],
          affectedEndpoints: [],
          migration: [],
          automatedFix: true,
        });
      }
    }

    return { breaking, nonBreaking };
  }

  /**
   * Generate migration steps for removed endpoint
   */
  private generateEndpointRemovalMigration(endpoint: APIEndpoint): MigrationStep[] {
    const steps: MigrationStep[] = [
      {
        step: 1,
        description: `Identify all uses of endpoint ${endpoint.method} ${endpoint.path}`,
        action: MigrationAction.CHANGE_ENDPOINT,
        automated: false,
      },
      {
        step: 2,
        description: 'Review alternative endpoints or functionality',
        action: MigrationAction.CHANGE_ENDPOINT,
        automated: false,
      },
      {
        step: 3,
        description: 'Update client code to use alternative',
        action: MigrationAction.CHANGE_ENDPOINT,
        automated: false,
      },
    ];

    return steps;
  }

  /**
   * Check if type change can be automated
   */
  private canAutomateTypeChange(fromType: string, toType: string): boolean {
    // Safe conversions
    const safeConversions: Record<string, string[]> = {
      string: ['number', 'boolean'],
      number: ['string'],
      boolean: ['string'],
    };

    return safeConversions[fromType]?.includes(toType) || false;
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
   * Get impact score for breaking changes
   */
  getImpactScore(changes: BreakingChange[]): {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
  } {
    let score = 0;

    for (const change of changes) {
      switch (change.severity) {
        case 'major':
          score += 10;
          break;
        case 'minor':
          score += 5;
          break;
        case 'patch':
          score += 1;
          break;
      }
    }

    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score >= 50) {
      level = 'critical';
    } else if (score >= 30) {
      level = 'high';
    } else if (score >= 10) {
      level = 'medium';
    }

    return { score, level };
  }

  /**
   * Get recommendations for handling breaking changes
   */
  getRecommendations(changes: BreakingChange[]): string[] {
    const recommendations: string[] = [];

    const criticalChanges = changes.filter(c => c.severity === 'major');
    if (criticalChanges.length > 0) {
      recommendations.push(
        `Consider creating a new API version due to ${criticalChanges.length} major breaking changes`
      );
    }

    const automatedFixes = changes.filter(c => c.automatedFix);
    if (automatedFixes.length > 0) {
      recommendations.push(
        `${automatedFixes.length} changes can be automatically migrated`
      );
    }

    const endpointRemovals = changes.filter(
      c => c.type === BreakingChangeType.ENDPOINT_REMOVED
    );
    if (endpointRemovals.length > 0) {
      recommendations.push(
        `Provide alternative endpoints for ${endpointRemovals.length} removed endpoints`
      );
    }

    return recommendations;
  }
}
