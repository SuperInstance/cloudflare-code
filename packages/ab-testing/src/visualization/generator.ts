/**
 * Visualization Generator - Creates data structures for
 * charts and graphs to visualize experiment results
 */

import type {
  ExperimentResults,
  VisualizationData,
  VariantStats,
  MetricStats
} from '../types/experiment.js';

/**
 * Chart configuration
 */
export interface ChartConfig {
  /** Chart type */
  type: 'line' | 'bar' | 'funnel' | 'heatmap' | 'scatter' | 'pie';
  /** Title */
  title: string;
  /** X-axis label */
  xAxis: string;
  /** Y-axis label */
  yAxis: string;
  /** Width */
  width?: number;
  /** Height */
  height?: number;
  /** Color scheme */
  colors?: string[];
  /** Show legend */
  showLegend?: boolean;
  /** Show grid */
  showGrid?: boolean;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  /** Timestamp */
  timestamp: number;
  /** Variant ID */
  variantId: string;
  /** Metric value */
  value: number;
  /** Sample size */
  sampleSize?: number;
}

/**
 * Funnel step
 */
export interface FunnelStep {
  /** Step name */
  name: string;
  /** Variant ID */
  variantId: string;
  /** Count */
  count: number;
  /** Conversion rate from previous step */
  conversionRate: number;
}

/**
 * Heatmap data point
 */
export interface HeatmapPoint {
  /** X-axis value */
  x: string;
  /** Y-axis value */
  y: string;
  /** Value (intensity) */
  value: number;
  /** Label */
  label?: string;
}

/**
 * Visualization Generator class
 */
export class VisualizationGenerator {
  /**
   * Generate line chart for metric over time
   */
  generateLineChart(
    results: ExperimentResults,
    metricName: string,
    timeSeriesData: TimeSeriesPoint[],
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = timeSeriesData.map(point => ({
      x: point.timestamp,
      y: point.value,
      label: point.variantId,
      metadata: {
        variantId: point.variantId,
        sampleSize: point.sampleSize
      }
    }));

    return {
      type: 'line',
      data,
      metadata: {
        title: config?.title ?? `${metricName} Over Time`,
        xAxis: config?.xAxis ?? 'Time',
        yAxis: config?.yAxis ?? metricName,
        description: `Line chart showing ${metricName} across variants over time`
      }
    };
  }

  /**
   * Generate bar chart comparing variants
   */
  generateBarChart(
    results: ExperimentResults,
    metricName: string,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = results.variantStats.map(variant => {
      const metric = variant.metrics[metricName];
      return {
        x: variant.variantId,
        y: metric?.mean ?? 0,
        label: variant.variantId,
        metadata: {
          sampleSize: variant.sampleSize,
          standardDeviation: metric?.standardDeviation,
          confidenceInterval: metric
            ? [metric.mean - metric.standardDeviation, metric.mean + metric.standardDeviation]
            : undefined
        }
      };
    });

    return {
      type: 'bar',
      data,
      metadata: {
        title: config?.title ?? `${metricName} by Variant`,
        xAxis: config?.xAxis ?? 'Variant',
        yAxis: config?.yAxis ?? metricName,
        description: `Bar chart comparing ${metricName} across variants`
      }
    };
  }

  /**
   * Generate funnel chart
   */
  generateFunnelChart(
    steps: FunnelStep[],
    config?: Partial<ChartConfig>
  ): VisualizationData {
    // Group steps by variant
    const variants = [...new Set(steps.map(s => s.variantId))];
    const stepNames = [...new Set(steps.map(s => s.name))];

    const data = steps.map(step => ({
      x: step.name,
      y: step.count,
      label: step.variantId,
      metadata: {
        conversionRate: step.conversionRate,
        variantId: step.variantId
      }
    }));

    return {
      type: 'funnel',
      data,
      metadata: {
        title: config?.title ?? 'Conversion Funnel',
        xAxis: config?.xAxis ?? 'Step',
        yAxis: config?.yAxis ?? 'Count',
        description: `Funnel chart showing conversion through ${stepNames.length} steps`
      }
    };
  }

  /**
   * Generate heatmap for cohort analysis
   */
  generateHeatmap(
    matrix: Map<string, Map<string, number>>,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data: HeatmapPoint[] = [];

    for (const [x, row] of matrix.entries()) {
      for (const [y, value] of row.entries()) {
        data.push({
          x,
          y,
          value,
          label: `${value.toFixed(2)}`
        });
      }
    }

    return {
      type: 'heatmap',
      data,
      metadata: {
        title: config?.title ?? 'Cohort Heatmap',
        xAxis: config?.xAxis ?? 'Cohort',
        yAxis: config?.yAxis ?? 'Metric',
        description: 'Heatmap showing metric values across cohorts'
      }
    };
  }

