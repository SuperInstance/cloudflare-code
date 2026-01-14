/**
 * Distributed Rate Limiter with Multi-Node Coordination
 *
 * This module provides distributed rate limiting with leader election,
 * state synchronization, and failover handling.
 */

import type {
  RateLimitResult,
  RateLimitConfig,
  RateLimitContext,
  DistributedConfig,
  NodeInfo,
  SyncMessage,
  StateSnapshot,
  RateLimitState
} from '../types/index.js';
import { AlgorithmEngine } from '../algorithms/engine.js';
import type { StorageBackend } from '../storage/index.js';

/**
 * Distributed limiter configuration
 */
export interface DistributedLimiterConfig {
  config: RateLimitConfig;
  distributed: DistributedConfig;
  storage: StorageBackend;
  nodeId: string;
  nodeAddress?: string;
  nodePort?: number;
}

/**
 * Distributed rate limiter class
 */
export class DistributedRateLimiter {
  private config: RateLimitConfig;
  private distributed: DistributedConfig;
  private storage: StorageBackend;
  private algorithmEngine: AlgorithmEngine;
  private nodeInfo: NodeInfo;
  private nodes: Map<string, NodeInfo>;
  private leader: string | null;
  private electionTimer: NodeJS.Timeout | null;
  private heartbeatTimer: NodeJS.Timeout | null;
  private syncTimer: NodeJS.Timeout | null;
  private stateVersion: number;
  private localState: Map<string, RateLimitState>;
  private isRunning: boolean;

  constructor(config: DistributedLimiterConfig) {
    this.config = config.config;
    this.distributed = config.distributed;
    this.storage = config.storage;
    this.algorithmEngine = new AlgorithmEngine();

    // Node information
    this.nodeInfo = {
      id: config.nodeId,
      address: config.nodeAddress || 'localhost',
      port: config.nodePort || 8080,
      lastSeen: Date.now(),
      isLeader: false,
      role: 'follower'
    };

    this.nodes = new Map();
    this.nodes.set(this.nodeInfo.id, this.nodeInfo);

    this.leader = null;
    this.electionTimer = null;
    this.heartbeatTimer = null;
    this.syncTimer = null;

    this.stateVersion = 0;
    this.localState = new Map();
    this.isRunning = false;
  }

  /**
   * Start distributed limiter
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start leader election if enabled
    if (this.distributed.leaderElection) {
      await this.startLeaderElection();
    }

    // Start heartbeat timer
    this.startHeartbeat();

    // Start state synchronization
    if (this.distributed.enabled) {
      this.startStateSync();
    }
  }

  /**
   * Stop distributed limiter
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Check rate limit with distributed coordination
   */
  async check(context: RateLimitContext): Promise<RateLimitResult> {
    // Get key for this request
    const key = this.getKey(context);

    // Try local cache first
    const localCachedState = this.localState.get(key);

    // Get state from storage
    const state = await this.storage.get(key);

    // Check rate limit
    const result = await this.algorithmEngine.check(
      this.config,
      state || localCachedState || null,
      context
    );

    // Update state if allowed
    if (result.allowed && state) {
      await this.storage.set(key, state);
    } else if (result.allowed && !state) {
      const newState = this.algorithmEngine.reset(this.config);
      await this.storage.set(key, newState);
    }

    // Update local cache
    this.localState.set(key, state || this.algorithmEngine.reset(this.config));

    // Sync with other nodes if configured
    if (this.distributed.enabled && this.distributed.syncStrategy === 'strong') {
      await this.syncState(key, state || this.algorithmEngine.reset(this.config));
    }

    return result;
  }

  /**
   * Start leader election
   */
  private async startLeaderElection(): Promise<void> {
    // Check if there's a current leader
    const currentLeader = await this.getCurrentLeader();

    if (!currentLeader) {
      // No leader, start election
      await this.initiateElection();
    } else {
      // Leader exists, become follower
      this.leader = currentLeader;
      this.nodeInfo.role = 'follower';
      this.nodeInfo.isLeader = false;
    }
  }

