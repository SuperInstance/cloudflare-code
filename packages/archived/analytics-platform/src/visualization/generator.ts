/**
 * Visualization Generator
 * Generate data visualization configurations and data
 */

import type {
  VisualizationType,
  VisualizationConfig,
  VisualizationData,
  VisualizationMetadata,
} from '../types/index.js';

export interface VisualizationGeneratorConfig {
  defaultColors: string[];
  maxDataPoints: number;
  enableAnimations: boolean;
  responsive: boolean;
}

/**
 * Visualization Generator
 */
export class VisualizationGenerator {
  private config: VisualizationGeneratorConfig;

  constructor(config: Partial<VisualizationGeneratorConfig> = {}) {
    this.config = {
      defaultColors: [
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#14B8A6',
        '#F97316',
      ],
      maxDataPoints: 1000,
      enableAnimations: true,
      responsive: true,
      ...config,
    };
  }

  /**
   * Generate line chart visualization
   */
  generateLineChart(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      xAxis: config.xAxis || 'timestamp',
      yAxis: config.yAxis || 'value',
      showLegend: config.showLegend ?? true,
      showDataLabels: config.showDataLabels ?? false,
      showTrendline: config.showTrendline ?? false,
      limit: config.limit || this.config.maxDataPoints,
      comparison: config.comparison || false,
      ...config,
    };

