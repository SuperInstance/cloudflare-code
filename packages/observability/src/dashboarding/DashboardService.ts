import { Observable, ObservableConfig } from '../core/Observable';
import {
  Dashboard,
  Widget,
  WidgetType,
  WidgetPosition,
  WidgetSize,
  WidgetConfig,
  WidgetQuery,
  DashboardLayout,
  TimeRange,
  TimeRangePreset,
  DashboardVariable,
  VariableType,
  VariableOption,
  DashboardPermissions
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Dashboard Service for creating and managing customizable dashboards
 */
export class DashboardService extends Observable {
  private config: ObservableConfig;
  private dashboards: Map<string, Dashboard> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private widgetProviders: Map<WidgetType, WidgetProvider> = new Map();

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Register default widget providers
      this.registerDefaultWidgetProviders();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize DashboardService:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear all refresh intervals
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        success: true,
        exported: 1,
        duration: 0,
        dashboardData: {
          dashboards: Array.from(this.dashboards.values()),
          widgetTypes: Array.from(this.widgetProviders.keys())
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Create a new dashboard
   */
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Dashboard {
    const newDashboard: Dashboard = {
      id: uuidv4(),
      ...dashboard,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };

    this.dashboards.set(newDashboard.id, newDashboard);

    // Set up auto-refresh if specified
    if (newDashboard.refreshInterval) {
      this.setupAutoRefresh(newDashboard);
    }

    return newDashboard;
  }

  /**
   * Update a dashboard
   */
  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Dashboard | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const updatedDashboard = {
      ...dashboard,
      ...updates,
      updatedAt: Date.now(),
      version: dashboard.version + 1
    };

    this.dashboards.set(dashboardId, updatedDashboard);

    // Update refresh interval if changed
    if (dashboard.refreshInterval !== updatedDashboard.refreshInterval) {
      this.clearAutoRefresh(dashboardId);
      if (updatedDashboard.refreshInterval) {
        this.setupAutoRefresh(updatedDashboard);
      }
    }

    return updatedDashboard;
  }

  /**
   * Delete a dashboard
   */
  deleteDashboard(dashboardId: string): boolean {
    const deleted = this.dashboards.delete(dashboardId);
    this.clearAutoRefresh(dashboardId);
    return deleted;
  }

  /**
   * Get a dashboard
   */
  getDashboard(dashboardId: string): Dashboard | null {
    return this.dashboards.get(dashboardId) || null;
  }

  /**
   * Get all dashboards
   */
  getDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get dashboards by tag
   */
  getDashboardsByTag(tag: string): Dashboard[] {
    return Array.from(this.dashboards.values()).filter(dashboard =>
      dashboard.tags?.[tag]
    );
  }

  /**
   * Add a widget to a dashboard
   */
  addWidget(dashboardId: string, widget: Omit<Widget, 'id'>): Widget | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const newWidget: Widget = {
      id: uuidv4(),
      ...widget
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return newWidget;
  }

  /**
   * Update a widget
   */
  updateWidget(dashboardId: string, widgetId: string, updates: Partial<Widget>): Widget | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return null;

    const updatedWidget = {
      ...dashboard.widgets[widgetIndex],
      ...updates
    };

    dashboard.widgets[widgetIndex] = updatedWidget;
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return updatedWidget;
  }

  /**
   * Remove a widget from a dashboard
   */
  removeWidget(dashboardId: string, widgetId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return false;

    dashboard.widgets.splice(widgetIndex, 1);
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return true;
  }

  /**
   * Move widget position
   */
  moveWidget(
    dashboardId: string,
    widgetId: string,
    newPosition: WidgetPosition
  ): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return false;

    widget.position = newPosition;
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return true;
  }

  /**
   * Resize widget
   */
  resizeWidget(
    dashboardId: string,
    widgetId: string,
    newSize: WidgetSize
  ): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return false;

    widget.size = newSize;
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return true;
  }

  /**
   * Refresh a dashboard
   */
  async refreshDashboard(dashboardId: string): Promise<DashboardData> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const widgetData: Record<string, any> = {};

    for (const widget of dashboard.widgets) {
      try {
        const provider = this.widgetProviders.get(widget.type);
        if (provider) {
          widgetData[widget.id] = await provider.fetchData(widget);
        }
      } catch (error) {
        console.error(`Failed to refresh widget ${widget.id}:`, error);
        widgetData[widget.id] = {
          error: error instanceof Error ? error.message : 'Unknown error',
          data: null
        };
      }
    }

    return {
      dashboard,
      widgetData,
      timestamp: Date.now()
    };
  }

  /**
   * Get dashboard data for rendering
   */
  async getDashboardData(dashboardId: string, timeRange?: TimeRange): Promise<DashboardData> {
    const dashboard = this.getDashboard(dashboardId);
    if (!dashboard) throw new Error('Dashboard not found');

    return this.refreshDashboard(dashboardId);
  }

  /**
   * Add a variable to a dashboard
   */
  addVariable(
    dashboardId: string,
    variable: Omit<DashboardVariable, 'name'>
  ): DashboardVariable | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const newVariable: DashboardVariable = {
      name: `var_${Date.now()}`,
      ...variable
    };

    if (!dashboard.variables) {
      dashboard.variables = [];
    }
    dashboard.variables.push(newVariable);
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return newVariable;
  }

  /**
   * Update a dashboard variable
   */
  updateVariable(
    dashboardId: string,
    variableName: string,
    updates: Partial<DashboardVariable>
  ): DashboardVariable | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard?.variables) return null;

    const variable = dashboard.variables.find(v => v.name === variableName);
    if (!variable) return null;

    const updatedVariable = {
      ...variable,
      ...updates
    };

    const index = dashboard.variables.findIndex(v => v.name === variableName);
    dashboard.variables[index] = updatedVariable;
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return updatedVariable;
  }

  /**
   * Remove a dashboard variable
   */
  removeVariable(
    dashboardId: string,
    variableName: string
  ): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard?.variables) return false;

    const index = dashboard.variables.findIndex(v => v.name === variableName);
    if (index === -1) return false;

    dashboard.variables.splice(index, 1);
    dashboard.updatedAt = Date.now();
    dashboard.version++;

    this.dashboards.set(dashboardId, dashboard);

    return true;
  }

  /**
   * Get variable options (for query-based variables)
   */
  async getVariableOptions(variable: DashboardVariable): Promise<VariableOption[]> {
    if (variable.type === 'query') {
      // Execute query to get options
      const queryData = await this.executeQuery(variable.query);
      return queryData.map((item: any, index: number) => ({
        value: item.value || item.id || index.toString(),
        label: item.label || item.name || item.value || index.toString()
      }));
    }

    if (variable.type === 'custom' && variable.options) {
      return variable.options;
    }

    return [];
  }

  /**
   * Register a widget provider
   */
  registerWidgetProvider(type: WidgetType, provider: WidgetProvider): void {
    this.widgetProviders.set(type, provider);
  }

  /**
   * Get supported widget types
   */
  getSupportedWidgetTypes(): WidgetType[] {
    return Array.from(this.widgetProviders.keys());
  }

  /**
   * Set up auto-refresh for a dashboard
   */
  private setupAutoRefresh(dashboard: Dashboard): void {
    if (dashboard.refreshInterval && dashboard.refreshInterval > 0) {
      const interval = setInterval(async () => {
        try {
          await this.refreshDashboard(dashboard.id);
        } catch (error) {
          console.error(`Auto-refresh failed for dashboard ${dashboard.id}:`, error);
        }
      }, dashboard.refreshInterval);

      this.refreshIntervals.set(dashboard.id, interval);
    }
  }

  /**
   * Clear auto-refresh for a dashboard
   */
  private clearAutoRefresh(dashboardId: string): void {
    const interval = this.refreshIntervals.get(dashboardId);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(dashboardId);
    }
  }

  /**
   * Register default widget providers
   */
  private registerDefaultWidgetProviders(): void {
    // Timeseries widget provider
    this.registerWidgetProvider('timeseries', new TimeseriesWidgetProvider());

    // Gauge widget provider
    this.registerWidgetProvider('gauge', new GaugeWidgetProvider());

    // Stat widget provider
    this.registerWidgetProvider('stat', new StatWidgetProvider());

    // Table widget provider
    this.registerWidgetProvider('table', new TableWidgetProvider());

    // Heatmap widget provider
    this.registerWidgetProvider('heatmap', new HeatmapWidgetProvider());

    // Log viewer provider
    this.registerWidgetProvider('log-viewer', new LogViewerWidgetProvider());

    // Trace viewer provider
    this.registerWidgetProvider('trace-viewer', new TraceViewerWidgetProvider());
  }

  /**
   * Execute a query (placeholder implementation)
   */
  private async executeQuery(query: string): Promise<any[]> {
    // In a real implementation, this would execute the query against a data source
    console.log('Executing query:', query);
    return [];
  }
}

