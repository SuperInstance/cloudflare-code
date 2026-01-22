/**
 * Unit Tests for Agent Types
 */

import { describe, it, expect } from 'vitest';
import type {
  ChatRequest,
  ChatResponse,
  Plan,
  PlanStep,
  Complexity,
  TokenEstimate,
  ModelSelection,
  AgentInfo,
  AgentMessage,
  DirectorState,
} from './types';

describe('Agent Types', () => {
  describe('ChatRequest', () => {
    it('should create valid chat request', () => {
      const request: ChatRequest = {
        sessionId: 'test-session',
        userId: 'test-user',
        messages: [
          {
            role: 'user',
            content: 'Hello, world!',
            timestamp: Date.now(),
          },
        ],
        context: {
          language: 'typescript',
          framework: 'react',
        },
        preferences: {
          model: 'claude-3-5-sonnet',
          temperature: 0.7,
        },
      };

      expect(request.sessionId).toBe('test-session');
      expect(request.userId).toBe('test-user');
      expect(request.messages).toHaveLength(1);
      expect(request.context?.language).toBe('typescript');
      expect(request.preferences?.temperature).toBe(0.7);
    });
  });

  describe('ChatResponse', () => {
    it('should create valid chat response', () => {
      const response: ChatResponse = {
        id: crypto.randomUUID(),
        sessionId: 'test-session',
        content: 'Hello! How can I help you?',
        model: 'claude-3-5-sonnet',
        provider: 'anthropic',
        finishReason: 'stop',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        timestamp: Date.now(),
        latency: 500,
      };

      expect(response.sessionId).toBe('test-session');
      expect(response.content).toBeTruthy();
      expect(response.usage.totalTokens).toBe(150);
      expect(response.latency).toBe(500);
    });
  });

  describe('Plan', () => {
    it('should create valid plan', () => {
      const step: PlanStep = {
        id: crypto.randomUUID(),
        type: 'analyze',
        description: 'Analyze code',
        input: { message: 'test' },
        estimatedTokens: 500,
        dependencies: [],
      };

      const plan: Plan = {
        id: crypto.randomUUID(),
        plannerId: 'planner-code-123',
        expertise: 'code',
        steps: [step],
        estimatedTokens: 1000,
        selectedModel: 'claude-3-5-sonnet',
        provider: 'anthropic',
        priority: 0.8,
        confidence: 0.9,
        createdAt: Date.now(),
      };

      expect(plan.expertise).toBe('code');
      expect(plan.steps).toHaveLength(1);
      expect(plan.priority).toBeGreaterThan(0);
      expect(plan.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Complexity', () => {
    it('should create valid complexity analysis', () => {
      const complexity: Complexity = {
        level: 'medium',
        score: 0.5,
        factors: {
          codeComplexity: 0.6,
          contextLength: 0.4,
          multiFile: false,
          requiresResearch: false,
        },
      };

      expect(['low', 'medium', 'high']).toContain(complexity.level);
      expect(complexity.score).toBeGreaterThanOrEqual(0);
      expect(complexity.score).toBeLessThanOrEqual(1);
      expect(typeof complexity.factors.codeComplexity).toBe('number');
    });
  });

  describe('TokenEstimate', () => {
    it('should create valid token estimate', () => {
      const estimate: TokenEstimate = {
        input: 1000,
        output: 500,
        total: 1500,
        confidence: 0.8,
      };

      expect(estimate.total).toBe(estimate.input + estimate.output);
      expect(estimate.confidence).toBeGreaterThanOrEqual(0);
      expect(estimate.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('ModelSelection', () => {
    it('should create valid model selection', () => {
      const selection: ModelSelection = {
        model: 'claude-3-5-sonnet',
        provider: 'anthropic',
        reason: 'High complexity task',
        estimatedCost: 0.003,
        estimatedLatency: 3000,
      };

      expect(selection.model).toBeTruthy();
      expect(selection.provider).toBeTruthy();
      expect(selection.estimatedCost).toBeGreaterThan(0);
      expect(selection.estimatedLatency).toBeGreaterThan(0);
    });
  });

  describe('AgentInfo', () => {
    it('should create valid agent info', () => {
      const info: AgentInfo = {
        id: 'planner-code-123',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
        createdAt: Date.now(),
      };

      expect(['director', 'planner', 'executor']).toContain(info.type);
      expect(['idle', 'busy', 'error']).toContain(info.status);
      expect(info.load).toBeGreaterThanOrEqual(0);
      expect(info.load).toBeLessThanOrEqual(1);
    });
  });

  describe('AgentMessage', () => {
    it('should create valid agent message', () => {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'director-123',
        to: 'planner-code-456',
        type: 'request',
        payload: { test: 'data' },
        timestamp: Date.now(),
        priority: 0.7,
        ttl: 30000,
      };

      expect(['request', 'response', 'notification', 'error']).toContain(message.type);
      expect(message.priority).toBeGreaterThanOrEqual(0);
      expect(message.priority).toBeLessThanOrEqual(1);
      expect(message.ttl).toBeGreaterThan(0);
    });
  });

  describe('DirectorState', () => {
    it('should create valid director state', () => {
      const state: DirectorState = {
        sessionId: 'test-session',
        activePlanners: new Set(['planner-code-1', 'planner-docs-2']),
        completedPlans: new Map(),
        context: {
          sessionId: 'test-session',
          userId: 'test-user',
          messageCount: 10,
          totalTokens: 5000,
          lastActivity: Date.now(),
          preferences: {},
          history: [],
        },
        metrics: {
          requestsProcessed: 100,
          totalLatency: 50000,
          averageLatency: 500,
          lastUpdate: Date.now(),
        },
      };

      expect(state.sessionId).toBeTruthy();
      expect(state.activePlanners.size).toBeGreaterThan(0);
      expect(state.context.messageCount).toBe(10);
      expect(state.metrics.requestsProcessed).toBe(100);
      expect(state.metrics.averageLatency).toBe(500);
    });
  });
});
