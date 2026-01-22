/**
 * Tests for BreakingChangeDetector
 */

import { describe, it, expect } from 'vitest';
import { BreakingChangeDetector } from '../analysis/BreakingChangeDetector';
import { APIEndpoint, BreakingChangeType } from '../types';

describe('BreakingChangeDetector', () => {
  let detector: BreakingChangeDetector;

  beforeEach(() => {
    detector = new BreakingChangeDetector();
  });

  const createEndpoint = (
    path: string,
    method: string,
    version: string,
    parameters: any[] = []
  ): APIEndpoint => ({
    path,
    method,
    version,
    parameters,
    response: {
      statusCode: 200,
      description: 'Success',
    },
    deprecation: {} as any,
  });

  describe('Endpoint Comparison', () => {
    it('should detect removed endpoint', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];

      const newEndpoints = [];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.ENDPOINT_REMOVED);
    });

    it('should detect added endpoint', () => {
      const oldEndpoints = [];

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.nonBreakingChanges.length).toBe(1);
    });

    it('should detect HTTP method change', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];

      const newEndpoints = [
        createEndpoint('/users', 'POST', '1.0.0'),
      ];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.HTTP_METHOD_CHANGED);
    });
  });

  describe('Parameter Comparison', () => {
    it('should detect removed required parameter', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          {
            name: 'id',
            in: 'query',
            type: 'string',
            required: true,
          },
        ]),
      ];

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', []),
      ];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.PARAMETER_REMOVED);
    });

    it('should detect added required parameter', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', []),
      ];

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          {
            name: 'id',
            in: 'query',
            type: 'string',
            required: true,
          },
        ]),
      ];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.PARAMETER_REQUIRED_CHANGED);
    });

    it('should detect parameter type change', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          {
            name: 'id',
            in: 'query',
            type: 'string',
            required: true,
          },
        ]),
      ];

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          {
            name: 'id',
            in: 'query',
            type: 'number',
            required: true,
          },
        ]),
      ];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.PARAMETER_TYPE_CHANGED);
    });

    it('should detect parameter becoming required', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          {
            name: 'id',
            in: 'query',
            type: 'string',
            required: false,
          },
        ]),
      ];

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          {
            name: 'id',
            in: 'query',
            type: 'string',
            required: true,
          },
        ]),
      ];

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.PARAMETER_REQUIRED_CHANGED);
    });
  });

  describe('Response Comparison', () => {
    it('should detect status code change', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];
      oldEndpoints[0].response.statusCode = 200;

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];
      newEndpoints[0].response.statusCode = 201;

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.RESPONSE_STRUCTURE_CHANGED);
    });
  });

  describe('Schema Comparison', () => {
    it('should detect removed field in object schema', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];
      oldEndpoints[0].response.schema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      };

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];
      newEndpoints[0].response.schema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      };

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.RESPONSE_FIELD_REMOVED);
    });

    it('should detect field type change in schema', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];
      oldEndpoints[0].response.schema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      };

      const newEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];
      newEndpoints[0].response.schema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      };

      const analysis = detector.compareVersions(oldEndpoints, newEndpoints);

      expect(analysis.breakingChanges.length).toBe(1);
      expect(analysis.breakingChanges[0].type).toBe(BreakingChangeType.RESPONSE_FIELD_TYPE_CHANGED);
    });
  });

  describe('Impact Analysis', () => {
    it('should calculate impact score', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0', [
          { name: 'id', in: 'query', type: 'string', required: true },
        ]),
      ];

      const newEndpoints = [
        createEndpoint('/posts', 'POST', '1.0.0'),
      ];

      detector.compareVersions(oldEndpoints, newEndpoints);

      const changes = detector.compareVersions(oldEndpoints, newEndpoints).breakingChanges;
      const impact = detector.getImpactScore(changes);

      expect(impact.score).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(impact.level);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for breaking changes', () => {
      const oldEndpoints = [
        createEndpoint('/users', 'GET', '1.0.0'),
      ];

      const newEndpoints = [];

      const changes = detector.compareVersions(oldEndpoints, newEndpoints).breakingChanges;
      const recommendations = detector.getRecommendations(changes);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toContain('new API version');
    });
  });
});
