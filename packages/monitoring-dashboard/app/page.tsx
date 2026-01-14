'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Bell, AlertTriangle, Lightbulb, Radar, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardBuilder } from '@/builder/DashboardBuilder';
import { AlertList } from '@/alerts/AlertList';
import { AlertDetails } from '@/alerts/AlertDetails';
import { IncidentTimeline } from '@/timeline/IncidentTimeline';
import { PerformanceInsights } from '@/insights/PerformanceInsights';
import { AnomalyDetection } from '@/anomaly/AnomalyDetection';
import { Dashboard, Alert, Incident, Insight, Anomaly } from '@/types';

// Mock data for demonstration
const mockDashboard: Dashboard = {
  id: 'dashboard-1',
  name: 'System Overview',
  description: 'High-level system metrics and status',
  widgets: [],
  layout: {
    type: 'grid',
    columns: 4,
    rowHeight: 100,
    margin: [16, 16],
  },
  settings: {
    autoRefresh: true,
    refreshInterval: 30,
    timezone: 'UTC',
    theme: 'dark',
    compactMode: false,
    showBorders: true,
    enableAnimations: true,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'system',
};

const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    name: 'High CPU Usage',
    description: 'CPU usage has exceeded 90% for the last 5 minutes',
    severity: 'critical',
    status: 'open',
    type: 'threshold',
    condition: {
      type: 'threshold',
      threshold: {
        metric: 'cpu_usage',
        operator: 'gt',
        value: 90,
      },
      for: '5m',
      evalFrequency: '1m',
    },
    labels: {
      host: 'server-1',
      region: 'us-east-1',
    },
    triggeredCount: 15,
    lastTriggered: new Date(Date.now() - 2 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: 'alert-2',
    name: 'Memory Pressure',
    description: 'Memory usage is approaching critical levels',
    severity: 'high',
    status: 'acknowledged',
    type: 'threshold',
    condition: {
      type: 'threshold',
      threshold: {
        metric: 'memory_usage',
        operator: 'gt',
        value: 85,
      },
      for: '10m',
    },
    labels: {
      service: 'api-server',
    },
    acknowledgedBy: 'john.doe',
    acknowledgedAt: new Date(Date.now() - 15 * 60 * 1000),
    triggeredCount: 8,
    lastTriggered: new Date(Date.now() - 20 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
  },
];

const mockIncidents: Incident[] = [
  {
    id: 'incident-1',
    title: 'Database Performance Degradation',
    description: 'Experiencing slow query performance and increased latency',
    status: 'investigating',
    impact: 'high',
    severity: 'high',
    affectedServices: ['database', 'api', 'web'],
    startTime: new Date(Date.now() - 45 * 60 * 1000),
    timeline: [
      {
        id: 'timeline-1',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        type: 'detection',
        description: 'Alert triggered for high database latency',
        createdBy: 'system',
      },
      {
        id: 'timeline-2',
        timestamp: new Date(Date.now() - 40 * 60 * 1000),
        type: 'status-change',
        description: 'Incident created and team notified',
        createdBy: 'john.doe',
      },
      {
        id: 'timeline-3',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        type: 'action',
        description: 'Started investigating slow query logs',
        createdBy: 'jane.smith',
      },
    ],
    relatedAlerts: ['alert-3', 'alert-4'],
    assignees: ['john.doe', 'jane.smith'],
    updates: [
      {
        id: 'update-1',
        timestamp: new Date(Date.now() - 35 * 60 * 1000),
        message: 'Team is investigating the root cause. Initial analysis suggests connection pool exhaustion.',
        visibility: 'public',
        createdBy: 'john.doe',
      },
    ],
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
    createdBy: 'system',
  },
];

const mockInsights: Insight[] = [
  {
    id: 'insight-1',
    type: 'bottleneck',
    severity: 'high',
    title: 'Database Query Bottleneck',
    description: 'Identified slow queries causing increased response times',
    category: 'performance',
    details: {
      currentValue: 2500,
      previousValue: 800,
      changePercentage: 212.5,
      trend: 'increasing',
      impact: 'Affecting 15% of user requests',
      affectedResources: ['database-primary', 'api-server-1'],
    },
    metrics: [
      {
        name: 'query_duration',
        value: 2500,
        timestamp: new Date(),
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        priority: 'high',
        title: 'Add database indexes',
        description: 'Add composite indexes on frequently queried columns',
        actionItems: [
          'Analyze slow query log',
          'Identify missing indexes',
          'Create indexes in staging environment',
          'Test and deploy to production',
        ],
        estimatedImpact: '60-80% reduction in query time',
        effort: 'medium',
        status: 'pending',
      },
    ],
    confidence: 0.85,
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    labels: {
      service: 'database',
    },
  },
  {
    id: 'insight-2',
    type: 'optimization',
    severity: 'medium',
    title: 'Cache Optimization Opportunity',
    description: 'Increasing cache size could reduce database load by 40%',
    category: 'performance',
    details: {
      currentValue: 512,
      baselineValue: 1024,
      trend: 'stable',
      impact: 'Potential 40% reduction in database queries',
    },
    metrics: [
      {
        name: 'cache_hit_ratio',
        value: 0.75,
        timestamp: new Date(),
      },
    ],
    recommendations: [
      {
        id: 'rec-2',
        priority: 'medium',
        title: 'Increase cache size',
        description: 'Double the Redis cache memory allocation',
        actionItems: [
          'Review current cache usage patterns',
          'Calculate optimal cache size',
          'Update infrastructure configuration',
          'Monitor cache performance after change',
        ],
        estimatedImpact: '40% reduction in database load',
        effort: 'low',
        status: 'pending',
      },
    ],
    confidence: 0.72,
    createdAt: new Date(Date.now() - 25 * 60 * 1000),
  },
];

const mockAnomalies: Anomaly[] = [
  {
    id: 'anomaly-1',
    type: 'spike',
    severity: 'critical',
    status: 'active',
    metric: 'api_latency',
    detectedAt: new Date(Date.now() - 5 * 60 * 1000),
    value: 5000,
    expectedValue: 200,
    deviation: 4800,
    deviationPercentage: 2400,
    confidence: 0.95,
    description: 'Unusual spike in API latency detected',
    patterns: [
      {
        type: 'irregular',
        description: 'Sudden spike without any seasonal pattern',
        strength: 0.95,
      },
    ],
    labels: {
      endpoint: '/api/v1/users',
      method: 'GET',
    },
  },
  {
    id: 'anomaly-2',
    type: 'drop',
    severity: 'high',
    status: 'investigating',
    metric: 'request_rate',
    detectedAt: new Date(Date.now() - 15 * 60 * 1000),
    value: 100,
    expectedValue: 5000,
    deviation: -4900,
    deviationPercentage: -98,
    confidence: 0.88,
    description: 'Significant drop in request rate detected',
    duration: '15m',
    patterns: [
      {
        type: 'trend',
        description: 'Gradual decline over the last hour',
        strength: 0.75,
        period: '1h',
      },
    ],
    rootCauseAnalysis: {
      potentialCauses: [
        {
          cause: 'Network connectivity issue',
          probability: 0.7,
          evidence: [
            'Increased network errors',
            'Failed health checks from load balancer',
          ],
          relatedMetrics: ['network_errors', 'health_check_failures'],
        },
        {
          cause: 'DDoS attack',
          probability: 0.3,
          evidence: [
            'Unusual traffic patterns',
          ],
        },
      ],
      correlations: [],
      contributingFactors: [],
      confidence: 0.7,
    },
    investigationSteps: [
      {
        id: 'step-1',
        step: 1,
        action: 'Check network connectivity',
        description: 'Verify network routes and firewall rules',
        status: 'completed',
        result: 'No issues found with network configuration',
        completedBy: 'john.doe',
        completedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'step-2',
        step: 2,
        action: 'Review load balancer logs',
        description: 'Check for health check failures',
        status: 'in-progress',
      },
    ],
    labels: {
      service: 'api-gateway',
    },
  },
];

export default function MonitoringDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard>(mockDashboard);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [insights, setInsights] = useState<Insight[]>(mockInsights);
  const [anomalies, setAnomalies] = useState<Anomaly[]>(mockAnomalies);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const handleSaveDashboard = (updatedDashboard: Dashboard) => {
    setDashboard(updatedDashboard);
    // In real implementation, save to backend
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status: 'acknowledged' as const,
              acknowledgedAt: new Date(),
              acknowledgedBy: 'current-user',
              updatedAt: new Date(),
            }
          : alert
      )
    );
  };

  const handleResolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status: 'resolved' as const,
              resolvedAt: new Date(),
              resolvedBy: 'current-user',
              updatedAt: new Date(),
            }
          : alert
      )
    );
  };

  const handleSilenceAlert = (alertId: string, duration?: string) => {
    const silencedUntil = duration
      ? new Date(Date.now() + parseDuration(duration))
      : undefined;

    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              silenced: true,
              silencedUntil,
              updatedAt: new Date(),
            }
          : alert
      )
    );
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  const handleUpdateIncident = (incidentId: string, updates: Partial<Incident>) => {
    setIncidents((prev) =>
      prev.map((incident) =>
        incident.id === incidentId
          ? { ...incident, ...updates, updatedAt: new Date() }
          : incident
      )
    );
  };

  const handleDismissInsight = (insightId: string) => {
    setInsights((prev) =>
      prev.map((insight) =>
        insight.id === insightId
          ? { ...insight, dismissed: true }
          : insight
      )
    );
  };

  const handleInvestigateAnomaly = (anomalyId: string) => {
    setAnomalies((prev) =>
      prev.map((anomaly) =>
        anomaly.id === anomalyId
          ? { ...anomaly, status: 'investigating' as const }
          : anomaly
      )
    );
  };

  const handleResolveAnomaly = (anomalyId: string) => {
    setAnomalies((prev) =>
      prev.map((anomaly) =>
        anomaly.id === anomalyId
          ? { ...anomaly, status: 'resolved' as const }
          : anomaly
      )
    );
  };

  function parseDuration(duration: string): number {
    const match = duration.match(/(\d+)([smhd])/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">ClaudeFlare Monitoring</h1>
              <p className="text-sm text-muted-foreground">Real-time monitoring and alerting dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Tabs defaultValue="dashboard" className="h-full flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-12">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                <Bell className="h-4 w-4" />
                Alerts
                {alerts.filter(a => a.status === 'open').length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                    {alerts.filter(a => a.status === 'open').length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="incidents" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incidents
                {incidents.filter(i => !i.endTime).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-orange-500 text-white">
                    {incidents.filter(i => !i.endTime).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="anomalies" className="gap-2">
                <Radar className="h-4 w-4" />
                Anomalies
                {anomalies.filter(a => a.status === 'active').length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                    {anomalies.filter(a => a.status === 'active').length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="dashboard" className="h-full m-0 p-0">
              <DashboardBuilder
                dashboard={dashboard}
                onSave={handleSaveDashboard}
              />
            </TabsContent>

            <TabsContent value="alerts" className="h-full m-0 p-0">
              {selectedAlert ? (
                <div className="h-full">
                  <Button
                    variant="ghost"
                    className="m-4"
                    onClick={() => setSelectedAlert(null)}
                  >
                    ← Back to alerts
                  </Button>
                  <AlertDetails
                    alert={selectedAlert}
                    onAcknowledge={handleAcknowledgeAlert}
                    onResolve={handleResolveAlert}
                    onSilence={handleSilenceAlert}
                  />
                </div>
              ) : (
                <AlertList
                  alerts={alerts}
                  onAcknowledge={handleAcknowledgeAlert}
                  onResolve={handleResolveAlert}
                  onSilence={handleSilenceAlert}
                  onDelete={handleDeleteAlert}
                  onSelectAlert={setSelectedAlert}
                />
              )}
            </TabsContent>

            <TabsContent value="incidents" className="h-full m-0 p-0">
              <IncidentTimeline
                incidents={incidents}
                onUpdateIncident={handleUpdateIncident}
              />
            </TabsContent>

            <TabsContent value="insights" className="h-full m-0 p-0">
              <PerformanceInsights
                insights={insights}
                onDismiss={handleDismissInsight}
              />
            </TabsContent>

            <TabsContent value="anomalies" className="h-full m-0 p-0">
              <AnomalyDetection
                anomalies={anomalies}
                onInvestigate={handleInvestigateAnomaly}
                onResolve={handleResolveAnomaly}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