/**
 * Widget provider interface
 */
export interface WidgetProvider {
  type: WidgetType;
  fetchData(widget: Widget): Promise<any>;
}

/**
 * Timeseries widget provider
 */
export class TimeseriesWidgetProvider implements WidgetProvider {
  type: WidgetType = 'timeseries';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    const queries = widget.queries || [];

    const series = queries.map(query => ({
      query,
      data: [
        { time: Date.now() - 3600000, value: Math.random() * 100 },
        { time: Date.now() - 3500000, value: Math.random() * 100 },
        { time: Date.now() - 3400000, value: Math.random() * 100 },
        { time: Date.now() - 3300000, value: Math.random() * 100 },
        { time: Date.now() - 3200000, value: Math.random() * 100 }
      ]
    }));

    return {
      series,
      range: widget.config?.timeRange || { start: Date.now() - 3600000, end: Date.now() }
    };
  }
}

/**
 * Gauge widget provider
 */
export class GaugeWidgetProvider implements WidgetProvider {
  type: WidgetType = 'gauge';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    return {
      value: Math.random() * 100,
      max: 100,
      min: 0,
      unit: widget.config?.unit || '%'
    };
  }
}

/**
 * Stat widget provider
 */
export class StatWidgetProvider implements WidgetProvider {
  type: WidgetType = 'stat';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    return {
      value: Math.floor(Math.random() * 10000),
      label: widget.title,
      unit: widget.config?.unit || ''
    };
  }
}

