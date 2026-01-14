/**
 * Distributed State Machine Coordinator
 * Manages distributed state coordination, synchronization, and consensus
 */

import { EventEmitter } from 'eventemitter3';
import { StateMachineEngine } from '../engine/engine.js';
import {
  State,
  StateMachineDefinition,
  DistributedStateConfig,
  StateSyncMessage,
  ConsensusResult,
  StateMachineSnapshot,
} from '../types/index.js';

/**
 * Cluster node info
 */
export interface ClusterNode {
  id: string;
  address: string;
  port: number;
  isLeader: boolean;
  lastHeartbeat: number;
}

/**
 * Replication log entry
 */
export interface ReplicationLogEntry {
  index: number;
  term: number;
  state: State;
  timestamp: number;
}

/**
 * Distributed coordinator options
 */
export interface CoordinatorOptions {
  /** Enable leader election */
  enableElection?: boolean;
  /** Enable state replication */
  enableReplication?: boolean;
  /** Replication factor */
  replicationFactor?: number;
  /** Election timeout in milliseconds */
  electionTimeout?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Sync timeout in milliseconds */
  syncTimeout?: number;
  /** Max log entries */
  maxLogEntries?: number;
}

/**
 * Distributed state coordinator class
 */
export class DistributedStateCoordinator<TData = any> {
  private machine: StateMachineEngine<TData>;
  private config: Required<DistributedStateConfig>;
  private options: Required<CoordinatorOptions>;
  private emitter: EventEmitter;
  private isLeader: boolean = false;
  private currentTerm: number = 0;
  private votedFor: string | null = null;
  private leaderId: string | null = null;
  private log: ReplicationLogEntry[] = [];
  private commitIndex: number = 0;
  private lastApplied: number = 0;
  private nodes: Map<string, ClusterNode> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private electionTimer?: NodeJS.Timeout;
  private nextIndex: Map<string, number> = new Map();
  private matchIndex: Map<string, number> = new Map();
  private isDestroyed: boolean = false;

  constructor(
    machine: StateMachineEngine<TData>,
    config: DistributedStateConfig,
    options: CoordinatorOptions = {}
  ) {
    this.machine = machine;
    this.config = this.normalizeConfig(config);
    this.options = this.normalizeOptions(options);
    this.emitter = new EventEmitter();

    // Initialize cluster nodes
    for (const nodeId of this.config.cluster) {
      this.nodes.set(nodeId, {
        id: nodeId,
        address: '',
        port: 0,
        isLeader: false,
        lastHeartbeat: Date.now(),
      });
    }

    // Subscribe to state changes
    this.machine.on('state:change', this.handleStateChange.bind(this));

    // Start leader election if enabled
    if (this.options.enableElection) {
      this.startElectionTimer();
    }

    // Start heartbeat if leader
    this.emitter.on('becameLeader', () => {
      this.startHeartbeat();
    });

    this.emitter.on('lostLeadership', () => {
      this.stopHeartbeat();
    });
  }

  /**
   * Get current leader
   */
  get leader(): string | null {
    return this.leaderId;
  }

  /**
   * Check if this node is leader
   */
  get isNodeLeader(): boolean {
    return this.isLeader;
  }

  /**
   * Get current term
   */
  get term(): number {
    return this.currentTerm;
  }

  /**
   * Get cluster nodes
   */
  get cluster(): readonly ClusterNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Synchronize state with cluster
   */
  async syncState(): Promise<void> {
    if (!this.options.enableReplication) {
      return;
    }

    const snapshot = this.machine.createSnapshot();
    const message: StateSyncMessage = {
      type: 'sync',
      from: this.config.nodeId,
      state: snapshot.state,
      version: this.currentTerm,
      timestamp: Date.now(),
    };

    // Broadcast to cluster
    await this.broadcastMessage(message);
  }

