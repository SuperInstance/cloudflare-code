/**
 * Custom Report Builder
 * Build, schedule, and distribute custom analytics reports
 */

import type {
  Report,
  ReportType,
  ReportConfig,
  ReportDataSource,
  ReportMetric,
  ReportDimension,
  ReportFilter,
  ReportVisualization,
  ReportLayout,
  ReportSchedule,
  ReportDistribution,
  ExportFormat,
} from '../types/index.js';

export interface ReportBuilderConfig {
  maxReports: number;
  maxWidgets: number;
  enableScheduling: boolean;
  enableDistribution: boolean;
  defaultRetention: number;
}

/**
 * Report Builder
 */
export class ReportBuilder {
  private config: ReportBuilderConfig;
  private reports: Map<string, Report> = new Map();
  private templates: Map<string, ReportTemplate> = new Map();
  private scheduler: ReportScheduler;
  private distributor: ReportDistributor;

  constructor(config: Partial<ReportBuilderConfig> = {}) {
    this.config = {
      maxReports: 100,
      maxWidgets: 20,
      enableScheduling: true,
      enableDistribution: true,
      defaultRetention: 90,
      ...config,
    };

    this.scheduler = new ReportScheduler(this.config.enableScheduling);
    this.distributor = new ReportDistributor(this.config.enableDistribution);

    this.initializeTemplates();
  }

  /**
   * Create new report
   */
  createReport(
    id: string,
    name: string,
    type: ReportType,
    config: ReportConfig,
    owner: string
  ): Report {
    const report: Report = {
      id,
      name,
      description: config.description || '',
      type,
      owner,
      config,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.reports.set(id, report);
    return report;
  }

  /**
   * Get report by ID
   */
  getReport(id: string): Report | undefined {
    return this.reports.get(id);
  }

  /**
   * List all reports
   */
  listReports(filters?: ReportFilter[]): Report[] {
    let reports = Array.from(this.reports.values());

    if (filters) {
      reports = reports.filter((report) => this.matchesFilters(report, filters));
    }

    return reports.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Update report
   */
  updateReport(id: string, updates: Partial<ReportConfig>): Report | undefined {
    const report = this.reports.get(id);
    if (!report) return undefined;

    Object.assign(report.config, updates);
    report.updatedAt = Date.now();

    return report;
  }

  /**
   * Delete report
   */
  deleteReport(id: string): boolean {
    const report = this.reports.get(id);
    if (!report) return false;

    this.scheduler.unschedule(id);
    this.reports.delete(id);
    return true;
  }

  /**
   * Schedule report
   */
  scheduleReport(id: string, schedule: ReportSchedule): boolean {
    const report = this.reports.get(id);
    if (!report || !this.config.enableScheduling) return false;

    report.schedule = schedule;
    report.nextRun = this.scheduler.schedule(id, schedule, () => this.executeReport(id));

    return true;
  }

  /**
   * Unschedule report
   */
  unscheduleReport(id: string): boolean {
    const report = this.reports.get(id);
    if (!report) return false;

    this.scheduler.unschedule(id);
    delete report.schedule;
    delete report.nextRun;

    return true;
  }

  /**
   * Configure report distribution
   */
  configureDistribution(id: string, distribution: ReportDistribution): boolean {
    const report = this.reports.get(id);
    if (!report || !this.config.enableDistribution) return false;

    report.distribution = distribution;
    return true;
  }

  /**
   * Execute report immediately
   */
  async executeReport(id: string): Promise<ReportResult> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`Report ${id} not found`);
    }

    const startTime = Date.now();

