/**
 * Tests for Collaboration Patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollaborationEngine, ConflictResolver } from './collaboration';
import type { CollaborationRequest, AgentMessage, CollaborationPattern } from './types';

// Mock environment
const createMockEnv = () => ({
  AGENT_REGISTRY: {
    get: vi.fn(() => ({
      fetch: vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              agents: [
                {
                  id: 'agent-1',
                  type: 'planner',
                  status: 'idle',
                  load: 0.2,
                  lastHeartbeat: Date.now(),
                  createdAt: Date.now(),
                },
                {
                  id: 'agent-2',
                  type: 'executor',
                  status: 'idle',
                  load: 0.3,
                  lastHeartbeat: Date.now(),
                  createdAt: Date.now(),
                },
              ],
            })
          )
        )
      ),
    })),
  },
  DIRECTOR_DO: {
    get: vi.fn((id: string) => ({
      id,
      fetch: vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ result: 'director-response', agentId: id }))
        )
      ),
    })),
  },
  PLANNER_DO: {
    get: vi.fn((id: string) => ({
      id,
      fetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ result: 'plan', agentId: id })))
      ),
    })),
  },
  EXECUTOR_DO: {
    get: vi.fn((id: string) => ({
      id,
      fetch: vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ result: 'executed', agentId: id })))
      ),
    })),
  },
});

describe('CollaborationEngine', () => {
  let engine: CollaborationEngine;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockEnv = createMockEnv();
    engine = new CollaborationEngine(mockEnv as any);
  });

  const createMockMessage = (): AgentMessage => ({
    id: crypto.randomUUID(),
    from: 'director-1',
    to: 'agent-1',
    type: 'request',
    action: 'test-action',
    payload: { data: 'test' },
    context: {
      conversationId: 'conv-1',
      metadata: {},
      timestamp: Date.now(),
    },
    priority: 'normal',
    timestamp: Date.now(),
  });

  describe('fan-out pattern', () => {
    it('should send message to multiple agents', async () => {
      const request: CollaborationRequest = {
        pattern: 'fan-out',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2', 'agent-3'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('fan-out');
      expect(result.status).toBe('success');
      expect(result.metrics.agentsInvolved).toBe(4); // 1 primary + 3 secondary
      expect(result.metrics.messagesExchanged).toBe(3);
    });

    it('should handle failures in fan-out', async () => {
      // Make one agent fail
      (mockEnv.PLANNER_DO.get as any).mockImplementationOnce(() => ({
        fetch: vi.fn(() => Promise.reject(new Error('Agent unavailable'))),
      }));

      const request: CollaborationRequest = {
        pattern: 'fan-out',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.errors.size).toBeGreaterThan(0);
    });
  });

  describe('fan-in pattern', () => {
    it('should aggregate responses from multiple agents', async () => {
      const request: CollaborationRequest = {
        pattern: 'fan-in',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('fan-in');
      expect(result.results.has('aggregated')).toBe(true);
      expect(result.metrics.agentsInvolved).toBe(3);
      expect(result.metrics.messagesExchanged).toBe(3); // 2 to agents + 1 aggregation
    });
  });

  describe('chain pattern', () => {
    it('should pass message through chain of agents', async () => {
      const request: CollaborationRequest = {
        pattern: 'chain',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('chain');
      expect(result.results.size).toBeGreaterThan(0);
      expect(result.metrics.agentsInvolved).toBe(3);
      expect(result.metrics.messagesExchanged).toBe(2); // director -> agent1 -> agent2
    });

    it('should stop chain on failure if fallback disabled', async () => {
      // Make second agent fail
      let callCount = 0;
      (mockEnv.PLANNER_DO.get as any).mockImplementation(() => ({
        fetch: vi.fn(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('Chain broken'));
          }
          return Promise.resolve(new Response(JSON.stringify({ result: 'ok' })));
        }),
      }));

      const request: CollaborationRequest = {
        pattern: 'chain',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.errors.size).toBeGreaterThan(0);
    });
  });

  describe('pipeline pattern', () => {
    it('should process through sequential stages', async () => {
      const request: CollaborationRequest = {
        pattern: 'pipeline',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('pipeline');
      expect(result.metrics.agentsInvolved).toBe(3);
      expect(result.metrics.messagesExchanged).toBe(3);
    });
  });

  describe('consensus pattern', () => {
    it('should collect votes and determine majority', async () => {
      const request: CollaborationRequest = {
        pattern: 'consensus',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2', 'agent-3'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('consensus');
      expect(result.results.has('consensus')).toBe(true);
    });
  });

  describe('expert-finder pattern', () => {
    it('should route to most capable agent', async () => {
      const request: CollaborationRequest = {
        pattern: 'expert-finder',
        primaryAgent: 'director-1',
        secondaryAgents: [],
        timeout: 5000,
        fallbackEnabled: true,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('expert-finder');
      expect(result.metrics.agentsInvolved).toBe(1);
    });
  });

  describe('aggregation pattern', () => {
    it('should collect results from multiple agents', async () => {
      const request: CollaborationRequest = {
        pattern: 'aggregation',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('aggregation');
      expect(result.results.has('aggregated')).toBe(true);
    });
  });

  describe('fallback pattern', () => {
    it('should try backup agents on failure', async () => {
      // Make primary agent fail
      let callCount = 0;
      (mockEnv.DIRECTOR_DO.get as any).mockImplementation(() => ({
        fetch: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Primary failed'));
          }
          return Promise.resolve(new Response(JSON.stringify({ result: 'backup-response' })));
        }),
      }));

      const request: CollaborationRequest = {
        pattern: 'fallback',
        primaryAgent: 'director-1',
        secondaryAgents: ['backup-1', 'backup-2'],
        timeout: 5000,
        fallbackEnabled: true,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.pattern).toBe('fallback');
      expect(result.results.has('fallback_used')).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should track collaboration metrics', async () => {
      const request: CollaborationRequest = {
        pattern: 'fan-out',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1', 'agent-2'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.metrics.startTime).toBeDefined();
      expect(result.metrics.endTime).toBeDefined();
      expect(result.metrics.agentsInvolved).toBeGreaterThan(0);
      expect(result.metrics.messagesExchanged).toBeGreaterThan(0);
    });

    it('should set status to failed on error', async () => {
      (mockEnv.PLANNER_DO.get as any).mockImplementation(() => ({
        fetch: vi.fn(() => Promise.reject(new Error('Test error'))),
      }));

      const request: CollaborationRequest = {
        pattern: 'fan-out',
        primaryAgent: 'director-1',
        secondaryAgents: ['agent-1'],
        timeout: 5000,
        fallbackEnabled: false,
        message: createMockMessage(),
      };

      const result = await engine.collaborate(request);

      expect(result.status).toBe('failed');
    });
  });
});

describe('ConflictResolver', () => {
  describe('first-come-first-served', () => {
    it('should select first response', () => {
      const responses = new Map([
        ['agent-1', 'response-1'],
        ['agent-2', 'response-2'],
        ['agent-3', 'response-3'],
      ]);

      const result = ConflictResolver.resolve(responses, 'first-come-first-served');

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('agent-1');
      expect(result.strategy).toBe('first-come-first-served');
    });

    it('should handle empty responses', () => {
      const responses = new Map();

      const result = ConflictResolver.resolve(responses, 'first-come-first-served');

      expect(result.resolved).toBe(false);
    });
  });

  describe('last-write-wins', () => {
    it('should select last response', () => {
      const responses = new Map([
        ['agent-1', 'response-1'],
        ['agent-2', 'response-2'],
        ['agent-3', 'response-3'],
      ]);

      const result = ConflictResolver.resolve(responses, 'last-write-wins');

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('agent-3');
    });
  });

  describe('merge', () => {
    it('should merge all responses', () => {
      const responses = new Map([
        ['agent-1', { key1: 'value1' }],
        ['agent-2', { key2: 'value2' }],
        ['agent-3', { key3: 'value3' }],
      ]);

      const result = ConflictResolver.resolve(responses, 'merge');

      expect(result.resolved).toBe(true);
      expect(result.mergedValue).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });

    it('should merge string responses', () => {
      const responses = new Map([
        ['agent-1', 'text1'],
        ['agent-2', 'text2'],
      ]);

      const result = ConflictResolver.resolve(responses, 'merge');

      expect(result.resolved).toBe(true);
      expect(result.mergedValue).toBeDefined();
    });
  });

  describe('vote', () => {
    it('should select majority vote', () => {
      const responses = new Map([
        ['agent-1', 'option-a'],
        ['agent-2', 'option-a'],
        ['agent-3', 'option-b'],
      ]);

      const result = ConflictResolver.resolve(responses, 'vote');

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('option-a');
      expect(result.votes).toBeDefined();
    });

    it('should handle ties', () => {
      const responses = new Map([
        ['agent-1', 'option-a'],
        ['agent-2', 'option-b'],
      ]);

      const result = ConflictResolver.resolve(responses, 'vote');

      expect(result.resolved).toBe(true);
      expect(result.winner).toBeDefined();
    });
  });

  describe('priority', () => {
    it('should select highest priority', () => {
      const responses = new Map([
        ['agent-1', 'response-1'],
        ['agent-2', 'response-2'],
        ['agent-3', 'response-3'],
      ]);

      const context = {
        priorities: {
          'agent-1': 5,
          'agent-2': 10,
          'agent-3': 3,
        },
      };

      const result = ConflictResolver.resolve(responses, 'priority', context);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('agent-2');
    });

    it('should fail without priorities', () => {
      const responses = new Map([
        ['agent-1', 'response-1'],
      ]);

      const result = ConflictResolver.resolve(responses, 'priority');

      expect(result.resolved).toBe(false);
    });
  });

  describe('custom', () => {
    it('should use custom resolver', () => {
      const responses = new Map([
        ['agent-1', 'response-1'],
        ['agent-2', 'response-2'],
      ]);

      const context = {
        customResolver: (responses: Map<string, unknown>) => ({
          strategy: 'custom' as const,
          resolved: true,
          winner: 'agent-2',
          reason: 'Custom logic selected agent-2',
        }),
      };

      const result = ConflictResolver.resolve(responses, 'custom', context);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('agent-2');
    });

    it('should handle custom resolver errors', () => {
      const responses = new Map([
        ['agent-1', 'response-1'],
      ]);

      const context = {
        customResolver: () => {
          throw new Error('Custom error');
        },
      };

      const result = ConflictResolver.resolve(responses, 'custom', context);

      expect(result.resolved).toBe(false);
      expect(result.reason).toContain('Custom resolver failed');
    });
  });
});
