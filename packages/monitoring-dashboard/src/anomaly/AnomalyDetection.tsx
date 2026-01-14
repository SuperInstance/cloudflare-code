'use client';

import React, { useState, useMemo } from 'react';
import {
  Radar,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Brain,
  ChevronDown,
  BarChart3,
  Clock,
} from 'lucide-react';
import { Anomaly, AnomalyType, AnomalySeverity, AnomalyStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AnomalyDetectionProps {
  anomalies: Anomaly[];
  onInvestigate?: (anomalyId: string) => void;
  onResolve?: (anomalyId: string) => void;
  onDismiss?: (anomalyId: string) => void;
}

export const AnomalyDetection: React.FC<AnomalyDetectionProps> = ({
  anomalies,
  onInvestigate,
  onResolve,
  onDismiss,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | 'all'>('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const activeAnomalies = anomalies.filter(a => a.status === 'active');
  const filteredAnomalies = anomalies
    .filter((anomaly) => {
      const matchesSearch =
        anomaly.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anomaly.metric.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || anomaly.type === typeFilter;
      const matchesSeverity = severityFilter === 'all' || anomaly.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' || anomaly.status === statusFilter;
      return matchesSearch && matchesType && matchesSeverity && matchesStatus;
    })
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

  const anomalyStats = useMemo(() => {
    return {
      total: anomalies.length,
      active: activeAnomalies.length,
      critical: activeAnomalies.filter(a => a.severity === 'critical').length,
      high: activeAnomalies.filter(a => a.severity === 'high').length,
      byType: {
        spike: anomalies.filter(a => a.type === 'spike').length,
        drop: anomalies.filter(a => a.type === 'drop').length,
        trendChange: anomalies.filter(a => a.type === 'trend-change').length,
        patternBreak: anomalies.filter(a => a.type === 'pattern-break').length,
        outlier: anomalies.filter(a => a.type === 'outlier').length,
      },
    };
  }, [anomalies, activeAnomalies]);

  const getTypeIcon = (type: AnomalyType) => {
    switch (type) {
      case 'spike':
        return TrendingUp;
      case 'drop':
        return TrendingDown;
      case 'trend-change':
        return Activity;
      case 'pattern-break':
        return BarChart3;
      case 'outlier':
        return AlertTriangle;
    }
  };

  const getTypeColor = (type: AnomalyType) => {
    switch (type) {
      case 'spike':
        return 'text-red-600 bg-red-50 dark:bg-red-950';
      case 'drop':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
      case 'trend-change':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950';
      case 'pattern-break':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
      case 'outlier':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
    }
  };

  const getSeverityColor = (severity: AnomalySeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getStatusColor = (status: AnomalyStatus) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'false-positive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleViewDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setShowDetailsDialog(true);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Anomaly Detection</h2>
              <Badge variant="secondary">{anomalyStats.total}</Badge>
              {anomalyStats.active > 0 && (
                <Badge variant="destructive">{anomalyStats.active} active</Badge>
              )}
              {anomalyStats.critical > 0 && (
                <Badge className="bg-red-600">{anomalyStats.critical} critical</Badge>
              )}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-5 gap-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Total Anomalies</div>
              <div className="text-2xl font-bold">{anomalyStats.total}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-2xl font-bold text-red-600">{anomalyStats.active}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Critical</div>
              <div className="text-2xl font-bold text-orange-600">{anomalyStats.critical}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">High</div>
              <div className="text-2xl font-bold text-yellow-600">{anomalyStats.high}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Detection Rate</div>
              <div className="text-2xl font-bold text-green-600">
                {anomalyStats.total > 0 ? ((anomalyStats.total - anomalyStats.active) / anomalyStats.total * 100).toFixed(0) : 100}%
              </div>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search anomalies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="spike">Spike</SelectItem>
                <SelectItem value="drop">Drop</SelectItem>
                <SelectItem value="trend-change">Trend Change</SelectItem>
                <SelectItem value="pattern-break">Pattern Break</SelectItem>
                <SelectItem value="outlier">Outlier</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={(v: any) => setSeverityFilter(v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="false-positive">False Positive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Anomaly List */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {filteredAnomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No anomalies detected</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || typeFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all'
                    ? 'No anomalies match your filters'
                    : 'All systems are operating normally'}
                </p>
              </div>
            ) : (
              filteredAnomalies.map((anomaly) => {
                const TypeIcon = getTypeIcon(anomaly.type);
                const deviationPercent = Math.abs(anomaly.deviationPercentage);

                return (
                  <Card
                    key={anomaly.id}
                    className={cn(
                      'cursor-pointer hover:shadow-lg transition-shadow',
                      anomaly.status === 'active' && 'border-red-500'
                    )}
                    onClick={() => handleViewDetails(anomaly)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={cn('p-2 rounded-md', getTypeColor(anomaly.type))}>
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-base capitalize">{anomaly.type}</CardTitle>
                              <Badge className={getSeverityColor(anomaly.severity)}>
                                {anomaly.severity}
                              </Badge>
                              <Badge className={getStatusColor(anomaly.status)}>
                                {anomaly.status}
                              </Badge>
                            </div>
                            <CardDescription className="font-mono text-sm">
                              {anomaly.metric}
                            </CardDescription>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {anomaly.status === 'active' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInvestigate?.(anomaly.id); }}>
                                <Brain className="h-4 w-4 mr-2" />
                                Start Investigation
                              </DropdownMenuItem>
                            )}
                            {(anomaly.status === 'active' || anomaly.status === 'investigating') && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResolve?.(anomaly.id); }}>
                                Resolve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); onDismiss?.(anomaly.id); }}
                              className="text-destructive"
                            >
                              Mark as False Positive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm">{anomaly.description}</p>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Value</div>
                            <div className="font-mono font-medium">{anomaly.value.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Expected</div>
                            <div className="font-mono font-medium">{anomaly.expectedValue.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Deviation</div>
                            <div className={cn(
                              'font-mono font-medium',
                              deviationPercent > 50 ? 'text-red-600' : deviationPercent > 20 ? 'text-yellow-600' : 'text-green-600'
                            )}>
                              {anomaly.deviationPercentage > 0 ? '+' : ''}{anomaly.deviationPercentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Confidence and Duration */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Confidence</span>
                            <span className="font-medium">{(anomaly.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={anomaly.confidence * 100} className="h-1" />
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{format(anomaly.detectedAt, 'PPp')}</span>
                          </div>
                          {anomaly.duration && (
                            <div>Duration: {anomaly.duration}</div>
                          )}
                        </div>

                        {/* Related Anomalies */}
                        {anomaly.relatedAnomalies && anomaly.relatedAnomalies.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="text-xs text-muted-foreground mb-1">
                              {anomaly.relatedAnomalies.length} related anomaly(s)
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Anomaly Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedAnomaly && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl capitalize">{selectedAnomaly.type}</DialogTitle>
                  <Badge className={getSeverityColor(selectedAnomaly.severity)}>
                    {selectedAnomaly.severity}
                  </Badge>
                  <Badge className={getStatusColor(selectedAnomaly.status)}>
                    {selectedAnomaly.status}
                  </Badge>
                </div>
                <DialogDescription className="font-mono">{selectedAnomaly.metric}</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="patterns">Patterns</TabsTrigger>
                  <TabsTrigger value="root-cause">Root Cause</TabsTrigger>
                  <TabsTrigger value="investigation">Investigation</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Anomaly Details</h3>
                    <p className="text-sm mb-4">{selectedAnomaly.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Detected At</div>
                        <div className="font-medium">{format(selectedAnomaly.detectedAt, 'PPpp')}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Duration</div>
                        <div className="font-medium">{selectedAnomaly.duration || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Actual Value</div>
                        <div className="font-mono text-lg font-medium">{selectedAnomaly.value.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Expected Value</div>
                        <div className="font-mono text-lg font-medium">{selectedAnomaly.expectedValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Deviation</div>
                        <div className="font-mono font-medium">{selectedAnomaly.deviation.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Deviation %</div>
                        <div className="font-mono font-medium">{selectedAnomaly.deviationPercentage.toFixed(1)}%</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="font-medium">{(selectedAnomaly.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={selectedAnomaly.confidence * 100} className="h-2" />
                    </div>
                  </Card>

                  {selectedAnomaly.labels && Object.keys(selectedAnomaly.labels).length > 0 && (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2">Labels</h3>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(selectedAnomaly.labels).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="font-mono">
                            {key}={value}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="patterns" className="space-y-4">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Detected Patterns</h3>
                    <div className="space-y-3">
                      {selectedAnomaly.patterns.map((pattern, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium capitalize">{pattern.type}</div>
                            <Badge variant="outline">
                              Strength: {(pattern.strength * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{pattern.description}</p>
                          {pattern.period && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Period: {pattern.period}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="root-cause" className="space-y-4">
                  {selectedAnomaly.rootCauseAnalysis ? (
                    <>
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3">Potential Causes</h3>
                        <div className="space-y-3">
                          {selectedAnomaly.rootCauseAnalysis.potentialCauses.map((cause, index) => (
                            <div key={index} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{cause.cause}</div>
                                <Badge>
                                  {(cause.probability * 100).toFixed(0)}% probability
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Evidence:</div>
                                {cause.evidence.map((evidence, i) => (
                                  <div key={i} className="text-xs pl-2">
                                    • {evidence}
                                  </div>
                                ))}
                              </div>
                              {cause.relatedMetrics && cause.relatedMetrics.length > 0 && (
                                <div className="mt-2 flex gap-1 flex-wrap">
                                  {cause.relatedMetrics.map((metric, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {metric}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h3 className="font-semibold mb-3">Correlations</h3>
                        <div className="space-y-2">
                          {selectedAnomaly.rootCauseAnalysis.correlations.map((corr, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-mono">{corr.metric1}</span>
                                <span className="text-muted-foreground mx-2">↔</span>
                                <span className="font-mono">{corr.metric2}</span>
                              </div>
                              <Badge variant="outline">
                                {(corr.correlation * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </>
                  ) : (
                    <Card className="p-8 text-center text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Root cause analysis not available</p>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="investigation" className="space-y-4">
                  {selectedAnomaly.investigationSteps && selectedAnomaly.investigationSteps.length > 0 ? (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">Investigation Steps</h3>
                      <div className="space-y-3">
                        {selectedAnomaly.investigationSteps.map((step, index) => (
                          <div key={step.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                                  step.status === 'completed' && 'bg-green-500 text-white',
                                  step.status === 'in-progress' && 'bg-blue-500 text-white',
                                  step.status === 'pending' && 'bg-gray-200 text-gray-600'
                                )}
                              >
                                {step.step}
                              </div>
                              <div className="w-0.5 flex-1 bg-border last:hidden" />
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="font-medium">{step.action}</div>
                              <div className="text-sm text-muted-foreground">{step.description}</div>
                              {step.result && (
                                <div className="text-sm mt-1 p-2 bg-muted rounded">
                                  {step.result}
                                </div>
                              )}
                              {step.completedBy && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Completed by {step.completedBy}
                                  {step.completedAt && ` at ${format(step.completedAt, 'PPp')}`}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">No investigation steps defined</p>
                      <Button onClick={() => onInvestigate?.(selectedAnomaly.id)}>
                        <Brain className="h-4 w-4 mr-2" />
                        Start Investigation
                      </Button>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Close
                </Button>
                {selectedAnomaly.status === 'active' && (
                  <Button onClick={() => onInvestigate?.(selectedAnomaly.id)}>
                    <Brain className="h-4 w-4 mr-2" />
                    Investigate
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnomalyDetection;
