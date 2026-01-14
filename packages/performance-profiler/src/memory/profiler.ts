/**
 * Memory Profiler - Advanced memory profiling with leak detection
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  MemorySnapshot,
  HeapSpace,
  HeapObject,
  MemoryAllocation,
  MemoryLeak,
  GCPause,
  ProfilerEvent,
  StackFrame,
} from '../types';

export interface MemoryProfilerOptions {
  /**
   * Enable automatic heap snapshots
   */
  enableSnapshots?: boolean;

  /**
   * Interval between snapshots in milliseconds
   */
  snapshotInterval?: number;

  /**
   * Maximum number of snapshots to keep
   */
  maxSnapshots?: number;

  /**
   * Enable memory leak detection
   */
  enableLeakDetection?: boolean;

  /**
   * Threshold for leak detection (bytes)
   */
  leakThreshold?: number;

  /**
   * Minimum samples for leak detection
   */
  minLeakSamples?: number;

  /**
   * Enable GC pause tracking
   */
  trackGCPauses?: boolean;

  /**
   * Enable allocation tracking
   */
  trackAllocations?: boolean;

  /**
   * Maximum allocations to track
   */
  maxAllocations?: number;

  /**
   * Filter allocations by type
   */
  allocationFilter?: RegExp[];
}

export interface MemoryStatistics {
  currentHeap: number;
  peakHeap: number;
  heapGrowthRate: number;
  totalAllocated: number;
  totalDeallocated: number;
  gcPauses: number;
  totalGCPauseTime: number;
  suspectedLeaks: number;
}

export interface MemoryTrend {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  growthRate: number;
}

/**
 * Memory Profiler implementation
 */
export class MemoryProfiler extends EventEmitter {
  private profiling: boolean = false;
  private startTime: number = 0;
  private snapshots: MemorySnapshot[] = [];
  private allocations: Map<string, MemoryAllocation> = new Map();
  private gcPauses: GCPause[] = [];
  private leaks: Map<string, MemoryLeak> = new Map();
  private trends: MemoryTrend[] = [];
  private peakHeapSize: number = 0;
  private totalAllocated: number = 0;
  private totalDeallocated: number = 0;
  private snapshotTimer?: NodeJS.Timeout;
  private trendTimer?: NodeJS.Timeout;
  private options: Required<MemoryProfilerOptions>;
  private gcObserver?: PerformanceObserver;
  private objectCounter: number = 0;

  constructor(options: MemoryProfilerOptions = {}) {
    super();
    this.options = {
      enableSnapshots: options.enableSnapshots ?? true,
      snapshotInterval: options.snapshotInterval ?? 5000,
      maxSnapshots: options.maxSnapshots ?? 100,
      enableLeakDetection: options.enableLeakDetection ?? true,
      leakThreshold: options.leakThreshold ?? 1024 * 1024, // 1MB
      minLeakSamples: options.minLeakSamples ?? 5,
      trackGCPauses: options.trackGCPauses ?? true,
      trackAllocations: options.trackAllocations ?? true,
      maxAllocations: options.maxAllocations ?? 100000,
      allocationFilter: options.allocationFilter ?? [],
    };
  }

  /**
   * Start memory profiling
   */
  public start(): void {
    if (this.profiling) {
      throw new Error('Profiling already in progress');
    }

    this.profiling = true;
    this.startTime = Date.now();

    // Setup GC pause tracking if available
    if (this.options.trackGCPauses && typeof PerformanceObserver !== 'undefined') {
      this.setupGCObservation();
    }

    // Start periodic snapshots
    if (this.options.enableSnapshots) {
      this.snapshotTimer = setInterval(() => {
        this.takeSnapshot();
      }, this.options.snapshotInterval);
    }

    // Start trend tracking
    this.trendTimer = setInterval(() => {
      this.recordTrend();
    }, 1000);
  }

  /**
   * Stop memory profiling
   */
  public stop(): void {
    if (!this.profiling) {
      throw new Error('No profiling in progress');
    }

    this.profiling = false;

    // Clear timers
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }

    if (this.trendTimer) {
      clearInterval(this.trendTimer);
      this.trendTimer = undefined;
    }

