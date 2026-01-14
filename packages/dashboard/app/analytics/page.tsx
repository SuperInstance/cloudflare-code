/**
 * Analytics page
 */

'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { MetricsChart, DistributionChart } from '@/components/analytics/metrics-chart';
import { StatsGrid } from '@/components/dashboard/stats-card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { formatNumber } from '@/lib/utils';
import type { AnalyticsData, ProviderMetrics } from '@/types';

export default function AnalyticsPage() {
  const [period, setPeriod] = React.useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = React.useState(true);
  const [analytics, setAnalytics] = React.useState<AnalyticsData>({
    requests: [],
    costs: [],
    tokens: [],
    latency: [],
    cacheHitRate: [],
    errors: [],
  });
  const [providerMetrics, setProviderMetrics] = React.useState<ProviderMetrics[]>([]);

  React.useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, providersRes] = await Promise.all([
        apiClient.getAnalyticsData(period),
        apiClient.getProviderMetrics(period),
      ]);

      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }
      if (providersRes.success) {
        setProviderMetrics(providersRes.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const mockRequestData = Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
    value: Math.floor(Math.random() * 1000) + 500,
  }));

  const mockCostData = Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
    value: Math.random() * 10 + 1,
  }));

  const mockTokenData = Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
    value: Math.floor(Math.random() * 100000) + 50000,
  }));

  const mockProviderData = [
    { name: 'Anthropic', value: 45 },
    { name: 'OpenAI', value: 35 },
    { name: 'Cohere', value: 12 },
    { name: 'Mistral', value: 8 },
  ];

  const mockModelData = [
    { name: 'Claude 3 Opus', value: 30 },
    { name: 'Claude 3 Sonnet', value: 25 },
    { name: 'GPT-4 Turbo', value: 20 },
    { name: 'Claude 3 Haiku', value: 15 },
    { name: 'GPT-4', value: 10 },
  ];

  if (loading) {
    return (
      <MainLayout title="Analytics">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Analytics">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Analytics Overview</h2>
            <p className="text-muted-foreground">Detailed metrics and insights</p>
          </div>
          <div className="flex gap-2">
            {(['24h', '7d', '30d', '90d'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <StatsGrid
          stats={[
            {
              title: 'Total Requests',
              value: mockRequestData.reduce((sum, d) => sum + d.value, 0),
              change: 15.2,
              changeType: 'increase',
            },
            {
              title: 'Total Cost',
              value: mockCostData.reduce((sum, d) => sum + d.value, 0).toFixed(2),
              change: -5.4,
              changeType: 'decrease',
            },
            {
              title: 'Total Tokens',
              value: mockTokenData.reduce((sum, d) => sum + d.value, 0),
              change: 22.1,
              changeType: 'increase',
            },
            {
              title: 'Avg Latency',
              value: '245ms',
              change: -8.3,
              changeType: 'increase',
            },
          ]}
        />

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <MetricsChart
            data={mockRequestData}
            type="area"
            title="Requests Over Time"
            color="#3b82f6"
          />
          <MetricsChart
            data={mockCostData}
            type="line"
            title="Cost Over Time"
            color="#10b981"
            format="currency"
          />
          <MetricsChart
            data={mockTokenData}
            type="bar"
            title="Tokens Over Time"
            color="#f59e0b"
          />
          <MetricsChart
            data={Array.from({ length: 30 }, (_, i) => ({
              timestamp: Date.now() - (29 - i) * 24 * 60 * 60 * 1000,
              value: Math.random() * 100 + 200,
            }))}
            type="line"
            title="Latency Over Time"
            color="#ef4444"
          />
        </div>

        {/* Distribution Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <DistributionChart data={mockProviderData} title="Usage by Provider" />
          <DistributionChart data={mockModelData} title="Usage by Model" />
        </div>

        {/* Provider Performance */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Provider Performance</h3>
          <div className="space-y-4">
            {providerMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No provider data available</p>
            ) : (
              providerMetrics.map((provider) => (
                <div key={provider.provider} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{provider.provider}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(provider.requests)} requests
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                      <p className="font-medium">${provider.cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tokens</p>
                      <p className="font-medium">{formatNumber(provider.tokens)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Latency</p>
                      <p className="font-medium">{provider.averageLatency}ms</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
