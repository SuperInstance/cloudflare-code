/**
 * Sidebar component with service palette
 */

import React, { useState } from 'react';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { ServicePalette } from './ServicePalette';
import { RequirementsForm } from './RequirementsForm';
import { TemplateSelector } from './TemplateSelector';
import { Tab, Tabs } from '../components/Tab';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

export function Sidebar() {
  const { state, dispatch } = useVisualBuilder();
  const [activePaletteTab, setActivePaletteTab] = useState('all');

  const handleToggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  return (
    <div className={`sidebar ${state.ui.sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Icon name="Wrench" size={24} />
          <h2>ClaudeFlare Builder</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleToggleSidebar}>
          <Icon name={state.ui.sidebarOpen ? "ChevronLeft" : "ChevronRight"} />
        </Button>
      </div>

      <div className="sidebar-content">
        <Tabs
          activeTab={state.ui.activeTab}
          onTabChange={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
        >
          <Tab id="design" label="Design">
            <ServicePalette activeCategory={activePaletteTab} onCategoryChange={setActivePaletteTab} />
          </Tab>

          <Tab id="requirements" label="Requirements">
            <RequirementsForm />
          </Tab>

          <Tab id="templates" label="Templates">
            <TemplateSelector />
          </Tab>

          <Tab id="preview" label="Preview">
            <div className="preview-info">
              <Icon name="Eye" size={24} />
              <h3>Real-time Preview</h3>
              <p>View and export generated code for your services</p>
              <div className="preview-stats">
                <div className="stat">
                  <span>{state.canvas.services.length}</span>
                  <span>Services</span>
                </div>
                <div className="stat">
                  <span>{state.canvas.connections.length}</span>
                  <span>Connections</span>
                </div>
              </div>
            </div>
          </Tab>

          <Tab id="costs" label="Costs">
            <CostEstimator width={320} height={400} />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

// Helper function to get cost icon
function getCostIcon(category: string): string {
  const icons: Record<string, string> = {
    compute: 'Cpu',
    storage: 'Database',
    bandwidth: 'Wifi',
    database: 'Database'
  };
  return icons[category] || 'DollarSign';
}