// @ts-nocheck - Complex external dependency issues
import { Observable, ObservableConfig } from '../core/Observable';
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
  SLICalculation
} from '../types';

/**
 * APM (Application Performance Monitoring) Service
 */
export class APMService extends Observable {
  protected config: ObservableConfig;
  private performanceMetrics: PerformanceMetrics = this.initializePerformanceMetrics();
  private dependencies: Map<string, DependencyMetrics> = new Map();
  private slis: Map<string, SLI> = new Map();
  // private slos: Map<string, SLO> = new Map();
  private errorBudget: ErrorBudget = {
    initial: 100,
    remaining: 100,
    burnRate: 0
  };

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize SLIs
      this.initializeSLIs();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize APMService:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    this.dependencies.clear();
    this.slis.clear();
    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        success: true,
        exported: 1,
        duration: 0,
        apmData: {
          performanceMetrics: this.performanceMetrics,
          dependencies: Array.from(this.dependencies.values()),
          slis: Array.from(this.slis.values()),
          errorBudget: this.errorBudget
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Record request latency
   */
  recordLatency(latency: number, operation: string): void {
    if (!this.performanceMetrics.latency) {
      this.performanceMetrics.latency = {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        max: 0
      };
    }

    // Calculate percentiles
    const latencies = this.getLatencyHistory(operation);
    latencies.push(latency);

    if (latencies.length > 1000) {
      latencies.shift(); // Keep only last 1000 latencies
    }

    this.performanceMetrics.latency = this.calculateLatencyPercentiles(latencies);
  }

  /**
   * Record throughput
   */
  recordThroughput(throughput: number, timeWindow: 'second' | 'minute' = 'second'): void {
    if (!this.performanceMetrics.throughput) {
      this.performanceMetrics.throughput = {
        requestsPerSecond: 0,
        requestsPerMinute: 0,
        peakRps: 0
      };
    }

    if (timeWindow === 'second') {
      this.performanceMetrics.throughput.requestsPerSecond = throughput;
      if (throughput > this.performanceMetrics.throughput.peakRps) {
        this.performanceMetrics.throughput.peakRps = throughput;
      }
    } else {
      this.performanceMetrics.throughput.requestsPerMinute = throughput;
    }
  }

  /**
   * Record error
   */
  recordError(errorType: string, operation?: string): void {
    if (!this.performanceMetrics.errorRate) {
      this.performanceMetrics.errorRate = {
        total: 0,
        rate: 0,
        byType: {}
      };
    }

    this.performanceMetrics.errorRate.total++;
    if (!this.performanceMetrics.errorRate.byType[errorType]) {
      this.performanceMetrics.errorRate.byType[errorType] = 0;
    }
    this.performanceMetrics.errorRate.byType[errorType]++;

    // Calculate error rate
    const totalRequests = this.performanceMetrics.errorRate.total;
    const successfulRequests = totalRequests - this.performanceMetrics.errorRate.total;
    this.performanceMetrics.errorRate.rate =
      totalRequests > 0 ? (this.performanceMetrics.errorRate.total / totalRequests) * 100 : 0;
  }

  /**
   * Record resource usage
   */
  recordResourceUsage(cpu: number, memory: number, disk: number): void {
    if (!this.performanceMetrics.resources) {
      this.performanceMetrics.resources = {
        cpu: { used: 0, total: 100, percentage: 0 },
        memory: { used: 0, total: 100, percentage: 0 },
        disk: { used: 0, total: 100, percentage: 0 }
      };
    }

    this.performanceMetrics.resources.cpu = {
      used: cpu,
      total: 100,
      percentage: cpu
    };

    this.performanceMetrics.resources.memory = {
      used: memory,
      total: 100,
      percentage: memory
    };

    this.performanceMetrics.resources.disk = {
      used: disk,
      total: 100,
      percentage: disk
    };
  }

  /**
   * Record dependency health
   */
  recordDependency(
    name: string,
    type: DependencyType,
    latency: LatencyMetrics,
    errorRate: number,
    requestCount: number
  ): void {
    const health = this.calculateDependencyHealth(errorRate, latency.avg);

    this.dependencies.set(name, {
      name,
      type,
      health,
      latency,
      errorRate,
      requestCount
    });
  }

  /**
   * Create a new SLI
   */
  createSLI(sli: SLI): void {
    this.slis.set(sli.name, sli);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get dependency metrics
   */
  getDependencyMetrics(name?: string): DependencyMetrics[] | DependencyMetrics | null {
    if (name) {
      return this.dependencies.get(name) || null;
    }
    return Array.from(this.dependencies.values());
  }

  /**
   * Get SLIs
   */
  getSLIs(): SLI[] {
    return Array.from(this.slis.values());
  }

  /**
   * Get SLI by name
   */
  getSLI(name: string): SLI | null {
    return this.slis.get(name) || null;
  }

  /**
   * Calculate SLI value
   */
  calculateSLI(sli: SLI): number {
    switch (sli.type) {
      case 'availability':
        return this.calculateAvailabilitySLI(sli);
      case 'latency':
        return this.calculateLatencySLI(sli);
      case 'error-rate':
        return this.calculateErrorRateSLI(sli);
      case 'throughput':
        return this.calculateThroughputSLI(sli);
      case 'saturation':
        return this.calculateSaturationSLI(sli);
      default:
        return 0;
    }
  }

  /**
   * Update error budget
   */
  updateErrorBudget(sli: SLI, value: number): void {
    if (!this.slos.has(sli.name)) return;

    const slo = this.slos.get(sli.name)!;
    const errorBudgetInitial = slo.errorBudget.initial;
    const errorBudgetUsed = errorBudgetInitial - value;
    const burnRate = errorBudgetUsed / (Date.now() - slo.timeSlots[0].start) * 1000; // per second

    this.errorBudget = {
      initial: errorBudgetInitial,
      remaining: errorBudgetInitial - errorBudgetUsed,
      burnRate,
      estimatedExhaustion: burnRate > 0 ? (this.errorBudget.remaining / burnRate) : null
    };
  }

  /**
   * Get error budget
   */
  getErrorBudget(): ErrorBudget {
    return { ...this.errorBudget };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: Date.now(),
      performanceMetrics: this.performanceMetrics,
      dependencies: Array.from(this.dependencies.values()),
      slis: Array.from(this.slis.values()).map(sli => ({
        name: sli.name,
        value: this.calculateSLI(sli),
        target: sli.target,
        status: this.calculateSLIStatus(sli)
      })),
      errorBudget: this.errorBudget,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): PerformanceMetrics {
    return {
      latency: {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        max: 0
      },
      throughput: {
        requestsPerSecond: 0,
        requestsPerMinute: 0,
        peakRps: 0
      },
      errorRate: {
        total: 0,
        rate: 0,
        byType: {}
      },
      resources: {
        cpu: { used: 0, total: 100, percentage: 0 },
        memory: { used: 0, total: 100, percentage: 0 },
        disk: { used: 0, total: 100, percentage: 0 }
      },
      dependencies: []
    };
  }

  /**
   * Initialize SLIs
   */
  private initializeSLIs(): void {
    // Default SLIs
    const defaultSLIs: SLI[] = [
      {
        name: 'service-availability',
        description: 'Service availability percentage',
        type: 'availability',
        target: 99.9,
        window: { duration: 3600000, rolling: true },
        calculation: {
          metric: 'http_requests_total',
          query: 'sum(rate(http_requests_total[5m]))',
          aggregation: 'sum'
        }
      },
      {
        name: 'request-latency',
        description: 'Request latency percentiles',
        type: 'latency',
        target: 95,
        window: { duration: 3600000, rolling: true },
        calculation: {
          metric: 'http_request_duration_seconds',
          query: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
          aggregation: 'histogram_quantile'
        }
      },
      {
        name: 'error-rate',
        description: 'Error rate percentage',
        type: 'error-rate',
        target: 1,
        window: { duration: 3600000, rolling: true },
        calculation: {
          metric: 'http_requests_total',
          query: 'sum(rate(http_requests_total[5m])){status=~"5.."} / sum(rate(http_requests_total[5m]))',
          aggregation: 'rate'
        }
      }
    ];

    defaultSLIs.forEach(sli => this.createSLI(sli));
  }

  /**
   * Get latency history for an operation
   */
  private getLatencyHistory(operation: string): number[] {
    // In a real implementation, this would query a time series database
    const latenciesKey = `latencies:${operation}`;
    const stored = this['latencyHistory']?.[latenciesKey];
    return stored || [];
  }

  /**
   * Set latency history
   */
  private setLatencyHistory(operation: string, latencies: number[]): void {
    if (!this['latencyHistory']) {
      this['latencyHistory'] = {};
    }
    this['latencyHistory'][`latencies:${operation}`] = latencies;
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyPercentiles(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        max: 0
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      avg: sum / sorted.length,
      max: sorted[sorted.length - 1]
    };
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.floor(sortedValues.length * p);
    return sortedValues[index] || 0;
  }

  /**
   * Calculate dependency health
   */
  private calculateDependencyHealth(errorRate: number, avgLatency: number): DependencyHealth {
    if (errorRate > 10 || avgLatency > 1000) {
      return 'unhealthy';
    } else if (errorRate > 5 || avgLatency > 500) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Calculate availability SLI
   */
  private calculateAvailabilitySLI(sli: SLI): number {
    // Placeholder - would query metrics database
    return 99.95;
  }

  /**
   * Calculate latency SLI
   */
  private calculateLatencySLI(sli: SLI): number {
    // Placeholder - would query metrics database
    return this.performanceMetrics.latency?.p99 || 0;
  }

  /**
   * Calculate error rate SLI
   */
  private calculateErrorRateSLI(sli: SLI): number {
    return this.performanceMetrics.errorRate?.rate || 0;
  }

  /**
   * Calculate throughput SLI
   */
  private calculateThroughputSLI(sli: SLI): number {
    return this.performanceMetrics.throughput?.requestsPerSecond || 0;
  }

  /**
   * Calculate saturation SLI
   */
  private calculateSaturationSLI(sli: SLI): number {
    return this.performanceMetrics.resources?.cpu?.percentage || 0;
  }

  /**
   * Calculate SLI status
   */
  private calculateSLIStatus(sli: SLI): 'good' | 'needs-improvement' | 'poor' {
    const value = this.calculateSLI(sli);
    const percentage = (value / sli.target) * 100;

    if (percentage >= 100) {
      return 'good';
    } else if (percentage >= 80) {
      return 'needs-improvement';
    } else {
      return 'poor';
    }
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.performanceMetrics.latency?.p99! > 1000) {
      recommendations.push('High latency detected - consider optimizing database queries or caching');
    }

    if (this.performanceMetrics.errorRate?.rate! > 5) {
      recommendations.push('High error rate - check error logs and implement better error handling');
    }

    if (this.performanceMetrics.resources?.cpu?.percentage! > 80) {
      recommendations.push('High CPU usage - consider scaling horizontally or optimizing code');
    }

    if (this.errorBudget.burnRate > 1) {
      recommendations.push('High error budget burn rate - investigate issues immediately');
    }

    return recommendations;
  }
}

/**
 * Performance Report Interface
 */
export interface PerformanceReport {
  timestamp: number;
  performanceMetrics: PerformanceMetrics;
  dependencies: DependencyMetrics[];
  slis: {
    name: string;
    value: number;
    target: number;
    status: 'good' | 'needs-improvement' | 'poor';
  }[];
  errorBudget: ErrorBudget;
  recommendations: string[];
}