/**
 * Health Monitor
 *
 * Monitors node health and triggers failover when needed
 */

import type { NodeInfo, HealthCheck, FailoverConfig, FailoverEvent, FailoverMetrics } from './types';
import { LeaderElection } from './leader-election';

export class HealthMonitor {
  private config: FailoverConfig;
  private election: LeaderElection;
  private nodes: Map<string, NodeInfo>;
  private healthHistory: Map<string, HealthCheck[]>;
  private failureCount: Map<string, number>;
  private recoveryCount: Map<string, number>;
  private metrics: FailoverMetrics;
  private monitoringInterval: NodeJS.Timeout | null;
  private eventLog: FailoverEvent[];

  constructor(config: FailoverConfig, nodes: NodeInfo[]) {
    this.config = config;
    this.election = new LeaderElection(config, nodes);
    this.nodes = new Map();
    this.healthHistory = new Map();
    this.failureCount = new Map();
    this.recoveryCount = new Map();
    this.monitoringInterval = null;
    this.eventLog = [];

    this.metrics = {
      totalFailovers: 0,
      totalRecoveries: 0,
      avgFailoverTime: 0,
      avgRecoveryTime: 0,
      dataLossEvents: 0,
      currentTerm: 0,
    };

    for (const node of nodes) {
      this.nodes.set(node.id, node);
      this.healthHistory.set(node.id, []);
      this.failureCount.set(node.id, 0);
      this.recoveryCount.set(node.id, 0);
    }
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Perform health checks on all nodes
   */
  private async performHealthChecks(): Promise<void> {
    const checks: Promise<HealthCheck>[] = [];

    for (const node of this.nodes.values()) {
      checks.push(this.checkNode(node));
    }

    const results = await Promise.all(checks);

    for (const check of results) {
      this.processHealthCheck(check);
    }

    // Check if leader needs to fail over
    const leader = this.election.getLeader();
    if (leader) {
      const leaderHealth = this.healthHistory.get(leader);
      if (leaderHealth && leaderHealth.length > 0) {
        const latest = leaderHealth[leaderHealth.length - 1];
        if (latest.status !== 'healthy') {
          await this.handleLeaderFailure(leader);
        }
      }
    }
  }

  /**
   * Check health of a specific node
   */
  private async checkNode(node: NodeInfo): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Simulate health check (in real implementation, would ping node)
      await this.delay(node.status === 'healthy' ? 10 : 100);

      const latency = Date.now() - startTime;
      const isHealthy = latency < this.config.heartbeatInterval / 2;

      const check: HealthCheck = {
        nodeId: node.id,
        timestamp: new Date(),
        status: isHealthy ? 'healthy' : 'degraded',
        latency,
        errorRate: isHealthy ? 0 : 0.1,
        details: {
          uptime: Date.now() - node.lastHeartbeat.getTime(),
          connections: Math.floor(Math.random() * 100),
        },
      };

      // Update node status
      node.status = check.status;
      node.lastHeartbeat = check.timestamp;

      return check;
    } catch (error) {
      return {
        nodeId: node.id,
        timestamp: new Date(),
        status: 'unhealthy',
        latency: Date.now() - startTime,
        errorRate: 1,
        details: {
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Process health check result
   */
  private processHealthCheck(check: HealthCheck): void {
    const history = this.healthHistory.get(check.nodeId);
    if (!history) return;

    // Add to history
    history.push(check);

    // Keep only recent checks
    if (history.length > 100) {
      history.shift();
    }

    // Update failure/recovery counts
    const failures = history.filter((h) => h.status !== 'healthy').length;

    if (failures >= this.config.failureThreshold) {
      this.handleFailure(check.nodeId);
    } else if (failures === 0 && this.failureCount.get(check.nodeId)! > 0) {
      this.handleRecovery(check.nodeId);
    }
  }

  /**
   * Handle node failure
   */
  private handleFailure(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const currentFailures = this.failureCount.get(nodeId) || 0;
    this.failureCount.set(nodeId, currentFailures + 1);

    const event: FailoverEvent = {
      id: `failure-${Date.now()}`,
      type: 'failure',
      nodeId,
      timestamp: new Date(),
      reason: `Node failure detected (${currentFailures + 1}/${this.config.failureThreshold})`,
      actions: ['Mark node as failed', 'Redirect traffic', 'Trigger failover if leader'],
      completed: false,
    };
    this.eventLog.push(event);

    // Update node status
    node.status = 'failed';

    // Update election state
    this.election.updateNodeStatus(nodeId, 'failed', new Date());

    // If this is the leader, trigger failover
    if (this.election.getLeader() === nodeId) {
      this.triggerLeaderFailover();
    }

    event.completed = true;
  }

  /**
   * Handle node recovery
   */
  private handleRecovery(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const recoveries = this.recoveryCount.get(nodeId) || 0;
    this.recoveryCount.set(nodeId, recoveries + 1);
    this.failureCount.set(nodeId, 0);

    const event: FailoverEvent = {
      id: `recovery-${Date.now()}`,
      type: 'recovery',
      nodeId,
      timestamp: new Date(),
      reason: `Node recovered after ${recoveries + 1} failures`,
      actions: ['Mark node as healthy', 'Sync data', 'Resume traffic'],
      completed: false,
    };
    this.eventLog.push(event);

    // Update node status
    node.status = 'healthy';

    // Update election state
    this.election.updateNodeStatus(nodeId, 'healthy', new Date());

    this.metrics.totalRecoveries++;

    event.completed = true;
  }

  /**
   * Trigger leader failover
   */
  private async triggerLeaderFailover(): Promise<void> {
    const startTime = Date.now();

    const event: FailoverEvent = {
      id: `failover-${Date.now()}`,
      type: 'failure',
      nodeId: this.election.getLeader() || '',
      timestamp: new Date(),
      reason: 'Leader failure, initiating failover',
      actions: ['Start election', 'Elect new leader', 'Update cluster state'],
      completed: false,
    };
    this.eventLog.push(event);

    try {
      const result = await this.election.triggerFailover();

      if (result) {
        const failoverTime = Date.now() - startTime;
        this.metrics.totalFailovers++;
        this.metrics.avgFailoverTime =
          (this.metrics.avgFailoverTime * (this.metrics.totalFailovers - 1) + failoverTime) /
          this.metrics.totalFailovers;
        this.metrics.currentTerm = result.term;

        event.completed = true;
      }
    } catch (error) {
      event.reason = `Failover failed: ${(error as Error).message}`;
    }
  }

  /**
   * Handle leader failure explicitly
   */
  private async handleLeaderFailure(leaderId: string): Promise<void> {
    await this.triggerLeaderFailover();
  }

  /**
   * Get node health status
   */
  getNodeHealth(nodeId: string): HealthCheck | null {
    const history = this.healthHistory.get(nodeId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get all node health statuses
   */
  getAllNodeHealth(): Map<string, HealthCheck> {
    const statuses = new Map<string, HealthCheck>();

    for (const [nodeId, history] of this.healthHistory) {
      if (history.length > 0) {
        statuses.set(nodeId, history[history.length - 1]);
      }
    }

    return statuses;
  }

  /**
   * Get cluster health summary
   */
  getClusterHealth(): {
    healthy: number;
    degraded: number;
    unhealthy: number;
    failed: number;
    total: number;
  } {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let failed = 0;

    for (const node of this.nodes.values()) {
      switch (node.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      healthy,
      degraded,
      unhealthy,
      failed,
      total: this.nodes.size,
    };
  }

  /**
   * Get failover metrics
   */
  getMetrics(): FailoverMetrics {
    return { ...this.metrics };
  }

  /**
   * Get failover events
   */
  getEvents(): FailoverEvent[] {
    return [...this.eventLog];
  }

  /**
   * Get leader election instance
   */
  getElection(): LeaderElection {
    return this.election;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
