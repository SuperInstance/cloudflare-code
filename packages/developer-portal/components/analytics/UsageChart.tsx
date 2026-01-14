'use client';

import React from 'react';
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
import { UsageMetrics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatDuration } from '@/lib/utils/cn';

interface UsageChartProps {
  data: UsageMetrics[];
  metric: 'requests' | 'errors' | 'latency' | 'cost';
  type?: 'line' | 'area' | 'bar';
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export function UsageChart({ data, metric, type = 'area' }: UsageChartProps) {
  const chartData = data.map((item) => ({
    timestamp: new Date(item.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    value: item[metric as keyof UsageMetrics] as number,
    ...item,
  }));

  const getChartType = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const value = payload[0].value as number;
                  let formattedValue: string;

                  switch (metric) {
                    case 'requests':
                    case 'errors':
                      formattedValue = formatNumber(value);
                      break;
                    case 'latency':
                      formattedValue = formatDuration(value);
                      break;
                    case 'cost':
                      formattedValue = `$${value.toFixed(2)}`;
                      break;
                    default:
                      formattedValue = value.toString();
                  }

                  return (
                    <div className="bg-background border rounded-lg p-2 shadow-lg">
                      <p className="text-sm font-medium">{formattedValue}</p>
                      <p className="text-xs text-muted-foreground">{payload[0].payload.timestamp}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                name={metric.charAt(0).toUpperCase() + metric.slice(1)}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const value = payload[0].value as number;
                  let formattedValue: string;

                  switch (metric) {
                    case 'requests':
                    case 'errors':
                      formattedValue = formatNumber(value);
                      break;
                    case 'latency':
                      formattedValue = formatDuration(value);
                      break;
                    case 'cost':
                      formattedValue = `$${value.toFixed(2)}`;
                      break;
                    default:
                      formattedValue = value.toString();
                  }

                  return (
                    <div className="bg-background border rounded-lg p-2 shadow-lg">
                      <p className="text-sm font-medium">{formattedValue}</p>
                      <p className="text-xs text-muted-foreground">{payload[0].payload.timestamp}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name={metric.charAt(0).toUpperCase() + metric.slice(1)} />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`color${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const value = payload[0].value as number;
                  let formattedValue: string;

                  switch (metric) {
                    case 'requests':
                    case 'errors':
                      formattedValue = formatNumber(value);
                      break;
                    case 'latency':
                      formattedValue = formatDuration(value);
                      break;
                    case 'cost':
                      formattedValue = `$${value.toFixed(2)}`;
                      break;
                    default:
                      formattedValue = value.toString();
                  }

                  return (
                    <div className="bg-background border rounded-lg p-2 shadow-lg">
                      <p className="text-sm font-medium">{formattedValue}</p>
                      <p className="text-xs text-muted-foreground">{payload[0].payload.timestamp}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fillOpacity={1}
                fill={`url(#color${metric})`}
                name={metric.charAt(0).toUpperCase() + metric.slice(1)}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {metric.charAt(0).toUpperCase() + metric.slice(1)} Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>{getChartType()}</CardContent>
    </Card>
  );
}

interface ProviderBreakdownProps {
  data: Array<{ provider: string; requests: number; cost: number }>;
}

export function ProviderBreakdown({ data }: ProviderBreakdownProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ provider, cost }) => `${provider}: $${cost.toFixed(2)}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="cost"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const data = payload[0].payload as typeof chartData[0];
                return (
                  <div className="bg-background border rounded-lg p-2 shadow-lg">
                    <p className="text-sm font-medium">{data.provider}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(data.requests)} requests
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${data.cost.toFixed(2)} cost
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface LatencyDistributionProps {
  data: UsageMetrics[];
}

export function LatencyDistribution({ data }: LatencyDistributionProps) {
  const chartData = data.map((item) => ({
    timestamp: new Date(item.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    p50: item.p50Latency,
    p95: item.p95Latency,
    p99: item.p99Latency,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                return (
                  <div className="bg-background border rounded-lg p-2 shadow-lg">
                    {payload.map((entry: any) => (
                      <p key={entry.dataKey} className="text-xs">
                        <span className="font-medium">{entry.name}:</span>{' '}
                        {formatDuration(entry.value)}
                      </p>
                    ))}
                    <p className="text-xs text-muted-foreground mt-1">
                      {payload[0].payload.timestamp}
                    </p>
                  </div>
                );
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="p50"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorP50)"
              name="P50"
            />
            <Area
              type="monotone"
              dataKey="p95"
              stroke="#f59e0b"
              fillOpacity={1}
              fill="url(#colorP95)"
              name="P95"
            />
            <Area
              type="monotone"
              dataKey="p99"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorP99)"
              name="P99"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
