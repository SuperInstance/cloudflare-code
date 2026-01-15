/**
 * Unified Performance Profiler
 * Orchestrates CPU, Memory, I/O, Network, and Lock profiling
 */

import { EventEmitter } from 'eventemitter3';
import { CPUProfiler } from './cpu-profiler';
import { MemoryProfiler } from './memory-profiler';
import {
  ProfileSession,
  ProfileType,
  ProfilingOptions,
  IOProfileSample,
  NetworkProfileSample,
  LockProfileSample,
  PerformanceMonitoringConfig
} from '../types';

export class PerformanceProfiler {
  private cpuProfiler: CPUProfiler;
  private memoryProfiler: MemoryProfiler;
  private eventEmitter: EventEmitter;
  private config: PerformanceMonitoringConfig['profiling'];
  private activeProfiles: Map<string, ProfileSession>;
  private ioHooks: Array<() => void>;
  private networkHooks: Array<() => void>;

  constructor(config: PerformanceMonitoringConfig['profiling'] = {
    enabled: true,
    defaultDuration: 30000,
    defaultInterval: 1000,
    maxConcurrentProfiles: 10,
    storage: {
      type: 'memory',
      retentionDays: 7
    }
  }) {
    this.config = config;
    this.cpuProfiler = new CPUProfiler();
    this.memoryProfiler = new MemoryProfiler();
    this.eventEmitter = new EventEmitter();
    this.activeProfiles = new Map();
    this.ioHooks = [];
    this.networkHooks = [];

    this.setupProfilerEventForwarding();
  }

  /**
   * Start profiling for a specific type
   */
  startProfiling(type: ProfileType, options?: ProfilingOptions): string {
    if (!this.config.enabled) {
      throw new Error('Profiling is disabled');
    }

    if (this.activeProfiles.size >= this.config.maxConcurrentProfiles) {
      throw new Error('Maximum concurrent profiles reached');
    }

    let sessionId: string;

    switch (type) {
      case 'cpu':
        sessionId = this.cpuProfiler.start();
        break;
      case 'memory':
        sessionId = this.memoryProfiler.start();
        break;
      case 'io':
        sessionId = this.startIOProfiling(options);
        break;
      case 'network':
        sessionId = this.startNetworkProfiling(options);
        break;
      case 'lock':
        sessionId = this.startLockProfiling(options);
        break;
      default:
        throw new Error(`Unknown profile type: ${type}`);
    }

    this.eventEmitter.emit('profile:started', { sessionId, type });
    return sessionId;
  }

  /**
   * Stop profiling session
   */
  stopProfiling(sessionId: string): ProfileSession | null {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      return null;
    }

