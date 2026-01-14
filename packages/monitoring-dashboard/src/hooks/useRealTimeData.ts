'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRealTime } from '@/contexts/RealTimeContext';
import { DataPoint } from '@/types';

interface UseRealTimeDataOptions {
  metricName: string;
  autoSubscribe?: boolean;
  bufferSize?: number;
}

export function useRealTimeData({
  metricName,
  autoSubscribe = true,
  bufferSize = 100,
}: UseRealTimeDataOptions) {
  const { metrics, latestMetrics, subscribeToMetric, unsubscribeFromMetric, isConnected } = useRealTime();

  const [data, setData] = useState<DataPoint[]>([]);
  const [latestValue, setLatestValue] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (autoSubscribe) {
      subscribeToMetric(metricName);
    }

    return () => {
      if (autoSubscribe) {
        unsubscribeFromMetric(metricName);
      }
    };
  }, [metricName, autoSubscribe, subscribeToMetric, unsubscribeFromMetric]);

  useEffect(() => {
    const metricData = metrics.get(metricName) || [];
    setData(metricData.slice(-bufferSize));
  }, [metrics, metricName, bufferSize]);

  useEffect(() => {
    const value = latestMetrics.get(metricName);
    setLatestValue(value ?? null);
  }, [latestMetrics, metricName]);

  const refresh = useCallback(() => {
    const metricData = metrics.get(metricName) || [];
    setData(metricData.slice(-bufferSize));
  }, [metricName, metrics, bufferSize]);

  return {
    data,
    latestValue,
    isConnected,
    error,
    refresh,
  };
}

export default useRealTimeData;