  /**
   * Request state sync from cluster
   */
  async requestSync(): Promise<StateMachineSnapshot | null> {
    const message: StateSyncMessage = {
      type: 'sync_req',
      from: this.config.nodeId,
      timestamp: Date.now(),
    };

    // In a real implementation, this would wait for responses
    await this.broadcastMessage(message);

    // Return current snapshot as fallback
    return this.machine.createSnapshot();
  }

  /**
   * Initiate leader election
   */
  async startElection(): Promise<void> {
    if (!this.options.enableElection) {
      return;
    }

    // Increment term
    this.currentTerm++;
    this.votedFor = this.config.nodeId;
    this.isLeader = false;
    this.leaderId = null;

    // Request votes
    const message: StateSyncMessage = {
      type: 'elect',
      from: this.config.nodeId,
      term: this.currentTerm,
      timestamp: Date.now(),
    };

    const responses = await this.broadcastMessage(message);
    const votes = responses.filter(r => r && typeof r === 'boolean' ? r : false).length;

    // Check if we won the election
    const quorum = Math.floor(this.config.cluster.length / 2) + 1;

    if (votes >= quorum && this.currentTerm === this.getLatestTerm()) {
      this.becomeLeader();
    } else {
      this.startElectionTimer();
    }
  }

  /**
   * Handle incoming state sync message
   */
  async handleMessage(message: StateSyncMessage): Promise<void> {
    switch (message.type) {
      case 'sync':
        await this.handleSync(message);
        break;

      case 'sync_req':
        await this.handleSyncRequest(message);
        break;

      case 'heartbeat':
        await this.handleHeartbeat(message);
        break;

      case 'elect':
        await this.handleElection(message);
        break;

      case 'vote':
        await this.handleVote(message);
        break;
    }
  }

  /**
   * Achieve consensus on state
   */
  async achieveConsensus(proposedState: State): Promise<ConsensusResult> {
    if (this.isLeader) {
      // Leader proposes state
      const entry: ReplicationLogEntry = {
        index: this.log.length,
        term: this.currentTerm,
        state: proposedState,
        timestamp: Date.now(),
      };

      this.log.push(entry);

      // Replicate to followers
      const responses = await this.replicateToFollowers();

      // Count votes
      const votesFor = responses.filter(r => r.success).length + 1; // +1 for leader
      const quorum = Math.floor(this.config.cluster.length / 2) + 1;

      if (votesFor >= quorum) {
        this.commitIndex = entry.index;
        return {
          reached: true,
          state: proposedState,
          term: this.currentTerm,
          votesFor,
          votesAgainst: responses.length - votesFor + 1,
        };
      }
    }

    return {
      reached: false,
      term: this.currentTerm,
      votesFor: 0,
      votesAgainst: 0,
    };
  }

  /**
   * Partition state across cluster
   */
  partitionState(partitionCount: number): Map<string, State[]> {
    const states = Object.keys(this.machine.definition.states);
    const partitions = new Map<string, State[]>();
    const nodes = Array.from(this.nodes.keys());

    for (let i = 0; i < partitionCount; i++) {
      const start = Math.floor((i * states.length) / partitionCount);
      const end = Math.floor(((i + 1) * states.length) / partitionCount);
      const partition = states.slice(start, end);

      const nodeId = nodes[i % nodes.length];
      partitions.set(nodeId, partition);
    }

    return partitions;
  }

  /**
   * Get replication status
   */
  getReplicationStatus(): {
    logSize: number;
    commitIndex: number;
    lastApplied: number;
    nodes: Array<{
      id: string;
      nextIndex: number;
      matchIndex: number;
      isUpToDate: boolean;
    }>;
  } {
    return {
      logSize: this.log.length,
      commitIndex: this.commitIndex,
      lastApplied: this.lastApplied,
      nodes: Array.from(this.nodes.keys()).map(id => ({
        id,
        nextIndex: this.nextIndex.get(id) || 0,
        matchIndex: this.matchIndex.get(id) || 0,
        isUpToDate: (this.matchIndex.get(id) || 0) >= this.commitIndex,
      })),
    };
  }