    try {
      // Fetch data
      const data = await this.fetchReportData(report.config);

      // Generate visualizations
      const visualizations = await this.generateVisualizations(
        data,
        report.config.visualizations
      );

      // Apply calculations
      const calculatedData = this.applyCalculations(data, report.config.calculations);

      // Generate result
      const result: ReportResult = {
        reportId: id,
        reportName: report.name,
        generatedAt: Date.now(),
        duration: Date.now() - startTime,
        data: calculatedData,
        visualizations,
        success: true,
      };

      // Update last run time
      report.lastRun = Date.now();
      if (report.schedule) {
        report.nextRun = this.scheduler.getNextRunTime(id);
      }

      // Distribute if configured
      if (report.distribution) {
        await this.distributor.distribute(result, report.distribution);
      }

      return result;
    } catch (error) {
      return {
        reportId: id,
        reportName: report.name,
        generatedAt: Date.now(),
        duration: Date.now() - startTime,
        data: null,
        visualizations: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch report data
   */
  private async fetchReportData(config: ReportConfig): Promise<any> {
    // This would integrate with the data source
    // For now, return placeholder data
    return {
      summary: {
        total: 0,
        average: 0,
        change: 0,
        changePercent: 0,
      },
      breakdown: [],
      comparisons: [],
    };
  }

  /**
   * Generate visualizations
   */
  private async generateVisualizations(
    data: any,
    configs: ReportVisualization[]
  ): Promise<any[]> {
    // This would integrate with the visualization generator
    return configs.map((config) => ({
      type: config.type,
      title: config.title,
      data: [],
      config: config.config,
    }));
  }

  /**
   * Apply calculations to data
   */
  private applyCalculations(data: any, calculations?: any[]): any {
    if (!calculations || calculations.length === 0) return data;

    const calculated = { ...data };

    for (const calc of calculations) {
      calculated[calc.id] = this.evaluateCalculation(calc.formula, data, calc.variables);
    }

    return calculated;
  }

  /**
   * Evaluate calculation formula
   */
  private evaluateCalculation(
    formula: string,
    data: any,
    variables: Record<string, string>
  ): number {
    let evalFormula = formula;

    for (const [key, path] of Object.entries(variables)) {
      const value = this.getNestedValue(data, path);
      evalFormula = evalFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
    }

    return eval(evalFormula); // eslint-disable-line no-eval
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return 0;
      }
    }

    return typeof value === 'number' ? value : 0;
  }

