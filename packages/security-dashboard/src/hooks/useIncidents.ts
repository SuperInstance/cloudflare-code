import { useState, useEffect, useCallback } from 'react';
import { Incident, ResponsePlaybook, FilterOptions, PaginationOptions, ApiResponse } from '../types';

export function useIncidents(filters?: FilterOptions, pagination?: PaginationOptions) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.dateRange) {
        params.append('startDate', filters.dateRange.start.toISOString());
        params.append('endDate', filters.dateRange.end.toISOString());
      }
      if (filters?.severity) {
        params.append('severity', filters.severity.join(','));
      }
      if (filters?.status) {
        params.append('status', filters.status.join(','));
      }
      if (pagination) {
        params.append('page', pagination.page.toString());
        params.append('pageSize', pagination.pageSize.toString());
      }

      const response = await fetch(`/api/security/incidents?${params}`);
      if (!response.ok) throw new Error('Failed to fetch incidents');
      const data: ApiResponse<Incident[]> = await response.json();
      setIncidents(data.data);
      setTotalCount(data.pagination?.total || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIncidents(generateMockIncidents());
    } finally {
      setLoading(false);
    }
  }, [filters, pagination]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const createIncident = useCallback(async (incident: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/security/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      });
      if (!response.ok) throw new Error('Failed to create incident');
      await fetchIncidents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchIncidents]);

  const updateIncident = useCallback(async (id: string, updates: Partial<Incident>) => {
    try {
      const response = await fetch(`/api/security/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update incident');
      await fetchIncidents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchIncidents]);

  const deleteIncident = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/security/incidents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete incident');
      await fetchIncidents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchIncidents]);

  return {
    incidents,
    loading,
    error,
    totalCount,
    refetch: fetchIncidents,
    createIncident,
    updateIncident,
    deleteIncident,
  };
}

export function useIncident(id: string) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/security/incidents/${id}`);
        if (!response.ok) throw new Error('Failed to fetch incident');
        const data = await response.json();
        setIncident(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchIncident();
  }, [id]);

  const updateTask = useCallback(async (taskId: string, updates: any) => {
    if (!incident) return false;
    try {
      const updatedTasks = incident.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      );
      const response = await fetch(`/api/security/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      const updated = await response.json();
      setIncident(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [incident, id]);

  const addTimelineEntry = useCallback(async (entry: Omit<Incident['timeline'][0], 'id'>) => {
    if (!incident) return false;
    try {
      const response = await fetch(`/api/security/incidents/${id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error('Failed to add timeline entry');
      const updated = await response.json();
      setIncident(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [incident, id]);

  return { incident, loading, error, updateTask, addTimelineEntry };
}

export function useResponsePlaybooks() {
  const [playbooks, setPlaybooks] = useState<ResponsePlaybook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaybooks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/security/playbooks');
        if (!response.ok) throw new Error('Failed to fetch playbooks');
        const data = await response.json();
        setPlaybooks(data);
      } catch (err) {
        setPlaybooks(generateMockPlaybooks());
      } finally {
        setLoading(false);
      }
    };
    fetchPlaybooks();
  }, []);

  return { playbooks, loading };
}

function generateMockIncidents(): Incident[] {
  return [
    {
      id: '1',
      title: 'Suspicious Database Access',
      description: 'Multiple failed login attempts detected from unusual IP addresses targeting the production database.',
      severity: 'high',
      status: 'investigating',
      priority: 2,
      assignedTo: 'security@claudeflare.com',
      createdBy: 'system',
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(),
      tags: ['database', 'brute-force', 'external'],
      tasks: [
        {
          id: 't1',
          title: 'Identify source IP addresses',
          description: 'Analyze logs to identify all attacking IPs',
          status: 'completed',
          assignedTo: 'analyst1@claudeflare.com',
          completedAt: new Date(Date.now() - 1800000),
          order: 1,
        },
        {
          id: 't2',
          title: 'Block malicious IPs',
          description: 'Add IP addresses to firewall blocklist',
          status: 'in-progress',
          assignedTo: 'analyst2@claudeflare.com',
          order: 2,
        },
        {
          id: 't3',
          title: 'Audit affected accounts',
          description: 'Review all accounts that were targeted',
          status: 'pending',
          order: 3,
        },
      ],
      timeline: [
        {
          id: 'tl1',
          timestamp: new Date(Date.now() - 3600000),
          action: 'Incident Created',
          description: 'Incident automatically created by security system',
          performedBy: 'system',
        },
        {
          id: 'tl2',
          timestamp: new Date(Date.now() - 1800000),
          action: 'Task Completed',
          description: 'Source IPs identified',
          performedBy: 'analyst1@claudeflare.com',
        },
      ],
      affectedAssets: ['prod-db-01', 'prod-db-02'],
      indicators: [],
      impact: {
        usersAffected: 0,
        systemsAffected: ['prod-db-01', 'prod-db-02'],
        dataExposed: false,
      },
    },
    {
      id: '2',
      title: 'Malware Detected on Employee Workstation',
      description: 'Endpoint protection detected suspicious activity on workstation WS-0234.',
      severity: 'critical',
      status: 'contained',
      priority: 1,
      assignedTo: 'security@claudeflare.com',
      createdBy: 'system',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
      resolvedAt: new Date(Date.now() - 3600000),
      tags: ['malware', 'endpoint', 'employee'],
      tasks: [
        {
          id: 't4',
          title: 'Isolate affected workstation',
          description: 'Disconnect from network to prevent spread',
          status: 'completed',
          completedAt: new Date(Date.now() - 82800000),
          order: 1,
        },
        {
          id: 't5',
          title: 'Scan for malware',
          description: 'Run full system scan',
          status: 'completed',
          completedAt: new Date(Date.now() - 72000000),
          order: 2,
        },
      ],
      timeline: [],
      affectedAssets: ['WS-0234'],
      indicators: [],
      resolution: 'Malware removed, system restored from clean backup',
      impact: {
        usersAffected: 1,
        systemsAffected: ['WS-0234'],
        dataExposed: false,
      },
    },
  ];
}

function generateMockPlaybooks(): ResponsePlaybook[] {
  return [
    {
      id: 'pb-1',
      name: 'Malware Response Playbook',
      description: 'Step-by-step guide for responding to malware incidents',
      category: 'Malware',
      steps: [
        {
          order: 1,
          title: 'Isolate Affected Systems',
          description: 'Immediately disconnect infected systems from the network',
          automated: true,
          estimatedTime: 5,
        },
        {
          order: 2,
          title: 'Identify Malware Type',
          description: 'Run analysis to determine malware family and capabilities',
          automated: false,
          estimatedTime: 30,
          dependencies: [1],
        },
        {
          order: 3,
          title: 'Contain and Eradicate',
          description: 'Remove malware and clean affected systems',
          automated: false,
          estimatedTime: 120,
          dependencies: [2],
        },
      ],
      estimatedDuration: 155,
      lastUpdated: new Date(),
      version: '2.1',
    },
    {
      id: 'pb-2',
      name: 'Data Breach Response Playbook',
      description: 'Procedures for responding to suspected data breaches',
      category: 'Data Breach',
      steps: [
        {
          order: 1,
          title: 'Activate Incident Response Team',
          description: 'Notify all stakeholders and initiate response protocols',
          automated: true,
          estimatedTime: 15,
        },
        {
          order: 2,
          title: 'Assess Scope',
          description: 'Determine what data was accessed and exfiltrated',
          automated: false,
          estimatedTime: 240,
        },
      ],
      estimatedDuration: 255,
      lastUpdated: new Date(),
      version: '1.8',
    },
  ];
}
