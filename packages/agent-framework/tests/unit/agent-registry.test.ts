/**
 * Agent Registry Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentRegistry } from '../../src/registry/registry';
import type { CreateAgentParams, AgentCapability } from '../../src/types';
import { AgentType, AgentState, AgentHealth } from '../../src/types';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry({
      heartbeatInterval: 1000,
      heartbeatTimeout: 3000,
      cleanupInterval: 10000,
      maxAgents: 100,
      enableHealthChecks: true,
      enableMetrics: true
    });
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('Agent Registration', () => {
    it('should register a new agent successfully', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: [
          {
            name: 'code-generation',
            version: '1.0.0',
            description: 'Generate code',
            category: 'coding'
          }
        ]
      };

      const agent = await registry.registerAgent(params);

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.type).toBe(AgentType.WORKER);
      expect(agent.state).toBe(AgentState.STARTING);
      expect(agent.health).toBe(AgentHealth.UNKNOWN);
      expect(agent.capabilities).toHaveLength(1);
    });

    it('should reject registration when max agents reached', async () => {
      const smallRegistry = new AgentRegistry({ maxAgents: 2 });

      const params: CreateAgentParams = {
        name: 'agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      await smallRegistry.registerAgent(params);
      await smallRegistry.registerAgent(params);

      await expect(smallRegistry.registerAgent(params)).rejects.toThrow();

      await smallRegistry.shutdown();
    });

    it('should emit agent:registered event', async () => {
      const handler = vi.fn();
      registry.on('agent:registered', handler);

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      await registry.registerAgent(params);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBeDefined();
      expect(handler.mock.calls[0][0].name).toBe('test-agent');
    });
  });

  describe('Agent Deregistration', () => {
    it('should deregister an agent successfully', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      await registry.deregisterAgent(agent.id);

      const retrieved = registry.getAgent(agent.id);
      expect(retrieved).toBeUndefined();
    });

    it('should throw error when deregistering non-existent agent', async () => {
      await expect(registry.deregisterAgent('non-existent')).rejects.toThrow();
    });

    it('should emit agent:deregistered event', async () => {
      const handler = vi.fn();
      registry.on('agent:deregistered', handler);

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      await registry.deregisterAgent(agent.id);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe(agent.id);
    });
  });

  describe('Agent Discovery', () => {
    beforeEach(async () => {
      // Register multiple agents for testing
      const capabilities: AgentCapability[] = [
        {
          name: 'code-generation',
          version: '1.0.0',
          description: 'Generate code',
          category: 'coding'
        }
      ];

      await registry.registerAgent({
        name: 'worker-1',
        type: AgentType.WORKER,
        capabilities
      });

      await registry.registerAgent({
        name: 'worker-2',
        type: AgentType.WORKER,
        capabilities
      });

      await registry.registerAgent({
        name: 'planner-1',
        type: AgentType.PLANNER,
        capabilities
      });
    });

    it('should discover agents by type', async () => {
      const agents = await registry.discoverAgents({
        type: AgentType.WORKER
      });

      expect(agents).toHaveLength(2);
      expect(agents.every(a => a.type === AgentType.WORKER)).toBe(true);
    });

    it('should discover agents by capability', async () => {
      const agents = await registry.discoverAgents({
        capabilities: ['code-generation']
      });

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a =>
        a.capabilities.some(c => c.name === 'code-generation')
      )).toBe(true);
    });

    it('should discover agents by health', async () => {
      // Update one agent to healthy
      const allAgents = registry.getAllAgents();
      await registry.updateAgent(allAgents[0].id, {
        health: AgentHealth.HEALTHY,
        state: AgentState.IDLE
      });

      const agents = await registry.discoverAgents({
        minHealth: AgentHealth.HEALTHY
      });

      expect(agents.length).toBeGreaterThan(0);
    });

    it('should discover agents by load', async () => {
      // Set different loads
      const allAgents = registry.getAllAgents();
      await registry.updateAgent(allAgents[0].id, {
        load: 0.3,
        state: AgentState.IDLE
      });
      await registry.updateAgent(allAgents[1].id, {
        load: 0.7,
        state: AgentState.IDLE
      });

      const agents = await registry.discoverAgents({
        maxLoad: 0.5
      });

      expect(agents.length).toBe(1);
      expect(agents[0].load).toBeLessThanOrEqual(0.5);
    });

    it('should exclude specified agents', async () => {
      const allAgents = registry.getAllAgents();
      const excludeId = allAgents[0].id;

      const agents = await registry.discoverAgents({
        excludeAgents: [excludeId]
      });

      expect(agents.every(a => a.id !== excludeId)).toBe(true);
    });
  });

  describe('Agent Updates', () => {
    it('should update agent state', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      const updated = await registry.updateAgent(agent.id, {
        state: AgentState.IDLE
      });

      expect(updated.state).toBe(AgentState.IDLE);
    });

    it('should update agent health', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      const updated = await registry.updateAgent(agent.id, {
        health: AgentHealth.HEALTHY
      });

      expect(updated.health).toBe(AgentHealth.HEALTHY);
    });

    it('should emit agent:health-changed event', async () => {
      const handler = vi.fn();
      registry.on('agent:health-changed', handler);

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      await registry.updateAgent(agent.id, {
        health: AgentHealth.HEALTHY
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should throw error when updating non-existent agent', async () => {
      await expect(
        registry.updateAgent('non-existent', { state: AgentState.IDLE })
      ).rejects.toThrow();
    });
  });

  describe('Heartbeat Processing', () => {
    it('should process heartbeat successfully', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      await registry.processHeartbeat(agent.id, 50);

      const updated = registry.getAgent(agent.id);
      expect(updated?.lastHeartbeat).toBeGreaterThan(0);
    });

    it('should calculate health based on heartbeat', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      await registry.updateAgent(agent.id, {
        state: AgentState.IDLE,
        load: 0.5
      });

      await registry.processHeartbeat(agent.id);

      const updated = registry.getAgent(agent.id);
      expect(updated?.health).toBe(AgentHealth.HEALTHY);
    });

    it('should mark agent as unhealthy if heartbeat timeout', async () => {
      const registryWithShortTimeout = new AgentRegistry({
        heartbeatTimeout: 100
      });

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registryWithShortTimeout.registerAgent(params);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      await registryWithShortTimeout.processHeartbeat(agent.id);

      const updated = registryWithShortTimeout.getAgent(agent.id);
      expect(updated?.health).toBe(AgentHealth.UNHEALTHY);

      await registryWithShortTimeout.shutdown();
    });
  });

  describe('Agent Statistics', () => {
    it('should get agent statistics', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);
      await registry.updateAgent(agent.id, {
        state: AgentState.IDLE,
        load: 0.5,
        completedTasks: 10,
        failedTasks: 2
      });

      const stats = registry.getAgentStats(agent.id);

      expect(stats).toBeDefined();
      expect(stats?.agentId).toBe(agent.id);
      expect(stats?.totalTasks).toBe(12);
      expect(stats?.successRate).toBeCloseTo(0.833, 2);
    });

    it('should get registry statistics', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      await registry.registerAgent(params);
      await registry.registerAgent({ ...params, name: 'test-agent-2' });

      const stats = registry.getRegistryStats();

      expect(stats.totalAgents).toBe(2);
      expect(stats.totalRegistrations).toBe(2);
    });
  });

  describe('Query Agents', () => {
    beforeEach(async () => {
      const capabilities: AgentCapability[] = [
        {
          name: 'test-capability',
          version: '1.0.0',
          description: 'Test',
          category: 'test'
        }
      ];

      await registry.registerAgent({
        name: 'agent-1',
        type: AgentType.WORKER,
        capabilities,
        metadata: { tags: ['tag1', 'tag2'] }
      });

      await registry.registerAgent({
        name: 'agent-2',
        type: AgentType.PLANNER,
        capabilities,
        metadata: { tags: ['tag2', 'tag3'] }
      });
    });

    it('should filter agents by state', async () => {
      const agents = await registry.queryAgents({
        state: AgentState.STARTING
      });

      expect(agents).toHaveLength(2);
    });

    it('should filter agents by type', async () => {
      const agents = await registry.queryAgents({
        type: AgentType.WORKER
      });

      expect(agents).toHaveLength(1);
      expect(agents[0].type).toBe(AgentType.WORKER);
    });

    it('should filter agents by health', async () => {
      // Update health
      const agents = registry.getAllAgents();
      await registry.updateAgent(agents[0].id, {
        health: AgentHealth.HEALTHY
      });

      const filtered = await registry.queryAgents({
        health: AgentHealth.HEALTHY
      });

      expect(filtered).toHaveLength(1);
    });

    it('should filter agents by capability', async () => {
      const agents = await registry.queryAgents({
        capabilities: ['test-capability']
      });

      expect(agents).toHaveLength(2);
    });

    it('should filter agents by uptime', async () => {
      const agents = await registry.queryAgents({
        minUptime: 0
      });

      expect(agents.length).toBeGreaterThan(0);
    });

    it('should filter agents by max load', async () => {
      const allAgents = registry.getAllAgents();
      await registry.updateAgent(allAgents[0].id, {
        load: 0.3
      });

      const agents = await registry.queryAgents({
        maxLoad: 0.5
      });

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a => a.load <= 0.5)).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk deregister agents', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent1 = await registry.registerAgent(params);
      const agent2 = await registry.registerAgent({ ...params, name: 'agent-2' });

      const result = await registry.bulkDeregister([agent1.id, agent2.id]);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.successful).toContain(agent1.id);
      expect(result.successful).toContain(agent2.id);
    });

    it('should handle partial failures in bulk operations', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent1 = await registry.registerAgent(params);

      const result = await registry.bulkDeregister([agent1.id, 'non-existent']);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.successful).toContain(agent1.id);
      expect(result.failed[0].agentId).toBe('non-existent');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup stale agents', async () => {
      const shortLivedRegistry = new AgentRegistry({
        heartbeatInterval: 100,
        heartbeatTimeout: 200,
        cleanupInterval: 500
      });

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await shortLivedRegistry.registerAgent(params);

      // Wait for cleanup interval
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Agent should be cleaned up
      const retrieved = shortLivedRegistry.getAgent(agent.id);
      expect(retrieved).toBeUndefined();

      await shortLivedRegistry.shutdown();
    });

    it('should emit registry:cleanup event', async () => {
      const shortLivedRegistry = new AgentRegistry({
        heartbeatInterval: 100,
        heartbeatTimeout: 200,
        cleanupInterval: 500
      });

      const handler = vi.fn();
      shortLivedRegistry.on('registry:cleanup', handler);

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      await shortLivedRegistry.registerAgent(params);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(handler).toHaveBeenCalled();

      await shortLivedRegistry.shutdown();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent registrations', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const promises = Array(10).fill(null).map(() =>
        registry.registerAgent(params)
      );

      const agents = await Promise.all(promises);

      expect(agents).toHaveLength(10);
      expect(new Set(agents.map(a => a.id)).size).toBe(10);
    });

    it('should handle agent with no capabilities', async () => {
      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities: []
      };

      const agent = await registry.registerAgent(params);

      expect(agent.capabilities).toHaveLength(0);
    });

    it('should handle agent with multiple capabilities', async () => {
      const capabilities: AgentCapability[] = [
        {
          name: 'cap1',
          version: '1.0.0',
          description: 'Capability 1',
          category: 'test'
        },
        {
          name: 'cap2',
          version: '1.0.0',
          description: 'Capability 2',
          category: 'test'
        },
        {
          name: 'cap3',
          version: '1.0.0',
          description: 'Capability 3',
          category: 'test'
        }
      ];

      const params: CreateAgentParams = {
        name: 'test-agent',
        type: AgentType.WORKER,
        capabilities
      };

      const agent = await registry.registerAgent(params);

      expect(agent.capabilities).toHaveLength(3);
    });
  });
});
