'use client';

import React, { useState, useMemo } from 'react';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  DollarSign,
  Activity,
  Filter,
  Search,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Insight, InsightType, InsightCategory, InsightSeverity, Recommendation } from '@/types';
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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface PerformanceInsightsProps {
  insights: Insight[];
  onDismiss?: (insightId: string) => void;
  onAcknowledge?: (insightId: string, recommendationId: string) => void;
  onImplement?: (insightId: string, recommendationId: string) => void;
}

export const PerformanceInsights: React.FC<PerformanceInsightsProps> = ({
  insights,
  onDismiss,
  onAcknowledge,
  onImplement,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InsightCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<InsightSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InsightType | 'all'>('all');
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const activeInsights = insights.filter(i => !i.dismissed);
  const filteredInsights = activeInsights
    .filter((insight) => {
      const matchesSearch =
        insight.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        insight.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || insight.category === categoryFilter;
      const matchesSeverity = severityFilter === 'all' || insight.severity === severityFilter;
      const matchesType = typeFilter === 'all' || insight.type === typeFilter;
      return matchesSearch && matchesCategory && matchesSeverity && matchesType;
    })
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  const insightsByCategory = useMemo(() => {
    const groups: Record<InsightCategory, Insight[]> = {
      performance: [],
      availability: [],
      capacity: [],
      cost: [],
      security: [],
      reliability: [],
      scalability: [],
    };

    filteredInsights.forEach((insight) => {
      groups[insight.category].push(insight);
    });

    return groups;
  }, [filteredInsights]);

  const getCategoryIcon = (category: InsightCategory) => {
    switch (category) {
      case 'performance':
        return Activity;
      case 'cost':
        return DollarSign;
      case 'security':
        return AlertTriangle;
      default:
        return Lightbulb;
    }
  };

  const getCategoryColor = (category: InsightCategory) => {
    switch (category) {
      case 'performance':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
      case 'availability':
        return 'text-green-600 bg-green-50 dark:bg-green-950';
      case 'capacity':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950';
      case 'cost':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      case 'security':
        return 'text-red-600 bg-red-50 dark:bg-red-950';
      case 'reliability':
        return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950';
      case 'scalability':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
    }
  };

  const getTypeIcon = (type: InsightType) => {
    switch (type) {
      case 'bottleneck':
        return AlertTriangle;
      case 'optimization':
        return Zap;
      case 'trend':
        return TrendingUp;
      case 'anomaly':
        return Activity;
      case 'forecast':
        return Clock;
      case 'recommendation':
        return Lightbulb;
    }
  };

  const getSeverityColor = (severity: InsightSeverity) => {
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
    }
  };

  const handleViewDetails = (insight: Insight) => {
    setSelectedInsight(insight);
    setShowDetailsDialog(true);
  };

  const handleDismiss = (insightId: string) => {
    onDismiss?.(insightId);
  };

  const criticalCount = filteredInsights.filter(i => i.severity === 'critical').length;
  const highCount = filteredInsights.filter(i => i.severity === 'high').length;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Performance Insights</h2>
              <Badge variant="secondary">{activeInsights.length}</Badge>
              {criticalCount > 0 && (
                <Badge className="bg-red-600">{criticalCount} critical</Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-orange-600">{highCount} high priority</Badge>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="availability">Availability</SelectItem>
                <SelectItem value="capacity">Capacity</SelectItem>
                <SelectItem value="cost">Cost</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="reliability">Reliability</SelectItem>
                <SelectItem value="scalability">Scalability</SelectItem>
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
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bottleneck">Bottleneck</SelectItem>
                <SelectItem value="optimization">Optimization</SelectItem>
                <SelectItem value="trend">Trend</SelectItem>
                <SelectItem value="anomaly">Anomaly</SelectItem>
                <SelectItem value="forecast">Forecast</SelectItem>
                <SelectItem value="recommendation">Recommendation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Insights Grid */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {Object.entries(insightsByCategory).map(([category, categoryInsights]) => {
              if (categoryInsights.length === 0) return null;
              const Icon = getCategoryIcon(category as InsightCategory);

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-5 w-5" />
                    <h3 className="text-lg font-semibold capitalize">{category}</h3>
                    <Badge variant="secondary">{categoryInsights.length}</Badge>
                  </div>

                  <div className="grid gap-4">
                    {categoryInsights.map((insight) => {
                      const TypeIcon = getTypeIcon(insight.type);
                      return (
                        <Card
                          key={insight.id}
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handleViewDetails(insight)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={cn('p-2 rounded-md', getCategoryColor(insight.category))}>
                                  <TypeIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <CardTitle className="text-base">{insight.title}</CardTitle>
                                    <Badge className={getSeverityColor(insight.severity)}>
                                      {insight.severity}
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">
                                      {insight.type}
                                    </Badge>
                                  </div>
                                  <CardDescription className="line-clamp-2">
                                    {insight.description}
                                  </CardDescription>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismiss(insight.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>

                          <CardContent>
                            <div className="space-y-3">
                              {/* Key Metrics */}
                              {insight.details.currentValue !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Current Value:</span>
                                  <span className="font-mono font-medium">
                                    {insight.details.currentValue.toFixed(2)}
                                  </span>
                                </div>
                              )}

                              {insight.details.changePercentage !== undefined && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Change:</span>
                                  {insight.details.changePercentage > 0 ? (
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className="font-medium">
                                    {Math.abs(insight.details.changePercentage).toFixed(1)}%
                                  </span>
                                </div>
                              )}

                              {insight.details.trend && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Trend:</span>
                                  <Badge variant="outline" className="capitalize">
                                    {insight.details.trend}
                                  </Badge>
                                </div>
                              )}

                              {/* Confidence */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Confidence</span>
                                  <span className="font-medium">{(insight.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <Progress value={insight.confidence * 100} className="h-1" />
                              </div>

                              {/* Recommendations Preview */}
                              {insight.recommendations.length > 0 && (
                                <div className="pt-2 border-t">
                                  <div className="text-xs text-muted-foreground mb-2">
                                    {insight.recommendations.length} recommendation(s)
                                  </div>
                                  <div className="flex gap-1 flex-wrap">
                                    {insight.recommendations.slice(0, 2).map((rec) => (
                                      <Badge key={rec.id} variant="secondary" className="text-xs">
                                        {rec.title}
                                      </Badge>
                                    ))}
                                    {insight.recommendations.length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{insight.recommendations.length - 2} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredInsights.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No insights</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || categoryFilter !== 'all' || severityFilter !== 'all'
                    ? 'No insights match your filters'
                    : 'No insights available at this time'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Insight Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedInsight && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl">{selectedInsight.title}</DialogTitle>
                  <Badge className={getSeverityColor(selectedInsight.severity)}>
                    {selectedInsight.severity}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {selectedInsight.type}
                  </Badge>
                </div>
                <DialogDescription>{selectedInsight.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Details */}
                <div>
                  <h3 className="font-semibold mb-3">Analysis Details</h3>
                  <Card className="p-4">
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      {selectedInsight.details.currentValue !== undefined && (
                        <div>
                          <dt className="text-muted-foreground">Current Value</dt>
                          <dd className="font-mono text-lg font-medium">
                            {selectedInsight.details.currentValue.toFixed(2)}
                          </dd>
                        </div>
                      )}
                      {selectedInsight.details.previousValue !== undefined && (
                        <div>
                          <dt className="text-muted-foreground">Previous Value</dt>
                          <dd className="font-mono text-lg font-medium">
                            {selectedInsight.details.previousValue.toFixed(2)}
                          </dd>
                        </div>
                      )}
                      {selectedInsight.details.changePercentage !== undefined && (
                        <div>
                          <dt className="text-muted-foreground">Change</dt>
                          <dd className="flex items-center gap-1 font-medium">
                            {selectedInsight.details.changePercentage > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            {Math.abs(selectedInsight.details.changePercentage).toFixed(1)}%
                          </dd>
                        </div>
                      )}
                      {selectedInsight.details.trend && (
                        <div>
                          <dt className="text-muted-foreground">Trend</dt>
                          <dd className="capitalize">{selectedInsight.details.trend}</dd>
                        </div>
                      )}
                      {selectedInsight.details.impact && (
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">Impact</dt>
                          <dd>{selectedInsight.details.impact}</dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                </div>

                {/* Affected Resources */}
                {selectedInsight.details.affectedResources && selectedInsight.details.affectedResources.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Affected Resources</h3>
                    <div className="flex gap-2 flex-wrap">
                      {selectedInsight.details.affectedResources.map((resource, i) => (
                        <Badge key={i} variant="secondary">
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence */}
                {selectedInsight.details.evidence && selectedInsight.details.evidence.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Evidence</h3>
                    <div className="space-y-2">
                      {selectedInsight.details.evidence.map((evidence, i) => (
                        <Card key={i} className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-medium capitalize">{evidence.type}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(evidence.timestamp, 'PPp')}
                            </div>
                          </div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(evidence.data, null, 2)}
                          </pre>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {selectedInsight.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Recommendations</h3>
                    <div className="space-y-3">
                      {selectedInsight.recommendations.map((rec) => (
                        <Card key={rec.id} className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{rec.title}</h4>
                                <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                                  {rec.priority}
                                </Badge>
                                <Badge variant="outline">{rec.effort} effort</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {rec.description}
                              </p>
                              {rec.estimatedImpact && (
                                <div className="text-sm text-green-600">
                                  Estimated Impact: {rec.estimatedImpact}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {rec.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onAcknowledge?.(selectedInsight.id, rec.id)}
                                  >
                                    Acknowledge
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => onImplement?.(selectedInsight.id, rec.id)}
                                  >
                                    Implement
                                  </Button>
                                </>
                              )}
                              {rec.status === 'acknowledged' && (
                                <Badge variant="secondary">Acknowledged</Badge>
                              )}
                              {rec.status === 'implemented' && (
                                <Badge className="bg-green-600">Implemented</Badge>
                              )}
                            </div>
                          </div>
                          {rec.actionItems.length > 0 && (
                            <div className="border-t pt-2">
                              <div className="text-xs font-medium mb-1">Action Items:</div>
                              <ul className="text-sm space-y-1">
                                {rec.actionItems.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-muted-foreground">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Close
                </Button>
                <Button variant="destructive" onClick={() => handleDismiss(selectedInsight.id)}>
                  Dismiss
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PerformanceInsights;
