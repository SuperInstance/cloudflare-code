/**
 * Distributed Coordinator
 * Manages leader election, job distribution, load balancing, failover, and state synchronization
 */

import {
  NodeInfo,
  ClusterState,
  DistributedLock,
  Job,
  JobStatus,
  Logger
} from '../types';

/**
 * Configuration for distributed coordinator
 */
export interface DistributedCoordinatorConfig {
  nodeId: string;
  heartbeatInterval: number;
  leaderElectionTimeout: number;
  stateSyncInterval: number;
  loadThreshold: number;
  maxRetries: number;
  storage?: DurableObjectStorage;
  logger?: Logger;
}

/**
 * Distributed coordinator class
 */
export class DistributedCoordinator {
  private nodeId: string;
  private clusterState: ClusterState;
  private config: DistributedCoordinatorConfig;
  private logger: Logger;
  private heartbeatTimer?: NodeJS.Timeout;
  private electionTimer?: NodeJS.Timeout;
  private syncTimer?: NodeJS.Timeout;
  private isLeader: boolean;
  private locks: Map<string, DistributedLock>;
  private jobAssignments: Map<string, string>; // jobId -> nodeId
  private pendingTransfers: Map<string, string>; // jobId -> targetNodeId
  private onLeadershipGainedCallback?: () => void;
  private onLeadershipLostCallback?: () => void;
  private onJobAssignedCallback?: (jobId: string, nodeId: string) => void;
  private onNodeJoinedCallback?: (nodeId: string) => void;
  private onNodeLeftCallback?: (nodeId: string) => void;

  constructor(config: DistributedCoordinatorConfig) {
    this.nodeId = config.nodeId;
    this.config = config;
    this.logger = config.logger || this.createDefaultLogger();

    this.clusterState = {
      nodes: new Map(),
      leader: null,
      term: 0,
      jobs: new Map(),
      queues: new Map()
    };

    this.isLeader = false;
    this.locks = new Map();
    this.jobAssignments = new Map();
    this.pendingTransfers = new Map();

    // Initialize this node
    this.registerNode();
  }

  /**
   * Start the coordinator
   */
  async start(): Promise<void> {
    this.logger.info(`Starting distributed coordinator: ${this.nodeId}`);

    // Start heartbeat
    this.startHeartbeat();

    // Start leader election
    this.startLeaderElection();

    // Start state sync
    this.startStateSync();

    // Join cluster
    await this.joinCluster();
  }

