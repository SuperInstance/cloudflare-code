// @ts-nocheck
/**
 * Project detail page
 */

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Share, Trash2, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { useDashboardStore } from '@/lib/store';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import type { Project } from '@/types';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentProject, setCurrentProject } = useDashboardStore();
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (params.id) {
      loadProject(params.id as string);
    }
  }, [params.id]);

  const loadProject = async (id: string) => {
    try {
      setLoading(true);
      const response = await apiClient.getProject(id);
      if (response.success) {
        setProject(response.data);
        setCurrentProject(response.data);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await apiClient.deleteProject(project.id);
      router.push('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading project...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Project not found</p>
            <Button onClick={() => router.push('/projects')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={project.name}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Share className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" />
            Members
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Basic details about your project</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                <dd className="mt-1">{project.description || 'No description'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="mt-1">{formatDate(project.createdAt, 'long')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                <dd className="mt-1">{formatDate(project.updatedAt, 'long')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Members</dt>
                <dd className="mt-1">{project.members.length}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Project Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(project.stats.totalRequests)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(project.stats.totalCost)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(project.stats.totalTokens)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Button
                variant="outline"
                className="h-auto flex-col space-y-2 p-4"
                onClick={() => router.push('/code')}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">C</span>
                </div>
                <span className="font-medium">Open Code Editor</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col space-y-2 p-4"
                onClick={() => router.push('/chat')}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">C</span>
                </div>
                <span className="font-medium">Start Chat</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col space-y-2 p-4"
                onClick={() => router.push('/analytics')}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">A</span>
                </div>
                <span className="font-medium">View Analytics</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Project Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Default Settings</CardTitle>
            <CardDescription>Default configuration for AI interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Provider</dt>
                <dd className="mt-1 capitalize">{project.settings.defaultProvider}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Model</dt>
                <dd className="mt-1">{project.settings.defaultModel}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Max Tokens</dt>
                <dd className="mt-1">{formatNumber(project.settings.maxTokens)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Temperature</dt>
                <dd className="mt-1">{project.settings.temperature}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
