'use client';

import React, { useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { BaseWidget, ChartConfig, DataPoint } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LineChartWidgetProps {
  widget: BaseWidget & { config: ChartConfig };
  data: DataPoint[];
  height?: number;
  loading?: boolean;
  error?: string;
}

export const LineChartWidget: React.FC<LineChartWidgetProps> = ({
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
      formattedValue: point.value.toFixed(2),
    }));
  }, [data]);

  const renderLines = () => {
    return config.series.map((series, index) => (
      <Line
        key={series.name}
        type="monotone"
        dataKey={series.dataKey}
        stroke={series.color || config.colors?.[index] || `hsl(${index * 60}, 70%, 50%)`}
        strokeWidth={series.strokeWidth || 2}
        dot={series.showPoints ? { r: 4 } : false}
        activeDot={{ r: 6 }}
        name={series.name}
        animationDuration={500}
        isAnimationActive={widget.config.zoom !== false}
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

  const renderAnnotations = () => {
    if (!config.annotations) return null;

    return config.annotations.map((annotation, index) => {
      if (annotation.type === 'line') {
        return (
          <ReferenceLine
            key={index}
            x={annotation.x}
            y={annotation.y}
            label={annotation.label}
            stroke={annotation.color || '#666'}
            strokeDasharray={annotation.dashArray || '3 3'}
          />
        );
      }
      return null;
    });
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
        wrapperStyle={{ paddingTop: config.legend.position === 'top' ? '10px' : '0' }}
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

  const ChartComponent = config.area ? ComposedChart : RechartsLineChart;

  return (
    <div className="w-full h-full p-4">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height - (title || description ? 60 : 0)}>
        <ChartComponent data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}

          <XAxis
            dataKey="timestamp"
            type={config.xAxis?.type === 'time' ? 'number' : 'category'}
            label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -5 }}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />

          {config.yAxis?.map((yAxisConfig, index) => (
            <YAxis
              key={index}
              yAxisId={`y${index}`}
              label={{ value: yAxisConfig.label, angle: -90, position: 'insideLeft' }}
              domain={[yAxisConfig.min ?? 'auto', yAxisConfig.max ?? 'auto']}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
          ))}

          {renderTooltip()}
          {renderLegend()}
          {renderThresholds()}
          {renderAnnotations()}

          {config.series.map((series, index) => {
            const yAxisId = config.yAxis?.[series.yAxisIndex || 0] ? `y${series.yAxisIndex || 0}` : undefined;

            if (config.area) {
              return (
                <Area
                  key={series.name}
                  yAxisId={yAxisId}
                  type="monotone"
                  dataKey={series.dataKey}
                  stroke={series.color || config.colors?.[index] || `hsl(${index * 60}, 70%, 50%)`}
                  fillOpacity={series.fillOpacity || 0.3}
                  fill={series.color || config.colors?.[index] || `hsl(${index * 60}, 70%, 50%)`}
                  name={series.name}
                  strokeWidth={series.strokeWidth || 2}
                />
              );
            }

            return (
              <Line
                key={series.name}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={series.dataKey}
                stroke={series.color || config.colors?.[index] || `hsl(${index * 60}, 70%, 50%)`}
                strokeWidth={series.strokeWidth || 2}
                dot={series.showPoints ? { r: 4 } : false}
                activeDot={{ r: 6 }}
                name={series.name}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartWidget;
