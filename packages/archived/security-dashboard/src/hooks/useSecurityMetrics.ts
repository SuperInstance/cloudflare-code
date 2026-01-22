import { useState, useEffect, useCallback } from 'react';
import { SecurityMetricsData, SecurityMetric } from '../types';

export function useSecurityMetrics(refreshInterval = 30000) {
  const [metrics, setMetrics] = useState<SecurityMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      // Simulated API call - replace with actual implementation
      const response = await fetch('/api/security/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Use mock data as fallback
      setMetrics(generateMockMetrics());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

function generateMockMetrics(): SecurityMetricsData {
  const now = new Date();
  const timeline = Array.from({ length: 24 }, (_, i) => {
    const date = new Date(now);
    date.setHours(date.getHours() - (23 - i));
    return date;
  });

  return {
    realTime: {
      threatAttempts: {
        id: '1',
        name: 'Threat Attempts',
        value: 1247,
        unit: 'count',
        trend: 'up',
        change: 12.5,
        threshold: { warning: 1000, critical: 1500 },
        timestamp: now,
      },
      blockedAttacks: {
        id: '2',
        name: 'Blocked Attacks',
        value: 1189,
        unit: 'count',
        trend: 'up',
        change: 15.2,
        threshold: { warning: 900, critical: 1200 },
        timestamp: now,
      },
      activeSessions: {
        id: '3',
        name: 'Active Sessions',
        value: 3421,
        unit: 'sessions',
        trend: 'stable',
        change: 2.1,
        threshold: { warning: 4000, critical: 5000 },
        timestamp: now,
      },
      failedLogins: {
        id: '4',
        name: 'Failed Logins',
        value: 234,
        unit: 'attempts',
        trend: 'down',
        change: 8.3,
        threshold: { warning: 300, critical: 500 },
        timestamp: now,
      },
      apiAbuse: {
        id: '5',
        name: 'API Abuse Attempts',
        value: 89,
        unit: 'attempts',
        trend: 'up',
        change: 23.4,
        threshold: { warning: 100, critical: 200 },
        timestamp: now,
      },
      dataExfiltrationAttempts: {
        id: '6',
        name: 'Data Exfiltration Attempts',
        value: 12,
        unit: 'attempts',
        trend: 'stable',
        change: 0,
        threshold: { warning: 20, critical: 50 },
        timestamp: now,
      },
      anomalyScore: {
        id: '7',
        name: 'Anomaly Score',
        value: 23,
        unit: 'score',
        trend: 'down',
        change: 5.2,
        threshold: { warning: 50, critical: 75 },
        timestamp: now,
      },
    },
    historical: {
      timeline,
      threatAttempts: timeline.map(() => Math.floor(Math.random() * 500) + 800),
      blockedAttacks: timeline.map(() => Math.floor(Math.random() * 400) + 700),
      failedLogins: timeline.map(() => Math.floor(Math.random() * 100) + 150),
      apiAbuse: timeline.map(() => Math.floor(Math.random() * 50) + 50),
    },
  };
}

export function useSecurityMetric(id: string) {
  const { metrics } = useSecurityMetrics();
  return metrics?.realTime[Object.keys(metrics.realTime).find(
    key => (metrics.realTime as any)[key]?.id === id
  ) as keyof typeof metrics.realTime];
}
