import React, { useState, useEffect } from 'react';
import { SecurityEvent } from '../types';
import { getSeverityColor, formatRelativeTime } from '../lib/utils';
import { Bell, X, Check, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';

interface SecurityNotificationsProps {
  events: SecurityEvent[];
  onAcknowledge?: (eventId: string) => void;
  onDismiss?: (eventId: string) => void;
  className?: string;
}

export function SecurityNotifications({
  events,
  onAcknowledge,
  onDismiss,
  className,
}: SecurityNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localEvents, setLocalEvents] = useState<SecurityEvent[]>(events);

  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  const unacknowledgedCount = localEvents.filter((e) => !e.acknowledged).length;

  const handleAcknowledge = (eventId: string) => {
    setLocalEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              acknowledged: true,
              acknowledgedAt: new Date(),
              acknowledgedBy: 'current-user',
            }
          : e
      )
    );
    onAcknowledge?.(eventId);
  };

  const handleDismiss = (eventId: string) => {
    setLocalEvents((prev) => prev.filter((e) => e.id !== eventId));
    onDismiss?.(eventId);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className={className}>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative rounded-full p-2 hover:bg-gray-100 transition-colors"
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unacknowledgedCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
              {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
            </span>
          )}
        </button>

        {/* Notification Panel */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <div className="absolute right-0 z-50 mt-2 w-96 max-h-[600px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
              {/* Header */}
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Security Notifications
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-md p-1 hover:bg-gray-200"
                  >
                    <X className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {unacknowledgedCount} unacknowledged events
                </p>
              </div>

              {/* Events List */}
              <div className="overflow-y-auto max-h-[500px]">
                {localEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <CheckCircle className="mb-2 h-12 w-12" />
                    <p className="text-sm">No security events</p>
                  </div>
                ) : (
                  localEvents.map((event) => (
                    <NotificationItem
                      key={event.id}
                      event={event}
                      onAcknowledge={() => handleAcknowledge(event.id)}
                      onDismiss={() => handleDismiss(event.id)}
                      getSeverityIcon={getSeverityIcon}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                <button
                  onClick={() => {
                    localEvents.forEach((e) => {
                      if (!e.acknowledged) {
                        handleAcknowledge(e.id);
                      }
                    });
                  }}
                  className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                  Acknowledge All
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  event: SecurityEvent;
  onAcknowledge: () => void;
  onDismiss: () => void;
  getSeverityIcon: (severity: string) => React.ReactNode;
}

function NotificationItem({ event, onAcknowledge, onDismiss, getSeverityIcon }: NotificationItemProps) {
  return (
    <div
      className={`border-b border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors ${
        event.acknowledged ? 'opacity-60' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="mt-0.5">{getSeverityIcon(event.severity)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">{event.type}</h4>
              <p className="mt-1 text-xs text-gray-600">{event.description}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span>{event.source}</span>
                <span>•</span>
                <span>{formatRelativeTime(event.timestamp)}</span>
              </div>
            </div>

            <div className="flex gap-1">
              {!event.acknowledged && (
                <button
                  onClick={onAcknowledge}
                  className="rounded-md p-1 hover:bg-green-100 transition-colors"
                  title="Acknowledge"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </button>
              )}
              <button
                onClick={onDismiss}
                className="rounded-md p-1 hover:bg-gray-200 transition-colors"
                title="Dismiss"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {event.acknowledged && event.acknowledgedBy && (
            <div className="mt-2 text-xs text-gray-500">
              Acknowledged by {event.acknowledgedBy} • {formatRelativeTime(event.acknowledgedAt!)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Toast notification component for inline alerts
interface SecurityToastProps {
  event: SecurityEvent;
  onAcknowledge?: () => void;
  onDismiss?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
  className?: string;
}

export function SecurityToast({
  event,
  onAcknowledge,
  onDismiss,
  autoClose = true,
  autoCloseDelay = 5000,
  className,
}: SecurityToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, onDismiss]);

  if (!visible) return null;

  const severityColors = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md rounded-lg border-l-4 shadow-lg ${
        severityColors[event.severity as keyof typeof severityColors]
      } bg-white p-4 ${className}`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-gray-600" />
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900">{event.type}</h4>
          <p className="mt-1 text-xs text-gray-600">{event.description}</p>

          <div className="mt-2 flex gap-2">
            {onAcknowledge && (
              <button
                onClick={() => {
                  onAcknowledge();
                  setVisible(false);
                }}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Acknowledge
              </button>
            )}
            <button
              onClick={() => {
                setVisible(false);
                onDismiss?.();
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          className="flex-shrink-0 rounded-md p-1 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// Security alert banner for page-level notifications
interface SecurityAlertBannerProps {
  event: SecurityEvent;
  onAcknowledge?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function SecurityAlertBanner({
  event,
  onAcknowledge,
  onDismiss,
  className,
}: SecurityAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const alertStyles = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    high: 'bg-orange-50 border-orange-200 text-orange-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div
      className={`border-b ${alertStyles[event.severity as keyof typeof alertStyles]} ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <h3 className="text-sm font-semibold">{event.type}</h3>
              <p className="text-xs">{event.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAcknowledge && (
              <button
                onClick={() => {
                  onAcknowledge();
                  setDismissed(true);
                }}
                className="rounded-md bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Acknowledge
              </button>
            )}
            <button
              onClick={() => {
                setDismissed(true);
                onDismiss?.();
              }}
              className="rounded-md p-1 hover:bg-black/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
