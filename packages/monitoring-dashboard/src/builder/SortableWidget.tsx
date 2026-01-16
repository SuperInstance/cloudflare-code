'use client';

// @ts-nocheck
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Settings } from 'lucide-react';
import { BaseWidget } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SortableWidgetProps {
  widget: BaseWidget;
  selected: boolean;
  onSelect: (widget: BaseWidget) => void;
  onDelete: (widgetId: string) => void;
  readOnly?: boolean;
}

export const SortableWidget: React.FC<SortableWidgetProps> = ({
  widget,
  selected,
  onSelect,
  onDelete,
  readOnly = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sizeClasses = {
    small: 'h-48',
    medium: 'h-64',
    large: 'h-80',
    xlarge: 'h-96',
    full: 'h-full',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative rounded-lg border bg-card overflow-hidden',
        'hover:shadow-lg transition-shadow',
        selected && 'ring-2 ring-primary',
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-pointer'
      )}
    >
      {/* Widget Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 bg-muted/20 border-b',
          'cursor-grab active:cursor-grabbing'
        )}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{widget.title}</span>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(widget);
              }}
            >
              <Settings className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(widget.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Widget Content Preview */}
      <div
        className={cn(
          'p-4 bg-muted/10 flex items-center justify-center',
          sizeClasses[widget.size]
        )}
        onClick={() => onSelect(widget)}
      >
        <div className="text-center text-muted-foreground">
          <div className="text-sm font-medium mb-1">{widget.type}</div>
          <div className="text-xs">{widget.size}</div>
          {widget.description && (
            <div className="text-xs mt-2 max-w-xs mx-auto">{widget.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SortableWidget;
