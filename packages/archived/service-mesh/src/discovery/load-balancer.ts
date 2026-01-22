// @ts-nocheck
/**
 * Service Load Balancer
 * Implements various load balancing strategies for service mesh
 */

import {
  ServiceInstance,
  LoadBalancingStrategy,
  ServiceEndpoints
} from '../types';

export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckEnabled?: boolean;
  healthCheckInterval?: number;
  retryOnFailure?: boolean;
  stickySessions?: boolean;
  sessionAffinityTTL?: number;
}

export interface LoadBalancerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerInstance: Map<string, number>;
  averageLatency: number;
}

export class ServiceLoadBalancer {
  private config: LoadBalancerConfig;
  private stats: LoadBalancerStats;
  private sessionAffinity: Map<string, string>; // sessionID -> instanceID
  private roundRobinCounters: Map<string, number>;
  private instanceLatencies: Map<string, number[]>;

  constructor(config: LoadBalancerConfig) {
    this.config = {
      ...config,
      healthCheckEnabled: config.healthCheckEnabled ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      retryOnFailure: config.retryOnFailure ?? true,
      stickySessions: config.stickySessions ?? false,
      sessionAffinityTTL: config.sessionAffinityTTL ?? 600000 // 10 minutes
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      requestsPerInstance: new Map(),
      averageLatency: 0
    };

    this.sessionAffinity = new Map();
    this.roundRobinCounters = new Map();
    this.instanceLatencies = new Map();
  }

