'use client';

// @ts-nocheck
import React, { useMemo } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BaseWidget, ChartConfig, DataPoint } from '@/types';
import { format } from 'date-fns';

interface BarChartWidgetProps {
  widget: BaseWidget & { config: ChartConfig };
  data: DataPoint[];
  height?: number;
  loading?: boolean;
  error?: string;
}

export const BarChartWidget: React.FC<BarChartWidgetProps> = ({
  widget,
  data,
  height = 300,
  loading = false,
  error,
}) => {
  const { config, title, description } = widget;

  const processedData = useMemo(() => {
    return data.map(point => ({
      ...point,
      timestamp: format(new Date(point.timestamp), 'HH:mm:ss'),
    }));
  }, [data]);

  const renderBars = () => {
    return config.series.map((series, index) => (
      <Bar
        key={series.name}
        dataKey={series.dataKey}
        fill={series.color || config.colors?.[index] || `hsl(${index * 60}, 70%, 50%)`}
        name={series.name}
        radius={[4, 4, 0, 0]}
        animationDuration={500}
        isAnimationActive={true}
      />
    ));
  };

  const renderThresholds = () => {
    if (!config.thresholds) return null;

    return config.thresholds.map((threshold, index) => (
      <ReferenceLine
        key={index}
        y={threshold.value}
        label={threshold.label}
        stroke={threshold.color}
        strokeDasharray={threshold.dashArray || '5 5'}
        strokeWidth={2}
      />
    ));
  };

  const renderTooltip = () => {
    if (!config.tooltip?.show) return null;

    return (
      <Tooltip
        content={({ active, payload, label }) => {
          if (!active || !payload || !payload.length) return null;

          return (
            <div className="bg-background border rounded-lg shadow-lg p-3">
              <p className="font-semibold mb-2">{label}</p>
              {payload.map((entry, index) => (
                <p key={index} className="text-sm" style={{ color: entry.color }}>
                  {entry.name}: {entry.value}
                </p>
              ))}
            </div>
          );
        }}
        shared={config.tooltip.shared}
        animationDuration={200}
      />
    );
  };

  const renderLegend = () => {
    if (!config.legend?.show) return null;

    return (
      <Legend
        verticalAlign={config.legend.position === 'top' ? 'top' : 'bottom'}
        align={config.legend.align || 'center'}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive" style={{ height }}>
        <div className="text-center">
          <p className="font-semibold">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height - (title || description ? 60 : 0)}>
        <RechartsBarChart
          data={processedData}
          layout={config.xAxis?.type === 'number' ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}

          <XAxis
            dataKey="timestamp"
            type={config.xAxis?.type === 'number' ? 'number' : 'category'}
            label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -5 }}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />

          <YAxis
            label={{ value: config.yAxis?.[0]?.label, angle: -90, position: 'insideLeft' }}
            domain={[config.yAxis?.[0]?.min ?? 'auto', config.yAxis?.[0]?.max ?? 'auto']}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />

          {renderTooltip()}
          {renderLegend()}
          {renderThresholds()}
          {renderBars()}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartWidget;
