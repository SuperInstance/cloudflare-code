/**
 * Badge Component
 *
 * Small status indicators and labels.
 */

// @ts-nocheck - External React/Next.js dependencies
import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300',
        success: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300',
        warning: 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-300',
        danger: 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-300',
        outline: 'border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
        lg: 'px-3 py-1 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
