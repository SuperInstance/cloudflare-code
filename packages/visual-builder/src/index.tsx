/**
 * ClaudeFlare Visual Builder
 * React-based drag-and-drop interface for application design
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { VisualBuilderApp } from './components/VisualBuilderApp';
import { VisualBuilderProvider } from './context/VisualBuilderContext';
import './styles.css';

// Main entry point for the visual builder
export { VisualBuilderApp } from './components/VisualBuilderApp';
export { VisualBuilderProvider, useVisualBuilder, useCanvas, useServices, useRequirements, useArchitecture, useCosts } from './context/VisualBuilderContext';

// Export actual components
export { Sidebar } from './components/Sidebar';
export { MainCanvas } from './components/MainCanvas';
export { ServicePalette } from './components/ServicePalette';
export { PropertiesPanel } from './components/PropertiesPanel';
export { Toolbar } from './components/Toolbar';

// UI Components
export { Button } from './components/Button';
export { Input } from './components/Input';
export { Select } from './components/Select';
export { Card } from './components/Card';
export { Icon } from './components/Icon';
export { Tab, Tabs } from './components/Tab';
export { ErrorBoundary } from './components/ErrorBoundary';

// Type exports
export type {
  ServiceNode,
  Connection,
  Requirement,
  Template,
  Architecture,
  CostBreakdown
} from './types';

// Initialize the visual builder
if (typeof window !== 'undefined') {
  const root = ReactDOM.createRoot(
    document.getElementById('visual-builder-root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <VisualBuilderProvider>
        <VisualBuilderApp />
      </VisualBuilderProvider>
    </React.StrictMode>
  );
}