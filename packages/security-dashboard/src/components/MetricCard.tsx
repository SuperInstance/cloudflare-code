import React from 'react';
import { SecurityMetric } from '../types';
import { formatNumber, cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface MetricCardProps {
  metric: SecurityMetric;
  className?: string;
}

export function MetricCard({ metric, className }: MetricCardProps) {
  const isWarning = metric.value >= metric.threshold.warning;
  const isCritical = metric.value >= metric.threshold.critical;

  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-md',
        isCritical && 'border-red-300 bg-red-50',
        isWarning && !isCritical && 'border-yellow-300 bg-yellow-50',
        !isWarning && !isCritical && 'border-gray-200',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-600">{metric.name}</h3>
            {(isWarning || isCritical) && (
              <AlertTriangle className={cn(
                'h-4 w-4',
                isCritical ? 'text-red-500' : 'text-yellow-500'
              )} />
            )}
          </div>
          <div className="mt-2">
            <span className={cn(
              'text-3xl font-bold',
              isCritical ? 'text-red-700' : isWarning ? 'text-yellow-700' : 'text-gray-900'
            )}>
              {formatNumber(metric.value)}
            </span>
            <span className="ml-1 text-sm text-gray-500">{metric.unit}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
            metric.trend === 'up' && 'bg-green-100 text-green-700',
            metric.trend === 'down' && 'bg-blue-100 text-blue-700',
            metric.trend === 'stable' && 'bg-gray-100 text-gray-700'
          )}>
            <TrendIcon className="h-3 w-3" />
            {metric.change > 0 ? `+${metric.change.toFixed(1)}%` : `${metric.change.toFixed(1)}%`}
          </div>
          <span className="text-xs text-gray-400">
            from last period
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className={cn(
              'h-2 rounded-full transition-all',
              isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
            )}
            style={{
              width: `${Math.min((metric.value / metric.threshold.critical) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Warning: {metric.threshold.warning}</span>
          <span>Critical: {metric.threshold.critical}</span>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Updated: {new Date(metric.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

interface MetricGridProps {
  metrics: Record<string, SecurityMetric>;
  className?: string;
}

export function MetricGrid({ metrics, className }: MetricGridProps) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {Object.values(metrics).map(metric => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