  /**
   * Select an instance based on configured strategy
   */
  selectInstance(
    endpoints: ServiceEndpoints,
    options: {
      sessionId?: string;
      previousAttempts?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): ServiceInstance | null {
    const instances = this.filterHealthyInstances(endpoints.instances);

    if (instances.length === 0) {
      return null;
    }

    // Check for session affinity
    if (this.config.stickySessions && options.sessionId) {
      const affinityInstance = this.getSessionAffinityInstance(
        instances,
        options.sessionId
      );
      if (affinityInstance) {
        return affinityInstance;
      }
    }

    // Filter out previously attempted instances
    const availableInstances = options.previousAttempts
      ? instances.filter(i => !options.previousAttempts!.includes(i.id))
      : instances;

    const targetInstances = availableInstances.length > 0
      ? availableInstances
      : instances;

    let selectedInstance: ServiceInstance;

    switch (this.config.strategy.type) {
      case 'round-robin':
        selectedInstance = this.roundRobinSelect(endpoints.serviceName, targetInstances);
        break;

      case 'least-connections':
        selectedInstance = this.leastConnectionsSelect(targetInstances);
        break;

      case 'random':
        selectedInstance = this.randomSelect(targetInstances);
        break;

      case 'weighted':
        selectedInstance = this.weightedSelect(targetInstances);
        break;

      case 'ip-hash':
        selectedInstance = this.ipHashSelect(targetInstances, options.metadata);
        break;

      case 'consistent-hash':
        selectedInstance = this.consistentHashSelect(
          targetInstances,
          options.metadata?.hashKey || 'default'
        );
        break;

      default:
        selectedInstance = targetInstances[0];
    }

    // Update session affinity
    if (this.config.stickySessions && options.sessionId) {
      this.sessionAffinity.set(options.sessionId, selectedInstance.id);
    }

    return selectedInstance;
  }

  /**
   * Record request result
   */
  recordRequest(
    instanceId: string,
    success: boolean,
    latency: number
  ): void {
    this.stats.totalRequests++;

    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update per-instance stats
    const count = this.stats.requestsPerInstance.get(instanceId) || 0;
    this.stats.requestsPerInstance.set(instanceId, count + 1);

    // Update latency tracking
    const latencies = this.instanceLatencies.get(instanceId) || [];
    latencies.push(latency);

    // Keep only last 100 latencies
    if (latencies.length > 100) {
      latencies.shift();
    }

    this.instanceLatencies.set(instanceId, latencies);

    // Update average latency
    const allLatencies = Array.from(this.instanceLatencies.values()).flat();
    this.stats.averageLatency =
      allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length;
  }

  /**
   * Get load balancer statistics
   */
  getStats(): LoadBalancerStats {
    return {
      ...this.stats,
      requestsPerInstance: new Map(this.stats.requestsPerInstance)
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      requestsPerInstance: new Map(),
      averageLatency: 0
    };
    this.instanceLatencies.clear();
  }

  /**
   * Clear session affinity
   */
  clearSessionAffinity(): void {
    this.sessionAffinity.clear();
  }

  /**
   * Clear affinity for specific session
   */
  clearSession(sessionId: string): void {
    this.sessionAffinity.delete(sessionId);
  }

  /**
   * Get instance health status
   */
  getInstanceHealth(instanceId: string): {
    healthy: boolean;
    averageLatency: number;
    requestCount: number;
    successRate: number;
  } {
    const latencies = this.instanceLatencies.get(instanceId) || [];
    const requestCount = this.stats.requestsPerInstance.get(instanceId) || 0;

    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;

    // Calculate success rate from instance stats
    // This is a simplified calculation
    const successRate = requestCount > 0 ? 0.95 : 1; // Placeholder

    return {
      healthy: true, // Simplified
      averageLatency,
      requestCount,
      successRate
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private filterHealthyInstances(instances: ServiceInstance[]): ServiceInstance[] {
    if (!this.config.healthCheckEnabled) {
      return instances;
    }

    return instances.filter(i => i.healthStatus === 'healthy');
  }

  private roundRobinSelect(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    let counter = this.roundRobinCounters.get(serviceName) || 0;
    const instance = instances[counter % instances.length];
    counter++;
    this.roundRobinCounters.set(serviceName, counter);
    return instance;
  }

  private leastConnectionsSelect(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => {
      const minConnections = min.metadata.activeConnections || 0;
      const instanceConnections = instance.metadata.activeConnections || 0;
      return instanceConnections < minConnections ? instance : min;
    });
  }

  private randomSelect(instances: ServiceInstance[]): ServiceInstance {
    return instances[Math.floor(Math.random() * instances.length)];
  }

  private weightedSelect(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[instances.length - 1];
  }

  private ipHashSelect(
    instances: ServiceInstance[],
    metadata: Record<string, any> = {}
  ): ServiceInstance {
    const ip = metadata.clientIP || '0.0.0.0';
    const hash = this.hashCode(ip);
    return instances[Math.abs(hash) % instances.length];
  }

  private consistentHashSelect(
    instances: ServiceInstance[],
    hashKey: string
  ): ServiceInstance {
    // Simple consistent hashing implementation
    const hash = this.hashCode(hashKey);
    const ringSize = 360; // Virtual nodes

    // Create hash ring
    const ring: { hash: number; instance: ServiceInstance }[] = [];

    for (const instance of instances) {
      // Each instance gets multiple virtual nodes
      for (let i = 0; i < 100; i++) {
        const virtualHash = this.hashCode(`${instance.id}:${i}`);
        ring.push({ hash: virtualHash, instance });
      }
    }

    // Sort by hash
    ring.sort((a, b) => a.hash - b.hash);

    // Find the first node with hash >= key hash
    const normalizedHash = Math.abs(hash) % ringSize;
    const node = ring.find(n => n.hash >= normalizedHash);

    return node ? node.instance : instances[0];
  }

  private getSessionAffinityInstance(
    instances: ServiceInstance[],
    sessionId: string
  ): ServiceInstance | null {
    const instanceId = this.sessionAffinity.get(sessionId);

    if (!instanceId) {
      return null;
    }

    const instance = instances.find(i => i.id === instanceId);

    if (!instance || instance.healthStatus !== 'healthy') {
      // Instance no longer available or unhealthy, clear affinity
      this.sessionAffinity.delete(sessionId);
      return null;
    }

    return instance;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Cleanup expired session affinities
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const ttl = this.config.sessionAffinityTTL!;

    for (const [sessionId, _] of this.sessionAffinity) {
      const lastUsed = parseInt(globalThis[`session_${sessionId}`] || '0', 10);
      if (now - lastUsed > ttl) {
        this.sessionAffinity.delete(sessionId);
        delete globalThis[`session_${sessionId}`];
      }
    }
  }

  /**
   * Get recommendations for instance scaling
   */
  getScalingRecommendations(): {
    scaleUp: string[];
    scaleDown: string[];
  } {
    const scaleUp: string[] = [];
    const scaleDown: string[] = [];

    const avgRequests =
      Array.from(this.stats.requestsPerInstance.values()).reduce((a, b) => a + b, 0) /
      this.stats.requestsPerInstance.size;

    for (const [instanceId, count] of this.stats.requestsPerInstance) {
      const latencies = this.instanceLatencies.get(instanceId) || [];
      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
          : 0;

      // Scale up if high load and high latency
      if (count > avgRequests * 1.5 && avgLatency > 1000) {
        scaleUp.push(instanceId);
      }

      // Scale down if low load
      if (count < avgRequests * 0.3 && avgLatency < 100) {
        scaleDown.push(instanceId);
      }
    }

    return { scaleUp, scaleDown };
  }
}
