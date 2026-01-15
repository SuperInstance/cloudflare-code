/**
 * Visual Builder App - Main application component
 */

import React, { useState, useEffect } from 'react';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { Sidebar } from './Sidebar';
import { MainCanvas } from './MainCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { Toolbar } from './Toolbar';
import { PreviewPanel } from './PreviewPanel';
import { CostEstimator } from './CostEstimator';
import { ErrorBoundary } from '../components/ErrorBoundary';

export function VisualBuilderApp() {
  const { state, dispatch } = useVisualBuilder();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Load saved state from localStorage
    const savedState = localStorage.getItem('visual-builder-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // You might want to validate the state before applying it
        // For now, we'll just reset on initial load
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    }

    // Handle keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Z for undo
      if (event.ctrlKey && event.key === 'z') {
        event.preventDefault();
        dispatch({ type: 'UNDO' });
      }

      // Ctrl+Y for redo
      if (event.ctrlKey && event.key === 'y') {
        event.preventDefault();
        dispatch({ type: 'REDO' });
      }

      // Delete for removing selected node
      if (event.key === 'Delete' && state.canvas.selectedNode) {
        dispatch({ type: 'DELETE_SERVICE', payload: state.canvas.selectedNode });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.canvas.selectedNode, dispatch]);

  // Auto-save state
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => {
        try {
          localStorage.setItem('visual-builder-state', JSON.stringify(state));
        } catch (error) {
          console.error('Failed to save state:', error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [state, mounted]);

  if (!mounted) {
    return (
      <div className="visual-builder loading">
        <div className="loading-spinner"></div>
        <span>Loading ClaudeFlare Visual Builder...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="visual-builder">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="main-canvas">
          {/* Toolbar */}
          <Toolbar />

          {/* Canvas container */}
          <div className="canvas-container">
            <MainCanvas />
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          {/* Properties Panel */}
          {state.ui.propertiesPanelOpen && state.canvas.selectedNode && (
            <PropertiesPanel />
          )}

          {/* Preview Panel */}
          {state.ui.activeTab === 'preview' && (
            <PreviewPanel width={400} height={600} />
          )}

          {/* Cost Estimator */}
          {state.ui.activeTab === 'costs' && (
            <CostEstimator width={400} height={600} />
          )}
        </div>

        {/* Error notification */}
        {state.ui.error && (
          <div className="error-notification">
            <div className="error-content">
              <strong>Error:</strong> {state.ui.error}
              <button
                className="error-close"
                onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {state.ui.loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <span>{state.ui.loading}</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}