/**
 * Storage Analytics Manager
 * Provides comprehensive storage analytics and insights
 */

import { StorageAdapter } from '../adapters/adapter';
import type {
  StorageMetrics,
  MetricsPeriod,
  UsageReport,
  PerformanceMetrics,
  FileMetadata,
  ListOptions,
  StorageBackend,
} from '../types';

// ============================================================================
// Real-Time Analytics
// ============================================================================

export interface RealTimeAnalytics {
  timestamp: Date;
  operations: {
    uploads: number;
    downloads: number;
    deletes: number;
    updates: number;
  };
  bandwidth: {
    bytesIn: number;
    bytesOut: number;
  };
  errors: {
    count: number;
    byType: Record<string, number>;
  };
  averageLatency: number;
}

// ============================================================================
// Capacity Planning
// ============================================================================

export interface CapacityPlanning {
  currentSize: number;
  projectedGrowth: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  projectedCapacity: {
    daily: Date | null;
    weekly: Date | null;
    monthly: Date | null;
  };
  recommendations: string[];
}

// ============================================================================
// Cost Optimization
// ============================================================================

export interface CostOptimization {
  currentCost: number;
  potentialSavings: number;
  recommendations: CostOptimizationRecommendation[];
}

export interface CostOptimizationRecommendation {
  type: 'lifecycle' | 'storage_class' | 'compression' | 'deduplication' | 'cleanup';
  description: string;
  estimatedSavings: number;
  effort: 'low' | 'medium' | 'high';
  files: string[];
}

// ============================================================================
// Access Patterns
// ============================================================================

export interface AccessPattern {
  key: string;
  accessCount: number;
  lastAccess: Date;
  firstAccess: Date;
  averageAccessInterval: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  bandwidth: number;
  classification: 'hot' | 'warm' | 'cold' | 'archive';
}

// ============================================================================
// Storage Analytics Manager
// ============================================================================

export class StorageAnalyticsManager {
  private operationHistory: Map<string, RealTimeAnalytics[]> = new Map();
  private maxHistoryLength = 1000;

  constructor(private adapter: StorageAdapter) {}

  // ============================================================================
  // Metrics Collection
  // ============================================================================

  /**
   * Get storage metrics for a bucket
   */
  async getStorageMetrics(
    bucket: string,
    period: MetricsPeriod
  ): Promise<StorageMetrics> {
    const files = await this.adapter.listFiles(bucket);

    const totalSize = files.objects.reduce((sum, file) => sum + file.size, 0);
    const sizeDistribution: Record<string, number> = {};

    // Calculate size distribution
    for (const file of files.objects) {
      const sizeBucket = this.getSizeBucket(file.size);
      sizeDistribution[sizeBucket] = (sizeDistribution[sizeBucket] || 0) + 1;
    }

    // Storage class distribution
    const storageClassDistribution: Record<string, number> = {};
    for (const file of files.objects) {
      const sc = file.storageClass || 'STANDARD';
      storageClassDistribution[sc] = (storageClassDistribution[sc] || 0) + 1;
    }

    return {
      bucket,
      period,
      timestamp: new Date(),
      storage: {
        totalSize,
        objectCount: files.objects.length,
        averageSize: files.objects.length > 0 ? totalSize / files.objects.length : 0,
        sizeDistribution,
        storageClassDistribution,
        growthRate: 0, // Would need historical data
      },
      requests: {
        total: 0,
        get: 0,
        put: 0,
        delete: 0,
        list: 0,
        head: 0,
        other: 0,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
      },
      transfer: {
        bytesIn: 0,
        bytesOut: 0,
        bytesTransferred: 0,
        averageTransferSize: 0,
        peakTransferRate: 0,
      },
      errors: {
        total: 0,
        byErrorCode: {},
        byErrorType: {},
      },
    };
  }

