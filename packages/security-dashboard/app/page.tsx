'use client';

import React, { useState } from 'react';
import { MetricGrid } from '../components/MetricCard';
import { ThreatMap } from '../components/ThreatMap';
import { IncidentList } from '../components/IncidentList';
import { VulnerabilityDashboard } from '../components/VulnerabilityDashboard';
import { ComplianceDashboard } from '../components/ComplianceDashboard';
import { SecurityReports } from '../components/SecurityReports';
import { IncidentDetail } from '../components/IncidentDetail';
import {
  SecurityMetricsChart,
  MetricDistribution,
  MetricComparison,
  AnomalyDetection,
} from '../metrics/SecurityMetricsChart';
import { useSecurityMetrics } from '../hooks/useSecurityMetrics';
import { useThreatIntelligence } from '../hooks/useThreatIntelligence';
import { useIncidents } from '../hooks/useIncidents';
import { useVulnerabilities } from '../hooks/useVulnerabilities';
import { useCompliance } from '../hooks/useCompliance';
import { Incident } from '../types';
import {
  LayoutDashboard,
  Shield,
  AlertTriangle,
  Bug,
  FileCheck,
  FileText,
  Settings,
  Bell,
  User,
  Search,
  Menu,
  X,
} from 'lucide-react';

type TabType = 'overview' | 'threats' | 'incidents' | 'vulnerabilities' | 'compliance' | 'reports';

