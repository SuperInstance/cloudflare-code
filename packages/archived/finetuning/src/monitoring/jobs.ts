/**
 * Training Job Monitoring System
 * Real-time monitoring, alerts, and metrics for training jobs
 */

// @ts-nocheck

import type {
  TrainingJob,
  SystemMetrics,
  Alert,
  ThroughputMetrics,
  ResourceUsage,
  Env,
  TrainingStatus,
  Webhook,
  WebhookEvent,
  WebhookPayload,
} from '../types';

// ============================================================================
// Monitoring Configuration
// ============================================================================

interface MonitoringConfig {
  alertThresholds: {
    failureRate: number;
    avgLatency: number;
    errorRate: number;
    queueDepth: number;
    resourceUsage: number;
  };
  alertCooldown: number;
  metricsRetentionDays: number;
  enableWebhooks: boolean;
}

// ============================================================================
// Job Monitor
// ============================================================================

export class JobMonitor {
  private env: Env;
  private config: MonitoringConfig;
  private activeJobs: Map<string, TrainingJob> = new Map();
  private metricsHistory: Map<string, Array<{ timestamp: number; metrics: any }>> = new Map();
  private alertHistory: Alert[] = [];

  constructor(env: Env, config?: Partial<MonitoringConfig>) {
    this.env = env;
    this.config = {
      alertThresholds: {
        failureRate: 0.1, // 10%
        avgLatency: 5000, // 5 seconds
        errorRate: 0.05, // 5%
        queueDepth: 100,
        resourceUsage: 0.9, // 90%
      },
      alertCooldown: 300000, // 5 minutes
      metricsRetentionDays: 30,
      enableWebhooks: true,
      ...config,
    };
  }

  /**
   * Start monitoring a job
   */
  async startMonitoring(job: TrainingJob): Promise<void> {
    this.activeJobs.set(job.id, job);
    await this.initializeMetricsHistory(job.id);

    // Send start notification
    await this.sendWebhook('training.started', {
      jobId: job.id,
      modelId: job.modelId,
      datasetId: job.datasetId,
      config: job.config,
    });
  }

  /**
   * Stop monitoring a job
   */
  async stopMonitoring(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Send completion notification
    await this.sendWebhook('training.completed', {
      jobId,
      status: job.status,
      metrics: job.metrics,
    });

    this.activeJobs.delete(jobId);
  }

  /**
   * Update job metrics
   */
  async updateMetrics(jobId: string, metrics: any): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Store metrics
    await this.recordMetrics(jobId, metrics);

    // Check for anomalies
    await this.checkForAnomalies(jobId, metrics);

