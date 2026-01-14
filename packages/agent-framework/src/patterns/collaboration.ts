/**
 * Collaboration Patterns
 *
 * Implements various agent collaboration patterns including
 * master-worker, peer-to-peer, hierarchical, consensus, and more.
 */

import type {
  AgentId,
  TaskId,
  Message
} from '../types';
import {
  CollaborationPattern,
  CollaborationConfig,
  CollaborationStatus,
  CollaborationResult,
  CollaborationMetrics,
  MasterWorkerConfig,
  PeerToPeerConfig,
  HierarchicalConfig,
  ConsensusConfig,
  FanOutConfig,
  FanInConfig,
  PipelineConfig,
  CollaborationSession
} from '../types';
import { MessageBroker } from '../communication/protocol';
import { TaskManager } from '../tasks/manager';
import { createLogger } from '../utils/logger';
import { generateId, sleep } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';

/**
 * Pattern execution context
 */
interface PatternExecution {
  sessionId: string;
  pattern: CollaborationPattern;
  status: CollaborationStatus;
  startTime: number;
  endTime?: number;
  participants: Set<AgentId>;
  messages: Message[];
  results: Map<AgentId, unknown>;
  errors: Map<AgentId, Error>;
}

/**
 * Collaboration pattern manager options
 */
export interface PatternManagerOptions {
  defaultTimeout: number;
  maxConcurrentSessions: number;
  enableMetrics: boolean;
}

/**
 * Collaboration Pattern Manager class
 */
export class CollaborationPatternManager extends EventEmitter {
  private messageBroker: MessageBroker;
  private taskManager: TaskManager;
  private options: PatternManagerOptions;
  private logger = createLogger('CollaborationPatterns');
  private sessions: Map<string, PatternExecution>;
  private activePatterns: Map<CollaborationPattern, Set<string>>;

  constructor(
    messageBroker: MessageBroker,
    taskManager: TaskManager,
    options: Partial<PatternManagerOptions> = {}
  ) {
    super();

    this.messageBroker = messageBroker;
    this.taskManager = taskManager;
    this.sessions = new Map();
    this.activePatterns = new Map();
    this.options = {
      defaultTimeout: 30000,
      maxConcurrentSessions: 100,
      enableMetrics: true,
      ...options
    };
  }