  /**
   * Generate scatter plot
   */
  generateScatterPlot(
    points: Array<{ x: number; y: number; group: string }>,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = points.map(point => ({
      x: point.x,
      y: point.y,
      label: point.group,
      metadata: {
        group: point.group
      }
    }));

    return {
      type: 'scatter',
      data,
      metadata: {
        title: config?.title ?? 'Scatter Plot',
        xAxis: config?.xAxis ?? 'X',
        yAxis: config?.yAxis ?? 'Y',
        description: 'Scatter plot showing relationship between variables'
      }
    };
  }

  /**
   * Generate confidence interval chart
   */
  generateConfidenceIntervalChart(
    results: ExperimentResults,
    metricName: string,
    confidenceLevel: number = 0.95,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = results.variantStats.map(variant => {
      const metric = variant.metrics[metricName];
      const margin = metric?.standardDeviation ?? 0;

      return {
        x: variant.variantId,
        y: metric?.mean ?? 0,
        label: variant.variantId,
        metadata: {
          lower: (metric?.mean ?? 0) - margin,
          upper: (metric?.mean ?? 0) + margin,
          confidenceLevel,
          sampleSize: variant.sampleSize
        }
      };
    });

    return {
      type: 'bar',
      data,
      metadata: {
        title: config?.title ?? `${metricName} with ${(confidenceLevel * 100).toFixed(0)}% CI`,
        xAxis: config?.xAxis ?? 'Variant',
        yAxis: config?.yAxis ?? metricName,
        description: `Bar chart with ${(confidenceLevel * 100).toFixed(0)}% confidence intervals`
      }
    };
  }

  /**
   * Generate cumulative metrics chart
   */
  generateCumulativeChart(
    timeSeriesData: TimeSeriesPoint[],
    metricName: string,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    // Group by variant and calculate cumulative values
    const cumulativeByVariant = new Map<string, number[]>();
    const variantIds = [...new Set(timeSeriesData.map(d => d.variantId))];

    for (const variantId of variantIds) {
      cumulativeByVariant.set(variantId, []);
    }

    let cumulative = 0;
    for (const point of timeSeriesData) {
      cumulative += point.value;
      cumulativeByVariant.get(point.variantId)?.push(cumulative);
    }

    const data = timeSeriesData.map((point, index) => ({
      x: point.timestamp,
      y: cumulativeByVariant.get(point.variantId)?.[index] ?? 0,
      label: point.variantId,
      metadata: {
        variantId: point.variantId
      }
    }));

    return {
      type: 'line',
      data,
      metadata: {
        title: config?.title ?? `Cumulative ${metricName}`,
        xAxis: config?.xAxis ?? 'Time',
        yAxis: config?.yAxis ?? `Cumulative ${metricName}`,
        description: `Line chart showing cumulative ${metricName} over time`
      }
    };
  }

  /**
   * Generate lift chart
   */
  generateLiftChart(
    results: ExperimentResults,
    metricName: string,
    controlVariantId: string,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const controlMetric = results.variantStats.find(
      v => v.variantId === controlVariantId
    )?.metrics[metricName];

    const data = results.variantStats
      .filter(v => v.variantId !== controlVariantId)
      .map(variant => {
        const metric = variant.metrics[metricName];
        const controlValue = controlMetric?.mean ?? 0;
        const lift = controlValue !== 0
          ? ((metric?.mean ?? 0) - controlValue) / controlValue
          : 0;

        return {
          x: variant.variantId,
          y: lift * 100, // Convert to percentage
          label: variant.variantId,
          metadata: {
            absoluteLift: (metric?.mean ?? 0) - controlValue,
            sampleSize: variant.sampleSize,
            controlValue
          }
        };
      });

    return {
      type: 'bar',
      data,
      metadata: {
        title: config?.title ?? `Lift vs Control - ${metricName}`,
        xAxis: config?.xAxis ?? 'Variant',
        yAxis: config?.yAxis ?? 'Lift (%)',
        description: `Bar chart showing lift percentage relative to control variant`
      }
    };
  }

  /**
   * Generate p-value chart
   */
  generatePValueChart(
    results: ExperimentResults,
    metricName: string,
    controlVariantId: string,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = results.variantStats
      .filter(v => v.variantId !== controlVariantId)
      .map(variant => ({
        x: variant.variantId,
        y: 0.05, // Threshold line
        label: variant.variantId,
        metadata: {
          isThreshold: true
        }
      }));

    return {
      type: 'bar',
      data,
      metadata: {
        title: config?.title ?? `Statistical Significance - ${metricName}`,
        xAxis: config?.xAxis ?? 'Variant',
        yAxis: config?.yAxis ?? 'P-value',
        description: 'Chart showing statistical significance (p-values) for each variant'
      }
    };
  }