    // Send progress updates if significant milestone
    if (job.progress.percentage > 0 && job.progress.percentage % 25 === 0) {
      await this.sendWebhook('training.progress', {
        jobId,
        progress: job.progress,
        metrics,
      });
    }
  }

  /**
   * Get job metrics history
   */
  async getMetricsHistory(
    jobId: string,
    from?: number,
    to?: number
  ): Promise<Array<{ timestamp: number; metrics: any }>> {
    const history = this.metricsHistory.get(jobId) || [];

    if (from || to) {
      return history.filter(m => {
        if (from && m.timestamp < from) return false;
        if (to && m.timestamp > to) return false;
        return true;
      });
    }

    return history;
  }

  /**
   * Get system-wide metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const jobs = Array.from(this.activeJobs.values());

    const activeJobsCount = jobs.filter(j => j.status === 'training').length;
    const queuedJobsCount = jobs.filter(j => j.status === 'queued').length;
    const completedJobsCount = jobs.filter(j => j.status === 'completed').length;
    const failedJobsCount = jobs.filter(j => j.status === 'failed').length;

    // Get recent metrics for throughput calculation
    const recentMetrics = await this.getRecentMetrics(60000); // Last minute
    const throughput = this.calculateThroughput(recentMetrics);

    return {
      activeJobs: activeJobsCount,
      queuedJobs: queuedJobsCount,
      completedJobs: completedJobsCount,
      failedJobs: failedJobsCount,
      resourceUsage: await this.getResourceUsage(),
      throughput,
    };
  }

  /**
   * Get alerts
   */
  async getAlerts(severity?: string, limit?: number): Promise<Alert[]> {
    let alerts = this.alertHistory;

    if (severity) {
      alerts = alerts.filter(a => a.type === severity);
    }

    // Sort by timestamp descending
    alerts = alerts.sort((a, b) => b.timestamp - a.timestamp);

    return limit ? alerts.slice(0, limit) : alerts;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get job performance summary
   */
  async getJobPerformanceSummary(jobId: string): Promise<{
    jobId: string;
    status: TrainingStatus;
    progress: any;
    metrics: any;
    anomalies: any[];
    recommendations: string[];
  }> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const metricsHistory = await this.getMetricsHistory(jobId);
    const anomalies = this.detectAnomalies(metricsHistory);
    const recommendations = this.generateRecommendations(job, anomalies);

    return {
      jobId,
      status: job.status,
      progress: job.progress,
      metrics: job.metrics,
      anomalies,
      recommendations,
    };
  }

  /**
   * Compare job performance
   */
  async compareJobs(jobIds: string[]): Promise<{
    jobs: Array<{ jobId: string; metrics: any; performance: string }>;
    best: string;
    worst: string;
  }> {
    const jobs = jobIds
      .map(id => this.activeJobs.get(id))
      .filter((j): j is TrainingJob => j !== undefined);

    const jobsWithPerformance = jobs.map(job => {
      const performance = this.calculateJobPerformance(job);
      return {
        jobId: job.id,
        metrics: job.metrics,
        performance,
      };
    });

    const sorted = jobsWithPerformance.sort((a, b) => {
      const scoreA = this.getPerformanceScore(a.performance);
      const scoreB = this.getPerformanceScore(b.performance);
      return scoreB - scoreA;
    });

    return {
      jobs: jobsWithPerformance,
      best: sorted[0]?.jobId || '',
      worst: sorted[sorted.length - 1]?.jobId || '',
    };
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(): Promise<{
    systemMetrics: SystemMetrics;
    activeJobs: TrainingJob[];
    recentAlerts: Alert[];
    throughput: ThroughputMetrics;
    trends: {
      jobsOverTime: Array<{ timestamp: number; count: number }>;
      avgLossOverTime: Array<{ timestamp: number; loss: number }>;
    };
  }> {
    const [systemMetrics, recentAlerts] = await Promise.all([
      this.getSystemMetrics(),
      this.getAlerts(undefined, 10),
    ]);

    const activeJobs = Array.from(this.activeJobs.values())
      .filter(j => j.status === 'training' || j.status === 'preparing');

    const throughput = systemMetrics.throughput;
    const trends = await this.calculateTrends();

    return {
      systemMetrics,
      activeJobs,
      recentAlerts,
      throughput,
      trends,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async initializeMetricsHistory(jobId: string): Promise<void> {
    if (!this.metricsHistory.has(jobId)) {
      this.metricsHistory.set(jobId, []);
    }
  }

  private async recordMetrics(jobId: string, metrics: any): Promise<void> {
    const history = this.metricsHistory.get(jobId);
    if (!history) return;

    history.push({
      timestamp: Date.now(),
      metrics,
    });

    // Prune old metrics
    const cutoff = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
    const pruned = history.filter(m => m.timestamp > cutoff);
    this.metricsHistory.set(jobId, pruned);
  }

  private async checkForAnomalies(jobId: string, metrics: any): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const history = await this.getMetricsHistory(jobId);
    const recentLosses = history.slice(-10).map(m => m.metrics.loss);

    // Check for loss spikes
    if (recentLosses.length >= 5) {
      const avgLoss = recentLosses.slice(0, -1).reduce((a, b) => a + b, 0) / (recentLosses.length - 1);
      const currentLoss = metrics.loss;

      if (currentLoss > avgLoss * 2) {
        await this.createAlert({
          type: 'warning',
          category: 'job',
          message: `Loss spike detected for job ${jobId}`,
          details: {
            jobId,
            currentLoss,
            avgLoss,
            increase: ((currentLoss - avgLoss) / avgLoss * 100).toFixed(2) + '%',
          },
        });
      }
    }

    // Check for stalled training
    if (history.length >= 20) {
      const oldLoss = history[0].metrics.loss;
      const newLoss = metrics.loss;
      const improvement = (oldLoss - newLoss) / oldLoss;

      if (improvement < 0.001) {
        await this.createAlert({
          type: 'warning',
          category: 'job',
          message: `Training stalled for job ${jobId}`,
          details: {
            jobId,
            oldLoss,
            newLoss,
            improvement: (improvement * 100).toFixed(4) + '%',
          },
        });
      }
    }

    // Check for high resource usage
    const resourceUsage = await this.getResourceUsage();
    if (resourceUsage.memory > this.config.alertThresholds.resourceUsage) {
      await this.createAlert({
        type: 'error',
        category: 'system',
        message: 'High memory usage detected',
        details: {
          usage: resourceUsage.memory,
          threshold: this.config.alertThresholds.resourceUsage,
        },
      });
    }
  }

  private detectAnomalies(history: Array<{ timestamp: number; metrics: any }>): any[] {
    const anomalies: any[] = [];

    if (history.length < 10) return anomalies;

    const losses = history.map(h => h.metrics.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
    const variance = losses.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / losses.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 0; i < losses.length; i++) {
      const zScore = Math.abs((losses[i] - mean) / stdDev);
      if (zScore > 3) {
        anomalies.push({
          timestamp: history[i].timestamp,
          type: 'statistical_outlier',
          metric: 'loss',
          value: losses[i],
          zScore,
          threshold: 3,
        });
      }
    }

    return anomalies;
  }

  private generateRecommendations(job: TrainingJob, anomalies: any[]): string[] {
    const recommendations: string[] = [];

    if (job.metrics.loss.current > 2.0) {
      recommendations.push('Consider increasing learning rate or adjusting hyperparameters');
    }

    if (anomalies.length > 5) {
      recommendations.push('High number of anomalies detected. Review data quality');
    }

    if (job.progress.currentEpoch > 0 && job.metrics.validationLoss) {
      const overfitting = job.metrics.validationLoss.current < job.metrics.loss.current * 0.8;
      if (overfitting) {
        recommendations.push('Possible overfitting. Consider regularization or early stopping');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Training is progressing normally');
    }

    return recommendations;
  }

  private calculateJobPerformance(job: TrainingJob): string {
    const loss = job.metrics.loss.current;
    const progress = job.progress.percentage;

    if (loss < 0.5 && progress > 50) {
      return 'excellent';
    } else if (loss < 1.0 && progress > 30) {
      return 'good';
    } else if (loss < 2.0) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  private getPerformanceScore(performance: string): number {
    const scores = {
      excellent: 100,
      good: 75,
      fair: 50,
      poor: 25,
    };
    return scores[performance as keyof typeof scores] || 0;
  }

  private async getResourceUsage(): Promise<ResourceUsage> {
    // Simulate resource usage (in production, get actual metrics)
    return {
      cpu: Math.random() * 0.8,
      memory: Math.random() * 0.9,
      storage: Math.random() * 0.5,
      gpu: Math.random() * 0.95,
    };
  }

  private calculateThroughput(metricsHistory: Array<any>): ThroughputMetrics {
    if (metricsHistory.length === 0) {
      return {
        requestsPerSecond: 0,
        tokensPerSecond: 0,
        avgLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
      };
    }

    const now = Date.now();
    const recentMetrics = metricsHistory.filter(m => now - m.timestamp < 60000);

    const requestsPerSecond = recentMetrics.length / 60;

    const latencies = recentMetrics.map(m => m.metrics.latency || 0);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    const sorted = latencies.sort((a, b) => a - b);
    const p50Latency = sorted[Math.floor(sorted.length * 0.5)];
    const p95Latency = sorted[Math.floor(sorted.length * 0.95)];
    const p99Latency = sorted[Math.floor(sorted.length * 0.99)];

    return {
      requestsPerSecond,
      tokensPerSecond: requestsPerSecond * 100, // Estimate
      avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
    };
  }

  private async getRecentMetrics(duration: number): Promise<Array<any>> {
    const cutoff = Date.now() - duration;
    const allMetrics: Array<any> = [];

    for (const history of this.metricsHistory.values()) {
      for (const entry of history) {
        if (entry.timestamp > cutoff) {
          allMetrics.push(entry);
        }
      }
    }

    return allMetrics;
  }

  private async calculateTrends(): Promise<{
    jobsOverTime: Array<{ timestamp: number; count: number }>;
    avgLossOverTime: Array<{ timestamp: number; loss: number }>;
  }> {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const points = 24;

    const jobsOverTime: Array<{ timestamp: number; count: number }> = [];
    const avgLossOverTime: Array<{ timestamp: number; loss: number }> = [];

    for (let i = points; i >= 0; i--) {
      const timestamp = now - (i * hour);
      const windowStart = timestamp - hour;

      // Count active jobs in this window
      let activeCount = 0;
      let totalLoss = 0;
      let lossCount = 0;

      for (const job of this.activeJobs.values()) {
        if (job.createdAt >= windowStart && job.createdAt < timestamp) {
          activeCount++;
        }

        if (job.startedAt && job.startedAt >= windowStart && job.startedAt < timestamp) {
          const history = await this.getMetricsHistory(job.id, windowStart, timestamp);
          for (const entry of history) {
            totalLoss += entry.metrics.loss;
            lossCount++;
          }
        }
      }

      jobsOverTime.push({ timestamp, count: activeCount });
      avgLossOverTime.push({
        timestamp,
        loss: lossCount > 0 ? totalLoss / lossCount : 0,
      });
    }

    return { jobsOverTime, avgLossOverTime };
  }

  private async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alertHistory.push(newAlert);

    // Prune old alerts
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > cutoff);

    // Send webhook for critical alerts
    if (alert.type === 'error' || alert.type === 'critical') {
      await this.sendWebhook('system.alert', { alert: newAlert });
    }
  }

  private async sendWebhook(event: WebhookEvent, data: any): Promise<void> {
    if (!this.config.enableWebhooks) return;

    const webhooks = await this.getActiveWebhooks();
    const payload: WebhookPayload = {
      event,
      timestamp: Date.now(),
      data,
    };

    for (const webhook of webhooks) {
      if (webhook.events.includes(event)) {
        try {
          await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': webhook.secret || '',
            },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          console.error(`Failed to send webhook to ${webhook.url}:`, error);
        }
      }
    }
  }

  private async getActiveWebhooks(): Promise<Webhook[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM webhooks WHERE active = 1'
    ).all();

    return result.results.map((row: any) => ({
      id: row.id,
      url: row.url,
      events: JSON.parse(row.events),
      secret: row.secret,
      active: row.active === 1,
      createdAt: row.created_at,
      lastTriggered: row.last_triggered,
    }));
  }
}

