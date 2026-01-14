'use client';

import React, { useMemo } from 'react';
import { Gauge } from '@/components/ui/gauge';
import { BaseWidget, CounterConfig } from '@/types';

interface GaugeChartWidgetProps {
  widget: BaseWidget & { config: CounterConfig };
  value: number;
  min?: number;
  max?: number;
  thresholds?: { value: number; color: string; label?: string }[];
  height?: number;
  loading?: boolean;
  error?: string;
}

export const GaugeChartWidget: React.FC<GaugeChartWidgetProps> = ({
  widget,
  value,
  min = 0,
  max = 100,
  thresholds,
  height = 300,
  loading = false,
  error,
}) => {
  const { config, title, description } = widget;

  const { displayValue, percentage, color } = useMemo(() => {
    const percentage = ((value - min) / (max - min)) * 100;
    const displayValue = formatValue(value, config);

    let color = 'hsl(142, 76%, 36%)'; // green by default

    if (thresholds) {
      const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
      for (const threshold of sortedThresholds) {
        if (value >= threshold.value) {
          color = threshold.color;
        }
      }
    } else if (percentage < 30) {
      color = 'hsl(0, 84%, 60%)'; // red
    } else if (percentage < 60) {
      color = 'hsl(38, 92%, 50%)'; // yellow
    }

    return { displayValue, percentage, color };
  }, [value, min, max, config, thresholds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
          <div className="h-48 bg-muted rounded-full w-48 mx-auto" />
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
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {(title || description) && (
        <div className="mb-4 text-center">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <Gauge
        value={value}
        min={min}
        max={max}
        color={color}
        size={Math.min(height - 100, 300)}
        showValue={true}
        valueFormat={(val) => formatValue(val, config)}
        thresholds={thresholds}
      />

      {config.target && (
        <div className="mt-4 w-full max-w-md">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress to target</span>
            <span className="font-semibold">{Math.round(percentage)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      )}

      {config.trend && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium',
              config.trend.direction === 'up' && 'text-green-600',
              config.trend.direction === 'down' && 'text-red-600'
            )}
          >
            {config.trend.direction === 'up' && '↑'}
            {config.trend.direction === 'down' && '↓'}
            {config.trend.percentage.toFixed(1)}%
          </span>
          <span className="text-sm text-muted-foreground">vs {config.trend.period}</span>
        </div>
      )}

      {config.sparkline?.show && (
        <div className="mt-4 w-full">
          {/* Sparkline would be rendered here with historical data */}
          <div className="h-12 bg-muted/20 rounded" />
        </div>
      )}
    </div>
  );
};

function formatValue(value: number, config: CounterConfig): string {
  let formatted = value.toFixed(config.decimals ?? 2);

  switch (config.format) {
    case 'currency':
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
      break;

    case 'percentage':
      formatted = `${value.toFixed(1)}%`;
      break;

    case 'bytes':
      formatted = formatBytes(value);
      break;

    case 'duration':
      formatted = formatDuration(value);
      break;

    default:
      if (config.prefix) formatted = `${config.prefix}${formatted}`;
      if (config.suffix) formatted = `${formatted}${config.suffix}`;
      if (config.unit) formatted = `${formatted} ${config.unit}`;
  }

  return formatted;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

import { cn } from '@/lib/utils';

export default GaugeChartWidget;