  /**
   * Execute master-worker pattern
   */
  async executeMasterWorker(config: MasterWorkerConfig): Promise<CollaborationResult> {
    this.logger.info('Executing master-worker pattern', {
      masterId: config.masterId,
      workerCount: config.workerIds.length
    });

    const session = await this.createSession(config);

    try {
      // Master distributes tasks to workers
      const tasks = config.tasks || [];
      const workerAssignments: Map<AgentId, TaskId[]> = new Map();

      // Initialize assignments
      for (const workerId of config.workerIds) {
        workerAssignments.set(workerId, []);
      }

      // Distribute tasks based on strategy
      for (let i = 0; i < tasks.length; i++) {
        const workerId = this.selectWorker(config.workerIds, config.taskDistribution, i);
        const assignments = workerAssignments.get(workerId)!;
        assignments.push(tasks[i]);
      }

      // Send tasks to workers
      for (const [workerId, taskIds] of workerAssignments) {
        await this.messageBroker.send({
          id: generateId('msg'),
          type: 'task_assignment' as any,
          from: config.masterId,
          to: workerId,
          payload: {
            type: 'json',
            data: { taskIds }
          },
          priority: 1,
          timestamp: Date.now(),
          deliveryGuarantee: 'at_least_once' as any,
          routingStrategy: 'direct' as any,
          headers: { contentType: 'application/json' },
          metadata: { sessionId: session.sessionId }
        });
      }

      // Wait for results
      await this.waitForResults(session, config.workerIds.length, config.workerTimeout);

      // Aggregate results
      const aggregatedResult = this.aggregateResults(
        session,
        config.resultAggregation
      );

      return this.completeSession(session, aggregatedResult);
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Select worker for task
   */
  private selectWorker(
    workers: AgentId[],
    strategy: string,
    taskIndex: number
  ): AgentId {
    switch (strategy) {
      case 'round_robin':
        return workers[taskIndex % workers.length];
      case 'random':
        return workers[Math.floor(Math.random() * workers.length)];
      case 'least_loaded':
        // In real implementation, would query load from registry
        return workers[0];
      case 'hash':
        return workers[taskIndex % workers.length];
      default:
        return workers[0];
    }
  }

  /**
   * Aggregate results from workers
   */
  private aggregateResults(
    session: PatternExecution,
    aggregation: string
  ): unknown {
    const results = Array.from(session.results.values());

    switch (aggregation) {
      case 'merge':
        return results.reduce((acc, result) => ({ ...acc, ...(result as object) }), {});
      case 'reduce':
        return results.reduce((acc, result) => {
          // Custom reduction logic
          return Array.isArray(acc) ? [...acc, result] : [acc, result];
        }, results[0]);
      case 'custom':
        // In real implementation, would call custom aggregation function
        return results;
      default:
        return results;
    }
  }

  /**
   * Execute peer-to-peer pattern
   */
  async executePeerToPeer(config: PeerToPeerConfig): Promise<CollaborationResult> {
    this.logger.info('Executing peer-to-peer pattern', {
      peerCount: config.peers.length,
      gossipProtocol: config.gossipProtocol
    });

    const session = await this.createSession(config);

    try {
      // Initialize gossip rounds
      const maxRounds = 5;
      let converged = false;

      for (let round = 0; round < maxRounds && !converged; round++) {
        // Each peer shares information with random subset
        for (const peerId of config.peers) {
          const fanout = Math.min(config.gossipFanout, config.peers.length - 1);
          const randomPeers = this.getRandomPeers(config.peers, peerId, fanout);

          for (const targetPeerId of randomPeers) {
            await this.messageBroker.send({
              id: generateId('msg'),
              type: 'gossip' as any,
              from: peerId,
              to: targetPeerId,
              payload: {
                type: 'json',
                data: { round, data: session.results.get(peerId) }
              },
              priority: 1,
              timestamp: Date.now(),
              deliveryGuarantee: 'at_least_once' as any,
              routingStrategy: 'direct' as any,
              headers: { contentType: 'application/json' },
              metadata: { sessionId: session.sessionId }
            });
          }
        }

        // Wait for gossip to propagate
        await sleep(config.gossipInterval);

        // Check convergence (simplified)
        converged = this.checkConvergence(session);
      }

      return this.completeSession(session, Object.fromEntries(session.results));
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Get random peers excluding self
   */
  private getRandomPeers(peers: AgentId[], exclude: AgentId, count: number): AgentId[] {
    const filtered = peers.filter(p => p !== exclude);
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Check if peers have converged
   */
  private checkConvergence(session: PatternExecution): boolean {
    // Simplified convergence check - in real implementation would be more sophisticated
    return session.results.size === session.participants.size;
  }

  /**
   * Execute hierarchical pattern
   */
  async executeHierarchical(config: HierarchicalConfig): Promise<CollaborationResult> {
    this.logger.info('Executing hierarchical pattern', {
      hierarchyLevels: config.hierarchy.levels.length
    });

    const session = await this.createSession(config);

    try {
      // Process hierarchy from top to bottom
      for (const level of config.hierarchy.levels) {
        // Agents at this level process and delegate
        for (const agentId of level.agents) {
          if (level.supervisor) {
            // Report to supervisor
            await this.messageBroker.send({
              id: generateId('msg'),
              type: 'status_update' as any,
              from: agentId,
              to: level.supervisor,
              payload: {
                type: 'json',
                data: { level: level.level, result: session.results.get(agentId) }
              },
              priority: 1,
              timestamp: Date.now(),
              deliveryGuarantee: 'at_least_once' as any,
              routingStrategy: 'direct' as any,
              headers: { contentType: 'application/json' },
              metadata: { sessionId: session.sessionId }
            });
          }
        }
      }

      // Wait for all levels to complete
      await this.waitForResults(session, config.participants.length, config.timeout);

      return this.completeSession(session, Object.fromEntries(session.results));
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Execute consensus pattern
   */
  async executeConsensus(config: ConsensusConfig): Promise<CollaborationResult> {
    this.logger.info('Executing consensus pattern', {
      algorithm: config.algorithm,
      participants: config.participants.length,
      requiredQuorum: config.requiredQuorum
    });

    const session = await this.createSession(config);

    try {
      // Initialize voting
      const proposal = config.proposal || { data: 'proposal' };
      const votes: Map<AgentId, boolean> = new Map();

      // Collect votes from participants
      for (const participantId of config.participants) {
        const vote = await this.requestVote(participantId, proposal, config);
        votes.set(participantId, vote);
        session.results.set(participantId, vote);
      }

      // Determine consensus outcome
      const approvedVotes = Array.from(votes.values()).filter(v => v).length;
      const consensus = approvedVotes >= config.requiredQuorum;

      return this.completeSession(session, {
        consensus,
        approvedVotes,
        totalVotes: votes.size,
        votes: Object.fromEntries(votes)
      });
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Request vote from participant
   */
  private async requestVote(
    participantId: AgentId,
    proposal: unknown,
    config: ConsensusConfig
  ): Promise<boolean> {
    // In real implementation, would send message and wait for response
    // For now, simulate random vote
    await sleep(10);
    return Math.random() > 0.3; // 70% chance of approval
  }

  /**
   * Execute fan-out pattern
   */
  async executeFanOut(config: FanOutConfig): Promise<CollaborationResult> {
    this.logger.info('Executing fan-out pattern', {
      sourceId: config.sourceId,
      destinationCount: config.destinations.length
    });

    const session = await this.createSession(config);

    try {
      // Broadcast message to all destinations
      for (const destId of config.destinations) {
        await this.messageBroker.send({
          ...config.message,
          to: destId,
          metadata: {
            ...config.message.metadata,
            sessionId: session.sessionId
          }
        });
      }

      // Wait for responses based on aggregation strategy
      let requiredResponses = 0;
      switch (config.aggregationStrategy) {
        case 'wait_all':
          requiredResponses = config.destinations.length;
          break;
        case 'wait_first':
          requiredResponses = 1;
          break;
        case 'wait_quorum':
          requiredResponses = config.quorumSize || Math.ceil(config.destinations.length / 2);
          break;
        default:
          requiredResponses = config.destinations.length;
      }

      await this.waitForResults(session, requiredResponses, config.aggregationTimeout);

      return this.completeSession(session, Object.fromEntries(session.results));
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Execute fan-in pattern
   */
  async executeFanIn(config: FanInConfig): Promise<CollaborationResult> {
    this.logger.info('Executing fan-in pattern', {
      sourceCount: config.sources.length,
      destinationId: config.destinationId
    });

    const session = await this.createSession(config);

    try {
      // Collect results from all sources
      await this.waitForResults(session, config.sources.length, config.timeout);

      // Aggregate using specified function
      const results = Array.from(session.results.values());
      const aggregated = this.applyAggregationFunction(results, config.aggregationFunction);

      // Send to destination
      await this.messageBroker.send({
        id: generateId('msg'),
        type: 'aggregation_result' as any,
        from: 'pattern_manager',
        to: config.destinationId,
        payload: {
          type: 'json',
          data: { aggregated }
        },
        priority: 1,
        timestamp: Date.now(),
        deliveryGuarantee: 'at_least_once' as any,
        routingStrategy: 'direct' as any,
        headers: { contentType: 'application/json' },
        metadata: { sessionId: session.sessionId }
      });

      return this.completeSession(session, aggregated);
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Apply aggregation function
   */
  private applyAggregationFunction(results: unknown[], func: string): unknown {
    const numbers = results as number[];

    switch (func) {
      case 'merge':
        return results.reduce((acc, r) => ({ ...acc, ...(r as object) }), {});
      case 'reduce':
        return numbers.reduce((acc, r) => acc + r, 0);
      case 'concatenate':
        return results.flat();
      case 'average':
        return numbers.reduce((acc, r) => acc + r, 0) / numbers.length;
      case 'sum':
        return numbers.reduce((acc, r) => acc + r, 0);
      case 'max':
        return Math.max(...numbers);
      case 'min':
        return Math.min(...numbers);
      default:
        return results;
    }
  }

  /**
   * Execute pipeline pattern
   */
  async executePipeline(config: PipelineConfig): Promise<CollaborationResult> {
    this.logger.info('Executing pipeline pattern', {
      stageCount: config.stages.length,
      parallelism: config.parallelism
    });

    const session = await this.createSession(config);

    try {
      let currentData = config.initialData;

      // Process stages sequentially
      for (const stage of config.stages) {
        // Send to stage agent
        await this.messageBroker.send({
          id: generateId('msg'),
          type: 'pipeline_stage' as any,
          from: 'pattern_manager',
          to: stage.agentId,
          payload: {
            type: 'json',
            data: { input: currentData, stage: stage.stageId }
          },
          priority: 1,
          timestamp: Date.now(),
          deliveryGuarantee: 'at_least_once' as any,
          routingStrategy: 'direct' as any,
          headers: { contentType: 'application/json' },
          metadata: { sessionId: session.sessionId }
        });

        // Wait for stage to complete
        await sleep(100); // Simulate processing

        // In real implementation, would get actual output
        session.results.set(stage.agentId, { processed: true });
      }

      return this.completeSession(session, { finalData: currentData });
    } catch (error) {
      return this.failSession(session, error as Error);
    }
  }

  /**
   * Create a new collaboration session
   */
  private async createSession(config: CollaborationConfig): Promise<PatternExecution> {
    const sessionId = generateId('session');

    const execution: PatternExecution = {
      sessionId,
      pattern: config.pattern,
      status: CollaborationStatus.RUNNING,
      startTime: Date.now(),
      participants: new Set(config.participants),
      messages: [],
      results: new Map(),
      errors: new Map()
    };

    this.sessions.set(sessionId, execution);

    // Track active pattern
    if (!this.activePatterns.has(config.pattern)) {
      this.activePatterns.set(config.pattern, new Set());
    }
    this.activePatterns.get(config.pattern)!.add(sessionId);

    return execution;
  }

  /**
   * Wait for results from participants
   */
  private async waitForResults(
    session: PatternExecution,
    expectedCount: number,
    timeout: number
  ): Promise<void> {
    const startTime = Date.now();

    while (session.results.size < expectedCount) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Collaboration timeout');
      }

      // Simulate receiving results
      // In real implementation, would listen for message events
      await sleep(100);
    }
  }

  /**
   * Complete a collaboration session
   */
  private completeSession(session: PatternExecution, result: unknown): CollaborationResult {
    session.status = CollaborationStatus.COMPLETED;
    session.endTime = Date.now();

    const metrics = this.calculateMetrics(session);

    // Clean up
    this.activePatterns.get(session.pattern)?.delete(session.sessionId);

    return {
      sessionId: session.sessionId,
      pattern: session.pattern,
      status: session.status,
      participants: Array.from(session.participants),
      results: session.results,
      aggregatedResult: result,
      errors: new Map(Array.from(session.errors.entries()).map(([k, v]) => [k, v.message])),
      metrics,
      completedAt: session.endTime
    };
  }

  /**
   * Fail a collaboration session
   */
  private failSession(session: PatternExecution, error: Error): CollaborationResult {
    session.status = CollaborationStatus.FAILED;
    session.endTime = Date.now();

    const metrics = this.calculateMetrics(session);

    // Clean up
    this.activePatterns.get(session.pattern)?.delete(session.sessionId);

    return {
      sessionId: session.sessionId,
      pattern: session.pattern,
      status: session.status,
      participants: Array.from(session.participants),
      results: session.results,
      errors: new Map(Array.from(session.errors.entries()).map(([k, v]) => [k, v.message])),
      metrics,
      completedAt: session.endTime
    };
  }

  /**
   * Calculate collaboration metrics
   */
  private calculateMetrics(session: PatternExecution): CollaborationMetrics {
    return {
      startTime: session.startTime,
      endTime: session.endTime || Date.now(),
      duration: (session.endTime || Date.now()) - session.startTime,
      messagesExchanged: session.messages.length,
      participantsInvolved: session.participants.size,
      tasksCompleted: session.results.size,
      tasksFailed: session.errors.size,
      averageResponseTime: 0, // Would calculate from actual timings
      throughput: session.results.size / ((session.endTime || Date.now()) - session.startTime) * 1000
    };
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): PatternExecution[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status === CollaborationStatus.RUNNING
    );
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): PatternExecution | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = CollaborationStatus.CANCELLED;
    session.endTime = Date.now();

    this.activePatterns.get(session.pattern)?.delete(sessionId);
  }

  /**
   * Shutdown pattern manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down pattern manager');

    // Cancel all active sessions
    const activeSessions = this.getActiveSessions();
    for (const session of activeSessions) {
      await this.cancelSession(session.sessionId);
    }

    this.sessions.clear();
    this.activePatterns.clear();
    this.removeAllListeners();
  }
}