// ============================================================================
// Metrics Aggregator
// ============================================================================

export class MetricsAggregator {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Aggregate metrics across all jobs
   */
  async aggregateMetrics(timeRange: {
    from: number;
    to: number;
  }): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgTrainingTime: number;
    avgLoss: number;
    resourceUtilization: any;
    errorRate: number;
  }> {
    const result = await this.env.DB.prepare(`
      SELECT
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        AVG(CASE WHEN completed_at IS NOT NULL THEN (completed_at - started_at) ELSE NULL END) as avg_training_time
      FROM training_jobs
      WHERE created_at >= ? AND created_at <= ?
    `).bind(timeRange.from, timeRange.to).first();

    const totalJobs = (result?.total_jobs as number) || 0;
    const completedJobs = (result?.completed_jobs as number) || 0;
    const failedJobs = (result?.failed_jobs as number) || 0;
    const avgTrainingTime = (result?.avg_training_time as number) || 0;

    // Calculate average loss from completed jobs
    const lossResult = await this.env.DB.prepare(`
      SELECT AVG(JSON_EXTRACT(metrics, '$.loss.current')) as avg_loss
      FROM training_jobs
      WHERE status = 'completed' AND created_at >= ? AND created_at <= ?
    `).bind(timeRange.from, timeRange.to).first();

    const avgLoss = (lossResult?.avg_loss as number) || 0;

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      avgTrainingTime,
      avgLoss,
      resourceUtilization: await this.getResourceUtilization(),
      errorRate: totalJobs > 0 ? failedJobs / totalJobs : 0,
    };
  }

  /**
   * Get metrics by provider
   */
  async getMetricsByProvider(timeRange: { from: number; to: number }): Promise<{
    [provider: string]: {
      jobCount: number;
      avgLoss: number;
      avgTrainingTime: number;
    };
  }> {
    const result = await this.env.DB.prepare(`
      SELECT
        m.config->>'$.provider' as provider,
        COUNT(*) as job_count,
        AVG(JSON_EXTRACT(t.metrics, '$.loss.current')) as avg_loss,
        AVG(t.completed_at - t.started_at) as avg_training_time
      FROM training_jobs t
      JOIN models m ON t.model_id = m.id
      WHERE t.created_at >= ? AND t.created_at <= ?
      GROUP BY provider
    `).bind(timeRange.from, timeRange.to).all();

    const metrics: any = {};

    for (const row of result.results) {
      metrics[row.provider] = {
        jobCount: row.job_count,
        avgLoss: row.avg_loss,
        avgTrainingTime: row.avg_training_time,
      };
    }

    return metrics;
  }

  /**
   * Get resource utilization
   */
  async getResourceUtilization(): Promise<{
    cpu: number;
    memory: number;
    storage: number;
    gpu: number;
  }> {
    // This would typically come from a monitoring service
    // For now, return simulated data
    return {
      cpu: Math.random() * 0.8,
      memory: Math.random() * 0.9,
      storage: Math.random() * 0.5,
      gpu: Math.random() * 0.95,
    };
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

export class AlertManager {
  private env: Env;
  private alertRules: Map<string, AlertRule> = new Map();

  constructor(env: Env) {
    this.env = env;
    this.initializeDefaultRules();
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  /**
   * Evaluate all rules
   */
  async evaluateRules(metrics: any): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const rule of this.alertRules.values()) {
      if (rule.enabled && await this.shouldTrigger(rule, metrics)) {
        alerts.push({
          id: crypto.randomUUID(),
          type: rule.severity,
          category: rule.category,
          message: rule.message,
          details: rule.details,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }
    }

    return alerts;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  private initializeDefaultRules(): void {
    this.addAlertRule({
      id: 'high-failure-rate',
      name: 'High Failure Rate',
      enabled: true,
      severity: 'error',
      category: 'job',
      condition: 'failure_rate > 0.1',
      message: 'High failure rate detected',
      details: {},
    });

    this.addAlertRule({
      id: 'long-running-job',
      name: 'Long Running Job',
      enabled: true,
      severity: 'warning',
      category: 'job',
      condition: 'runtime > 86400000',
      message: 'Job running longer than 24 hours',
      details: {},
    });

    this.addAlertRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      enabled: true,
      severity: 'critical',
      category: 'system',
      condition: 'memory_usage > 0.9',
      message: 'Memory usage exceeds 90%',
      details: {},
    });
  }

  private async shouldTrigger(rule: AlertRule, metrics: any): Promise<boolean> {
    // Simple condition evaluation (in production, use a proper expression evaluator)
    const condition = rule.condition
      .replace('failure_rate', metrics.failureRate || 0)
      .replace('runtime', metrics.runtime || 0)
      .replace('memory_usage', metrics.memoryUsage || 0);

    try {
      // eslint-disable-next-line no-new-func
      return new Function('return ' + condition)();
    } catch {
      return false;
    }
  }
}

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'job' | 'system' | 'model' | 'dataset';
  condition: string;
  message: string;
  details: Record<string, any>;
}