  /**
   * Check if report matches filters
   */
  private matchesFilters(report: Report, filters: ReportFilter[]): boolean {
    return filters.every((filter) => {
      const value = this.getReportField(report, filter.field);

      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'not_equals':
          return value !== filter.value;
        case 'contains':
          return typeof value === 'string' && value.includes(filter.value);
        case 'in':
          return Array.isArray(filter.value) && filter.value.includes(value);
        case 'greater_than':
          return typeof value === 'number' && value > filter.value;
        case 'less_than':
          return typeof value === 'number' && value < filter.value;
        default:
          return true;
      }
    });
  }

  /**
   * Get report field value
   */
  private getReportField(report: Report, field: string): any {
    const parts = field.split('.');
    let value: any = report;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Initialize report templates
   */
  private initializeTemplates(): void {
    // Executive Summary Template
    this.templates.set('executive_summary', {
      id: 'executive_summary',
      name: 'Executive Summary',
      description: 'High-level overview of key metrics',
      type: 'executive_summary',
      config: this.getExecutiveSummaryConfig(),
    });

    // Product Analytics Template
    this.templates.set('product_analytics', {
      id: 'product_analytics',
      name: 'Product Analytics',
      description: 'Detailed product usage metrics',
      type: 'product',
      config: this.getProductAnalyticsConfig(),
    });

    // Revenue Report Template
    this.templates.set('revenue_report', {
      id: 'revenue_report',
      name: 'Revenue Report',
      description: 'Revenue and financial metrics',
      type: 'revenue',
      config: this.getRevenueReportConfig(),
    });

    // User Behavior Template
    this.templates.set('user_behavior', {
      id: 'user_behavior',
      name: 'User Behavior',
      description: 'User engagement and behavior patterns',
      type: 'behavior',
      config: this.getUserBehaviorConfig(),
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ReportTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * List all templates
   */
  listTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Create report from template
   */
  createFromTemplate(
    templateId: string,
    id: string,
    name: string,
    owner: string
  ): Report | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    return this.createReport(id, name, template.type, template.config, owner);
  }

  /**
   * Get executive summary config
   */
  private getExecutiveSummaryConfig(): ReportConfig {
    return {
      dataSource: {
        type: 'metrics',
      },
      metrics: [
        {
          id: 'total_users',
          name: 'Total Users',
          type: 'count',
          field: 'user_id',
          format: { type: 'number' },
        },
        {
          id: 'total_revenue',
          name: 'Total Revenue',
          type: 'sum',
          field: 'revenue',
          format: { type: 'currency' },
          comparison: { type: 'previous_period', showChange: true, showPercentage: true },
        },
      ],
      dimensions: [],
      filters: [],
      visualizations: [
        {
          id: 'users_chart',
          type: 'line',
          title: 'User Growth',
          dataSource: 'users',
          config: { xAxis: 'date', yAxis: 'count' },
          position: { row: 0, column: 0 },
        },
      ],
      layout: {
        type: 'grid',
        columns: 2,
      },
    };
  }

  /**
   * Get product analytics config
   */
  private getProductAnalyticsConfig(): ReportConfig {
    return {
      dataSource: {
        type: 'events',
      },
      metrics: [
        {
          id: 'dau',
          name: 'Daily Active Users',
          type: 'count',
          field: 'user_id',
          format: { type: 'number' },
        },
        {
          id: 'avg_session_duration',
          name: 'Avg Session Duration',
          type: 'avg',
          field: 'session_duration',
          format: { type: 'duration' },
        },
      ],
      dimensions: [
        {
          id: 'date',
          name: 'Date',
          field: 'timestamp',
          type: 'date',
          sortable: true,
          filterable: true,
        },
      ],
      filters: [],
      visualizations: [
        {
          id: 'dau_chart',
          type: 'line',
          title: 'Daily Active Users',
          dataSource: 'dau',
          config: { xAxis: 'date', yAxis: 'count' },
          position: { row: 0, column: 0 },
        },
      ],
      layout: {
        type: 'grid',
        columns: 2,
      },
    };
  }

  /**
   * Get revenue report config
   */
  private getRevenueReportConfig(): ReportConfig {
    return {
      dataSource: {
        type: 'revenue',
      },
      metrics: [
        {
          id: 'mrr',
          name: 'Monthly Recurring Revenue',
          type: 'sum',
          field: 'revenue',
          format: { type: 'currency' },
        },
        {
          id: 'arr',
          name: 'Annual Recurring Revenue',
          type: 'sum',
          field: 'revenue',
          format: { type: 'currency' },
        },
      ],
      dimensions: [],
      filters: [],
      visualizations: [
        {
          id: 'revenue_chart',
          type: 'line',
          title: 'Revenue Trend',
          dataSource: 'revenue',
          config: { xAxis: 'month', yAxis: 'revenue' },
          position: { row: 0, column: 0 },
        },
      ],
      layout: {
        type: 'grid',
        columns: 2,
      },
    };
  }

  /**
   * Get user behavior config
   */
  private getUserBehaviorConfig(): ReportConfig {
    return {
      dataSource: {
        type: 'events',
      },
      metrics: [
        {
          id: 'pageviews',
          name: 'Page Views',
          type: 'count',
          field: 'event_id',
          format: { type: 'number' },
        },
        {
          id: 'sessions',
          name: 'Sessions',
          type: 'count',
          field: 'session_id',
          format: { type: 'number' },
        },
      ],
      dimensions: [
        {
          id: 'page',
          name: 'Page',
          field: 'page_url',
          type: 'string',
          sortable: true,
          filterable: true,
        },
      ],
      filters: [],
      visualizations: [
        {
          id: 'pageviews_chart',
          type: 'bar',
          title: 'Top Pages',
          dataSource: 'pageviews',
          config: { xAxis: 'page', yAxis: 'count' },
          position: { row: 0, column: 0 },
        },
      ],
      layout: {
        type: 'grid',
        columns: 2,
      },
    };
  }

  /**
   * Get report statistics
   */
  getStats(): ReportBuilderStats {
    return {
      totalReports: this.reports.size,
      totalTemplates: this.templates.size,
      scheduledReports: this.scheduler.getScheduledCount(),
      activeReports: Array.from(this.reports.values()).filter(
        (r) => r.schedule?.enabled
      ).length,
    };
  }
}

export interface ReportResult {
  reportId: string;
  reportName: string;
  generatedAt: number;
  duration: number;
  data: any;
  visualizations: any[];
  success: boolean;
  error?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  config: ReportConfig;
}

export interface ReportBuilderStats {
  totalReports: number;
  totalTemplates: number;
  scheduledReports: number;
  activeReports: number;
}

/**
 * Report Scheduler
 */
class ReportScheduler {
  private enabled: boolean;
  private scheduled: Map<string, ScheduledReport> = new Map();
  private timers: Map<string, number> = new Map();

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  schedule(
    reportId: string,
    schedule: ReportSchedule,
    callback: () => void
  ): number | undefined {
    if (!this.enabled || !schedule.enabled) return undefined;

    const nextRun = this.calculateNextRun(schedule);

    this.scheduled.set(reportId, {
      reportId,
      schedule,
      nextRun,
      callback,
    });

    // Set timer
    const delay = Math.max(0, nextRun - Date.now());
    const timerId = window.setTimeout(() => {
      callback();
      this.reschedule(reportId);
    }, delay);

    this.timers.set(reportId, timerId);

    return nextRun;
  }

  unschedule(reportId: string): void {
    const timerId = this.timers.get(reportId);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.timers.delete(reportId);
    }
    this.scheduled.delete(reportId);
  }

  getNextRunTime(reportId: string): number | undefined {
    const scheduled = this.scheduled.get(reportId);
    return scheduled?.nextRun;
  }

  getScheduledCount(): number {
    return this.scheduled.size;
  }

  private calculateNextRun(schedule: ReportSchedule): number {
    const now = new Date();
    const next = new Date(now);

    switch (schedule.frequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
        break;

      case 'daily':
        next.setDate(next.getDate() + 1);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(0, 0, 0, 0);
        }
        break;

      case 'weekly':
        next.setDate(next.getDate() + (7 - next.getDay() + (schedule.dayOfWeek || 1)) % 7);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(0, 0, 0, 0);
        }
        break;

      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(schedule.dayOfMonth || 1);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(0, 0, 0, 0);
        }
        break;

      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        next.setDate(1);
        next.setHours(0, 0, 0, 0);
        break;
    }

    return next.getTime();
  }

  private reschedule(reportId: string): void {
    const scheduled = this.scheduled.get(reportId);
    if (!scheduled) return;

    const nextRun = this.calculateNextRun(scheduled.schedule);
    scheduled.nextRun = nextRun;

    const delay = Math.max(0, nextRun - Date.now());
    const timerId = window.setTimeout(() => {
      scheduled.callback();
      this.reschedule(reportId);
    }, delay);

    this.timers.set(reportId, timerId);
  }
}

