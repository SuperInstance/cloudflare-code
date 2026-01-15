/**
 * Card component
 */

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({
  children,
  className = '',
  variant = 'default',
}: CardProps) {
  const variantClasses = {
    default: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-md border border-gray-100',
    outlined: 'bg-white border-2 border-gray-300',
  };

  const classes = [
    'rounded-lg',
    'transition-colors',
    variantClasses[variant],
    className,
  ].join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}