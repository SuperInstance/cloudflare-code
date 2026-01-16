/**
 * Project Card Component
 *
 * Mobile-optimized project card with quick actions.
 */

// @ts-nocheck - External React/Next.js dependencies
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Folder, GitPullRequest, AlertCircle, TrendingUp } from 'lucide-react';

export interface ProjectCardProps {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'error';
  language: string;
  lastModified: Date | string;
  pullRequests?: number;
  issues?: number;
  stars?: number;
  onPress?: () => void;
  actions?: Array<{
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
  }>;
}

export function ProjectCard({
  name,
  description,
  status,
  language,
  lastModified,
  pullRequests,
  issues,
  stars,
  onPress,
  actions,
}: ProjectCardProps) {
  const statusColors = {
    active: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    error: 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-300',
  };

  return (
    <Card interactive={!!onPress} onClick={onPress} className="mb-3">
      <CardContent>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Folder className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {name}
            </h3>
          </div>
          <Badge size="sm" variant={status === 'active' ? 'success' : status === 'error' ? 'danger' : 'default'}>
            {status}
          </Badge>
        </div>

        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="px-2 py-1 bg-gray-100 rounded dark:bg-gray-800">
            {language}
          </span>
          <span>Updated {formatRelativeTime(lastModified)}</span>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {pullRequests !== undefined && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <GitPullRequest className="w-4 h-4" />
              <span>{pullRequests}</span>
            </div>
          )}
          {issues !== undefined && issues > 0 && (
            <div className="flex items-center gap-1 text-error-600 dark:text-error-400">
              <AlertCircle className="w-4 h-4" />
              <span>{issues}</span>
            </div>
          )}
          {stars !== undefined && stars > 0 && (
            <div className="flex items-center gap-1 text-accent-600 dark:text-accent-400">
              <TrendingUp className="w-4 h-4" />
              <span>{stars}</span>
            </div>
          )}
        </div>
      </CardContent>

      {actions && actions.length > 0 && (
        <CardFooter className="gap-2">
          {actions.map((action, i) => (
            <Button
              key={i}
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                action.onPress();
              }}
              className="flex-1"
            >
              {action.icon}
              <span className="ml-1">{action.label}</span>
            </Button>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Project list component
 */
export interface ProjectListProps {
  projects: ProjectCardProps[];
  isLoading?: boolean;
  onRefresh?: () => void;
  emptyMessage?: string;
}

export function ProjectList({ projects, isLoading, onRefresh, emptyMessage = 'No projects found' }: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-gray-100 rounded-xl animate-pulse dark:bg-gray-800">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 dark:bg-gray-700" />
            <div className="h-4 bg-gray-200 rounded w-1/2 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Folder className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        {onRefresh && (
          <Button size="sm" variant="outline" onClick={onRefresh} className="mt-4">
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} {...project} />
      ))}
    </div>
  );
}
