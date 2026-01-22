/**
 * Integration Tests for Agent Coordination
 *
 * Tests the full flow of agent coordination using Durable Objects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DirectorAgent } from '../../do/director';
import { PlannerAgent } from '../../do/planner';
import { ExecutorAgent } from '../../do/executor';
import { AgentRegistry } from './registry';
import { AgentMessenger } from './messenger';
import type { ChatRequest, Env } from './types';

// Helper to create mock DO state
function createMockState() {
  let storage = new Map();

  return {
    id: {
      toString: () => 'test-do-id',
    },
    storage: {
      get: async (key: string) => storage.get(key),
      put: async (key: string, value: unknown) => storage.set(key, value),
      delete: async (key: string) => storage.delete(key),
    },
    waitUntil: (fn: () => Promise<void>) => fn(),
  };
}

// Helper to create mock environment
function createMockEnv(): Env {
  return {
    DIRECTOR_DO: {
      get: vi.fn(),
      idFromName: vi.fn((name: string) => ({ toString: () => name })),
    } as unknown as DurableObjectNamespace,
    PLANNER_DO: {
      get: vi.fn(),
      idFromName: vi.fn((name: string) => ({ toString: () => name })),
    } as unknown as DurableObjectNamespace,
    EXECUTOR_DO: {
      get: vi.fn(),
      idFromName: vi.fn((name: string) => ({ toString: () => name })),
    } as unknown as DurableObjectNamespace,
    AGENT_REGISTRY: {
      get: vi.fn(),
      idFromName: vi.fn((name: string) => ({ toString: () => name })),
    } as unknown as DurableObjectNamespace,
    AGENTS_KV: undefined,
  };
}

describe('Agent Coordination Integration Tests', () => {
  describe('Director Agent Orchestration', () => {
    let director: DirectorAgent;
    let mockEnv: Env;

    beforeEach(() => {
      mockEnv = createMockEnv();
      const mockState = createMockState();
      director = new DirectorAgent(mockState as unknown as DurableObjectState, mockEnv);
    });

    it('should initialize with default state', async () => {
      const response = await director.fetch(
        new Request('https://director/state', { method: 'GET' })
      );

      expect(response.ok).toBe(true);

      const state = await response.json();
      expect(state).toHaveProperty('sessionId');
      expect(state).toHaveProperty('activePlanners');
      expect(state).toHaveProperty('completedPlans');
      expect(state).toHaveProperty('metrics');
    });

    it('should handle orchestration request', async () => {
      const chatRequest: ChatRequest = {
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        messages: [
          {
            role: 'user',
            content: 'Write a function to sort an array',
            timestamp: Date.now(),
          },
        ],
        context: {
          language: 'typescript',
          framework: 'react',
        },
        preferences: {
          temperature: 0.7,
        },
      };

      // Mock planner responses
      const mockPlannerResponse = new Response(
        JSON.stringify({
          plan: {
            id: crypto.randomUUID(),
            plannerId: 'planner-code-test',
            expertise: 'code',
            steps: [
              {
                id: crypto.randomUUID(),
                type: 'analyze',
                description: 'Analyze requirements',
                input: {},
                estimatedTokens: 500,
                dependencies: [],
              },
              {
                id: crypto.randomUUID(),
                type: 'generate',
                description: 'Generate code',
                input: {},
                estimatedTokens: 1000,
                dependencies: [],
              },
            ],
            estimatedTokens: 1500,
            selectedModel: 'claude-3-5-sonnet',
            provider: 'anthropic',
            priority: 0.8,
            confidence: 0.9,
            createdAt: Date.now(),
          },
        })
      );

      // Mock executor response
      const mockExecutorResponse = new Response(
        JSON.stringify({
          executorId: 'executor-test',
          output: 'function sort(arr) { return arr.sort(); }',
          status: 'completed',
        })
      );

      vi.spyOn(mockEnv.PLANNER_DO, 'get').mockReturnValue({
        fetch: vi.fn().mockResolvedValue(mockPlannerResponse),
      } as unknown as DurableObjectStub);

      vi.spyOn(mockEnv.EXECUTOR_DO, 'get').mockReturnValue({
        fetch: vi.fn().mockResolvedValue(mockExecutorResponse),
      } as unknown as DurableObjectStub);

      const response = await director.fetch(
        new Request('https://director/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatRequest),
        })
      );

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('latency');
    });
  });

  describe('Planner Agent Planning', () => {
    let planner: PlannerAgent;
    let mockEnv: Env;

    beforeEach(() => {
      mockEnv = createMockEnv();
      const mockState = createMockState();
      planner = new PlannerAgent(
        mockState as unknown as DurableObjectState,
        mockEnv,
        'code'
      );
    });

    it('should generate plan for code request', async () => {
      const chatRequest: ChatRequest = {
        sessionId: 'test-session',
        userId: 'test-user',
        messages: [
          {
            role: 'user',
            content: 'Write a TypeScript function to sort an array',
            timestamp: Date.now(),
          },
        ],
        context: {
          language: 'typescript',
        },
      };

      const response = await planner.fetch(
        new Request('https://planner/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            expertise: 'code',
            chatRequest,
            directorId: 'director-123',
          }),
        })
      );

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.plan).toBeTruthy();
      expect(result.plan.expertise).toBe('code');
      expect(result.plan.steps).toBeInstanceOf(Array);
      expect(result.plan.steps.length).toBeGreaterThan(0);
    });

    it('should return expertise info', async () => {
      const response = await planner.fetch(
        new Request('https://planner/expertise', { method: 'GET' })
      );

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.expertise).toBe('code');
    });

    it('should track load', async () => {
      const response1 = await planner.fetch(
        new Request('https://planner/load', { method: 'GET' })
      );

      const load1 = await response1.json();
      expect(load1).toHaveProperty('load');
      expect(typeof load1.load).toBe('number');
    });
  });

  describe('Executor Agent Execution', () => {
    let executor: ExecutorAgent;
    let mockEnv: Env;

    beforeEach(() => {
      mockEnv = createMockEnv();
      const mockState = createMockState();
      executor = new ExecutorAgent(mockState as unknown as DurableObjectState, mockEnv);
    });

    it('should execute plan successfully', async () => {
      const plan = {
        id: crypto.randomUUID(),
        plannerId: 'planner-code-123',
        expertise: 'code' as const,
        steps: [
          {
            id: crypto.randomUUID(),
            type: 'analyze' as const,
            description: 'Analyze requirements',
            input: { message: 'Write a function' },
            estimatedTokens: 500,
            dependencies: [],
          },
          {
            id: crypto.randomUUID(),
            type: 'generate' as const,
            description: 'Generate code',
            input: { message: 'Write a function' },
            estimatedTokens: 1000,
            dependencies: [],
          },
        ],
        estimatedTokens: 1500,
        selectedModel: 'claude-3-5-sonnet',
        provider: 'anthropic',
        priority: 0.8,
        confidence: 0.9,
        createdAt: Date.now(),
      };

      const context = {
        sessionId: 'test-session',
        userId: 'test-user',
        conversationHistory: [
          {
            role: 'user' as const,
            content: 'Write a function to sort an array',
          },
        ],
        metadata: {},
      };

      const response = await executor.fetch(
        new Request('https://executor/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, context }),
        })
      );

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.planId).toBe(plan.id);
      expect(result.status).toBe('completed');
      expect(result.output).toBeTruthy();
      expect(result.steps).toHaveLength(2);
    });

    it('should track progress during execution', async () => {
      const plan = {
        id: crypto.randomUUID(),
        plannerId: 'planner-code-123',
        expertise: 'code' as const,
        steps: [
          {
            id: crypto.randomUUID(),
            type: 'analyze' as const,
            description: 'Analyze',
            input: {},
            estimatedTokens: 500,
            dependencies: [],
          },
        ],
        estimatedTokens: 500,
        selectedModel: 'claude-3-5-sonnet',
        provider: 'anthropic',
        priority: 0.8,
        confidence: 0.9,
        createdAt: Date.now(),
      };

      const context = {
        sessionId: 'test-session',
        userId: 'test-user',
        conversationHistory: [],
        metadata: {},
      };

      await executor.fetch(
        new Request('https://executor/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, context }),
        })
      );

      const progressResponse = await executor.fetch(
        new Request('https://executor/progress', { method: 'GET' })
      );

      expect(progressResponse.ok).toBe(true);

      const progress = await progressResponse.json();
      expect(progress).toHaveProperty('percentage');
      expect(progress).toHaveProperty('stepNumber');
      expect(progress).toHaveProperty('totalSteps');
    });
  });

  describe('Agent Registry Integration', () => {
    let registry: AgentRegistry;
    let mockEnv: Env;

    beforeEach(() => {
      mockEnv = createMockEnv();
      const mockState = createMockState();
      registry = new AgentRegistry(mockEnv, mockState.storage as unknown as DurableObjectStorage);
    });

    it('should register and select agents', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-code-2',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.7,
        lastHeartbeat: Date.now(),
      });

      const selectedId = await registry.selectAgent('planner', 'code');

      expect(selectedId).toBe('planner-code-1'); // Lower load
    });

    it('should perform health checks', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      const health = await registry.healthCheck();

      expect(health.total).toBe(1);
      expect(health.healthy).toBe(1);
      expect(health.unhealthy).toBe(0);
    });
  });

  describe('Agent Messenger Integration', () => {
    let messenger: AgentMessenger;
    let mockEnv: Env;

    beforeEach(() => {
      mockEnv = createMockEnv();
      const mockState = createMockState();
      messenger = new AgentMessenger(mockEnv, mockState.storage as unknown as DurableObjectStorage);
    });

    it('should send and receive messages', async () => {
      const messageId = await messenger.sendToAgent(
        'director-123',
        'planner-code-456',
        {
          type: 'request',
          payload: { action: 'plan' },
          priority: 0.8,
        }
      );

      expect(messageId).toBeTruthy();

      const status = await messenger.getMessageStatus(messageId);
      expect(status).toBeTruthy();
      expect(status?.messageId).toBe(messageId);
    });

    it('should broadcast messages to multiple agents', async () => {
      const recipients = ['planner-code-1', 'planner-docs-2', 'planner-debug-3'];

      const messageIds = await messenger.broadcast(
        'director-123',
        recipients,
        {
          type: 'notification',
          payload: { update: 'system' },
          priority: 0.5,
        }
      );

      expect(messageIds).toHaveLength(recipients.length);
    });
  });

  describe('End-to-End Coordination Flow', () => {
    it('should coordinate full request flow', async () => {
      // This test simulates the full flow:
      // 1. User request -> Director
      // 2. Director -> Planners (fan-out)
      // 3. Select best plan
      // 4. Execute plan via Executor
      // 5. Return response

      const mockEnv = createMockEnv();
      const directorState = createMockState();
      const director = new DirectorAgent(
        directorState as unknown as DurableObjectState,
        mockEnv
      );

      const chatRequest: ChatRequest = {
        sessionId: 'test-session',
        userId: 'test-user',
        messages: [
          {
            role: 'user',
            content: 'Write a TypeScript function to sort an array',
            timestamp: Date.now(),
          },
        ],
        context: {
          language: 'typescript',
        },
      };

      // Mock planner responses
      const mockPlannerStub = {
        fetch: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              plan: {
                id: crypto.randomUUID(),
                plannerId: 'planner-code-test',
                expertise: 'code',
                steps: [
                  {
                    id: crypto.randomUUID(),
                    type: 'analyze',
                    description: 'Analyze',
                    input: {},
                    estimatedTokens: 500,
                    dependencies: [],
                  },
                  {
                    id: crypto.randomUUID(),
                    type: 'generate',
                    description: 'Generate',
                    input: {},
                    estimatedTokens: 1000,
                    dependencies: [],
                  },
                ],
                estimatedTokens: 1500,
                selectedModel: 'claude-3-5-sonnet',
                provider: 'anthropic',
                priority: 0.8,
                confidence: 0.9,
                createdAt: Date.now(),
              },
            })
          )
        ),
      };

      // Mock executor response
      const mockExecutorStub = {
        fetch: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              executorId: 'executor-test',
              output: 'function sort<T>(arr: T[]): T[] { return arr.slice().sort(); }',
              status: 'completed',
            })
          )
        ),
      };

      vi.spyOn(mockEnv.PLANNER_DO, 'get').mockReturnValue(
        mockPlannerStub as unknown as DurableObjectStub
      );

      vi.spyOn(mockEnv.EXECUTOR_DO, 'get').mockReturnValue(
        mockExecutorStub as unknown as DurableObjectStub
      );

      const response = await director.fetch(
        new Request('https://director/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatRequest),
        })
      );

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.content).toBeTruthy();
      expect(result.sessionId).toBe('test-session');
      expect(result.latency).toBeGreaterThan(0);

      // Verify metrics were updated
      const metricsResponse = await director.fetch(
        new Request('https://director/metrics', { method: 'GET' })
      );

      const metrics = await metricsResponse.json();
      expect(metrics.requestsProcessed).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Load Balancing', () => {
    it('should distribute load across agents', async () => {
      const mockEnv = createMockEnv();
      const state = createMockState();
      const registry = new AgentRegistry(mockEnv, state.storage as unknown as DurableObjectStorage);

      // Register multiple agents
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.9, // High load
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-code-2',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.1, // Low load
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-code-3',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.5, // Medium load
        lastHeartbeat: Date.now(),
      });

      // Select agent multiple times
      const selected1 = await registry.selectAgent('planner', 'code');
      const selected2 = await registry.selectAgent('planner', 'code');
      const selected3 = await registry.selectAgent('planner', 'code');

      // All should select the lowest load agent
      expect(selected1).toBe('planner-code-2');
      expect(selected2).toBe('planner-code-2');
      expect(selected3).toBe('planner-code-2');
    });
  });

  describe('State Persistence', () => {
    it('should persist state across operations', async () => {
      const mockEnv = createMockEnv();
      const state = createMockState();
      const director = new DirectorAgent(
        state as unknown as DurableObjectState,
        mockEnv
      );

      // Send request
      const chatRequest: ChatRequest = {
        sessionId: 'test-session',
        userId: 'test-user',
        messages: [
          {
            role: 'user',
            content: 'Test message',
            timestamp: Date.now(),
          },
        ],
      };

      await director.fetch(
        new Request('https://director/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatRequest),
        })
      );

      // Verify state was persisted
      const stateResponse = await director.fetch(
        new Request('https://director/state', { method: 'GET' })
      );

      const stateData = await stateResponse.json();
      expect(stateData.sessionId).toBe('test-session');
      expect(stateData.context.userId).toBe('test-user');
    });
  });
});
