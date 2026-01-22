/**
 * Performance Optimization Analyzer
 *
 * Analyzes performance metrics and provides optimization recommendations
 */

import type {
  OptimizationRecommendation,
  OptimizationCategory,
  PerformanceMetrics,
  ProfileSnapshot,
  BenchmarkResult,
} from '../types/index.js';

export class PerformanceAnalyzer {
  /**
   * Analyze performance metrics and generate recommendations
   */
  analyzeMetrics(metrics: PerformanceMetrics): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // CPU usage analysis
    if (metrics.cpuUsage > 0.8) {
      recommendations.push({
        id: 'high-cpu-usage',
        severity: 'high',
        category: 'cpu-usage',
        title: 'High CPU Usage Detected',
        description: `CPU usage is at ${(metrics.cpuUsage * 100).toFixed(1)}%, which may cause performance degradation.`,
        impact: 'High CPU usage can lead to increased latency and reduced throughput.',
        effort: 'medium',
        fix: {
          description: 'Consider optimizing algorithms, reducing computational complexity, or implementing caching.',
          code: '// Before: O(n²) algorithm\nfor (let i = 0; i < arr.length; i++) {\n  for (let j = 0; j < arr.length; j++) {\n    // ...\n  }\n}\n\n// After: O(n) algorithm\nconst seen = new Set();\nfor (const item of arr) {\n  if (!seen.has(item)) {\n    seen.add(item);\n    // ...\n  }\n}',
        },
        metrics: {
          before: metrics.cpuUsage,
          after: metrics.cpuUsage * 0.5,
          improvement: 50,
        },
      });
    }

    // Memory usage analysis
    if (metrics.memoryPercentage > 80) {
      recommendations.push({
        id: 'high-memory-usage',
        severity: 'high',
        category: 'memory-leak',
        title: 'High Memory Usage Detected',
        description: `Memory usage is at ${metrics.memoryPercentage.toFixed(1)}%, approaching the limit.`,
        impact: 'High memory usage can cause out-of-memory errors and increased garbage collection.',
        effort: 'medium',
        fix: {
          description: 'Check for memory leaks, implement proper cleanup, and consider streaming for large datasets.',
        },
        metrics: {
          before: metrics.memoryPercentage,
          after: metrics.memoryPercentage * 0.6,
          improvement: 40,
        },
      });
    }

    // Event loop lag analysis
    if (metrics.eventLoopLag > 50) {
      recommendations.push({
        id: 'high-event-loop-lag',
        severity: 'high',
        category: 'event-loop',
        title: 'High Event Loop Lag Detected',
        description: `Event loop lag is ${metrics.eventLoopLag.toFixed(1)}ms, indicating blocking operations.`,
        impact: 'High event loop lag causes delayed request processing and poor user experience.',
        effort: 'low',
        fix: {
          description: 'Move blocking operations to worker threads, use async/await properly, or break up large tasks.',
          code: '// Before: Blocking operation\nfunction processLargeArray(arr) {\n  const result = [];\n  for (const item of arr) {\n    result.push(expensiveOperation(item)); // Blocking\n  }\n  return result;\n}\n\n// After: Async processing\nasync function processLargeArray(arr) {\n  const result = [];\n  for (const item of arr) {\n    result.push(await expensiveOperationAsync(item)); // Non-blocking\n  }\n  return result;\n}',
        },
        metrics: {
          before: metrics.eventLoopLag,
          after: 10,
          improvement: 80,
        },
      });
    }

    // Event loop utilization analysis
    if (metrics.eventLoopUtilization > 0.7) {
      recommendations.push({
        id: 'high-event-loop-utilization',
        severity: 'medium',
        category: 'event-loop',
        title: 'High Event Loop Utilization',
        description: `Event loop utilization is ${(metrics.eventLoopUtilization * 100).toFixed(1)}%.`,
        impact: 'High utilization means the event loop is busy processing tasks.',
        effort: 'medium',
        fix: {
          description: 'Optimize task processing, implement proper queuing, and consider load balancing.',
        },
      });
    }

