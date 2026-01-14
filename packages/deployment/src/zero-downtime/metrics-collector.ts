/**
 * Metrics Collector for Deployments
 * Collects and aggregates deployment metrics
 */

import {
  DeploymentMetrics,
  TargetMetrics,
  HealthCheckMetrics,
  HealthCheckResult,
  TestMetrics,
  TrafficMetrics,
  ErrorMetric,
} from '../types';
import { Logger } from '../utils/logger';

export interface MetricsCollectorOptions {
  deploymentId: string;
  logger?: Logger;
}

export interface TargetDeploymentRecord {
  targetId: string;
  targetName: string;
  deployTime: Date;
  successTime?: Date;
  errorTime?: Date;
  error?: Error;
}

export class MetricsCollector {
  private deploymentId: string;
  private logger: Logger;
  private targetRecords: Map<string, TargetDeploymentRecord> = new Map();
  private healthCheckResults: HealthCheckResult[] = [];
  private errors: ErrorMetric[] = [];
  private startTime: Date = new Date();
  private endTime?: Date;

  // Traffic metrics
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private responseTimes: number[] = [];

  constructor(options: MetricsCollectorOptions) {
    this.deploymentId = options.deploymentId;
    this.logger = options.logger || new Logger({ component: 'MetricsCollector' });
  }

  /**
   * Record target deployment start
   */
  recordTargetDeployment(targetId: string, targetName: string): void {
    this.logger.debug('Recording target deployment', {
      targetId,
      targetName,
    });

    this.targetRecords.set(targetId, {
      targetId,
      targetName,
      deployTime: new Date(),
    });
  }

  /**
   * Record target deployment success
   */
  recordTargetSuccess(targetId: string, targetName: string): void {
    this.logger.debug('Recording target success', {
      targetId,
      targetName,
    });

    const record = this.targetRecords.get(targetId);
    if (record) {
      record.successTime = new Date();
    }
  }

  /**
   * Record target deployment error
   */
  recordTargetError(targetId: string, targetName: string, error: Error): void {
    this.logger.debug('Recording target error', {
      targetId,
      targetName,
      error: error.message,
    });

    const record = this.targetRecords.get(targetId);
    if (record) {
      record.errorTime = new Date();
      record.error = error;
    }
  }

  /**
   * Record health check result
   */
  recordHealthCheck(result: HealthCheckResult): void {
    this.healthCheckResults.push(result);
  }

  /**
   * Record error metric
   */
  recordError(error: ErrorMetric): void {
    this.errors.push(error);
  }

  /**
   * Record request metrics
   */
  recordRequest(success: boolean, responseTime: number): void {
    this.totalRequests++;
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
    this.responseTimes.push(responseTime);
  }

  /**
   * Collect all metrics
   */
  async collect(): Promise<DeploymentMetrics> {
    this.endTime = new Date();

    const duration = this.endTime.getTime() - this.startTime.getTime();

    return {
      deploymentId: this.deploymentId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration,
      status: this.calculateStatus(),
      targets: this.calculateTargetMetrics(),
      healthChecks: this.calculateHealthCheckMetrics(),
      tests: this.calculateTestMetrics(),
      traffic: this.calculateTrafficMetrics(),
      errors: this.errors,
    };
  }

  /**
   * Calculate overall deployment status
   */
  private calculateStatus(): any {
    const totalTargets = this.targetRecords.size;
    const successfulTargets = Array.from(this.targetRecords.values()).filter(
      (r) => r.successTime
    ).length;
    const failedTargets = Array.from(this.targetRecords.values()).filter(
      (r) => r.errorTime
    ).length;

    if (failedTargets > 0) {
      return 'failed';
    } else if (successfulTargets === totalTargets) {
      return 'success';
    } else {
      return 'in-progress';
    }
  }

  /**
   * Calculate target metrics
   */
  private calculateTargetMetrics(): TargetMetrics[] {
    const metrics: TargetMetrics[] = [];

    for (const record of this.targetRecords.values()) {
      const success = !!record.successTime;
      const failed = !!record.errorTime;

      metrics.push({
        targetId: record.targetId,
        targetName: record.targetName,
        instancesDeployed: 1,
        instancesHealthy: success ? 1 : 0,
        instancesFailed: failed ? 1 : 0,
        percentage: success ? 100 : failed ? 0 : 50,
      });
    }

    return metrics;
  }

