import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ServiceConfig, ServiceRegistration, LoadBalancerNode, LoadBalancingConfig } from '../types';
import { Logger } from '../utils/logger';
import { ServiceDiscovery } from '../service-discovery/service-discovery';

export class LoadBalancer extends EventEmitter {
  private logger: Logger;
  private serviceDiscovery: ServiceDiscovery;
  private loadBalancers: Map<string, LoadBalancerImpl> = new Map();
  private isRunning = false;

  constructor(serviceDiscovery: ServiceDiscovery) {
    super();
    this.serviceDiscovery = serviceDiscovery;
    this.logger = new Logger('LoadBalancer');

    // Listen for service discovery events
    this.serviceDiscovery.on('healthUpdate', (health) => {
      this.handleHealthUpdate(health);
    });

    this.serviceDiscovery.on('serviceRegistered', (service) => {
      this.handleServiceRegistered(service);
    });

    this.serviceDiscovery.on('serviceDeregistered', (serviceId) => {
      this.handleServiceDeregistered(serviceId);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Load Balancer is already running');
    }

    this.logger.info('Starting Load Balancer...');

    try {
      // Initialize load balancers for all registered services
      const services = await this.serviceDiscovery.getAllServices();
      for (const service of services) {
        await this.initializeLoadBalancer(service);
      }

      this.isRunning = true;
      this.logger.info('Load Balancer started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Load Balancer', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Load Balancer...');

    try {
      // Stop all load balancers
      for (const [serviceName, lb] of this.loadBalancers) {
        lb.stop();
        this.loadBalancers.delete(serviceName);
      }

      this.isRunning = false;
      this.logger.info('Load Balancer stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Load Balancer shutdown', { error });
      throw error;
    }
  }

  async selectService(serviceName: string): Promise<ServiceRegistration | null> {
    const lb = this.loadBalancers.get(serviceName);
    if (!lb) {
      this.logger.warn(`No load balancer found for service: ${serviceName}`);
      return null;
    }

    return lb.selectNode();
  }

  async selectServiceWithStickySession(serviceName: string, sessionId: string): Promise<ServiceRegistration | null> {
    const lb = this.loadBalancers.get(serviceName);
    if (!lb) {
      this.logger.warn(`No load balancer found for service: ${serviceName}`);
      return null;
    }

    return lb.selectNodeWithStickySession(sessionId);
  }

  async updateNodeWeights(serviceName: string, weights: Record<string, number>): Promise<void> {
    const lb = this.loadBalancers.get(serviceName);
    if (!lb) {
      throw new Error(`No load balancer found for service: ${serviceName}`);
    }

    lb.updateWeights(weights);
    this.logger.debug(`Updated node weights for service: ${serviceName}`, { weights });
  }

  async getNodeStats(serviceName: string): Promise<any> {
    const lb = this.loadBalancers.get(serviceName);
    if (!lb) {
      throw new Error(`No load balancer found for service: ${serviceName}`);
    }

    return lb.getStats();
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [serviceName, lb] of this.loadBalancers) {
      stats[serviceName] = lb.getStats();
    }
    return stats;
  }

  private handleHealthUpdate(health: any): void {
    // Update node health in respective load balancers
    const services = Array.from(this.loadBalancers.values());
    for (const lb of services) {
      lb.updateNodeHealth(health);
    }
  }

  private handleServiceRegistered(service: ServiceRegistration): void {
    this.initializeLoadBalancer(service);
  }

  private handleServiceDeregistered(serviceId: string): void {
    const serviceName = this.loadBalancers.getKeyForValue((lb) =>
      lb.getServiceName() === serviceId
    );

    if (serviceName) {
      const lb = this.loadBalancers.get(serviceName);
      if (lb) {
        lb.stop();
        this.loadBalancers.delete(serviceName);
        this.logger.info(`Removed load balancer for service: ${serviceName}`);
      }
    }
  }

  private async initializeLoadBalancer(service: ServiceRegistration): Promise<void> {
    try {
      const config = await this.serviceDiscovery.getService(service.id);
      if (!config) {
        this.logger.warn(`Configuration not found for service: ${service.name}`);
        return;
      }

      const lb = new LoadBalancerImpl(service.name, config.loadBalancing, this.logger);
      await lb.start();

      this.loadBalancers.set(service.name, lb);
      this.logger.info(`Initialized load balancer for service: ${service.name}`);
    } catch (error) {
      this.logger.error(`Failed to initialize load balancer for service: ${service.name}`, { error });
    }
  }
}

class LoadBalancerImpl extends EventEmitter {
  private serviceName: string;
  private config: LoadBalancingConfig;
  private logger: Logger;
  private nodes: Map<string, LoadBalancerNode> = new Map();
  private roundRobinCounter = 0;
  private stickySessions: Map<string, string> = new Map();
  private nodeStats: Map<string, NodeStats> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(serviceName: string, config: LoadBalancingConfig, logger: Logger) {
    super();
    this.serviceName = serviceName;
    this.config = config;
    this.logger = logger;

    // Initialize stats for each node
    config.nodes.forEach(node => {
      this.nodeStats.set(`${node.host}:${node.port}`, {
        requests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastAccessed: new Date()
      });
    });
  }

  async start(): Promise<void> => {
    if (this.healthCheckInterval) {
      throw new Error('Load Balancer is already running');
    }

    this.logger.debug(`Starting load balancer for service: ${this.serviceName}`);

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Perform initial health checks
    await this.performHealthChecks();
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.logger.debug(`Stopped load balancer for service: ${this.serviceName}`);
  }

  selectNode(): LoadBalancerNode | null {
    const healthyNodes = Array.from(this.nodes.values()).filter(node => node.healthy);

    if (healthyNodes.length === 0) {
      this.logger.warn(`No healthy nodes available for service: ${this.serviceName}`);
      return null;
    }

    let selectedNode: LoadBalancerNode;

    switch (this.config.strategy) {
      case 'round-robin':
        selectedNode = this.selectRoundRobin(healthyNodes);
        break;
      case 'least-connections':
        selectedNode = this.selectLeastConnections(healthyNodes);
        break;
      case 'ip-hash':
        selectedNode = this.selectIpHash(healthyNodes); // Would need client IP
        break;
      case 'weighted':
        selectedNode = this.selectWeighted(healthyNodes);
        break;
      default:
        selectedNode = this.selectRoundRobin(healthyNodes);
    }

    this.updateNodeStats(selectedNode);
    return selectedNode;
  }

  selectNodeWithStickySession(sessionId: string): LoadBalancerNode | null {
    // Check if sticky session exists
    const nodeKey = this.stickySessions.get(sessionId);
    if (nodeKey) {
      const node = this.nodes.get(nodeKey);
      if (node && node.healthy) {
        this.updateNodeStats(node);
        return node;
      }
      // Remove stale session
      this.stickySessions.delete(sessionId);
    }

    // Select new node and create sticky session
    const node = this.selectNode();
    if (node) {
      const nodeKey = `${node.host}:${node.port}`;
      this.stickySessions.set(sessionId, nodeKey);
    }
    return node;
  }

  updateWeights(weights: Record<string, number>): void {
    for (const [nodeKey, weight] of Object.entries(weights)) {
      const node = this.nodes.get(nodeKey);
      if (node) {
        node.weight = weight;
        this.logger.debug(`Updated weight for node ${nodeKey} to ${weight}`);
      }
    }
  }

  updateNodeHealth(health: any): void {
    if (health.service !== this.serviceName) {
      return;
    }

    // Update all nodes belonging to this service
    for (const node of this.nodes.values()) {
      node.healthy = health.status === 'healthy';
      if (node.healthy) {
        node.lastHealthCheck = health.lastCheck;
      }
    }
  }

  getStats(): any {
    const stats = {
      strategy: this.config.strategy,
      stickySessions: this.config.stickySessions,
      nodes: {} as Record<string, any>,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    for (const [nodeKey, nodeStats] of this.nodeStats) {
      const node = this.nodes.get(nodeKey);
      stats.nodes[nodeKey] = {
        ...node,
        ...nodeStats,
        healthy: node?.healthy || false
      };
      stats.totalRequests += nodeStats.requests;
      stats.successfulRequests += nodeStats.successfulRequests;
      stats.failedRequests += nodeStats.failedRequests;
    }

    if (stats.totalRequests > 0) {
      stats.averageResponseTime = this.calculateAverageResponseTime();
      stats.errorRate = (stats.failedRequests / stats.totalRequests) * 100;
    }

    return stats;
  }

  getServiceName(): string {
    return this.serviceName;
  }

  private async performHealthChecks(): Promise<void> {
    for (const [nodeKey, node] of this.nodes) {
      try {
        const startTime = Date.now();
        await axios.get(`http://${node.host}:${node.port}/health`, {
          timeout: 5000
        });
        const responseTime = Date.now() - startTime;

        node.healthy = true;
        node.lastHealthCheck = new Date();
        node.responseTime = responseTime;

        this.logger.debug(`Health check passed for node: ${nodeKey}`, { responseTime });
      } catch (error) {
        node.healthy = false;
        node.lastHealthCheck = new Date();

        this.logger.warn(`Health check failed for node: ${nodeKey}`, { error });
      }
    }

    this.emit('balancingEvent', {
      type: 'healthCheck',
      serviceName: this.serviceName,
      timestamp: new Date(),
      nodes: Array.from(this.nodes.entries())
    });
  }

  private selectRoundRobin(healthyNodes: LoadBalancerNode[]): LoadBalancerNode {
    const node = healthyNodes[this.roundRobinCounter % healthyNodes.length];
    this.roundRobinCounter++;
    return node;
  }

  private selectLeastConnections(healthyNodes: LoadBalancerNode[]): LoadBalancerNode {
    return healthyNodes.reduce((least, current) =>
      current.connections < least.connections ? current : least
    );
  }

  private selectWeighted(healthyNodes: LoadBalancerNode[]): LoadBalancerNode {
    const totalWeight = healthyNodes.reduce((sum, node) => sum + node.weight, 0);
    let random = Math.random() * totalWeight;

    for (const node of healthyNodes) {
      random -= node.weight;
      if (random <= 0) {
        return node;
      }
    }

    return healthyNodes[0];
  }

  private selectIpHash(healthyNodes: LoadBalancerNode[]): LoadBalancerNode {
    // This would normally use client IP to determine node
    // For now, fall back to weighted selection
    return this.selectWeighted(healthyNodes);
  }

  private updateNodeStats(node: LoadBalancerNode): void {
    const nodeKey = `${node.host}:${node.port}`;
    const stats = this.nodeStats.get(nodeKey);

    if (stats) {
      stats.requests++;
      stats.lastAccessed = new Date();
      node.connections++;
    }
  }

  private calculateAverageResponseTime(): number {
    let total = 0;
    let count = 0;

    for (const stats of this.nodeStats.values()) {
      if (stats.averageResponseTime > 0) {
        total += stats.averageResponseTime;
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  }
}

interface NodeStats {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastAccessed: Date;
}

// Event emitter interface
export interface LoadBalancerEvents {
  balancingEvent: (event: any) => void;
  started: () => void;
  stopped: () => void;
}

// Extend LoadBalancer with EventEmitter functionality
export interface LoadBalancer extends NodeJS.EventEmitter {
  on(event: 'balancingEvent', listener: (event: any) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'balancingEvent', event: any): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}