  /**
   * Get usage report for a bucket
   */
  async getUsageReport(
    bucket: string,
    period: MetricsPeriod
  ): Promise<UsageReport> {
    const files = await this.adapter.listFiles(bucket);

    const totalStorage = files.objects.reduce((sum, file) => sum + file.size, 0);
    const totalObjects = files.objects.length;
    const averageObjectSize = totalObjects > 0 ? totalStorage / totalObjects : 0;

    // Top objects by size
    const topObjects = [...files.objects]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(file => ({
        key: file.key,
        size: file.size,
        accessCount: 0, // Would need access logs
        bandwidth: 0,
      }));

    return {
      bucket,
      period,
      summary: {
        totalStorage,
        totalRequests: 0,
        totalTransfer: 0,
        averageObjectSize,
        totalObjects,
      },
      topObjects,
      topUsers: [],
      costAnalysis: {
        storageCost: 0,
        requestCost: 0,
        transferCost: 0,
        totalCost: 0,
        byStorageClass: {},
      },
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(bucket: string): Promise<PerformanceMetrics> {
    // In a real implementation, this would analyze access logs
    return {
      latency: {
        average: 50,
        p50: 40,
        p90: 80,
        p95: 100,
        p99: 150,
        p999: 200,
      },
      throughput: {
        requestsPerSecond: 100,
        bytesPerSecond: 10000000,
        peakRequestsPerSecond: 500,
        peakBytesPerSecond: 50000000,
      },
      availability: {
        uptime: 99.99,
        downtime: 0.01,
        availability: 99.99,
        incidents: [],
      },
    };
  }

  // ============================================================================
  // Real-Time Analytics
  // ============================================================================

  /**
   * Record an operation for analytics
   */
  recordOperation(
    bucket: string,
    operation: 'upload' | 'download' | 'delete' | 'update',
    bytes: number,
    latency: number
  ): void {
    let history = this.operationHistory.get(bucket);
    if (!history) {
      history = [];
      this.operationHistory.set(bucket, history);
    }

    const latest = history[history.length - 1];
    const now = new Date();

    if (latest && (now.getTime() - latest.timestamp.getTime()) < 60000) {
      // Update existing entry (within last minute)
      switch (operation) {
        case 'upload':
          latest.operations.uploads++;
          latest.bandwidth.bytesOut += bytes;
          break;
        case 'download':
          latest.operations.downloads++;
          latest.bandwidth.bytesIn += bytes;
          break;
        case 'delete':
          latest.operations.deletes++;
          break;
        case 'update':
          latest.operations.updates++;
          break;
      }
      latest.averageLatency =
        (latest.averageLatency + latency) / 2;
    } else {
      // Create new entry
      const newEntry: RealTimeAnalytics = {
        timestamp: now,
        operations: {
          uploads: operation === 'upload' ? 1 : 0,
          downloads: operation === 'download' ? 1 : 0,
          deletes: operation === 'delete' ? 1 : 0,
          updates: operation === 'update' ? 1 : 0,
        },
        bandwidth: {
          bytesIn: operation === 'download' ? bytes : 0,
          bytesOut: operation === 'upload' ? bytes : 0,
        },
        errors: {
          count: 0,
          byType: {},
        },
        averageLatency: latency,
      };

      history.push(newEntry);

      // Trim history if needed
      if (history.length > this.maxHistoryLength) {
        history.shift();
      }
    }
  }

  /**
   * Get real-time analytics for a bucket
   */
  getRealTimeAnalytics(bucket: string): RealTimeAnalytics | null {
    const history = this.operationHistory.get(bucket);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get operations rate for a bucket
   */
  getOperationsRate(
    bucket: string,
    windowMinutes: number = 5
  ): {
    uploadsPerMinute: number;
    downloadsPerMinute: number;
    deletesPerMinute: number;
    totalPerMinute: number;
  } {
    const history = this.operationHistory.get(bucket);
    if (!history || history.length === 0) {
      return {
        uploadsPerMinute: 0,
        downloadsPerMinute: 0,
        deletesPerMinute: 0,
        totalPerMinute: 0,
      };
    }

    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const relevant = history.filter(h => h.timestamp.getTime() >= cutoff);

    const uploads = relevant.reduce((sum, h) => sum + h.operations.uploads, 0);
    const downloads = relevant.reduce((sum, h) => sum + h.operations.downloads, 0);
    const deletes = relevant.reduce((sum, h) => sum + h.operations.deletes, 0);

    return {
      uploadsPerMinute: uploads / windowMinutes,
      downloadsPerMinute: downloads / windowMinutes,
      deletesPerMinute: deletes / windowMinutes,
      totalPerMinute: (uploads + downloads + deletes) / windowMinutes,
    };
  }

  // ============================================================================
  // Access Patterns
  // ============================================================================

  /**
   * Analyze access patterns for files
   */
  async analyzeAccessPatterns(
    bucket: string,
    prefix?: string
  ): Promise<AccessPattern[]> {
    const files = await this.adapter.listFiles(bucket, { prefix });

    // In a real implementation, this would analyze access logs
    // For now, return mock data
    const patterns: AccessPattern[] = files.objects.map(file => ({
      key: file.key,
      accessCount: Math.floor(Math.random() * 1000),
      lastAccess: new Date(),
      firstAccess: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      averageAccessInterval: 3600000, // 1 hour
      trend: 'stable',
      bandwidth: file.size * 10,
      classification: 'warm',
    }));

    // Sort by access count
    patterns.sort((a, b) => b.accessCount - a.accessCount);

    return patterns;
  }

  /**
   * Classify files by access pattern
   */
  async classifyFilesByAccess(
    bucket: string,
    prefix?: string
  ): Promise<{
    hot: AccessPattern[];
    warm: AccessPattern[];
    cold: AccessPattern[];
    archive: AccessPattern[];
  }> {
    const patterns = await this.analyzeAccessPatterns(bucket, prefix);

    return {
      hot: patterns.filter(p => p.classification === 'hot'),
      warm: patterns.filter(p => p.classification === 'warm'),
      cold: patterns.filter(p => p.classification === 'cold'),
      archive: patterns.filter(p => p.classification === 'archive'),
    };
  }

  // ============================================================================
  // Capacity Planning
  // ============================================================================

  /**
   * Generate capacity planning report
   */
  async generateCapacityPlanning(
    bucket: string,
    historicalDays: number = 30
  ): Promise<CapacityPlanning> {
    const current = await this.getStorageMetrics(bucket, {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    });

    const currentSize = current.storage.totalSize;

    // Calculate growth rate based on historical data
    // In a real implementation, this would analyze historical metrics
    const dailyGrowthRate = 0.01; // 1% per day
    const weeklyGrowthRate = Math.pow(1 + dailyGrowthRate, 7) - 1;
    const monthlyGrowthRate = Math.pow(1 + dailyGrowthRate, 30) - 1;
    const quarterlyGrowthRate = Math.pow(1 + dailyGrowthRate, 90) - 1;
    const yearlyGrowthRate = Math.pow(1 + dailyGrowthRate, 365) - 1;

    const recommendations: string[] = [];

    // Project when capacity will be reached (assuming 1TB limit)
    const capacityLimit = 1024 * 1024 * 1024 * 1024; // 1TB
    const daysUntilFull = Math.log(capacityLimit / currentSize) / Math.log(1 + dailyGrowthRate);

    return {
      currentSize,
      projectedGrowth: {
        daily: currentSize * dailyGrowthRate,
        weekly: currentSize * weeklyGrowthRate,
        monthly: currentSize * monthlyGrowthRate,
        quarterly: currentSize * quarterlyGrowthRate,
        yearly: currentSize * yearlyGrowthRate,
      },
      projectedCapacity: {
        daily: daysUntilFull > 365 ? null : new Date(Date.now() + daysUntilFull * 24 * 60 * 60 * 1000),
        weekly: null,
        monthly: null,
      },
      recommendations,
    };
  }

  // ============================================================================
  // Cost Optimization
  // ============================================================================

  /**
   * Generate cost optimization recommendations
   */
  async generateCostOptimization(
    bucket: string,
    prefix?: string
  ): Promise<CostOptimization> {
    const files = await this.adapter.listFiles(bucket, { prefix });
    const currentCost = await this.estimateStorageCost(bucket);

    const recommendations: CostOptimizationRecommendation[] = [];

    // Find large files that could be compressed
    const largeFiles = files.objects.filter(f => f.size > 1024 * 1024); // > 1MB
    if (largeFiles.length > 0) {
      recommendations.push({
        type: 'compression',
        description: 'Compress large files to reduce storage costs',
        estimatedSavings: largeFiles.length * 0.01, // $0.01 per file
        effort: 'low',
        files: largeFiles.slice(0, 10).map(f => f.key),
      });
    }

    // Find old files that could move to cheaper storage
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    const oldFiles = files.objects.filter(f => f.lastModified < cutoffDate);
    if (oldFiles.length > 0) {
      recommendations.push({
        type: 'storage_class',
        description: 'Move old files to infrequent access storage class',
        estimatedSavings: oldFiles.reduce((sum, f) => sum + f.size, 0) * 0.000001, // $0.001 per GB
        effort: 'low',
        files: oldFiles.slice(0, 10).map(f => f.key),
      });
    }

    const potentialSavings = recommendations.reduce(
      (sum, r) => sum + r.estimatedSavings,
      0
    );

    return {
      currentCost,
      potentialSavings,
      recommendations,
    };
  }

  /**
   * Estimate storage cost
   */
  async estimateStorageCost(bucket: string): Promise<number> {
    const metrics = await this.getStorageMetrics(bucket, {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    });

    // Pricing (example for S3)
    const standardPrice = 0.023; // per GB per month
    const standardSize = metrics.storage.storageClassDistribution['STANDARD'] ?? 0;
    const iaPrice = 0.0125; // per GB per month
    const iaSize = metrics.storage.storageClassDistribution['STANDARD_IA'] ?? 0;
    const glacierPrice = 0.004; // per GB per month
    const glacierSize = metrics.storage.storageClassDistribution['GLACIER'] ?? 0;

    return (
      (standardSize * standardPrice +
        iaSize * iaPrice +
        glacierSize * glacierPrice) /
      (1024 * 1024 * 1024)
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get size bucket for classification
   */
  private getSizeBucket(size: number): string {
    if (size < 1024) return '0-1KB';
    if (size < 10240) return '1KB-10KB';
    if (size < 102400) return '10KB-100KB';
    if (size < 1048576) return '100KB-1MB';
    if (size < 10485760) return '1MB-10MB';
    if (size < 104857600) return '10MB-100MB';
    if (size < 1073741824) return '100MB-1GB';
    return '1GB+';
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Calculate percentage change
   */
  calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Clear analytics history
   */
  clearHistory(bucket?: string): void {
    if (bucket) {
      this.operationHistory.delete(bucket);
    } else {
      this.operationHistory.clear();
    }
  }

  /**
   * Export analytics data
   */
  exportAnalytics(bucket: string): object {
    const history = this.operationHistory.get(bucket) ?? [];

    return {
      bucket,
      history: history.map(h => ({
        ...h,
        timestamp: h.timestamp.toISOString(),
      })),
    };
  }

  /**
   * Import analytics data
   */
  importAnalytics(data: any): void {
    if (data.bucket && data.history) {
      const history: RealTimeAnalytics[] = data.history.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      }));

      this.operationHistory.set(data.bucket, history);
    }
  }
}
