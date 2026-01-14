import React, { useState } from 'react';
import { Incident } from '../types';
import { getSeverityColor, getStatusColor, formatRelativeTime } from '../lib/utils';
import { ChevronDown, ChevronUp, Clock, User, AlertCircle } from 'lucide-react';

interface IncidentListProps {
  incidents: Incident[];
  onIncidentClick?: (incident: Incident) => void;
  className?: string;
}

export function IncidentList({ incidents, onIncidentClick, className }: IncidentListProps) {
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredIncidents = incidents.filter(incident => {
    if (filterSeverity !== 'all' && incident.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && incident.status !== filterStatus) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedIncident(expandedIncident === id ? null : id);
  };

  return (
    <div className={className}>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="contained">Contained</option>
          <option value="eradicated">Eradicated</option>
          <option value="resolved">Resolved</option>
        </select>

        <span className="ml-auto flex items-center text-sm text-gray-500">
          {filteredIncidents.length} incidents
        </span>
      </div>

      {/* Incident List */}
      <div className="space-y-2">
        {filteredIncidents.map((incident) => (
          <IncidentItem
            key={incident.id}
            incident={incident}
            expanded={expandedIncident === incident.id}
            onToggle={() => toggleExpand(incident.id)}
            onClick={() => onIncidentClick?.(incident)}
          />
        ))}
      </div>

      {filteredIncidents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <AlertCircle className="mb-2 h-12 w-12" />
          <p>No incidents found matching the filters</p>
        </div>
      )}
    </div>
  );
}

interface IncidentItemProps {
  incident: Incident;
  expanded: boolean;
  onToggle: () => void;
  onClick: () => void;
}

function IncidentItem({ incident, expanded, onToggle, onClick }: IncidentItemProps) {
  const completedTasks = incident.tasks.filter(t => t.status === 'completed').length;
  const taskProgress = incident.tasks.length > 0
    ? Math.round((completedTasks / incident.tasks.length) * 100)
    : 0;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Main Row */}
      <div
        className="flex cursor-pointer items-center gap-4 p-4"
        onClick={onClick}
      >
        {/* Priority Indicator */}
        <div
          className={`h-2 w-2 rounded-full ${
            incident.priority === 1 ? 'bg-red-500' :
            incident.priority === 2 ? 'bg-orange-500' :
            incident.priority === 3 ? 'bg-yellow-500' :
            incident.priority === 4 ? 'bg-blue-500' :
            'bg-gray-500'
          }`}
        />

        {/* Severity Badge */}
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getSeverityColor(incident.severity)}`}>
          {incident.severity.toUpperCase()}
        </span>

        {/* Title and Description */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {incident.title}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {incident.description}
          </p>
        </div>

        {/* Status Badge */}
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(incident.status)}`}>
          {incident.status.replace('-', ' ').toUpperCase()}
        </span>

        {/* Assigned To */}
        {incident.assignedTo && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-medium">
              {incident.assignedTo.charAt(0).toUpperCase()}
            </div>
            <User className="h-4 w-4 text-gray-400" />
          </div>
        )}

        {/* Time */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(incident.createdAt)}
        </div>

        {/* Expand Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Tasks Progress */}
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-600">
                Tasks ({completedTasks}/{incident.tasks.length})
              </h4>
              <div className="mb-2 h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <div className="space-y-1">
                {incident.tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-xs">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'in-progress' ? 'bg-blue-500' :
                        'bg-gray-300'
                      }`}
                    />
                    <span className="flex-1 truncate">{task.title}</span>
                  </div>
                ))}
                {incident.tasks.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{incident.tasks.length - 3} more tasks
                  </div>
                )}
              </div>
            </div>

            {/* Impact */}
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-600">Impact</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Users Affected:</span>
                  <span className="font-medium">{incident.impact.usersAffected}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Systems:</span>
                  <span className="font-medium">{incident.impact.systemsAffected.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Exposed:</span>
                  <span className={`font-medium ${incident.impact.dataExposed ? 'text-red-500' : 'text-green-500'}`}>
                    {incident.impact.dataExposed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Affected Assets */}
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-600">Affected Assets</h4>
              <div className="flex flex-wrap gap-1">
                {incident.affectedAssets.map((asset) => (
                  <span
                    key={asset}
                    className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
                  >
                    {asset}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="mb-2 text-xs font-semibold text-gray-600">Recent Activity</h4>
              <div className="space-y-1">
                {incident.timeline.slice(-3).map((entry) => (
                  <div key={entry.id} className="text-xs">
                    <span className="text-gray-400">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                    {' '}
                    <span className="text-gray-700">{entry.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
