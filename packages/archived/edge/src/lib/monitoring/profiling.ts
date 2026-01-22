/**
 * Performance Profiler
 *
 * Comprehensive performance profiling system for Cloudflare Workers.
 * Tracks CPU usage, memory consumption, and execution patterns.
 *
 * Features:
 * - CPU time profiling
 * - Memory usage tracking
 * - Stack trace capture
 * - Hot function identification
 * - Performance metrics aggregation
 * - Profile export in various formats
 * - Low overhead sampling
 */

import type {
  PerformanceProfile,
  ProfileSample,
  ProfileSummary,
  StackFrame,
  ProfilingOptions,
} from './types';

/**
 * Profiler Configuration
 */
export interface ProfilerConfig {
  enabled: boolean;
  defaultOptions: ProfilingOptions;
  exportInterval: number; // milliseconds
  maxProfiles: number;
}

/**
 * Active Profile
 */
interface ActiveProfile {
  profile: PerformanceProfile;
  samples: ProfileSample[];
  startTime: number;
  metadata: Record<string, any>;
}

/**
 * Performance Profiler Class
 */
export class PerformanceProfiler {
  private config: ProfilerConfig;
  private activeProfiles: Map<string, ActiveProfile>;
  private completedProfiles: PerformanceProfile[];
  private exportTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      defaultOptions: {
        enabled: true,
        samplingInterval: 10000, // 10 microseconds
        maxSamples: 10000,
        includeStackTrace: true,
        trackMemory: true,
        trackCPU: true,
      },
      exportInterval: config.exportInterval || 60000, // 1 minute
      maxProfiles: config.maxProfiles || 100,
    };
    this.activeProfiles = new Map();
    this.completedProfiles = [];
  }

  /**
   * Start a new profiling session
   */
  startProfile(
    name: string,
    options?: Partial<ProfilingOptions>,
    metadata?: Record<string, any>
  ): string {
    if (!this.config.enabled) {
      throw new Error('Profiling is not enabled');
    }

    const profileId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const profile: PerformanceProfile = {
      id: profileId,
      name,
      startTime,
      samples: [],
      summary: {
        totalSamples: 0,
        duration: 0,
        cpuTime: 0,
        wallTime: 0,
        avgCpuUsage: 0,
        maxMemoryUsage: 0,
        avgMemoryUsage: 0,
        hotFunctions: [],
      },
      metadata: metadata || {},
    };

    const activeProfile: ActiveProfile = {
      profile,
      samples: [],
      startTime,
      metadata: metadata || {},
    };

    this.activeProfiles.set(profileId, activeProfile);

    return profileId;
  }

  /**
   * End a profiling session
   */
  endProfile(profileId: string): PerformanceProfile {
    const activeProfile = this.activeProfiles.get(profileId);
    if (!activeProfile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const endTime = Date.now();
    const duration = endTime - activeProfile.startTime;

    // Calculate summary
    const summary = this.calculateSummary(activeProfile.samples, duration);

    // Create completed profile
    const completedProfile: PerformanceProfile = {
      ...activeProfile.profile,
      endTime,
      duration,
      samples: activeProfile.samples,
      summary,
    };

    // Remove from active and add to completed
    this.activeProfiles.delete(profileId);
    this.completedProfiles.push(completedProfile);

    // Enforce max profiles limit
    if (this.completedProfiles.length > this.config.maxProfiles) {
      this.completedProfiles = this.completedProfiles.slice(-this.config.maxProfiles);
    }

    return completedProfile;
  }

  /**
   * Record a profiling sample
   */
  recordSample(profileId: string, sample: Partial<ProfileSample>): void {
    const activeProfile = this.activeProfiles.get(profileId);
    if (!activeProfile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const fullSample: ProfileSample = {
      timestamp: sample.timestamp || Date.now(),
      cpuTime: sample.cpuTime || 0,
      wallTime: sample.wallTime || 0,
      memory: sample.memory || {
        used: 0,
        total: 0,
        limit: 0,
      },
      stackTrace: sample.stackTrace,
      metadata: sample.metadata,
    };

    activeProfile.samples.push(fullSample);

    // Enforce max samples limit
    if (activeProfile.samples.length > this.config.defaultOptions.maxSamples) {
      activeProfile.samples = activeProfile.samples.slice(-this.config.defaultOptions.maxSamples);
    }
  }

  /**
   * Get an active profile
   */
  getActiveProfile(profileId: string): PerformanceProfile | undefined {
    const activeProfile = this.activeProfiles.get(profileId);
    if (!activeProfile) {
      return undefined;
    }

    return activeProfile.profile;
  }

  /**
   * Get all active profiles
   */
  getActiveProfiles(): PerformanceProfile[] {
    return Array.from(this.activeProfiles.values()).map((ap) => ap.profile);
  }

  /**
   * Get a completed profile
   */
  getProfile(profileId: string): PerformanceProfile | undefined {
    return this.completedProfiles.find((p) => p.id === profileId);
  }

  /**
   * Get all completed profiles
   */
  getProfiles(filter?: {
    name?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): PerformanceProfile[] {
    let filtered = [...this.completedProfiles];

    if (filter) {
      if (filter.name) {
        filtered = filtered.filter((p) => p.name === filter.name);
      }

      if (filter.startTime) {
        filtered = filtered.filter((p) => p.startTime >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter((p) => (p.endTime || 0) <= filter.endTime!);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Get profile statistics
   */
  getStats(): {
    activeProfiles: number;
    completedProfiles: number;
    totalSamples: number;
    avgDuration: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
  } {
    const completedProfiles = this.completedProfiles;
    const totalSamples = completedProfiles.reduce(
      (sum, p) => sum + p.summary.totalSamples,
      0
    );

    const avgDuration =
      completedProfiles.length > 0
        ? completedProfiles.reduce((sum, p) => sum + (p.duration || 0), 0) /
          completedProfiles.length
        : 0;

    const avgCpuUsage =
      completedProfiles.length > 0
        ? completedProfiles.reduce((sum, p) => sum + p.summary.avgCpuUsage, 0) /
          completedProfiles.length
        : 0;

    const avgMemoryUsage =
      completedProfiles.length > 0
        ? completedProfiles.reduce((sum, p) => sum + p.summary.avgMemoryUsage, 0) /
          completedProfiles.length
        : 0;

    return {
      activeProfiles: this.activeProfiles.size,
      completedProfiles: completedProfiles.length,
      totalSamples,
      avgDuration,
      avgCpuUsage,
      avgMemoryUsage,
    };
  }

  /**
   * Export profiles as JSON
   */
  exportJSON(): PerformanceProfile[] {
    return [...this.completedProfiles];
  }

  /**
   * Clear all completed profiles
   */
  clear(): void {
    this.completedProfiles = [];
  }

  /**
   * Calculate profile summary from samples
   */
  private calculateSummary(
    samples: ProfileSample[],
    duration: number
  ): ProfileSummary {
    if (samples.length === 0) {
      return {
        totalSamples: 0,
        duration,
        cpuTime: 0,
        wallTime: 0,
        avgCpuUsage: 0,
        maxMemoryUsage: 0,
        avgMemoryUsage: 0,
        hotFunctions: [],
      };
    }

    const totalSamples = samples.length;
    const cpuTime = samples.reduce((sum, s) => sum + s.cpuTime, 0);
    const wallTime = samples.reduce((sum, s) => sum + s.wallTime, 0);

    const avgCpuUsage = duration > 0 ? (cpuTime / duration) * 100 : 0;

    const memoryUsages = samples.map((s) => s.memory.used);
    const maxMemoryUsage = Math.max(...memoryUsages);
    const avgMemoryUsage =
      memoryUsages.reduce((sum, v) => sum + v, 0) / memoryUsages.length;

    // Identify hot functions from stack traces
    const hotFunctions = this.identifyHotFunctions(samples);

    return {
      totalSamples,
      duration,
      cpuTime,
      wallTime,
      avgCpuUsage,
      maxMemoryUsage,
      avgMemoryUsage,
      hotFunctions,
    };
  }

  /**
   * Identify hot functions from stack traces
   */
  private identifyHotFunctions(
    samples: ProfileSample[]
  ): Array<{ name: string; samples: number; percentage: number }> {
    const functionCounts = new Map<string, number>();

    for (const sample of samples) {
      if (!sample.stackTrace) {
        continue;
      }

      for (const frame of sample.stackTrace) {
        const functionName = frame.name || frame.function || 'anonymous';
        functionCounts.set(
          functionName,
          (functionCounts.get(functionName) || 0) + 1
        );
      }
    }

    const totalSamples = samples.length;
    const hotFunctions = Array.from(functionCounts.entries())
      .map(([name, count]) => ({
        name,
        samples: count,
        percentage: (count / totalSamples) * 100,
      }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 10); // Top 10 hot functions

    return hotFunctions;
  }

  /**
   * Start automatic profile export
   */
  startAutoExport(): void {
    if (this.exportTimer) {
      this.stopAutoExport();
    }

    this.exportTimer = setInterval(() => {
      // Export profiles to external storage or analytics
      console.log('Auto-exporting profiles:', {
        activeProfiles: this.activeProfiles.size,
        completedProfiles: this.completedProfiles.length,
      });
    }, this.config.exportInterval);
  }

  /**
   * Stop automatic profile export
   */
  stopAutoExport(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = undefined;
    }
  }
}

/**
 * Create a performance profiler
 */
export function createProfiler(
  config?: Partial<ProfilerConfig>
): PerformanceProfiler {
  return new PerformanceProfiler(config);
}

/**
 * Middleware for automatic request profiling
 */
export function createProfilingMiddleware(profiler: PerformanceProfiler) {
  return async (request: Request): Promise<Response> => {
    const profileId = profiler.startProfile('request');

    const startCpu = performance.now();
    const startMemory = getMemoryUsage();

    try {
      const response = await fetch(request);

      const endCpu = performance.now();
      const endMemory = getMemoryUsage();

      profiler.recordSample(profileId, {
        timestamp: Date.now(),
        cpuTime: endCpu - startCpu,
        wallTime: endCpu - startCpu,
        memory: {
          used: endMemory.used - startMemory.used,
          total: endMemory.total,
          limit: endMemory.limit,
        },
      });

      profiler.endProfile(profileId);

      return response;
    } catch (error) {
      profiler.endProfile(profileId);
      throw error;
    }
  };
}

/**
 * Get current memory usage (simulated for Cloudflare Workers)
 */
function getMemoryUsage(): { used: number; total: number; limit: number } {
  // Cloudflare Workers don't expose memory usage directly
  // This is a placeholder for demonstration
  return {
    used: 0,
    total: 128 * 1024 * 1024, // 128 MB
    limit: 128 * 1024 * 1024,
  };
}

/**
 * Capture stack trace (simulated for Cloudflare Workers)
 */
export function captureStackTrace(limit: number = 10): StackFrame[] {
  const stack = new Error().stack;

  if (!stack) {
    return [];
  }

  const lines = stack.split('\n').slice(2, limit + 2); // Skip Error and captureStackTrace

  return lines.map((line) => {
    const match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)|at (.+?):(\d+):(\d+)|at (.+)/);

    if (match) {
      if (match[1] && match[2]) {
        // Named function with file
        return {
          name: match[1],
          file: match[2],
          line: parseInt(match[3]),
          column: parseInt(match[4]),
        };
      } else if (match[5] && match[6]) {
        // Anonymous function with file
        return {
          name: 'anonymous',
          file: match[5],
          line: parseInt(match[6]),
          column: parseInt(match[7]),
        };
      } else if (match[8]) {
        // Just function name
        return {
          name: match[8],
        };
      }
    }

    return {
      name: line.trim(),
    };
  });
}

/**
 * Profile context for manual profiling
 */
export class ProfileContext {
  private profiler: PerformanceProfiler;
  private profileId?: string;

  constructor(profiler: PerformanceProfiler) {
    this.profiler = profiler;
  }

  /**
   * Start profiling
   */
  start(name: string, metadata?: Record<string, any>): void {
    this.profileId = this.profiler.startProfile(name, undefined, metadata);
  }

  /**
   * Record a sample
   */
  sample(metadata?: Record<string, any>): void {
    if (!this.profileId) {
      throw new Error('Profile not started');
    }

    const startCpu = performance.now();
    const startMemory = getMemoryUsage();

    this.profiler.recordSample(this.profileId, {
      timestamp: Date.now(),
      cpuTime: 0,
      wallTime: 0,
      memory: startMemory,
      stackTrace: captureStackTrace(),
      metadata,
    });
  }

  /**
   * End profiling
   */
  end(): PerformanceProfile | undefined {
    if (!this.profileId) {
      return undefined;
    }

    const profile = this.profiler.endProfile(this.profileId);
    this.profileId = undefined;

    return profile;
  }

  /**
   * Execute a function with profiling
   */
  async profile<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; profile: PerformanceProfile }> {
    this.start(name, metadata);

    try {
      const result = await fn();
      const profile = this.end();

      if (!profile) {
        throw new Error('Profile failed to complete');
      }

      return { result, profile };
    } catch (error) {
      this.end();
      throw error;
    }
  }
}

/**
 * Create a profile context
 */
export function createProfileContext(
  profiler: PerformanceProfiler
): ProfileContext {
  return new ProfileContext(profiler);
}
