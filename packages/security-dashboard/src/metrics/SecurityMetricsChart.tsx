import React from 'react';
import { SecurityMetricsData } from '../types';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

interface SecurityMetricsChartProps {
  data: SecurityMetricsData;
  type?: 'line' | 'area' | 'bar';
  className?: string;
}

export function SecurityMetricsChart({
  data,
  type = 'area',
  className,
}: SecurityMetricsChartProps) {
  const chartData = data.historical.timeline.map((timestamp, index) => ({
    timestamp,
    threatAttempts: data.historical.threatAttempts[index] || 0,
    blockedAttacks: data.historical.blockedAttacks[index] || 0,
    failedLogins: data.historical.failedLogins[index] || 0,
    apiAbuse: data.historical.apiAbuse[index] || 0,
  }));

  const ChartComponent = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => format(new Date(value), 'HH:mm')}
            stroke="#6b7280"
          />
          <YAxis stroke="#6b7280" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            labelFormatter={(value) => format(new Date(value as Date), 'yyyy-MM-dd HH:mm')}
          />
          <Legend />
          {type === 'line' ? (
            <>
              <Line
                type="monotone"
                dataKey="threatAttempts"
                stroke="#ef4444"
                strokeWidth={2}
                name="Threat Attempts"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="blockedAttacks"
                stroke="#22c55e"
                strokeWidth={2}
                name="Blocked Attacks"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="failedLogins"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Failed Logins"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="apiAbuse"
                stroke="#3b82f6"
                strokeWidth={2}
                name="API Abuse"
                dot={false}
              />
            </>
          ) : type === 'bar' ? (
            <>
              <Bar dataKey="threatAttempts" fill="#ef4444" name="Threat Attempts" />
              <Bar dataKey="blockedAttacks" fill="#22c55e" name="Blocked Attacks" />
              <Bar dataKey="failedLogins" fill="#f59e0b" name="Failed Logins" />
              <Bar dataKey="apiAbuse" fill="#3b82f6" name="API Abuse" />
            </>
          ) : (
            <>
              <Area
                type="monotone"
                dataKey="threatAttempts"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                name="Threat Attempts"
              />
              <Area
                type="monotone"
                dataKey="blockedAttacks"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.3}
                name="Blocked Attacks"
              />
              <Area
                type="monotone"
                dataKey="failedLogins"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
                name="Failed Logins"
              />
              <Area
                type="monotone"
                dataKey="apiAbuse"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name="API Abuse"
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

interface MetricDistributionProps {
  data: SecurityMetricsData;
  className?: string;
}

export function MetricDistribution({ data, className }: MetricDistributionProps) {
  const metrics = Object.values(data.realTime);
  const total = metrics.reduce((sum, metric) => sum + metric.value, 0);

  const distributionData = metrics.map((metric) => ({
    name: metric.name,
    value: metric.value,
    percentage: total > 0 ? ((metric.value / total) * 100).toFixed(1) : '0',
    color:
      metric.value >= metric.threshold.critical
        ? '#ef4444'
        : metric.value >= metric.threshold.warning
        ? '#f59e0b'
        : '#22c55e',
  }));

  return (
    <div className={className}>
      <div className="space-y-3">
        {distributionData.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{item.name}</span>
              <span className="text-gray-500">{item.percentage}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface MetricComparisonProps {
  data: SecurityMetricsData;
  className?: string;
}

export function MetricComparison({ data, className }: MetricComparisonProps) {
  const metrics = Object.values(data.realTime);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={metrics.map((m) => ({
            name: m.name.split(' ')[0],
            current: m.value,
            warning: m.threshold.warning,
            critical: m.threshold.critical,
          }))}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis type="number" stroke="#6b7280" />
          <YAxis dataKey="name" type="category" width={100} stroke="#6b7280" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
          <Bar dataKey="current" fill="#3b82f6" name="Current Value" />
          <Bar dataKey="warning" fill="#f59e0b" name="Warning Threshold" />
          <Bar dataKey="critical" fill="#ef4444" name="Critical Threshold" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AnomalyDetectionProps {
  data: SecurityMetricsData;
  className?: string;
}

export function AnomalyDetection({ data, className }: AnomalyDetectionProps) {
  const anomalies = Object.values(data.realTime).filter(
    (metric) => metric.value >= metric.threshold.warning
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        {anomalies.length === 0 ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-700">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 font-medium">No anomalies detected</p>
            <p className="text-sm">All metrics are within normal ranges</p>
          </div>
        ) : (
          anomalies.map((anomaly) => {
            const severity =
              anomaly.value >= anomaly.threshold.critical ? 'critical' : 'warning';
            return (
              <div
                key={anomaly.id}
                className={`rounded-lg border p-4 ${
                  severity === 'critical'
                    ? 'border-red-300 bg-red-50'
                    : 'border-yellow-300 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{anomaly.name}</h4>
                    <p className="text-sm text-gray-600">
                      Current value: {anomaly.value} {anomaly.unit}
                    </p>
                    <p className="text-xs text-gray-500">
                      Threshold: {anomaly.threshold.warning} (warning) /{' '}
                      {anomaly.threshold.critical} (critical)
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      severity === 'critical'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}
                  >
                    {severity.toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
