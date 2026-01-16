/**
 * Pull Request Card Component
 *
 * Mobile-optimized PR card for code review.
 */

// @ts-nocheck - External React/Next.js dependencies
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GitPullRequest, GitBranch, User, MessageSquare, Check, X } from 'lucide-react';

export interface PullRequestCardProps {
  id: string;
  number: number;
  title: string;
  author: string;
  status: 'open' | 'closed' | 'merged' | 'draft';
  branch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  comments: number;
  createdAt: Date | string;
  onPress?: () => void;
  onReview?: (decision: 'approve' | 'request_changes' | 'comment') => void;
}

export function PullRequestCard({
  number,
  title,
  author,
  status,
  branch,
  baseBranch,
  additions,
  deletions,
  comments,
  createdAt,
  onPress,
  onReview,
}: PullRequestCardProps) {
  const statusConfig = {
    open: { color: 'success' as const, label: 'Open' },
    closed: { color: 'default' as const, label: 'Closed' },
    merged: { color: 'primary' as const, label: 'Merged' },
    draft: { color: 'default' as const, label: 'Draft' },
  };

  const config = statusConfig[status];

  return (
    <Card interactive={!!onPress} onClick={onPress} className="mb-3">
      <CardContent>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GitPullRequest className={cn(
                'w-4 h-4',
                status === 'open' && 'text-success-600',
                status === 'merged' && 'text-primary-600',
                status === 'closed' && 'text-gray-600'
              )} />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                #{number}
              </span>
              <Badge size="sm" variant={config.color === 'success' ? 'success' : config.color === 'primary' ? 'primary' : 'default'}>
                {config.label}
              </Badge>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span>{author}</span>
          </div>
          <span>·</span>
          <span>{formatRelativeTime(createdAt)}</span>
        </div>

        <div className="flex items-center gap-2 text-xs mb-3">
          <GitBranch className="w-3.5 h-3.5 text-gray-500" />
          <span className="px-2 py-0.5 bg-gray-100 rounded dark:bg-gray-800">
            {branch}
          </span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded dark:bg-gray-800">
            {baseBranch}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-success-600 dark:text-success-400">
            <span className="font-medium">+{additions}</span>
            <span>additions</span>
          </div>
          <div className="flex items-center gap-1 text-error-600 dark:text-error-400">
            <span className="font-medium">-{deletions}</span>
            <span>deletions</span>
          </div>
          {comments > 0 && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{comments}</span>
            </div>
          )}
        </div>
      </CardContent>

      {onReview && status === 'open' && (
        <CardFooter className="gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onReview('comment');
            }}
            className="flex-1"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="ml-1">Comment</span>
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              onReview('request_changes');
            }}
            className="flex-1"
          >
            <X className="w-4 h-4" />
            <span className="ml-1">Changes</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onReview('approve');
            }}
            className="flex-1"
          >
            <Check className="w-4 h-4" />
            <span className="ml-1">Approve</span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Pull request list
 */
export interface PullRequestListProps {
  pullRequests: PullRequestCardProps[];
  isLoading?: boolean;
  onRefresh?: () => void;
  emptyMessage?: string;
}

export function PullRequestList({
  pullRequests,
  isLoading,
  onRefresh,
  emptyMessage = 'No pull requests found'
}: PullRequestListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-gray-100 rounded-xl animate-pulse dark:bg-gray-800">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 dark:bg-gray-700" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 dark:bg-gray-700" />
            <div className="h-4 bg-gray-200 rounded w-1/3 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (pullRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <GitPullRequest className="w-12 h-12 text-gray-400 mb-3" />
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
      {pullRequests.map((pr) => (
        <PullRequestCard key={pr.id} {...pr} />
      ))}
    </div>
  );
}
