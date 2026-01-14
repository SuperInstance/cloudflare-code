/**
 * Agent Lifecycle Manager
 *
 * Manages agent spawning, initialization, termination,
 * state management, health checks, and resource cleanup.
 */

import type {
  AgentId,
  AgentInfo,
  AgentState,
  AgentHealth,
  CreateAgentParams,
  SpawnAgentResult,
  AgentStats
} from '../types';
import {
  AgentType,
  AgentState as AgentStateEnum,
  AgentHealth as AgentHealthEnum,
  FrameworkError,
  AgentFrameworkError
} from '../types';
import { AgentRegistry } from '../registry/registry';
import { createLogger } from '../utils/logger';
import { generateId, sleep } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';

/**
 * Agent instance wrapper
 */
interface AgentInstance {
  id: AgentId;
  info: AgentInfo;
  process?: any;
  startedAt: number;
  lastHealthCheck: number;
  restartCount: number;
  maxRestarts: number;
}

/**
 * Lifecycle manager configuration
 */
export interface LifecycleManagerConfig {
  healthCheckInterval: number;
  healthCheckTimeout: number;
  maxRestarts: number;
  restartDelay: number;
  gracefulShutdownTimeout: number;
  enableAutoRestart: boolean;
  enableMonitoring: boolean;
}

/**
 * Lifecycle manager events
 */
export interface LifecycleManagerEvents {
  'agent:spawned': (instance: AgentInstance) => void;
  'agent:initialized': (agentId: AgentId) => void;
  'agent:terminated': (agentId: AgentId) => void;
  'agent:restarted': (agentId: AgentId, restartCount: number) => void;
  'agent:health-check-failed': (agentId: AgentId, error: Error) => void;
  'agent:state-changed': (agentId: AgentId, oldState: AgentState, newState: AgentState) => void;
}

/**
 * Agent Lifecycle Manager class
 */
export class AgentLifecycleManager extends EventEmitter<LifecycleManagerEvents> {
  private registry: AgentRegistry;
  private config: LifecycleManagerConfig;
  private logger = createLogger('LifecycleManager');
  private instances: Map<AgentId, AgentInstance>;
  private healthCheckTimers: Map<AgentId, NodeJS.Timeout>;
  private shutdownSignals: Map<AgentId, boolean>;

