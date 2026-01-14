/**
 * Loading Components
 *
 * Various loading states for mobile UI.
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <svg
        className={cn('animate-spin text-primary-600', sizeClasses[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div className={cn('flex items-center justify-center space-x-2', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"
          style={{
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export function LoadingSkeleton({ className, count = 1 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800',
            className
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

export interface LoadingCardProps {
  className?: string;
}

export function LoadingCard({ className }: LoadingCardProps) {
  return (
    <div className={cn('p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800', className)}>
      <LoadingSkeleton count={3} className="mb-4" />
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-200 rounded animate-pulse dark:bg-gray-800" />
        <div className="h-8 flex-1 bg-gray-200 rounded animate-pulse dark:bg-gray-800" />
      </div>
    </div>
  );
}

export interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = 'Loading...' }: FullPageLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-gray-900">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}

export interface PullToRefreshProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

export function PullToRefresh({ isRefreshing, onRefresh, children }: PullToRefreshProps) {
  const [touchStart, setTouchStart] = React.useState(0);
  const [touchCurrent, setTouchCurrent] = React.useState(0);
  const [pulling, setPulling] = React.useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart && window.scrollY === 0) {
      const current = e.touches[0].clientY;
      const diff = current - touchStart;

      if (diff > 0) {
        setTouchCurrent(current);
        setPulling(true);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pulling) {
      const diff = touchCurrent - touchStart;
      if (diff > 100 && !isRefreshing) {
        onRefresh();
      }
      setTouchStart(0);
      setTouchCurrent(0);
      setPulling(false);
    }
  };

  const pullDistance = Math.min((touchCurrent - touchStart) / 3, 80);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-screen"
    >
      {pulling && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 transition-transform"
          style={{ transform: `translateY(${pullDistance - 80}px)` }}
        >
          <LoadingSpinner size="sm" />
        </div>
      )}
      {children}
    </div>
  );
}