  /**
   * Add node to cluster
   */
  async addNode(nodeId: string, address: string, port: number): Promise<void> {
    this.nodes.set(nodeId, {
      id: nodeId,
      address,
      port,
      isLeader: false,
      lastHeartbeat: Date.now(),
    });

    this.nextIndex.set(nodeId, this.log.length);
    this.matchIndex.set(nodeId, 0);
  }

  /**
   * Remove node from cluster
   */
  async removeNode(nodeId: string): Promise<void> {
    this.nodes.delete(nodeId);
    this.nextIndex.delete(nodeId);
    this.matchIndex.delete(nodeId);
  }

  /**
   * Handle state change
   */
  private async handleStateChange(event: any): Promise<void> {
    if (this.isLeader && this.options.enableReplication) {
      await this.replicateToFollowers();
    }
  }

  /**
   * Handle sync message
   */
  private async handleSync(message: StateSyncMessage): Promise<void> {
    if (message.term > this.currentTerm) {
      this.currentTerm = message.term;
      this.isLeader = false;
      this.leaderId = null;
    }

    // Update state if from leader
    if (this.leaderId === message.from && message.state) {
      // In a real implementation, this would apply the state
      const snapshot = this.machine.createSnapshot();
      snapshot.state = message.state;
      // this.machine.restoreSnapshot(snapshot);
    }
  }

  /**
   * Handle sync request
   */
  private async handleSyncRequest(message: StateSyncMessage): Promise<void> {
    const snapshot = this.machine.createSnapshot();
    const response: StateSyncMessage = {
      type: 'sync',
      from: this.config.nodeId,
      state: snapshot.state,
      version: this.currentTerm,
      timestamp: Date.now(),
    };

    // In a real implementation, this would send the response to the requester
  }

  /**
   * Handle heartbeat
   */
  private async handleHeartbeat(message: StateSyncMessage): Promise<void> {
    if (message.term > this.currentTerm) {
      this.currentTerm = message.term;
      this.isLeader = false;
      this.leaderId = null;
      this.startElectionTimer();
    }

    if (message.from && this.nodes.has(message.from)) {
      const node = this.nodes.get(message.from)!;
      node.lastHeartbeat = Date.now();

      if (message.term && message.term >= this.currentTerm) {
        this.leaderId = message.from;
        this.stopElectionTimer();
      }
    }
  }

  /**
   * Handle election message
   */
  private async handleElection(message: StateSyncMessage): Promise<void> {
    if (message.term && message.term > this.currentTerm) {
      this.currentTerm = message.term;
      this.votedFor = null;
      this.isLeader = false;
      this.leaderId = null;
    }

    // Grant vote if we haven't voted and candidate's log is at least as up-to-date
    if (
      this.votedFor === null &&
      message.term === this.currentTerm &&
      this.isLogUpToDate(message)
    ) {
      this.votedFor = message.from;
      this.stopElectionTimer();

      // Send vote
      const voteMessage: StateSyncMessage = {
        type: 'vote',
        from: this.config.nodeId,
        candidateId: this.config.nodeId,
        term: this.currentTerm,
        timestamp: Date.now(),
      };

      // In a real implementation, this would send the vote to the candidate
    }
  }

  /**
   * Handle vote message
   */
  private async handleVote(message: StateSyncMessage): Promise<void> {
    if (message.term && message.term > this.currentTerm) {
      this.currentTerm = message.term;
      this.isLeader = false;
      this.leaderId = null;
      this.startElectionTimer();
    }
  }