  constructor(
    registry: AgentRegistry,
    config: Partial<LifecycleManagerConfig> = {}
  ) {
    super();

    this.registry = registry;
    this.instances = new Map();
    this.healthCheckTimers = new Map();
    this.shutdownSignals = new Map();

    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000, // 5 seconds
      maxRestarts: 3,
      restartDelay: 5000, // 5 seconds
      gracefulShutdownTimeout: 30000, // 30 seconds
      enableAutoRestart: true,
      enableMonitoring: true,
      ...config
    };
  }

  /**
   * Spawn a new agent
   */
  async spawnAgent(params: CreateAgentParams): Promise<SpawnAgentResult> {
    this.logger.info('Spawning agent', { name: params.name, type: params.type });

    const startTime = Date.now();

    try {
      // Register agent in registry
      const agentInfo = await this.registry.registerAgent(params);

      // Create agent instance
      const instance: AgentInstance = {
        id: agentInfo.id,
        info: agentInfo,
        startedAt: Date.now(),
        lastHealthCheck: Date.now(),
        restartCount: 0,
        maxRestarts: this.config.maxRestarts
      };

      this.instances.set(agentInfo.id, instance);

      // Initialize agent (call its initialization handler)
      await this.initializeAgent(instance);

      // Start health checks
      this.startHealthChecks(agentInfo.id);

      // Update state to idle
      await this.updateAgentState(agentInfo.id, AgentStateEnum.IDLE);

      const result: SpawnAgentResult = {
        agentId: agentInfo.id,
        success: true,
        startTime
      };

      this.emit('agent:spawned', instance);

      this.logger.info('Agent spawned successfully', {
        agentId: agentInfo.id,
        name: params.name,
        spawnTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to spawn agent', {
        name: params.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        agentId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        startTime
      };
    }
  }

  /**
   * Initialize agent
   */
  private async initializeAgent(instance: AgentInstance): Promise<void> {
    this.logger.debug('Initializing agent', { agentId: instance.id });

    // Set state to starting
    await this.updateAgentState(instance.id, AgentStateEnum.STARTING);

    // Simulate agent initialization (in real implementation, would call agent's init method)
    await sleep(100);

    // Update health to healthy
    await this.registry.updateAgent(instance.id, {
      health: AgentHealthEnum.HEALTHY,
      state: AgentStateEnum.IDLE
    });

    instance.info.startedAt = Date.now();

    this.emit('agent:initialized', instance.id);

    this.logger.debug('Agent initialized successfully', { agentId: instance.id });
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: AgentId, graceful: boolean = true): Promise<void> {
    this.logger.info('Terminating agent', { agentId, graceful });

    const instance = this.instances.get(agentId);
    if (!instance) {
      throw new AgentFrameworkError(
        `Agent ${agentId} not found`,
        FrameworkError.AGENT_NOT_FOUND,
        404
      );
    }

    // Stop health checks
    this.stopHealthChecks(agentId);

    if (graceful) {
      // Graceful shutdown
      await this.gracefulShutdown(instance);
    } else {
      // Force shutdown
      await this.forceShutdown(instance);
    }

    // Deregister from registry
    await this.registry.deregisterAgent(agentId);

    // Remove from instances
    this.instances.delete(agentId);
    this.shutdownSignals.delete(agentId);

    this.emit('agent:terminated', agentId);

    this.logger.info('Agent terminated successfully', { agentId });
  }

  /**
   * Graceful shutdown of an agent
   */
  private async gracefulShutdown(instance: AgentInstance): Promise<void> {
    this.logger.debug('Initiating graceful shutdown', { agentId: instance.id });

    // Update state to terminating
    await this.updateAgentState(instance.id, AgentStateEnum.TERMINATING);

    // Signal shutdown
    this.shutdownSignals.set(instance.id, true);

    // Wait for agent to finish current tasks or timeout
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.gracefulShutdownTimeout) {
      const agentInfo = this.registry.getAgent(instance.id);
      if (!agentInfo || agentInfo.state === AgentStateEnum.IDLE) {
        break;
      }
      await sleep(100);
    }

    // Update state to terminated
    await this.updateAgentState(instance.id, AgentStateEnum.TERMINATED);

    this.logger.debug('Graceful shutdown completed', { agentId: instance.id });
  }

  /**
   * Force shutdown of an agent
   */
  private async forceShutdown(instance: AgentInstance): Promise<void> {
    this.logger.debug('Initiating force shutdown', { agentId: instance.id });

    // Update state to terminated
    await this.updateAgentState(instance.id, AgentStateEnum.TERMINATED);

    // In real implementation, would kill process/terminate connection
    if (instance.process) {
      // instance.process.kill('SIGKILL');
    }

    this.logger.debug('Force shutdown completed', { agentId: instance.id });
  }

  /**
   * Start health checks for an agent
   */
  private startHealthChecks(agentId: AgentId): void {
    const timer = setInterval(async () => {
      await this.performHealthCheck(agentId);
    }, this.config.healthCheckInterval);

    this.healthCheckTimers.set(agentId, timer);
  }

  /**
   * Stop health checks for an agent
   */
  private stopHealthChecks(agentId: AgentId): void {
    const timer = this.healthCheckTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(agentId);
    }
  }

  /**
   * Perform health check for an agent
   */
  private async performHealthCheck(agentId: AgentId): Promise<void> {
    const instance = this.instances.get(agentId);
    if (!instance) {
      return;
    }

    try {
      // Check if agent is shutdown
      if (this.shutdownSignals.get(agentId)) {
        return;
      }

      // Simulate health check (in real implementation, would ping agent)
      await sleep(10);

      // Process heartbeat
      await this.registry.processHeartbeat(agentId, 10);

      instance.lastHealthCheck = Date.now();

      // Check if agent needs restart
      const agentInfo = this.registry.getAgent(agentId);
      if (agentInfo && this.shouldRestart(agentInfo)) {
        await this.restartAgent(instance);
      }
    } catch (error) {
      this.logger.error('Health check failed', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.emit('agent:health-check-failed', agentId, error as Error);

      // Update health to unhealthy
      await this.registry.updateAgent(agentId, {
        health: AgentHealthEnum.UNHEALTHY
      });

      // Auto-restart if enabled
      if (this.config.enableAutoRestart && instance.restartCount < instance.maxRestarts) {
        await this.restartAgent(instance);
      }
    }
  }

  /**
   * Check if agent should be restarted
   */
  private shouldRestart(agentInfo: AgentInfo): boolean {
    // Restart if unhealthy
    if (agentInfo.health === AgentHealthEnum.UNHEALTHY) {
      return true;
    }

    // Restart if in error state
    if (agentInfo.state === AgentStateEnum.ERROR) {
      return true;
    }

    // Restart if too many failed tasks
    if (agentInfo.completedTasks > 10) {
      const failureRate = agentInfo.failedTasks / agentInfo.completedTasks;
      if (failureRate > 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Restart an agent
   */
  private async restartAgent(instance: AgentInstance): Promise<void> {
    this.logger.warn('Restarting agent', {
      agentId: instance.id,
      restartCount: instance.restartCount + 1
    });

    // Stop health checks during restart
    this.stopHealthChecks(instance.id);

    try {
      // Increment restart count
      instance.restartCount++;

      // Terminate existing agent
      await this.forceShutdown(instance);

      // Wait before restart
      await sleep(this.config.restartDelay);

      // Reinitialize agent
      await this.initializeAgent(instance);

      // Restart health checks
      this.startHealthChecks(instance.id);

      this.emit('agent:restarted', instance.id, instance.restartCount);

      this.logger.info('Agent restarted successfully', {
        agentId: instance.id,
        restartCount: instance.restartCount
      });
    } catch (error) {
      this.logger.error('Failed to restart agent', {
        agentId: instance.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Mark as error if max restarts reached
      if (instance.restartCount >= instance.maxRestarts) {
        await this.updateAgentState(instance.id, AgentStateEnum.ERROR);
        await this.registry.updateAgent(instance.id, {
          health: AgentHealthEnum.UNHEALTHY
        });
      }
    }
  }

  /**
   * Update agent state
   */
  private async updateAgentState(agentId: AgentId, newState: AgentState): Promise<void> {
    const instance = this.instances.get(agentId);
    if (!instance) {
      return;
    }

    const oldState = instance.info.state;
    if (oldState === newState) {
      return;
    }

    await this.registry.updateAgent(agentId, { state: newState });
    instance.info.state = newState;

    this.emit('agent:state-changed', agentId, oldState, newState);
  }

  /**
   * Update agent load
   */
  async updateAgentLoad(agentId: AgentId, load: number): Promise<void> {
    const instance = this.instances.get(agentId);
    if (!instance) {
      return;
    }

    await this.registry.updateAgent(agentId, { load });
    instance.info.load = load;
  }

  /**
   * Update agent health
   */
  async updateAgentHealth(agentId: AgentId, health: AgentHealth): Promise<void> {
    const instance = this.instances.get(agentId);
    if (!instance) {
      return;
    }

    await this.registry.updateAgent(agentId, { health });
    instance.info.health = health;
  }

  /**
   * Get agent instance
   */
  getInstance(agentId: AgentId): AgentInstance | undefined {
    return this.instances.get(agentId);
  }

  /**
   * Get all agent instances
   */
  getAllInstances(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get agent stats
   */
  getAgentStats(agentId: AgentId): AgentStats | undefined {
    return this.registry.getAgentStats(agentId);
  }

  /**
   * Get lifecycle statistics
   */
  getLifecycleStats(): {
    totalAgents: number;
    runningAgents: number;
    restartingAgents: number;
    terminatedAgents: number;
    totalRestarts: number;
  } {
    const instances = Array.from(this.instances.values());

    return {
      totalAgents: instances.length,
      runningAgents: instances.filter(i =>
        i.info.state === AgentStateEnum.IDLE || i.info.state === AgentStateEnum.BUSY
      ).length,
      restartingAgents: instances.filter(i =>
        i.info.state === AgentStateEnum.STARTING
      ).length,
      terminatedAgents: instances.filter(i =>
        i.info.state === AgentStateEnum.TERMINATED || i.info.state === AgentStateEnum.TERMINATING
      ).length,
      totalRestarts: instances.reduce((sum, i) => sum + i.restartCount, 0)
    };
  }

  /**
   * Bulk spawn agents
   */
  async bulkSpawnAgents(params: CreateAgentParams[]): Promise<SpawnAgentResult[]> {
    this.logger.info('Bulk spawning agents', { count: params.length });

    const results: SpawnAgentResult[] = [];

    for (const param of params) {
      const result = await this.spawnAgent(param);
      results.push(result);
    }

    return results;
  }

  /**
   * Bulk terminate agents
   */
  async bulkTerminateAgents(agentIds: AgentId[], graceful: boolean = true): Promise<{
    successful: AgentId[];
    failed: Array<{ agentId: AgentId; error: string }>;
  }> {
    this.logger.info('Bulk terminating agents', { count: agentIds.length, graceful });

    const successful: AgentId[] = [];
    const failed: Array<{ agentId: AgentId; error: string }> = [];

    for (const agentId of agentIds) {
      try {
        await this.terminateAgent(agentId, graceful);
        successful.push(agentId);
      } catch (error) {
        failed.push({
          agentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Scale agents
   */
  async scaleAgents(
    agentType: AgentType,
    desiredCount: number,
    params: CreateAgentParams
  ): Promise<void> {
    this.logger.info('Scaling agents', { agentType, desiredCount });

    // Get current agents of this type
    const currentAgents = await this.registry.queryAgents({
      type: agentType,
      state: [AgentStateEnum.IDLE, AgentStateEnum.BUSY]
    });

    const currentCount = currentAgents.length;

    if (currentCount < desiredCount) {
      // Scale up
      const toSpawn = desiredCount - currentCount;
      this.logger.info('Scaling up agents', { agentType, toSpawn });

      const spawnParams = Array(toSpawn).fill(null).map((_, i) => ({
        ...params,
        name: `${params.name}-${i}`
      }));

      await this.bulkSpawnAgents(spawnParams);
    } else if (currentCount > desiredCount) {
      // Scale down
      const toTerminate = currentCount - desiredCount;
      this.logger.info('Scaling down agents', { agentType, toTerminate });

      // Terminate least recently used agents
      const sortedAgents = currentAgents.sort((a, b) => a.lastActivityAt - b.lastActivityAt);
      const toTerminateIds = sortedAgents.slice(0, toTerminate).map(a => a.id);

      await this.bulkTerminateAgents(toTerminateIds, true);
    }
  }

  /**
   * Shutdown all agents
   */
  async shutdownAll(graceful: boolean = true): Promise<void> {
    this.logger.info('Shutting down all agents', { graceful });

    const agentIds = Array.from(this.instances.keys());

    if (graceful) {
      await this.bulkTerminateAgents(agentIds, true);
    } else {
      await this.bulkTerminateAgents(agentIds, false);
    }

    // Clear all timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    this.removeAllListeners();
  }

  /**
   * Shutdown lifecycle manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down lifecycle manager');

    // Gracefully shutdown all agents
    await this.shutdownAll(true);

    this.instances.clear();
    this.shutdownSignals.clear();
  }
}
