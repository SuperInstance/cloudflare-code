/**
 * Leader Election
 *
 * Implements distributed leader election using Raft-like consensus
 */

import type { NodeInfo, FailoverConfig, ElectionResult, FailoverEvent } from './types';

export class LeaderElection {
  private config: FailoverConfig;
  private nodes: Map<string, NodeInfo>;
  private currentLeader: string | null;
  private currentTerm: number;
  private votedFor: string | null;
  private votesReceived: Set<string>;
  private electionTimer: NodeJS.Timeout | null;
  private eventLog: FailoverEvent[];

  constructor(config: FailoverConfig, nodes: NodeInfo[]) {
    this.config = config;
    this.nodes = new Map();
    this.currentLeader = null;
    this.currentTerm = 0;
    this.votedFor = null;
    this.votesReceived = new Set();
    this.electionTimer = null;
    this.eventLog = [];

    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }

    // Find initial leader
    this.findInitialLeader();
  }

  private findInitialLeader(): void {
    // Find highest priority primary node
    let bestNode: NodeInfo | null = null;

    for (const node of this.nodes.values()) {
      if (node.role === 'primary' && node.status === 'healthy') {
        if (!bestNode || node.priority > bestNode.priority) {
          bestNode = node;
        }
      }
    }

    if (bestNode) {
      this.currentLeader = bestNode.id;
    }
  }

  /**
   * Start election process
   */
  async startElection(candidateId: string): Promise<ElectionResult> {
    this.currentTerm++;
    this.votedFor = candidateId;
    this.votesReceived.clear();
    this.votesReceived.add(candidateId);

    const event: FailoverEvent = {
      id: `election-${Date.now()}`,
      type: 'election',
      nodeId: candidateId,
      timestamp: new Date(),
      reason: 'Leader election initiated',
      actions: ['Request votes', 'Count votes', 'Announce winner'],
      completed: false,
    };
    this.eventLog.push(event);

    // Request votes from other nodes
    const votes = await this.requestVotes(candidateId, this.currentTerm);

    // Count votes
    const majority = Math.floor(this.nodes.size / 2) + 1;
    const voteCount = votes.filter((v) => v).length;

    if (voteCount >= majority) {
      this.currentLeader = candidateId;
      event.completed = true;

      return {
        leaderId: candidateId,
        term: this.currentTerm,
        votes: new Map(Array.from(this.nodes.keys()).map((id, i) => [id, votes[i]])),
        timestamp: new Date(),
      };
    }

    // No majority, election failed
    throw new Error(`Election failed: ${voteCount}/${majority} votes received`);
  }

  /**
   * Request votes from all nodes
   */
  private async requestVotes(candidateId: string, term: number): Promise<boolean[]> {
    const promises = Array.from(this.nodes.entries())
      .filter(([id]) => id !== candidateId)
      .map(async ([nodeId, node]) => {
        try {
          // Simulate vote request
          await this.delay(node.status === 'healthy' ? 10 : 100);

          // Grant vote if:
          // 1. Node hasn't voted this term
          // 2. Candidate's log is at least as up-to-date
          const willVote = this.shouldGrantVote(nodeId, candidateId, term);

          if (willVote) {
            this.votesReceived.add(nodeId);
          }

          return willVote;
        } catch (error) {
          return false;
        }
      });

    return Promise.all(promises);
  }

  /**
   * Determine if node should grant vote
   */
  private shouldGrantVote(nodeId: string, candidateId: string, term: number): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || node.status !== 'healthy') {
      return false;
    }

    // In real implementation, would check log consistency
    return true;
  }

  /**
   * Check if leader is healthy
   */
  async checkLeaderHealth(): Promise<boolean> {
    if (!this.currentLeader) {
      return false;
    }

    const leader = this.nodes.get(this.currentLeader);
    if (!leader) {
      return false;
    }

    // Check last heartbeat
    const timeSinceHeartbeat = Date.now() - leader.lastHeartbeat.getTime();
    const heartbeatMissed = timeSinceHeartbeat > this.config.heartbeatInterval * 2;

    return !heartbeatMissed && leader.status === 'healthy';
  }

  /**
   * Trigger failover if leader is unhealthy
   */
  async triggerFailover(): Promise<ElectionResult | null> {
    if (!this.config.automaticFailover) {
      return null;
    }

    // Check if current leader is healthy
    const leaderHealthy = await this.checkLeaderHealth();

    if (leaderHealthy) {
      return null;
    }

    // Find best candidate
    const candidate = this.selectCandidate();

    if (!candidate) {
      throw new Error('No eligible candidates for leadership');
    }

    // Start election
    return await this.startElection(candidate.id);
  }

  /**
   * Select best candidate for leader
   */
  private selectCandidate(): NodeInfo | null {
    let bestCandidate: NodeInfo | null = null;
    let highestPriority = -1;

    for (const node of this.nodes.values()) {
      if (node.status === 'healthy' && node.role !== 'arbiter') {
        if (node.priority > highestPriority) {
          highestPriority = node.priority;
          bestCandidate = node;
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Get current leader
   */
  getLeader(): string | null {
    return this.currentLeader;
  }

  /**
   * Get current term
   */
  getTerm(): number {
    return this.currentTerm;
  }

  /**
   * Update node status
   */
  updateNodeStatus(nodeId: string, status: NodeInfo['status'], lastHeartbeat: Date): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      node.lastHeartbeat = lastHeartbeat;
    }
  }

  /**
   * Add a node to the cluster
   */
  addNode(node: NodeInfo): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Remove a node from the cluster
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);

    // If removed node was leader, trigger election
    if (this.currentLeader === nodeId) {
      this.currentLeader = null;
    }
  }

  /**
   * Step down as leader
   */
  stepDown(): void {
    this.currentLeader = null;
    this.votedFor = null;
    this.votesReceived.clear();
  }

  /**
   * Get election events
   */
  getEvents(): FailoverEvent[] {
    return [...this.eventLog];
  }

  /**
   * Clear event log
   */
  clearEvents(): void {
    this.eventLog = [];
  }

  /**
   * Get cluster state
   */
  getState(): {
    leader: string | null;
    term: number;
    nodes: number;
    healthyNodes: number;
  } {
    const healthyNodes = Array.from(this.nodes.values()).filter(
      (n) => n.status === 'healthy'
    ).length;

    return {
      leader: this.currentLeader,
      term: this.currentTerm,
      nodes: this.nodes.size,
      healthyNodes,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
