/**
 * Toolbar - Canvas actions and tools
 */

import React from 'react';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

export function Toolbar() {
  const { state, dispatch } = useVisualBuilder();

  const handleClearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the canvas? This will remove all services and connections.')) {
      // This would require updating the reducer to handle canvas clearing
      // For now, we'll reset to initial state
      dispatch({ type: 'RESET' });
    }
  };

  const handleZoomFit = () => {
    // Find bounds of all services
    const services = state.canvas.services;
    if (services.length === 0) return;

    const minX = Math.min(...services.map(s => s.position.x));
    const maxX = Math.max(...services.map(s => s.position.x + 200)); // Service width
    const minY = Math.min(...services.map(s => s.position.y));
    const maxY = Math.max(...services.map(s => s.position.y + 100)); // Service height

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const canvasWidth = 800;
    const canvasHeight = 600;
    const scaleX = (canvasWidth - 100) / width;
    const scaleY = (canvasHeight - 100) / height;
    const scale = Math.min(scaleX, scaleY, 1);

    dispatch({
      type: 'UPDATE_CANVAS_SCALE',
      payload: scale,
    });

    dispatch({
      type: 'UPDATE_CANVAS_POSITION',
      payload: {
        x: canvasWidth / 2 - centerX * scale,
        y: canvasHeight / 2 - centerY * scale,
      },
    });
  };

  const handleArrangeGrid = () => {
    const services = state.canvas.services;
    if (services.length === 0) return;

    const cols = Math.ceil(Math.sqrt(services.length));
    const spacing = 250;
    const startX = 100;
    const startY = 100;

    services.forEach((service, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      dispatch({
        type: 'UPDATE_SERVICE',
        payload: {
          id: service.id,
          updates: {
            position: {
              x: startX + col * spacing,
              y: startY + row * spacing,
            },
          },
        },
      });
    });
  };

  const handleExport = () => {
    const exportData = {
      project: state.project,
      canvas: {
        services: state.canvas.services.map(s => ({
          id: s.id,
          type: s.type,
          name: s.name,
          position: s.position,
          config: s.config,
          status: s.status,
        })),
        connections: state.canvas.connections,
      },
      timestamp: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cloudeflare-project-${state.project.name || 'export'}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={state.history.past.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Icon name="Undo" size={16} />
          Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={state.history.future.length === 0}
          title="Redo (Ctrl+Y)"
        >
          <Icon name="Redo" size={16} />
          Redo
        </Button>
      </div>

      <div className="toolbar-section">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleArrangeGrid}
          disabled={state.canvas.services.length === 0}
          title="Arrange in Grid"
        >
          <Icon name="Grid3X3" size={16} />
          Arrange
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomFit}
          disabled={state.canvas.services.length === 0}
          title="Fit to Canvas"
        >
          <Icon name="Minimize" size={16} />
          Fit
        </Button>
      </div>

      <div className="toolbar-section">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const name = prompt('Project name:', state.project.name);
            if (name) {
              dispatch({ type: 'UPDATE_PROJECT_NAME', payload: name });
            }
          }}
        >
          <Icon name="FileText" size={16} />
          Project
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const desc = prompt('Project description:', state.project.description);
            if (desc !== null) {
              dispatch({ type: 'UPDATE_PROJECT_DESCRIPTION', payload: desc });
            }
          }}
        >
          <Icon name="Type" size={16} />
          Description
        </Button>
      </div>

      <div className="toolbar-section">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          disabled={state.canvas.services.length === 0}
          title="Export Project"
        >
          <Icon name="Download" size={16} />
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearCanvas}
          disabled={state.canvas.services.length === 0}
          title="Clear Canvas"
        >
          <Icon name="Trash2" size={16} />
          Clear
        </Button>
      </div>

      <div className="toolbar-section right">
        <div className="project-info">
          <span className="project-name">{state.project.name}</span>
          <span className="project-type">{state.project.type}</span>
          <span className="service-count">
            {state.canvas.services.length} services
          </span>
        </div>
      </div>
    </div>
  );
}