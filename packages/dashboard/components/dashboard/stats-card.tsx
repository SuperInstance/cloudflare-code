/**
 * Stats card component for dashboard metrics
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  description,
  className,
}: StatsCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (title.toLowerCase().includes('cost') || title.toLowerCase().includes('revenue')) {
        return formatCurrency(val);
      }
      return formatNumber(val);
    }
    return val;
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {change !== undefined && (
          <p className="mt-1 text-xs text-muted-foreground">
            <span
              className={cn(
                'font-medium',
                changeType === 'increase' && 'text-green-600 dark:text-green-400',
                changeType === 'decrease' && 'text-red-600 dark:text-red-400'
              )}
            >
              {changeType === 'increase' && '+'}
              {changeType === 'decrease' && '-'}
              {typeof change === 'number' ? `${change.toFixed(1)}%` : change}
            </span>{' '}
            from last period
          </p>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface StatsGridProps {
  stats: Array<{
    title: string;
    value: string | number;
    change?: number;
    changeType?: 'increase' | 'decrease' | 'neutral';
    icon?: React.ReactNode;
    description?: string;
  }>;
  className?: string;
}

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {stats.map((stat, index) => (
        <StatsCard key={index} {...stat} />
      ))}
    </div>
  );
}
