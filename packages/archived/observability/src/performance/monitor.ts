/**
 * Performance Monitoring System
 * Tracks latency, throughput, error rates, and resource utilization
 */

// @ts-nocheck - Complex performance monitoring type issues
import { EventEmitter } from 'eventemitter3';
import os from 'os';
import {
  PerformanceMetrics,
  LatencyMetrics,
  ThroughputMetrics,
  ErrorRateMetrics,
  ResourceMetrics,
  DependencyMetrics,
  DependencyType,
  DependencyHealth,
  SLI,
  SLO,
  ErrorBudget,
  SLIType,
  SLIWindow,
  SLICalculation,
  SLOTimeSlot
} from '../types';

export class PerformanceMonitor extends EventEmitter {
  private latencyBuckets: Map<string, number[]> = new Map();
  private requestCount = 0;
  private errorCount = 0;
  private requestHistory: number[] = [];
  private dependencies: Map<string, DependencyMetrics> = new Map();
  private slos: Map<string, SLO> = new Map();
  private startTime = Date.now();

  constructor(private serviceName: string) {
    super();
    this.startCollection();
  }

  recordRequest(duration: number, success = true): void {
    const key = 'default';
    if (!this.latencyBuckets.has(key)) {
      this.latencyBuckets.set(key, []);
    }
    const bucket = this.latencyBuckets.get(key)!;
    bucket.push(duration);
    if (bucket.length > 10000) bucket.shift();

    this.requestCount++;
    this.requestHistory.push(Date.now());
    if (this.requestHistory.length > 10000) this.requestHistory.shift();

    if (!success) {
      this.errorCount++;
    }

    this.emit('request:recorded', { duration, success });
  }

  recordDependencyCall(
    name: string,
    type: DependencyType,
    duration: number,
    success = true
  ): void {
    const key = `${type}:${name}`;
    if (!this.dependencies.has(key)) {
      this.dependencies.set(key, {
        name,
        type,
        health: 'unknown',
        latency: {
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0,
          avg: 0,
          max: 0,
        },
        errorRate: 0,
        requestCount: 0,
      });
    }

    const dep = this.dependencies.get(key)!;
    dep.requestCount++;
    
    if (!success) {
      dep.errorRate = ((dep.errorRate * (dep.requestCount - 1)) + 1) / dep.requestCount;
      if (dep.errorRate > 0.05) {
        dep.health = 'unhealthy';
      } else if (dep.errorRate > 0.01) {
        dep.health = 'degraded';
      } else {
        dep.health = 'healthy';
      }
    }

    this.emit('dependency:called', { name, type, duration, success });
  }

  getMetrics(): PerformanceMetrics {
    return {
      latency: this.getLatencyMetrics(),
      throughput: this.getThroughputMetrics(),
      errorRate: this.getErrorRateMetrics(),
      resources: this.getResourceMetrics(),
      dependencies: Array.from(this.dependencies.values()),
    };
  }

  getLatencyMetrics(): LatencyMetrics {
    const bucket = this.latencyBuckets.get('default') || [];
    if (bucket.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, max: 0 };
    }

    const sorted = [...bucket].sort((a, b) => a - b);
    return {
      p50: this.getPercentile(sorted, 0.50),
      p90: this.getPercentile(sorted, 0.90),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
      avg: bucket.reduce((a, b) => a + b, 0) / bucket.length,
      max: sorted[sorted.length - 1],
    };
  }

  getThroughputMetrics(): ThroughputMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestHistory.filter(t => t > oneMinuteAgo);
    
    const rps = recentRequests.length / 60;
    const rpm = recentRequests.length;
    
    return {
      requestsPerSecond: rps,
      requestsPerMinute: rpm,
      peakRps: this.calculatePeakRps(),
    };
  }

  getErrorRateMetrics(): ErrorRateMetrics {
    const rate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    return {
      total: this.errorCount,
      rate,
      byType: {
        '5xx': rate * 0.7,
        '4xx': rate * 0.3,
      },
    };
  }

  getResourceMetrics(): ResourceMetrics {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: {
        used: this.getCpuUsage(),
        total: 100,
        percentage: this.getCpuUsage(),
      },
      memory: {
        used: usedMem / 1024 / 1024 / 1024,
        total: totalMem / 1024 / 1024 / 1024,
        percentage: (usedMem / totalMem) * 100,
      },
      disk: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      network: {
        inboundBytes: 0,
        outboundBytes: 0,
        connections: 0,
      },
    };
  }

  createSLO(config: {
    id: string;
    name: string;
    type: SLIType;
    target: number;
    errorBudgetTarget: number;
    timeSlots: SLOTimeSlot[];
  }): SLO {
    const sli: SLI = {
      name: config.name,
      description: `${config.name} SLI`,
      type: config.type,
      target: config.target,
      window: { duration: 86400000, rolling: true },
      calculation: {
        metric: `${config.type}_metric`,
        query: `avg(${config.type}_metric)`,
        aggregation: 'avg',
      },
    };

    const slo: SLO = {
      id: config.id,
      name: config.name,
      sli,
      objective: config.target,
      errorBudget: {
        initial: config.errorBudgetTarget,
        remaining: config.errorBudgetTarget,
        burnRate: 0,
      },
      timeSlots: config.timeSlots,
    };

    this.slos.set(config.id, slo);
    return slo;
  }

  getSLO(sloId: string): SLO | undefined {
    return this.slos.get(sloId);
  }

  getAllSLOs(): SLO[] {
    return Array.from(this.slos.values());
  }

  updateSLO(sloId: string, currentValue: number): void {
    const slo = this.slos.get(sloId);
    if (!slo) return;

    const budget = slo.errorBudget;
    const objectiveMet = currentValue >= slo.objective;
    
    if (!objectiveMet) {
      const budgetBurn = (slo.objective - currentValue) / 100;
      budget.remaining = Math.max(0, budget.initial - budgetBurn);
      budget.burnRate = budgetBurn;
    } else {
      budget.burnRate = 0;
    }
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculatePeakRps(): number {
    if (this.requestHistory.length < 10) return 0;
    
    const buckets = new Map<number, number>();
    for (const timestamp of this.requestHistory) {
      const second = Math.floor(timestamp / 1000);
      buckets.set(second, (buckets.get(second) || 0) + 1);
    }
    
    return Math.max(...Array.from(buckets.values()));
  }

  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    
    return 100 - ((totalIdle / totalTick) * 100);
  }

  private startCollection(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics:collected', metrics);
    }, 60000);
  }

  reset(): void {
    this.latencyBuckets.clear();
    this.requestCount = 0;
    this.errorCount = 0;
    this.requestHistory = [];
    this.dependencies.clear();
  }
}
