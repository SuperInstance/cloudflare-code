'use client';

// @ts-nocheck
import React, { useMemo } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Clock, HelpCircle } from 'lucide-react';
import { BaseWidget, StatusConfig } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface StatusIndicatorWidgetProps {
  widget: BaseWidget & { config: StatusConfig };
  status: StatusConfig['status'];
  message?: string;
  lastChecked?: Date;
  onClick?: () => void;
  height?: number;
  loading?: boolean;
  error?: string;
}

export const StatusIndicatorWidget: React.FC<StatusIndicatorWidgetProps> = ({
  widget,
  status,
  message,
  lastChecked,
  onClick,
  height = 200,
  loading = false,
  error,
}) => {
  const { config, title } = widget;

  const { icon, color, label, pulse } = useMemo(() => {
    switch (status) {
      case 'operational':
        return {
          icon: CheckCircle2,
          color: 'hsl(142, 76%, 36%)',
          label: 'Operational',
          pulse: false,
        };
      case 'degraded':
        return {
          icon: AlertCircle,
          color: 'hsl(38, 92%, 50%)',
          label: 'Degraded',
          pulse: true,
        };
      case 'down':
        return {
          icon: XCircle,
          color: 'hsl(0, 84%, 60%)',
          label: 'Down',
          pulse: true,
        };
      case 'maintenance':
        return {
          icon: Clock,
          color: 'hsl(221, 83%, 53%)',
          label: 'Maintenance',
          pulse: false,
        };
      default:
        return {
          icon: HelpCircle,
          color: 'hsl(0, 0%, 60%)',
          label: 'Unknown',
          pulse: false,
        };
    }
  }, [status]);

  const StatusIcon = icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
          <div className="h-20 bg-muted rounded-full w-20 mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive" style={{ height }}>
        <div className="text-center">
          <XCircle className="h-12 w-12 mx-auto mb-2" />
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col items-center justify-center p-6',
        onClick && 'cursor-pointer hover:bg-muted/50 transition-colors rounded-lg'
      )}
      onClick={onClick}
    >
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      )}

      <div className={cn('relative', pulse && 'animate-pulse-glow')}>
        <StatusIcon
          className="h-20 w-20"
          style={{ color }}
          strokeWidth={2}
        />
      </div>

      <div className="mt-4 text-center">
        <p className="text-lg font-semibold" style={{ color }}>
          {label}
        </p>
        {message && (
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        )}
        {lastChecked && (
          <p className="text-xs text-muted-foreground mt-2">
            Last checked: {format(new Date(lastChecked), 'PPp')}
          </p>
        )}
      </div>

      {config.history && config.history.length > 0 && (
        <div className="mt-4 w-full max-w-xs">
          <p className="text-xs font-medium text-muted-foreground mb-2">History</p>
          <div className="space-y-1">
            {config.history.slice(0, 5).map((point, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {format(new Date(point.timestamp), 'PPp')}
                </span>
                <span
                  className={cn(
                    'font-medium',
                    point.status === 'operational' && 'text-green-600',
                    point.status === 'degraded' && 'text-yellow-600',
                    point.status === 'down' && 'text-red-600'
                  )}
                >
                  {point.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusIndicatorWidget;
