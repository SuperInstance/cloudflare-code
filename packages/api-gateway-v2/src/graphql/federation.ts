/**
 * GraphQL Federation Implementation
 * Supports Apollo Federation v2 with distributed queries and entity resolution
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLFieldConfig,
  GraphQLFieldResolver,
  buildASTSchema,
  parse,
  print,
  DocumentNode,
} from 'graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import {
  FederatedService,
  FederationContext,
  FederationConfig,
  QueryPlan,
  QueryOperation,
  FederationError,
  EntityDefinition,
  GatewayError,
} from '../types';

// ============================================================================
// Federation Gateway
// ============================================================================

export class FederationGateway {
  private context: FederationContext;
  private config: FederationConfig;
  private schema?: GraphQLSchema;
  private queryPlanCache: Map<string, QueryPlan>;
  private entityResolvers: Map<string, GraphQLFieldResolver>;

  constructor(config: FederationConfig) {
    this.config = config;
    this.context = {
      services: new Map(),
      schema: undefined,
      queryPlanCache: config.queryPlanCache?.enabled
        ? new Map()
        : undefined,
    };
    this.queryPlanCache = new Map();
    this.entityResolvers = new Map();
  }

  /**
   * Register a federated service
   */
  async registerService(service: FederatedService): Promise<void> {
    try {
      // Validate service schema
      this.validateServiceSchema(service);

      // Register service
      this.context.services.set(service.name, service);

      // Build entity resolvers for federated entities
      this.buildEntityResolvers(service);

      // Rebuild composed schema
      await this.composeSchema();

      console.log(`Registered federated service: ${service.name}`);
    } catch (error) {
      throw new FederationError(
        `Failed to register service ${service.name}`,
        error
      );
    }
  }

  /**
   * Unregister a federated service
   */
  async unregisterService(serviceName: string): Promise<void> {
    if (!this.context.services.has(serviceName)) {
      throw new GatewayError(`Service not found: ${serviceName}`, 'SERVICE_NOT_FOUND', 404);
    }

    this.context.services.delete(serviceName);
    this.entityResolvers.clear();

    await this.composeSchema();

    console.log(`Unregistered federated service: ${serviceName}`);
  }

  /**
   * Compose federated schema from all services
   */
  private async composeSchema(): Promise<void> {
    if (this.context.services.size === 0) {
      this.schema = undefined;
      return;
    }

    try {
      // Collect type definitions from all services
      const typeDefs: string[] = [];

      for (const [name, service] of this.context.services) {
        const schemaSDL = this.extractSchemaSDL(service.schema);
        typeDefs.push(schemaSDL);
      }

      // Combine type definitions
      const combinedTypeDefs = typeDefs.join('\n');

      // Build federated schema
      const documentNode = parse(combinedTypeDefs);
      this.schema = buildSubgraphSchema(documentNode);

      this.context.schema = this.schema;

      console.log(`Composed federated schema with ${this.context.services.size} services`);
    } catch (error) {
      throw new FederationError('Failed to compose federated schema', error);
    }
  }

  /**
   * Extract SDL from GraphQL schema
   */
  private extractSchemaSDL(schema: GraphQLSchema): string {
    return print(schema);
  }

  /**
   * Validate service schema for federation compatibility
   */
  private validateServiceSchema(service: FederatedService): void {
    const schema = service.schema;

    // Check for federation directives
    const queryType = schema.getQueryType();
    if (!queryType) {
      throw new FederationError(
        `Service ${service.name} missing Query type`
      );
    }

    // Validate entity definitions
    for (const entity of service.entities) {
      const entityType = schema.getType(entity.name);
      if (!entityType) {
        throw new FederationError(
          `Entity ${entity.name} not found in service ${service.name}`
        );
      }

      // Validate key fields exist
      const type = entityType as GraphQLObjectType;
      for (const key of entity.keys) {
        const fields = type.getFields();
        if (!fields[key]) {
          throw new FederationError(
            `Key field ${key} not found on entity ${entity.name}`
          );
        }
      }
    }
  }

  /**
   * Build entity resolvers for federated entities
   */
  private buildEntityResolvers(service: FederatedService): void {
    for (const entity of service.entities) {
      if (!entity.resolves) continue;

      const resolver: GraphQLFieldResolver = async (
        parent,
        args,
        context,
        info
      ) => {
        const representations = args.representations;

        // Query the service for entities
        const response = await this.queryService(service, {
          query: this.buildEntityQuery(entity, representations),
          variables: { representations },
        });

        return response.data?._entities || [];
      };

      this.entityResolvers.set(
        `${service.name}_${entity.name}`,
        resolver
      );
    }
  }

  /**
   * Build entity query for federation
   */
  private buildEntityQuery(
    entity: EntityDefinition,
    representations: any[]
  ): string {
    const fields = entity.fields.map(f => f.name).join('\n      ');

    return `
      query GetEntities($representations: [_Any!]!) {
        _entities(representations: $representations) {
          ... on ${entity.name} {
            ${fields}
          }
        }
      }
    `;
  }

  /**
   * Query a federated service
   */
  private async queryService(
    service: FederatedService,
    query: { query: string; variables?: Record<string, any> }
  ): Promise<any> {
    const response = await fetch(service.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new FederationError(
        `Service ${service.name} query failed: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Plan query execution across federated services
   */
  async planQuery(query: string): Promise<QueryPlan> {
    // Check cache first
    const cacheKey = this.hashQuery(query);
    if (this.queryPlanCache.has(cacheKey)) {
      return this.queryPlanCache.get(cacheKey)!;
    }

    // Parse query
    const document = parse(query);

    // Analyze query to determine required services
    const operations = this.analyzeQuery(document);

    // Build query plan
    const plan: QueryPlan = {
      id: this.generatePlanId(),
      operations,
      dependencies: this.extractDependencies(operations),
      estimatedCost: this.estimateCost(operations),
    };

    // Cache plan if enabled
    if (this.config.queryPlanCache?.enabled) {
      this.queryPlanCache.set(cacheKey, plan);
    }

    return plan;
  }

  /**
   * Analyze GraphQL query to determine operations
   */
  private analyzeQuery(document: DocumentNode): QueryOperation[] {
    const operations: QueryOperation[] = [];

    // For each operation in the query
    for (const definition of document.definitions) {
      if (definition.kind !== 'OperationDefinition') continue;

      // Analyze selection set to determine which services are needed
      const services = this.determineRequiredServices(definition);

      // Create operations for each service
      for (const service of services) {
        operations.push({
          id: this.generateOperationId(),
          service,
          operation: this.extractServiceOperation(definition, service),
          variables: {},
          dependsOn: [],
        });
      }
    }

    return operations;
  }

  /**
   * Determine which services are required for a query
   */
  private determineRequiredServices(operation: any): string[] {
    const services = new Set<string>();

    // Traverse selection set
    this.traverseSelectionSet(operation.selectionSet, (field) => {
      // Find which service owns this field
      const serviceName = this.findServiceForField(field.name.value);
      if (serviceName) {
        services.add(serviceName);
      }
    });

    return Array.from(services);
  }

  /**
   * Traverse GraphQL selection set
   */
  private traverseSelectionSet(
    selectionSet: any,
    callback: (field: any) => void
  ): void {
    if (!selectionSet) return;

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        callback(selection);
        if (selection.selectionSet) {
          this.traverseSelectionSet(selection.selectionSet, callback);
        }
      } else if (selection.kind === 'InlineFragment') {
        this.traverseSelectionSet(selection.selectionSet, callback);
      }
    }
  }

  /**
   * Find which service owns a field
   */
  private findServiceForField(fieldName: string): string | null {
    for (const [serviceName, service] of this.context.services) {
      const queryType = service.schema.getQueryType();
      if (queryType && queryType.getFields()[fieldName]) {
        return serviceName;
      }
    }
    return null;
  }

  /**
   * Extract operation for a specific service
   */
  private extractServiceOperation(operation: any, serviceName: string): string {
    // Build partial query for this service
    // This is a simplified version - real implementation would be more complex
    return print({
      kind: 'Document',
      definitions: [operation],
    });
  }

  /**
   * Extract dependencies between operations
   */
  private extractDependencies(operations: QueryOperation[]): string[] {
    const dependencies: string[] = [];

    // Analyze which operations depend on others
    for (const op of operations) {
      for (const depId of op.dependsOn) {
        dependencies.push(`${op.id}->${depId}`);
      }
    }

    return dependencies;
  }

  /**
   * Estimate query execution cost
   */
  private estimateCost(operations: QueryOperation[]): number {
    return operations.length * 10; // Simplified cost model
  }

  /**
   * Execute federated query
   */
  async executeQuery(
    query: string,
    variables?: Record<string, any>
  ): Promise<any> {
    // Plan the query
    const plan = await this.planQuery(query);

    // Execute operations in dependency order
    const results = await this.executePlan(plan, variables);

    // Merge results
    return this.mergeResults(results);
  }

  /**
   * Execute query plan
   */
  private async executePlan(
    plan: QueryPlan,
    variables?: Record<string, any>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const executed = new Set<string>();

    // Execute operations in topological order
    const sortedOps = this.topologicalSort(plan.operations);

    for (const operation of sortedOps) {
      // Check if dependencies are met
      if (
        operation.dependsOn.some(dep => !executed.has(dep))
      ) {
        throw new FederationError('Dependency not satisfied');
      }

      // Execute operation
      const service = this.context.services.get(operation.service);
      if (!service) {
        throw new FederationError(`Service not found: ${operation.service}`);
      }

      const result = await this.queryService(service, {
        query: operation.operation,
        variables: { ...variables, ...operation.variables },
      });

      results.set(operation.id, result);
      executed.add(operation.id);
    }

    return results;
  }

  /**
   * Topological sort of operations
   */
  private topologicalSort(operations: QueryOperation[]): QueryOperation[] {
    const sorted: QueryOperation[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (opId: string) => {
      if (visited.has(opId)) return;
      if (visiting.has(opId)) {
        throw new FederationError('Circular dependency detected');
      }

      visiting.add(opId);

      const op = operations.find(o => o.id === opId);
      if (op) {
        for (const depId of op.dependsOn) {
          visit(depId);
        }
        sorted.push(op);
        visited.add(opId);
      }

      visiting.delete(opId);
    };

    for (const op of operations) {
      visit(op.id);
    }

    return sorted;
  }

  /**
   * Merge results from multiple services
   */
  private mergeResults(results: Map<string, any>): any {
    const merged: any = { data: {} };
    const errors: any[] = [];

    for (const [opId, result] of results) {
      if (result.data) {
        Object.assign(merged.data, result.data);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    if (errors.length > 0) {
      merged.errors = errors;
    }

    return merged;
  }

  /**
   * Hash query for caching
   */
  private hashQuery(query: string): string {
    // Simple hash - use proper hash in production
    return query;
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get composed schema
   */
  getSchema(): GraphQLSchema | undefined {
    return this.schema;
  }

  /**
   * Get registered services
   */
  getServices(): Map<string, FederatedService> {
    return new Map(this.context.services);
  }

  /**
   * Get query plan cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.queryPlanCache.size,
      keys: Array.from(this.queryPlanCache.keys()),
    };
  }

  /**
   * Clear query plan cache
   */
  clearCache(): void {
    this.queryPlanCache.clear();
  }
}

// ============================================================================
// Federation Utilities
// ============================================================================

/**
 * Create federated service definition
 */
export function createFederatedService(
  name: string,
  schema: GraphQLSchema,
  url: string,
  entities: EntityDefinition[]
): FederatedService {
  return {
    name,
    schema,
    url,
    version: '1.0.0',
    entities,
  };
}

/**
 * Validate federation configuration
 */
export function validateFederationConfig(
  config: FederationConfig
): void {
  if (config.version !== 1 && config.version !== 2) {
    throw new GatewayError(
      'Invalid federation version',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.schemaPollingInterval && config.schemaPollingInterval < 1000) {
    throw new GatewayError(
      'Schema polling interval must be at least 1000ms',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.queryPlanCache?.enabled) {
    if (config.queryPlanCache.ttl < 0) {
      throw new GatewayError(
        'Query plan cache TTL must be non-negative',
        'INVALID_CONFIG',
        400
      );
    }
    if (config.queryPlanCache.maxSize < 1) {
      throw new GatewayError(
        'Query plan cache max size must be at least 1',
        'INVALID_CONFIG',
        400
      );
    }
  }
}

/**
 * Extract federated entities from schema
 */
export function extractEntities(
  schema: GraphQLSchema
): EntityDefinition[] {
  const entities: EntityDefinition[] = [];

  const queryType = schema.getQueryType();
  if (!queryType) return entities;

  const fields = queryType.getFields();

  // Look for _entities field (federation)
  if (fields._entities) {
    // Extract entity types from the field
    const entityType = fields._entities.type;
    // Parse entity definitions from the schema
  }

  return entities;
}