  /**
   * Stop the coordinator
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping distributed coordinator...');

    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Leave cluster
    await this.leaveCluster();

    // Release all locks
    await this.releaseAllLocks();

    this.logger.info('Distributed coordinator stopped');
  }

  /**
   * Register this node
   */
  private registerNode(): void {
    const nodeInfo: NodeInfo = {
      id: this.nodeId,
      address: '', // Will be set by the network layer
      port: 0, // Will be set by the network layer
      lastHeartbeat: new Date(),
      status: 'active',
      capabilities: ['scheduler', 'executor'],
      load: 0,
      scheduledJobs: 0,
      runningJobs: 0
    };

    this.clusterState.nodes.set(this.nodeId, nodeInfo);
    this.logger.debug(`Node registered: ${this.nodeId}`);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Send heartbeat to update node status
   */
  private sendHeartbeat(): void {
    const node = this.clusterState.nodes.get(this.nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
      this.logger.debug(`Heartbeat sent from ${this.nodeId}`);

      // If leader, check for failed nodes
      if (this.isLeader) {
        this.checkNodeHealth();
      }
    }
  }

  /**
   * Check node health and remove dead nodes
   */
  private checkNodeHealth(): void {
    const now = Date.now();
    const timeout = this.config.leaderElectionTimeout * 2;

    for (const [nodeId, node] of this.clusterState.nodes) {
      if (now - node.lastHeartbeat.getTime() > timeout) {
        this.logger.warn(`Node ${nodeId} appears to be dead, removing from cluster`);
        this.handleNodeFailure(nodeId);
      }
    }
  }

  /**
   * Start leader election
   */
  private startLeaderElection(): void {
    this.electionTimer = setTimeout(() => {
      this.initiateElection();
    }, this.config.leaderElectionTimeout);
  }

  /**
   * Initiate leader election
   */
  private async initiateElection(): Promise<void> {
    this.logger.info(`Initiating leader election (term ${this.clusterState.term + 1})`);

    // Increment term
    this.clusterState.term++;

    // Vote for self
    const votes = 1;
    const totalNodes = this.clusterState.nodes.size;
    const majority = Math.floor(totalNodes / 2) + 1;

    // In a real implementation, we would request votes from other nodes
    // For now, we'll assume we become leader if no other leader exists
    if (!this.clusterState.leader || this.isNodeDead(this.clusterState.leader)) {
      await this.becomeLeader();
    }

    // Schedule next election check
    this.electionTimer = setTimeout(() => {
      this.initiateElection();
    }, this.config.leaderElectionTimeout);
  }

  /**
   * Become leader
   */
  private async becomeLeader(): Promise<void> {
    this.logger.info(`Node ${this.nodeId} becoming leader for term ${this.clusterState.term}`);

    this.isLeader = true;
    this.clusterState.leader = this.nodeId;

    // Redistribute jobs
    await this.redistributeJobs();

    // Trigger callback
    if (this.onLeadershipGainedCallback) {
      this.onLeadershipGainedCallback();
    }
  }

  /**
   * Step down as leader
   */
  private async stepDown(): Promise<void> {
    if (this.isLeader) {
      this.logger.info(`Node ${this.nodeId} stepping down as leader`);

      this.isLeader = false;
      this.clusterState.leader = null;

      // Trigger callback
      if (this.onLeadershipLostCallback) {
        this.onLeadershipLostCallback();
      }
    }
  }

  /**
   * Start state synchronization
   */
  private startStateSync(): void {
    this.syncTimer = setInterval(() => {
      this.syncState();
    }, this.config.stateSyncInterval);
  }

  /**
   * Synchronize state with cluster
   */
  private async syncState(): Promise<void> {
    if (this.isLeader) {
      // Leader broadcasts state to followers
      await this.broadcastState();
    } else {
      // Followers request state from leader
      await this.requestState();
    }
  }

  /**
   * Broadcast state to all nodes
   */
  private async broadcastState(): Promise<void> {
    // In a real implementation, this would send the state to all nodes
    this.logger.debug('Broadcasting cluster state');
  }

  /**
   * Request state from leader
   */
  private async requestState(): Promise<void> {
    // In a real implementation, this would request state from the leader
    this.logger.debug('Requesting cluster state from leader');
  }

  /**
   * Join the cluster
   */
  private async joinCluster(): Promise<void> {
    this.logger.info(`Node ${this.nodeId} joining cluster`);

    // Announce presence to cluster
    await this.announcePresence();

    // Request initial state from leader
    if (!this.isLeader) {
      await this.requestState();
    }

    // Trigger callback
    if (this.onNodeJoinedCallback) {
      this.onNodeJoinedCallback(this.nodeId);
    }
  }

  /**
   * Leave the cluster
   */
  private async leaveCluster(): Promise<void> {
    this.logger.info(`Node ${this.nodeId} leaving cluster`);

    // If leader, step down
    if (this.isLeader) {
      await this.stepDown();
    }

    // Remove from cluster
    this.clusterState.nodes.delete(this.nodeId);

    // Trigger callback
    if (this.onNodeLeftCallback) {
      this.onNodeLeftCallback(this.nodeId);
    }
  }

  /**
   * Announce presence to cluster
   */
  private async announcePresence(): Promise<void> {
    this.logger.debug(`Node ${this.nodeId} announcing presence`);
  }

  /**
   * Handle node failure
   */
  private async handleNodeFailure(nodeId: string): Promise<void> {
    this.logger.warn(`Handling node failure: ${nodeId}`);

    // Remove dead node
    this.clusterState.nodes.delete(nodeId);

    // If leader was dead, trigger new election
    if (this.clusterState.leader === nodeId) {
      this.clusterState.leader = null;
      await this.initiateElection();
    }

    // Redistribute jobs from dead node
    await this.redistributeJobsFromNode(nodeId);

    // Trigger callback
    if (this.onNodeLeftCallback) {
      this.onNodeLeftCallback(nodeId);
    }
  }

  /**
   * Check if a node is dead
   */
  private isNodeDead(nodeId: string): boolean {
    const node = this.clusterState.nodes.get(nodeId);
    if (!node) {
      return true;
    }

    const now = Date.now();
    const timeout = this.config.leaderElectionTimeout * 2;

    return now - node.lastHeartbeat.getTime() > timeout;
  }

  /**
   * Redistribute jobs among cluster
   */
  private async redistributeJobs(): Promise<void> {
    if (!this.isLeader) {
      return;
    }

    this.logger.info('Redistributing jobs in cluster');

    const activeNodes = Array.from(this.clusterState.nodes.values()).filter(
      (n) => n.status === 'active'
    );

    if (activeNodes.length === 0) {
      this.logger.warn('No active nodes available for job redistribution');
      return;
    }

    // Calculate total load
    const totalLoad = activeNodes.reduce((sum, node) => sum + node.load, 0);
    const avgLoad = totalLoad / activeNodes.length;

    // Find overloaded and underloaded nodes
    const overloadedNodes = activeNodes.filter((n) => n.load > avgLoad * 1.2);
    const underloadedNodes = activeNodes.filter((n) => n.load < avgLoad * 0.8);

    // Redistribute jobs from overloaded to underloaded
    for (const overloaded of overloadedNodes) {
      for (const underloaded of underloadedNodes) {
        if (overloaded.load <= avgLoad || underloaded.load >= avgLoad) {
          break;
        }

        await this.transferJob(overloaded.id, underloaded.id);
      }
    }
  }

  /**
   * Redistribute jobs from a failed node
   */
  private async redistributeJobsFromNode(nodeId: string): Promise<void> {
    if (!this.isLeader) {
      return;
    }

    this.logger.info(`Redistributing jobs from failed node: ${nodeId}`);

    // Find jobs assigned to failed node
    const jobsToRedistribute: string[] = [];
    for (const [jobId, assignedNode] of this.jobAssignments) {
      if (assignedNode === nodeId) {
        jobsToRedistribute.push(jobId);
      }
    }

    // Reassign jobs to available nodes
    const activeNodes = Array.from(this.clusterState.nodes.values()).filter(
      (n) => n.status === 'active' && n.id !== nodeId
    );

    for (const jobId of jobsToRedistribute) {
      if (activeNodes.length === 0) {
        break;
      }

      // Find least loaded node
      const targetNode = activeNodes.reduce((min, node) =>
        node.load < min.load ? node : min
      );

      await this.assignJob(jobId, targetNode.id);
    }
  }

  /**
   * Transfer a job from one node to another
   */
  private async transferJob(fromNodeId: string, toNodeId: string): Promise<void> {
    // Find a job to transfer
    for (const [jobId, assignedNode] of this.jobAssignments) {
      if (assignedNode === fromNodeId) {
        this.pendingTransfers.set(jobId, toNodeId);
        await this.assignJob(jobId, toNodeId);

        const fromNode = this.clusterState.nodes.get(fromNodeId);
        const toNode = this.clusterState.nodes.get(toNodeId);

        if (fromNode) {
          fromNode.scheduledJobs--;
          fromNode.load--;
        }

        if (toNode) {
          toNode.scheduledJobs++;
          toNode.load++;
        }

        break;
      }
    }
  }

  /**
   * Assign a job to a node
   */
  async assignJob(jobId: string, nodeId: string): Promise<void> {
    this.jobAssignments.set(jobId, nodeId);

    this.logger.debug(`Job ${jobId} assigned to node ${nodeId}`);

    // Trigger callback
    if (this.onJobAssignedCallback) {
      this.onJobAssignedCallback(jobId, nodeId);
    }
  }

  /**
   * Acquire a distributed lock
   */
  async acquireLock(
    key: string,
    ttl: number = 30000
  ): Promise<DistributedLock | null> {
    // Check if lock is already held
    const existingLock = this.locks.get(key);
    if (existingLock && existingLock.expiresAt > new Date()) {
      return null;
    }

    const lock: DistributedLock = {
      key,
      owner: this.nodeId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + ttl)
    };

    this.locks.set(key, lock);
    this.logger.debug(`Lock acquired: ${key} by ${this.nodeId}`);

    // Auto-release after TTL
    setTimeout(() => {
      this.releaseLock(key);
    }, ttl);

    return lock;
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(key: string): Promise<void> {
    const lock = this.locks.get(key);
    if (lock && lock.owner === this.nodeId) {
      this.locks.delete(key);
      this.logger.debug(`Lock released: ${key}`);
    }
  }

  /**
   * Release all locks held by this node
   */
  private async releaseAllLocks(): Promise<void> {
    for (const key of this.locks.keys()) {
      await this.releaseLock(key);
    }
  }

  /**
   * Get least loaded node
   */
  getLeastLoadedNode(): NodeInfo | null {
    const activeNodes = Array.from(this.clusterState.nodes.values()).filter(
      (n) => n.status === 'active'
    );

    if (activeNodes.length === 0) {
      return null;
    }

    return activeNodes.reduce((min, node) => (node.load < min.load ? node : min));
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): NodeInfo | undefined {
    return this.clusterState.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): NodeInfo[] {
    return Array.from(this.clusterState.nodes.values());
  }

  /**
   * Get cluster state
   */
  getClusterState(): ClusterState {
    return this.clusterState;
  }

  /**
   * Check if this node is the leader
   */
  isNodeLeader(): boolean {
    return this.isLeader;
  }

  /**
   * Get current leader
   */
  getLeader(): NodeInfo | null {
    if (!this.clusterState.leader) {
      return null;
    }

    return this.clusterState.nodes.get(this.clusterState.leader) || null;
  }

  /**
   * Update node load
   */
  updateNodeLoad(load: number): void {
    const node = this.clusterState.nodes.get(this.nodeId);
    if (node) {
      node.load = load;
    }
  }

  /**
   * Update job counts
   */
  updateJobCounts(scheduled: number, running: number): void {
    const node = this.clusterState.nodes.get(this.nodeId);
    if (node) {
      node.scheduledJobs = scheduled;
      node.runningJobs = running;
      node.load = scheduled + running;
    }
  }

  /**
   * Register callback for leadership gained
   */
  onLeadershipGained(callback: () => void): void {
    this.onLeadershipGainedCallback = callback;
  }

  /**
   * Register callback for leadership lost
   */
  onLeadershipLost(callback: () => void): void {
    this.onLeadershipLostCallback = callback;
  }

  /**
   * Register callback for job assignment
   */
  onJobAssigned(callback: (jobId: string, nodeId: string) => void): void {
    this.onJobAssignedCallback = callback;
  }

  /**
   * Register callback for node joined
   */
  onNodeJoined(callback: (nodeId: string) => void): void {
    this.onNodeJoinedCallback = callback;
  }

  /**
   * Register callback for node left
   */
  onNodeLeft(callback: (nodeId: string) => void): void {
    this.onNodeLeftCallback = callback;
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[DistributedCoordinator] DEBUG: ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[DistributedCoordinator] INFO: ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[DistributedCoordinator] WARN: ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[DistributedCoordinator] ERROR: ${message}`, ...args);
      }
    };
  }
}
