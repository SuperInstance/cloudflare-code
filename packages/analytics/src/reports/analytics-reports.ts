/**
 * Analytics Reports
 * Generate comprehensive analytics reports
 */

import {
  AnalyticsReport,
  ReportType,
  TimeRange,
  ReportFilter,
  ReportData,
  ReportSummary,
  DataPoint,
  Comparison,
  Visualization,
} from '../types/index.js';
import { RealtimeMonitor } from '../monitoring/realtime-monitor.js';

export interface ReportConfig {
  name: string;
  description: string;
  type: ReportType;
  metrics: string[];
  timeRange: TimeRange;
  filters?: ReportFilter[];
  visualizations?: Array<{
    type: 'line' | 'bar' | 'pie' | 'table' | 'heatmap' | 'funnel';
    title: string;
  }>;
}

export class AnalyticsReportsService {
  private monitor: RealtimeMonitor;
  private reports: Map<string, AnalyticsReport> = new Map();

  constructor(monitor: RealtimeMonitor) {
    this.monitor = monitor;
  }

  /**
   * Create a new report
   */
  async createReport(config: ReportConfig): Promise<AnalyticsReport> {
    const report: AnalyticsReport = {
      id: this.generateReportId(),
      name: config.name,
      description: config.description,
      type: config.type,
      timeRange: config.timeRange,
      metrics: config.metrics,
      filters: config.filters || [],
      data: await this.generateReportData(config),
      visualizations: await this.generateVisualizations(config),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.reports.set(report.id, report);

    return report;
  }

  /**
   * Get report by ID
   */
  getReport(reportId: string): AnalyticsReport | null {
    return this.reports.get(reportId) || null;
  }

  /**
   * List all reports
   */
  listReports(filters?: {
    type?: ReportType;
    limit?: number;
    offset?: number;
  }): AnalyticsReport[] {
    let reports = Array.from(this.reports.values());

    if (filters?.type) {
      reports = reports.filter(r => r.type === filters.type);
    }

    reports.sort((a, b) => b.updatedAt - a.updatedAt);

    if (filters?.offset) {
      reports = reports.slice(filters.offset);
    }

    if (filters?.limit) {
      reports = reports.slice(0, filters.limit);
    }

    return reports;
  }

  /**
   * Update report
   */
  async updateReport(
    reportId: string,
    updates: Partial<ReportConfig>
  ): Promise<AnalyticsReport> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const updated: AnalyticsReport = {
      ...report,
      ...updates,
      id: report.id,
      data: await this.generateReportData({ ...report, ...updates }),
      visualizations: await this.generateVisualizations({ ...report, ...updates }),
      updatedAt: Date.now(),
    };

    this.reports.set(reportId, updated);

    return updated;
  }

  /**
   * Delete report
   */
  deleteReport(reportId: string): void {
    this.reports.delete(reportId);
  }

  /**
   * Refresh report data
   */
  async refreshReport(reportId: string): Promise<AnalyticsReport> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const config: ReportConfig = {
      name: report.name,
      description: report.description,
      type: report.type,
      metrics: report.metrics,
      timeRange: report.timeRange,
      filters: report.filters,
    };

    const updated: AnalyticsReport = {
      ...report,
      data: await this.generateReportData(config),
      visualizations: await this.generateVisualizations(config),
      updatedAt: Date.now(),
    };

    this.reports.set(reportId, updated);