    switch (session.type) {
      case 'cpu':
        return this.cpuProfiler.stop(sessionId);
      case 'memory':
        return this.memoryProfiler.stop(sessionId);
      case 'io':
        return this.stopIOProfiling(sessionId);
      case 'network':
        return this.stopNetworkProfiling(sessionId);
      case 'lock':
        return this.stopLockProfiling(sessionId);
      default:
        return null;
    }
  }

  /**
   * Get profile session
   */
  getSession(sessionId: string): ProfileSession | undefined {
    return this.activeProfiles.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ProfileSession[] {
    return Array.from(this.activeProfiles.values());
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      return false;
    }

    // Cleanup type-specific resources
    switch (session.type) {
      case 'cpu':
        this.cpuProfiler.deleteSession(sessionId);
        break;
      case 'memory':
        this.memoryProfiler.deleteSession(sessionId);
        break;
    }

    this.activeProfiles.delete(sessionId);
    this.eventEmitter.emit('session:deleted', { sessionId });
    return true;
  }

  /**
   * Get CPU profiler
   */
  getCPUProfiler(): CPUProfiler {
    return this.cpuProfiler;
  }

  /**
   * Get memory profiler
   */
  getMemoryProfiler(): MemoryProfiler {
    return this.memoryProfiler;
  }

  /**
   * Start I/O profiling
   */
  private startIOProfiling(options?: ProfilingOptions): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: ProfileSession = {
      id: sessionId,
      type: 'io',
      startTime: now,
      status: 'running',
      samples: [],
      metadata: {
        interval: options?.interval || this.config.defaultInterval,
        duration: options?.duration || this.config.defaultDuration
      }
    };

    this.activeProfiles.set(sessionId, session);
    this.setupIOHooks(sessionId);

    return sessionId;
  }

  /**
   * Stop I/O profiling
   */
  private stopIOProfiling(sessionId: string): ProfileSession {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      throw new Error(`Profile session ${sessionId} not found`);
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    this.teardownIOHooks(sessionId);

    return session;
  }

  /**
   * Set up I/O hooks
   */
  private setupIOHooks(sessionId: string): void {
    const originalRead = require('fs').readFileSync;
    const originalWrite = require('fs').writeFileSync;
    const originalReadFile = require('fs').readFile;
    const originalWriteFile = require('fs').writeFile;

    const self = this;

    require('fs').readFileSync = function(...args: any[]) {
      const start = Date.now();
      try {
        const result = originalRead.apply(this, args);
        self.recordIOOperation(sessionId, 'read', args[0], result?.length || 0, Date.now() - start);
        return result;
      } catch (error) {
        self.recordIOOperation(sessionId, 'read', args[0], 0, Date.now() - start);
        throw error;
      }
    };

    require('fs').writeFileSync = function(...args: any[]) {
      const start = Date.now();
      try {
        const result = originalWrite.apply(this, args);
        self.recordIOOperation(sessionId, 'write', args[0], args[1]?.length || 0, Date.now() - start);
        return result;
      } catch (error) {
        self.recordIOOperation(sessionId, 'write', args[0], 0, Date.now() - start);
        throw error;
      }
    };

    this.ioHooks.push(() => {
      require('fs').readFileSync = originalRead;
      require('fs').writeFileSync = originalWrite;
      require('fs').readFile = originalReadFile;
      require('fs').writeFile = originalWriteFile;
    });
  }

  /**
   * Tear down I/O hooks
   */
  private teardownIOHooks(sessionId: string): void {
    const cleanup = this.ioHooks.pop();
    if (cleanup) {
      cleanup();
    }
  }

  /**
   * Record I/O operation
   */
  private recordIOOperation(
    sessionId: string,
    operation: 'read' | 'write',
    path: string,
    bytes: number,
    duration: number
  ): void {
    const session = this.activeProfiles.get(sessionId);
    if (!session || session.status !== 'running') {
      return;
    }

    const sample: IOProfileSample = {
      timestamp: Date.now(),
      data: {
        operation,
        path,
        bytes,
        duration
      }
    };

    session.samples.push(sample);
  }

  /**
   * Start network profiling
   */
  private startNetworkProfiling(options?: ProfilingOptions): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: ProfileSession = {
      id: sessionId,
      type: 'network',
      startTime: now,
      status: 'running',
      samples: [],
      metadata: {
        interval: options?.interval || this.config.defaultInterval,
        duration: options?.duration || this.config.defaultDuration
      }
    };

    this.activeProfiles.set(sessionId, session);
    this.setupNetworkHooks(sessionId);

    return sessionId;
  }

  /**
   * Stop network profiling
   */
  private stopNetworkProfiling(sessionId: string): ProfileSession {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      throw new Error(`Profile session ${sessionId} not found`);
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    this.teardownNetworkHooks(sessionId);

    return session;
  }

  /**
   * Set up network hooks
   */
  private setupNetworkHooks(sessionId: string): void {
    // Hook into fetch, http, https modules
    const originalFetch = global.fetch;
    const self = this;

    if (originalFetch) {
      global.fetch = async function(...args: any[]) {
        const start = Date.now();
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';

        try {
          const response = await originalFetch.apply(this, args);
          self.recordNetworkOperation(sessionId, 'fetch', url, response.status, Date.now() - start, 0, 0);
          return response;
        } catch (error) {
          self.recordNetworkOperation(sessionId, 'fetch', url, undefined, Date.now() - start, 0, 0);
          throw error;
        }
      };
    }

    this.networkHooks.push(() => {
      if (originalFetch) {
        global.fetch = originalFetch;
      }
    });
  }

  /**
   * Tear down network hooks
   */
  private teardownNetworkHooks(sessionId: string): void {
    const cleanup = this.networkHooks.pop();
    if (cleanup) {
      cleanup();
    }
  }

  /**
   * Record network operation
   */
  private recordNetworkOperation(
    sessionId: string,
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
    bytesSent?: number,
    bytesReceived?: number
  ): void {
    const session = this.activeProfiles.get(sessionId);
    if (!session || session.status !== 'running') {
      return;
    }

    const sample: NetworkProfileSample = {
      timestamp: Date.now(),
      data: {
        method,
        url,
        statusCode,
        duration: duration || 0,
        bytesSent: bytesSent || 0,
        bytesReceived: bytesReceived || 0
      }
    };

    session.samples.push(sample);
  }

  /**
   * Start lock profiling
   */
  private startLockProfiling(options?: ProfilingOptions): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: ProfileSession = {
      id: sessionId,
      type: 'lock',
      startTime: now,
      status: 'running',
      samples: [],
      metadata: {
        interval: options?.interval || this.config.defaultInterval,
        duration: options?.duration || this.config.defaultDuration
      }
    };

    this.activeProfiles.set(sessionId, session);

    // Lock profiling would require async_hooks or custom lock implementations
    // This is a placeholder for future implementation

    return sessionId;
  }

  /**
   * Stop lock profiling
   */
  private stopLockProfiling(sessionId: string): ProfileSession {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      throw new Error(`Profile session ${sessionId} not found`);
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    return session;
  }

  /**
   * Get profile statistics
   */
  getStatistics(sessionId: string): {
    duration: number;
    sampleCount: number;
    type: ProfileType;
    status: string;
  } | null {
    const session = this.activeProfiles.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      duration: session.duration || (Date.now() - session.startTime),
      sampleCount: session.samples.length,
      type: session.type,
      status: session.status
    };
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up event forwarding from profilers
   */
  private setupProfilerEventForwarding(): void {
    this.cpuProfiler.on('profile:started', (data) => {
      this.eventEmitter.emit('cpu:profile:started', data);
    });

    this.cpuProfiler.on('profile:stopped', (data) => {
      this.eventEmitter.emit('cpu:profile:stopped', data);
    });

    this.memoryProfiler.on('profile:started', (data) => {
      this.eventEmitter.emit('memory:profile:started', data);
    });

    this.memoryProfiler.on('profile:stopped', (data) => {
      this.eventEmitter.emit('memory:profile:stopped', data);
    });
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Clean up all sessions
   */
  cleanup(): void {
    this.cpuProfiler.cleanup();
    this.memoryProfiler.cleanup();

    for (const [sessionId, session] of this.activeProfiles) {
      if (session.status === 'running') {
        try {
          this.stopProfiling(sessionId);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    this.activeProfiles.clear();
  }

  /**
   * Destroy the profiler
   */
  destroy(): void {
    this.cleanup();
    this.eventEmitter.removeAllListeners();
  }
}

/**
 * Global profiler instance
 */
let globalProfiler: PerformanceProfiler | undefined;

/**
 * Get or create the global profiler
 */
export function getGlobalProfiler(
  config?: PerformanceMonitoringConfig['profiling']
): PerformanceProfiler {
  if (!globalProfiler) {
    globalProfiler = new PerformanceProfiler(config);
  }

  return globalProfiler;
}

/**
 * Reset the global profiler
 */
export function resetGlobalProfiler(): void {
  if (globalProfiler) {
    globalProfiler.destroy();
    globalProfiler = undefined;
  }
}
