'use client';

// @ts-nocheck
import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  ChevronDown,
  User,
  Calendar,
  Tag,
} from 'lucide-react';
import { Incident, IncidentStatus, IncidentImpact } from '@/types';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface IncidentTimelineProps {
  incidents: Incident[];
  onCreateIncident?: () => void;
  onUpdateIncident?: (incidentId: string, updates: Partial<Incident>) => void;
  onSelectIncident?: (incident: Incident) => void;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  incidents,
  onCreateIncident,
  onUpdateIncident,
  onSelectIncident,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [impactFilter, setImpactFilter] = useState<IncidentImpact | 'all'>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const filteredIncidents = incidents
    .filter((incident) => {
      const matchesSearch =
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
      const matchesImpact = impactFilter === 'all' || incident.impact === impactFilter;
      return matchesSearch && matchesStatus && matchesImpact;
    })
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'investigating':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'identified':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'monitoring':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'postmortem':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    }
  };

  const getImpactColor = (impact: IncidentImpact) => {
    switch (impact) {
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const calculateDuration = (start: Date, end?: Date) => {
    const endMs = end ? end.getTime() : Date.now();
    const startMs = start.getTime();
    const durationMs = endMs - startMs;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  const handleUpdateStatus = (incidentId: string, newStatus: IncidentStatus) => {
    onUpdateIncident?.(incidentId, { status: newStatus });
  };

  const handleViewDetails = (incident: Incident) => {
    setSelectedIncident(incident);
    setShowDetailsDialog(true);
    onSelectIncident?.(incident);
  };

  const activeIncidents = incidents.filter(i => !i.endTime).length;
  const criticalIncidents = incidents.filter(i => i.impact === 'critical' && !i.endTime).length;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Incidents</h2>
              <Badge variant="secondary">{incidents.length}</Badge>
              {activeIncidents > 0 && (
                <Badge variant="destructive">{activeIncidents} active</Badge>
              )}
              {criticalIncidents > 0 && (
                <Badge className="bg-red-600">{criticalIncidents} critical</Badge>
              )}
            </div>
            {onCreateIncident && (
              <Button onClick={onCreateIncident}>
                <Plus className="h-4 w-4 mr-2" />
                New Incident
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="identified">Identified</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="postmortem">Postmortem</SelectItem>
              </SelectContent>
            </Select>

            <Select value={impactFilter} onValueChange={(v: any) => setImpactFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impacts</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No incidents</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || impactFilter !== 'all'
                    ? 'No incidents match your filters'
                    : 'No incidents recorded'}
                </p>
              </div>
            ) : (
              filteredIncidents.map((incident) => (
                <Card
                  key={incident.id}
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-shadow',
                    !incident.endTime && 'border-orange-500'
                  )}
                  onClick={() => handleViewDetails(incident)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{incident.title}</CardTitle>
                          <Badge className={getStatusColor(incident.status)}>{incident.status}</Badge>
                          <Badge className={getImpactColor(incident.impact)}>{incident.impact}</Badge>
                          <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {incident.description}
                        </CardDescription>
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
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(incident); }}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {incident.status !== 'resolved' && incident.status !== 'postmortem' && (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUpdateStatus(incident.id, 'resolved'); }}>
                                Mark as Resolved
                              </DropdownMenuItem>
                            </>
                          )}
                          {incident.status === 'resolved' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUpdateStatus(incident.id, 'postmortem'); }}>
                              Start Postmortem
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      {/* Timeline */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Started {format(incident.startTime, 'PPp')}</span>
                        </div>
                        {incident.endTime ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              Duration: {calculateDuration(incident.startTime, incident.endTime)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 animate-pulse" />
                            <span>
                              Ongoing: {calculateDuration(incident.startTime)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Affected Services */}
                      {incident.affectedServices.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          {incident.affectedServices.map((service) => (
                            <Badge key={service} variant="secondary">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Assignees */}
                      {incident.assignees.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Assigned to: {incident.assignees.join(', ')}</span>
                        </div>
                      )}

                      {/* Recent Updates */}
                      {incident.updates.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="text-sm font-medium mb-2">Latest Update</div>
                          <div className="text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <User className="h-3 w-3" />
                              <span>{incident.updates[incident.updates.length - 1].createdBy}</span>
                              <span>•</span>
                              <span>{format(incident.updates[incident.updates.length - 1].timestamp, 'PPp')}</span>
                            </div>
                            <p className="line-clamp-2">{incident.updates[incident.updates.length - 1].message}</p>
                          </div>
                        </div>
                      )}

                      {/* Related Alerts */}
                      {incident.relatedAlerts.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          <span>{incident.relatedAlerts.length} related alert(s)</span>
                        </div>
                      )}

                      {/* Root Cause */}
                      {incident.rootCause && (
                        <div className="border-t pt-3">
                          <div className="text-sm font-medium mb-1">Root Cause</div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {incident.rootCause}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Incident Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedIncident && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl">{selectedIncident.title}</DialogTitle>
                  <Badge className={getStatusColor(selectedIncident.status)}>{selectedIncident.status}</Badge>
                  <Badge className={getImpactColor(selectedIncident.impact)}>{selectedIncident.impact}</Badge>
                </div>
                <DialogDescription>{selectedIncident.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Timeline */}
                <div>
                  <h3 className="font-semibold mb-3">Timeline</h3>
                  <div className="space-y-3">
                    {selectedIncident.timeline.map((event) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full',
                              event.type === 'status-change' && 'bg-blue-500',
                              event.type === 'update' && 'bg-gray-500',
                              event.type === 'action' && 'bg-green-500',
                              event.type === 'detection' && 'bg-orange-500',
                              event.type === 'resolution' && 'bg-purple-500'
                            )}
                          />
                          <div className="w-0.5 flex-1 bg-border last:hidden" />
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="text-sm font-medium">{event.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(event.timestamp, 'PPp')}
                            {event.createdBy && ` • ${event.createdBy}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Updates */}
                {selectedIncident.updates.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Updates</h3>
                    <div className="space-y-3">
                      {selectedIncident.updates.map((update) => (
                        <Card key={update.id} className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4" />
                              <span className="font-medium">{update.createdBy}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(update.timestamp, 'PPp')}
                            </div>
                          </div>
                          <p className="text-sm">{update.message}</p>
                          {update.status && (
                            <Badge className="mt-2">{update.status}</Badge>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution */}
                {selectedIncident.resolution && (
                  <div>
                    <h3 className="font-semibold mb-3">Resolution</h3>
                    <p className="text-sm">{selectedIncident.resolution}</p>
                  </div>
                )}

                {/* Postmortem */}
                {selectedIncident.postmortem && (
                  <div>
                    <h3 className="font-semibold mb-3">Postmortem</h3>
                    <Card className="p-4">
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-medium">Summary:</span>
                          <p className="mt-1">{selectedIncident.postmortem.summary}</p>
                        </div>
                        <div>
                          <span className="font-medium">Root Cause:</span>
                          <p className="mt-1">{selectedIncident.postmortem.rootCause}</p>
                        </div>
                        <div>
                          <span className="font-medium">Resolution:</span>
                          <p className="mt-1">{selectedIncident.postmortem.resolution}</p>
                        </div>
                        <div>
                          <span className="font-medium">Lessons Learned:</span>
                          <ul className="mt-1 list-disc list-inside">
                            {selectedIncident.postmortem.lessonsLearned.map((lesson, i) => (
                              <li key={i}>{lesson}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IncidentTimeline;