  /**
   * Initiate leader election
   */
  private async initiateElection(): Promise<void> {
    // Set role to candidate
    this.nodeInfo.role = 'candidate';

    // Increment term and vote for self
    this.stateVersion++;

    // Request votes from other nodes
    const votes = await this.requestVotes();

    // Check if we won the election
    if (votes >= Math.ceil(this.nodes.size / 2)) {
      // Become leader
      this.becomeLeader();
    } else {
      // Lost election, become follower
      this.nodeInfo.role = 'follower';
      this.nodeInfo.isLeader = false;
    }
  }

  /**
   * Request votes from other nodes
   */
  private async requestVotes(): Promise<number> {
    let votes = 1; // Vote for self

    for (const [nodeId, node] of this.nodes.entries()) {
      if (nodeId === this.nodeInfo.id) {
        continue;
      }

      try {
        const granted = await this.sendVoteRequest(node);
        if (granted) {
          votes++;
        }
      } catch (error) {
        console.error(`Failed to request vote from ${nodeId}:`, error);
      }
    }

    return votes;
  }

  /**
   * Send vote request to a node
   */
  private async sendVoteRequest(node: NodeInfo): Promise<boolean> {
    // In a real implementation, this would make an HTTP request
    // For now, we'll simulate it
    return Math.random() > 0.5;
  }

  /**
   * Become leader
   */
  private becomeLeader(): void {
    this.leader = this.nodeInfo.id;
    this.nodeInfo.role = 'leader';
    this.nodeInfo.isLeader = true;

    // Announce leadership to other nodes
    this.announceLeadership();
  }

  /**
   * Announce leadership to other nodes
   */
  private async announceLeadership(): Promise<void> {
    const message: SyncMessage = {
      type: 'election',
      nodeId: this.nodeInfo.id,
      timestamp: Date.now(),
      payload: {
        leader: this.nodeInfo.id,
        term: this.stateVersion
      }
    };

    await this.broadcastMessage(message);
  }

  /**
   * Get current leader
   */
  private async getCurrentLeader(): Promise<string | null> {
    // Check storage for current leader
    const leaderState = await this.storage.get('__leader__');

    if (leaderState && leaderState.metadata?.leaderId) {
      const leaderId = leaderState.metadata.leaderId as string;
      const leaderNode = this.nodes.get(leaderId);

      // Check if leader is still alive
      if (leaderNode && Date.now() - leaderNode.lastSeen < this.distributed.failureTimeout!) {
        return leaderId;
      }
    }

    return null;
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    const interval = this.distributed.heartbeatInterval || 5000;

    this.heartbeatTimer = setInterval(async () => {
      if (this.nodeInfo.isLeader) {
        // Send heartbeat as leader
        await this.sendHeartbeat();
      } else {
        // Update leader timestamp
        await this.updateLeaderTimestamp();
      }
    }, interval);
  }

  /**
   * Send heartbeat from leader
   */
  private async sendHeartbeat(): Promise<void> {
    const message: SyncMessage = {
      type: 'heartbeat',
      nodeId: this.nodeInfo.id,
      timestamp: Date.now(),
      payload: {
        term: this.stateVersion
      }
    };

    await this.broadcastMessage(message);
  }

  /**
   * Update leader timestamp (for followers)
   */
  private async updateLeaderTimestamp(): Promise<void> {
    if (this.leader) {
      const leaderNode = this.nodes.get(this.leader);
      if (leaderNode) {
        leaderNode.lastSeen = Date.now();
      }
    }
  }

  /**
   * Start state synchronization
   */
  private startStateSync(): void {
    const interval = this.distributed.syncInterval || 10000;

    this.syncTimer = setInterval(async () => {
      if (this.nodeInfo.isLeader) {
        await this.syncStateToFollowers();
      }
    }, interval);
  }

  /**
   * Sync state to followers
   */
  private async syncStateToFollowers(): Promise<void> {
    const snapshot = this.createSnapshot();

    const message: SyncMessage = {
      type: 'state_sync',
      nodeId: this.nodeInfo.id,
      timestamp: Date.now(),
      payload: snapshot
    };

    await this.broadcastMessage(message);
  }

  /**
   * Sync specific key state
   */
  private async syncState(key: string, state: RateLimitState): Promise<void> {
    if (!this.nodeInfo.isLeader) {
      return;
    }

    const message: SyncMessage = {
      type: 'state_sync',
      nodeId: this.nodeInfo.id,
      timestamp: Date.now(),
      payload: {
        key,
        state
      }
    };

    await this.broadcastMessage(message);
  }

