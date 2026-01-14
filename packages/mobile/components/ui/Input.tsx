/**
 * Input Component
 *
 * Mobile-optimized input with validation states and icons.
 */

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  'flex w-full rounded-lg border px-4 py-3 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-300 bg-white focus-visible:ring-primary-600 focus-visible:border-primary-600 dark:border-gray-700 dark:bg-gray-900',
        filled: 'border-transparent bg-gray-100 focus-visible:ring-primary-600 focus-visible:bg-white dark:bg-gray-800 dark:focus-visible:bg-gray-900',
        underline: 'rounded-none border-x-0 border-t-0 border-b-2 border-gray-300 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary-600 dark:border-gray-700',
      },
      size: {
        sm: 'h-9 text-sm',
        md: 'h-11 text-base',
        lg: 'h-12 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightAction?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      label,
      error,
      leftIcon,
      rightIcon,
      rightAction,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            className={cn(
              inputVariants({ variant, size }),
              error && 'border-error-500 focus-visible:ring-error-500 focus-visible:border-error-500',
              leftIcon && 'pl-10',
              (rightIcon || rightAction) && 'pr-10',
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />
          {(rightIcon || rightAction) && (
            <button
              type="button"
              onClick={rightAction}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              tabIndex={rightAction ? 0 : -1}
            >
              {rightIcon}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-error-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
