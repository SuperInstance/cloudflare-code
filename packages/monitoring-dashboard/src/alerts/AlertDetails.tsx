'use client';

// @ts-nocheck
import React from 'react';
import { Clock, User, Activity, Tag, BellOff, CheckCircle2 } from 'lucide-react';
import { Alert } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AlertDetailsProps {
  alert: Alert;
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  onSilence?: (alertId: string, duration?: string) => void;
  onClose?: () => void;
}

export const AlertDetails: React.FC<AlertDetailsProps> = ({
  alert,
  onAcknowledge,
  onResolve,
  onSilence,
  onClose,
}) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'info':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderCondition = () => {
    switch (alert.condition.type) {
      case 'threshold':
        return (
          <div className="space-y-2">
            <div>
              <span className="font-medium">Metric:</span>{' '}
              <span className="font-mono text-sm">{alert.condition.threshold?.metric}</span>
            </div>
            <div>
              <span className="font-medium">Operator:</span>{' '}
              <span className="font-mono">{alert.condition.threshold?.operator}</span>
            </div>
            <div>
              <span className="font-medium">Threshold:</span>{' '}
              <span className="font-mono">{alert.condition.threshold?.value}</span>
            </div>
            {alert.condition.for && (
              <div>
                <span className="font-medium">Duration:</span> {alert.condition.for}
              </div>
            )}
          </div>
        );

      case 'expression':
        return (
          <div className="space-y-2">
            <div>
              <span className="font-medium">Expression:</span>
              <pre className="mt-2 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                {alert.condition.expression}
              </pre>
            </div>
          </div>
        );

      case 'composite':
        return (
          <div className="space-y-4">
            <div>
              <span className="font-medium">Operator:</span>{' '}
              <Badge variant="outline">{alert.condition.logicalOperator}</Badge>
            </div>
            <div className="space-y-2">
              <span className="font-medium">Conditions:</span>
              {alert.condition.compositeConditions?.map((condition, index) => (
                <Card key={index} className="p-3">
                  <pre className="text-sm">{JSON.stringify(condition, null, 2)}</pre>
                </Card>
              ))}
            </div>
          </div>
        );

      default:
        return <div className="text-muted-foreground">Unknown condition type</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">{alert.name}</h2>
            <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
            <Badge variant="outline">{alert.status}</Badge>
            <Badge variant="secondary" className="capitalize">
              {alert.type}
            </Badge>
          </div>
          {alert.description && (
            <p className="text-sm text-muted-foreground">{alert.description}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-b px-6 py-3 flex gap-2">
        {alert.status === 'open' && onAcknowledge && (
          <Button onClick={() => onAcknowledge(alert.id)} variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Acknowledge
          </Button>
        )}
        {(alert.status === 'open' || alert.status === 'acknowledged') && onResolve && (
          <Button onClick={() => onResolve(alert.id)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Resolve
          </Button>
        )}
        {onSilence && (
          <Button onClick={() => onSilence(alert.id, '1h')} variant="outline">
            <BellOff className="h-4 w-4 mr-2" />
            Silence
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="overview" className="p-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="condition">Condition</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Status:</span>
                    <Badge>{alert.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Created:</span>
                    <span>{format(alert.createdAt, 'PPpp')}</span>
                  </div>
                  {alert.lastTriggered && (
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Last Triggered:</span>
                      <span>{format(alert.lastTriggered, 'PPpp')}</span>
                    </div>
                  )}
                  {alert.acknowledgedBy && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Acknowledged by:</span>
                      <span>{alert.acknowledgedBy}</span>
                      <span className="text-muted-foreground">
                        {alert.acknowledgedAt && format(alert.acknowledgedAt, 'PPpp')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Triggered Count:</span>
                    <span>{alert.triggeredCount}</span>
                  </div>
                  {alert.silenced && (
                    <div className="flex items-center gap-2 text-sm">
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Silenced:</span>
                      <Badge variant="secondary">Yes</Badge>
                      {alert.silencedUntil && (
                        <span className="text-muted-foreground">
                          until {format(alert.silencedUntil, 'PPp')}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {alert.labels && Object.keys(alert.labels).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Labels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(alert.labels).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="font-mono text-xs">
                          {key}={value}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {alert.annotations && Object.keys(alert.annotations).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Annotations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2">
                      {Object.entries(alert.annotations).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 gap-2">
                          <dt className="font-medium text-sm">{key}</dt>
                          <dd className="text-sm text-muted-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="condition">
            <Card>
              <CardHeader>
                <CardTitle>Alert Condition</CardTitle>
                <CardDescription>
                  The condition that triggers this alert
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderCondition()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle>Alert Actions</CardTitle>
                <CardDescription>
                  Actions executed when this alert triggers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alert.actions && alert.actions.length > 0 ? (
                  <div className="space-y-3">
                    {alert.actions.map((action, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{action.type}</div>
                          <div className="text-sm text-muted-foreground">
                            {JSON.stringify(action.config, null, 2)}
                          </div>
                        </div>
                        <Badge variant={action.enabled ? 'default' : 'secondary'}>
                          {action.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No actions configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Alert History</CardTitle>
                <CardDescription>
                  Timeline of alert activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="w-0.5 flex-1 bg-border" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="font-medium">Alert Created</div>
                      <div className="text-sm text-muted-foreground">
                        {format(alert.createdAt, 'PPpp')}
                      </div>
                    </div>
                  </div>

                  {alert.lastTriggered && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <div className="w-0.5 flex-1 bg-border" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-medium">Last Triggered</div>
                        <div className="text-sm text-muted-foreground">
                          {format(alert.lastTriggered, 'PPpp')}
                        </div>
                      </div>
                    </div>
                  )}

                  {alert.acknowledgedAt && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <div className="w-0.5 flex-1 bg-border" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-medium">Acknowledged</div>
                        <div className="text-sm text-muted-foreground">
                          by {alert.acknowledgedBy} at {format(alert.acknowledgedAt, 'PPpp')}
                        </div>
                      </div>
                    </div>
                  )}

                  {alert.resolvedAt && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Resolved</div>
                        <div className="text-sm text-muted-foreground">
                          by {alert.resolvedBy} at {format(alert.resolvedAt, 'PPpp')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AlertDetails;
