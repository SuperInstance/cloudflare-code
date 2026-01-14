/**
 * Metrics chart component using Recharts
 */

'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { AnalyticsMetric } from '@/types';

interface MetricsChartProps {
  data: AnalyticsMetric[];
  type: 'line' | 'area' | 'bar';
  title: string;
  valueKey?: string;
  color?: string;
  format?: 'number' | 'currency' | 'percentage';
  className?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function MetricsChart({
  data,
  type,
  title,
  valueKey = 'value',
  color = '#3b82f6',
  format = 'number',
  className,
}: MetricsChartProps) {
  const formatValue = (value: number) => {
    if (format === 'currency') return formatCurrency(value);
    if (format === 'percentage') return `${value.toFixed(1)}%`;
    return formatNumber(value);
  };

  const ChartComponent = type === 'line' ? LineChart : type === 'area' ? AreaChart : BarChart;
  const DataComponent = type === 'line' ? Line : type === 'area' ? Area : Bar;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
              className="text-muted-foreground"
            />
            <YAxis tickFormatter={formatValue} className="text-muted-foreground" />
            <Tooltip
              labelFormatter={(value) => new Date(value as number).toLocaleString()}
              formatter={(value: number) => [formatValue(value), title]}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <DataComponent
              type="monotone"
              dataKey={valueKey}
              stroke={color}
              fill={color}
              fillOpacity={type === 'area' ? 0.3 : 1}
              strokeWidth={2}
            />
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
  className?: string;
}

export function DistributionChart({ data, title, className }: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [formatNumber(value), '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
