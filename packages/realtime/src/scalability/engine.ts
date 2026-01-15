/**
 * Scalability Engine - Horizontal scaling and load balancing
 * Manages multi-node deployment, connection migration, and message replication
 */

import { ScalingMetrics, ScalingEvent, HealthCheck } from '../types';
import {
  IdGenerator,
  PerformanceTimer,
  EventBus,
  LRUCache,
  RateLimiter,
  HealthChecker
} from '../utils';
import { Logger } from '@claudeflare/logger';

export interface ScalabilityConfig {
  instanceId: string;
  clusterNodes: string[];
  enableLoadBalancing: boolean;
  connectionMigration: boolean;
  messageReplication: boolean;
  healthCheckInterval: number;
  maxConnectionsPerNode: number;
  sessionAffinity: boolean;
  enableMetrics: boolean;
  heartbeatInterval: number;
  nodeTimeout: number;
  replicationStrategy: 'broadcast' | 'round-robin' | 'consensus';
  loadBalancingStrategy: 'round-robin' | 'least-connections' | 'random' | 'weighted';
  migrationThreshold: number;
  enableAutoScaling: boolean;
  scalingCooldown: number;
}

export interface NodeInfo {
  id: string;
  address: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'maintenance' | 'joining' | 'leaving';
  connections: number;
  load: number;
  lastHeartbeat: number;
  metadata: Record<string, any>;
}

export interface MigrationPlan {
  sourceNodeId: string;
  targetNodeId: string;
  connectionsToMigrate: string[];
  estimatedTime: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}

export class ScalabilityEngine {
  private config: ScalabilityConfig;
  private clusterNodes = new Map<string, NodeInfo>();
  private nodeHealthCheck = new Map<string, HealthCheck>();
  private activeMigrations = new Map<string, MigrationPlan>();
  private sessionAffinity = new Map<string, string>(); // sessionId -> nodeId
  private messageReplicationQueue = new Map<string, any[]>();
  private eventBus: EventBus;
  private logger: Logger;
  private metrics: ScalingMetrics;
  private healthChecker: HealthChecker;
  private heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private migrationTimer?: NodeJS.Timeout;
  private autoScalingTimer?: NodeJS.Timeout;
  private rateLimiter: RateLimiter;
  private lastScalingAction: { time: number; action: string };