  /**
   * Become leader
   */
  private becomeLeader(): void {
    this.isLeader = true;
    this.leaderId = this.config.nodeId;

    // Initialize nextIndex and matchIndex for all followers
    for (const nodeId of this.nodes.keys()) {
      if (nodeId !== this.config.nodeId) {
        this.nextIndex.set(nodeId, this.log.length);
        this.matchIndex.set(nodeId, 0);
      }
    }

    this.emitter.emit('becameLeader');
    this.stopElectionTimer();
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(async () => {
      if (this.isLeader) {
        const message: StateSyncMessage = {
          type: 'heartbeat',
          from: this.config.nodeId,
          term: this.currentTerm,
          timestamp: Date.now(),
        };

        await this.broadcastMessage(message);
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Start election timer
   */
  private startElectionTimer(): void {
    this.stopElectionTimer();

    const timeout = this.options.electionTimeout +
      Math.random() * this.options.electionTimeout;

    this.electionTimer = setTimeout(async () => {
      if (!this.isLeader && !this.isDestroyed) {
        await this.startElection();
      }
    }, timeout);
  }

  /**
   * Stop election timer
   */
  private stopElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = undefined;
    }
  }

  /**
   * Replicate log to followers
   */
  private async replicateToFollowers(): Promise<Array<{ success: boolean }>> {
    const results: Array<{ success: boolean }> = [];

    for (const nodeId of this.nodes.keys()) {
      if (nodeId === this.config.nodeId) {
        continue;
      }

      const nextIdx = this.nextIndex.get(nodeId) || 0;
      const entries = this.log.slice(nextIdx);

      // In a real implementation, this would send entries to the follower
      // For now, simulate success
      results.push({ success: true });

      if (entries.length > 0) {
        this.nextIndex.set(nodeId, nextIdx + entries.length);
        this.matchIndex.set(nodeId, nextIdx + entries.length - 1);
      }
    }

    return results;
  }

  /**
   * Broadcast message to cluster
   */
  private async broadcastMessage(message: StateSyncMessage): Promise<any[]> {
    // In a real implementation, this would use actual network communication
    // For now, return empty array
    return [];
  }

  /**
   * Check if log is up-to-date
   */
  private isLogUpToDate(message: StateSyncMessage): boolean {
    // Simple implementation - in real Raft, this compares log terms and indices
    return true;
  }

  /**
   * Get latest term from log
   */
  private getLatestTerm(): number {
    if (this.log.length === 0) {
      return 0;
    }
    return this.log[this.log.length - 1].term;
  }

  /**
   * Normalize config
   */
  private normalizeConfig(config: DistributedStateConfig): Required<DistributedStateConfig> {
    return {
      nodeId: config.nodeId,
      cluster: config.cluster,
      replicationFactor: config.replicationFactor ?? 2,
      electionTimeout: config.electionTimeout ?? 5000,
      heartbeatInterval: config.heartbeatInterval ?? 1000,
      syncTimeout: config.syncTimeout ?? 3000,
    };
  }

  /**
   * Normalize options
   */
  private normalizeOptions(options: CoordinatorOptions): Required<CoordinatorOptions> {
    return {
      enableElection: options.enableElection ?? true,
      enableReplication: options.enableReplication ?? true,
      replicationFactor: options.replicationFactor ?? 2,
      electionTimeout: options.electionTimeout ?? 5000,
      heartbeatInterval: options.heartbeatInterval ?? 1000,
      syncTimeout: options.syncTimeout ?? 3000,
      maxLogEntries: options.maxLogEntries ?? 1000,
    };
  }

  /**
   * Destroy coordinator
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();
    this.stopElectionTimer();
    this.emitter.removeAllListeners();
    this.nodes.clear();
    this.log = [];
    this.nextIndex.clear();
    this.matchIndex.clear();
  }
}

/**
 * Create distributed state machine cluster
 */
export function createDistributedCluster<TData = any>(
  definition: StateMachineDefinition<TData>,
  nodeCount: number
): DistributedStateCoordinator<TData>[] {
  const coordinators: DistributedStateCoordinator<TData>[] = [];
  const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node-${i}`);

  for (let i = 0; i < nodeCount; i++) {
    const machine = createStateMachine(definition, {
      enableMetrics: true,
    });

    const config: DistributedStateConfig = {
      nodeId: nodeIds[i],
      cluster: nodeIds,
      replicationFactor: Math.ceil(nodeCount / 2),
    };

    const coordinator = new DistributedStateCoordinator(machine, config);
    coordinators.push(coordinator);
  }

  return coordinators;
}
