/**
 * Scalability Engine Tests
 */

import { ScalabilityEngine } from './engine';
import { NodeInfo, HealthCheck } from '../types';

// Mock event bus
class MockEventBus {
  private listeners = new Map<string, Function[]>();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(...args);
      }
    }
  }
}

// Mock logger
class MockLogger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
  log = jest.fn();
}

describe('ScalabilityEngine', () => {
  let scalabilityEngine: ScalabilityEngine;
  let eventBus: MockEventBus;
  let logger: MockLogger;

  beforeEach(() => {
    eventBus = new MockEventBus();
    logger = new MockLogger();

    scalabilityEngine = new ScalabilityEngine({
      instanceId: 'test-node-1',
      clusterNodes: [],
      enableLoadBalancing: true,
      connectionMigration: true,
      messageReplication: true,
      healthCheckInterval: 1000,
      maxConnectionsPerNode: 1000,
      sessionAffinity: true,
      enableMetrics: true,
      heartbeatInterval: 500,
      nodeTimeout: 2000,
      replicationStrategy: 'broadcast',
      loadBalancingStrategy: 'least-connections',
      migrationThreshold: 0.8,
      enableAutoScaling: false, // Disabled for tests
      scalingCooldown: 60000
    }, logger);

    // Mock the event bus
    (scalabilityEngine as any).eventBus = eventBus;
  });

  afterEach(async () => {
    await scalabilityEngine.dispose();
  });

  describe('Node Management', () => {
    test('should add node to cluster', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: { region: 'us-west' }
      };

      await scalabilityEngine.addNode(node);

      const stats = scalabilityEngine.getClusterStats();
      expect(stats.totalNodes).toBe(2); // Includes self
      expect(stats.nodes.length).toBe(2);
      expect(stats.nodes.find(n => n.id === 'node-2')).toBeDefined();

      // Verify node was added
      const addedNode = Array.from((scalabilityEngine as any).clusterNodes.values())
        .find(n => n.id === 'node-2');
      expect(addedNode?.address).toBe('192.168.1.2');
    });

    test('should remove node from cluster', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: { region: 'us-west' }
      };

      await scalabilityEngine.addNode(node);

      const statsBefore = scalabilityEngine.getClusterStats();
      expect(statsBefore.totalNodes).toBe(2);

      await scalabilityEngine.removeNode('node-2');

      const statsAfter = scalabilityEngine.getClusterStats();
      expect(statsAfter.totalNodes).toBe(1); // Only self remains
    });

    test('should handle graceful node removal', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: { region: 'us-west' }
      };

      await scalabilityEngine.addNode(node);

      // Mock the migration method
      const migrationSpy = jest.spyOn(scalabilityEngine as any, 'migrateConnections');
      migrationSpy.mockResolvedValue(undefined);

      await scalabilityEngine.removeNode('node-2', true);

      expect(migrationSpy).toHaveBeenCalledWith('node-2');
    });
  });

  describe('Load Balancing', () => {
    beforeEach(async () => {
      // Add some test nodes
      const node1: NodeInfo = {
        id: 'node-1',
        address: '192.168.1.1',
        port: 8080,
        status: 'healthy',
        connections: 100,
        load: 0.3,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      const node2: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 200,
        load: 0.7,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      await scalabilityEngine.addNode(node1);
      await scalabilityEngine.addNode(node2);
    });

    test('should select node with least connections', () => {
      // Set least-connections strategy
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 1000,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'least-connections',
        migrationThreshold: 0.8,
        enableAutoScaling: false,
        scalingCooldown: 60000
      });

      const selectedNode = engine.selectNode();

      expect(selectedNode).toBeDefined();
      expect(['test-node', 'node-1', 'node-2']).toContain(selectedNode.id);
    });

    test('should select node with round-robin strategy', () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 1000,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'round-robin',
        migrationThreshold: 0.8,
        enableAutoScaling: false,
        scalingCooldown: 60000
      });

      // Multiple calls should cycle through nodes
      const node1 = engine.selectNode();
      const node2 = engine.selectNode();
      const node3 = engine.selectNode();

      expect([node1.id, node2.id, node3.id]).toEqual(expect.arrayContaining(['test-node', 'node-1', 'node-2']));
    });

    test('should select random node', () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 1000,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'random',
        migrationThreshold: 0.8,
        enableAutoScaling: false,
        scalingCooldown: 60000
      });

      const selectedNode = engine.selectNode();

      expect(selectedNode).toBeDefined();
      expect(['test-node', 'node-1', 'node-2']).toContain(selectedNode.id);
    });

    test('should handle no healthy nodes', () => {
      // Mark all nodes as unhealthy
      (scalabilityEngine as any).clusterNodes.forEach((node: NodeInfo) => {
        node.status = 'unhealthy';
        (scalabilityEngine as any).clusterNodes.set(node.id, node);
      });

      const selectedNode = scalabilityEngine.selectNode();

      // Should return self node even if unhealthy
      expect(selectedNode.id).toBe('test-node-1');
    });
  });

  describe('Connection Migration', () => {
    beforeEach(async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      await scalabilityEngine.addNode(node);
    });

    test('should migrate connections', async () => {
      // Mock the getConnectionsForMigration method
      const getConnectionsSpy = jest.spyOn(scalabilityEngine as any, 'getConnectionsForMigration');
      getConnectionsSpy.mockResolvedValue(['conn-1', 'conn-2', 'conn-3']);

      const migrateSpy = jest.spyOn(scalabilityEngine as any, 'migrateConnectionBatch');
      migrateSpy.mockResolvedValue(undefined);

      await scalabilityEngine.migrateConnections('node-2');

      expect(getConnectionsSpy).toHaveBeenCalledWith('node-2');
      expect(migrateSpy).toHaveBeenCalledWith(
        ['conn-1', 'conn-2', 'conn-3'],
        'node-2',
        expect.any(String)
      );
    });

    test('should auto-select target node', async () => {
      const getConnectionsSpy = jest.spyOn(scalabilityEngine as any, 'getConnectionsForMigration');
      getConnectionsSpy.mockResolvedValue(['conn-1', 'conn-2']);

      const selectSpy = jest.spyOn(scalabilityEngine, 'selectNode');
      selectSpy.mockReturnValueOnce({
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      } as any);

      const migrateSpy = jest.spyOn(scalabilityEngine as any, 'migrateConnectionBatch');
      migrateSpy.mockResolvedValue(undefined);

      await scalabilityEngine.migrateConnections('node-2');

      expect(selectSpy).toHaveBeenCalled();
      expect(migrateSpy).toHaveBeenCalledWith(
        expect.any(Array),
        'node-2',
        'node-2'
      );
    });

    test('should handle migration failure', async () => {
      const getConnectionsSpy = jest.spyOn(scalabilityEngine as any, 'getConnectionsForMigration');
      getConnectionsSpy.mockResolvedValue(['conn-1', 'conn-2']);

      const migrateSpy = jest.spyOn(scalabilityEngine as any, 'migrateConnectionBatch');
      migrateSpy.mockRejectedValue(new Error('Migration failed'));

      await expect(scalabilityEngine.migrateConnections('node-2'))
        .rejects.toThrow('Migration failed');

      expect(migrateSpy).toHaveBeenCalled();
    });
  });

  describe('Message Replication', () => {
    beforeEach(async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      await scalabilityEngine.addNode(node);
    });

    test('should replicate message with broadcast strategy', async () => {
      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Hello' },
        timestamp: Date.now()
      };

      const sendToNodeSpy = jest.spyOn(scalabilityEngine as any, 'sendToNode');
      sendToNodeSpy.mockResolvedValue(undefined);

      await scalabilityEngine.replicateMessage(message, 'test-node-1');

      // Should send to all other nodes (node-2)
      expect(sendToNodeSpy).toHaveBeenCalledWith('node-2', message, 'replication');
    });

    test('should replicate message with round-robin strategy', async () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 1000,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'round-robin',
        loadBalancingStrategy: 'least-connections',
        migrationThreshold: 0.8,
        enableAutoScaling: false,
        scalingCooldown: 60000
      });

      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      await engine.addNode(node);

      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Hello' },
        timestamp: Date.now()
      };

      const sendToNodeSpy = jest.spyOn(engine as any, 'sendToNode');
      sendToNodeSpy.mockResolvedValue(undefined);

      await engine.replicateMessage(message, 'test-node');

      // Should send to one target node
      expect(sendToNodeSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle replication rate limiting', async () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 1000,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'least-connections',
        migrationThreshold: 0.8,
        enableAutoScaling: false,
        scalingCooldown: 60000,
        rateLimiting: {
          enabled: true,
          windowMs: 1000,
          maxRequests: 1
        }
      });

      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      await engine.addNode(node);

      const message = {
        id: 'msg-123',
        type: 'chat',
        payload: { text: 'Hello' },
        timestamp: Date.now()
      };

      // First replication should succeed
      await engine.replicateMessage(message, 'test-node');

      // Second replication should be rate limited
      await engine.replicateMessage(message, 'test-node');

      // Warn should be called for rate limiting
      expect(logger.warn).toHaveBeenCalledWith(
        'Replication rate limit exceeded',
        expect.any(Object)
      );
    });
  });

  describe('Health Monitoring', () => {
    test('should provide cluster health status', async () => {
      const health = await scalabilityEngine.getHealth();

      expect(health).toBeDefined();
      expect(healthy).toBeDefined();
      expect(healthy.clusterStats).toBeDefined();
      expect(healthy.metrics).toBeDefined();
      expect(typeof healthy).toBe('object');
    });

    test('should detect node timeout', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now() - 3000, // 3 seconds ago
        metadata: {}
      };

      await scalabilityEngine.addNode(node);

      // Force heartbeat check
      await (scalabilityEngine as any).performClusterHealthCheck();

      // Node should be marked as unhealthy
      const updatedNode = Array.from((scalabilityEngine as any).clusterNodes.values())
        .find(n => n.id === 'node-2');
      expect(updatedNode?.status).toBe('unhealthy');
    });

    test('should check cluster capacity', async () => {
      const stats = scalabilityEngine.getClusterStats();

      expect(stats.totalCapacity).toBeGreaterThan(0);
      expect(stats.loadPercentage).toBeDefined();
      expect(typeof stats.loadPercentage).toBe('number');
    });
  });

  describe('Auto-scaling', () => {
    test('should auto-scale out when overloaded', async () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 100,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'least-connections',
        migrationThreshold: 0.8,
        enableAutoScaling: true, // Enabled for test
        scalingCooldown: 1000 // Short cooldown for testing
      }, logger);

      // Mock addNode to track scaling events
      const addNodeSpy = jest.spyOn(engine, 'addNode');
      addNodeSpy.mockResolvedValue(undefined);

      // Set high load to trigger scaling
      const metrics = (engine as any).metrics;
      metrics.connections = 90; // 90% of single node capacity
      metrics.cpuUsage = 0.9;

      // Force auto-scaling check
      await (engine as any).checkAutoScaling();

      expect(addNodeSpy).toHaveBeenCalled();
    });

    test('should auto-scale in when underutilized', async () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 100,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'least-connections',
        migrationThreshold: 0.8,
        enableAutoScaling: true, // Enabled for test
        scalingCooldown: 1000 // Short cooldown for testing
      }, logger);

      // Add a node first
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 0,
        load: 0.1,
        lastHeartbeat: Date.now(),
        metadata: {}
      };
      await engine.addNode(node);

      // Mock removeNode to track scaling events
      const removeNodeSpy = jest.spyOn(engine, 'removeNode');
      removeNodeSpy.mockResolvedValue(undefined);

      // Set low load to trigger scaling in
      const metrics = (engine as any).metrics;
      metrics.connections = 20; // 20% of total capacity
      metrics.cpuUsage = 0.1;

      // Force auto-scaling check
      await (engine as any).checkAutoScaling();

      expect(removeNodeSpy).toHaveBeenCalledWith('node-2', true);
    });

    test('should respect scaling cooldown', async () => {
      const engine = new ScalabilityEngine({
        instanceId: 'test-node',
        clusterNodes: [],
        enableLoadBalancing: true,
        connectionMigration: true,
        messageReplication: true,
        healthCheckInterval: 1000,
        maxConnectionsPerNode: 100,
        sessionAffinity: true,
        enableMetrics: true,
        heartbeatInterval: 500,
        nodeTimeout: 2000,
        replicationStrategy: 'broadcast',
        loadBalancingStrategy: 'least-connections',
        migrationThreshold: 0.8,
        enableAutoScaling: true, // Enabled for test
        scalingCooldown: 10000 // 10 second cooldown
      }, logger);

      // Set last scaling action to recent time
      (engine as any).lastScalingAction = {
        time: Date.now(),
        action: 'scale_out'
      };

      // Mock addNode to prevent actual scaling
      const addNodeSpy = jest.spyOn(engine, 'addNode');
      addNodeSpy.mockResolvedValue(undefined);

      // Force auto-scaling check
      await (engine as any).checkAutoScaling();

      // Should not scale due to cooldown
      expect(addNodeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    test('should emit cluster events', (done) => {
      const eventHandler = jest.fn((event) => {
        expect(event.type).toBe('node_join');
        expect(event.nodeId).toBe('node-2');
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      scalabilityEngine.on('cluster', eventHandler);

      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      scalabilityEngine.addNode(node);
    });

    test('should handle multiple event listeners', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      scalabilityEngine.on('cluster', handler1);
      scalabilityEngine.on('cluster', handler2);

      // Emit event
      scalabilityEngine.on('cluster', jest.fn());

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Graceful Shutdown', () => {
    test('should handle graceful shutdown', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 50,
        load: 0.5,
        lastHeartbeat: Date.now(),
        metadata: {}
      };

      await scalabilityEngine.addNode(node);

      // Mock migration and removal
      const migrateSpy = jest.spyOn(scalabilityEngine as any, 'migrateConnections');
      migrateSpy.mockResolvedValue(undefined);

      const removeNodeSpy = jest.spyOn(scalabilityEngine, 'removeNode');
      removeNodeSpy.mockResolvedValue(undefined);

      // Call graceful shutdown
      await scalabilityEngine['gracefulShutdown']();

      expect(migrateSpy).toHaveBeenCalledWith('test-node-1');
      expect(removeNodeSpy).toHaveBeenCalledWith('test-node-1', false);
    });
  });

  describe('Statistics', () => {
    test('should provide comprehensive cluster statistics', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'healthy',
        connections: 150,
        load: 0.7,
        lastHeartbeat: Date.now(),
        metadata: { region: 'us-west' }
      };

      await scalabilityEngine.addNode(node);

      const stats = scalabilityEngine.getClusterStats();

      expect(stats.instanceId).toBe('test-node-1');
      expect(stats.totalNodes).toBe(2);
      expect(stats.healthyNodes).toBe(2);
      expect(stats.totalConnections).toBe(150); // 50 (self) + 100 (node-2)
      expect(stats.totalCapacity).toBe(2000); // 1000 * 2 nodes
      expect(stats.loadPercentage).toBeGreaterThan(0);
      expect(stats.nodes.length).toBe(2);
      expect(stats.activeMigrations).toBe(0);
      expect(stats.lastScalingAction).toBeDefined();
    });

    test('should track node-specific statistics', async () => {
      const node: NodeInfo = {
        id: 'node-2',
        address: '192.168.1.2',
        port: 8080,
        status: 'unhealthy',
        connections: 200,
        load: 0.9,
        lastHeartbeat: Date.now(),
        metadata: { region: 'us-west' }
      };

      await scalabilityEngine.addNode(node);

      const stats = scalabilityEngine.getClusterStats();

      expect(stats.totalNodes).toBe(2);
      expect(stats.healthyNodes).toBe(1);
      expect(stats.unhealthyNodes).toBe(1);
      expect(stats.totalConnections).toBe(200); // Only node-2 has connections
    });
  });
});