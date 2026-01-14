import { useState, useEffect, useCallback } from 'react';
import { Vulnerability, VulnerabilityScan, VulnerabilityTrend, FilterOptions } from '../types';

export function useVulnerabilities(filters?: FilterOptions) {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVulnerabilities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.severity) {
        params.append('severity', filters.severity.join(','));
      }
      if (filters?.status) {
        params.append('status', filters.status.join(','));
      }

      const response = await fetch(`/api/security/vulnerabilities?${params}`);
      if (!response.ok) throw new Error('Failed to fetch vulnerabilities');
      const data = await response.json();
      setVulnerabilities(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setVulnerabilities(generateMockVulnerabilities());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchVulnerabilities();
  }, [fetchVulnerabilities]);

  const updateVulnerability = useCallback(async (id: string, updates: Partial<Vulnerability>) => {
    try {
      const response = await fetch(`/api/security/vulnerabilities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update vulnerability');
      await fetchVulnerabilities();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchVulnerabilities]);

  const markAsFalsePositive = useCallback(async (id: string, reason: string) => {
    return updateVulnerability(id, {
      status: 'false-positive',
      falsePositive: true,
      remediation: `False Positive: ${reason}`,
    });
  }, [updateVulnerability]);

  return {
    vulnerabilities,
    loading,
    error,
    refetch: fetchVulnerabilities,
    updateVulnerability,
    markAsFalsePositive,
  };
}

export function useVulnerabilityScans() {
  const [scans, setScans] = useState<VulnerabilityScan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/vulnerabilities/scans');
      if (!response.ok) throw new Error('Failed to fetch scans');
      const data = await response.json();
      setScans(data);
    } catch (err) {
      setScans(generateMockScans());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const createScan = useCallback(async (scan: Omit<VulnerabilityScan, 'id'>) => {
    try {
      const response = await fetch('/api/security/vulnerabilities/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scan),
      });
      if (!response.ok) throw new Error('Failed to create scan');
      await fetchScans();
      return true;
    } catch (err) {
      return false;
    }
  }, [fetchScans]);

  return { scans, loading, refetch: fetchScans, createScan };
}

export function useVulnerabilityTrend(days = 30) {
  const [trend, setTrend] = useState<VulnerabilityTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/security/vulnerabilities/trend?days=${days}`);
        if (!response.ok) throw new Error('Failed to fetch trend');
        const data = await response.json();
        setTrend(data);
      } catch (err) {
        setTrend(generateMockTrend());
      } finally {
        setLoading(false);
      }
    };
    fetchTrend();
  }, [days]);

  return { trend, loading };
}

function generateMockVulnerabilities(): Vulnerability[] {
  return [
    {
      id: '1',
      cveId: 'CVE-2024-1234',
      title: 'Remote Code Execution in Web Application Framework',
      description: 'A critical RCE vulnerability exists in the framework that could allow attackers to execute arbitrary code.',
      severity: 'critical',
      cvssScore: 9.8,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      affectedComponent: '@claudeflare/framework',
      affectedVersion: '2.1.0',
      fixedVersion: '2.1.1',
      discoveredAt: new Date(Date.now() - 86400000),
      publishedAt: new Date(Date.now() - 172800000),
      status: 'open',
      falsePositive: false,
      remediation: 'Upgrade to version 2.1.1 or later',
      references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-1234'],
      exploits: true,
      exploitsAvailable: 2,
      patches: true,
    },
    {
      id: '2',
      cveId: 'CVE-2024-5678',
      title: 'SQL Injection in Authentication Module',
      description: 'SQL injection vulnerability in the login form that could allow bypassing authentication.',
      severity: 'high',
      cvssScore: 8.6,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
      affectedComponent: 'auth-service',
      affectedVersion: '1.5.0',
      fixedVersion: '1.5.2',
      discoveredAt: new Date(Date.now() - 172800000),
      publishedAt: new Date(Date.now() - 259200000),
      status: 'in-progress',
      falsePositive: false,
      remediation: 'Apply patch 1.5.2 or implement parameterized queries',
      references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-5678'],
      exploits: false,
      patches: true,
    },
    {
      id: '3',
      cveId: 'CVE-2024-9012',
      title: 'Information Disclosure in API Response',
      description: 'Sensitive information may be exposed in API error responses.',
      severity: 'medium',
      cvssScore: 5.3,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
      affectedComponent: 'api-gateway',
      affectedVersion: '3.0.0',
      fixedVersion: '3.0.1',
      discoveredAt: new Date(Date.now() - 259200000),
      publishedAt: new Date(Date.now() - 345600000),
      status: 'open',
      falsePositive: false,
      remediation: 'Update to version 3.0.1 or implement error response sanitization',
      references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-9012'],
      exploits: false,
      patches: true,
    },
    {
      id: '4',
      title: 'Outdated JavaScript Dependency',
      description: ' lodash version 4.17.15 contains known vulnerabilities',
      severity: 'low',
      cvssScore: 3.1,
      cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N',
      affectedComponent: 'lodash',
      affectedVersion: '4.17.15',
      fixedVersion: '4.17.21',
      discoveredAt: new Date(Date.now() - 432000000),
      status: 'open',
      falsePositive: false,
      remediation: 'Update lodash to version 4.17.21 or later',
      references: [],
      exploits: false,
      patches: true,
    },
    {
      id: '5',
      cveId: 'CVE-2024-3456',
      title: 'Cross-Site Scripting in Dashboard',
      description: 'Reflected XSS vulnerability in the search functionality.',
      severity: 'medium',
      cvssScore: 6.1,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
      affectedComponent: 'dashboard-ui',
      affectedVersion: '1.2.0',
      fixedVersion: '1.2.1',
      discoveredAt: new Date(Date.now() - 518400000),
      status: 'resolved',
      falsePositive: false,
      remediation: 'Resolved - Input validation added',
      references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-3456'],
      exploits: false,
      patches: true,
    },
  ];
}

function generateMockScans(): VulnerabilityScan[] {
  return [
    {
      id: 'scan-1',
      name: 'Full Infrastructure Scan',
      type: 'full',
      status: 'completed',
      startTime: new Date(Date.now() - 86400000),
      endTime: new Date(Date.now() - 72000000),
      duration: 14400,
      vulnerabilities: [],
      summary: {
        total: 234,
        critical: 3,
        high: 15,
        medium: 67,
        low: 98,
        info: 51,
      },
      targets: ['production', 'staging', 'development'],
      scheduled: true,
      nextRun: new Date(Date.now() + 86400000),
    },
    {
      id: 'scan-2',
      name: 'Quick Scan - Production',
      type: 'quick',
      status: 'completed',
      startTime: new Date(Date.now() - 43200000),
      endTime: new Date(Date.now() - 39600000),
      duration: 3600,
      vulnerabilities: [],
      summary: {
        total: 45,
        critical: 1,
        high: 3,
        medium: 12,
        low: 20,
        info: 9,
      },
      targets: ['production'],
      scheduled: false,
    },
    {
      id: 'scan-3',
      name: 'Compliance Scan - SOC 2',
      type: 'compliance',
      status: 'running',
      startTime: new Date(Date.now() - 1800000),
      targets: ['production', 'staging'],
      scheduled: true,
      vulnerabilities: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
    },
  ];
}

function generateMockTrend(): VulnerabilityTrend[] {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date,
      critical: Math.floor(Math.random() * 5),
      high: Math.floor(Math.random() * 15) + 5,
      medium: Math.floor(Math.random() * 30) + 20,
      low: Math.floor(Math.random() * 40) + 30,
      info: Math.floor(Math.random() * 50) + 40,
    };
  });
}
