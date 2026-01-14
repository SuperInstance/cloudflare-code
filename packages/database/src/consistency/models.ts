/**
 * Consistency Models
 *
 * Implements various consistency models for distributed databases
 */

import type {
  ConsistencyConfig,
  ReadOperation,
  WriteOperation,
  ReadResult,
  WriteResult,
  VectorClock,
  SessionState,
  ConsistencyViolation,
} from './types';
import { QuorumConsistency } from './quorum';

export class ConsistencyManager {
  private config: ConsistencyConfig;
  private quorum: QuorumConsistency;
  private vectorClocks: Map<string, VectorClock>;
  private sessions: Map<string, SessionState>;
  private writeLog: Array<{ key: string; version: number; timestamp: Date }>;

  constructor(config: ConsistencyConfig, regions: string[]) {
    this.config = config;
    this.quorum = new QuorumConsistency(config, regions);
    this.vectorClocks = new Map();
    this.sessions = new Map();
    this.writeLog = [];
  }

  /**
   * Read with specified consistency model
   */
  async read<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    switch (operation.consistency) {
      case 'strong':
        return await this.strongRead(operation, executeRead);

      case 'eventual':
        return await this.eventualRead(operation, executeRead);

      case 'causal':
        return await this.causalRead(operation, executeRead);

      case 'read-your-writes':
        return await this.readYourWritesRead(operation, executeRead);

      case 'quorum':
        return await this.quorumRead(operation, executeRead);

      case 'session':
        return await this.sessionRead(operation, executeRead);

      case 'monotonic':
        return await this.monotonicRead(operation, executeRead);

      default:
        throw new Error(`Unknown consistency model: ${operation.consistency}`);
    }
  }

  /**
   * Write with specified consistency model
   */
  async write(
    operation: WriteOperation,
    executeWrite: (region: string) => Promise<{ success: boolean; version: number }>
  ): Promise<WriteResult> {
    switch (operation.consistency) {
      case 'strong':
      case 'causal':
      case 'read-your-writes':
      case 'quorum':
        return await this.quorum.write(operation, executeWrite);

      case 'eventual':
        return await this.eventualWrite(operation, executeWrite);

      case 'session':
        return await this.sessionWrite(operation, executeWrite);

      case 'monotonic':
        return await this.monotonicWrite(operation, executeWrite);

      default:
        throw new Error(`Unknown consistency model: ${operation.consistency}`);
    }
  }

  /**
   * Strong consistency: read from primary
   */
  private async strongRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    // Read from primary region (first available)
    const result = await executeRead('primary');

    return {
      data: result.data,
      version: result.version,
      timestamp: new Date(),
      stale: false,
      fromRegion: 'primary',
      consistency: 'strong',
    };
  }

  /**
   * Eventual consistency: read from any replica
   */
  private async eventualRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    // Read from nearest available replica
    const result = await executeRead('nearest');

    // Check staleness
    const latestVersion = this.getLatestVersion(operation.id);
    const stale = result.version < latestVersion;

    return {
      data: result.data,
      version: result.version,
      timestamp: new Date(),
      stale,
      fromRegion: 'nearest',
      consistency: 'eventual',
    };
  }

  /**
   * Causal consistency: respect causal dependencies
   */
  private async causalRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    if (!operation.vectorClock) {
      // No causal context, read any available
      return await this.eventualRead(operation, executeRead);
    }

    // Find region with data that satisfies causal dependencies
    const result = await this.findCausalRegion(operation, executeRead);

    return {
      data: result.data,
      version: result.version,
      timestamp: new Date(),
      stale: false,
      fromRegion: result.region,
      consistency: 'causal',
    };
  }

  /**
   * Read-your-writes consistency
   */
  private async readYourWritesRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    if (!operation.sessionId) {
      return await this.strongRead(operation, executeRead);
    }

    const session = this.sessions.get(operation.sessionId);
    if (!session) {
      return await this.strongRead(operation, executeRead);
    }

    // Read from region with latest writes for this session
    const result = await executeRead('primary');

    return {
      data: result.data,
      version: result.version,
      timestamp: new Date(),
      stale: false,
      fromRegion: 'primary',
      consistency: 'read-your-writes',
    };
  }

  /**
   * Quorum consistency
   */
  private async quorumRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    return await this.quorum.read(operation, executeRead);
  }

  /**
   * Session consistency
   */
  private async sessionRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    if (!operation.sessionId) {
      return await this.eventualRead(operation, executeRead);
    }

    const session = this.sessions.get(operation.sessionId);
    if (!session) {
      return await this.eventualRead(operation, executeRead);
    }

    // Ensure monotonic reads within session
    const result = await executeRead('primary');

    // Check if version is >= last read version
    const isMonotonic = !session.readVersions.has(String(result.version)) ||
      result.version >= Math.max(...Array.from(session.readVersions).map(Number));

    return {
      data: result.data,
      version: result.version,
      timestamp: new Date(),
      stale: !isMonotonic,
      fromRegion: 'primary',
      consistency: 'session',
    };
  }

  /**
   * Monotonic reads
   */
  private async monotonicRead<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<ReadResult<T>> {
    // Find region with latest version seen by this client
    const lastVersion = this.getLastReadVersion(operation.sessionId);

    const result = await executeRead('nearest');

    const stale = lastVersion !== null && result.version < lastVersion;

    return {
      data: result.data,
      version: result.version,
      timestamp: new Date(),
      stale,
      fromRegion: 'nearest',
      consistency: 'monotonic',
    };
  }

  /**
   * Eventual write (async replication)
   */
  private async eventualWrite(
    operation: WriteOperation,
    executeWrite: (region: string) => Promise<{ success: boolean; version: number }>
  ): Promise<WriteResult> {
    const startTime = Date.now();

    // Write to primary
    const result = await executeWrite('primary');

    // Update vector clock
    this.updateVectorClock(operation.id);

    // Log write for read-your-writes
    this.writeLog.push({
      key: operation.id,
      version: result.version,
      timestamp: operation.timestamp,
    });

    // Update session if present
    if (operation.sessionId) {
      this.updateSession(operation.sessionId, result.version);
    }

    return {
      success: result.success,
      version: result.version,
      replicatedTo: ['primary'],
      latency: Date.now() - startTime,
    };
  }

  /**
   * Session write
   */
  private async sessionWrite(
    operation: WriteOperation,
    executeWrite: (region: string) => Promise<{ success: boolean; version: number }>
  ): Promise<WriteResult> {
    const result = await this.eventualWrite(operation, executeWrite);

    if (operation.sessionId) {
      const session = this.sessions.get(operation.sessionId);
      if (session) {
        session.lastWriteTime = new Date();
        session.writtenVersions.add(String(result.version));
      }
    }

    return result;
  }

  /**
   * Monotonic write
   */
  private async monotonicWrite(
    operation: WriteOperation,
    executeWrite: (region: string) => Promise<{ success: boolean; version: number }>
  ): Promise<WriteResult> {
    // Ensure writes go to same region in order
    return await this.eventualWrite(operation, executeWrite);
  }

  /**
   * Find region satisfying causal dependencies
   */
  private async findCausalRegion<T>(
    operation: ReadOperation,
    executeRead: (region: string) => Promise<{ data: T; version: number }>
  ): Promise<{ data: T; version: number; region: string }> {
    // Check vector clock dependencies
    const requiredClock = operation.vectorClock!;

    // Try primary first
    try {
      const result = await executeRead('primary');
      const currentClock = this.vectorClocks.get(operation.id);

      if (this.clockSatisfies(currentClock, requiredClock)) {
        return { ...result, region: 'primary' };
      }
    } catch (error) {
      // Continue to other regions
    }

    // Try other regions
    const result = await executeRead('nearest');
    return { ...result, region: 'nearest' };
  }

  /**
   * Check if vector clock satisfies requirements
   */
  private clockSatisfies(
    current: VectorClock | undefined,
    required: Map<string, number>
  ): boolean {
    if (!current) return false;

    for (const [key, value] of required) {
      const currentValue = current.clock.get(key) || 0;
      if (currentValue < value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update vector clock for key
   */
  private updateVectorClock(key: string): void {
    let clock = this.vectorClocks.get(key);

    if (!clock) {
      clock = {
        clock: new Map(),
        timestamp: Date.now(),
      };
      this.vectorClocks.set(key, clock);
    }

    // Increment local counter
    const local = clock.clock.get('local') || 0;
    clock.clock.set('local', local + 1);
    clock.timestamp = Date.now();
  }

  /**
   * Get latest version for key
   */
  private getLatestVersion(key: string): number {
    const latest = this.writeLog
      .filter((log) => log.key === key)
      .sort((a, b) => b.version - a.version)[0];

    return latest?.version || 0;
  }

  /**
   * Get last read version for session
   */
  private getLastReadVersion(sessionId: string | undefined): number | null {
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session || session.readVersions.size === 0) return null;

    return Math.max(...Array.from(session.readVersions).map(Number));
  }

  /**
   * Update session state
   */
  private updateSession(sessionId: string, version: number): void {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        lastWriteTime: new Date(),
        lastReadTime: new Date(),
        writtenVersions: new Set(),
        readVersions: new Set(),
      };
      this.sessions.set(sessionId, session);
    }

    session.lastWriteTime = new Date();
    session.writtenVersions.add(String(version));
  }

  /**
   * Create or get session
   */
  getSession(sessionId: string): SessionState {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        lastWriteTime: new Date(),
        lastReadTime: new Date(),
        writtenVersions: new Set(),
        readVersions: new Set(),
      };
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Validate consistency of operations
   */
  validateConsistency(): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];

    // Check for stale reads
    for (const [key, clock] of this.vectorClocks) {
      const latestVersion = this.getLatestVersion(key);
      // Validation logic here
    }

    return violations;
  }

  /**
   * Get consistency statistics
   */
  getStats(): {
    activeSessions: number;
    trackedKeys: number;
    writeLogSize: number;
  } {
    return {
      activeSessions: this.sessions.size,
      trackedKeys: this.vectorClocks.size,
      writeLogSize: this.writeLog.length,
    };
  }
}