  /**
   * Generate sample size distribution chart
   */
  generateSampleSizeChart(
    results: ExperimentResults,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = results.variantStats.map(variant => ({
      x: variant.variantId,
      y: variant.sampleSize,
      label: variant.variantId,
      metadata: {
        percentage: (variant.sampleSize / results.totalParticipants) * 100
      }
    }));

    return {
      type: 'bar',
      data,
      metadata: {
        title: config?.title ?? 'Sample Size Distribution',
        xAxis: config?.xAxis ?? 'Variant',
        yAxis: config?.yAxis ?? 'Sample Size',
        description: 'Bar chart showing sample size for each variant'
      }
    };
  }

  /**
   * Generate effect size chart
   */
  generateEffectSizeChart(
    results: ExperimentResults,
    metricName: string,
    controlVariantId: string,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const controlMetric = results.variantStats.find(
      v => v.variantId === controlVariantId
    )?.metrics[metricName];

    const data = results.variantStats
      .filter(v => v.variantId !== controlVariantId)
      .map(variant => {
        const metric = variant.metrics[metricName];
        const controlStd = controlMetric?.standardDeviation ?? 1;
        const treatmentStd = metric?.standardDeviation ?? 1;
        const pooledStd = Math.sqrt((controlStd * controlStd + treatmentStd * treatmentStd) / 2);
        const effectSize = ((metric?.mean ?? 0) - (controlMetric?.mean ?? 0)) / pooledStd;

        return {
          x: variant.variantId,
          y: effectSize,
          label: variant.variantId,
          metadata: {
            interpretation: this.interpretEffectSize(effectSize),
            sampleSize: variant.sampleSize
          }
        };
      });

    return {
      type: 'bar',
      data,
      metadata: {
        title: config?.title ?? `Effect Size (Cohen's d) - ${metricName}`,
        xAxis: config?.xAxis ?? 'Variant',
        yAxis: config?.yAxis ?? "Effect Size (Cohen's d)",
        description: "Bar chart showing effect sizes (Cohen's d) for each variant"
      }
    };
  }

  /**
   * Generate power analysis chart
   */
  generatePowerChart(
    sampleSizes: number[],
    effectSize: number,
    alpha: number = 0.05,
    config?: Partial<ChartConfig>
  ): VisualizationData {
    const data = sampleSizes.map(size => {
      const power = this.calculatePower(size, effectSize, alpha);
      return {
        x: size,
        y: power * 100,
        label: `n=${size}`,
        metadata: {
          sampleSize: size,
          power,
          sufficient: power >= 0.8
        }
      };
    });

    return {
      type: 'line',
      data,
      metadata: {
        title: config?.title ?? 'Power Analysis',
        xAxis: config?.xAxis ?? 'Sample Size',
        yAxis: config?.yAxis ?? 'Statistical Power (%)',
        description: `Power curve for effect size ${effectSize.toFixed(3)} at α=${alpha}`
      }
    };
  }

  /**
   * Generate summary dashboard data
   */
  generateDashboard(
    results: ExperimentResults,
    primaryMetric: string
  ): {
    summary: {
      totalParticipants: number;
      variants: number;
      status: string;
      winner: string | null;
    };
    charts: VisualizationData[];
  } {
    const controlVariantId = results.variantStats.find(v =>
      Object.values(v.metrics).some(m => m.count > 0)
    )?.variantId ?? '';

    return {
      summary: {
        totalParticipants: results.totalParticipants,
        variants: results.variantStats.length,
        status: results.status,
        winner: results.winner?.variantId ?? null
      },
      charts: [
        this.generateBarChart(results, primaryMetric, {
          title: `${primaryMetric} by Variant`
        }),
        this.generateLiftChart(results, primaryMetric, controlVariantId, {
          title: 'Lift vs Control'
        }),
        this.generateSampleSizeChart(results, {
          title: 'Sample Size Distribution'
        })
      ]
    };
  }

  // Private helper methods

  private interpretEffectSize(effectSize: number): string {
    const abs = Math.abs(effectSize);
    if (abs < 0.2) return 'Negligible';
    if (abs < 0.5) return 'Small';
    if (abs < 0.8) return 'Medium';
    return 'Large';
  }

  private calculatePower(sampleSize: number, effectSize: number, alpha: number): number {
    // Simplified power calculation
    const zAlpha = 1.96; // For alpha = 0.05
    const n = sampleSize / 2; // Per group
    const delta = effectSize;
    const pooledStd = 1;

    const se = pooledStd * Math.sqrt(2 / n);
    const z = delta / se;

    // Power = P(Z > zAlpha - delta/SE)
    return 0.5 * (1 + this.erf((z - zAlpha) / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}
