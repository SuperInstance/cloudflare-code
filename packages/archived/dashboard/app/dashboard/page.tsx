// @ts-nocheck
/**
 * Dashboard overview page
 */

'use client';

import * as React from 'react';
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { StatsGrid, StatsCard } from '@/components/dashboard/stats-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { useDashboardStore } from '@/lib/store';

export default function DashboardPage() {
  const { user } = useDashboardStore();
  const [stats, setStats] = React.useState({
    totalRequests: 0,
    totalCost: 0,
    totalTokens: 0,
    activeProjects: 0,
    averageLatency: 0,
    successRate: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [period, setPeriod] = React.useState<'24h' | '7d' | '30d' | '90d'>('7d');

  React.useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDashboardStats(period);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const recentProjects = [
    { id: '1', name: 'My Awesome Project', language: 'TypeScript', updatedAt: Date.now() },
    { id: '2', name: 'API Server', language: 'Python', updatedAt: Date.now() - 3600000 },
    { id: '3', name: 'Mobile App', language: 'React Native', updatedAt: Date.now() - 7200000 },
  ];

  const recentActivity = [
    { id: '1', type: 'completion', message: 'Generated 150 lines of code', time: '5 min ago' },
    { id: '2', type: 'chat', message: 'Chat session with Claude', time: '15 min ago' },
    { id: '3', type: 'deployment', message: 'Deployed to production', time: '1 hour ago' },
  ];

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
            <p className="text-muted-foreground">
              Welcome back, {user?.email || 'User'}
            </p>
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

        {/* Stats Grid */}
        <StatsGrid
          stats={[
            {
              title: 'Total Requests',
              value: stats.totalRequests,
              change: 12.5,
              changeType: 'increase',
              icon: <Activity className="h-4 w-4" />,
            },
            {
              title: 'Total Cost',
              value: stats.totalCost,
              change: -2.4,
              changeType: 'decrease',
              icon: <DollarSign className="h-4 w-4" />,
            },
            {
              title: 'Total Tokens',
              value: stats.totalTokens,
              change: 8.1,
              changeType: 'increase',
              icon: <Zap className="h-4 w-4" />,
            },
            {
              title: 'Active Projects',
              value: stats.activeProjects,
              change: 0,
              changeType: 'neutral',
              icon: <Users className="h-4 w-4" />,
            },
          ]}
        />

        {/* Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Projects */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Your most recently worked on projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.language}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Open <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>Current system metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg Latency</span>
                  <span className="font-medium">{stats.averageLatency}ms</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: '75%' }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium">{stats.successRate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-green-600"
                    style={{ width: `${stats.successRate}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">API Quota</span>
                  <span className="font-medium">68%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: '68%' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest actions on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center space-x-4 rounded-lg border p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.message}</p>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto flex-col space-y-2 p-6">
                <CreditCard className="h-6 w-6" />
                <span className="font-medium">New Project</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col space-y-2 p-6">
                <Zap className="h-6 w-6" />
                <span className="font-medium">Start Chat</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col space-y-2 p-6">
                <Activity className="h-6 w-6" />
                <span className="font-medium">View Analytics</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col space-y-2 p-6">
                <Users className="h-6 w-6" />
                <span className="font-medium">Manage Team</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
