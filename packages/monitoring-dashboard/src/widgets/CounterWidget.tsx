'use client';

// @ts-nocheck
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BaseWidget, CounterConfig, DataPoint } from '@/types';
import { cn } from '@/lib/utils';

interface CounterWidgetProps {
  widget: BaseWidget & { config: CounterConfig };
  value: number;
  previousValue?: number;
  data?: DataPoint[];
  height?: number;
  loading?: boolean;
  error?: string;
}

export const CounterWidget: React.FC<CounterWidgetProps> = ({
  widget,
  value,
  previousValue,
  data,
  height = 200,
  loading = false,
  error,
}) => {
  const { config, title, description } = widget;

  const { displayValue, trendInfo, targetPercentage } = useMemo(() => {
    const displayValue = formatValue(value, config);

    let trendInfo = null;
    if (previousValue !== undefined && config.trend?.show) {
      const change = value - previousValue;
      const percentage = previousValue !== 0 ? (change / previousValue) * 100 : 0;
      const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

      trendInfo = {
        direction,
        percentage: Math.abs(percentage),
        positive: direction === 'up' ? (config.trend.direction === 'up' ? true : false) : direction === 'down' ? (config.trend.direction === 'down' ? true : false) : false,
      };
    }

    let targetPercentage = null;
    if (config.target?.showProgress) {
      targetPercentage = (value / config.target.value) * 100;
    }

    return { displayValue, trendInfo, targetPercentage };
  }, [value, previousValue, config]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="animate-pulse space-y-4 w-full px-6">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive" style={{ height }}>
        <div className="text-center">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between p-6">
      <div>
        {title && (
          <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mb-4">{description}</p>
        )}

        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{displayValue}</span>
          {config.unit && (
            <span className="text-sm text-muted-foreground">{config.unit}</span>
          )}
        </div>

        {trendInfo && (
          <div className="flex items-center gap-1 mt-2">
            {trendInfo.direction === 'up' && (
              <TrendingUp className={cn('h-4 w-4', trendInfo.positive ? 'text-green-600' : 'text-red-600')} />
            )}
            {trendInfo.direction === 'down' && (
              <TrendingDown className={cn('h-4 w-4', trendInfo.positive ? 'text-green-600' : 'text-red-600')} />
            )}
            {trendInfo.direction === 'neutral' && (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                trendInfo.positive ? 'text-green-600' : 'text-red-600',
                trendInfo.direction === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trendInfo.percentage.toFixed(1)}%
            </span>
            <span className="text-sm text-muted-foreground">vs {config.trend?.period}</span>
          </div>
        )}
      </div>

      {targetPercentage !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{config.target?.label || 'Target'}</span>
            <span className="font-medium">{Math.min(targetPercentage, 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                targetPercentage >= 100 ? 'bg-green-500' : targetPercentage >= 75 ? 'bg-blue-500' : targetPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(targetPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {config.sparkline?.show && data && data.length > 0 && (
        <div className="mt-4 h-12">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${data.length} 48`}
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <path
              d={generateSparklinePath(data)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary opacity-60"
            />
            <path
              d={generateSparklineArea(data)}
              fill="currentColor"
              className="text-primary opacity-10"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

function formatValue(value: number, config: CounterConfig): string {
  const decimals = config.decimals ?? 2;

  switch (config.format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

    case 'percentage':
      return `${value.toFixed(decimals)}%`;

    case 'bytes':
      return formatBytes(value, decimals);

    case 'duration':
      return formatDuration(value);

    default:
      const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      let result = formatted;
      if (config.prefix) result = `${config.prefix}${result}`;
      if (config.suffix) result = `${result}${config.suffix}`;
      return result;
  }
}

function formatBytes(bytes: number, decimals: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function generateSparklinePath(data: DataPoint[]): string {
  if (data.length < 2) return '';

  const width = data.length - 1;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((point, index) => {
    const x = index;
    const y = 48 - ((point.value - min) / range) * 48;
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
}

function generateSparklineArea(data: DataPoint[]): string {
  if (data.length < 2) return '';

  const linePath = generateSparklinePath(data);
  return `${linePath} L ${data.length - 1},48 L 0,48 Z`;
}

export default CounterWidget;
