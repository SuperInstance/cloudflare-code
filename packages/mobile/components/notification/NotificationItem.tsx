/**
 * Notification Item Component
 *
 * Mobile-optimized notification with swipe actions.
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Bell, MessageSquare, GitPullRequest, AlertCircle, CheckCircle, Info } from 'lucide-react';

export interface NotificationItemProps {
  id: string;
  type: 'message' | 'pull_request' | 'review' | 'alert' | 'info';
  title: string;
  description?: string;
  timestamp: Date | string;
  read: boolean;
  onPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function NotificationItem({
  type,
  title,
  description,
  timestamp,
  read,
  onPress,
}: NotificationItemProps) {
  const typeConfig = {
    message: { icon: MessageSquare, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-900' },
    pull_request: { icon: GitPullRequest, color: 'text-success-600 dark:text-success-400', bg: 'bg-success-100 dark:bg-success-900' },
    review: { icon: CheckCircle, color: 'text-accent-600 dark:text-accent-400', bg: 'bg-accent-100 dark:bg-accent-900' },
    alert: { icon: AlertCircle, color: 'text-error-600 dark:text-error-400', bg: 'bg-error-100 dark:bg-error-900' },
    info: { icon: Info, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onPress}
      className={cn(
        'w-full text-left transition-colors active:bg-gray-50 dark:active:bg-gray-800',
        !read && 'bg-primary-50/50 dark:bg-primary-900/20'
      )}
    >
      <div className="flex items-start gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
        {/* Icon */}
        <div className={cn('flex-shrink-0 p-2 rounded-lg', config.bg)}>
          <Icon className={cn('w-5 h-5', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              'text-sm font-medium text-gray-900 dark:text-gray-100',
              !read && 'font-semibold'
            )}>
              {title}
            </h4>
            {!read && (
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-600" />
            )}
          </div>

          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
              {description}
            </p>
          )}

          <span className="text-xs text-gray-500 dark:text-gray-500">
            {formatRelativeTime(timestamp)}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Notification list component
 */
export interface NotificationListProps {
  notifications: NotificationItemProps[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  emptyMessage?: string;
}

export function NotificationList({
  notifications,
  isLoading,
  onRefresh,
  onMarkAllRead,
  emptyMessage = 'No notifications'
}: NotificationListProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
            <div className="w-9 h-9 bg-gray-200 rounded-lg dark:bg-gray-800" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 dark:bg-gray-800" />
              <div className="h-3 bg-gray-200 rounded w-1/2 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Bell className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-4 text-sm text-primary-600 dark:text-primary-400"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header with unread count and mark all read */}
      {unreadCount > 0 && onMarkAllRead && (
        <div className="sticky top-0 z-10 px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-200 dark:bg-gray-900/95 dark:border-gray-800 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {unreadCount} unread
          </span>
          <button
            onClick={onMarkAllRead}
            className="text-sm text-primary-600 dark:text-primary-400 font-medium"
          >
            Mark all read
          </button>
        </div>
      )}

      {/* Notifications */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} {...notification} />
        ))}
      </div>
    </div>
  );
}

/**
 * Notification bell icon with badge
 */
export function NotificationBell({ count }: { count: number }) {
  return (
    <div className="relative">
      <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-error-500 text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </div>
  );
}
