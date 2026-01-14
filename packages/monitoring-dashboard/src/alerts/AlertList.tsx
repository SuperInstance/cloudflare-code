'use client';

import React, { useState, useMemo } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Clock,
  User,
  ChevronDown,
} from 'lucide-react';
import { Alert, AlertSeverity, AlertStatus, AlertType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AlertListProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  onSilence?: (alertId: string, duration?: string) => void;
  onDelete?: (alertId: string) => void;
  onSelectAlert?: (alert: Alert) => void;
}

export const AlertList: React.FC<AlertListProps> = ({
  alerts,
  onAcknowledge,
  onResolve,
  onSilence,
  onDelete,
  onSelectAlert,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        alert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (alert.description?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
      const matchesType = typeFilter === 'all' || alert.type === typeFilter;

      return matchesSearch && matchesSeverity && matchesStatus && matchesType;
    });
  }, [alerts, searchQuery, severityFilter, statusFilter, typeFilter]);

  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => {
      // Sort by status (open first), then by severity, then by time
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      if (a.severity !== b.severity) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [filteredAlerts, severityOrder]);

  const handleAcknowledge = (alertId: string) => {
    onAcknowledge?.(alertId);
  };

  const handleResolve = (alertId: string) => {
    onResolve?.(alertId);
    setSelectedAlert(null);
  };

  const handleSilence = (alertId: string, duration: string = '1h') => {
    onSilence?.(alertId, duration);
  };

  const handleDelete = (alert: Alert) => {
    setSelectedAlert(alert);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedAlert) {
      onDelete?.(selectedAlert.id);
      setShowDeleteDialog(false);
      setSelectedAlert(null);
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      case 'low':
        return <Info className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 dark:bg-red-950';
      case 'high':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      case 'low':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
      case 'info':
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950';
    }
  };

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'silenced':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const alertCounts = useMemo(() => {
    return {
      total: alerts.length,
      open: alerts.filter(a => a.status === 'open').length,
      critical: alerts.filter(a => a.severity === 'critical' && a.status === 'open').length,
    };
  }, [alerts]);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Alerts</h2>
              <Badge variant="secondary">{alertCounts.total}</Badge>
              {alertCounts.open > 0 && (
                <Badge variant="destructive">{alertCounts.open} open</Badge>
              )}
              {alertCounts.critical > 0 && (
                <Badge className="bg-red-600">{alertCounts.critical} critical</Badge>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={severityFilter} onValueChange={(v: any) => setSeverityFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="silenced">Silenced</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="threshold">Threshold</SelectItem>
                <SelectItem value="anomaly">Anomaly</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="composite">Composite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Alert List */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {sortedAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No alerts</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || severityFilter !== 'all' || statusFilter !== 'all'
                    ? 'No alerts match your filters'
                    : 'All systems are operating normally'}
                </p>
              </div>
            ) : (
              sortedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'p-4 hover:bg-muted/50 transition-colors cursor-pointer',
                    alert.status === 'open' && 'bg-red-50/50 dark:bg-red-950/20'
                  )}
                  onClick={() => {
                    setSelectedAlert(alert);
                    onSelectAlert?.(alert);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn('p-2 rounded-md', getSeverityColor(alert.severity))}>
                        {getSeverityIcon(alert.severity)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{alert.name}</h3>
                          <Badge className={getStatusColor(alert.status)}>
                            {alert.status}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {alert.severity}
                          </Badge>
                        </div>

                        {alert.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {alert.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(alert.createdAt, 'PPp')}
                          </div>
                          {alert.triggeredCount > 0 && (
                            <div>Triggered {alert.triggeredCount} times</div>
                          )}
                          {alert.acknowledgedBy && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Ack by {alert.acknowledgedBy}
                            </div>
                          )}
                        </div>

                        {alert.labels && Object.keys(alert.labels).length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {Object.entries(alert.labels).slice(0, 3).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}={value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {alert.status === 'open' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id); }}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Acknowledge
                            </DropdownMenuItem>
                          )}
                          {(alert.status === 'open' || alert.status === 'acknowledged') && (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResolve(alert.id); }}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Resolve
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSilence(alert.id, '1h'); }}>
                                <BellOff className="h-4 w-4 mr-2" />
                                Silence for 1h
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSilence(alert.id, '24h'); }}>
                                <BellOff className="h-4 w-4 mr-2" />
                                Silence for 24h
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDelete(alert); }}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Alert</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedAlert?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AlertList;
