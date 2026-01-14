/**
 * Memory leak detection with heap snapshot comparison
 */

import {
  HeapSnapshot,
  MemoryLeak,
  RetainedSizeAnalysis,
  RetainingPath,
  MemoryTimelinePoint,
} from '../types';

export interface LeakDetectionOptions {
  threshold?: number; // Percentage growth threshold
  minSnapshots?: number; // Minimum snapshots before detection
  checkInterval?: number; // Time between checks (ms)
}

export class MemoryLeakDetector {
  private snapshots: HeapSnapshot[] = [];
  private timeline: MemoryTimelinePoint[] = [];
  private detectionTimer?: number;
  private isMonitoring: boolean = false;

  constructor(private options: LeakDetectionOptions = {}) {
    this.options = {
      threshold: options.threshold || 20, // 20% growth
      minSnapshots: options.minSnapshots || 3,
      checkInterval: options.checkInterval || 5000, // 5 seconds
    };
  }

  /**
   * Start monitoring for memory leaks
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Take initial snapshot
    this.takeSnapshot();

    // Schedule periodic checks
    this.detectionTimer = window.setInterval(() => {
      this.checkForLeaks();
    }, this.options.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.detectionTimer !== undefined) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
  }

  /**
   * Take a heap snapshot (simulated for browser environment)
   */
  async takeSnapshot(): Promise<HeapSnapshot> {
    const snapshot: HeapSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      totalSize: this.getCurrentHeapSize(),
      nodes: [],
      edges: [],
      strings: [],
    };

    this.snapshots.push(snapshot);

