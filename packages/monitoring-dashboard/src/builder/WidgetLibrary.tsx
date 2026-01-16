'use client';

// @ts-nocheck
import React from 'react';
import { X, LineChart, BarChart3, PieChart, Activity, Table, Grid3x3, AlertCircle, TrendingUp } from 'lucide-react';
import { WidgetType } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WidgetLibraryProps {
  onAddWidget: (type: WidgetType) => void;
  onClose: () => void;
}

const WIDGET_TYPES: Array<{
  type: WidgetType;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'chart' | 'metric' | 'table' | 'status';
}> = [
  {
    type: 'line-chart',
    label: 'Line Chart',
    description: 'Display trends over time with line charts',
    icon: LineChart,
    category: 'chart',
  },
  {
    type: 'bar-chart',
    label: 'Bar Chart',
    description: 'Compare values with bar charts',
    icon: BarChart3,
    category: 'chart',
  },
  {
    type: 'area-chart',
    label: 'Area Chart',
    description: 'Show volume and trends with area charts',
    icon: Activity,
    category: 'chart',
  },
  {
    type: 'pie-chart',
    label: 'Pie Chart',
    description: 'Display proportions with pie charts',
    icon: PieChart,
    category: 'chart',
  },
  {
    type: 'gauge-chart',
    label: 'Gauge Chart',
    description: 'Show progress with gauge charts',
    icon: Activity,
    category: 'metric',
  },
  {
    type: 'counter',
    label: 'Counter',
    description: 'Display single metrics with counters',
    icon: TrendingUp,
    category: 'metric',
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Display data in tabular format',
    icon: Table,
    category: 'table',
  },
  {
    type: 'heatmap',
    label: 'Heatmap',
    description: 'Visualize data density with heatmaps',
    icon: Grid3x3,
    category: 'chart',
  },
  {
    type: 'status-indicator',
    label: 'Status Indicator',
    description: 'Show operational status',
    icon: AlertCircle,
    category: 'status',
  },
];

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({
  onAddWidget,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const categories = ['all', 'chart', 'metric', 'table', 'status'];

  const filteredWidgets = selectedCategory === 'all'
    ? WIDGET_TYPES
    : WIDGET_TYPES.filter(w => w.category === selectedCategory);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Widget Library</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Category Filter */}
      <div className="border-b px-6 py-3 flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="capitalize"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Widget List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredWidgets.map((widget) => {
            const Icon = widget.icon;
            return (
              <button
                key={widget.type}
                onClick={() => onAddWidget(widget.type)}
                className={cn(
                  'w-full p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-all text-left',
                  'flex items-start gap-4'
                )}
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{widget.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {widget.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-6 py-4 bg-muted/20">
        <p className="text-xs text-muted-foreground">
          Click a widget type to add it to your dashboard
        </p>
      </div>
    </div>
  );
};

export default WidgetLibrary;
