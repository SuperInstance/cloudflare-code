'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign, AlertCircle } from 'lucide-react';
import { UsageAnalytics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatDuration, formatCurrency } from '@/lib/utils/cn';

interface MetricsCardsProps {
  analytics: UsageAnalytics | null;
  isLoading: boolean;
}

export function MetricsCards({ analytics, isLoading }: MetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardTitle>
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const metrics = [
    {
      title: 'Total Requests',
      value: formatNumber(analytics.totalRequests),
      change: '+12.5%',
      changePositive: true,
      icon: Activity,
    },
    {
      title: 'Error Rate',
      value: `${analytics.errorRate.toFixed(2)}%`,
      change: '-2.1%',
      changePositive: true,
      icon: AlertCircle,
    },
    {
      title: 'Avg Latency',
      value: formatDuration(analytics.avgLatency),
      change: '+5.3%',
      changePositive: false,
      icon: Zap,
    },
    {
      title: 'Total Cost',
      value: formatCurrency(
        analytics.providerBreakdown.reduce((sum, p) => sum + p.cost, 0)
      ),
      change: '+8.7%',
      changePositive: false,
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {metric.changePositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={metric.changePositive ? 'text-green-500' : 'text-red-500'}>
                  {metric.change}
                </span>
                <span>from last month</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
