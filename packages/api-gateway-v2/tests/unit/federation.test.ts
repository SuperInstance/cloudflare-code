/**
 * Unit tests for GraphQL Federation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FederationGateway,
  createFederatedService,
  validateFederationConfig,
} from '../../src/graphql/federation';
import { GraphQLSchema, GraphQLObjectType, GraphQLFieldConfig, GraphQLString } from 'graphql';
import { FederationConfig, EntityDefinition, GatewayError } from '../../src/types';

describe('FederationGateway', () => {
  let gateway: FederationGateway;
  let config: FederationConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      version: 2,
      queryPlanCache: {
        enabled: true,
        ttl: 60000,
        maxSize: 1000,
      },
    };
    gateway = new FederationGateway(config);
  });

  describe('initialization', () => {
    it('should create gateway instance', () => {
      expect(gateway).toBeInstanceOf(FederationGateway);
    });

    it('should initialize with empty services', () => {
      const services = gateway.getServices();
      expect(services.size).toBe(0);
    });

    it('should initialize with empty cache', () => {
      const stats = gateway.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toHaveLength(0);
    });
  });

  describe('service registration', () => {
    it('should register a federated service', async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            user: {
              type: GraphQLString,
              resolve: () => 'test',
            } as GraphQLFieldConfig<any, any>,
          },
        }),
      });

      const service = createFederatedService(
        'users',
        schema,
        'http://localhost:4001',
        []
      );

      await gateway.registerService(service);

      const services = gateway.getServices();
      expect(services.has('users')).toBe(true);
    });

    it('should unregister a service', async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            test: { type: GraphQLString } as GraphQLFieldConfig<any, any>,
          },
        }),
      });

      const service = createFederatedService(
        'test',
        schema,
        'http://localhost:4000',
        []
      );

      await gateway.registerService(service);
      await gateway.unregisterService('test');

      const services = gateway.getServices();
      expect(services.has('test')).toBe(false);
    });
  });

  describe('query planning', () => {
    it('should plan simple query', async () => {
      const query = `
        query {
          user(id: "1") {
            id
            name
          }
        }
      `;

      const plan = await gateway.planQuery(query);

      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('operations');
      expect(plan).toHaveProperty('dependencies');
      expect(plan).toHaveProperty('estimatedCost');
    });

    it('should cache query plans', async () => {
      const query = '{ user { id } }';
      const plan1 = await gateway.planQuery(query);
      const plan2 = await gateway.planQuery(query);

      expect(plan1.id).toBe(plan2.id);
    });

    it('should clear cache', async () => {
      await gateway.planQuery('{ test }');
      gateway.clearCache();

      const stats = gateway.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('cache statistics', () => {
    it('should return cache stats', () => {
      const stats = gateway.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });
});

describe('validateFederationConfig', () => {
  it('should validate valid config', () => {
    const config: FederationConfig = {
      enabled: true,
      version: 2,
    };

    expect(() => validateFederationConfig(config)).not.toThrow();
  });

  it('should reject invalid version', () => {
    const config = {
      enabled: true,
      version: 3,
    } as any;

    expect(() => validateFederationConfig(config)).toThrow(GatewayError);
  });

  it('should reject invalid polling interval', () => {
    const config = {
      enabled: true,
      version: 2,
      schemaPollingInterval: 500,
    } as any;

    expect(() => validateFederationConfig(config)).toThrow(GatewayError);
  });

  it('should reject invalid cache TTL', () => {
    const config = {
      enabled: true,
      version: 2,
      queryPlanCache: {
        enabled: true,
        ttl: -1,
        maxSize: 100,
      },
    } as any;

    expect(() => validateFederationConfig(config)).toThrow(GatewayError);
  });
});

describe('createFederatedService', () => {
  it('should create service definition', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: { type: GraphQLString } as GraphQLFieldConfig<any, any>,
        },
      }),
    });

    const service = createFederatedService(
      'test-service',
      schema,
      'http://localhost:4000',
      []
    );

    expect(service.name).toBe('test-service');
    expect(service.schema).toBe(schema);
    expect(service.url).toBe('http://localhost:4000');
    expect(service.version).toBe('1.0.0');
    expect(service.entities).toEqual([]);
  });
});
