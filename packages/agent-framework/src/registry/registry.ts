/**
 * Agent Registry
 *
 * Central registry for agent discovery, capability advertising,
 * health monitoring, and service registration.
 */

import type {
  AgentId,
  AgentInfo,
  AgentCapability,
  AgentFilter,
  AgentSelectionCriteria,
  CreateAgentParams,
  SpawnAgentResult,
  AgentStats,
  AgentUpdate,
  BulkOperationResult
} from '../types';
import { AgentState, AgentHealth, AgentType, FrameworkError, AgentFrameworkError } from '../types';
import { createLogger } from '../utils/logger';
import { generateId, isExpired } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';

/**
 * Registry configuration
 */
export interface RegistryConfig {
  heartbeatInterval: number;
  heartbeatTimeout: number;
  cleanupInterval: number;
  maxAgents: number;
  enableHealthChecks: boolean;
  enableMetrics: boolean;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalAgents: number;
  agentsByType: Record<string, number>;
  agentsByState: Record<string, number>;
  agentsByHealth: Record<string, number>;
  totalRegistrations: number;
  totalDeregistrations: number;
  averageHeartbeatLatency: number;
}

/**
 * Registry events
 */
export interface RegistryEvents {
  'agent:registered': (agent: AgentInfo) => void;
  'agent:deregistered': (agentId: AgentId) => void;
  'agent:updated': (agent: AgentInfo) => void;
  'agent:heartbeat': (agentId: AgentId) => void;
  'agent:health-changed': (agentId: AgentId, previousHealth: AgentHealth, newHealth: AgentHealth) => void;
  'registry:cleanup': (cleanedAgents: AgentId[]) => void;
}

/**
 * Agent Registry class
 */
export class AgentRegistry extends EventEmitter<RegistryEvents> {
  private agents: Map<AgentId, AgentInfo>;
  private capabilities: Map<string, Set<AgentId>>; // capability -> agent IDs
  private types: Map<AgentType, Set<AgentId>>; // type -> agent IDs
  private config: RegistryConfig;
  private logger = createLogger('AgentRegistry');
  private stats: RegistryStats;
  private cleanupTimer?: NodeJS.Timeout;
  private heartbeatTimestamps: Map<AgentId, number[]>;

  constructor(config: Partial<RegistryConfig> = {}) {
    super();

    this.agents = new Map();
    this.capabilities = new Map();
    this.types = new Map();
    this.heartbeatTimestamps = new Map();
    this.stats = this.initializeStats();

    this.config = {
      heartbeatInterval: 5000,
      heartbeatTimeout: 15000,
      cleanupInterval: 30000,
      maxAgents: 1000,
      enableHealthChecks: true,
      enableMetrics: true,
      ...config
    };

    this.startCleanupTimer();
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): RegistryStats {
    return {
      totalAgents: 0,
      agentsByType: {},
      agentsByState: {},
      agentsByHealth: {},
      totalRegistrations: 0,
      totalDeregistrations: 0,
      averageHeartbeatLatency: 0
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Register an agent
   */
  async registerAgent(params: CreateAgentParams): Promise<AgentInfo> {
    this.logger.info('Registering agent', { name: params.name, type: params.type });

    // Check agent limit
    if (this.agents.size >= this.config.maxAgents) {
      throw new AgentFrameworkError(
        `Maximum number of agents (${this.config.maxAgents}) reached`,
        FrameworkError.INSUFFICIENT_RESOURCES,
        503
      );
    }

    // Generate agent ID
    const agentId = generateId('agent');

    // Create agent info
    const agent: AgentInfo = {
      id: agentId,
      name: params.name,
      type: params.type,
      state: AgentState.STARTING,
      health: AgentHealth.UNKNOWN,
      capabilities: params.capabilities,
      load: 0,
      taskQueueSize: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskDuration: 0,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
      lastActivityAt: Date.now(),
      config: this.getDefaultConfig(),
      metadata: params.metadata || {}
    };

    // Store agent
    this.agents.set(agentId, agent);

    // Index by capabilities
    for (const capability of params.capabilities) {
      if (!this.capabilities.has(capability.name)) {
        this.capabilities.set(capability.name, new Set());
      }
      this.capabilities.get(capability.name)!.add(agentId);
    }

    // Index by type
    if (!this.types.has(params.type)) {
      this.types.set(params.type, new Set());
    }
    this.types.get(params.type)!.add(agentId);

    // Initialize heartbeat tracking
    this.heartbeatTimestamps.set(agentId, []);

    // Update stats
    this.stats.totalAgents++;
    this.stats.totalRegistrations++;
    this.updateStats();

    this.emit('agent:registered', agent);

    this.logger.debug('Agent registered successfully', { agentId, name: params.name });

    return agent;
  }

  /**
   * Deregister an agent
   */
  async deregisterAgent(agentId: AgentId): Promise<void> {
    this.logger.info('Deregistering agent', { agentId });

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentFrameworkError(
        `Agent ${agentId} not found`,
        FrameworkError.AGENT_NOT_FOUND,
        404
      );
    }

    // Remove from indexes
    for (const capability of agent.capabilities) {
      const agents = this.capabilities.get(capability.name);
      if (agents) {
        agents.delete(agentId);
        if (agents.size === 0) {
          this.capabilities.delete(capability.name);
        }
      }
    }

    const typeAgents = this.types.get(agent.type);
    if (typeAgents) {
      typeAgents.delete(agentId);
      if (typeAgents.size === 0) {
        this.types.delete(agent.type);
      }
    }

    // Remove agent
    this.agents.delete(agentId);
    this.heartbeatTimestamps.delete(agentId);

    // Update stats
    this.stats.totalAgents--;
    this.stats.totalDeregistrations++;
    this.updateStats();

    this.emit('agent:deregistered', agentId);

    this.logger.debug('Agent deregistered successfully', { agentId });
  }

  /**
   * Update an agent
   */
  async updateAgent(agentId: AgentId, update: AgentUpdate): Promise<AgentInfo> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentFrameworkError(
        `Agent ${agentId} not found`,
        FrameworkError.AGENT_NOT_FOUND,
        404
      );
    }