  constructor(config: Partial<ScalabilityConfig> = {}, logger?: Logger) {
    this.config = {
      instanceId: IdGenerator.generate('node_', 8),
      clusterNodes: [],
      enableLoadBalancing: true,
      connectionMigration: true,
      messageReplication: true,
      healthCheckInterval: 30000,
      maxConnectionsPerNode: 2500,
      sessionAffinity: true,
      enableMetrics: true,
      heartbeatInterval: 10000,
      nodeTimeout: 60000,
      replicationStrategy: 'broadcast',
      loadBalancingStrategy: 'least-connections',
      migrationThreshold: 0.8,
      enableAutoScaling: true,
      scalingCooldown: 300000,
      ...config
    };

    this.logger = logger || new Logger('ScalabilityEngine');
    this.eventBus = new EventBus();
    this.metrics = {
      connections: 0,
      messagesPerSecond: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      latency: 0,
      errorRate: 0
    };

    this.healthChecker = new HealthChecker(10000);
    this.healthChecker.addCheck('cluster-nodes', () => this.checkClusterHealth());
    this.healthChecker.addCheck('cluster-capacity', () => this.checkClusterCapacity());
    this.healthChecker.addCheck('migrations', () => this.checkMigrationHealth());
    this.healthChecker.start();

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 10000
    });

    // Add self to cluster
    this.addNode({
      id: this.config.instanceId,
      address: 'localhost',
      port: 8080,
      status: 'healthy',
      connections: 0,
      load: 0,
      lastHeartbeat: Date.now(),
      metadata: {
        instanceType: 'primary',
        region: 'default'
      }
    });

    // Start cluster management
    this.startClusterManagement();
    this.startMetricsCollection();
    this.startAutoScaling();

    if (this.config.enableAutoScaling) {
      this.startAutoScaling();
    }
  }

  /**
   * Add a node to the cluster
   */
  public async addNode(nodeInfo: NodeInfo): Promise<void> {
    try {
      await PerformanceTimer.measure('scalability-add-node', async () => {
        this.clusterNodes.set(nodeInfo.id, nodeInfo);

        // Set up heartbeat
        if (nodeInfo.id !== this.config.instanceId) {
          this.setupNodeHeartbeat(nodeInfo.id);
        }

        this.logger.info('Node added to cluster', {
          nodeId: nodeInfo.id,
          address: nodeInfo.address,
          status: nodeInfo.status
        });

        this.emitClusterEvent({
          type: 'node_join',
          nodeId: nodeInfo.id,
          timestamp: Date.now(),
          data: nodeInfo
        });

        // Initialize node health check
        this.nodeHealthCheck.set(nodeInfo.id, {
          healthy: true,
          timestamp: Date.now(),
          metrics: {
            connections: nodeInfo.connections,
            messagesPerSecond: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            latency: 0,
            errorRate: 0
          },
          issues: []
        });

        // Sync presence and multiplexer state
        await this.syncNodeState(nodeInfo.id);
      });

    } catch (error) {
      this.logger.error('Failed to add node', error, { nodeId: nodeInfo.id });
      throw error;
    }
  }

  /**
   * Remove a node from the cluster
   */
  public async removeNode(nodeId: string, graceful: boolean = true): Promise<void> => {
    try {
      await PerformanceTimer.measure('scalability-remove-node', async () => {
        const node = this.clusterNodes.get(nodeId);
        if (!node) {
          throw new Error(`Node not found: ${nodeId}`);
        }

        // Mark node as leaving
        node.status = 'leaving';
        this.clusterNodes.set(nodeId, node);

        if (graceful) {
          // Migrate connections
          await this.migrateConnections(nodeId);
        }

        // Remove from cluster
        this.clusterNodes.delete(nodeId);

        // Clean up heartbeat
        this.cleanupNodeHeartbeat(nodeId);

        // Remove health check
        this.nodeHealthCheck.delete(nodeId);

        this.logger.info('Node removed from cluster', {
          nodeId,
          graceful
        });

        this.emitClusterEvent({
          type: 'node_leave',
          nodeId,
          timestamp: Date.now(),
          data: { graceful }
        });
      });

    } catch (error) {
      this.logger.error('Failed to remove node', error, { nodeId, graceful });
      throw error;
    }
  }

  /**
   * Select node for new connection
   */
  public selectNode(loadFactor: number = 1): NodeInfo | undefined {
    if (!this.config.enableLoadBalancing) {
      return this.clusterNodes.get(this.config.instanceId);
    }

    const healthyNodes = Array.from(this.clusterNodes.values())
      .filter(node => node.status === 'healthy');

    if (healthyNodes.length === 0) {
      return this.clusterNodes.get(this.config.instanceId);
    }

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.roundRobinSelection(healthyNodes);

      case 'least-connections':
        return this.leastConnectionsSelection(healthyNodes);

      case 'random':
        return this.randomSelection(healthyNodes);

      case 'weighted':
        return this.weightedSelection(healthyNodes, loadFactor);

      default:
        return this.leastConnectionsSelection(healthyNodes);
    }
  }

  /**
   * Round-robin node selection
   */
  private roundRobinSelection(nodes: NodeInfo[]): NodeInfo {
    const now = Date.now();
    const index = Math.floor(now / 1000) % nodes.length;
    return nodes[index];
  }

  /**
   * Least connections node selection
   */
  private leastConnectionsSelection(nodes: NodeInfo[]): NodeInfo {
    return nodes.reduce((least, current) =>
      current.connections < least.connections ? current : least
    );
  }

  /**
   * Random node selection
   */
  private randomSelection(nodes: NodeInfo[]): NodeInfo {
    const index = Math.floor(Math.random() * nodes.length);
    return nodes[index];
  }

  /**
   * Weighted node selection
   */
  private weightedSelection(nodes: NodeInfo[], loadFactor: number): NodeInfo {
    // Calculate weights based on capacity and load
    const weights = nodes.map(node => {
      const capacity = this.config.maxConnectionsPerNode;
      const used = node.connections;
      const available = capacity - used;
      const weight = (available / capacity) * (1 / (1 + node.load * loadFactor));
      return { node, weight };
    });

    // Select based on weights
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const random = Math.random() * totalWeight;

    let accumulated = 0;
    for (const { node, weight } of weights) {
      accumulated += weight;
      if (random <= accumulated) {
        return node;
      }
    }

    return weights[0].node;
  }

  /**
   * Migrate connections to another node
   */
  public async migrateConnections(sourceNodeId: string, targetNodeId?: string): Promise<void> {
    try {
      const sourceNode = this.clusterNodes.get(sourceNodeId);
      if (!sourceNode) {
        throw new Error(`Source node not found: ${sourceNodeId}`);
      }

      // Auto-select target if not provided
      if (!targetNodeId) {
        const targets = Array.from(this.clusterNodes.values())
          .filter(node => node.id !== sourceNodeId && node.status === 'healthy');

        if (targets.length === 0) {
          this.logger.warn('No healthy nodes available for migration', { sourceNodeId });
          return;
        }

        targetNodeId = this.selectNode().id;
      }

      const targetNode = this.clusterNodes.get(targetNodeId);
      if (!targetNode) {
        throw new Error(`Target node not found: ${targetNodeId}`);
      }

      // Create migration plan
      const migrationId = IdGenerator.generate('mig_', 8);
      const migration: MigrationPlan = {
        sourceNodeId,
        targetNodeId,
        connectionsToMigrate: [], // Will be populated
        estimatedTime: 0,
        status: 'pending'
      };

      // Get connections to migrate (in a real implementation, this would come from the connection manager)
      migration.connectionsToMigrate = await this.getConnectionsForMigration(sourceNodeId);

      // Start migration
      migration.status = 'in-progress';
      migration.startTime = Date.now();
      this.activeMigrations.set(migrationId, migration);

      this.logger.info('Starting connection migration', {
        migrationId,
        sourceNodeId,
        targetNodeId,
        connectionCount: migration.connectionsToMigrate.length
      });

      this.emitClusterEvent({
        type: 'migrate',
        nodeId: sourceNodeId,
        connectionId: migrationId,
        timestamp: Date.now(),
        data: migration
      });

      // Perform migration in batches
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < migration.connectionsToMigrate.length; i += batchSize) {
        batches.push(migration.connectionsToMigrate.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await this.migrateConnectionBatch(batch, sourceNodeId, targetNodeId);
        await this.sleep(100); // Small delay between batches
      }

      // Update node statistics
      sourceNode.connections -= migration.connectionsToMigrate.length;
      targetNode.connections += migration.connectionsToMigrate.length;

      // Complete migration
      migration.status = 'completed';
      migration.endTime = Date.now();
      this.activeMigrations.set(migrationId, migration);

      this.logger.info('Connection migration completed', {
        migrationId,
        sourceNodeId,
        targetNodeId,
        connectionCount: migration.connectionsToMigrate.length,
        duration: migration.endTime! - migration.startTime!
      });

    } catch (error) {
      this.logger.error('Failed to migrate connections', error, {
        sourceNodeId,
        targetNodeId
      });
      throw error;
    }
  }

  /**
   * Migrate a batch of connections
   */
  private async migrateConnectionBatch(
    connections: string[],
    sourceNodeId: string,
    targetNodeId: string
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Notify source node to release connections
    // 2. Notify target node to accept connections
    // 3. Update session affinity mappings
    // 4. Send migration completion messages

    for (const connectionId of connections) {
      // Update session affinity if enabled
      if (this.config.sessionAffinity) {
        for (const [sessionId, nodeId] of this.sessionAffinity) {
          if (nodeId === sourceNodeId) {
            this.sessionAffinity.set(sessionId, targetNodeId);
          }
        }
      }
    }
  }

  /**
   * Get connections to migrate
   */
  private async getConnectionsForMigration(nodeId: string): Promise<string[]> {
    // In a real implementation, this would query the connection manager
    // For now, return a mock list
    const mockConnections = [];
    const node = this.clusterNodes.get(nodeId);
    if (node) {
      for (let i = 0; i < node.connections; i++) {
        mockConnections.push(IdGenerator.generate('conn_', 16));
      }
    }
    return mockConnections;
  }

  /**
   * Replicate message across cluster
   */
  public async replicateMessage(message: any, sourceNodeId: string): Promise<void> {
    if (!this.config.messageReplication) {
      return;
    }

    try {
      // Check rate limit
      const rateLimit = this.rateLimiter.check('replication');
      if (!rateLimit.allowed) {
        this.logger.warn('Replication rate limit exceeded', {
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime
        });
        return;
      }

      // Get target nodes (all nodes except source)
      const targetNodes = Array.from(this.clusterNodes.values())
        .filter(node => node.id !== sourceNodeId && node.status === 'healthy');

      if (targetNodes.length === 0) {
        return;
      }

      // Replicate based on strategy
      switch (this.config.replicationStrategy) {
        case 'broadcast':
          await this.broadcastReplication(message, targetNodes);
          break;

        case 'round-robin':
          await this.roundRobinReplication(message, targetNodes);
          break;

        case 'consensus':
          await this.consensusReplication(message, targetNodes);
          break;

        default:
          await this.broadcastReplication(message, targetNodes);
      }

    } catch (error) {
      this.logger.error('Failed to replicate message', error, {
        messageId: message.id,
        sourceNodeId
      });
    }
  }

  /**
   * Broadcast replication
   */
  private async broadcastReplication(message: any, nodes: NodeInfo[]): Promise<void> {
    const replicationPromises = nodes.map(async (node) => {
      try {
        await this.sendToNode(node.id, message, 'replication');
      } catch (error) {
        this.logger.error('Failed to send replication message', error, {
          nodeId: node.id,
          messageId: message.id
        });
      }
    });

    await Promise.all(replicationPromises);
  }

  /**
   * Round-robin replication
   */
  private async roundRobinReplication(message: any, nodes: NodeInfo[]): Promise<void> {
    const now = Date.now();
    const targetIndex = now % nodes.length;
    const targetNode = nodes[targetIndex];

    await this.sendToNode(targetNode.id, message, 'replication');
  }

  /**
   * Consensus replication
   */
  private async consensusReplication(message: any, nodes: NodeInfo[]): Promise<void> {
    // In a real implementation, this would:
    // 1. Send to a quorum of nodes
    // 2. Wait for acknowledgments
    // 3. Only consider replicated if quorum is achieved

    // For now, use broadcast as fallback
    await this.broadcastReplication(message, nodes);
  }

  /**
   * Send message to node
   */
  private async sendToNode(nodeId: string, message: any, type: string): Promise<void> {
    // In a real implementation, this would:
    // 1. Use node's WebSocket connection
    // 2. Handle connection failures
    // 3. Implement message queuing and retry logic

    this.emitClusterEvent({
      type: type as any,
      nodeId,
      timestamp: Date.now(),
      data: message
    });
  }

  /**
   * Setup node heartbeat
   */
  private setupNodeHeartbeat(nodeId: string): void {
    const timer = setInterval(async () => {
      try {
        await this.sendHeartbeat(nodeId);
      } catch (error) {
        this.logger.error('Failed to send heartbeat', error, { nodeId });
      }
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(nodeId, timer);
  }

  /**
   * Cleanup node heartbeat
   */
  private cleanupNodeHeartbeat(nodeId: string): void {
    const timer = this.heartbeatTimers.get(nodeId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(nodeId);
    }
  }

  /**
   * Send heartbeat to node
   */
  private async sendHeartbeat(nodeId: string): Promise<void> {
    const node = this.clusterNodes.get(nodeId);
    if (!node || node.id === this.config.instanceId) {
      return;
    }

    // Update heartbeat time
    node.lastHeartbeat = Date.now();
    this.clusterNodes.set(nodeId, node);

    // Check for timeout
    const now = Date.now();
    if (now - node.lastHeartbeat > this.config.nodeTimeout) {
      this.handleNodeTimeout(nodeId);
    }
  }

  /**
   * Handle node timeout
   */
  private handleNodeTimeout(nodeId: string): void {
    this.logger.warn('Node timeout detected', { nodeId });

    const node = this.clusterNodes.get(nodeId);
    if (node) {
      node.status = 'unhealthy';
      this.clusterNodes.set(nodeId, node);

      this.emitClusterEvent({
        type: 'node_leave',
        nodeId,
        timestamp: Date.now(),
        data: { reason: 'timeout' }
      });
    }
  }

  /**
   * Start cluster management
   */
  private startClusterManagement(): void {
    // Periodic health checks
    setInterval(() => {
      this.performClusterHealthCheck();
    }, this.config.healthCheckInterval);

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      this.gracefulShutdown();
    });
  }

  /**
   * Perform cluster health check
   */
  private async performClusterHealthCheck(): Promise<void> {
    const now = Date.now();
    const checks = await Promise.allSettled(
      Array.from(this.clusterNodes.keys()).map(nodeId =>
        this.checkNodeHealth(nodeId)
      )
    );

    for (let i = 0; i < checks.length; i++) {
      const nodeId = Array.from(this.clusterNodes.keys())[i];
      const check = checks[i];

      if (check.status === 'fulfilled') {
        this.nodeHealthCheck.set(nodeId, check.value);
      } else {
        this.logger.error('Health check failed', check.reason, { nodeId });
      }
    }
  }

  /**
   * Check individual node health
   */
  private async checkNodeHealth(nodeId: string): Promise<HealthCheck> {
    const node = this.clusterNodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const issues: string[] = [];
    let healthy = true;

    // Check node status
    if (node.status !== 'healthy') {
      issues.push(`Node status: ${node.status}`);
      healthy = false;
    }

    // Check last heartbeat
    const timeSinceHeartbeat = Date.now() - node.lastHeartbeat;
    if (timeSinceHeartbeat > this.config.nodeTimeout * 0.5) {
      issues.push('Heartbeat delayed');
    }

    // Check connection count
    const connectionRatio = node.connections / this.config.maxConnectionsPerNode;
    if (connectionRatio > this.config.migrationThreshold) {
      issues.push(`High load: ${Math.round(connectionRatio * 100)}% capacity`);
    }

    // Update metrics
    const metrics: ScalingMetrics = {
      connections: node.connections,
      messagesPerSecond: this.metrics.messagesPerSecond,
      cpuUsage: node.load,
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
      latency: 0,
      errorRate: 0
    };

    return {
      healthy,
      timestamp: Date.now(),
      metrics,
      issues
    };
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update cluster metrics
   */
  private updateMetrics(): void {
    if (!this.config.enableMetrics) return;

    const totalConnections = Array.from(this.clusterNodes.values())
      .reduce((sum, node) => sum + node.connections, 0);

    const totalLoad = Array.from(this.clusterNodes.values())
      .reduce((sum, node) => sum + node.load, 0);

    const nodeCount = Array.from(this.clusterNodes.values())
      .filter(node => node.status === 'healthy').length;

    this.metrics = {
      connections: totalConnections,
      messagesPerSecond: this.metrics.messagesPerSecond,
      cpuUsage: totalLoad / Math.max(1, nodeCount),
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
      latency: this.calculateAverageLatency(),
      errorRate: this.calculateErrorRate()
    };

    this.eventBus.emit('metrics:update', this.metrics);
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(): number {
    // In a real implementation, this would track actual message latencies
    // For now, return a mock value
    return Math.random() * 10 + 20; // 20-30ms
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    // In a real implementation, this would track actual error rates
    // For now, return a mock value
    return Math.random() * 0.01; // 0-1%
  }

  /**
   * Start auto-scaling
   */
  private startAutoScaling(): void {
    if (!this.config.enableAutoScaling) return;

    this.autoScalingTimer = setInterval(() => {
      this.checkAutoScaling();
    }, this.config.scalingCooldown);
  }

  /**
   * Check if auto-scaling is needed
   */
  private async checkAutoScaling(): Promise<void> {
    if (!this.config.enableAutoScaling) return;

    const now = Date.now();
    if (now - this.lastScalingAction.time < this.config.scalingCooldown) {
      return; // Still in cooldown period
    }

    const totalConnections = this.metrics.connections;
    const totalCapacity = this.config.maxConnectionsPerNode * this.clusterNodes.size;
    const loadRatio = totalConnections / totalCapacity;

    // Scale out if overloaded
    if (loadRatio > 0.8 && this.clusterNodes.size < 10) { // Max 10 nodes for demo
      await this.scaleOut();
    }
    // Scale in if underutilized
    else if (loadRatio < 0.3 && this.clusterNodes.size > 2) { // Min 2 nodes for demo
      await this.scaleIn();
    }
  }

  /**
   * Scale out - add new node
   */
  private async scaleOut(): Promise<void> {
    const nodeId = IdGenerator.generate('node_', 8);
    const newNode: NodeInfo = {
      id: nodeId,
      address: 'localhost',
      port: 8080 + this.clusterNodes.size,
      status: 'joining',
      connections: 0,
      load: 0,
      lastHeartbeat: Date.now(),
      metadata: {
        instanceType: 'worker',
        region: 'default'
      }
    };

    try {
      await this.addNode(newNode);
      this.logger.info('Auto-scaled out', { nodeId });
      this.lastScalingAction = { time: Date.now(), action: 'scale_out' };
    } catch (error) {
      this.logger.error('Auto-scale out failed', error, { nodeId });
    }
  }

  /**
   * Scale in - remove node
   */
  private async scaleIn(): Promise<void> {
    // Find a node to remove (not the primary node)
    const nodesToRemove = Array.from(this.clusterNodes.values())
      .filter(node => node.id !== this.config.instanceId && node.status === 'healthy');

    if (nodesToRemove.length === 0) {
      return;
    }

    const nodeToRemove = nodesToRemove[0];

    try {
      await this.removeNode(nodeToRemove.id, true);
      this.logger.info('Auto-scaled in', { nodeId: nodeToRemove.id });
      this.lastScalingAction = { time: Date.now(), action: 'scale_in' };
    } catch (error) {
      this.logger.error('Auto-scale in failed', error, { nodeId: nodeToRemove.id });
    }
  }

  /**
   * Sync node state
   */
  private async syncNodeState(nodeId: string): Promise<void> {
    // In a real implementation, this would:
    // 1. Send current presence state
    // 2. Send current multiplexer state
    // 3. Send current metrics
    // 4. Establish replication channels

    this.logger.debug('Syncing node state', { nodeId });
  }

  /**
   * Check cluster health
   */
  private async checkClusterHealth(): Promise<boolean> {
    const healthyNodes = Array.from(this.clusterNodes.values())
      .filter(node => node.status === 'healthy');

    return healthyNodes.length > 0 && healthyNodes.length >= this.clusterNodes.size * 0.5;
  }

  /**
   * Check cluster capacity
   */
  private async checkClusterCapacity(): Promise<boolean> {
    const totalConnections = Array.from(this.clusterNodes.values())
      .reduce((sum, node) => sum + node.connections, 0);

    const totalCapacity = this.config.maxConnectionsPerNode * this.clusterNodes.size;

    return totalConnections < totalCapacity * 0.9; // 90% capacity threshold
  }

  /**
   * Check migration health
   */
  private async checkMigrationHealth(): Promise<boolean> {
    const activeMigrations = Array.from(this.activeMigrations.values())
      .filter(migration => migration.status === 'in-progress');

    if (activeMigrations.length > 3) {
      return false; // Too many concurrent migrations
    }

    return true;
  }

  /**
   * Emit cluster event
   */
  private emitClusterEvent(event: ScalingEvent): void {
    this.eventBus.emit('cluster', event);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown');

    // Stop timers
    this.healthChecker.stop();
    if (this.migrationTimer) clearInterval(this.migrationTimer);
    if (this.autoScalingTimer) clearInterval(this.autoScalingTimer);

    // Migrate connections to other nodes
    const myConnections = Array.from(this.clusterNodes.values())
      .find(node => node.id === this.config.instanceId)?.connections || 0;

    if (myConnections > 0) {
      this.logger.info(`Migrating ${myConnections} connections`);
      await this.migrateConnections(this.config.instanceId);
    }

    // Remove from cluster
    await this.removeNode(this.config.instanceId, false);

    this.logger.info('Graceful shutdown completed');
    process.exit(0);
  }

  /**
   * Get cluster statistics
   */
  public getClusterStats(): { [key: string]: any } {
    const nodes = Array.from(this.clusterNodes.values());
    const healthyNodes = nodes.filter(node => node.status === 'healthy');
    const unhealthyNodes = nodes.filter(node => node.status !== 'healthy');

    return {
      instanceId: this.config.instanceId,
      totalNodes: nodes.length,
      healthyNodes: healthyNodes.length,
      unhealthyNodes: unhealthyNodes.length,
      totalConnections: this.metrics.connections,
      totalCapacity: this.config.maxConnectionsPerNode * nodes.length,
      loadPercentage: (this.metrics.connections / (this.config.maxConnectionsPerNode * nodes.length)) * 100,
      activeMigrations: this.activeMigrations.size,
      lastScalingAction: this.lastScalingAction,
      nodes: nodes.map(node => ({
        id: node.id,
        status: node.status,
        connections: node.connections,
        load: node.load,
        lastHeartbeat: node.lastHeartbeat,
        metadata: node.metadata
      })),
      metrics: this.metrics
    };
  }

  /**
   * Listen for cluster events
   */
  public on(event: string, handler: Function): void {
    this.eventBus.on(event, handler);
  }

  /**
   * Stop listening for cluster events
   */
  public off(event: string, handler: Function): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Get health status
   */
  public async getHealth(): Promise<any> {
    return {
      healthy: await this.checkClusterHealth(),
      clusterStats: this.getClusterStats(),
      metrics: this.metrics
    };
  }

  /**
   * Cleanup resources
   */
  public async dispose(): Promise<void> {
    // Stop timers
    this.healthChecker.stop();
    if (this.migrationTimer) clearInterval(this.migrationTimer);
    if (this.autoScalingTimer) clearInterval(this.autoScalingTimer);

    // Clean up heartbeats
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();

    // Clear data structures
    this.clusterNodes.clear();
    this.nodeHealthCheck.clear();
    this.activeMigrations.clear();
    this.sessionAffinity.clear();
    this.messageReplicationQueue.clear();

    this.logger.info('Scalability engine disposed');
  }
}