interface ScheduledReport {
  reportId: string;
  schedule: ReportSchedule;
  nextRun: number;
  callback: () => void;
}

/**
 * Report Distributor
 */
class ReportDistributor {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  async distribute(result: ReportResult, distribution: ReportDistribution): Promise<void> {
    if (!this.enabled) return;

    for (const channel of distribution.channels) {
      try {
        await this.sendToChannel(result, channel, distribution);
      } catch (error) {
        console.error(`Failed to distribute report via ${channel.type}:`, error);
      }
    }
  }

  private async sendToChannel(
    result: ReportResult,
    channel: any,
    distribution: ReportDistribution
  ): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmail(result, channel, distribution);
        break;
      case 'slack':
        await this.sendSlack(result, channel, distribution);
        break;
      case 'webhook':
        await this.sendWebhook(result, channel);
        break;
      default:
        console.log(`Unknown channel type: ${channel.type}`);
    }
  }

  private async sendEmail(
    result: ReportResult,
    channel: any,
    distribution: ReportDistribution
  ): Promise<void> {
    // Implementation would send email
    console.log(`Sending report ${result.reportId} via email to ${distribution.recipients.join(', ')}`);
  }

  private async sendSlack(
    result: ReportResult,
    channel: any,
    distribution: ReportDistribution
  ): Promise<void> {
    // Implementation would send Slack message
    console.log(`Sending report ${result.reportId} to Slack ${channel.config.webhook}`);
  }

  private async sendWebhook(result: ReportResult, channel: any): Promise<void> {
    // Implementation would send webhook
    console.log(`Sending report ${result.reportId} to webhook ${channel.config.url}`);
  }
}