    // Disconnect GC observer
    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = undefined;
    }

    // Take final snapshot
    if (this.options.enableSnapshots) {
      this.takeSnapshot();
    }

    // Detect leaks if enabled
    if (this.options.enableLeakDetection) {
      this.detectLeaks();
    }
  }

  /**
   * Check if profiling is active
   */
  public isProfiling(): boolean {
    return this.profiling;
  }

  /**
   * Take a heap snapshot
   */
  public takeSnapshot(): MemorySnapshot | null {
    if (!this.profiling && this.options.enableSnapshots) {
      return null;
    }

    const snapshot = this.captureHeapSnapshot();
    this.snapshots.push(snapshot);

    // Manage snapshot limit
    if (this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots.shift();
    }

    // Update peak heap size
    this.peakHeapSize = Math.max(this.peakHeapSize, snapshot.usedSize);

    this.emit({
      type: 'memory-snapshot',
      timestamp: Date.now(),
      snapshot,
    } as ProfilerEvent);

    return snapshot;
  }

  /**
   * Get all snapshots
   */
  public getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get snapshot by index
   */
  public getSnapshot(index: number): MemorySnapshot | undefined {
    return this.snapshots[index];
  }

  /**
   * Compare two snapshots
   */
  public compareSnapshots(
    index1: number,
    index2: number
  ): {
    added: HeapObject[];
    removed: HeapObject[];
    grown: { object: HeapObject; delta: number }[];
    shrunk: { object: HeapObject; delta: number }[];
  } | null {
    const snapshot1 = this.snapshots[index1];
    const snapshot2 = this.snapshots[index2];

    if (!snapshot1 || !snapshot2) {
      return null;
    }

    const map1 = new Map(snapshot1.objects.map((obj) => [obj.id, obj]));
    const map2 = new Map(snapshot2.objects.map((obj) => [obj.id, obj]));

    const added: HeapObject[] = [];
    const removed: HeapObject[] = [];
    const grown: { object: HeapObject; delta: number }[] = [];
    const shrunk: { object: HeapObject; delta: number }[] = [];

    // Find added and grown objects
    for (const [id, obj2] of map2) {
      const obj1 = map1.get(id);
      if (!obj1) {
        added.push(obj2);
      } else if (obj2.size > obj1.size) {
        grown.push({ object: obj2, delta: obj2.size - obj1.size });
      } else if (obj2.size < obj1.size) {
        shrunk.push({ object: obj2, delta: obj1.size - obj2.size });
      }
    }

    // Find removed objects
    for (const [id, obj1] of map1) {
      if (!map2.has(id)) {
        removed.push(obj1);
      }
    }

    return { added, removed, grown, shrunk };
  }

  /**
   * Detect memory leaks
   */
  public detectLeaks(): MemoryLeak[] {
    if (this.snapshots.length < this.options.minLeakSamples) {
      return [];
    }

    const leaks: MemoryLeak[] = [];
    const recentSnapshots = this.snapshots.slice(-this.options.minLeakSamples);

    // Analyze memory growth
    const firstSnapshot = recentSnapshots[0];
    const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
    const growth = lastSnapshot.usedSize - firstSnapshot.usedSize;

    if (growth > this.options.leakThreshold) {
      // Find objects that consistently grow
      const growingObjects = this.findGrowingObjects(recentSnapshots);

      for (const obj of growingObjects) {
        const leak: MemoryLeak = {
          objectId: obj.id,
          type: obj.type,
          size: obj.size,
          allocationTime: Date.now(), // Approximate
          suspectedLeak: true,
          confidence: this.calculateLeakConfidence(obj, recentSnapshots),
          references: obj.references,
          stackTrace: [],
        };

        leaks.push(leak);
        this.leaks.set(obj.id, leak);

        this.emit({
          type: 'leak-detected',
          timestamp: Date.now(),
          leak,
        } as ProfilerEvent);
      }
    }

    return leaks;
  }

  /**
   * Get detected leaks
   */
  public getLeaks(): MemoryLeak[] {
    return Array.from(this.leaks.values());
  }

  /**
   * Get GC pauses
   */
  public getGCPauses(): GCPause[] {
    return [...this.gcPauses];
  }

  /**
   * Get memory statistics
   */
  public getStatistics(): MemoryStatistics {
    const currentSnapshot = this.snapshots[this.snapshots.length - 1];
    const currentHeap = currentSnapshot?.usedSize ?? 0;

    return {
      currentHeap,
      peakHeap: this.peakHeapSize,
      heapGrowthRate: this.calculateGrowthRate(),
      totalAllocated: this.totalAllocated,
      totalDeallocated: this.totalDeallocated,
      gcPauses: this.gcPauses.length,
      totalGCPauseTime: this.gcPauses.reduce((sum, pause) => sum + pause.duration, 0),
      suspectedLeaks: this.leaks.size,
    };
  }

  /**
   * Get memory trends
   */
  public getTrends(): MemoryTrend[] {
    return [...this.trends];
  }

  /**
   * Get allocations
   */
  public getAllocations(): MemoryAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Track an allocation
   */
  public trackAllocation(
    type: string,
    size: number,
    stackTrace?: StackFrame[]
  ): string {
    if (!this.profiling || !this.options.trackAllocations) {
      return '';
    }

    const id = `obj_${this.objectCounter++}`;
    const allocation: MemoryAllocation = {
      objectId: id,
      type,
      size,
      timestamp: Date.now(),
      stackTrace: stackTrace ?? this.captureStackTrace(),
      deallocated: false,
    };

    this.allocations.set(id, allocation);
    this.totalAllocated += size;

    // Manage allocation limit
    if (this.allocations.size > this.options.maxAllocations) {
      // Remove oldest allocation
      const oldest = Array.from(this.allocations.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      )[0];
      if (oldest && !oldest.deallocated) {
        this.allocations.delete(oldest.objectId);
      }
    }

    return id;
  }

  /**
   * Track a deallocation
   */
  public trackDeallocation(id: string): void {
    const allocation = this.allocations.get(id);
    if (allocation && !allocation.deallocated) {
      allocation.deallocated = true;
      allocation.deallocationTime = Date.now();
      this.totalDeallocated += allocation.size;
    }
  }

  /**
   * Find dominators for an object
   */
  public findDominator(objectId: string): HeapObject | null {
    for (const snapshot of this.snapshots) {
      const obj = snapshot.objects.find((o) => o.id === objectId);
      if (obj) {
        return obj;
      }
    }
    return null;
  }

  /**
   * Find retained size for an object
   */
  public findRetainedSize(objectId: string): number {
    const obj = this.findDominator(objectId);
    return obj?.retainedSize ?? 0;
  }

  /**
   * Get object by ID
   */
  public getObject(objectId: string): HeapObject | null {
    return this.findDominator(objectId);
  }

  /**
   * Reset profiler state
   */
  public reset(): void {
    if (this.profiling) {
      this.stop();
    }

    this.snapshots = [];
    this.allocations.clear();
    this.gcPauses = [];
    this.leaks.clear();
    this.trends = [];
    this.peakHeapSize = 0;
    this.totalAllocated = 0;
    this.totalDeallocated = 0;
    this.objectCounter = 0;
  }

  /**
   * Dispose of profiler resources
   */
  public dispose(): void {
    if (this.profiling) {
      this.stop();
    }

    this.removeAllListeners();
  }

  /**
   * Capture heap snapshot
   */
  private captureHeapSnapshot(): MemorySnapshot {
    // In a real implementation, this would use V8's heap snapshot API
    // For now, we'll simulate with process.memoryUsage()
    const memUsage = process.memoryUsage();
    const heapStats = this.getHeapStats();

    const snapshot: MemorySnapshot = {
      id: uuidv4(),
      timestamp: Date.now(),
      totalSize: memUsage.heapTotal,
      usedSize: memUsage.heapUsed,
      freeSize: memUsage.heapTotal - memUsage.heapUsed,
      heapSpaces: heapStats.spaces,
      objects: this.getHeapObjects(),
    };

    return snapshot;
  }

  /**
   * Get heap statistics
   */
  private getHeapStats(): {
    spaces: HeapSpace[];
  } {
    // Simulate heap spaces
    const memUsage = process.memoryUsage();

    return {
      spaces: [
        {
          name: 'new_space',
          size: memUsage.heapTotal * 0.1,
          used: memUsage.heapUsed * 0.1,
          available: memUsage.heapTotal * 0.1 - memUsage.heapUsed * 0.1,
          physicalSize: memUsage.heapTotal * 0.1,
        },
        {
          name: 'old_space',
          size: memUsage.heapTotal * 0.8,
          used: memUsage.heapUsed * 0.8,
          available: memUsage.heapTotal * 0.8 - memUsage.heapUsed * 0.8,
          physicalSize: memUsage.heapTotal * 0.8,
        },
        {
          name: 'code_space',
          size: memUsage.heapTotal * 0.1,
          used: memUsage.heapUsed * 0.1,
          available: memUsage.heapTotal * 0.1 - memUsage.heapUsed * 0.1,
          physicalSize: memUsage.heapTotal * 0.1,
        },
      ],
    };
  }

  /**
   * Get heap objects
   */
  private getHeapObjects(): HeapObject[] {
    // In real implementation, this would iterate actual heap objects
    // For now, return tracked allocations
    return Array.from(this.allocations.values())
      .filter((alloc) => !alloc.deallocated)
      .map((alloc) => ({
        id: alloc.objectId,
        type: alloc.type,
        name: alloc.type,
        size: alloc.size,
        retainedSize: alloc.size,
        distance: 0,
        references: [],
      }));
  }

  /**
   * Setup GC observation
   */
  private setupGCObservation(): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'gc' || entry.name === 'gc') {
            const gcEntry = entry as any;
            const pause: GCPause = {
              startTime: gcEntry.startTime,
              endTime: gcEntry.startTime + gcEntry.duration,
              duration: gcEntry.duration,
              type: this.getGCType(gcEntry),
              paused: true,
              heapSizeBefore: 0,
              heapSizeAfter: 0,
            };

            this.gcPauses.push(pause);
          }
        }
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      // GC observation might not be available in all environments
    }
  }

  /**
   * Get GC type from entry
   */
  private getGCType(entry: any): GCPause['type'] {
    if (entry.kind === 'minor') {
      return 'scavenge';
    } else if (entry.kind === 'major') {
      return 'mark-sweep-compact';
    }
    return 'incremental-marking';
  }

  /**
   * Record memory trend
   */
  private recordTrend(): void {
    const memUsage = process.memoryUsage();
    const lastTrend = this.trends[this.trends.length - 1];
    const growthRate = lastTrend
      ? memUsage.heapUsed - lastTrend.heapUsed
      : 0;

    this.trends.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      growthRate,
    });

    // Keep only last 1000 trends
    if (this.trends.length > 1000) {
      this.trends.shift();
    }
  }

  /**
   * Calculate growth rate
   */
  private calculateGrowthRate(): number {
    if (this.trends.length < 2) {
      return 0;
    }

    const recent = this.trends.slice(-100);
    const totalGrowth = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
    const duration = recent[recent.length - 1].timestamp - recent[0].timestamp;

    return duration > 0 ? (totalGrowth / duration) * 1000 : 0;
  }

  /**
   * Find objects that consistently grow
   */
  private findGrowingObjects(snapshots: MemorySnapshot[]): HeapObject[] {
    const growthMap = new Map<string, number>();

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];

      const prevMap = new Map(prev.objects.map((o) => [o.id, o]));
      const currMap = new Map(curr.objects.map((o) => [o.id, o]));

      for (const [id, currObj] of currMap) {
        const prevObj = prevMap.get(id);
        if (prevObj && currObj.size > prevObj.size) {
          const growth = growthMap.get(id) ?? 0;
          growthMap.set(id, growth + (currObj.size - prevObj.size));
        }
      }
    }

    // Find objects with significant growth
    return Array.from(growthMap.entries())
      .filter(([, growth]) => growth > this.options.leakThreshold / 10)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => snapshots[snapshots.length - 1].objects.find((o) => o.id === id))
      .filter((obj): obj is HeapObject => obj !== undefined);
  }

  /**
   * Calculate leak confidence
   */
  private calculateLeakConfidence(obj: HeapObject, snapshots: MemorySnapshot[]): number {
    let consistentGrowth = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];

      const prevObj = prev.objects.find((o) => o.id === obj.id);
      const currObj = curr.objects.find((o) => o.id === obj.id);

      if (prevObj && currObj && currObj.size > prevObj.size) {
        consistentGrowth++;
      }
    }

    return consistentGrowth / (snapshots.length - 1);
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): StackFrame[] {
    // In real implementation, this would capture actual stack trace
    const stack: StackFrame[] = [];
    const limit = 10;

    // Simulate stack trace
    for (let i = 0; i < limit; i++) {
      stack.push({
        functionName: `function_${i}`,
        lineNumber: i * 10,
        columnNumber: 0,
      });
    }

    return stack;
  }
}

/**
 * Convenience function to create and start a memory profiler
 */
export function startMemoryProfiling(options?: MemoryProfilerOptions): MemoryProfiler {
  const profiler = new MemoryProfiler(options);
  profiler.start();
  return profiler;
}

/**
 * Track memory usage for a function
 */
export async function profileMemory<T>(
  fn: () => T | Promise<T>,
  options?: MemoryProfilerOptions
): Promise<{ result: T; snapshots: MemorySnapshot[]; statistics: MemoryStatistics }> {
  const profiler = new MemoryProfiler(options);
  profiler.start();

  try {
    const result = await fn();
    profiler.stop();

    return {
      result,
      snapshots: profiler.getSnapshots(),
      statistics: profiler.getStatistics(),
    };
  } finally {
    profiler.dispose();
  }
}
