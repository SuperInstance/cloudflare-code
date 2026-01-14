/**
 * Unit tests for API Composer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  APIComposer,
  createStep,
  validateCompositionConfig,
} from '../../src/composition/composer';
import { CompositionConfig, ServiceConfig, CompositionStep } from '../../src/types';

describe('APIComposer', () => {
  let composer: APIComposer;
  let config: CompositionConfig;
  let mockService: ServiceConfig;

  beforeEach(() => {
    config = {
      maxConcurrentRequests: 10,
      defaultTimeout: 5000,
      orchestrationTimeout: 30000,
      cache: {
        enabled: true,
        ttl: 60000,
        maxSize: 1000,
      },
    };

    mockService = {
      name: 'test-service',
      endpoint: 'http://localhost:4000',
      type: 'rest',
      timeout: 5000,
    };

    composer = new APIComposer(config);
    composer.registerService(mockService);
  });

  describe('initialization', () => {
    it('should create composer instance', () => {
      expect(composer).toBeInstanceOf(APIComposer);
    });

    it('should register services', () => {
      const services = composer.getServices();
      expect(services.has('test-service')).toBe(true);
    });
  });

  describe('plan creation', () => {
    it('should create valid plan', () => {
      const step = createStep('step1', 'test-service', 'getData');
      const plan = composer.createPlan([step]);

      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('steps');
      expect(plan).toHaveProperty('timeout');
      expect(plan.steps).toHaveLength(1);
    });

    it('should validate step dependencies', () => {
      const step1 = createStep('step1', 'test-service', 'getData');
      const step2 = createStep('step2', 'test-service', 'processData', {
        dependencies: ['step1'],
      });

      const plan = composer.createPlan([step1, step2]);

      expect(plan.steps).toHaveLength(2);
    });

    it('should reject circular dependencies', () => {
      const step1 = createStep('step1', 'test-service', 'getData', {
        dependencies: ['step2'],
      });
      const step2 = createStep('step2', 'test-service', 'getData', {
        dependencies: ['step1'],
      });

      expect(() => composer.createPlan([step1, step2])).toThrow();
    });
  });

  describe('service management', () => {
    it('should register service', () => {
      const service: ServiceConfig = {
        name: 'new-service',
        endpoint: 'http://localhost:4001',
        type: 'rest',
      };

      composer.registerService(service);

      const services = composer.getServices();
      expect(services.has('new-service')).toBe(true);
    });

    it('should unregister service', () => {
      composer.unregisterService('test-service');

      const services = composer.getServices();
      expect(services.has('test-service')).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should provide cache stats when enabled', () => {
      const stats = composer.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
    });

    it('should clear cache', () => {
      composer.clearCache();

      const stats = composer.getCacheStats();
      expect(stats?.size).toBe(0);
    });
  });
});

describe('createStep', () => {
  it('should create step with defaults', () => {
    const step = createStep('step1', 'service', 'operation');

    expect(step.id).toBe('step1');
    expect(step.service).toBe('service');
    expect(step.operation).toBe('operation');
    expect(step.type).toBe('query');
    expect(step.execution).toBe('parallel');
    expect(step.dependencies).toEqual([]);
    expect(step.inputs).toEqual([]);
    expect(step.outputs).toEqual([]);
  });

  it('should create step with options', () => {
    const step = createStep('step1', 'service', 'operation', {
      type: 'mutation',
      execution: 'sequential',
      timeout: 10000,
    });

    expect(step.type).toBe('mutation');
    expect(step.execution).toBe('sequential');
    expect(step.timeout).toBe(10000);
  });
});

describe('validateCompositionConfig', () => {
  it('should validate valid config', () => {
    const config: CompositionConfig = {
      maxConcurrentRequests: 10,
      defaultTimeout: 5000,
      orchestrationTimeout: 30000,
    };

    expect(() => validateCompositionConfig(config)).not.toThrow();
  });

  it('should reject invalid maxConcurrentRequests', () => {
    const config = {
      maxConcurrentRequests: 0,
      defaultTimeout: 5000,
      orchestrationTimeout: 30000,
    } as any;

    expect(() => validateCompositionConfig(config)).toThrow();
  });

  it('should reject invalid defaultTimeout', () => {
    const config = {
      maxConcurrentRequests: 10,
      defaultTimeout: 50,
      orchestrationTimeout: 30000,
    } as any;

    expect(() => validateCompositionConfig(config)).toThrow();
  });

  it('should reject invalid orchestrationTimeout', () => {
    const config = {
      maxConcurrentRequests: 10,
      defaultTimeout: 5000,
      orchestrationTimeout: 1000,
    } as any;

    expect(() => validateCompositionConfig(config)).toThrow();
  });

  it('should reject invalid cache TTL', () => {
    const config = {
      maxConcurrentRequests: 10,
      defaultTimeout: 5000,
      orchestrationTimeout: 30000,
      cache: {
        enabled: true,
        ttl: -1,
        maxSize: 100,
      },
    } as any;

    expect(() => validateCompositionConfig(config)).toThrow();
  });
});
