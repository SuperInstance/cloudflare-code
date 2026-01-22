/**
 * Unit Tests for Agent Registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from './registry';
import type { AgentInfo, AgentType, Env } from './types';

// Mock environment
const mockStorage = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockEnv: Env = {
  DIRECTOR_DO: {} as DurableObjectNamespace,
  PLANNER_DO: {} as DurableObjectNamespace,
  EXECUTOR_DO: {} as DurableObjectNamespace,
  AGENT_REGISTRY: {} as DurableObjectNamespace,
  AGENTS_KV: undefined,
};

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new AgentRegistry(mockEnv, mockStorage as unknown as DurableObjectStorage);
  });

  describe('register', () => {
    it('should register a new agent', async () => {
      const agent: Omit<AgentInfo, 'createdAt'> = {
        id: 'planner-code-123',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      };

      await registry.register(agent);

      expect(mockStorage.put).toHaveBeenCalled();
    });

    it('should initialize load history for new agent', async () => {
      const agent: Omit<AgentInfo, 'createdAt'> = {
        id: 'planner-code-123',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      };

      await registry.register(agent);
      const stats = registry.getStats();

      expect(stats.totalAgents).toBeGreaterThan(0);
    });
  });

  describe('unregister', () => {
    it('should remove agent from registry', async () => {
      const agent: Omit<AgentInfo, 'createdAt'> = {
        id: 'planner-code-123',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      };

      await registry.register(agent);
      await registry.unregister('planner-code-123');

      expect(mockStorage.put).toHaveBeenCalled();
    });
  });

  describe('updateHeartbeat', () => {
    it('should update agent heartbeat and load', async () => {
      await registry.updateHeartbeat('planner-code-123', 0.5);

      expect(mockStorage.put).toHaveBeenCalled();
    });

    it('should auto-register unknown agents', async () => {
      await registry.updateHeartbeat('new-agent-456', 0.7);

      expect(mockStorage.put).toHaveBeenCalled();
    });

    it('should track load history', async () => {
      await registry.updateHeartbeat('planner-code-123', 0.3);
      await registry.updateHeartbeat('planner-code-123', 0.5);
      await registry.updateHeartbeat('planner-code-123', 0.7);

      const loadInfo = await registry.getDetailedLoad('planner-code-123');

      expect(loadInfo).toBeTruthy();
      expect(loadInfo?.requestCount).toBe(3);
    });
  });

  describe('getAgentsByType', () => {
    it('should return only agents of specified type', async () => {
      await registry.register({
        id: 'director-1',
        type: 'director',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.5,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'executor-1',
        type: 'executor',
        status: 'idle',
        load: 0.2,
        lastHeartbeat: Date.now(),
      });

      const planners = await registry.getAgentsByType('planner');

      expect(planners).toHaveLength(1);
      expect(planners[0].type).toBe('planner');
    });

    it('should sort agents by load', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.8,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-docs-2',
        type: 'planner',
        expertise: 'documentation',
        status: 'idle',
        load: 0.2,
        lastHeartbeat: Date.now(),
      });

      const planners = await registry.getAgentsByType('planner');

      expect(planners[0].load).toBeLessThan(planners[1].load);
    });

    it('should exclude agents with error status', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-docs-2',
        type: 'planner',
        expertise: 'documentation',
        status: 'error',
        load: 1.0,
        lastHeartbeat: Date.now(),
      });

      const planners = await registry.getAgentsByType('planner');

      expect(planners).toHaveLength(1);
      expect(planners[0].status).not.toBe('error');
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', async () => {
      const agentData: Omit<AgentInfo, 'createdAt'> = {
        id: 'planner-code-123',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      };

      await registry.register(agentData);
      const agent = await registry.getAgent('planner-code-123');

      expect(agent).toBeTruthy();
      expect(agent?.id).toBe('planner-code-123');
    });

    it('should return null for unknown agent', async () => {
      const agent = await registry.getAgent('unknown-agent');

      expect(agent).toBeNull();
    });
  });

  describe('getLoad', () => {
    it('should return agent load', async () => {
      await registry.updateHeartbeat('planner-code-123', 0.7);

      const load = await registry.getLoad('planner-code-123');

      expect(load).toBe(0.7);
    });

    it('should return 0 for unknown agent', async () => {
      const load = await registry.getLoad('unknown-agent');

      expect(load).toBe(0);
    });
  });

  describe('selectAgent', () => {
    it('should select agent with lowest load', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.8,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-code-2',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.2,
        lastHeartbeat: Date.now(),
      });

      const selectedId = await registry.selectAgent('planner', 'code');

      expect(selectedId).toBe('planner-code-2');
    });

    it('should select agent by expertise', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.5,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-docs-2',
        type: 'planner',
        expertise: 'documentation',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      const selectedId = await registry.selectAgent('planner', 'code');

      expect(selectedId).toBe('planner-code-1');
    });

    it('should return null when no agents available', async () => {
      const selectedId = await registry.selectAgent('planner', 'code');

      expect(selectedId).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should mark stale agents as unhealthy', async () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: oneHourAgo,
      });

      const health = await registry.healthCheck();

      expect(health.unhealthy).toBe(1);
      expect(health.healthy).toBe(0);
    });

    it('should count healthy and unhealthy agents', async () => {
      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-docs-2',
        type: 'planner',
        expertise: 'documentation',
        status: 'idle',
        load: 0.5,
        lastHeartbeat: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      });

      const health = await registry.healthCheck();

      expect(health.total).toBe(2);
      expect(health.healthy).toBe(2);
      expect(health.unhealthy).toBe(0);
    });
  });

  describe('getDetailedLoad', () => {
    it('should return detailed load info', async () => {
      await registry.updateHeartbeat('planner-code-123', 0.5);
      await registry.updateHeartbeat('planner-code-123', 0.6);
      await registry.updateHeartbeat('planner-code-123', 0.7);

      const loadInfo = await registry.getDetailedLoad('planner-code-123');

      expect(loadInfo).toBeTruthy();
      expect(loadInfo?.agentId).toBe('planner-code-123');
      expect(loadInfo?.load).toBe(0.7);
      expect(loadInfo?.requestCount).toBe(3);
    });

    it('should return null for unknown agent', async () => {
      const loadInfo = await registry.getDetailedLoad('unknown-agent');

      expect(loadInfo).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', async () => {
      await registry.register({
        id: 'director-1',
        type: 'director',
        status: 'idle',
        load: 0.3,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'planner-code-1',
        type: 'planner',
        expertise: 'code',
        status: 'idle',
        load: 0.5,
        lastHeartbeat: Date.now(),
      });

      await registry.register({
        id: 'executor-1',
        type: 'executor',
        status: 'idle',
        load: 0.2,
        lastHeartbeat: Date.now(),
      });

      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.agentsByType.director).toBe(1);
      expect(stats.agentsByType.planner).toBe(1);
      expect(stats.agentsByType.executor).toBe(1);
      expect(stats.averageLoad).toBeGreaterThan(0);
    });
  });
});