    const previousHealth = agent.health;

    // Apply updates
    if (update.state !== undefined) {
      agent.state = update.state;
    }
    if (update.health !== undefined) {
      agent.health = update.health;
    }
    if (update.load !== undefined) {
      agent.load = update.load;
    }
    if (update.capabilities !== undefined) {
      agent.capabilities = update.capabilities;
    }
    if (update.config !== undefined) {
      agent.config = { ...agent.config, ...update.config };
    }
    if (update.metadata !== undefined) {
      agent.metadata = { ...agent.metadata, ...update.metadata };
    }

    agent.lastActivityAt = Date.now();

    // Emit health change event if health changed
    if (previousHealth !== agent.health) {
      this.emit('agent:health-changed', agentId, previousHealth, agent.health);
    }

    this.emit('agent:updated', agent);

    return agent;
  }

  /**
   * Process agent heartbeat
   */
  async processHeartbeat(agentId: AgentId, latency?: number): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentFrameworkError(
        `Agent ${agentId} not found`,
        FrameworkError.AGENT_NOT_FOUND,
        404
      );
    }

    const now = Date.now();
    agent.lastHeartbeat = now;

    // Track heartbeat timestamps for latency calculation
    const timestamps = this.heartbeatTimestamps.get(agentId)!;
    timestamps.push(now);

    // Keep only last 10 timestamps
    if (timestamps.length > 10) {
      timestamps.shift();
    }

    // Update health if enabled
    if (this.config.enableHealthChecks) {
      const previousHealth = agent.health;
      agent.health = this.calculateHealth(agent);

      if (previousHealth !== agent.health) {
        this.emit('agent:health-changed', agentId, previousHealth, agent.health);
      }
    }

    // Update average latency if provided
    if (latency !== undefined && this.config.enableMetrics) {
      const count = timestamps.length;
      this.stats.averageHeartbeatLatency =
        (this.stats.averageHeartbeatLatency * (count - 1) + latency) / count;
    }

    this.emit('agent:heartbeat', agentId);
  }

  /**
   * Calculate agent health based on various factors
   */
  private calculateHealth(agent: AgentInfo): AgentHealth {
    const now = Date.now();
    const timeSinceHeartbeat = now - agent.lastHeartbeat;

    // Check if agent is timeout
    if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
      return AgentHealth.UNHEALTHY;
    }

    // Check if agent is under high load
    if (agent.load > 0.9) {
      return AgentHealth.DEGRADED;
    }

    // Check if agent has high failure rate
    if (agent.failedTasks > 0) {
      const failureRate = agent.failedTasks / (agent.completedTasks + agent.failedTasks);
      if (failureRate > 0.5) {
        return AgentHealth.DEGRADED;
      }
    }

    return AgentHealth.HEALTHY;
  }

  /**
   * Get agent info
   */
  getAgent(agentId: AgentId): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Discover agents based on criteria
   */
  async discoverAgents(criteria: AgentSelectionCriteria): Promise<AgentInfo[]> {
    let agents = Array.from(this.agents.values());

    // Filter by type
    if (criteria.type) {
      const typeAgents = this.types.get(criteria.type);
      if (typeAgents) {
        agents = agents.filter(a => typeAgents.has(a.id));
      } else {
        return []; // No agents of this type
      }
    }

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      agents = agents.filter(agent =>
        criteria.capabilities!.some(cap =>
          agent.capabilities.some(agentCap => agentCap.name === cap)
        )
      );
    }

    // Filter by health
    if (criteria.minHealth !== undefined) {
      agents = agents.filter(agent => this.healthCompare(agent.health, criteria.minHealth!) >= 0);
    }

    // Filter by load
    if (criteria.maxLoad !== undefined) {
      agents = agents.filter(agent => agent.load <= criteria.maxLoad!);
    }

    // Filter by features
    if (criteria.requiredFeatures && criteria.requiredFeatures.length > 0) {
      agents = agents.filter(agent =>
        criteria.requiredFeatures!.every(feature =>
          agent.capabilities.some(cap => cap.features?.includes(feature))
        )
      );
    }

    // Exclude specific agents
    if (criteria.excludeAgents && criteria.excludeAgents.length > 0) {
      agents = agents.filter(agent => !criteria.excludeAgents!.includes(agent.id));
    }

    // Filter by state (only active agents)
    agents = agents.filter(agent =>
      agent.state === AgentState.IDLE || agent.state === AgentState.BUSY
    );

    // Sort based on priority
    switch (criteria.priority) {
      case 'load':
        agents.sort((a, b) => a.load - b.load);
        break;
      case 'capability':
        agents.sort((a, b) => b.capabilities.length - a.capabilities.length);
        break;
      case 'random':
        agents.sort(() => Math.random() - 0.5);
        break;
      case 'round-robin':
        // Keep original order (registry insertion order)
        break;
    }

    return agents;
  }

  /**
   * Query agents with filter
   */
  async queryAgents(filter: AgentFilter): Promise<AgentInfo[]> {
    let agents = Array.from(this.agents.values());

    // Filter by type
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      agents = agents.filter(agent => types.includes(agent.type));
    }

    // Filter by state
    if (filter.state) {
      const states = Array.isArray(filter.state) ? filter.state : [filter.state];
      agents = agents.filter(agent => states.includes(agent.state));
    }

    // Filter by health
    if (filter.health) {
      const healths = Array.isArray(filter.health) ? filter.health : [filter.health];
      agents = agents.filter(agent => healths.includes(agent.health));
    }

    // Filter by capabilities
    if (filter.capabilities && filter.capabilities.length > 0) {
      agents = agents.filter(agent =>
        filter.capabilities!.some(cap =>
          agent.capabilities.some(agentCap => agentCap.name === cap)
        )
      );
    }

    // Filter by uptime
    if (filter.minUptime !== undefined) {
      const now = Date.now();
      agents = agents.filter(agent => now - agent.createdAt >= filter.minUptime!);
    }

    // Filter by load
    if (filter.maxLoad !== undefined) {
      agents = agents.filter(agent => agent.load <= filter.maxLoad!);
    }

    // Filter by creation time
    if (filter.createdAfter !== undefined) {
      agents = agents.filter(agent => agent.createdAt >= filter.createdAfter!);
    }
    if (filter.createdBefore !== undefined) {
      agents = agents.filter(agent => agent.createdAt <= filter.createdBefore!);
    }

    return agents;
  }

  /**
   * Get agent statistics
   */
  getAgentStats(agentId: AgentId): AgentStats | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return undefined;
    }

    const now = Date.now();
    return {
      agentId: agent.id,
      uptime: now - agent.createdAt,
      totalTasks: agent.completedTasks + agent.failedTasks,
      completedTasks: agent.completedTasks,
      failedTasks: agent.failedTasks,
      averageTaskDuration: agent.averageTaskDuration,
      successRate:
        agent.completedTasks + agent.failedTasks > 0
          ? agent.completedTasks / (agent.completedTasks + agent.failedTasks)
          : 1,
      currentLoad: agent.load,
      memoryUsage: agent.currentMemory || 0,
      cpuUsage: agent.cpuUsage || 0,
      messagesSent: 0, // Track separately
      messagesReceived: 0, // Track separately
      errors: agent.failedTasks
    };
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): RegistryStats {
    return { ...this.stats };
  }

  /**
   * Bulk agent operations
   */
  async bulkDeregister(agentIds: AgentId[]): Promise<BulkOperationResult> {
    const successful: AgentId[] = [];
    const failed: Array<{ agentId: AgentId; error: string }> = [];

    for (const agentId of agentIds) {
      try {
        await this.deregisterAgent(agentId);
        successful.push(agentId);
      } catch (error) {
        failed.push({
          agentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      successful,
      failed,
      totalCount: agentIds.length,
      successCount: successful.length,
      failureCount: failed.length
    };
  }

  /**
   * Cleanup stale agents
   */
  private cleanup(): void {
    const now = Date.now();
    const cleanedAgents: AgentId[] = [];

    for (const [agentId, agent] of this.agents) {
      const timeSinceHeartbeat = now - agent.lastHeartbeat;

      // Remove agents that haven't sent heartbeat in 3x heartbeat interval
      if (timeSinceHeartbeat > this.config.heartbeatInterval * 3) {
        this.logger.warn('Removing stale agent', {
          agentId,
          timeSinceHeartbeat
        });

        try {
          this.agents.delete(agentId);
          this.heartbeatTimestamps.delete(agentId);
          cleanedAgents.push(agentId);
          this.stats.totalAgents--;
        } catch (error) {
          this.logger.error('Error removing stale agent', { agentId, error });
        }
      }
    }

    if (cleanedAgents.length > 0) {
      this.updateStats();
      this.emit('registry:cleanup', cleanedAgents);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.totalAgents = this.agents.size;

    // Update agents by type
    this.stats.agentsByType = {};
    for (const [type, agents] of this.types) {
      this.stats.agentsByType[type] = agents.size;
    }

    // Update agents by state
    this.stats.agentsByState = {};
    for (const agent of this.agents.values()) {
      const state = agent.state;
      this.stats.agentsByState[state] = (this.stats.agentsByState[state] || 0) + 1;
    }

    // Update agents by health
    this.stats.agentsByHealth = {};
    for (const agent of this.agents.values()) {
      const health = agent.health;
      this.stats.agentsByHealth[health] = (this.stats.agentsByHealth[health] || 0) + 1;
    }
  }

  /**
   * Compare health values for sorting
   */
  private healthCompare(a: AgentHealth, b: AgentHealth): number {
    const healthOrder = [AgentHealth.HEALTHY, AgentHealth.DEGRADED, AgentHealth.UNHEALTHY, AgentHealth.UNKNOWN];
    return healthOrder.indexOf(a) - healthOrder.indexOf(b);
  }

  /**
   * Get default agent configuration
   */
  private getDefaultConfig() {
    return {
      maxConcurrentTasks: 10,
      taskTimeout: 30000,
      heartbeatInterval: this.config.heartbeatInterval,
      retryPolicy: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['timeout', 'network', 'temporary']
      },
      communicationConfig: {
        messageQueueSize: 1000,
        messageTimeout: 5000,
        maxMessageSize: 1024 * 1024, // 1MB
        enableCompression: false,
        enableEncryption: false
      }
    };
  }

  /**
   * Shutdown registry
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down registry');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.removeAllListeners();
    this.agents.clear();
    this.capabilities.clear();
    this.types.clear();
    this.heartbeatTimestamps.clear();
  }
}