  /**
   * Create state snapshot
   */
  private createSnapshot(): StateSnapshot {
    return {
      version: this.stateVersion,
      timestamp: Date.now(),
      nodeId: this.nodeInfo.id,
      state: new Map(Array.from(this.localState.entries()))
    };
  }

  /**
   * Broadcast message to all nodes
   */
  private async broadcastMessage(message: SyncMessage): Promise<void> {
    for (const [nodeId, node] of this.nodes.entries()) {
      if (nodeId === this.nodeInfo.id) {
        continue;
      }

      try {
        await this.sendMessage(node, message);
      } catch (error) {
        console.error(`Failed to send message to ${nodeId}:`, error);
      }
    }
  }

  /**
   * Send message to a specific node
   */
  private async sendMessage(node: NodeInfo, message: SyncMessage): Promise<void> {
    // In a real implementation, this would make an HTTP request
    // For now, we'll simulate it
    console.log(`Sending message to ${node.id}:`, message);
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message: SyncMessage): Promise<void> {
    switch (message.type) {
      case 'heartbeat':
        await this.handleHeartbeat(message);
        break;

      case 'election':
        await this.handleElection(message);
        break;

      case 'state_sync':
        await this.handleStateSync(message);
        break;

      case 'handoff':
        await this.handleHandoff(message);
        break;
    }
  }

  /**
   * Handle heartbeat message
   */
  private async handleHeartbeat(message: SyncMessage): Promise<void> {
    const node = this.nodes.get(message.nodeId);

    if (node) {
      node.lastSeen = message.timestamp;
    }
  }

  /**
   * Handle election message
   */
  private async handleElection(message: SyncMessage): Promise<void> {
    const payload = message.payload as { leader: string; term: number };

    if (payload.term > this.stateVersion) {
      this.stateVersion = payload.term;
      this.leader = payload.leader;
      this.nodeInfo.role = 'follower';
      this.nodeInfo.isLeader = false;
    }
  }

  /**
   * Handle state sync message
   */
  private async handleStateSync(message: SyncMessage): Promise<void> {
    const payload = message.payload as StateSnapshot;

    if (payload.version > this.stateVersion) {
      this.stateVersion = payload.version;

      // Update local state
      for (const [key, state] of Object.entries(payload.state)) {
        this.localState.set(key, state as RateLimitState);
      }
    }
  }

  /**
   * Handle handoff message
   */
  private async handleHandoff(message: SyncMessage): Promise<void> {
    // Leader handoff to another node
    const payload = message.payload as { newLeader: string };

    this.leader = payload.newLeader;
    this.nodeInfo.role = 'follower';
    this.nodeInfo.isLeader = false;
  }

  /**
   * Add node to cluster
   */
  addNode(node: NodeInfo): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Remove node from cluster
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);

    // If leader was removed, start new election
    if (this.leader === nodeId && this.distributed.leaderElection) {
      this.leader = null;
      this.initiateElection();
    }
  }

  /**
   * Get key for context
   */
  private getKey(context: RateLimitContext): string {
    return `${context.identifier}:${context.endpoint || 'default'}`;
  }

  /**
   * Get cluster status
   */
  getStatus(): {
    nodeId: string;
    role: string;
    leader: string | null;
    nodes: number;
    version: number;
  } {
    return {
      nodeId: this.nodeInfo.id,
      role: this.nodeInfo.role,
      leader: this.leader,
      nodes: this.nodes.size,
      version: this.stateVersion
    };
  }

  /**
   * Get all nodes
   */
  getNodes(): NodeInfo[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Check if node is leader
   */
  isLeader(): boolean {
    return this.nodeInfo.isLeader;
  }

  /**
   * Step down as leader
   */
  async stepDown(): Promise<void> {
    if (!this.nodeInfo.isLeader) {
      return;
    }

    this.nodeInfo.role = 'follower';
    this.nodeInfo.isLeader = false;
    this.leader = null;

    // Trigger new election
    if (this.distributed.leaderElection) {
      await this.initiateElection();
    }
  }
}
