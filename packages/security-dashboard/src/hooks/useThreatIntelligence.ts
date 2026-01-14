import { useState, useEffect, useCallback } from 'react';
import { ThreatFeed, ThreatIndicator, ThreatMapData, AttackCampaign } from '../types';

export function useThreatFeeds() {
  const [feeds, setFeeds] = useState<ThreatFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/threats/feeds');
      if (!response.ok) throw new Error('Failed to fetch threat feeds');
      const data = await response.json();
      setFeeds(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setFeeds(generateMockFeeds());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  return { feeds, loading, error, refetch: fetchFeeds };
}

export function useThreatIndicators(feedId?: string) {
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        setLoading(true);
        const url = feedId
          ? `/api/security/threats/indicators?feedId=${feedId}`
          : '/api/security/threats/indicators';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch indicators');
        const data = await response.json();
        setIndicators(data);
      } catch (err) {
        setIndicators(generateMockIndicators());
      } finally {
        setLoading(false);
      }
    };
    fetchIndicators();
  }, [feedId]);

  return { indicators, loading };
}

export function useThreatMap() {
  const [mapData, setMapData] = useState<ThreatMapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/security/threats/map');
        if (!response.ok) throw new Error('Failed to fetch threat map data');
        const data = await response.json();
        setMapData(data);
      } catch (err) {
        setMapData(generateMockMapData());
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, []);

  return { mapData, loading };
}

export function useAttackCampaigns() {
  const [campaigns, setCampaigns] = useState<AttackCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/security/threats/campaigns');
        if (!response.ok) throw new Error('Failed to fetch campaigns');
        const data = await response.json();
        setCampaigns(data);
      } catch (err) {
        setCampaigns(generateMockCampaigns());
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  return { campaigns, loading };
}

function generateMockFeeds(): ThreatFeed[] {
  return [
    {
      id: 'cve-feed',
      name: 'CVE Database',
      type: 'cve',
      updateFrequency: 'hourly',
      lastUpdate: new Date(),
      status: 'active',
      indicators: [],
    },
    {
      id: 'ioc-feed',
      name: 'IOC Indicators',
      type: 'ioc',
      updateFrequency: 'daily',
      lastUpdate: new Date(Date.now() - 3600000),
      status: 'active',
      indicators: [],
    },
    {
      id: 'zero-day-feed',
      name: 'Zero-Day Alerts',
      type: 'zero-day',
      updateFrequency: 'real-time',
      lastUpdate: new Date(),
      status: 'active',
      indicators: [],
    },
  ];
}

function generateMockIndicators(): ThreatIndicator[] {
  return [
    {
      id: '1',
      type: 'ipv4',
      value: '192.168.1.100',
      severity: 'high',
      confidence: 95,
      source: 'Internal IDS',
      description: 'Known malicious IP detected',
      firstSeen: new Date(Date.now() - 86400000),
      lastSeen: new Date(),
      tags: ['botnet', 'ddos'],
      relatedIndicators: ['2', '3'],
    },
    {
      id: '2',
      type: 'domain',
      value: 'malicious-domain.com',
      severity: 'critical',
      confidence: 98,
      source: 'Threat Intelligence Feed',
      description: 'C2 server domain',
      firstSeen: new Date(Date.now() - 172800000),
      lastSeen: new Date(),
      tags: ['c2', 'malware'],
      relatedIndicators: ['1'],
    },
    {
      id: '3',
      type: 'cve',
      value: 'CVE-2024-1234',
      severity: 'critical',
      confidence: 100,
      source: 'NVD',
      description: 'Remote code execution vulnerability',
      firstSeen: new Date(Date.now() - 259200000),
      lastSeen: new Date(),
      tags: ['rce', 'zero-day'],
      relatedIndicators: [],
    },
  ];
}

function generateMockMapData(): ThreatMapData[] {
  return [
    { latitude: 40.7128, longitude: -74.006, count: 234, severity: 'high', country: 'US', city: 'New York' },
    { latitude: 51.5074, longitude: -0.1278, count: 189, severity: 'medium', country: 'UK', city: 'London' },
    { latitude: 52.5200, longitude: 13.4050, count: 156, severity: 'high', country: 'DE', city: 'Berlin' },
    { latitude: 35.6762, longitude: 139.6503, count: 142, severity: 'medium', country: 'JP', city: 'Tokyo' },
    { latitude: 22.3193, longitude: 114.1694, count: 98, severity: 'low', country: 'HK', city: 'Hong Kong' },
  ];
}

function generateMockCampaigns(): AttackCampaign[] {
  return [
    {
      id: '1',
      name: 'Operation Dark Cloud',
      description: 'Coordinated DDoS attack targeting financial institutions',
      status: 'active',
      startDate: new Date(Date.now() - 604800000),
      targets: ['api.example.com', 'app.example.com'],
      tactics: ['DDoS', 'Amplification Attack'],
      severity: 'critical',
      indicators: [],
    },
    {
      id: '2',
      name: 'APT-28 Campaign',
      description: 'Advanced persistent threat targeting government systems',
      status: 'mitigated',
      startDate: new Date(Date.now() - 2592000000),
      endDate: new Date(Date.now() - 864000000),
      targets: ['gov-system.example.com'],
      tactics: ['Spear Phishing', 'Credential Stuffing', 'Lateral Movement'],
      severity: 'high',
      attribution: 'Nation-State Actor',
      indicators: [],
    },
  ];
}
