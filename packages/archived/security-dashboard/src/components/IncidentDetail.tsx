import React, { useState } from 'react';
import { Incident, ResponsePlaybook } from '../types';
import { getSeverityColor, getStatusColor, formatRelativeTime } from '../lib/utils';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  FileText,
  MessageSquare,
  Paperclip,
} from 'lucide-react';

interface IncidentDetailProps {
  incident: Incident;
  playbooks: ResponsePlaybook[];
  onUpdate?: (updates: Partial<Incident>) => void;
  onDelete?: () => void;
  onBack?: () => void;
  onAddTimelineEntry?: (entry: Omit<Incident['timeline'][0], 'id'>) => void;
  className?: string;
}

export function IncidentDetail({
  incident,
  playbooks,
  onUpdate,
  onDelete,
  onBack,
  onAddTimelineEntry,
  className,
}: IncidentDetailProps) {
  const [editing, setEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);

  const completedTasks = incident.tasks.filter((t) => t.status === 'completed').length;
  const taskProgress = incident.tasks.length > 0
    ? Math.round((completedTasks / incident.tasks.length) * 100)
    : 0;

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    onAddTimelineEntry?.({
      timestamp: new Date(),
      action: 'Comment Added',
      description: newComment,
      performedBy: 'current-user',
    });
    setNewComment('');
  };

  const handleTaskToggle = (taskId: string) => {
    const updatedTasks = incident.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status:
              task.status === 'completed'
                ? 'pending'
                : 'in-progress',
            completedAt:
              task.status !== 'completed' ? new Date() : undefined,
          }
        : task
    );
    onUpdate?.({ tasks: updatedTasks });
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Incidents
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {incident.title}
              </h1>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getSeverityColor(incident.severity)}`}>
                {incident.severity.toUpperCase()}
              </span>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(incident.status)}`}>
                {incident.status.replace('-', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">{incident.description}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="rounded-md border border-gray-300 p-2 hover:bg-gray-50"
            >
              <Edit className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md border border-gray-300 p-2 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Priority: {incident.priority}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Assigned to: {incident.assignedTo || 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Created: {formatRelativeTime(incident.createdAt)}</span>
          </div>
          {incident.resolvedAt && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Resolved: {formatRelativeTime(incident.resolvedAt)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {incident.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {incident.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tasks */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Tasks ({completedTasks}/{incident.tasks.length})
              </h2>
              <button className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            </div>

            <div className="mb-4">
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {taskProgress}% complete
              </div>
            </div>

            <div className="space-y-2">
              {incident.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={() => handleTaskToggle(task.id)}
                />
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Timeline
            </h2>

            <div className="space-y-4">
              {incident.timeline.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Add Comment */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment or update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleAddComment}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Impact */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Impact</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Users Affected:</span>
                <span className="font-semibold">{incident.impact.usersAffected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Systems:</span>
                <span className="font-semibold">{incident.impact.systemsAffected.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data Exposed:</span>
                <span className={`font-semibold ${incident.impact.dataExposed ? 'text-red-600' : 'text-green-600'}`}>
                  {incident.impact.dataExposed ? 'Yes' : 'No'}
                </span>
              </div>
              {incident.impact.estimatedLoss && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Est. Loss:</span>
                  <span className="font-semibold">
                    ${incident.impact.estimatedLoss.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Affected Assets */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Affected Assets
            </h2>
            <div className="space-y-2">
              {incident.affectedAssets.map((asset) => (
                <div
                  key={asset}
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {asset}
                </div>
              ))}
            </div>
          </div>

          {/* Playbook */}
          {incident.playbook ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Response Playbook
              </h2>
              <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  {incident.playbook}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Attach Playbook
              </h2>
              <select
                value={selectedPlaybook || ''}
                onChange={(e) => setSelectedPlaybook(e.target.value || null)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a playbook...</option>
                {playbooks.map((pb) => (
                  <option key={pb.id} value={pb.id}>
                    {pb.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Resolution */}
          {incident.resolution && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <h2 className="mb-2 text-lg font-semibold text-green-900">
                Resolution
              </h2>
              <p className="text-sm text-green-800">{incident.resolution}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: Incident['tasks'][0];
  onToggle: () => void;
}

function TaskItem({ task, onToggle }: TaskItemProps) {
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in-progress';

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        isCompleted
          ? 'border-green-200 bg-green-50'
          : isInProgress
          ? 'border-blue-200 bg-blue-50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <button
        onClick={onToggle}
        className={`mt-0.5 h-5 w-5 rounded-full border-2 ${
          isCompleted
            ? 'border-green-500 bg-green-500'
            : isInProgress
            ? 'border-blue-500'
            : 'border-gray-300'
        } flex items-center justify-center`}
      >
        {isCompleted && (
          <CheckCircle className="h-3 w-3 text-white" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <h4
          className={`text-sm font-medium ${
            isCompleted ? 'text-green-900 line-through' : 'text-gray-900'
          }`}
        >
          {task.title}
        </h4>
        <p className="text-xs text-gray-600">{task.description}</p>
        {task.assignedTo && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span>{task.assignedTo}</span>
          </div>
        )}
      </div>

      {task.dueDate && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          <span>{formatRelativeTime(task.dueDate)}</span>
        </div>
      )}
    </div>
  );
}

interface TimelineEntryProps {
  entry: Incident['timeline'][0];
}

function TimelineEntry({ entry }: TimelineEntryProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full bg-blue-500" />
        <div className="w-0.5 flex-1 bg-gray-200" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {entry.action}
          </span>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
        <p className="text-sm text-gray-600">{entry.description}</p>
        <div className="mt-1 text-xs text-gray-500">
          by {entry.performedBy}
        </div>
      </div>
    </div>
  );
}