    return {
      type: 'line',
      title: config.title || 'Line Chart',
      data: this.prepareLineChartData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate bar chart visualization
   */
  generateBarChart(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      xAxis: config.xAxis || 'category',
      yAxis: config.yAxis || 'value',
      showLegend: config.showLegend ?? true,
      showDataLabels: config.showDataLabels ?? true,
      limit: config.limit || 50,
      colorBy: config.colorBy,
      ...config,
    };

    return {
      type: 'bar',
      title: config.title || 'Bar Chart',
      data: this.prepareBarChartData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate pie chart visualization
   */
  generatePieChart(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      showLegend: config.showLegend ?? true,
      showDataLabels: config.showDataLabels ?? true,
      limit: config.limit || 10,
      ...config,
    };

    return {
      type: 'pie',
      title: config.title || 'Pie Chart',
      data: this.preparePieChartData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate heatmap visualization
   */
  generateHeatmap(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      xAxis: config.xAxis || 'x',
      yAxis: config.yAxis || 'y',
      colorBy: config.colorBy || 'value',
      limit: config.limit || this.config.maxDataPoints,
      ...config,
    };

    return {
      type: 'heatmap',
      title: config.title || 'Heatmap',
      data: this.prepareHeatmapData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate funnel visualization
   */
  generateFunnel(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      showDataLabels: config.showDataLabels ?? true,
      ...config,
    };

    return {
      type: 'funnel',
      title: config.title || 'Funnel',
      data: this.prepareFunnelData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate cohort visualization
   */
  generateCohort(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      showDataLabels: config.showDataLabels ?? true,
      ...config,
    };

    return {
      type: 'cohort',
      title: config.title || 'Cohort Analysis',
      data: this.prepareCohortData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate table visualization
   */
  generateTable(
    data: any[],
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      limit: config.limit || 100,
      sort: config.sort || 'desc',
      ...config,
    };

    return {
      type: 'table',
      title: config.title || 'Table',
      data: this.prepareTableData(data, vizConfig),
      config: vizConfig,
      metadata: this.createMetadata(data.length, vizConfig),
    };
  }

  /**
   * Generate number/metric visualization
   */
  generateNumber(
    value: number,
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      showDataLabels: config.showDataLabels ?? true,
      ...config,
    };

    return {
      type: 'number',
      title: config.title || 'Metric',
      data: [{ value, label: config.title || 'Value' }],
      config: vizConfig,
      metadata: this.createMetadata(1, vizConfig),
    };
  }

  /**
   * Generate gauge visualization
   */
  generateGauge(
    value: number,
    min: number,
    max: number,
    config: Partial<VisualizationConfig> = {}
  ): VisualizationData {
    const vizConfig: VisualizationConfig = {
      showDataLabels: config.showDataLabels ?? true,
      ...config,
    };

    return {
      type: 'gauge',
      title: config.title || 'Gauge',
      data: [{ value, min, max, percentage: ((value - min) / (max - min)) * 100 }],
      config: vizConfig,
      metadata: this.createMetadata(1, vizConfig),
    };
  }

  /**
   * Prepare line chart data
   */
  private prepareLineChartData(data: any[], config: VisualizationConfig): any[] {
    const { xAxis, yAxis, limit } = config;

    let chartData = data.map((item) => ({
      x: this.getNestedValue(item, xAxis),
      y: this.getNestedValue(item, yAxis),
      ...item,
    }));

    // Sort by x-axis
    chartData.sort((a, b) => {
      if (typeof a.x === 'number' && typeof b.x === 'number') {
        return a.x - b.x;
      }
      return String(a.x).localeCompare(String(b.x));
    });

    // Apply limit
    if (limit && chartData.length > limit) {
      const step = Math.ceil(chartData.length / limit);
      chartData = chartData.filter((_, i) => i % step === 0);
    }

    return chartData;
  }

  /**
   * Prepare bar chart data
   */
  private prepareBarChartData(data: any[], config: VisualizationConfig): any[] {
    const { xAxis, yAxis, limit, colorBy } = config;

    let chartData = data.map((item) => ({
      category: this.getNestedValue(item, xAxis),
      value: this.getNestedValue(item, yAxis),
      ...(colorBy && { color: this.getNestedValue(item, colorBy) }),
      ...item,
    }));

    // Sort by value
    chartData.sort((a, b) => b.value - a.value);

    // Apply limit
    if (limit && chartData.length > limit) {
      chartData = chartData.slice(0, limit);
    }

    return chartData;
  }

  /**
   * Prepare pie chart data
   */
  private preparePieChartData(data: any[], config: VisualizationConfig): any[] {
    const { limit } = config;

    let chartData = data.map((item) => ({
      label: item.label || item.category || item.name,
      value: item.value || item.count || item.percentage,
      color: item.color || this.getColor(data.indexOf(item)),
    }));

    // Sort by value
    chartData.sort((a, b) => b.value - a.value);

    // Apply limit and group others
    if (limit && chartData.length > limit) {
      const top = chartData.slice(0, limit);
      const others = chartData.slice(limit);
      const otherSum = others.reduce((sum, item) => sum + item.value, 0);

      if (otherSum > 0) {
        top.push({
          label: 'Others',
          value: otherSum,
          color: '#9CA3AF',
        });
      }

      chartData = top;
    }

    return chartData;
  }

  /**
   * Prepare heatmap data
   */
  private prepareHeatmapData(data: any[], config: VisualizationConfig): any[] {
    const { xAxis, yAxis, colorBy } = config;

    return data.map((item) => ({
      x: this.getNestedValue(item, xAxis),
      y: this.getNestedValue(item, yAxis),
      value: this.getNestedValue(item, colorBy),
      ...item,
    }));
  }

  /**
   * Prepare funnel data
   */
  private prepareFunnelData(data: any[], config: VisualizationConfig): any[] {
    return data.map((item, index) => ({
      step: item.step || item.name || `Step ${index + 1}`,
      value: item.value || item.count || item.users,
      conversion_rate: item.conversionRate || item.conversion_rate,
      dropoff: item.dropoff || item.dropoff_rate,
    }));
  }

  /**
   * Prepare cohort data
   */
  private prepareCohortData(data: any[], config: VisualizationConfig): any[] {
    // Assume data is already in cohort format
    return data.map((cohort) => ({
      cohort: cohort.cohort || cohort.period,
      size: cohort.size || cohort.users,
      periods: cohort.periods || cohort.retention || [],
    }));
  }

  /**
   * Prepare table data
   */
  private prepareTableData(data: any[], config: VisualizationConfig): any[] {
    const { limit, sort } = config;

    let tableData = [...data];

    // Sort if specified
    if (sort && tableData.length > 0) {
      const firstItem = tableData[0];
      const valueKey = Object.keys(firstItem).find((key) => typeof firstItem[key] === 'number');

      if (valueKey) {
        tableData.sort((a, b) => {
          const aVal = a[valueKey];
          const bVal = b[valueKey];
          return sort === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }
    }

    // Apply limit
    if (limit && tableData.length > limit) {
      tableData = tableData.slice(0, limit);
    }

    return tableData;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path?: string): any {
    if (!path) return obj;

    const parts = path.split('.');
    let value = obj;

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
   * Get color for index
   */
  private getColor(index: number): string {
    return this.config.defaultColors[index % this.config.defaultColors.length];
  }

  /**
   * Create visualization metadata
   */
  private createMetadata(rows: number, config: VisualizationConfig): VisualizationMetadata {
    return {
      generatedAt: Date.now(),
      dataSource: 'analytics',
      rows,
      columns: Object.keys(config).length,
      refreshInterval: config.comparison ? 60000 : undefined,
      drilldown: {
        enabled: true,
        levels: [],
      },
    };
  }

  /**
   * Generate color scale
   */
  generateColorScale(value: number, min: number, max: number): string {
    const ratio = (value - min) / (max - min);

    // Simple green to red gradient
    const hue = (1 - ratio) * 120; // 120 = green, 0 = red
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Format value for display
   */
  formatValue(value: number, format?: string): string {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);

      case 'percentage':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
        }).format(value / 100);

      case 'duration':
        return this.formatDuration(value);

      case 'number':
      default:
        return new Intl.NumberFormat('en-US').format(value);
    }
  }

  /**
   * Format duration
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

/**
 * Dashboard Builder
 */
export class DashboardBuilder {
  private generator: VisualizationGenerator;
  private layouts: Map<string, DashboardLayout> = new Map();

  constructor(generator?: VisualizationGenerator) {
    this.generator = generator || new VisualizationGenerator();
  }

  /**
   * Create dashboard layout
   */
  createDashboard(config: DashboardConfig): DashboardLayout {
    const layout: DashboardLayout = {
      id: config.id,
      title: config.title,
      description: config.description,
      widgets: [],
      layout: config.layout || 'grid',
      columns: config.columns || 2,
      refreshInterval: config.refreshInterval,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    for (const widgetConfig of config.widgets) {
      const widget = this.createWidget(widgetConfig);
      layout.widgets.push(widget);
    }

    this.layouts.set(layout.id, layout);
    return layout;
  }

  /**
   * Create widget
   */
  private createWidget(config: WidgetConfig): DashboardWidget {
    return {
      id: config.id,
      title: config.title,
      type: config.type,
      position: config.position,
      size: config.size,
      dataSource: config.dataSource,
      refreshInterval: config.refreshInterval,
      config: config.config || {},
    };
  }

  /**
   * Get dashboard
   */
  getDashboard(id: string): DashboardLayout | undefined {
    return this.layouts.get(id);
  }

  /**
   * Update dashboard
   */
  updateDashboard(id: string, updates: Partial<DashboardConfig>): DashboardLayout | undefined {
    const layout = this.layouts.get(id);
    if (!layout) return undefined;

    Object.assign(layout, updates, { updatedAt: Date.now() });
    return layout;
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(id: string): boolean {
    return this.layouts.delete(id);
  }

  /**
   * List all dashboards
   */
  listDashboards(): DashboardLayout[] {
    return Array.from(this.layouts.values());
  }
}

export interface DashboardConfig {
  id: string;
  title: string;
  description?: string;
  layout: 'grid' | 'freeform';
  columns?: number;
  widgets: WidgetConfig[];
  refreshInterval?: number;
}

export interface WidgetConfig {
  id: string;
  title: string;
  type: VisualizationType;
  position: { row: number; column: number };
  size?: { rowSpan?: number; columnSpan?: number };
  dataSource: string;
  refreshInterval?: number;
  config?: Partial<VisualizationConfig>;
}

export interface DashboardLayout {
  id: string;
  title: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'freeform';
  columns: number;
  refreshInterval?: number;
  createdAt: number;
  updatedAt: number;
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: VisualizationType;
  position: { row: number; column: number };
  size?: { rowSpan?: number; columnSpan?: number };
  dataSource: string;
  refreshInterval?: number;
  config: Partial<VisualizationConfig>;
}
