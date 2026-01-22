/**
 * Quorum-Based Consistency
 *
 * Implements quorum reads and writes for distributed consensus
 */

import type {
  ConsistencyConfig,
  ReadOperation,
  WriteOperation,
  QuorumResult,
  ReadResult,
  WriteResult,
} from './types';

interface QuorumVote<T> {
  region: string;
  data: T;
  version: number;
  timestamp: Date;
  received: boolean;
}

export class QuorumConsistency {
  private config: ConsistencyConfig;
  private regions: Map<string, { endpoint: string; available: boolean }>;
  private dataVersions: Map<string, number>;

  constructor(config: ConsistencyConfig, regions: string[]) {
    this.config = config;
    this.regions = new Map();
    this.dataVersions = new Map();

    for (const region of regions) {
      this.regions.set(region, { endpoint: region, available: true });
    }
  }

  /**
   * Execute quorum read
   */
  async read<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    const votes: QuorumVote<T>[] = [];
    const requiredVotes = this.config.readQuorum || this.calculateQuorum();

    // Read from all available regions
    const readPromises = Array.from(this.regions.entries())
      .filter(([_, info]) => info.available)
      .map(async ([region, _]) => {
        try {
          const result = await Promise.race([
            executeRead(region),
            this.timeout<T>(this.config.timeout),
          ]);

          return {
            region,
            data: result.data,
            version: result.version,
            timestamp: new Date(),
            received: true,
          } as QuorumVote<T>;
        } catch (error) {
          return {
            region,
            data: null as unknown as T,
            version: -1,
            timestamp: new Date(),
            received: false,
          } as QuorumVote<T>;
        }
      });

    const results = await Promise.all(readPromises);
    votes.push(...results);

    // Filter successful reads
    const successfulVotes = votes.filter((v) => v.received);

    if (successfulVotes.length < requiredVotes) {
      throw new Error(
        `Quorum not reached: ${successfulVotes.length}/${requiredVotes} reads succeeded`
      );
    }

    // Find most recent version
    const latest = this.findLatestVersion(successfulVotes);

    return {
      data: latest.data,
      version: latest.version,
      timestamp: latest.timestamp,
      stale: this.isStale(latest.version, successfulVotes),
      fromRegion: latest.region,
      consistency: operation.consistency,
    };
  }

  /**
   * Execute quorum write
   */
  async write(
    operation: WriteOperation,
    executeWrite: (region: string) => Promise<{ success: boolean; version: number }>
  ): Promise<WriteResult> {
    const requiredVotes = this.config.writeQuorum || this.calculateQuorum();
    const startTime = Date.now();

    // Write to all available regions
    const writePromises = Array.from(this.regions.entries())
      .filter(([_, info]) => info.available)
      .map(async ([region, _]) => {
        try {
          const result = await Promise.race([
            executeWrite(region),
            this.timeout<{ success: boolean; version: number }>(this.config.timeout),
          ]);

          if (result.success) {
            return { region, success: true, version: result.version };
          }
          return { region, success: false, version: -1 };
        } catch (error) {
          return { region, success: false, version: -1 };
        }
      });

    const results = await Promise.all(writePromises);
    const successfulWrites = results.filter((r) => r.success);

    if (successfulWrites.length < requiredVotes) {
      throw new Error(
        `Write quorum not reached: ${successfulWrites.length}/${requiredVotes} writes succeeded`
      );
    }

    // Update version
    const newVersion = this.getNextVersion(operation.id);

    return {
      success: true,
      version: newVersion,
      replicatedTo: successfulWrites.map((w) => w.region),
      latency: Date.now() - startTime,
    };
  }

  /**
   * Read with quorum validation
   */
  async readWithValidation<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<QuorumResult<T>> {
    const votes: QuorumVote<T>[] = [];
    const requiredVotes = this.config.readQuorum || this.calculateQuorum();

    const readPromises = Array.from(this.regions.entries())
      .filter(([_, info]) => info.available)
      .map(async ([region, _]) => {
        try {
          const result = await executeRead(region);
          return {
            region,
            data: result.data,
            version: result.version,
            timestamp: new Date(),
            received: true,
          } as QuorumVote<T>;
        } catch (error) {
          return {
            region,
            data: null as unknown as T,
            version: -1,
            timestamp: new Date(),
            received: false,
          } as QuorumVote<T>;
        }
      });

    const results = await Promise.all(readPromises);
    votes.push(...results);

    const successfulVotes = votes.filter((v) => v.received);
    const consensus = this.checkConsensus(successfulVotes);

    const latest = this.findLatestVersion(successfulVotes);

    return {
      consensus,
      data: consensus ? latest.data : null,
      votes: successfulVotes.length,
      required: requiredVotes,
      responses: successfulVotes.map((v) => ({
        region: v.region,
        data: v.data,
        version: v.version,
      })),
    };
  }

  /**
   * Calculate quorum size (majority)
   */
  private calculateQuorum(): number {
    const availableRegions = Array.from(this.regions.values()).filter((r) => r.available).length;
    return Math.floor(availableRegions / 2) + 1;
  }

  /**
   * Find latest version among votes
   */
  private findLatestVersion<T>(votes: QuorumVote<T>[]): QuorumVote<T> {
    let latest = votes[0];

    for (const vote of votes) {
      if (vote.version > latest.version) {
        latest = vote;
      } else if (vote.version === latest.version) {
        // Tie-breaker: use timestamp
        if (vote.timestamp > latest.timestamp) {
          latest = vote;
        }
      }
    }

    return latest;
  }

  /**
   * Check if read is stale
   */
  private isStale<T>(version: number, votes: QuorumVote<T>[]): boolean {
    for (const vote of votes) {
      if (vote.version > version) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if there's consensus among votes
   */
  private checkConsensus<T>(votes: QuorumVote<T>[]): boolean {
    if (votes.length === 0) return false;

    const firstVersion = votes[0].version;

    // All votes should have the same version for strong consistency
    return votes.every((v) => v.version === firstVersion);
  }

  /**
   * Get next version number
   */
  private getNextVersion(key: string): number {
    const current = this.dataVersions.get(key) || 0;
    this.dataVersions.set(key, current + 1);
    return current + 1;
  }

  /**
   * Timeout promise
   */
  private timeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }

  /**
   * Update region availability
   */
  setRegionAvailable(region: string, available: boolean): void {
    const info = this.regions.get(region);
    if (info) {
      info.available = available;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ConsistencyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConsistencyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
