/**
 * CPU Profiler for monitoring CPU usage and stack traces
 * Uses v8 CPU profiler to capture detailed CPU performance data
 */

import { EventEmitter } from 'eventemitter3';
import {
  ProfileSession,
  ProfileType,
  CPUProfileSample,
  ProfilingOptions
} from '../types';

export class CPUProfiler {
  private eventEmitter: EventEmitter;
  private sessions: Map<string, ProfileSession>;
  private defaultOptions: ProfilingOptions;

  constructor(options: ProfilingOptions = {}) {
    this.eventEmitter = new EventEmitter();
    this.sessions = new Map();
    this.defaultOptions = {
      interval: options.interval || 1000, // 1ms
      duration: options.duration || 30000, // 30s
      samplingRate: options.samplingRate || 1000, // 1000 Hz
      maxSamples: options.maxSamples || 1000000
    };
  }

  /**
   * Start a CPU profiling session
   */
  start(sessionId?: string): string {
    const id = sessionId || this.generateSessionId();
    const now = Date.now();

    if (this.sessions.has(id)) {
      throw new Error(`Profile session ${id} already exists`);
    }

    const session: ProfileSession = {
      id,
      type: 'cpu',
      startTime: now,
      status: 'running',
      samples: [],
      metadata: {
        interval: this.defaultOptions.interval,
        samplingRate: this.defaultOptions.samplingRate
      }
    };

    this.sessions.set(id, session);

    // Start collecting samples
    this.collectSamples(id);

    this.eventEmitter.emit('profile:started', { id, type: 'cpu', timestamp: now });

    return id;
  }

  /**
   * Stop a CPU profiling session
   */
  stop(sessionId: string): ProfileSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Profile session ${sessionId} not found`);
    }

    if (session.status !== 'running') {
      throw new Error(`Profile session ${sessionId} is not running`);
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    this.eventEmitter.emit('profile:stopped', {
      id: sessionId,
      type: 'cpu',
      duration: session.duration
    });

    return session;
  }

  /**
   * Get a profile session
   */
  getSession(sessionId: string): ProfileSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ProfileSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.eventEmitter.emit('session:deleted', { id: sessionId });
    }
    return deleted;
  }

  /**
   * Collect CPU samples using v8 module
   */
  private collectSamples(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return;
    }

    const validSession: ProfileSession & { samples: NonNullable<ProfileSession['samples']> } = session as any;

    try {
      // Use v8 module to get CPU profiling data
      const v8 = require('v8');
      const profile = v8.writeHeapSnapshot();

      // Process profile data and extract stack traces
      const samples = this.processCPUProfile(profile);

      validSession.samples.push(...samples);

      // Check if we've reached max samples
      if (validSession.samples.length >= (this.defaultOptions.maxSamples ?? 0)) {
        this.stop(sessionId);
        return;
      }

      // Schedule next collection
      setTimeout(() => this.collectSamples(sessionId), this.defaultOptions.interval);
    } catch (error) {
      validSession.status = 'error';
      validSession.metadata.error = (error as Error).message;
      this.eventEmitter.emit('profile:error', {
        id: sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Process v8 CPU profile data
   */
  private processCPUProfile(profile: unknown): CPUProfileSample[] {
    const samples: CPUProfileSample[] = [];

    try {
      // Extract stack traces and timing information from profile
      const profileData = profile as any;

      if (profileData.nodes && profileData.samples) {
        const { nodes, samples, timeDeltas } = profileData;

        for (let i = 0; i < samples.length; i++) {
          const nodeId = samples[i];
          const node = nodes[nodeId];

          if (node) {
            const cpuTime = timeDeltas ? timeDeltas[i] || 0 : 0;
            const wallTime = cpuTime; // Simplified

            samples.push({
              timestamp: Date.now(),
              data: {
                stack: this.extractStackTrace(node, nodes),
                cpuTime,
                wallTime
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing CPU profile:', error);
    }

    return samples;
  }

  /**
   * Extract stack trace from profile node
   */
  private extractStackTrace(node: any, allNodes: any[]): string[] {
    const stack: string[] = [];
    let currentNode = node;

    while (currentNode) {
      const functionName = currentNode.callFrame?.functionName || '(anonymous)';
      const scriptName = currentNode.callFrame?.scriptName || 'unknown';
      const lineNumber = currentNode.callFrame?.lineNumber || 0;

      stack.push(`${functionName} (${scriptName}:${lineNumber})`);

      const parentId = currentNode.parent;
      if (parentId === undefined || parentId < 0) {
        break;
      }

      currentNode = allNodes[parentId];
    }

    return stack.reverse();
  }

  /**
   * Get hot functions from a session
   */
  getHotFunctions(sessionId: string, limit: number = 10): Array<{
    function: string;
    totalTime: number;
    sampleCount: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const functionStats = new Map<string, { totalTime: number; sampleCount: number }>();

    for (const sample of session.samples) {
      const cpuSample = sample as CPUProfileSample;
      const stack = cpuSample.data.stack;

      if (stack.length > 0) {
        const functionName = stack[0];
        const stats = functionStats.get(functionName) || {
          totalTime: 0,
          sampleCount: 0
        };

        stats.totalTime += cpuSample.data.cpuTime;
        stats.sampleCount++;

        functionStats.set(functionName, stats);
      }
    }

    return Array.from(functionStats.entries())
      .map(([func, stats]) => ({
        function: func,
        totalTime: stats.totalTime,
        sampleCount: stats.sampleCount
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit);
  }

  /**
   * Get flame graph data
   */
  getFlameGraph(sessionId: string): Array<{
    name: string;
    value: number;
    children: Array<any>;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const root: any = {
      name: 'root',
      value: 0,
      children: []
    };

    for (const sample of session.samples) {
      const cpuSample = sample as CPUProfileSample;
      const stack = cpuSample.data.stack;

      let currentNode = root;
      currentNode.value += cpuSample.data.cpuTime;

      for (const functionName of stack) {
        let child = currentNode.children.find((c: any) => c.name === functionName);

        if (!child) {
          child = {
            name: functionName,
            value: 0,
            children: []
          };
          currentNode.children.push(child);
        }

        child.value += cpuSample.data.cpuTime;
        currentNode = child;
      }
    }

    return [root];
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `cpu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    for (const sessionId of this.sessions.keys()) {
      if (this.sessions.get(sessionId)?.status === 'running') {
        try {
          this.stop(sessionId);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    this.sessions.clear();
  }
}
