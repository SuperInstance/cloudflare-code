/**
 * Service Node Component - Individual service node on canvas
 */

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { ServiceNode } from '../types';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

interface ServiceNodeComponentProps {
  service: ServiceNode;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onConnect: (fromNodeId: string, toNodeId: string) => void;
}

interface DragItem {
  type: string;
  id?: string;
  service?: ServiceNode;
}

interface ConnectionHandle {
  position: 'top' | 'right' | 'bottom' | 'left';
  x: number;
  y: number;
}

export function ServiceNodeComponent({
  service,
  isSelected,
  onSelect,
  onConnect,
}: ServiceNodeComponentProps) {
  const { state, dispatch } = useVisualBuilder();
  const nodeRef = useRef<HTMLDivElement>(null);

  // Handle drag for moving nodes
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'NODE',
    item: { type: 'NODE', id: service.id } as DragItem,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  // Handle drop for connections
  const [, drop] = useDrop(() => ({
    accept: ['NODE'],
    hover: (item: DragItem, monitor) => {
      if (!item.id || item.id === service.id) return;

      // Highlight when hovering over connection point
      const hoverBoundingRect = nodeRef.current?.getBoundingClientRect();
      if (!hoverBoundingRect) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const x = clientOffset.x - hoverBoundingRect.left;
      const y = clientOffset.y - hoverBoundingRect.top;

      // Check if hovering over connection handle areas
      const handleSize = 20;
      const handles = getConnectionHandles(service, nodeRef.current?.getBoundingClientRect());

      const isNearHandle = handles.some(handle => {
        const distance = Math.sqrt(
          Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2)
        );
        return distance <= handleSize;
      });

      if (isNearHandle) {
        nodeRef.current?.classList.add('connection-hover');
      } else {
        nodeRef.current?.classList.remove('connection-hover');
      }
    },
    drop: (item: DragItem) => {
      if (!item.id || item.id === service.id) return;

      nodeRef.current?.classList.remove('connection-hover');
      onConnect(item.id, service.id);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  // Get connection handle positions
  const getConnectionHandles = (node: ServiceNode, rect?: DOMRect | undefined): ConnectionHandle[] => {
    if (!rect) {
      // Default positions if rect not available
      return [
        { position: 'top', x: 100, y: 0 },
        { position: 'right', x: 200, y: 50 },
        { position: 'bottom', x: 100, y: 100 },
        { position: 'left', x: 0, y: 50 },
      ];
    }

    const nodeWidth = rect.width;
    const nodeHeight = rect.height;

    return [
      { position: 'top', x: nodeWidth / 2, y: 0 },
      { position: 'right', x: nodeWidth, y: nodeHeight / 2 },
      { position: 'bottom', x: nodeWidth / 2, y: nodeHeight },
      { position: 'left', x: 0, y: nodeHeight / 2 },
    ];
  };

  // Handle node click
  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(service.id);
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement context menu for service actions
  };

  // Handle double click for edit
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement service editor
  };

  // Service type specific styling
  const getServiceStyle = () => {
    const statusColors = {
      idle: 'bg-gray-50',
      deploying: 'bg-blue-50',
      running: 'bg-green-50',
      error: 'bg-red-50',
    };

    const borderColors = {
      idle: 'border-gray-200',
      deploying: 'border-blue-400',
      running: 'border-green-400',
      error: 'border-red-400',
    };

    return {
      background: statusColors[service.status],
      borderLeft: `4px solid ${service.metadata.color}`,
      borderColor: borderColors[service.status],
      opacity: isDragging ? 0.5 : 1,
      transform: isDragging ? 'scale(1.05)' : 'scale(1)',
    };
  };

  // Get status icon
  const getStatusIcon = () => {
    const statusIcons = {
      idle: 'Circle',
      deploying: 'Loader',
      running: 'CheckCircle',
      error: 'XCircle',
    };

    return statusIcons[service.status];
  };

  // Get status color
  const getStatusColor = () => {
    const statusColors = {
      idle: '#6b7280',
      deploying: '#3b82f6',
      running: '#10b981',
      error: '#ef4444',
    };

    return statusColors[service.status];
  };

  // Render connection handles
  const renderConnectionHandles = (rect: DOMRect) => {
    const handles = getConnectionHandles(service, rect);
    const handleSize = 10;

    return handles.map((handle) => (
      <div
        key={`${service.id}-${handle.position}`}
        className="connection-handle"
        style={{
          position: 'absolute',
          width: handleSize * 2,
          height: handleSize * 2,
          left: handle.x - handleSize,
          top: handle.y - handleSize,
          borderRadius: '50%',
          background: 'transparent',
          border: `2px dashed ${service.metadata.color}`,
          cursor: 'crosshair',
          opacity: isSelected ? 1 : 0.3,
        }}
      >
        <div
          className="connection-handle-dot"
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: service.metadata.color,
            left: handleSize - 2,
            top: handleSize - 2,
          }}
        />
      </div>
    ));
  };

  return (
    <div
      ref={node => {
        drag(node);
        drop(node);
        nodeRef.current = node;
      }}
      className={`service-node ${isSelected ? 'selected' : ''} ${service.status}`}
      style={getServiceStyle()}
      onClick={handleNodeClick}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {/* Connection handles */}
      {isSelected && renderConnectionHandles(nodeRef.current?.getBoundingClientRect() || {
        width: 200, height: 100, left: service.position.x, top: service.position.y
      })}

      {/* Service content */}
      <div className="service-content">
        <div className="service-header">
          <Icon
            name={service.metadata.icon}
            size={24}
            style={{ color: service.metadata.color }}
          />
          <div className="service-title">
            <h4 className="service-name">{service.name}</h4>
            <div className="service-status">
              <Icon
                name={getStatusIcon()}
                size={12}
                style={{ color: getStatusColor() }}
              />
              <span className="status-text">{service.status}</span>
            </div>
          </div>
        </div>

        <div className="service-details">
          <p className="service-description">{service.description}</p>

          <div className="service-config">
            <div className="config-item">
              <span className="config-label">Runtime:</span>
              <span className="config-value">{service.config.runtime}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Memory:</span>
              <span className="config-value">{service.config.resources.memory}</span>
            </div>
            {service.config.secrets.length > 0 && (
              <div className="config-item">
                <span className="config-label">Secrets:</span>
                <span className="config-value">{service.config.secrets.length}</span>
              </div>
            )}
          </div>

          <div className="service-tech">
            {service.metadata.technologies.slice(0, 2).map((tech) => (
              <span key={tech} className="tech-tag">
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        {isSelected && (
          <div className="service-actions">
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implement service configuration
              }}
            >
              <Icon name="Settings" size={14} />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'DELETE_SERVICE', payload: service.id });
              }}
            >
              <Icon name="Trash2" size={14} />
            </Button>
          </div>
        )}
      </div>

      {/* Position indicator (for debugging) */}
      <div className="position-indicator">
        {Math.round(service.position.x)}, {Math.round(service.position.y)}
      </div>
    </div>
  );
}