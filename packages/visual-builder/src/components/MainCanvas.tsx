/**
 * Main Canvas - Drag-and-drop canvas for service placement
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { ServiceNode } from '../types';
import { ServiceNodeComponent } from './ServiceNodeComponent';
import { ConnectionLine } from './ConnectionLine';

interface CanvasProps {
  width: number;
  height: number;
  scale: number;
  position: { x: number; y: number };
}

interface CanvasDragItem {
  type: string;
  service?: any;
  x?: number;
  y?: number;
}

interface CanvasDropResult {
  x: number;
  y: number;
}

export function MainCanvas() {
  const { state, dispatch } = useVisualBuilder();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = React.useState<CanvasDragItem | null>(null);

  // Canvas state
  const { services, connections, selectedNode, canvasPosition, canvasScale } = state.canvas;

  // Handle drop on canvas
  const [, drop] = useDrop(() => ({
    accept: ['SERVICE'],
    drop: (item: CanvasDragItem, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (offset.x - rect.left - canvasPosition.x) / canvasScale;
      const y = (offset.y - rect.top - canvasPosition.y) / canvasScale;

      // Create new service node
      if (item.type === 'SERVICE' && item.service) {
        const newNode: ServiceNode = {
          id: `service-${Date.now()}`,
          type: item.service.type,
          name: item.service.name,
          description: item.service.description,
          position: { x, y },
          config: {
            ...item.service.defaultConfig,
            environmentVariables: {},
            secrets: []
          } as ServiceNode['config'],
          status: 'idle',
          metadata: {
            icon: item.service.icon,
            color: item.service.color,
            category: item.service.category,
            technologies: item.service.technologies,
            resources: {
              cpu: { min: 50, max: 1000, default: 100, unit: 'ms' },
              memory: { min: 64, max: 1024, default: 128, unit: 'MB' },
              storage: { min: 0.1, max: 10, default: 1, unit: 'GB' },
              bandwidth: { min: 1, max: 100, default: 5, unit: 'GB' }
            }
          }
        };

        dispatch({ type: 'ADD_SERVICE', payload: newNode });
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  // Drag and drop for canvas panning
  const [, dragCanvas] = useDrag(() => ({
    type: 'CANVAS',
    item: {},
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button

    e.preventDefault();
    const startX = e.clientX - canvasPosition.x;
    const startY = e.clientY - canvasPosition.y;

    const handleMouseMove = (e: MouseEvent) => {
      dispatch({
        type: 'UPDATE_CANVAS_POSITION',
        payload: {
          x: e.clientX - startX,
          y: e.clientY - startY,
        }
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle canvas zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(2, canvasScale * delta));

    // Zoom towards mouse position
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const ratioX = mouseX / canvasScale - canvasPosition.x / canvasScale;
      const ratioY = mouseY / canvasScale - canvasPosition.y / canvasScale;

      dispatch({
        type: 'UPDATE_CANVAS_SCALE',
        payload: newScale,
      });

      // Adjust position to zoom towards mouse
      setTimeout(() => {
        dispatch({
          type: 'UPDATE_CANVAS_POSITION',
          payload: {
            x: mouseX - ratioX * newScale,
            y: mouseY - ratioY * newScale,
          }
        });
      }, 0);
    }
  };

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      dispatch({ type: 'SELECT_NODE', payload: null });
    }
  };

  // Handle node connection creation
  const handleNodeConnection = useCallback((fromNodeId: string, toNodeId: string) => {
    const connection = {
      id: `conn-${Date.now()}`,
      source: fromNodeId,
      target: toNodeId,
      type: 'api' as const,
      status: 'active' as const,
    };
    dispatch({ type: 'ADD_CONNECTION', payload: connection });
  }, [dispatch]);

  // Update canvas when connections change
  useEffect(() => {
    // Auto-layout connections
    if (connections.length > 0) {
      // Simple auto-layout: arrange nodes in a circle if they don't have positions
      const positionedServices = services.filter(s => s.position.x !== 0 || s.position.y !== 0);
      const unpositionedServices = services.filter(s => s.position.x === 0 && s.position.y === 0);

      if (unpositionedServices.length > 0) {
        const angleStep = (2 * Math.PI) / unpositionedServices.length;
        const radius = 200;
        const centerX = canvasPosition.x + 400;
        const centerY = canvasPosition.y + 300;

        unpositionedServices.forEach((service, index) => {
          const angle = index * angleStep;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          dispatch({
            type: 'UPDATE_SERVICE',
            payload: {
              id: service.id,
              updates: {
                position: { x, y }
              }
            }
          });
        });
      }
    }
  }, [connections, services, canvasPosition, dispatch]);

  return (
    <div className="main-canvas">
      {/* Toolbar */}
      <div className="canvas-toolbar">
        <div className="canvas-controls">
          <button
            className="zoom-in"
            onClick={() => dispatch({ type: 'UPDATE_CANVAS_SCALE', payload: canvasScale * 1.2 })}
          >
            +
          </button>
          <button
            className="zoom-out"
            onClick={() => dispatch({ type: 'UPDATE_CANVAS_SCALE', payload: canvasScale * 0.8 })}
          >
            -
          </button>
          <button
            className="reset-view"
            onClick={() => {
              dispatch({ type: 'UPDATE_CANVAS_SCALE', payload: 1 });
              dispatch({ type: 'UPDATE_CANVAS_POSITION', payload: { x: 0, y: 0 } });
            }}
          >
            Reset
          </button>
        </div>
        <div className="canvas-info">
          Zoom: {Math.round(canvasScale * 100)}% |
          Services: {services.length} |
          Connections: {connections.length}
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={node => {
          drop(node);
          dragCanvas(node);
          canvasRef.current = node;
        }}
        className="canvas-container"
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        style={{
          cursor: 'grab',
          backgroundSize: '20px 20px',
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundPosition: `${canvasPosition.x}px ${canvasPosition.y}px`
        }}
      >
        {/* Grid background */}
        <div
          className="canvas-grid"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundSize: '20px 20px',
            backgroundImage: `
              linear-gradient(to right, #f3f4f6 1px, transparent 1px),
              linear-gradient(to bottom, #f3f4f6 1px, transparent 1px)
            `,
            transform: `scale(${canvasScale}) translate(${canvasPosition.x}px, ${canvasPosition.y}px)`,
            transformOrigin: '0 0',
          }}
        />

        {/* Connection lines */}
        <svg
          className="connection-layer"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {connections.map((connection) => {
            const sourceService = services.find(s => s.id === connection.source);
            const targetService = services.find(s => s.id === connection.target);

            if (!sourceService || !targetService) return null;

            return (
              <ConnectionLine
                key={connection.id}
                source={sourceService}
                target={targetService}
                status={connection.status}
                type={connection.type}
              />
            );
          })}
        </svg>

        {/* Service nodes */}
        {services.map((service) => (
          <ServiceNodeComponent
            key={service.id}
            service={service}
            isSelected={selectedNode === service.id}
            onSelect={(nodeId) => dispatch({ type: 'SELECT_NODE', payload: nodeId })}
            onConnect={handleNodeConnection}
          />
        ))}

        {/* Center guide */}
        <div
          className="canvas-center-guide"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${canvasScale})`,
          }}
        >
          <div className="guide-line-h" />
          <div className="guide-line-v" />
        </div>
      </div>
    </div>
  );
}

// Connection line component
interface ConnectionLineProps {
  source: ServiceNode;
  target: ServiceNode;
  status: 'active' | 'inactive' | 'error';
  type: 'data' | 'api' | 'auth' | 'cache';
}

function ConnectionLine({ source, target, status, type }: ConnectionLineProps) {
  // Calculate connection points (top edge for horizontal, edge for vertical)
  const sourceX = source.position.x + 100; // Node width is 200, center is 100
  const sourceY = source.position.y;
  const targetX = target.position.x + 100;
  const targetY = target.position.y;

  // Path for curved line
  const path = `M ${sourceX} ${sourceY} C ${sourceX} ${(sourceY + targetY) / 2}, ${targetX} ${(sourceY + targetY) / 2}, ${targetX} ${targetY}`;

  return (
    <g>
      <path
        d={path}
        stroke={status === 'error' ? '#ef4444' : '#6366f1'}
        strokeWidth="2"
        fill="none"
        strokeDasharray={status === 'inactive' ? '5,5' : 'none'}
        markerEnd="url(#arrowhead)"
      />
      <circle
        cx={targetX}
        cy={targetY}
        r="4"
        fill={status === 'error' ? '#ef4444' : '#6366f1'}
      />
    </g>
  );
}