    return updated;
  }

  /**
   * Export report
   */
  async exportReport(
    reportId: string,
    format: 'json' | 'csv' | 'pdf'
  ): Promise<{ data: any; contentType: string }> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    switch (format) {
      case 'json':
        return {
          data: JSON.stringify(report, null, 2),
          contentType: 'application/json',
        };
      case 'csv':
        return {
          data: this.convertToCSV(report),
          contentType: 'text/csv',
        };
      case 'pdf':
        // Would need PDF generation library
        return {
          data: 'PDF generation not implemented',
          contentType: 'application/pdf',
        };
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Schedule report
   */
  async scheduleReport(
    reportId: string,
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time?: string;
      timezone?: string;
      recipients: string[];
    }
  ): Promise<void> {
    // Implement scheduling logic
    console.log(`Scheduled report ${reportId}:`, schedule);
  }

  // ==========================================================================
  // Report Generators
  // ==========================================================================

  /**
   * Generate performance report
   */
  async generatePerformanceReport(timeRange: TimeRange): Promise<AnalyticsReport> {
    return this.createReport({
      name: 'Performance Report',
      description: 'Overview of system performance metrics',
      type: 'performance',
      metrics: ['request_count', 'response_time', 'error_rate', 'cpu_usage', 'memory_usage'],
      timeRange,
      visualizations: [
        { type: 'line', title: 'Response Time Over Time' },
        { type: 'bar', title: 'Error Rate by Type' },
        { type: 'heatmap', title: 'Resource Usage Heatmap' },
      ],
    });
  }

  /**
   * Generate executive summary report
   */
  async generateExecutiveSummary(timeRange: TimeRange): Promise<AnalyticsReport> {
    return this.createReport({
      name: 'Executive Summary',
      description: 'High-level overview for stakeholders',
      type: 'executive_summary',
      metrics: ['request_count', 'response_time', 'error_rate', 'user_satisfaction'],
      timeRange,
      visualizations: [
        { type: 'bar', title: 'Key Metrics Summary' },
        { type: 'line', title: 'Trend Analysis' },
      ],
    });
  }

  /**
   * Generate custom report
   */
  async generateCustomReport(config: ReportConfig): Promise<AnalyticsReport> {
    return this.createReport(config);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async generateReportData(config: ReportConfig): Promise<ReportData> {
    const metrics = await this.monitor.getPerformanceMetrics(
      config.timeRange.duration
    );

    const summary: ReportSummary = {
      total: await this.getTotalMetric(config.metrics[0], config.timeRange),
      average: metrics.responseTime.avg,
      change: await this.calculateChange(config.metrics[0], config.timeRange),
      changePercent: await this.calculateChangePercent(config.metrics[0], config.timeRange),
    };

    const breakdown: DataPoint[] = await this.generateBreakdown(config);

    const comparisons: Comparison[] = await this.generateComparisons(config);

    return {
      summary,
      breakdown,
      comparisons,
    };
  }

  private async generateVisualizations(
    config: ReportConfig
  ): Promise<Visualization[]> {
    const visualizations: Visualization[] = [];

    for (const vizConfig of config.visualizations || []) {
      const data = await this.getVisualizationData(config, vizConfig.type);

      visualizations.push({
        type: vizConfig.type,
        title: vizConfig.title,
        data,
        config: {},
      });
    }

    return visualizations;
  }

  private async getVisualizationData(config: ReportConfig, type: string): Promise<any> {
    switch (type) {
      case 'line':
        return await this.getLineChartData(config);
      case 'bar':
        return await this.getBarChartData(config);
      case 'pie':
        return await this.getPieChartData(config);
      case 'table':
        return await this.getTableData(config);
      case 'heatmap':
        return await this.getHeatmapData(config);
      case 'funnel':
        return await this.getFunnelData(config);
      default:
        return {};
    }
  }

  private async getLineChartData(config: ReportConfig): Promise<any> {
    const data: any = {
      labels: [],
      datasets: [],
    };

    for (const metric of config.metrics) {
      const timeSeries = await this.monitor.getTimeSeries(
        metric,
        {},
        { start: config.timeRange.start, end: config.timeRange.end }
      );

      const dataset = {
        label: metric,
        data: timeSeries.map(d => ({ x: d.timestamp, y: d.value })),
        borderColor: this.getColorForMetric(metric),
      };

      data.datasets.push(dataset);
    }

    data.labels = data.datasets[0]?.data.map((d: any) => d.x) || [];

    return data;
  }

  private async getBarChartData(config: ReportConfig): Promise<any> {
    const data: any = {
      labels: [],
      datasets: [],
    };

    // Group by hour
    const hourlyData: Record<number, Record<string, number>> = {};

    for (const metric of config.metrics) {
      const timeSeries = await this.monitor.getTimeSeries(
        metric,
        {},
        { start: config.timeRange.start, end: config.timeRange.end }
      );

      for (const point of timeSeries) {
        const hour = Math.floor(point.timestamp / 3600000);
        if (!hourlyData[hour]) {
          hourlyData[hour] = {};
        }
        hourlyData[hour][metric] = (hourlyData[hour][metric] || 0) + point.value;
      }
    }

    const hours = Object.keys(hourlyData).sort();
    data.labels = hours;
    data.datasets = config.metrics.map(metric => ({
      label: metric,
      data: hours.map(hour => hourlyData[hour][metric] || 0),
      backgroundColor: this.getColorForMetric(metric),
    }));

    return data;
  }

  private async getPieChartData(config: ReportConfig): Promise<any> {
    const metric = config.metrics[0];
    const timeSeries = await this.monitor.getTimeSeries(
      metric,
      {},
      { start: config.timeRange.start, end: config.timeRange.end }
    );

    // Group by value ranges
    const buckets: Record<string, number> = {};

    for (const point of timeSeries) {
      const bucket = this.getBucketForValue(point.value, metric);
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    }

    return {
      labels: Object.keys(buckets),
      datasets: [{
        data: Object.values(buckets),
        backgroundColor: Object.keys(buckets).map((_, i) => this.getColorByIndex(i)),
      }],
    };
  }

  private async getTableData(config: ReportConfig): Promise<any> {
    const rows: any[] = [];

    for (const metric of config.metrics) {
      const stats = await this.monitor.getMetricStatistics(
        metric,
        config.timeRange.duration
      );

      rows.push({
        metric,
        count: stats.count,
        min: stats.min,
        max: stats.max,
        mean: stats.mean,
        median: stats.median,
        std: stats.std,
        trend: stats.trend,
      });
    }

    return {
      columns: ['Metric', 'Count', 'Min', 'Max', 'Mean', 'Median', 'Std Dev', 'Trend'],
      rows,
    };
  }

  private async getHeatmapData(config: ReportConfig): Promise<any> {
    const data: any[] = [];

    for (const metric of config.metrics) {
      const timeSeries = await this.monitor.getTimeSeries(
        metric,
        {},
        { start: config.timeRange.start, end: config.timeRange.end }
      );

      for (const point of timeSeries) {
        data.push({
          x: point.timestamp,
          y: metric,
          v: point.value,
        });
      }
    }

    return { data };
  }

  private async getFunnelData(config: ReportConfig): Promise<any> {
    // Funnel visualization for conversion metrics
    return {
      labels: ['View', 'Click', 'Sign Up', 'Purchase'],
      datasets: [{
        data: [1000, 600, 300, 100],
        backgroundColor: this.getColorByIndex(0),
      }],
    };
  }

  private async generateBreakdown(config: ReportConfig): Promise<DataPoint[]> {
    const breakdown: DataPoint[] = [];

    for (const metric of config.metrics) {
      const stats = await this.monitor.getMetricStatistics(
        metric,
        config.timeRange.duration
      );

      breakdown.push({
        dimension: metric,
        value: stats.mean,
        breakdown: [],
      });
    }

    return breakdown;
  }

  private async generateComparisons(config: ReportConfig): Promise<Comparison[]> {
    const comparisons: Comparison[] = [];

    const previousRange: TimeRange = {
      start: config.timeRange.start - config.timeRange.duration,
      end: config.timeRange.start,
      duration: config.timeRange.duration,
    };

    for (const metric of config.metrics) {
      const currentValue = await this.getTotalMetric(metric, config.timeRange);
      const previousValue = await this.getTotalMetric(metric, previousRange);

      comparisons.push({
        period: 'current',
        value: currentValue,
        change: currentValue - previousValue,
        changePercent: ((currentValue - previousValue) / previousValue) * 100,
      });
    }

    return comparisons;
  }

  private async getTotalMetric(metric: string, timeRange: TimeRange): Promise<number> {
    const timeSeries = await this.monitor.getTimeSeries(
      metric,
      {},
      { start: timeRange.start, end: timeRange.end }
    );

    return timeSeries.reduce((sum, point) => sum + point.value, 0);
  }

  private async calculateChange(metric: string, timeRange: TimeRange): Promise<number> {
    const previousRange: TimeRange = {
      start: timeRange.start - timeRange.duration,
      end: timeRange.start,
      duration: timeRange.duration,
    };

    const current = await this.getTotalMetric(metric, timeRange);
    const previous = await this.getTotalMetric(metric, previousRange);

    return current - previous;
  }

  private async calculateChangePercent(metric: string, timeRange: TimeRange): Promise<number> {
    const previousRange: TimeRange = {
      start: timeRange.start - timeRange.duration,
      end: timeRange.start,
      duration: timeRange.duration,
    };

    const current = await this.getTotalMetric(metric, timeRange);
    const previous = await this.getTotalMetric(metric, previousRange);

    return previous > 0 ? ((current - previous) / previous) * 100 : 0;
  }

  private getBucketForValue(value: number, metric: string): string {
    if (metric === 'response_time') {
      if (value < 100) return '< 100ms';
      if (value < 500) return '100-500ms';
      if (value < 1000) return '500-1000ms';
      return '> 1000ms';
    }

    if (metric === 'error_total') {
      if (value === 0) return 'No errors';
      if (value < 10) return '1-10 errors';
      if (value < 100) return '10-100 errors';
      return '100+ errors';
    }

    return 'Other';
  }

  private getColorForMetric(metric: string): string {
    const colors: Record<string, string> = {
      request_count: '#3b82f6',
      response_time: '#10b981',
      error_total: '#ef4444',
      cpu_usage: '#f59e0b',
      memory_usage: '#8b5cf6',
    };

    return colors[metric] || '#6b7280';
  }

  private getColorByIndex(index: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  }

  private convertToCSV(report: AnalyticsReport): string {
    const rows: string[] = [];

    // Header
    rows.push(`Report: ${report.name}`);
    rows.push(`Generated: ${new Date(report.updatedAt).toISOString()}`);
    rows.push('');

    // Summary
    rows.push('Summary');
    rows.push(`Total,${report.data.summary.total}`);
    rows.push(`Average,${report.data.summary.average}`);
    rows.push(`Change,${report.data.summary.change}`);
    rows.push(`Change Percent,${report.data.summary.changePercent}`);
    rows.push('');

    // Breakdown
    rows.push('Breakdown');
    for (const point of report.data.breakdown) {
      rows.push(`${point.dimension},${point.value}`);
    }

    return rows.join('\n');
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}

// ============================================================================
// Report Templates
// ============================================================================

export class ReportTemplates {
  static templates: Record<string, Omit<ReportConfig, 'timeRange'>> = {
    daily_performance: {
      name: 'Daily Performance Report',
      description: 'Daily overview of system performance',
      type: 'performance',
      metrics: ['request_count', 'response_time', 'error_rate', 'cpu_usage', 'memory_usage'],
      visualizations: [
        { type: 'line', title: 'Response Time Trend' },
        { type: 'bar', title: 'Hourly Request Count' },
        { type: 'table', title: 'Metrics Summary' },
      ],
    },

    weekly_summary: {
      name: 'Weekly Summary Report',
      description: 'Weekly performance and trend analysis',
      type: 'executive_summary',
      metrics: ['request_count', 'response_time', 'error_rate'],
      visualizations: [
        { type: 'line', title: 'Weekly Trends' },
        { type: 'bar', title: 'Day-by-Day Comparison' },
      ],
    },

    capacity_planning: {
      name: 'Capacity Planning Report',
      description: 'Resource utilization and capacity analysis',
      type: 'performance',
      metrics: ['cpu_usage', 'memory_usage', 'storage_usage', 'network_usage'],
      visualizations: [
        { type: 'heatmap', title: 'Resource Utilization Heatmap' },
        { type: 'line', title: 'Resource Trends' },
      ],
    },

    error_analysis: {
      name: 'Error Analysis Report',
      description: 'Detailed error analysis and breakdown',
      type: 'performance',
      metrics: ['error_total', 'error_rate'],
      visualizations: [
        { type: 'bar', title: 'Errors by Type' },
        { type: 'line', title: 'Error Rate Trend' },
        { type: 'pie', title: 'Error Distribution' },
      ],
    },
  };

  static getTemplate(name: string): Omit<ReportConfig, 'timeRange'> | null {
    return this.templates[name] || null;
  }

  static listTemplates(): string[] {
    return Object.keys(this.templates);
  }
}
