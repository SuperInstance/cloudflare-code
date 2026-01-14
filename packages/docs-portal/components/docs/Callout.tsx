'use client';

import React from 'react';
import { Info, AlertTriangle, XCircle, CheckCircle, Lightbulb, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Callout as CalloutType } from '@/types';

// ============================================================================
// Callout Component
// ============================================================================

interface CalloutProps extends CalloutType {
  onClose?: () => void;
  className?: string;
}

const calloutConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
    iconColor: 'text-blue-500',
    title: 'Info',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
    iconColor: 'text-yellow-500',
    title: 'Warning',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/50',
    iconColor: 'text-red-500',
    title: 'Error',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
    iconColor: 'text-green-500',
    title: 'Success',
  },
  tip: {
    icon: Lightbulb,
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
    iconColor: 'text-purple-500',
    title: 'Tip',
  },
};

export function Callout({
  type,
  title,
  content,
  onClose,
  className,
}: CalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative my-4 p-4 rounded-lg border',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />

        {/* Content */}
        <div className="flex-1 space-y-1">
          {title && (
            <div className="font-semibold text-foreground">{title}</div>
          )}
          <div className="text-sm text-foreground/80">{content}</div>
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Callout Variants
// ============================================================================

export function InfoCallout({ content, className }: { content: string; className?: string }) {
  return <Callout type="info" content={content} className={className} />;
}

export function WarningCallout({ content, className }: { content: string; className?: string }) {
  return <Callout type="warning" content={content} className={className} />;
}

export function ErrorCallout({ content, className }: { content: string; className?: string }) {
  return <Callout type="error" content={content} className={className} />;
}

export function SuccessCallout({ content, className }: { content: string; className?: string }) {
  return <Callout type="success" content={content} className={className} />;
}

export function TipCallout({ content, className }: { content: string; className?: string }) {
  return <Callout type="tip" content={content} className={className} />;
}

// ============================================================================
// Dismissible Callout
// ============================================================================

interface DismissibleCalloutProps extends Omit<CalloutProps, 'onClose'> {
  storageKey?: string;
  autoHide?: number;
}

export function DismissibleCallout({
  storageKey,
  autoHide,
  ...props
}: DismissibleCalloutProps) {
  const [isVisible, setIsVisible] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    if (storageKey) {
      const dismissed = localStorage.getItem(`callout-${storageKey}`);
      return !dismissed;
    }
    return true;
  });

  React.useEffect(() => {
    if (autoHide && isVisible) {
      const timer = setTimeout(() => setIsVisible(false), autoHide);
      return () => clearTimeout(timer);
    }
  }, [autoHide, isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    if (storageKey) {
      localStorage.setItem(`callout-${storageKey}`, 'true');
    }
  };

  if (!isVisible) return null;

  return <Callout {...props} onClose={handleClose} />;
}

// ============================================================================
// Alert Banner
// ============================================================================

interface AlertBannerProps {
  type?: 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  }>;
  className?: string;
}

export function AlertBanner({
  type = 'info',
  title,
  message,
  actions,
  className,
}: AlertBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-lg border',
        calloutConfig[type].bgColor,
        calloutConfig[type].borderColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        {React.createElement(calloutConfig[type].icon, {
          className: cn('w-5 h-5 flex-shrink-0 mt-0.5', calloutConfig[type].iconColor),
        })}
        <div>
          <div className="font-semibold text-foreground">{title}</div>
          {message && (
            <div className="text-sm text-muted-foreground mt-1">{message}</div>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                action.variant === 'outline'
                  ? 'border border-border hover:bg-muted'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