export default function SecurityDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { metrics, loading: metricsLoading } = useSecurityMetrics(30000);
  const { mapData, campaigns } = useThreatIntelligence();
  const { incidents, loading: incidentsLoading } = useIncidents();
  const { vulnerabilities, scans, trend } = useVulnerabilities();
  const { frameworks, policies } = useCompliance();

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard },
    { id: 'threats' as TabType, label: 'Threat Intelligence', icon: Shield },
    { id: 'incidents' as TabType, label: 'Incidents', icon: AlertTriangle },
    { id: 'vulnerabilities' as TabType, label: 'Vulnerabilities', icon: Bug },
    { id: 'compliance' as TabType, label: 'Compliance', icon: FileCheck },
    { id: 'reports' as TabType, label: 'Reports', icon: FileText },
  ];

  if (selectedIncident) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">ClaudeFlare Security</h1>
                <p className="text-sm text-gray-600">Incident Response</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="rounded-full p-2 hover:bg-gray-100">
                <Bell className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  A
                </div>
                <span className="text-sm font-medium text-gray-700">Admin</span>
              </div>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-6 py-8">
          <IncidentDetail
            incident={selectedIncident}
            playbooks={[]}
            onBack={() => setSelectedIncident(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-md p-2 hover:bg-gray-100 lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">ClaudeFlare Security Dashboard</h1>
              <p className="text-sm text-gray-600">
                Advanced security operations and monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-64 rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm"
              />
            </div>

            <button className="rounded-full p-2 hover:bg-gray-100 relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>

            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                A
              </div>
              <span className="hidden text-sm font-medium text-gray-700 lg:block">
                Admin
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'w-64' : 'w-0'} border-r border-gray-200 bg-white transition-all duration-300 overflow-hidden lg:w-64`}
        >
          <nav className="space-y-1 p-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              <Settings className="h-5 w-5" />
              Settings
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Real-time Metrics */}
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Real-time Security Metrics
                  </h2>
                  {metricsLoading ? (
                    <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white">
                      <div className="text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                        <p className="mt-2 text-sm text-gray-600">Loading metrics...</p>
                      </div>
                    </div>
                  ) : metrics ? (
                    <MetricGrid metrics={metrics.realTime} />
                  ) : null}
                </section>

                {/* Metrics Chart */}
                {metrics && (
                  <section className="rounded-lg border border-gray-200 bg-white p-6">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">
                      Security Trends (24 Hours)
                    </h2>
                    <SecurityMetricsChart data={metrics} type="area" />
                  </section>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Metric Distribution */}
                  {metrics && (
                    <section className="rounded-lg border border-gray-200 bg-white p-6">
                      <h2 className="mb-4 text-lg font-semibold text-gray-900">
                        Metric Distribution
                      </h2>
                      <MetricDistribution data={metrics} />
                    </section>
                  )}

                  {/* Anomaly Detection */}
                  {metrics && (
                    <section className="rounded-lg border border-gray-200 bg-white p-6">
                      <h2 className="mb-4 text-lg font-semibold text-gray-900">
                        Anomaly Detection
                      </h2>
                      <AnomalyDetection data={metrics} />
                    </section>
                  )}
                </div>

                {/* Threat Map */}
                <section className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Global Threat Map
                  </h2>
                  <div className="h-[400px]">
                    <ThreatMap data={mapData} />
                  </div>
                </section>

                {/* Active Incidents */}
                <section className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Active Incidents
                    </h2>
                    <button
                      onClick={() => setActiveTab('incidents')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View All
                    </button>
                  </div>
                  <IncidentList
                    incidents={incidents.filter((i) => i.status !== 'resolved')}
                    onIncidentClick={setSelectedIncident}
                  />
                </section>

                {/* Vulnerability Summary */}
                <section className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Vulnerability Summary
                    </h2>
                    <button
                      onClick={() => setActiveTab('vulnerabilities')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View All
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-5">
                    {[
                      { label: 'Critical', count: vulnerabilities.filter((v) => v.severity === 'critical').length, color: 'red' },
                      { label: 'High', count: vulnerabilities.filter((v) => v.severity === 'high').length, color: 'orange' },
                      { label: 'Medium', count: vulnerabilities.filter((v) => v.severity === 'medium').length, color: 'yellow' },
                      { label: 'Low', count: vulnerabilities.filter((v) => v.severity === 'low').length, color: 'blue' },
                      { label: 'Resolved', count: vulnerabilities.filter((v) => v.status === 'resolved').length, color: 'green' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-lg border border-${item.color}-200 bg-${item.color}-50 p-4 text-center`}
                      >
                        <div className={`text-2xl font-bold text-${item.color}-700`}>
                          {item.count}
                        </div>
                        <div className={`text-sm font-medium text-${item.color}-600`}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Compliance Overview */}
                <section className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Compliance Status
                    </h2>
                    <button
                      onClick={() => setActiveTab('compliance')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View All
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {frameworks.slice(0, 5).map((framework) => (
                      <div
                        key={framework.id}
                        className={`rounded-lg border p-4 ${
                          framework.status === 'compliant'
                            ? 'border-green-200 bg-green-50'
                            : framework.status === 'non-compliant'
                            ? 'border-red-200 bg-red-50'
                            : 'border-yellow-200 bg-yellow-50'
                        }`}
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          {framework.name}
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Score</span>
                            <span className="font-semibold">{framework.overallScore}%</span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                            <div
                              className={`h-2 rounded-full ${
                                framework.overallScore >= 90
                                  ? 'bg-green-500'
                                  : framework.overallScore >= 75
                                  ? 'bg-blue-500'
                                  : 'bg-yellow-500'
                              }`}
                              style={{ width: `${framework.overallScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'threats' && (
              <div className="space-y-6">
                <section className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Global Threat Map
                  </h2>
                  <div className="h-[500px]">
                    <ThreatMap data={mapData} />
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Active Attack Campaigns
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="rounded-lg border border-gray-200 p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {campaign.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {campaign.description}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              campaign.status === 'active'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Severity:</span>
                            <span className="font-semibold">{campaign.severity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Targets:</span>
                            <span className="font-semibold">{campaign.targets.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tactics:</span>
                            <span className="font-semibold">
                              {campaign.tactics.join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'incidents' && (
              <IncidentList
                incidents={incidents}
                onIncidentClick={setSelectedIncident}
              />
            )}

            {activeTab === 'vulnerabilities' && (
              <VulnerabilityDashboard
                vulnerabilities={vulnerabilities}
                scans={scans}
                trend={trend}
              />
            )}

            {activeTab === 'compliance' && (
              <ComplianceDashboard
                frameworks={frameworks}
                policies={policies}
              />
            )}

            {activeTab === 'reports' && (
              <SecurityReports
                reports={[]}
                metrics={metrics}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
