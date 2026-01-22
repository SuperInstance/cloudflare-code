import { useState, useCallback, useEffect } from 'react';
import {
  UsageAnalytics,
  UsageMetrics,
  BillingInfo,
  CostForecast,
} from '@/types';
import { getAnalyticsClient } from '@/lib/api/analytics';

export function useAnalytics() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [forecast, setForecast] = useState<CostForecast | null>(null);

  const fetchAnalytics = useCallback(
    async (startDate: Date, endDate: Date) => {
      setIsLoading(true);
      setError(null);

      try {
        const client = getAnalyticsClient();
        const data = await client.getUsageAnalytics(startDate, endDate);
        setAnalytics(data);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch analytics';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchBilling = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = getAnalyticsClient();
      const data = await client.getBillingInfo();
      setBilling(data);
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch billing info';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(
    async (period: 'month' | 'quarter' | 'year' = 'month') => {
      setIsLoading(true);
      setError(null);

      try {
        const client = getAnalyticsClient();
        const data = await client.getCostForecast(period);
        setForecast(data);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch forecast';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    analytics,
    billing,
    forecast,
    fetchAnalytics,
    fetchBilling,
    fetchForecast,
  };
}

export function useMetrics(startDate: Date, endDate: Date) {
  const [metrics, setMetrics] = useState<UsageMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      setIsLoading(true);
      setError(null);

      try {
        const client = getAnalyticsClient();
        const data = await client.getMetrics(startDate, endDate);
        setMetrics(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch metrics';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [startDate, endDate]);

  return { metrics, isLoading, error };
}

export function useTopEndpoints(
  startDate: Date,
  endDate: Date,
  limit = 10
) {
  const [endpoints, setEndpoints] = useState<
    Array<{ path: string; requests: number; avgLatency: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEndpoints() {
      setIsLoading(true);
      setError(null);

      try {
        const client = getAnalyticsClient();
        const data = await client.getTopEndpoints(startDate, endDate, limit);
        setEndpoints(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch endpoints';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadEndpoints();
  }, [startDate, endDate, limit]);

  return { endpoints, isLoading, error };
}