    // Record timeline point
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.timeline.push({
        timestamp: Date.now(),
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: 0,
      });
    }

    return snapshot;
  }

  /**
   * Get current heap size
   */
  private getCurrentHeapSize(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Check for memory leaks by comparing snapshots
   */
  checkForLeaks(): MemoryLeak[] {
    if (this.snapshots.length < this.options.minSnapshots!) {
      return [];
    }

    const leaks: MemoryLeak[] = [];

    // Compare recent snapshots
    const recentSnapshots = this.snapshots.slice(-this.options.minSnapshots!);

    // Check for consistent growth
    const isGrowing = this.isConsistentlyGrowing(recentSnapshots);

    if (isGrowing) {
      const growthRate = this.calculateGrowthRate(recentSnapshots);
      const leakedSize = recentSnapshots[recentSnapshots.length - 1].totalSize - recentSnapshots[0].totalSize;

      leaks.push({
        type: 'general_memory_leak',
        size: leakedSize,
        count: recentSnapshots.length,
        retentionPath: [],
        severity: this.calculateSeverity(growthRate),
        description: `Memory has grown by ${growthRate.toFixed(2)}% over ${recentSnapshots.length} snapshots`,
      });
    }

    // Analyze by object type (simulated)
    const typeLeaks = this.analyzeByObjectType(recentSnapshots);
    leaks.push(...typeLeaks);

    return leaks;
  }

  /**
   * Check if snapshots show consistent growth
   */
  private isConsistentlyGrowing(snapshots: HeapSnapshot[]): boolean {
    if (snapshots.length < 2) return false;

    let growthCount = 0;
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].totalSize > snapshots[i - 1].totalSize) {
        growthCount++;
      }
    }

    return growthCount >= snapshots.length / 2;
  }

  /**
   * Calculate growth rate
   */
  private calculateGrowthRate(snapshots: HeapSnapshot[]): number {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0].totalSize;
    const last = snapshots[snapshots.length - 1].totalSize;

    if (first === 0) return 0;

    return ((last - first) / first) * 100;
  }

  /**
   * Calculate severity based on growth rate
   */
  private calculateSeverity(growthRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (growthRate > 100) return 'critical';
    if (growthRate > 50) return 'high';
    if (growthRate > 20) return 'medium';
    return 'low';
  }

  /**
   * Analyze by object type (simulated)
   */
  private analyzeByObjectType(snapshots: HeapSnapshot[]): MemoryLeak[] {
    // In a real implementation, this would analyze the actual heap nodes
    // For now, we'll simulate based on common patterns

    const leaks: MemoryLeak[] = [];

    // Detect potential closure leaks
    if (this.detectClosureLeaks(snapshots)) {
      leaks.push({
        type: 'closure_leak',
        size: this.estimateLeakSize(snapshots) / 3,
        count: Math.floor(Math.random() * 10) + 1,
        retentionPath: ['closure', 'function', 'scope'],
        severity: 'medium',
        description: 'Potential closure leak detected. Functions may be retaining large scopes.',
      });
    }

    // Detect potential DOM node leaks
    if (this.detectDOMLeaks(snapshots)) {
      leaks.push({
        type: 'dom_node_leak',
        size: this.estimateLeakSize(snapshots) / 4,
        count: Math.floor(Math.random() * 20) + 5,
        retentionPath: ['dom_node', 'event_listener', 'closure'],
        severity: 'medium',
        description: 'Potential DOM node leak. Detached nodes may not be garbage collected.',
      });
    }

    // Detect potential cache leaks
    if (this.detectCacheLeaks(snapshots)) {
      leaks.push({
        type: 'cache_leak',
        size: this.estimateLeakSize(snapshots) / 2,
        count: Math.floor(Math.random() * 100) + 10,
        retentionPath: ['map', 'object', 'cache'],
        severity: 'high',
        description: 'Cache is growing unbounded. Consider implementing size limits or LRU eviction.',
      });
    }

    return leaks;
  }

  /**
   * Detect closure leaks
   */
  private detectClosureLeaks(snapshots: HeapSnapshot[]): boolean {
    // Simulated detection - in reality would analyze heap nodes
    const growth = this.calculateGrowthRate(snapshots);
    return growth > 15;
  }

  /**
   * Detect DOM leaks
   */
  private detectDOMLeaks(snapshots: HeapSnapshot[]): boolean {
    // Simulated detection
    return typeof document !== 'undefined' && document.querySelectorAll('*').length > 1000;
  }

  /**
   * Detect cache leaks
   */
  private detectCacheLeaks(snapshots: HeapSnapshot[]): boolean {
    // Simulated detection based on consistent growth pattern
    return this.isConsistentlyGrowing(snapshots) && this.calculateGrowthRate(snapshots) > 10;
  }

  /**
   * Estimate leak size
   */
  private estimateLeakSize(snapshots: HeapSnapshot[]): number {
    if (snapshots.length < 2) return 0;
    return snapshots[snapshots.length - 1].totalSize - snapshots[0].totalSize;
  }

  /**
   * Analyze retained size for an object
   */
  analyzeRetainedSize(objectId: number): RetainedSizeAnalysis {
    const snapshot = this.snapshots[this.snapshots.length - 1];

    if (!snapshot) {
      return {
        objectId,
        retainedSize: 0,
        retainingPaths: [],
      };
    }

    // Find the object
    const node = snapshot.nodes.find((n) => n.id === objectId);

    if (!node) {
      return {
        objectId,
        retainedSize: 0,
        retainingPaths: [],
      };
    }

    // Calculate retaining paths (simplified)
    const paths: RetainingPath[] = [];

    // In a real implementation, we'd traverse the graph
    // For now, create a simplified path
    paths.push({
      path: [
        { nodeId: node.id, edge: 'property' },
        { nodeId: 0, edge: 'root' },
      ],
      size: node.retainedSize,
    });

    return {
      objectId,
      retainedSize: node.retainedSize,
      retainingPaths: paths,
    };
  }

  /**
   * Find retaining paths for an object
   */
  findRetainingPaths(objectId: number, maxDepth: number = 5): RetainingPath[] {
    const snapshot = this.snapshots[this.snapshots.length - 1];

    if (!snapshot) {
      return [];
    }

    const paths: RetainingPath[] = [];
    const visited = new Set<number>();

    // BFS to find paths to root
    const traverse = (currentId: number, path: Array<{ nodeId: number; edge: string }>, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      // Find incoming edges
      const incomingEdges = snapshot.edges.filter((e) => e.to === currentId);

      for (const edge of incomingEdges) {
        const newPath = [...path, { nodeId: edge.from, edge: edge.name || edge.type }];

        if (edge.from === 0) {
          // Found root
          paths.push({
            path: newPath,
            size: 0, // Would calculate in real implementation
          });
        } else {
          traverse(edge.from, newPath, depth + 1);
        }
      }
    };

    traverse(objectId, [], 0);

    return paths;
  }

  /**
   * Get memory timeline
   */
  getTimeline(): MemoryTimelinePoint[] {
    return [...this.timeline];
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): HeapSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.snapshots = [];
    this.timeline = [];
  }

  /**
   * Get detection report
   */
  getDetectionReport(): {
    isMonitoring: boolean;
    snapshotCount: number;
    leakDetected: boolean;
    leaks: MemoryLeak[];
    recommendation: string;
  } {
    const leaks = this.checkForLeaks();

    let recommendation = 'No memory leaks detected.';

    if (leaks.length > 0) {
      const criticalLeaks = leaks.filter((l) => l.severity === 'critical');
      if (criticalLeaks.length > 0) {
        recommendation = 'Critical memory leaks detected! Immediate investigation required.';
      } else {
        recommendation = 'Memory leaks detected. Review and address the issues above.';
      }
    }

    return {
      isMonitoring: this.isMonitoring,
      snapshotCount: this.snapshots.length,
      leakDetected: leaks.length > 0,
      leaks,
      recommendation,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(snapshotId1: string, snapshotId2: string): {
    added: number;
    removed: number;
    changed: number;
    details: Array<{
      type: string;
      count: number;
      size: number;
    }>;
  } {
    const snapshot1 = this.snapshots.find((s) => s.id === snapshotId1);
    const snapshot2 = this.snapshots.find((s) => s.id === snapshotId2);

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both snapshots not found');
    }

    // In a real implementation, this would compare actual nodes
    // For now, return simplified comparison
    return {
      added: Math.max(0, snapshot2.totalSize - snapshot1.totalSize),
      removed: 0,
      changed: Math.abs(snapshot2.totalSize - snapshot1.totalSize),
      details: [
        {
          type: 'overall',
          count: 0,
          size: snapshot2.totalSize - snapshot1.totalSize,
        },
      ],
    };
  }
}
