'use client';

// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Settings, Save, Undo, Redo, Eye } from 'lucide-react';
import { Dashboard, BaseWidget, WidgetType } from '@/types';
import { Button } from '@/components/ui/button';
import { WidgetLibrary } from './WidgetLibrary';
import { SortableWidget } from './SortableWidget';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { cn } from '@/lib/utils';

interface DashboardBuilderProps {
  dashboard: Dashboard;
  onSave: (dashboard: Dashboard) => void;
  onPreview?: () => void;
  readOnly?: boolean;
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  dashboard,
  onSave,
  onPreview,
  readOnly = false,
}) => {
  const [widgets, setWidgets] = useState<BaseWidget[]>(dashboard.widgets);
  const [selectedWidget, setSelectedWidget] = useState<BaseWidget | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<BaseWidget[][]>([widgets]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newWidgets = arrayMove(items, oldIndex, newIndex);
        addToHistory(newWidgets);
        return newWidgets;
      });
    }
  }, []);

  const addToHistory = useCallback((newWidgets: BaseWidget[]) => {
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newWidgets]);
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setWidgets(history[newIndex]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setWidgets(history[newIndex]);
    }
  }, [history, historyIndex]);

  const handleAddWidget = useCallback((type: WidgetType) => {
    const newWidget: BaseWidget = {
      id: `widget-${Date.now()}`,
      type,
      title: `${type} Widget`,
      size: 'medium',
      position: { x: 0, y: widgets.length, w: 4, h: 3 },
      dataSource: {
        type: 'query',
        query: '',
        queryLanguage: 'Custom',
      },
      config: getDefaultConfigForType(type),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    addToHistory(newWidgets);
    setSelectedWidget(newWidget);
    setShowLibrary(false);
  }, [widgets, addToHistory]);

  const handleUpdateWidget = useCallback((updatedWidget: BaseWidget) => {
    const newWidgets = widgets.map((w) =>
      w.id === updatedWidget.id ? { ...updatedWidget, updatedAt: new Date() } : w
    );
    setWidgets(newWidgets);
    addToHistory(newWidgets);
    setSelectedWidget(updatedWidget);
  }, [widgets, addToHistory]);

  const handleDeleteWidget = useCallback((widgetId: string) => {
    const newWidgets = widgets.filter((w) => w.id !== widgetId);
    setWidgets(newWidgets);
    addToHistory(newWidgets);
    if (selectedWidget?.id === widgetId) {
      setSelectedWidget(null);
    }
  }, [widgets, addToHistory, selectedWidget]);

  const handleSave = useCallback(() => {
    const updatedDashboard: Dashboard = {
      ...dashboard,
      widgets,
      updatedAt: new Date(),
    };
    onSave(updatedDashboard);
  }, [dashboard, widgets, onSave]);

  return (
    <div className="flex h-full bg-background">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground">{dashboard.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRedo}
                  disabled={historyIndex === history.length - 1}
                >
                  <Redo className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLibrary(!showLibrary)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Widget
                </Button>
                {onPreview && (
                  <Button variant="outline" size="sm" onClick={onPreview}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                )}
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Dashboard Canvas */}
        <div className="flex-1 overflow-auto p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <div
                className={cn(
                  'grid gap-4',
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                )}
              >
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    selected={selectedWidget?.id === widget.id}
                    onSelect={setSelectedWidget}
                    onDelete={handleDeleteWidget}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <div className="w-full h-32 bg-muted rounded-lg border-2 border-primary" />
              ) : null}
            </DragOverlay>
          </DndContext>

          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No widgets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add widgets to start building your dashboard
              </p>
              {!readOnly && (
                <Button onClick={() => setShowLibrary(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Widget
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Widget Library Sidebar */}
      {showLibrary && !readOnly && (
        <div className="w-80 border-l bg-muted/20 overflow-y-auto">
          <WidgetLibrary onAddWidget={handleAddWidget} onClose={() => setShowLibrary(false)} />
        </div>
      )}

      {/* Widget Config Panel */}
      {selectedWidget && !readOnly && (
        <div className="w-96 border-l bg-muted/20 overflow-y-auto">
          <WidgetConfigPanel
            widget={selectedWidget}
            onUpdate={handleUpdateWidget}
            onClose={() => setSelectedWidget(null)}
          />
        </div>
      )}
    </div>
  );
};

function getDefaultConfigForType(type: WidgetType): any {
  switch (type) {
    case 'line-chart':
    case 'bar-chart':
    case 'area-chart':
      return {
        series: [{ name: 'Value', dataKey: 'value', type: 'line' }],
        xAxis: { label: 'Time', type: 'time' },
        yAxis: [{ label: 'Value', type: 'number' }],
        legend: { show: true, position: 'bottom' },
        tooltip: { show: true },
        showGrid: true,
      };

    case 'gauge-chart':
    case 'counter':
      return {
        decimals: 2,
        format: 'number',
        trend: { show: true, period: '1h' },
        sparkline: { show: true },
      };

    case 'table':
      return {
        columns: [
          { key: 'name', label: 'Name', sortable: true },
          { key: 'value', label: 'Value', sortable: true },
        ],
        sortable: true,
        filterable: true,
        pagination: { enabled: true, pageSize: 10 },
      };

    case 'heatmap':
      return {
        xAxis: 'x',
        yAxis: 'y',
        valueKey: 'value',
        colorScheme: 'blues',
        showLabels: false,
        legend: { show: true },
      };

    case 'status-indicator':
      return {
        status: 'operational',
        showHistory: true,
      };

    default:
      return {};
  }
}

export default DashboardBuilder;
