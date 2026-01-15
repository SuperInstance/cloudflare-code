/**
 * Dashboard type definitions and data structures
 */

import {
  Dashboard,
  DashboardPanel,
  DashboardQuery,
  DashboardVariable,
  TimeRange,
  GridPosition,
  VisualizationType
} from '../types';

export interface DashboardData {
  metrics: Map<string, number[]>;
  timestamps: number[];
}

export interface PanelData {
  panelId: string;
  data: Array<{
    query: string;
    values: number[];
    timestamps: number[];
    labels?: Record<string, string>;
  }>;
}

export class DashboardManager {
  private dashboards: Map<string, Dashboard>;

  constructor() {
    this.dashboards = new Map();
  }

  /**
   * Create a new dashboard
   */
  createDashboard(config: Omit<Dashboard, 'id'>): Dashboard {
    const dashboard: Dashboard = {
      id: this.generateId(),
      ...config
    };

    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  /**
   * Get a dashboard
   */
  getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.get(id);
  }

  /**
   * Get all dashboards
   */
  getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Update a dashboard
   */
  updateDashboard(id: string, updates: Partial<Dashboard>): Dashboard | null {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return null;
    }

    const updated = { ...dashboard, ...updates };
    this.dashboards.set(id, updated);
    return updated;
  }

  /**
   * Delete a dashboard
   */
  deleteDashboard(id: string): boolean {
    return this.dashboards.delete(id);
  }

  /**
   * Add a panel to a dashboard
   */
  addPanel(dashboardId: string, panel: Omit<DashboardPanel, 'id'>): DashboardPanel | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return null;
    }

    const newPanel: DashboardPanel = {
      id: this.generateId(),
      ...panel
    };

    dashboard.panels.push(newPanel);
    return newPanel;
  }

  /**
   * Remove a panel from a dashboard
   */
  removePanel(dashboardId: string, panelId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return false;
    }

    const index = dashboard.panels.findIndex(p => p.id === panelId);
    if (index === -1) {
      return false;
    }

    dashboard.panels.splice(index, 1);
    return true;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `dash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export dashboard as JSON
   */
  exportDashboard(id: string): string | null {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return null;
    }

    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * Import dashboard from JSON
   */
  importDashboard(json: string): Dashboard | null {
    try {
      const config = JSON.parse(json);
      return this.createDashboard(config);
    } catch {
      return null;
    }
  }
}

/**
 * Create default monitoring dashboards
 */
export function createDefaultDashboards(): Dashboard[] {
  return [
    {
      id: 'overview',
      name: 'System Overview',
      description: 'High-level system metrics',
      panels: [
        {
          id: 'cpu-panel',
          title: 'CPU Usage',
          type: 'gauge',
          queries: [
            {
              refId: 'A',
              query: 'avg(cpu_usage_percent)',
              dataSource: 'prometheus',
              queryType: 'query'
            }
          ],
          gridPos: { x: 0, y: 0, w: 6, h: 4 },
          options: {
            legend: { show: true, position: 'bottom' },
            tooltip: { mode: 'single' },
            axes: {
              x: { label: 'Time', unit: 'time' },
              y: { label: 'CPU %', unit: 'percent' }
            }
          }
        },
        {
          id: 'memory-panel',
          title: 'Memory Usage',
          type: 'gauge',
          queries: [
            {
              refId: 'B',
              query: 'avg(memory_usage_bytes)',
              dataSource: 'prometheus',
              queryType: 'query'
            }
          ],
          gridPos: { x: 6, y: 0, w: 6, h: 4 },
          options: {
            legend: { show: true, position: 'bottom' },
            tooltip: { mode: 'single' },
            axes: {
              x: { label: 'Time', unit: 'time' },
              y: { label: 'Memory', unit: 'bytes' }
            }
          }
        }
      ],
      variables: [],
      refresh: 30000,
      timeRange: {
        start: 'now-1h',
        end: 'now'
      },
      tags: ['overview', 'system'],
      layout: {
        orientation: 'horizontal',
        rows: 2,
        columns: 4
      }
    },
    {
      id: 'performance',
      name: 'Performance Metrics',
      description: 'Detailed performance analysis',
      panels: [
        {
          id: 'latency-panel',
          title: 'Request Latency',
          type: 'line',
          queries: [
            {
              refId: 'A',
              query: 'histogram_quantile(0.95, http_request_duration_seconds_bucket)',
              dataSource: 'prometheus',
              queryType: 'query'
            }
          ],
          gridPos: { x: 0, y: 0, w: 12, h: 6 },
          options: {
            legend: { show: true, position: 'bottom' },
            tooltip: { mode: 'multi' },
            axes: {
              x: { label: 'Time', unit: 'time' },
              y: { label: 'Latency', unit: 's' }
            }
          }
        }
      ],
      variables: [],
      refresh: 15000,
      timeRange: {
        start: 'now-15m',
        end: 'now'
      },
      tags: ['performance', 'latency'],
      layout: {
        orientation: 'horizontal',
        rows: 3,
        columns: 4
      }
    }
  ];
}
