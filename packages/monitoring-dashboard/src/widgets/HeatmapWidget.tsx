'use client';

import React, { useMemo } from 'react';
import { BaseWidget, HeatmapConfig, DataPoint } from '@/types';
import { cn } from '@/lib/utils';

interface HeatmapWidgetProps {
  widget: BaseWidget & { config: HeatmapConfig };
  data: DataPoint[];
  height?: number;
  loading?: boolean;
  error?: string;
}

export const HeatmapWidget: React.FC<HeatmapWidgetProps> = ({
  widget,
  data,
  height = 400,
  loading = false,
  error,
}) => {
  const { config, title, description } = widget;

  const { heatmapData, xLabels, yLabels, colorScale, min, max } = useMemo(() => {
    // Extract unique x and y values
    const xValues = [...new Set(data.map(d => d.labels?.[config.xAxis] || d[config.xAxis]))];
    const yValues = [...new Set(data.map(d => d.labels?.[config.yAxis] || d[config.yAxis]))];

    // Build 2D matrix
    const matrix: Record<string, Record<string, number>> = {};
    yValues.forEach(y => {
      matrix[y] = {};
      xValues.forEach(x => {
        matrix[y][x] = 0;
      });
    });

    data.forEach(point => {
      const x = point.labels?.[config.xAxis] || point[config.xAxis];
      const y = point.labels?.[config.yAxis] || point[config.yAxis];
      const value = point.value;
      if (matrix[y] && matrix[y][x] !== undefined) {
        matrix[y][x] = value;
      }
    });

    const heatmapData = yValues.map(y => ({
      y,
      values: xValues.map(x => matrix[y]?.[x] || 0),
    }));

    // Calculate min/max for color scaling
    const allValues = data.map(d => d.value);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    // Color scale function
    const colorScale = (value: number) => {
      const normalized = (value - min) / (max - min || 1);
      return getColorForValue(normalized, config.colorScheme);
    };

    return {
      heatmapData,
      xLabels: xValues,
      yLabels: yValues,
      colorScale,
      min,
      max,
    };
  }, [data, config]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
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

  const cellSize = config.cellSize || 40;

  return (
    <div className="w-full h-full p-4">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex flex-col gap-1" style={{ height: cellSize * yLabels.length }}>
          <div style={{ height: cellSize }} />
          {yLabels.map(y => (
            <div
              key={y}
              className="flex items-center text-xs text-muted-foreground"
              style={{ height: cellSize }}
            >
              {y}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          <div className="inline-block">
            <div className="flex">
              <div style={{ width: cellSize }} />
              {xLabels.map(x => (
                <div
                  key={x}
                  className="flex items-center justify-center text-xs text-muted-foreground"
                  style={{ width: cellSize, height: cellSize }}
                >
                  {x}
                </div>
              ))}
            </div>

            {heatmapData.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.values.map((value, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={cn(
                      'flex items-center justify-center text-xs font-medium cursor-pointer transition-opacity hover:opacity-80',
                      config.showLabels && 'border border-border/20'
                    )}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: colorScale(value),
                      color: getContrastColor(value, min, max),
                    }}
                    title={`${xLabels[colIndex]} × ${row.y}: ${value.toFixed(2)}`}
                  >
                    {config.showLabels && value.toFixed(0)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {config.legend?.show && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground">Max</span>
            <div
              className="w-4 rounded"
              style={{
                height: cellSize * yLabels.length,
                background: `linear-gradient(to bottom, ${getColorForValue(1, config.colorScheme)}, ${getColorForValue(0, config.colorScheme)})`,
              }}
            />
            <span className="text-xs text-muted-foreground">Min</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <span>Min: {min.toFixed(2)}</span>
        <span>Max: {max.toFixed(2)}</span>
      </div>
    </div>
  );
};

function getColorForValue(normalized: number, scheme: string): string {
  const clamp = (num: number) => Math.max(0, Math.min(1, num));

  switch (scheme) {
    case 'heatmap':
      // Red to yellow to green
      if (normalized < 0.5) {
        return `hsl(${clamp(normalized * 2) * 60}, 100%, 50%)`;
      } else {
        return `hsl(${120 - clamp((normalized - 0.5) * 2) * 120}, 100%, 50%)`;
      }

    case 'blues':
      return `hsl(220, 80%, ${20 + normalized * 70}%)`;

    case 'greens':
      return `hsl(142, 76%, ${20 + normalized * 70}%)`;

    case 'reds':
      return `hsl(0, 84%, ${20 + normalized * 70}%)`;

    case 'spectral':
      return `hsl(${normalized * 240}, 80%, 50%)`;

    default:
      return `hsl(220, 80%, ${20 + normalized * 70}%)`;
  }
}

function getContrastColor(value: number, min: number, max: number): string {
  const normalized = (value - min) / (max - min || 1);
  return normalized > 0.5 ? '#ffffff' : '#000000';
}

export default HeatmapWidget;