/**
 * Table widget provider
 */
export class TableWidgetProvider implements WidgetProvider {
  type: WidgetType = 'table';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    return {
      columns: ['name', 'value', 'status'],
      data: [
        { name: 'Metric 1', value: 42, status: 'ok' },
        { name: 'Metric 2', value: 87, status: 'warning' },
        { name: 'Metric 3', value: 15, status: 'critical' }
      ]
    };
  }
}

/**
 * Heatmap widget provider
 */
export class HeatmapWidgetProvider implements WidgetProvider {
  type: WidgetType = 'heatmap';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    const data = [];
    for (let i = 0; i < 50; i++) {
      data.push({
        x: Math.floor(i / 10),
        y: i % 10,
        value: Math.random() * 100
      });
    }

    return {
      data,
      xLabels: Array.from({ length: 5 }, (_, i) => `Hour ${i}`),
      yLabels: Array.from({ length: 10 }, (_, i) => `Day ${i}`)
    };
  }
}

/**
 * Log viewer widget provider
 */
export class LogViewerWidgetProvider implements WidgetProvider {
  type: WidgetType = 'log-viewer';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    return {
      logs: Array.from({ length: 20 }, (_, i) => ({
        timestamp: Date.now() - i * 60000,
        level: ['info', 'warn', 'error', 'debug'][Math.floor(Math.random() * 4)],
        message: `Log message ${i}`,
        source: `service-${Math.floor(Math.random() * 3)}`
      }))
    };
  }
}

/**
 * Trace viewer widget provider
 */
export class TraceViewerWidgetProvider implements WidgetProvider {
  type: WidgetType = 'trace-viewer';

  async fetchData(widget: Widget): Promise<any> {
    // Placeholder implementation
    return {
      traces: [
        {
          traceId: 'trace-123',
          spans: [
            { name: 'start', duration: 100 },
            { name: 'process', duration: 200 },
            { name: 'end', duration: 50 }
          ]
        }
      ]
    };
  }
}

/**
 * Dashboard data interface
 */
export interface DashboardData {
  dashboard: Dashboard;
  widgetData: Record<string, any>;
  timestamp: number;
}