  /**
   * Calculate health check metrics
   */
  private calculateHealthCheckMetrics(): HealthCheckMetrics {
    const total = this.healthCheckResults.length;
    const passed = this.healthCheckResults.filter((r) => r.status === 'pass')
      .length;
    const failed = this.healthCheckResults.filter((r) => r.status === 'fail')
      .length;
    const skipped = this.healthCheckResults.filter((r) => r.status === 'skip')
      .length;

    return {
      total,
      passed,
      failed,
      skipped,
      passRate: total > 0 ? (passed / total) * 100 : 100,
      checks: this.healthCheckResults,
    };
  }

  /**
   * Calculate test metrics
   */
  private calculateTestMetrics(): TestMetrics {
    // For now, return empty test metrics
    // These would be populated by the smoke test runner
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 100,
      tests: [],
    };
  }

  /**
   * Calculate traffic metrics
   */
  private calculateTrafficMetrics(): TrafficMetrics {
    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0;

    const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99);

    const p95ResponseTime =
      sortedResponseTimes[p95Index] || averageResponseTime;
    const p99ResponseTime =
      sortedResponseTimes[p99Index] || averageResponseTime;

    const errorRate =
      this.totalRequests > 0
        ? (this.failedRequests / this.totalRequests) * 100
        : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
    };
  }

  /**
   * Get real-time metrics snapshot
   */
  getSnapshot(): Partial<DeploymentMetrics> {
    return {
      deploymentId: this.deploymentId,
      startTime: this.startTime,
      targets: this.calculateTargetMetrics(),
      healthChecks: this.calculateHealthCheckMetrics(),
      traffic: this.calculateTrafficMetrics(),
    };
  }

  /**
   * Reset the metrics collector
   */
  reset(): void {
    this.targetRecords.clear();
    this.healthCheckResults = [];
    this.errors = [];
    this.startTime = new Date();
    this.endTime = undefined;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
  }

  /**
   * Export metrics as JSON
   */
  exportJson(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  /**
   * Export metrics as Prometheus format
   */
  exportPrometheus(): string {
    const metrics = this.getSnapshot();
    const lines: string[] = [];

    // Deployment info
    lines.push(
      `deployment_info{id="${this.deploymentId}",status="${metrics.status}"} 1`
    );

    // Target metrics
    for (const target of metrics.targets || []) {
      lines.push(
        `deployment_target_deployed{deployment="${this.deploymentId}",target="${target.targetId}"} ${target.instancesDeployed}`
      );
      lines.push(
        `deployment_target_healthy{deployment="${this.deploymentId}",target="${target.targetId}"} ${target.instancesHealthy}`
      );
      lines.push(
        `deployment_target_failed{deployment="${this.deploymentId}",target="${target.targetId}"} ${target.instancesFailed}`
      );
    }

    // Health check metrics
    const hc = metrics.healthChecks;
    if (hc) {
      lines.push(
        `deployment_healthcheck_total{deployment="${this.deploymentId}"} ${hc.total}`
      );
      lines.push(
        `deployment_healthcheck_passed{deployment="${this.deploymentId}"} ${hc.passed}`
      );
      lines.push(
        `deployment_healthcheck_failed{deployment="${this.deploymentId}"} ${hc.failed}`
      );
      lines.push(
        `deployment_healthcheck_pass_rate{deployment="${this.deploymentId}"} ${hc.passRate}`
      );
    }

    // Traffic metrics
    const traffic = metrics.traffic;
    if (traffic) {
      lines.push(
        `deployment_requests_total{deployment="${this.deploymentId}"} ${traffic.totalRequests}`
      );
      lines.push(
        `deployment_requests_successful{deployment="${this.deploymentId}"} ${traffic.successfulRequests}`
      );
      lines.push(
        `deployment_requests_failed{deployment="${this.deploymentId}"} ${traffic.failedRequests}`
      );
      lines.push(
        `deployment_response_time_avg{deployment="${this.deploymentId}"} ${traffic.averageResponseTime}`
      );
      lines.push(
        `deployment_response_time_p95{deployment="${this.deploymentId}"} ${traffic.p95ResponseTime}`
      );
      lines.push(
        `deployment_error_rate{deployment="${this.deploymentId}"} ${traffic.errorRate}`
      );
    }

    return lines.join('\n');
  }
}
