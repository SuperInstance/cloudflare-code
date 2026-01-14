/**
 * Dashboard Builder and Visualization System
 * Provides pre-built templates and custom dashboard creation
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  Dashboard, Widget, WidgetType, WidgetPosition, WidgetSize,
  WidgetConfig, WidgetQuery, DashboardLayout, TimeRange,
  DashboardVariable, VariableType, DashboardPermissions
} from '../types';

export class DashboardBuilder {
  private dashboards: Map<string, Dashboard> = new Map();

  createDashboard(config: {
    name: string;
    description?: string;
    timeRange?: TimeRange;
    refreshInterval?: number;
    permissions?: Partial<DashboardPermissions>;
  }): Dashboard {
    const dashboard: Dashboard = {
      id: uuidv4(),
      name: config.name,
      description: config.description,
      widgets: [],
      layout: { columns: 12, autoArrange: true },
      refreshInterval: config.refreshInterval || 30000,
      timeRange: config.timeRange || {
        start: 'now-1h',
        end: 'now',
        preset: 'last-1h'
      },
      variables: [],
      permissions: {
        read: config.permissions?.read || [],
        write: config.permissions?.write || [],
        public: config.permissions?.public || false,
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  addWidget(dashboardId: string, widget: Omit<Widget, 'id'>): Widget | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const newWidget: Widget = {
      id: uuidv4(),
      ...widget,
    };

    dashboard.widgets.push(newWidget);
    dashboard.version++;
    dashboard.updatedAt = Date.now();
    return newWidget;
  }

  removeWidget(dashboardId: string, widgetId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    const index = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (index === -1) return false;

    dashboard.widgets.splice(index, 1);
    dashboard.version++;
    dashboard.updatedAt = Date.now();
    return true;
  }

  getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.get(id);
  }

  getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  deleteDashboard(id: string): boolean {
    return this.dashboards.delete(id);
  }
}

export class TemplateProvider {
  private templates: Map<string, Dashboard> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  private registerDefaultTemplates(): void {
    // Performance Overview Template
    this.templates.set('performance-overview', this.createPerformanceTemplate());
    
    // Application Health Template
    this.templates.set('application-health', this.createHealthTemplate());
    
    // Infrastructure Monitoring Template
    this.templates.set('infrastructure-monitoring', this.createInfrastructureTemplate());
    
    // Error Tracking Template
    this.templates.set('error-tracking', this.createErrorTrackingTemplate());
  }

  private createPerformanceTemplate(): Dashboard {
    return {
      id: 'performance-overview',
      name: 'Performance Overview',
      description: 'Key performance metrics and SLIs',
      widgets: [
        {
          id: 'req-rate',
          type: 'stat',
          title: 'Request Rate',
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          config: { showLegend: false },
          queries: [{
            id: 'q1',
            query: 'rate(http_requests_total[5m])',
            dataSource: 'prometheus',
            legendFormat: 'req/s',
          }],
        },
        {
          id: 'latency',
          type: 'timeseries',
          title: 'Request Latency',
          position: { x: 3, y: 0 },
          size: { width: 6, height: 2 },
          config: { showLegend: true },
          queries: [{
            id: 'q1',
            query: 'histogram_quantile(0.99, http_request_duration_seconds_bucket)',
            dataSource: 'prometheus',
            legendFormat: 'p99',
          }],
        },
        {
          id: 'error-rate',
          type: 'gauge',
          title: 'Error Rate',
          position: { x: 9, y: 0 },
          size: { width: 3, height: 2 },
          config: {
            thresholds: [
              { value: 0, color: 'green' },
              { value: 1, color: 'yellow' },
              { value: 5, color: 'red' },
            ],
          },
          queries: [{
            id: 'q1',
            query: 'rate(http_requests_total{status=~"5.."}[5m]) * 100',
            dataSource: 'prometheus',
          }],
        },
      ],
      layout: { columns: 12 },
      refreshInterval: 15000,
      timeRange: { start: 'now-1h', end: 'now', preset: 'last-1h' },
      variables: [],
      permissions: { read: [], write: [], public: true },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createHealthTemplate(): Dashboard {
    return {
      id: 'application-health',
      name: 'Application Health',
      description: 'Health status and availability metrics',
      widgets: [
        {
          id: 'uptime',
          type: 'stat',
          title: 'Uptime',
          position: { x: 0, y: 0 },
          size: { width: 4, height: 2 },
          config: { showLegend: false },
          queries: [{
            id: 'q1',
            query: 'avg(up)',
            dataSource: 'prometheus',
          }],
        },
        {
          id: 'health-status',
          type: 'stat',
          title: 'Health Status',
          position: { x: 4, y: 0 },
          size: { width: 4, height: 2 },
          config: { showLegend: false },
          queries: [{
            id: 'q1',
            query: 'health_status',
            dataSource: 'prometheus',
          }],
        },
        {
          id: 'dependencies',
          type: 'table',
          title: 'Dependency Health',
          position: { x: 8, y: 0 },
          size: { width: 4, height: 4 },
          config: { showLegend: false },
          queries: [{
            id: 'q1',
            query: 'dependency_health_status',
            dataSource: 'prometheus',
          }],
        },
      ],
      layout: { columns: 12 },
      refreshInterval: 30000,
      timeRange: { start: 'now-24h', end: 'now', preset: 'last-24h' },
      variables: [],
      permissions: { read: [], write: [], public: true },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createInfrastructureTemplate(): Dashboard {
    return {
      id: 'infrastructure-monitoring',
      name: 'Infrastructure Monitoring',
      description: 'CPU, memory, and network metrics',
      widgets: [
        {
          id: 'cpu',
          type: 'timeseries',
          title: 'CPU Usage',
          position: { x: 0, y: 0 },
          size: { width: 4, height: 3 },
          config: { showLegend: true },
          queries: [{
            id: 'q1',
            query: 'rate(process_cpu_seconds_total[5m]) * 100',
            dataSource: 'prometheus',
            legendFormat: 'CPU %',
          }],
        },
        {
          id: 'memory',
          type: 'timeseries',
          title: 'Memory Usage',
          position: { x: 4, y: 0 },
          size: { width: 4, height: 3 },
          config: { showLegend: true },
          queries: [{
            id: 'q1',
            query: 'process_resident_memory_bytes / 1024 / 1024',
            dataSource: 'prometheus',
            legendFormat: 'Memory MB',
          }],
        },
        {
          id: 'network',
          type: 'timeseries',
          title: 'Network I/O',
          position: { x: 8, y: 0 },
          size: { width: 4, height: 3 },
          config: { showLegend: true },
          queries: [{
            id: 'q1',
            query: 'rate(network_bytes_total[5m])',
            dataSource: 'prometheus',
            legendFormat: 'Bytes/s',
          }],
        },
      ],
      layout: { columns: 12 },
      refreshInterval: 10000,
      timeRange: { start: 'now-1h', end: 'now', preset: 'last-1h' },
      variables: [],
      permissions: { read: [], write: [], public: true },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createErrorTrackingTemplate(): Dashboard {
    return {
      id: 'error-tracking',
      name: 'Error Tracking',
      description: 'Error monitoring and analysis',
      widgets: [
        {
          id: 'error-count',
          type: 'stat',
          title: 'Total Errors',
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          config: { showLegend: false },
          queries: [{
            id: 'q1',
            query: 'sum(errors_total)',
            dataSource: 'prometheus',
          }],
        },
        {
          id: 'error-by-type',
          type: 'table',
          title: 'Errors by Type',
          position: { x: 3, y: 0 },
          size: { width: 9, height: 4 },
          config: { showLegend: false },
          queries: [{
            id: 'q1',
            query: 'topk(10, sum by (error_type) (errors_total))',
            dataSource: 'prometheus',
          }],
        },
        {
          id: 'error-timeline',
          type: 'timeseries',
          title: 'Error Timeline',
          position: { x: 0, y: 2 },
          size: { width: 12, height: 3 },
          config: { showLegend: true },
          queries: [{
            id: 'q1',
            query: 'rate(errors_total[5m])',
            dataSource: 'prometheus',
          }],
        },
      ],
      layout: { columns: 12 },
      refreshInterval: 30000,
      timeRange: { start: 'now-24h', end: 'now', preset: 'last-24h' },
      variables: [],
      permissions: { read: [], write: [], public: true },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  getTemplate(name: string): Dashboard | undefined {
    return this.templates.get(name);
  }

  getAllTemplates(): Dashboard[] {
    return Array.from(this.templates.values());
  }

  registerTemplate(name: string, template: Dashboard): void {
    this.templates.set(name, template);
  }
}

export class DashboardRenderer {
  renderDashboard(dashboard: Dashboard): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${dashboard.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .dashboard { background: white; padding: 20px; border-radius: 8px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; }
    .widgets { display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; }
    .widget { background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 10px; }
    .widget-title { font-weight: bold; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <div class="title">${dashboard.name}</div>
      <div>${dashboard.description || ''}</div>
    </div>
    <div class="widgets">
      ${dashboard.widgets.map(widget => this.renderWidget(widget)).join('\n')}
    </div>
  </div>
</body>
</html>`;
    return html;
  }

  private renderWidget(widget: Widget): string {
    const style = `grid-column: span ${widget.size.width}; grid-row: span ${widget.size.height};`;
    return `<div class="widget" style="${style}">
      <div class="widget-title">${widget.title}</div>
      <div class="widget-content">Loading...</div>
    </div>`;
  }
}
