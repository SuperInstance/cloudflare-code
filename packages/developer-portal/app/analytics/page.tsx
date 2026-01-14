'use client';

import React, { useState, useEffect } from 'react';
import { useAnalytics, useMetrics, useTopEndpoints } from '@/lib/hooks/useAnalytics';
import { MetricsCards } from '@/components/analytics/MetricsCards';
import { UsageChart } from '@/components/analytics/UsageChart';
import { ProviderBreakdown } from '@/components/analytics/ProviderBreakdown';
import { LatencyDistribution } from '@/components/analytics/LatencyDistribution';
import { TopEndpoints } from '@/components/analytics/TopEndpoints';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { subDays } from 'date-fns';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7),
    end: new Date(),
  });

  const { analytics, billing, forecast, fetchAnalytics, fetchBilling, fetchForecast } =
    useAnalytics();

  const { metrics, isLoading: metricsLoading } = useMetrics(
    dateRange.start,
    dateRange.end
  );

  const { endpoints, isLoading: endpointsLoading } = useTopEndpoints(
    dateRange.start,
    dateRange.end
  );

  useEffect(() => {
    fetchAnalytics(dateRange.start, dateRange.end);
    fetchBilling();
    fetchForecast('month');
  }, [dateRange]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Usage Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Monitor your API usage, performance, and costs
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Date Range Picker */}
        <DateRangePicker value={dateRange} onChange={setDateRange} />

        {/* Metrics Cards */}
        <MetricsCards analytics={analytics} isLoading={false} />

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <UsageChart data={metrics} metric="requests" type="area" />
          <UsageChart data={metrics} metric="errors" type="area" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <LatencyDistribution data={metrics} />
          <UsageChart data={metrics} metric="cost" type="bar" />
        </div>

        {/* Breakdowns */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopEndpoints data={endpoints} />
          <ProviderBreakdown data={analytics?.providerBreakdown || []} />
        </div>
      </div>
    </div>
  );
}