    return recommendations;
  }

  /**
   * Analyze profile snapshots for hot paths
   */
  analyzeSnapshots(snapshots: ProfileSnapshot[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (snapshots.length === 0) {
      return recommendations;
    }

    // Analyze hot paths
    const hotPaths = this.identifyHotPaths(snapshots);

    for (const hotPath of hotPaths) {
      recommendations.push({
        id: `hot-path-${hotPath.functionName.replace(/[^a-zA-Z0-9]/g, '-')}`,
        severity: hotPath.percentage > 30 ? 'high' : 'medium',
        category: 'cpu-usage',
        title: `Hot Path Detected: ${hotPath.functionName}`,
        description: `${hotPath.functionName} accounts for ${hotPath.percentage.toFixed(1)}% of execution time.`,
        impact: 'Optimizing hot paths can significantly improve overall performance.',
        effort: 'medium',
        codeLocation: {
          file: hotPath.scriptName,
          line: hotPath.lineNumber,
          column: hotPath.columnNumber,
        },
        fix: {
          description: 'Consider memoization, caching results, or optimizing the algorithm.',
        },
        metrics: {
          before: hotPath.percentage,
          after: hotPath.percentage * 0.5,
          improvement: 50,
        },
      });
    }

    // Memory leak detection
    const memoryLeaks = this.detectMemoryLeaks(snapshots);

    for (const leak of memoryLeaks) {
      recommendations.push({
        id: `memory-leak-${leak.location.replace(/[^a-zA-Z0-9]/g, '-')}`,
        severity: 'critical',
        category: 'memory-leak',
        title: 'Potential Memory Leak Detected',
        description: `Memory usage consistently increased by ${leak.increase.toFixed(1)}% in ${leak.location}.`,
        impact: 'Memory leaks can cause out-of-memory errors over time.',
        effort: 'high',
        codeLocation: {
          file: leak.location,
          line: 0,
          column: 0,
        },
        fix: {
          description: 'Ensure proper cleanup of event listeners, timers, and large objects.',
          code: '// Common memory leak patterns\n\n// 1. Event listeners not removed\n// Bad:\nelement.addEventListener('click', handler);\n// Good:\nelement.addEventListener('click', handler);\n// Later: element.removeEventListener('click', handler);\n\n// 2. Timers not cleared\n// Bad:\nconst timer = setInterval(callback, 1000);\n// Good:\nconst timer = setInterval(callback, 1000);\n// Later: clearInterval(timer);\n\n// 3. Closures retaining large objects\n// Bad:\nfunction createHandler(largeData) {\n  return function() {\n    console.log(largeData); // Retains largeData\n  };\n}\n// Good:\nfunction createHandler(dataId) {\n  return function() {\n    const largeData = fetchLargeData(dataId);\n    console.log(largeData);\n  };\n}',
        },
      });
    }

    return recommendations;
  }

  /**
   * Analyze benchmark results for optimization opportunities
   */
  analyzeBenchmarks(benchmarks: BenchmarkResult[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const benchmark of benchmarks) {
      // Slow benchmarks
      if (benchmark.avgTime > 100) {
        recommendations.push({
          id: `slow-benchmark-${benchmark.name.replace(/[^a-zA-Z0-9]/g, '-')}`,
          severity: 'medium',
          category: 'algorithm',
          title: `Slow Benchmark: ${benchmark.name}`,
          description: `Benchmark took ${benchmark.avgTime.toFixed(2)}ms on average.`,
          impact: 'Slow operations can accumulate and cause performance issues.',
          effort: 'medium',
          fix: {
            description: 'Consider algorithmic optimizations, caching, or precomputation.',
          },
          metrics: {
            before: benchmark.avgTime,
            after: benchmark.avgTime * 0.5,
            improvement: 50,
          },
        });
      }

      // High variance
      if (benchmark.stdDev / benchmark.avgTime > 0.5) {
        recommendations.push({
          id: `high-variance-${benchmark.name.replace(/[^a-zA-Z0-9]/g, '-')}`,
          severity: 'low',
          category: 'code-quality',
          title: `High Variance: ${benchmark.name}`,
          description: `Standard deviation is ${(benchmark.stdDev / benchmark.avgTime * 100).toFixed(1)}% of mean time.`,
          impact: 'High variance indicates inconsistent performance.',
          effort: 'low',
          fix: {
            description: 'Investigate sources of variability such as caching, network, or resource contention.',
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Identify hot paths from snapshots
   */
  private identifyHotPaths(snapshots: ProfileSnapshot[]): Array<{
    functionName: string;
    scriptName: string;
    lineNumber: number;
    columnNumber: number;
    percentage: number;
  }> {
    const functionStats = new Map<string, {
      functionName: string;
      scriptName: string;
      lineNumber: number;
      columnNumber: number;
      count: number;
    }>();

    let totalFrames = 0;

    for (const snapshot of snapshots) {
      if (!snapshot.stackTrace) continue;

      for (const frame of snapshot.stackTrace) {
        const key = `${frame.functionName}:${frame.scriptName}:${frame.lineNumber}`;

        const existing = functionStats.get(key);
        if (existing) {
          existing.count++;
        } else {
          functionStats.set(key, {
            functionName: frame.functionName,
            scriptName: frame.scriptName,
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber,
            count: 1,
          });
        }

        totalFrames++;
      }
    }

    // Convert to hot paths
    const hotPaths = Array.from(functionStats.values())
      .map((stat) => ({
        functionName: stat.functionName,
        scriptName: stat.scriptName,
        lineNumber: stat.lineNumber,
        columnNumber: stat.columnNumber,
        percentage: (stat.count / totalFrames) * 100,
      }))
      .filter((path) => path.percentage > 10) // Only show paths with >10% of samples
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10); // Top 10 hot paths

    return hotPaths;
  }

  /**
   * Detect memory leaks from snapshots
   */
  private detectMemoryLeaks(snapshots: ProfileSnapshot[]): Array<{
    location: string;
    increase: number;
    rate: number;
  }> {
    const leaks: Array<{
      location: string;
      increase: number;
      rate: number;
    }> = [];

    if (snapshots.length < 10) {
      return leaks;
    }

    // Check for memory growth
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];

    if (!firstSnapshot.memorySnapshot || !lastSnapshot.memorySnapshot) {
      return leaks;
    }

    const memoryIncrease = ((lastSnapshot.memorySnapshot.heapUsed - firstSnapshot.memorySnapshot.heapUsed) / firstSnapshot.memorySnapshot.heapUsed) * 100;

    if (memoryIncrease > 50) {
      // Significant memory increase detected
      leaks.push({
        location: 'general',
        increase: memoryIncrease,
        rate: memoryIncrease / (lastSnapshot.timestamp - firstSnapshot.timestamp) * 1000,
      });
    }

    return leaks;
  }

  /**
   * Generate optimization report
   */
  generateReport(
    metrics?: PerformanceMetrics,
    snapshots?: ProfileSnapshot[],
    benchmarks?: BenchmarkResult[]
  ): string {
    const allRecommendations: OptimizationRecommendation[] = [];

    if (metrics) {
      allRecommendations.push(...this.analyzeMetrics(metrics));
    }

    if (snapshots) {
      allRecommendations.push(...this.analyzeSnapshots(snapshots));
    }

    if (benchmarks) {
      allRecommendations.push(...this.analyzeBenchmarks(benchmarks));
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allRecommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Generate report
    let report = '# Performance Optimization Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Recommendations:** ${allRecommendations.length}\n\n`;

    // Summary by severity
    const summary = allRecommendations.reduce(
      (acc, rec) => {
        acc[rec.severity] = (acc[rec.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    report += '## Summary\n\n';
    for (const [severity, count] of Object.entries(summary)) {
      report += `- **${severity.toUpperCase()}:** ${count}\n`;
    }
    report += '\n';

    // Recommendations
    report += '## Recommendations\n\n';

    for (const rec of allRecommendations) {
      const emoji = this.getSeverityEmoji(rec.severity);
      report += `### ${emoji} ${rec.title}\n\n`;
      report += `**Severity:** ${rec.severity.toUpperCase()}\n`;
      report += `**Category:** ${rec.category}\n\n`;
      report += `${rec.description}\n\n`;
      report += `**Impact:** ${rec.impact}\n`;
      report += `**Effort:** ${rec.effort}\n\n`;

      if (rec.codeLocation) {
        report += `**Location:** ${rec.codeLocation.file}:${rec.codeLocation.line}\n\n`;
      }

      if (rec.fix) {
        report += `**Fix:** ${rec.fix.description}\n\n`;
        if (rec.fix.code) {
          report += '```typescript\n';
          report += rec.fix.code;
          report += '\n```\n\n';
        }
      }

      if (rec.metrics) {
        const improvement = rec.metrics.improvement;
        report += `**Expected Improvement:** ${improvement.toFixed(1)}% reduction\n\n`;
      }

      report += '---\n\n';
    }

    return report;
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: string): string {
    const emojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
      info: '📝',
    };
    return emojis[severity as keyof typeof emojis] || '•';
  }
}

export default PerformanceAnalyzer;
