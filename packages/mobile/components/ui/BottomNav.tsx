/**
 * Bottom Navigation Component
 *
 * Mobile-optimized bottom navigation bar with haptic feedback.
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { cva, type VariantProps } from 'class-variance-authority';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
}

const bottomNavVariants = cva(
  'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800 z-40 safe-bottom',
  {
    variants: {
      variant: {
        default: 'shadow-lg',
        elevated: 'shadow-2xl',
        flat: 'shadow-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BottomNavProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof bottomNavVariants> {
  items: NavItem[];
}

export function BottomNav({ items, variant, className }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handlePress = (item: NavItem) => {
    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    router.push(item.href);
  };

  return (
    <nav className={cn(bottomNavVariants({ variant }), className)}>
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <button
              key={item.id}
              onClick={() => handlePress(item)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 transition-all duration-200',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <div className={cn(
                  'transition-transform duration-200',
                  isActive ? 'scale-110' : 'scale-100'
                )}>
                  {item.icon}
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-[10px] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                'mt-1 text-xs font-medium truncate px-1',
                isActive ? 'font-semibold' : 'font-normal'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area padding for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

/**
 * Top Navigation Bar (Alternative to bottom nav)
 */
export function TopNav({
  title,
  onBack,
  actions,
  className,
}: {
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 z-40 flex items-center px-4 safe-top',
      className
    )}>
      <div className="flex items-center flex-1">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
